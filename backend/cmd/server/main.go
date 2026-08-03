// HERON 社内機材管理システム — API サーバ。
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ajiado/heron/backend/internal/auth"
	"github.com/ajiado/heron/backend/internal/config"
	"github.com/ajiado/heron/backend/internal/db"
	"github.com/ajiado/heron/backend/internal/router"
)

func main() {
	cfg := config.Load()

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	gdb, err := db.Open(cfg)
	if err != nil {
		log.Fatalf("DB への接続に失敗しました: %v", err)
	}
	log.Printf("DB に接続しました (driver=%s)", cfg.DBDriver)

	if err := db.Migrate(gdb); err != nil {
		log.Fatalf("マイグレーションに失敗しました: %v", err)
	}

	if cfg.SeedDemo {
		if err := db.Seed(gdb); err != nil {
			log.Fatalf("初期データの投入に失敗しました: %v", err)
		}
	}

	am := auth.NewManager(cfg.JWTSecret, cfg.JWTTTL)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router.New(cfg, gdb, am),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("HERON API サーバを起動しました: http://localhost:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("サーバの起動に失敗しました: %v", err)
		}
	}()

	// Ctrl+C / コンテナ停止時にリクエストを取りこぼさず終了する。
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("シャットダウンしています...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("シャットダウン中にエラーが発生しました: %v", err)
	}
	log.Println("停止しました")
}
