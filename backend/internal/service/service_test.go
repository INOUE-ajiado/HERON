package service

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/ajiado/heron/backend/internal/models"
)

// newTestDB はテスト用の一時 SQLite DB を作る。
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	gdb, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("テスト用 DB の作成に失敗: %v", err)
	}
	err = gdb.AutoMigrate(
		&models.User{}, &models.Location{}, &models.Equipment{},
		&models.TransactionLog{}, &models.CategorySequence{},
	)
	if err != nil {
		t.Fatalf("マイグレーションに失敗: %v", err)
	}
	// Windows では接続が開いたままだと TempDir の削除に失敗するため、
	// t.TempDir() の削除処理より先に（Cleanup は LIFO）接続を閉じる。
	t.Cleanup(func() {
		if sqlDB, err := gdb.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return gdb
}

// fixtures は管理者・一般ユーザー・保管場所2件を作る。
func fixtures(t *testing.T, gdb *gorm.DB) (adminID, userID string, locA, locB int) {
	t.Helper()
	admin := models.User{UserID: "admin-1", LoginID: "admin", PasswordHash: "x", Name: "管理者", Role: models.RoleAdmin}
	user := models.User{UserID: "user-1", LoginID: "user", PasswordHash: "x", Name: "作画 太郎", Role: models.RoleGeneral}
	if err := gdb.Create(&[]models.User{admin, user}).Error; err != nil {
		t.Fatalf("ユーザー作成に失敗: %v", err)
	}
	l1 := models.Location{RoomName: "第1作画室", ShelfName: "棚A"}
	l2 := models.Location{RoomName: "第2作画室", ShelfName: "棚B"}
	if err := gdb.Create(&l1).Error; err != nil {
		t.Fatalf("保管場所作成に失敗: %v", err)
	}
	if err := gdb.Create(&l2).Error; err != nil {
		t.Fatalf("保管場所作成に失敗: %v", err)
	}
	return admin.UserID, user.UserID, l1.LocationID, l2.LocationID
}

// createEquipment は採番付きで機材を1件作る。
func createEquipment(t *testing.T, gdb *gorm.DB, category string, locID int) string {
	t.Helper()
	var id string
	err := gdb.Transaction(func(tx *gorm.DB) error {
		var err error
		id, err = NextEquipmentID(tx, category)
		if err != nil {
			return err
		}
		cat, _ := NormalizeCategory(category)
		return tx.Create(&models.Equipment{
			EquipmentID: id, Name: "テスト機材", Category: cat,
			Status: models.StatusAvailable, CurrentLocationID: &locID,
		}).Error
	})
	if err != nil {
		t.Fatalf("機材作成に失敗: %v", err)
	}
	return id
}

func TestNextEquipmentID(t *testing.T) {
	gdb := newTestDB(t)

	// 設計書 3.1: HRN-[カテゴリ]-[連番4桁]、0001 からゼロパディング。
	want := []string{"HRN-TAB-0001", "HRN-TAB-0002", "HRN-TAB-0003"}
	for _, w := range want {
		var got string
		err := gdb.Transaction(func(tx *gorm.DB) error {
			var err error
			got, err = NextEquipmentID(tx, "tab") // 小文字入力も正規化されること
			return err
		})
		if err != nil {
			t.Fatalf("採番に失敗: %v", err)
		}
		if got != w {
			t.Errorf("採番結果が想定と異なる: got=%s want=%s", got, w)
		}
	}

	// カテゴリごとに独立した連番であること。
	var got string
	if err := gdb.Transaction(func(tx *gorm.DB) error {
		var err error
		got, err = NextEquipmentID(tx, "PC")
		return err
	}); err != nil {
		t.Fatalf("採番に失敗: %v", err)
	}
	if got != "HRN-PC-0001" {
		t.Errorf("カテゴリ別採番が独立していない: got=%s want=HRN-PC-0001", got)
	}
}

func TestNormalizeCategoryRejectsInvalid(t *testing.T) {
	for _, in := range []string{"", "A", "TOOLONG", "P1", "ペン"} {
		if _, err := NormalizeCategory(in); err == nil {
			t.Errorf("不正なカテゴリ %q が許容された", in)
		}
	}
	for _, in := range []string{"PC", "dsp", " tab ", "CAM"} {
		if _, err := NormalizeCategory(in); err != nil {
			t.Errorf("正当なカテゴリ %q が拒否された: %v", in, err)
		}
	}
}

func TestNormalizeEquipmentID(t *testing.T) {
	cases := map[string]string{
		"HRN-TAB-0108":                        "HRN-TAB-0108",
		"hrn-tab-0108":                        "HRN-TAB-0108",
		"  HRN-PC-0001  ":                     "HRN-PC-0001",
		"https://heron.local/e/HRN-DSP-0042":  "HRN-DSP-0042",
		"HRN-TAB-108":                         "", // 4桁ゼロパディングでない
		"TAB-0108":                            "", // プレフィックス欠落
		"":                                    "",
		"DROP TABLE equipments":               "",
	}
	for in, want := range cases {
		if got := NormalizeEquipmentID(in); got != want {
			t.Errorf("NormalizeEquipmentID(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestLendAndReturn(t *testing.T) {
	gdb := newTestDB(t)
	adminID, userID, locA, locB := fixtures(t, gdb)
	svc := NewTransactionService(gdb)
	id := createEquipment(t, gdb, "TAB", locA)

	// 貸出：ステータスが in_use、利用者が設定され、ロケーションは外れる。
	eq, err := svc.Lend(adminID, id, userID, "カット作業のため")
	if err != nil {
		t.Fatalf("貸出に失敗: %v", err)
	}
	if eq.Status != models.StatusInUse {
		t.Errorf("貸出後のステータスが不正: %s", eq.Status)
	}
	if eq.CurrentUserID == nil || *eq.CurrentUserID != userID {
		t.Errorf("貸出先ユーザーが設定されていない")
	}
	if eq.CurrentLocationID != nil {
		t.Errorf("貸出中はロケーションが外れるべき")
	}

	// 二重貸出は拒否される。
	if _, err := svc.Lend(adminID, id, userID, ""); !errors.Is(err, ErrAlreadyInUse) {
		t.Errorf("二重貸出が拒否されていない: %v", err)
	}

	// 返却：別のロケーションへ戻せる。
	eq, err = svc.Return(adminID, id, locB, "")
	if err != nil {
		t.Fatalf("返却に失敗: %v", err)
	}
	if eq.Status != models.StatusAvailable {
		t.Errorf("返却後のステータスが不正: %s", eq.Status)
	}
	if eq.CurrentUserID != nil {
		t.Errorf("返却後に利用者が残っている")
	}
	if eq.CurrentLocationID == nil || *eq.CurrentLocationID != locB {
		t.Errorf("返却先ロケーションが反映されていない")
	}

	// 貸出中でない機材の返却は拒否される。
	if _, err := svc.Return(adminID, id, locB, ""); !errors.Is(err, ErrNotInUse) {
		t.Errorf("非貸出中の返却が拒否されていない: %v", err)
	}

	// 監査ログが lend / return ともに残っていること。
	var logs []models.TransactionLog
	if err := gdb.Where("equipment_id = ?", id).Order("log_id ASC").Find(&logs).Error; err != nil {
		t.Fatalf("ログ取得に失敗: %v", err)
	}
	var actions []string
	for _, l := range logs {
		actions = append(actions, l.ActionType)
	}
	if len(actions) != 2 || actions[0] != models.ActionLend || actions[1] != models.ActionReturn {
		t.Errorf("監査ログが想定と異なる: %v", actions)
	}
}

func TestLendRejectsMaintenanceAndDiscarded(t *testing.T) {
	gdb := newTestDB(t)
	adminID, userID, locA, _ := fixtures(t, gdb)
	svc := NewTransactionService(gdb)

	maintID := createEquipment(t, gdb, "DSP", locA)
	gdb.Model(&models.Equipment{}).Where("equipment_id = ?", maintID).
		Update("status", models.StatusMaintenance)
	if _, err := svc.Lend(adminID, maintID, userID, ""); !errors.Is(err, ErrUnderMaintenance) {
		t.Errorf("メンテナンス中の貸出が拒否されていない: %v", err)
	}

	discID := createEquipment(t, gdb, "DSP", locA)
	gdb.Model(&models.Equipment{}).Where("equipment_id = ?", discID).
		Update("status", models.StatusDiscarded)
	if _, err := svc.Lend(adminID, discID, userID, ""); !errors.Is(err, ErrDiscarded) {
		t.Errorf("廃棄済みの貸出が拒否されていない: %v", err)
	}

	if _, err := svc.Lend(adminID, "HRN-TAB-9999", userID, ""); !errors.Is(err, ErrEquipmentNotFound) {
		t.Errorf("存在しない機材の貸出が拒否されていない: %v", err)
	}
}

func TestInventory(t *testing.T) {
	gdb := newTestDB(t)
	adminID, userID, locA, locB := fixtures(t, gdb)
	svc := NewTransactionService(gdb)

	stay := createEquipment(t, gdb, "TAB", locA)    // 棚Aにあり、今回もスキャンされる
	missing := createEquipment(t, gdb, "TAB", locA) // 棚Aにあるが、今回スキャンされない
	moved := createEquipment(t, gdb, "DSP", locB)   // 棚Bから棚Aへ移動
	lent := createEquipment(t, gdb, "PC", locB)     // 貸出中だが棚Aで発見された

	if _, err := svc.Lend(adminID, lent, userID, ""); err != nil {
		t.Fatalf("前提の貸出に失敗: %v", err)
	}

	res, err := svc.Inventory(adminID, locA, []string{
		stay,
		"  " + moved + "  ", // 前後の空白を吸収できること
		lent,
		stay,             // 連続スキャンでの重複読み取り
		"HRN-CAM-0099",   // 未登録
		"不正な文字列",   // 形式不正 → 無視
	})
	if err != nil {
		t.Fatalf("棚卸しに失敗: %v", err)
	}

	if len(res.Updated) != 3 {
		t.Errorf("更新件数が想定と異なる: %v", res.Updated)
	}
	if len(res.Missing) != 1 || res.Missing[0] != missing {
		t.Errorf("紛失候補の検出が想定と異なる: %v (want [%s])", res.Missing, missing)
	}
	if len(res.MovedIn) != 2 {
		t.Errorf("移動検出が想定と異なる: %v", res.MovedIn)
	}
	if len(res.NotFound) != 1 || res.NotFound[0] != "HRN-CAM-0099" {
		t.Errorf("未登録機材の検出が想定と異なる: %v", res.NotFound)
	}

	// 貸出中だった機材が「保管中」に戻り、利用者が外れていること。
	var eq models.Equipment
	if err := gdb.Where("equipment_id = ?", lent).Take(&eq).Error; err != nil {
		t.Fatalf("機材取得に失敗: %v", err)
	}
	if eq.Status != models.StatusAvailable || eq.CurrentUserID != nil {
		t.Errorf("棚卸しで貸出状態が解除されていない: status=%s user=%v", eq.Status, eq.CurrentUserID)
	}
	if eq.CurrentLocationID == nil || *eq.CurrentLocationID != locA {
		t.Errorf("棚卸し先ロケーションが反映されていない")
	}

	// スキャンされなかった機材の所在は変更されないこと。
	var miss models.Equipment
	if err := gdb.Where("equipment_id = ?", missing).Take(&miss).Error; err != nil {
		t.Fatalf("機材取得に失敗: %v", err)
	}
	if miss.CurrentLocationID == nil || *miss.CurrentLocationID != locA {
		t.Errorf("未スキャン機材の所在が書き換えられている")
	}
}

func TestInventoryRejectsUnknownLocation(t *testing.T) {
	gdb := newTestDB(t)
	adminID, _, _, _ := fixtures(t, gdb)
	svc := NewTransactionService(gdb)

	if _, err := svc.Inventory(adminID, 9999, []string{}); !errors.Is(err, ErrLocationNotFound) {
		t.Errorf("存在しないロケーションの棚卸しが拒否されていない: %v", err)
	}
}

func TestSyncSequence(t *testing.T) {
	gdb := newTestDB(t)
	_, _, locA, _ := fixtures(t, gdb)

	// 採番テーブルを介さずに機材を投入した状況を作る。
	locID := locA
	if err := gdb.Create(&models.Equipment{
		EquipmentID: "HRN-CAM-0042", Name: "移行データ", Category: "CAM",
		Status: models.StatusAvailable, CurrentLocationID: &locID,
	}).Error; err != nil {
		t.Fatalf("機材作成に失敗: %v", err)
	}

	if err := SyncSequence(gdb, "CAM"); err != nil {
		t.Fatalf("採番同期に失敗: %v", err)
	}

	var got string
	if err := gdb.Transaction(func(tx *gorm.DB) error {
		var err error
		got, err = NextEquipmentID(tx, "CAM")
		return err
	}); err != nil {
		t.Fatalf("採番に失敗: %v", err)
	}
	if got != "HRN-CAM-0043" {
		t.Errorf("同期後の採番が想定と異なる: got=%s want=HRN-CAM-0043", got)
	}
}
