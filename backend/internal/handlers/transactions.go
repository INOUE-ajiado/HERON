package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/service"
)

type lendRequest struct {
	EquipmentID  string `json:"equipment_id" binding:"required"`
	TargetUserID string `json:"target_user_id" binding:"required"`
	Note         string `json:"note"`
}

// Lend は POST /api/transactions/lend 。貸出処理（管理者のみ）。
func (h *Handler) Lend(c *gin.Context) {
	var req lendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "equipment_id と target_user_id は必須です")
		return
	}
	id := service.NormalizeEquipmentID(req.EquipmentID)
	if id == "" {
		badRequest(c, "機材IDの形式が不正です（例: HRN-TAB-0108）")
		return
	}

	eq, err := h.txn.Lend(auth.CurrentUserID(c), id, req.TargetUserID, req.Note)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, eq)
}

type returnRequest struct {
	EquipmentID string `json:"equipment_id" binding:"required"`
	LocationID  int    `json:"location_id" binding:"required"`
	Note        string `json:"note"`
}

// Return は POST /api/transactions/return 。返却処理（管理者のみ）。
func (h *Handler) Return(c *gin.Context) {
	var req returnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "equipment_id と location_id は必須です")
		return
	}
	id := service.NormalizeEquipmentID(req.EquipmentID)
	if id == "" {
		badRequest(c, "機材IDの形式が不正です（例: HRN-TAB-0108）")
		return
	}

	eq, err := h.txn.Return(auth.CurrentUserID(c), id, req.LocationID, req.Note)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, eq)
}

type inventoryRequest struct {
	LocationID   int      `json:"location_id" binding:"required"`
	EquipmentIDs []string `json:"equipment_ids" binding:"required"`
}

// Inventory は POST /api/transactions/inventory 。一括棚卸し処理（管理者のみ）。
//
// スキャン済み機材の所在を対象ロケーションへ上書きし、あわせて
// 「その棚にあるはずだが読まれなかった」機材を missing として返す。
func (h *Handler) Inventory(c *gin.Context) {
	var req inventoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "location_id と equipment_ids は必須です")
		return
	}
	if len(req.EquipmentIDs) > 1000 {
		badRequest(c, "1回の棚卸しで送信できる機材は1000件までです")
		return
	}

	res, err := h.txn.Inventory(auth.CurrentUserID(c), req.LocationID, req.EquipmentIDs)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}
