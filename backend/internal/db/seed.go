package db

import (
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/models"
	"github.com/ajiado/heron/backend/internal/service"
)

// Seed は動作確認用の初期データを投入する。
//
// 既にユーザーが1件でも存在する場合は何もしない（本番データの上書き防止）。
// 本番運用では SEED_DEMO=false を指定して無効化すること。
func Seed(gdb *gorm.DB) error {
	var userCount int64
	if err := gdb.Model(&models.User{}).Count(&userCount).Error; err != nil {
		return err
	}
	if userCount > 0 {
		return nil
	}

	log.Println("初期データを投入します（SEED_DEMO=false で無効化できます）")

	adminHash, err := auth.HashPassword("heron-admin")
	if err != nil {
		return err
	}
	generalHash, err := auth.HashPassword("heron-user")
	if err != nil {
		return err
	}

	admin := models.User{
		UserID: uuid.NewString(), LoginID: "admin", PasswordHash: adminHash,
		Name: "情シス 管理者", Role: models.RoleAdmin,
	}
	users := []models.User{
		admin,
		{UserID: uuid.NewString(), LoginID: "animator1", PasswordHash: generalHash, Name: "作画 太郎", Role: models.RoleGeneral},
		{UserID: uuid.NewString(), LoginID: "animator2", PasswordHash: generalHash, Name: "原画 花子", Role: models.RoleGeneral},
		{UserID: uuid.NewString(), LoginID: "producer1", PasswordHash: generalHash, Name: "制作 次郎", Role: models.RoleGeneral},
	}
	if err := gdb.Create(&users).Error; err != nil {
		return err
	}

	locations := []models.Location{
		{RoomName: "第1作画室", ShelfName: "機材棚A-1段目"},
		{RoomName: "第1作画室", ShelfName: "機材棚A-3段目"},
		{RoomName: "第2作画室", ShelfName: "機材棚B-2段目"},
		{RoomName: "撮影室", ShelfName: "キャビネットC"},
		{RoomName: "情シス倉庫", ShelfName: "予備機材棚"},
	}
	if err := gdb.Create(&locations).Error; err != nil {
		return err
	}

	type seedEquipment struct {
		name     string
		category string
		model    string
		locIdx   int
	}
	specs := []seedEquipment{
		{"Wacom Cintiq Pro 24", "TAB", "DTH-2420", 0},
		{"Wacom Cintiq 16", "TAB", "DTK-1660", 0},
		{"Wacom Cintiq Pro 27", "TAB", "DTH-271", 1},
		{"EIZO ColorEdge CS2740", "DSP", "CS2740-X", 1},
		{"EIZO FlexScan EV2795", "DSP", "EV2795-BK", 2},
		{"Dell UltraSharp U2723QE", "DSP", "U2723QE", 2},
		{"Mac Studio M2 Max", "PC", "MJMV3J/A", 4},
		{"MacBook Pro 16インチ", "PC", "MNWD3J/A", 4},
		{"Windows 検証機", "PC", "OptiPlex 7010", 4},
		{"iPad Pro 12.9 検証用", "TAB", "MNXR3J/A", 3},
		{"Sony α7 IV 撮影用", "CAM", "ILCE-7M4", 3},
	}

	now := time.Now().UTC()
	return gdb.Transaction(func(tx *gorm.DB) error {
		for _, s := range specs {
			id, err := service.NextEquipmentID(tx, s.category)
			if err != nil {
				return err
			}
			locID := locations[s.locIdx].LocationID
			eq := models.Equipment{
				EquipmentID:       id,
				Name:              s.name,
				Category:          s.category,
				ModelNumber:       s.model,
				Status:            models.StatusAvailable,
				CurrentLocationID: &locID,
			}
			if err := tx.Create(&eq).Error; err != nil {
				return err
			}
			if err := tx.Create(&models.TransactionLog{
				EquipmentID:      id,
				ActionType:       models.ActionCreate,
				ActorUserID:      admin.UserID,
				TargetLocationID: &locID,
				Timestamp:        now,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
