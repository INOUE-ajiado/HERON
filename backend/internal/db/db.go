// Package db は DB 接続の確立・マイグレーション・初期データ投入を担う。
package db

import (
	"fmt"
	"log"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/ajiado/heron/backend/internal/config"
	"github.com/ajiado/heron/backend/internal/models"
)

// Open は設定に応じて PostgreSQL または SQLite へ接続する。
//
// PostgreSQL はコンテナ起動直後に接続できないことがあるため、数回リトライする。
func Open(cfg *config.Config) (*gorm.DB, error) {
	gormCfg := &gorm.Config{
		// ErrRecordNotFound は「初回採番」「未登録機材のスキャン」など
		// 正常系でも発生するため、警告として記録しない。
		Logger: logger.New(log.Default(), logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		}),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
		// AutoMigrate による外部キーの自動生成は行わない。
		//
		// TransactionLog.Equipment は「多対一（belongs-to）」だが、
		// TransactionLog と Equipment の双方が EquipmentID フィールドを持つため
		// GORM が has-one と誤推論し、equipments 側に
		// 「equipment_id → transaction_logs.equipment_id」という誤った制約を
		// 生成してしまう。外部キーは Migrate() 内で明示的に張る。
		DisableForeignKeyConstraintWhenMigrating: true,
	}

	switch cfg.DBDriver {
	case "postgres":
		var gdb *gorm.DB
		var err error
		for attempt := 1; attempt <= 10; attempt++ {
			gdb, err = gorm.Open(postgres.Open(cfg.PostgresDSN()), gormCfg)
			if err == nil {
				return gdb, nil
			}
			log.Printf("postgres への接続に失敗 (%d/10): %v", attempt, err)
			time.Sleep(2 * time.Second)
		}
		return nil, fmt.Errorf("postgres への接続に失敗しました: %w", err)

	case "sqlite":
		// glebarez/sqlite は cgo 不要の純Go実装。Windows で gcc なしに動く。
		return gorm.Open(sqlite.Open(cfg.SQLitePath), gormCfg)

	default:
		return nil, fmt.Errorf("未対応の DB_DRIVER です: %q (postgres または sqlite)", cfg.DBDriver)
	}
}

// Migrate は全テーブルのスキーマを反映し、外部キー制約を張る。
func Migrate(gdb *gorm.DB) error {
	err := gdb.AutoMigrate(
		&models.User{},
		&models.Location{},
		&models.Equipment{},
		&models.TransactionLog{},
		&models.CategorySequence{},
	)
	if err != nil {
		return err
	}
	return addForeignKeys(gdb)
}

// foreignKey は張るべき外部キー1本分の定義。
type foreignKey struct {
	name      string
	table     string
	column    string
	refTable  string
	refColumn string
}

// 設計書 2章のリレーションに対応する外部キー。
var foreignKeys = []foreignKey{
	{"fk_equipments_current_user", "equipments", "current_user_id", "users", "user_id"},
	{"fk_equipments_current_location", "equipments", "current_location_id", "locations", "location_id"},
	{"fk_logs_equipment", "transaction_logs", "equipment_id", "equipments", "equipment_id"},
	{"fk_logs_actor", "transaction_logs", "actor_user_id", "users", "user_id"},
	{"fk_logs_target_user", "transaction_logs", "target_user_id", "users", "user_id"},
	{"fk_logs_target_location", "transaction_logs", "target_location_id", "locations", "location_id"},
}

// addForeignKeys は外部キー制約を冪等に追加する。
//
// SQLite は ALTER TABLE による制約追加に対応しておらず、既定で外部キーを
// 強制しないため、ローカル開発用途と割り切って何もしない。整合性は
// アプリケーション側（service パッケージ）の検証で担保している。
func addForeignKeys(gdb *gorm.DB) error {
	if !IsPostgres(gdb) {
		return nil
	}
	for _, fk := range foreignKeys {
		sql := fmt.Sprintf(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint WHERE conname = '%s'
				) THEN
					ALTER TABLE %s
						ADD CONSTRAINT %s FOREIGN KEY (%s)
						REFERENCES %s(%s);
				END IF;
			END $$;`,
			fk.name, fk.table, fk.name, fk.column, fk.refTable, fk.refColumn)
		if err := gdb.Exec(sql).Error; err != nil {
			return fmt.Errorf("外部キー %s の作成に失敗しました: %w", fk.name, err)
		}
	}
	return nil
}

// IsPostgres は接続先が PostgreSQL かを返す。
func IsPostgres(gdb *gorm.DB) bool {
	return gdb.Dialector.Name() == "postgres"
}
