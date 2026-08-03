// Package handlers は REST API のエンドポイント実装を持つ。
// 設計書 第3部 3章「API仕様設計」に対応。
package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/service"
)

// Handler は全ハンドラの依存をまとめて保持する。
type Handler struct {
	gdb  *gorm.DB
	auth *auth.Manager
	txn  *service.TransactionService
}

// New は Handler を生成する。
func New(gdb *gorm.DB, am *auth.Manager) *Handler {
	return &Handler{
		gdb:  gdb,
		auth: am,
		txn:  service.NewTransactionService(gdb),
	}
}

// respondServiceError は業務ロジックのエラーを適切な HTTP ステータスへ変換する。
func respondServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrEquipmentNotFound),
		errors.Is(err, service.ErrUserNotFound),
		errors.Is(err, service.ErrLocationNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrAlreadyInUse),
		errors.Is(err, service.ErrNotInUse),
		errors.Is(err, service.ErrDiscarded),
		errors.Is(err, service.ErrUnderMaintenance):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "サーバ内部エラーが発生しました", "detail": err.Error()})
	}
}

// badRequest は 400 を返すショートハンド。
func badRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"error": msg})
}
