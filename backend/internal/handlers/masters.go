package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/models"
)

// ---- Locations（保管場所マスタ） ----

// ListLocations は GET /api/locations 。全ユーザーが参照できる。
func (h *Handler) ListLocations(c *gin.Context) {
	var items []models.Location
	if err := h.gdb.Order("room_name ASC, shelf_name ASC").Find(&items).Error; err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

type locationRequest struct {
	RoomName  string `json:"room_name" binding:"required"`
	ShelfName string `json:"shelf_name" binding:"required"`
}

// CreateLocation は POST /api/locations （管理者のみ）。
func (h *Handler) CreateLocation(c *gin.Context) {
	var req locationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "room_name と shelf_name は必須です")
		return
	}
	loc := models.Location{
		RoomName:  strings.TrimSpace(req.RoomName),
		ShelfName: strings.TrimSpace(req.ShelfName),
	}
	if err := h.gdb.Create(&loc).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "同じ部屋・棚の組み合わせがすでに登録されています"})
			return
		}
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, loc)
}

// UpdateLocation は PUT /api/locations/:id （管理者のみ）。
func (h *Handler) UpdateLocation(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, "location_id は整数で指定してください")
		return
	}
	var req locationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "room_name と shelf_name は必須です")
		return
	}
	var loc models.Location
	if err := h.gdb.Where("location_id = ?", id).Take(&loc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "指定された保管場所が見つかりません"})
		return
	}
	loc.RoomName = strings.TrimSpace(req.RoomName)
	loc.ShelfName = strings.TrimSpace(req.ShelfName)
	if err := h.gdb.Save(&loc).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "同じ部屋・棚の組み合わせがすでに登録されています"})
			return
		}
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, loc)
}

// DeleteLocation は DELETE /api/locations/:id （管理者のみ）。
// 機材が紐づいている場合は参照整合のため削除を拒否する。
func (h *Handler) DeleteLocation(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, "location_id は整数で指定してください")
		return
	}
	var count int64
	if err := h.gdb.Model(&models.Equipment{}).Where("current_location_id = ?", id).Count(&count).Error; err != nil {
		respondServiceError(c, err)
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "この保管場所には機材が登録されているため削除できません"})
		return
	}
	if err := h.gdb.Where("location_id = ?", id).Delete(&models.Location{}).Error; err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"location_id": id, "deleted": true})
}

// ---- Users（ユーザーマスタ） ----

// ListUsers は GET /api/users 。
//
// 貸出先の選択に必要なため一般ユーザーにも公開するが、
// 返すのは user_id / name / role のみでパスワードハッシュは含めない。
func (h *Handler) ListUsers(c *gin.Context) {
	var items []models.User
	q := h.gdb.Order("name ASC")
	if role := c.Query("role"); role != "" {
		q = q.Where("role = ?", role)
	}
	if err := q.Find(&items).Error; err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

type createUserRequest struct {
	LoginID  string `json:"login_id" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Role     string `json:"role" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// CreateUser は POST /api/users （管理者のみ）。
func (h *Handler) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "login_id, name, role, password は必須です")
		return
	}
	if req.Role != models.RoleAdmin && req.Role != models.RoleGeneral {
		badRequest(c, "role は admin または general を指定してください")
		return
	}
	if len(req.Password) < 8 {
		badRequest(c, "パスワードは8文字以上にしてください")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	user := models.User{
		UserID:       uuid.NewString(),
		LoginID:      strings.TrimSpace(req.LoginID),
		PasswordHash: hash,
		Name:         strings.TrimSpace(req.Name),
		Role:         req.Role,
	}
	if err := h.gdb.Create(&user).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "このログインIDはすでに使われています"})
			return
		}
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, user)
}

// ---- Transaction Logs（履歴） ----

// ListLogs は GET /api/logs 。全利用者の履歴閲覧（管理者のみ）。
func (h *Handler) ListLogs(c *gin.Context) {
	page, perPage := paginationParams(c)

	q := h.gdb.Model(&models.TransactionLog{})
	if v := strings.TrimSpace(c.Query("equipment_id")); v != "" {
		q = q.Where("equipment_id = ?", strings.ToUpper(v))
	}
	if v := strings.TrimSpace(c.Query("action_type")); v != "" {
		q = q.Where("action_type = ?", v)
	}
	if v := strings.TrimSpace(c.Query("actor_user_id")); v != "" {
		q = q.Where("actor_user_id = ?", v)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		respondServiceError(c, err)
		return
	}

	var items []models.TransactionLog
	err := q.Preload("Equipment").Preload("Actor").Preload("TargetUser").Preload("TargetLocation").
		Order("timestamp DESC, log_id DESC").
		Limit(perPage).Offset((page - 1) * perPage).
		Find(&items).Error
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, listResponse{Items: items, Total: total, Page: page, PerPage: perPage})
}

// Stats は GET /api/stats 。ダッシュボード用のステータス別集計。
func (h *Handler) Stats(c *gin.Context) {
	type row struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	var rows []row
	if err := h.gdb.Model(&models.Equipment{}).
		Select("status, COUNT(*) AS count").Group("status").Scan(&rows).Error; err != nil {
		respondServiceError(c, err)
		return
	}

	byStatus := map[string]int64{
		models.StatusAvailable:   0,
		models.StatusInUse:       0,
		models.StatusMaintenance: 0,
		models.StatusDiscarded:   0,
	}
	var total int64
	for _, r := range rows {
		byStatus[r.Status] = r.Count
		if r.Status != models.StatusDiscarded {
			total += r.Count
		}
	}
	c.JSON(http.StatusOK, gin.H{"by_status": byStatus, "active_total": total})
}

// isUniqueViolation は一意制約違反かどうかを判定する。
// PostgreSQL / SQLite でメッセージが異なるため、どちらの文言も見る。
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") ||
		strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "23505")
}
