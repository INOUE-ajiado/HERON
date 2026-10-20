// Package auth は JWT トークンの発行・検証と、Gin 用の認証・セキュリティミドルウェアを提供する。
package auth

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders は API レスポンスに標準的なセキュリティヘッダーを付与するミドルウェア。
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}

type ipBucket struct {
	attempts  int
	resetTime time.Time
}

// LoginRateLimiter は IP アドレス単位でログイン試行回数を制限し、ブルートフォース攻撃を防止する。
func LoginRateLimiter(maxAttempts int, window time.Duration) gin.HandlerFunc {
	var (
		mu      sync.Mutex
		buckets = make(map[string]*ipBucket)
	)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		// 古いエントリの簡易ガベージコレクション（マップ肥大化防止）
		if len(buckets) > 1024 {
			for k, v := range buckets {
				if now.After(v.resetTime) {
					delete(buckets, k)
				}
			}
		}

		b, exists := buckets[ip]
		if !exists || now.After(b.resetTime) {
			b = &ipBucket{
				attempts:  0,
				resetTime: now.Add(window),
			}
			buckets[ip] = b
		}
		b.attempts++
		currentAttempts := b.attempts
		mu.Unlock()

		if currentAttempts > maxAttempts {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "ログイン試行回数の上限に達しました。しばらく時間をおいてから再度お試しください。",
			})
			return
		}

		c.Next()
	}
}
