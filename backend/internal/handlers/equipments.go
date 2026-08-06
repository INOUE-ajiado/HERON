package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/models"
	"github.com/ajiado/heron/backend/internal/service"
)

// listResponse はページネーション付き一覧の共通形。
type listResponse struct {
	Items   any   `json:"items"`
	Total   int64 `json:"total"`
	Page    int   `json:"page"`
	PerPage int   `json:"per_page"`
}

// ListEquipments は GET /api/equipments 。
// 検索条件（q, category, status, location_id, user_id）とページネーションに対応する。
func (h *Handler) ListEquipments(c *gin.Context) {
	page, perPage := paginationParams(c)

	q := h.gdb.Model(&models.Equipment{})

	if kw := strings.TrimSpace(c.Query("q")); kw != "" {
		// 機材ID・名称・型番の部分一致。大文字小文字を無視する。
		like := "%" + strings.ToLower(kw) + "%"
		q = q.Where(
			"LOWER(equipment_id) LIKE ? OR LOWER(name) LIKE ? OR LOWER(model_number) LIKE ?",
			like, like, like,
		)
	}
	if cat := strings.TrimSpace(c.Query("category")); cat != "" {
		q = q.Where("category = ?", strings.ToUpper(cat))
	}
	if st := strings.TrimSpace(c.Query("status")); st != "" {
		if !models.ValidStatuses[st] {
			badRequest(c, "status の値が不正です: "+st)
			return
		}
		q = q.Where("status = ?", st)
	}
	if v := strings.TrimSpace(c.Query("location_id")); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil {
			badRequest(c, "location_id は整数で指定してください")
			return
		}
		q = q.Where("current_location_id = ?", id)
	}
	if v := strings.TrimSpace(c.Query("user_id")); v != "" {
		q = q.Where("current_user_id = ?", v)
	}
	// 既定では廃棄済みを除外する。include_discarded=true で含める。
	if c.Query("include_discarded") != "true" {
		q = q.Where("status <> ?", models.StatusDiscarded)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		respondServiceError(c, err)
		return
	}

	var items []models.Equipment
	err := q.Preload("CurrentUser").Preload("CurrentLocation").
		Order("equipment_id ASC").
		Limit(perPage).Offset((page - 1) * perPage).
		Find(&items).Error
	if err != nil {
		respondServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, listResponse{Items: items, Total: total, Page: page, PerPage: perPage})
}

// GetEquipment は GET /api/equipments/:id 。機材詳細と直近の履歴を返す。
func (h *Handler) GetEquipment(c *gin.Context) {
	id := service.NormalizeEquipmentID(c.Param("id"))
	if id == "" {
		badRequest(c, "機材IDの形式が不正です（例: HRN-TAB-0108）")
		return
	}

	var eq models.Equipment
	err := h.gdb.Preload("CurrentUser").Preload("CurrentLocation").
		Where("equipment_id = ?", id).Take(&eq).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "指定された機材が見つかりません: " + id})
			return
		}
		respondServiceError(c, err)
		return
	}

	// 直近の履歴（既定10件）を併せて返す。
	limit := 10
	if v := c.Query("log_limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	var logs []models.TransactionLog
	if err := h.gdb.Preload("Actor").Preload("TargetUser").Preload("TargetLocation").
		Where("equipment_id = ?", id).
		Order("timestamp DESC, log_id DESC").Limit(limit).
		Find(&logs).Error; err != nil {
		respondServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"equipment": eq, "recent_logs": logs})
}

type createEquipmentRequest struct {
	Name        string  `json:"name" binding:"required"`
	Category    string  `json:"category" binding:"required"`
	DeptID      string  `json:"dept_id"`
	ModelNumber string  `json:"model_number"`
	LocationID  *int    `json:"location_id"`
	UserID      *string `json:"user_id"`
	PurchasedAt string  `json:"purchased_at"` // YYYY-MM-DD
	Note        string  `json:"note"`
}

// CreateEquipment は POST /api/equipments 。ID採番を伴う新規登録（管理者のみ）。
func (h *Handler) CreateEquipment(c *gin.Context) {
	var req createEquipmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "name と category は必須です")
		return
	}

	var purchasedAt *time.Time
	if s := strings.TrimSpace(req.PurchasedAt); s != "" {
		t, err := time.Parse("2006-01-02", s)
		if err != nil {
			badRequest(c, "purchased_at は YYYY-MM-DD 形式で指定してください")
			return
		}
		purchasedAt = &t
	}

	actorID := auth.CurrentUserID(c)
	var created models.Equipment

	err := h.gdb.Transaction(func(tx *gorm.DB) error {
		newID, err := service.NextEquipmentIDWithDept(tx, req.DeptID, req.Category)
		if err != nil {
			return err
		}
		cat, _ := service.NormalizeCategory(req.Category)

		eq := models.Equipment{
			EquipmentID: newID,
			Name:        strings.TrimSpace(req.Name),
			Category:    cat,
			ModelNumber: strings.TrimSpace(req.ModelNumber),
			Status:      models.StatusAvailable,
			PurchasedAt: purchasedAt,
			Note:        strings.TrimSpace(req.Note),
		}

		// 保管場所の指定があれば検証したうえで設定する。
		if req.LocationID != nil {
			var loc models.Location
			if err := tx.Where("location_id = ?", *req.LocationID).Take(&loc).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return service.ErrLocationNotFound
				}
				return err
			}
			eq.CurrentLocationID = &loc.LocationID
		}

		// 使用者の指定があれば検証したうえで設定し、利用中ステータスにする。
		if req.UserID != nil && strings.TrimSpace(*req.UserID) != "" {
			var usr models.User
			uID := strings.TrimSpace(*req.UserID)
			if err := tx.Where("user_id = ?", uID).Take(&usr).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return service.ErrUserNotFound
				}
				return err
			}
			eq.CurrentUserID = &usr.UserID
			eq.Status = models.StatusInUse
		}

		if err := tx.Create(&eq).Error; err != nil {
			return err
		}
		if err := tx.Create(&models.TransactionLog{
			EquipmentID:      eq.EquipmentID,
			ActionType:       models.ActionCreate,
			ActorUserID:      actorID,
			TargetUserID:     eq.CurrentUserID,
			TargetLocationID: eq.CurrentLocationID,
			Timestamp:        time.Now().UTC(),
		}).Error; err != nil {
			return err
		}
		created = eq
		return nil
	})
	if err != nil {
		// 採番・カテゴリ形式のエラーは入力起因なので 400 で返す。
		if strings.Contains(err.Error(), "カテゴリは英字") || strings.Contains(err.Error(), "上限(9999)") {
			badRequest(c, err.Error())
			return
		}
		respondServiceError(c, err)
		return
	}

	full, err := h.loadEquipment(created.EquipmentID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, full)
}

type updateEquipmentRequest struct {
	Name        *string `json:"name"`
	ModelNumber *string `json:"model_number"`
	Status      *string `json:"status"`
	LocationID  *int    `json:"location_id"`
	PurchasedAt *string `json:"purchased_at"`
	Note        *string `json:"note"`
}

// UpdateEquipment は PUT /api/equipments/:id 。属性とステータスの更新（管理者のみ）。
//
// 貸出・返却はステータスの直接変更ではなく /api/transactions/* で行う。
// ここで in_use への変更を許すと貸出先ユーザーが定まらないため拒否する。
func (h *Handler) UpdateEquipment(c *gin.Context) {
	id := service.NormalizeEquipmentID(c.Param("id"))
	if id == "" {
		badRequest(c, "機材IDの形式が不正です（例: HRN-TAB-0108）")
		return
	}
	var req updateEquipmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "リクエスト形式が不正です")
		return
	}

	actorID := auth.CurrentUserID(c)
	err := h.gdb.Transaction(func(tx *gorm.DB) error {
		var eq models.Equipment
		if err := tx.Where("equipment_id = ?", id).Take(&eq).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return service.ErrEquipmentNotFound
			}
			return err
		}

		updates := map[string]any{}
		if req.Name != nil {
			updates["name"] = strings.TrimSpace(*req.Name)
		}
		if req.ModelNumber != nil {
			updates["model_number"] = strings.TrimSpace(*req.ModelNumber)
		}
		if req.Note != nil {
			updates["note"] = strings.TrimSpace(*req.Note)
		}
		if req.PurchasedAt != nil {
			s := strings.TrimSpace(*req.PurchasedAt)
			if s == "" {
				updates["purchased_at"] = nil
			} else {
				t, err := time.Parse("2006-01-02", s)
				if err != nil {
					return errBadInput("purchased_at は YYYY-MM-DD 形式で指定してください")
				}
				updates["purchased_at"] = t
			}
		}
		if req.Status != nil {
			st := *req.Status
			if !models.ValidStatuses[st] {
				return errBadInput("status の値が不正です: " + st)
			}
			if st == models.StatusInUse {
				return errBadInput("貸出は /api/transactions/lend で行ってください")
			}
			updates["status"] = st
			// 貸出中から外れるので利用者を解除する。
			updates["current_user_id"] = nil
		}
		if req.LocationID != nil {
			var loc models.Location
			if err := tx.Where("location_id = ?", *req.LocationID).Take(&loc).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return service.ErrLocationNotFound
				}
				return err
			}
			updates["current_location_id"] = loc.LocationID
		}
		if len(updates) == 0 {
			return nil
		}

		if err := tx.Model(&models.Equipment{}).Where("equipment_id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Create(&models.TransactionLog{
			EquipmentID: id,
			ActionType:  models.ActionUpdate,
			ActorUserID: actorID,
			Timestamp:   time.Now().UTC(),
		}).Error
	})
	if err != nil {
		var bad *badInputError
		if errors.As(err, &bad) {
			badRequest(c, bad.msg)
			return
		}
		respondServiceError(c, err)
		return
	}

	full, err := h.loadEquipment(id)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, full)
}

// DiscardEquipment は DELETE /api/equipments/:id 。
//
// 設計書 3.2 の「廃棄・除却：履歴を保持するためにデータ上残している状態」に従い、
// 物理削除ではなくステータスを discarded に落とす論理削除とする。
func (h *Handler) DiscardEquipment(c *gin.Context) {
	id := service.NormalizeEquipmentID(c.Param("id"))
	if id == "" {
		badRequest(c, "機材IDの形式が不正です（例: HRN-TAB-0108）")
		return
	}

	actorID := auth.CurrentUserID(c)
	err := h.gdb.Transaction(func(tx *gorm.DB) error {
		var eq models.Equipment
		if err := tx.Where("equipment_id = ?", id).Take(&eq).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return service.ErrEquipmentNotFound
			}
			return err
		}
		if eq.Status == models.StatusInUse {
			return errBadInput("貸出中の機材は除却できません。先に返却処理を行ってください")
		}
		if err := tx.Model(&models.Equipment{}).Where("equipment_id = ?", id).
			Updates(map[string]any{
				"status":              models.StatusDiscarded,
				"current_user_id":     nil,
				"current_location_id": nil,
			}).Error; err != nil {
			return err
		}
		return tx.Create(&models.TransactionLog{
			EquipmentID: id,
			ActionType:  models.ActionDiscard,
			ActorUserID: actorID,
			Timestamp:   time.Now().UTC(),
		}).Error
	})
	if err != nil {
		var bad *badInputError
		if errors.As(err, &bad) {
			badRequest(c, bad.msg)
			return
		}
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"equipment_id": id, "status": models.StatusDiscarded})
}

// MyEquipments は GET /api/me/equipments 。自身が借用中の機材一覧（一般ユーザー向け）。
func (h *Handler) MyEquipments(c *gin.Context) {
	var items []models.Equipment
	err := h.gdb.Preload("CurrentLocation").
		Where("current_user_id = ? AND status = ?", auth.CurrentUserID(c), models.StatusInUse).
		Order("equipment_id ASC").Find(&items).Error
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// loadEquipment は関連付きで機材を1件取得する。
func (h *Handler) loadEquipment(id string) (*models.Equipment, error) {
	var eq models.Equipment
	err := h.gdb.Preload("CurrentUser").Preload("CurrentLocation").
		Where("equipment_id = ?", id).Take(&eq).Error
	if err != nil {
		return nil, err
	}
	return &eq, nil
}

// paginationParams は page / per_page を安全な範囲に丸めて返す。
func paginationParams(c *gin.Context) (page, perPage int) {
	page = 1
	perPage = 50
	if v, err := strconv.Atoi(c.Query("page")); err == nil && v > 0 {
		page = v
	}
	if v, err := strconv.Atoi(c.Query("per_page")); err == nil && v > 0 {
		perPage = v
	}
	if perPage > 200 {
		perPage = 200
	}
	return page, perPage
}

// badInputError はトランザクション内から入力エラーを持ち出すための型。
type badInputError struct{ msg string }

func (e *badInputError) Error() string { return e.msg }

func errBadInput(msg string) error { return &badInputError{msg: msg} }
