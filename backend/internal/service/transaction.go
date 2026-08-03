package service

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ajiado/heron/backend/internal/models"
)

// 業務ルール違反を表すエラー。ハンドラ側で 400 / 404 / 409 に振り分ける。
var (
	ErrEquipmentNotFound = errors.New("指定された機材が見つかりません")
	ErrUserNotFound      = errors.New("指定されたユーザーが見つかりません")
	ErrLocationNotFound  = errors.New("指定された保管場所が見つかりません")
	ErrAlreadyInUse      = errors.New("この機材はすでに貸出中です")
	ErrNotInUse          = errors.New("この機材は貸出中ではありません")
	ErrDiscarded         = errors.New("廃棄・除却済みの機材は操作できません")
	ErrUnderMaintenance  = errors.New("修理・メンテナンス中の機材は貸し出せません")
)

// TransactionService は貸出・返却・棚卸しを扱う。
type TransactionService struct {
	gdb *gorm.DB
}

// NewTransactionService は TransactionService を生成する。
func NewTransactionService(gdb *gorm.DB) *TransactionService {
	return &TransactionService{gdb: gdb}
}

// lockEquipment は機材行を取得する。PostgreSQL では行ロックを取り、
// 同一機材への同時操作を直列化する。
func lockEquipment(tx *gorm.DB, equipmentID string) (*models.Equipment, error) {
	q := tx.Model(&models.Equipment{})
	if isPostgres(tx) {
		q = q.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var eq models.Equipment
	if err := q.Where("equipment_id = ?", equipmentID).Take(&eq).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrEquipmentNotFound, equipmentID)
		}
		return nil, err
	}
	return &eq, nil
}

// Lend は機材を指定ユーザーへ貸し出す（設計書 3.3 単一スキャン）。
func (s *TransactionService) Lend(actorID, equipmentID, targetUserID, note string) (*models.Equipment, error) {
	var result *models.Equipment
	err := s.gdb.Transaction(func(tx *gorm.DB) error {
		eq, err := lockEquipment(tx, equipmentID)
		if err != nil {
			return err
		}
		switch eq.Status {
		case models.StatusInUse:
			return ErrAlreadyInUse
		case models.StatusDiscarded:
			return ErrDiscarded
		case models.StatusMaintenance:
			return ErrUnderMaintenance
		}

		var target models.User
		if err := tx.Where("user_id = ?", targetUserID).Take(&target).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: %s", ErrUserNotFound, targetUserID)
			}
			return err
		}

		// 貸出中は所在をユーザーに移すため、ロケーションは外す。
		eq.Status = models.StatusInUse
		eq.CurrentUserID = &target.UserID
		eq.CurrentLocationID = nil
		if err := tx.Model(&models.Equipment{}).
			Where("equipment_id = ?", eq.EquipmentID).
			Updates(map[string]any{
				"status":              eq.Status,
				"current_user_id":     eq.CurrentUserID,
				"current_location_id": nil,
			}).Error; err != nil {
			return err
		}

		if err := writeLog(tx, &models.TransactionLog{
			EquipmentID:  eq.EquipmentID,
			ActionType:   models.ActionLend,
			ActorUserID:  actorID,
			TargetUserID: &target.UserID,
			Note:         note,
		}); err != nil {
			return err
		}
		result = eq
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.loadWithRelations(result.EquipmentID)
}

// Return は機材を指定ロケーションへ返却する（設計書 3.3 単一スキャン）。
func (s *TransactionService) Return(actorID, equipmentID string, locationID int, note string) (*models.Equipment, error) {
	var result *models.Equipment
	err := s.gdb.Transaction(func(tx *gorm.DB) error {
		eq, err := lockEquipment(tx, equipmentID)
		if err != nil {
			return err
		}
		if eq.Status == models.StatusDiscarded {
			return ErrDiscarded
		}
		if eq.Status != models.StatusInUse {
			return ErrNotInUse
		}

		var loc models.Location
		if err := tx.Where("location_id = ?", locationID).Take(&loc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: %d", ErrLocationNotFound, locationID)
			}
			return err
		}

		if err := tx.Model(&models.Equipment{}).
			Where("equipment_id = ?", eq.EquipmentID).
			Updates(map[string]any{
				"status":              models.StatusAvailable,
				"current_user_id":     nil,
				"current_location_id": loc.LocationID,
			}).Error; err != nil {
			return err
		}

		if err := writeLog(tx, &models.TransactionLog{
			EquipmentID:      eq.EquipmentID,
			ActionType:       models.ActionReturn,
			ActorUserID:      actorID,
			TargetUserID:     eq.CurrentUserID, // 誰から返ってきたかを証跡に残す
			TargetLocationID: &loc.LocationID,
			Note:             note,
		}); err != nil {
			return err
		}
		result = eq
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.loadWithRelations(result.EquipmentID)
}

// InventoryResult は棚卸し1回分の結果。
type InventoryResult struct {
	LocationID int      `json:"location_id"`
	// Updated は今回スキャンして当該ロケーションに反映した機材ID。
	Updated []string `json:"updated"`
	// MovedIn は他の場所・貸出中から当該ロケーションへ移動してきた機材ID。
	MovedIn []string `json:"moved_in"`
	// Missing は「当該ロケーションにあるはずだが今回スキャンされなかった」機材ID。
	// 設計書には明記がないが、棚卸しの主目的である紛失検知のために返す。
	Missing []string `json:"missing"`
	// NotFound は DB に存在しない機材ID（ラベル誤読・未登録機材）。
	NotFound []string `json:"not_found"`
	// Skipped は廃棄済みのためスキップした機材ID。
	Skipped []string `json:"skipped"`
}

// Inventory は指定ロケーションの一括棚卸しを行う（設計書 3.3 連続スキャン）。
//
// スキャンされた機材の現在位置を対象ロケーションで上書きし「保管中」にする。
// あわせて、対象ロケーションに紐づいたままスキャンされなかった機材を
// Missing として返す。
func (s *TransactionService) Inventory(actorID string, locationID int, equipmentIDs []string) (*InventoryResult, error) {
	res := &InventoryResult{
		LocationID: locationID,
		Updated:    []string{},
		MovedIn:    []string{},
		Missing:    []string{},
		NotFound:   []string{},
		Skipped:    []string{},
	}

	err := s.gdb.Transaction(func(tx *gorm.DB) error {
		var loc models.Location
		if err := tx.Where("location_id = ?", locationID).Take(&loc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: %d", ErrLocationNotFound, locationID)
			}
			return err
		}

		// 棚卸し前に当該ロケーションへ登録されている機材を控えておく。
		var before []string
		if err := tx.Model(&models.Equipment{}).
			Where("current_location_id = ? AND status <> ?", locationID, models.StatusDiscarded).
			Pluck("equipment_id", &before).Error; err != nil {
			return err
		}

		scanned := make(map[string]bool, len(equipmentIDs))
		for _, rawID := range equipmentIDs {
			id := NormalizeEquipmentID(rawID)
			if id == "" || scanned[id] {
				continue // 空文字と、連続スキャンでの重複読み取りは無視する
			}
			scanned[id] = true

			eq, err := lockEquipment(tx, id)
			if err != nil {
				if errors.Is(err, ErrEquipmentNotFound) {
					res.NotFound = append(res.NotFound, id)
					continue
				}
				return err
			}
			if eq.Status == models.StatusDiscarded {
				res.Skipped = append(res.Skipped, id)
				continue
			}

			wasElsewhere := eq.CurrentLocationID == nil || *eq.CurrentLocationID != locationID
			if err := tx.Model(&models.Equipment{}).
				Where("equipment_id = ?", id).
				Updates(map[string]any{
					"status":              models.StatusAvailable,
					"current_user_id":     nil,
					"current_location_id": locationID,
				}).Error; err != nil {
				return err
			}
			if err := writeLog(tx, &models.TransactionLog{
				EquipmentID:      id,
				ActionType:       models.ActionInventory,
				ActorUserID:      actorID,
				TargetLocationID: &locationID,
			}); err != nil {
				return err
			}

			res.Updated = append(res.Updated, id)
			if wasElsewhere {
				res.MovedIn = append(res.MovedIn, id)
			}
		}

		for _, id := range before {
			if !scanned[id] {
				res.Missing = append(res.Missing, id)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// writeLog は監査ログを1件追記する。時刻はサーバ側で確定させる。
func writeLog(tx *gorm.DB, entry *models.TransactionLog) error {
	entry.Timestamp = time.Now().UTC()
	return tx.Create(entry).Error
}

// loadWithRelations は関連（利用者・ロケーション）を含めて機材を再取得する。
func (s *TransactionService) loadWithRelations(equipmentID string) (*models.Equipment, error) {
	var eq models.Equipment
	err := s.gdb.
		Preload("CurrentUser").
		Preload("CurrentLocation").
		Where("equipment_id = ?", equipmentID).
		Take(&eq).Error
	if err != nil {
		return nil, err
	}
	return &eq, nil
}
