// Package service は業務ロジック（採番・貸出・返却・棚卸し）を担う。
package service

import (
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ajiado/heron/backend/internal/models"
)

// isPostgres は接続先が PostgreSQL かを返す。
// SQLite は SELECT ... FOR UPDATE を解釈できないため、行ロックの出し分けに使う。
func isPostgres(gdb *gorm.DB) bool {
	return gdb.Dialector.Name() == "postgres"
}

// IDPrefix は機材IDの固定プレフィックス（設計書 3.1）。
const IDPrefix = "HRN"

// categoryPattern はカテゴリの許容形（英大文字 2〜3 文字）。
var categoryPattern = regexp.MustCompile(`^[A-Z]{2,3}$`)

// EquipmentIDPattern は機材ID全体の形式（例: DEV-PC-00001, HRN-TAB-0001）。
var EquipmentIDPattern = regexp.MustCompile(`^[A-Z0-9]{2,10}-[A-Z]{2,4}-\d{4,5}$`)

// NormalizeCategory はカテゴリを大文字に正規化し、形式を検証する。
func NormalizeCategory(category string) (string, error) {
	c := strings.ToUpper(strings.TrimSpace(category))
	if !categoryPattern.MatchString(c) {
		return "", fmt.Errorf("カテゴリは英字2〜3文字で指定してください（例: PC, DSP, TAB, CAM）: %q", category)
	}
	return c, nil
}

// NextEquipmentIDWithDept は「部署ID - カテゴリ - 連番」の形式で機材IDを生成する。
func NextEquipmentIDWithDept(tx *gorm.DB, deptID, category string) (string, error) {
	dept := strings.ToUpper(strings.TrimSpace(deptID))
	if dept == "" {
		dept = IDPrefix
	}
	cat, err := NormalizeCategory(category)
	if err != nil {
		return "", err
	}

	seqKey := fmt.Sprintf("%s_%s", dept, cat)

	q := tx.Model(&models.CategorySequence{})
	if isPostgres(tx) {
		q = q.Clauses(clause.Locking{Strength: "UPDATE"})
	}

	var seq models.CategorySequence
	err = q.Where("category = ?", seqKey).Take(&seq).Error
	switch {
	case err == gorm.ErrRecordNotFound:
		seq = models.CategorySequence{Category: seqKey, NextSeq: 1}
		if err := tx.Create(&seq).Error; err != nil {
			return "", fmt.Errorf("採番レコードの作成に失敗しました: %w", err)
		}
	case err != nil:
		return "", fmt.Errorf("採番レコードの取得に失敗しました: %w", err)
	}

	assigned := seq.NextSeq
	if err := tx.Model(&models.CategorySequence{}).
		Where("category = ?", seqKey).
		Update("next_seq", assigned+1).Error; err != nil {
		return "", fmt.Errorf("採番の更新に失敗しました: %w", err)
	}

	if assigned > 99999 {
		return "", fmt.Errorf("部署 %s カテゴリ %s の連番が上限(99999)に達しました", dept, cat)
	}
	return fmt.Sprintf("%s-%s-%05d", dept, cat, assigned), nil
}

// NextEquipmentID は標準の固定プレフィックスで機材IDを生成する。
func NextEquipmentID(tx *gorm.DB, category string) (string, error) {
	return NextEquipmentIDWithDept(tx, IDPrefix, category)
}

// NormalizeEquipmentID はスキャン結果の機材IDを正規化する。
//
// QRコードにURL（例: https://heron.local/e/HRN-TAB-0108）が入っている場合や、
// 前後に空白・小文字が混ざる場合を吸収する。形式に合致しなければ空文字を返す。
func NormalizeEquipmentID(raw string) string {
	s := strings.ToUpper(strings.TrimSpace(raw))
	if s == "" {
		return ""
	}
	// URL 形式なら最後のパスセグメントを取り出す。
	if i := strings.LastIndex(s, "/"); i >= 0 {
		s = s[i+1:]
	}
	if !EquipmentIDPattern.MatchString(s) {
		return ""
	}
	return s
}

// SyncSequence は既存機材の最大連番に合わせて採番カウンタを進める。
// 既存データを取り込んだ直後など、採番の整合を取り直したいときに使う。
func SyncSequence(gdb *gorm.DB, category string) error {
	cat, err := NormalizeCategory(category)
	if err != nil {
		return err
	}
	var ids []string
	if err := gdb.Model(&models.Equipment{}).
		Where("category = ?", cat).
		Pluck("equipment_id", &ids).Error; err != nil {
		return err
	}
	maxSeq := 0
	for _, id := range ids {
		parts := strings.Split(id, "-")
		if len(parts) != 3 {
			continue
		}
		var n int
		if _, err := fmt.Sscanf(parts[2], "%d", &n); err == nil && n > maxSeq {
			maxSeq = n
		}
	}
	return gdb.Save(&models.CategorySequence{Category: cat, NextSeq: maxSeq + 1}).Error
}
