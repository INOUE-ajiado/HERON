// Package router は HTTP ルーティングを組み立てる。
package router

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/config"
	"github.com/ajiado/heron/backend/internal/handlers"
)

// New はミドルウェアと全ルートを設定した *gin.Engine を返す。
func New(cfg *config.Config, gdb *gorm.DB, am *auth.Manager) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	corsCfg := cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
	r.Use(cors.New(corsCfg))

	h := handlers.New(gdb, am)

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	{
		api.POST("/auth/login", h.Login)

		// ---- 認証必須（一般ユーザーも可） ----
		authed := api.Group("")
		authed.Use(am.RequireAuth())
		{
			authed.GET("/auth/me", h.Me)

			// 一般ユーザーに許可される操作（設計書 第1部 2章）:
			// 自身の貸出中一覧の確認と、機材の検索・所在確認のみ。
			authed.GET("/me/equipments", h.MyEquipments)
			authed.GET("/equipments", h.ListEquipments)
			authed.GET("/equipments/:id", h.GetEquipment)
			authed.GET("/locations", h.ListLocations)
			authed.GET("/users", h.ListUsers)
		}

		// ---- 管理者限定 ----
		admin := api.Group("")
		admin.Use(am.RequireAuth(), auth.RequireAdmin())
		{
			admin.POST("/equipments", h.CreateEquipment)
			admin.PUT("/equipments/:id", h.UpdateEquipment)
			admin.DELETE("/equipments/:id", h.DiscardEquipment)

			admin.POST("/transactions/lend", h.Lend)
			admin.POST("/transactions/return", h.Return)
			admin.POST("/transactions/inventory", h.Inventory)

			admin.POST("/locations", h.CreateLocation)
			admin.PUT("/locations/:id", h.UpdateLocation)
			admin.DELETE("/locations/:id", h.DeleteLocation)

			admin.POST("/users", h.CreateUser)

			admin.GET("/logs", h.ListLogs)
			admin.GET("/stats", h.Stats)
		}
	}

	return r
}
