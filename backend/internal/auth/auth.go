// Package auth は JWT の発行・検証と、Gin 用の認証/認可ミドルウェアを提供する。
//
// 設計書には認証方式の記述がないため、以下を前提として実装している。
//   - ログインID + パスワード（bcrypt ハッシュ）で認証
//   - 認証後は JWT を Authorization: Bearer <token> で送出
//   - ロール（admin / general）による認可は設計書 第1部 2章に従う
package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/ajiado/heron/backend/internal/models"
)

// コンテキストキー
const (
	ctxUserID = "heron_user_id"
	ctxRole   = "heron_role"
	ctxName   = "heron_name"
)

// Claims は HERON の JWT ペイロード。
type Claims struct {
	UserID string `json:"uid"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Manager はトークンの発行と検証を担う。
type Manager struct {
	secret []byte
	ttl    time.Duration
}

// NewManager は署名鍵と有効期間から Manager を生成する。
func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl}
}

// Issue はユーザーに対する署名済みトークンを発行する。
func (m *Manager) Issue(u *models.User) (string, time.Time, error) {
	expiresAt := time.Now().Add(m.ttl)
	claims := &Claims{
		UserID: u.UserID,
		Name:   u.Name,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.UserID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			Issuer:    "heron",
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

// Parse はトークン文字列を検証し Claims を返す。
func (m *Manager) Parse(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("想定外の署名アルゴリズムです")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("トークンが無効です")
	}
	return claims, nil
}

// HashPassword は平文パスワードを bcrypt でハッシュ化する。
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(b), err
}

// VerifyPassword はハッシュと平文が一致するかを検証する。
func VerifyPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// RequireAuth は Authorization ヘッダを検証し、コンテキストに認証情報を載せる。
func (m *Manager) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
			return
		}
		claims, err := m.Parse(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "トークンが無効または期限切れです"})
			return
		}
		c.Set(ctxUserID, claims.UserID)
		c.Set(ctxRole, claims.Role)
		c.Set(ctxName, claims.Name)
		c.Next()
	}
}

// RequireAdmin は管理者ロールを要求する。RequireAuth の後段に置く。
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if CurrentRole(c) != models.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "この操作には管理者権限が必要です"})
			return
		}
		c.Next()
	}
}

// CurrentUserID は認証済みユーザーIDを返す。
func CurrentUserID(c *gin.Context) string {
	v, _ := c.Get(ctxUserID)
	s, _ := v.(string)
	return s
}

// CurrentRole は認証済みユーザーのロールを返す。
func CurrentRole(c *gin.Context) string {
	v, _ := c.Get(ctxRole)
	s, _ := v.(string)
	return s
}

// IsAdmin は現在のリクエストが管理者によるものかを返す。
func IsAdmin(c *gin.Context) bool { return CurrentRole(c) == models.RoleAdmin }
