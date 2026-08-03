// Package config は環境変数から実行時設定を読み込む。
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config はサーバの全設定。
type Config struct {
	Port        string
	DBDriver    string // "postgres" | "sqlite"
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	SQLitePath  string
	JWTSecret   string
	JWTTTL      time.Duration
	CORSOrigins []string
	SeedDemo    bool
}

// Load は環境変数を読み、既定値で補完した Config を返す。
//
// DB_DRIVER の既定値は sqlite。Docker Compose 側では postgres を明示指定する。
// これにより Docker を起動していない Windows ローカルでも `go run` だけで動く。
func Load() *Config {
	c := &Config{
		Port:       env("PORT", "8080"),
		DBDriver:   strings.ToLower(env("DB_DRIVER", "sqlite")),
		DBHost:     env("DB_HOST", "localhost"),
		DBPort:     env("DB_PORT", "5432"),
		DBUser:     env("DB_USER", "heron"),
		DBPassword: env("DB_PASSWORD", "heron_password"),
		DBName:     env("DB_NAME", "heron"),
		SQLitePath: env("SQLITE_PATH", "heron.db"),
		JWTSecret:  env("JWT_SECRET", "heron-dev-secret-change-me"),
		JWTTTL:     time.Duration(envInt("JWT_TTL_HOURS", 12)) * time.Hour,
		SeedDemo:   envBool("SEED_DEMO", true),
	}
	c.CORSOrigins = splitAndTrim(env("CORS_ORIGINS", "http://localhost:4200,http://localhost:8081"))
	return c
}

// PostgresDSN は PostgreSQL 接続文字列を組み立てる。
func (c *Config) PostgresDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Tokyo",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
