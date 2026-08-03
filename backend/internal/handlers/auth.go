package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/models"
)

type loginRequest struct {
	LoginID  string `json:"login_id" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type loginResponse struct {
	Token     string       `json:"token"`
	ExpiresAt time.Time    `json:"expires_at"`
	User      *models.User `json:"user"`
}

// Login は POST /api/auth/login 。ログインID + パスワードで JWT を発行する。
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "login_id と password は必須です")
		return
	}

	var user models.User
	if err := h.gdb.Where("login_id = ?", req.LoginID).Take(&user).Error; err != nil {
		// ユーザー不在とパスワード不一致は区別せず、同じ応答を返す。
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ログインIDまたはパスワードが違います"})
		return
	}
	if !auth.VerifyPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ログインIDまたはパスワードが違います"})
		return
	}

	token, expiresAt, err := h.auth.Issue(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トークンの発行に失敗しました"})
		return
	}
	c.JSON(http.StatusOK, loginResponse{Token: token, ExpiresAt: expiresAt, User: &user})
}

// Me は GET /api/auth/me 。現在のトークンに紐づくユーザーを返す。
func (h *Handler) Me(c *gin.Context) {
	var user models.User
	if err := h.gdb.Where("user_id = ?", auth.CurrentUserID(c)).Take(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ユーザーが見つかりません"})
		return
	}
	c.JSON(http.StatusOK, user)
}
