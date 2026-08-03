// Package models は HERON の永続化モデルを定義する。
// 設計書 第3部 2章「データベース設計（主要テーブル）」に対応。
package models

import "time"

// 機材ステータス（設計書 3.2）
const (
	StatusAvailable   = "available"   // 保管中
	StatusInUse       = "in_use"      // 利用中
	StatusMaintenance = "maintenance" // 修理・メンテナンス中
	StatusDiscarded   = "discarded"   // 廃棄・除却
)

// 操作種別（Transaction_Logs.action_type）
const (
	ActionLend      = "lend"      // 貸出
	ActionReturn    = "return"    // 返却
	ActionInventory = "inventory" // 棚卸し
	ActionUpdate    = "update"    // 更新
	ActionCreate    = "create"    // 新規登録
	ActionDiscard   = "discard"   // 除却
)

// ユーザーロール（設計書 第1部 2章）
const (
	RoleAdmin   = "admin"
	RoleGeneral = "general"
)

// ValidStatuses はステータス値の妥当性検証に使う集合。
var ValidStatuses = map[string]bool{
	StatusAvailable:   true,
	StatusInUse:       true,
	StatusMaintenance: true,
	StatusDiscarded:   true,
}

// User はユーザーマスタ（設計書 2.1）。
//
// 設計書には認証方式の記述がないため、LoginID / PasswordHash を追加している。
type User struct {
	UserID       string    `gorm:"column:user_id;type:varchar(36);primaryKey" json:"user_id"`
	LoginID      string    `gorm:"column:login_id;type:varchar(64);not null;uniqueIndex" json:"login_id"`
	PasswordHash string    `gorm:"column:password_hash;type:varchar(255);not null" json:"-"`
	Name         string    `gorm:"column:name;type:varchar(100);not null" json:"name"`
	Role         string    `gorm:"column:role;type:varchar(20);not null" json:"role"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (User) TableName() string { return "users" }

// IsAdmin は管理者権限を持つかを返す。
func (u *User) IsAdmin() bool { return u.Role == RoleAdmin }

// Location は保管場所マスタ（設計書 2.2）。部屋 + 棚の組で一意。
type Location struct {
	LocationID int       `gorm:"column:location_id;primaryKey;autoIncrement" json:"location_id"`
	RoomName   string    `gorm:"column:room_name;type:varchar(100);not null;uniqueIndex:idx_room_shelf" json:"room_name"`
	ShelfName  string    `gorm:"column:shelf_name;type:varchar(100);not null;uniqueIndex:idx_room_shelf" json:"shelf_name"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (Location) TableName() string { return "locations" }

// Label は「第1作画室 / 機材棚A-3段目」形式の表示名を返す。
func (l *Location) Label() string { return l.RoomName + " / " + l.ShelfName }

// Equipment は機材マスタ（設計書 2.3）。現在の最新状態のみを保持し、
// 変遷は TransactionLog 側に残す。
//
// 設計書の5カラムに加え、一般ユーザーの機材検索を成立させるため
// Name / ModelNumber / PurchasedAt / Note を追加している。
type Equipment struct {
	EquipmentID       string     `gorm:"column:equipment_id;type:varchar(20);primaryKey" json:"equipment_id"`
	Name              string     `gorm:"column:name;type:varchar(150);not null" json:"name"`
	Category          string     `gorm:"column:category;type:varchar(10);not null;index" json:"category"`
	ModelNumber       string     `gorm:"column:model_number;type:varchar(100)" json:"model_number"`
	Status            string     `gorm:"column:status;type:varchar(20);not null;index" json:"status"`
	CurrentUserID     *string    `gorm:"column:current_user_id;type:varchar(36);index" json:"current_user_id"`
	CurrentLocationID *int       `gorm:"column:current_location_id;index" json:"current_location_id"`
	PurchasedAt       *time.Time `gorm:"column:purchased_at" json:"purchased_at"`
	Note              string     `gorm:"column:note;type:varchar(500)" json:"note"`
	CreatedAt         time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt         time.Time  `gorm:"column:updated_at" json:"updated_at"`

	CurrentUser     *User     `gorm:"foreignKey:CurrentUserID;references:UserID" json:"current_user,omitempty"`
	CurrentLocation *Location `gorm:"foreignKey:CurrentLocationID;references:LocationID" json:"current_location,omitempty"`
}

func (Equipment) TableName() string { return "equipments" }

// TransactionLog は履歴・監査ログ（設計書 2.4）。
// 「いつ・誰が・どこへ動かしたか」の証跡であり、更新・削除は行わない。
type TransactionLog struct {
	LogID            int64     `gorm:"column:log_id;primaryKey;autoIncrement" json:"log_id"`
	EquipmentID      string    `gorm:"column:equipment_id;type:varchar(20);not null;index" json:"equipment_id"`
	ActionType       string    `gorm:"column:action_type;type:varchar(20);not null;index" json:"action_type"`
	ActorUserID      string    `gorm:"column:actor_user_id;type:varchar(36);not null;index" json:"actor_user_id"`
	TargetUserID     *string   `gorm:"column:target_user_id;type:varchar(36)" json:"target_user_id"`
	TargetLocationID *int      `gorm:"column:target_location_id" json:"target_location_id"`
	Note             string    `gorm:"column:note;type:varchar(500)" json:"note"`
	Timestamp        time.Time `gorm:"column:timestamp;not null;index" json:"timestamp"`

	Equipment      *Equipment `gorm:"foreignKey:EquipmentID;references:EquipmentID" json:"equipment,omitempty"`
	Actor          *User      `gorm:"foreignKey:ActorUserID;references:UserID" json:"actor,omitempty"`
	TargetUser     *User      `gorm:"foreignKey:TargetUserID;references:UserID" json:"target_user,omitempty"`
	TargetLocation *Location  `gorm:"foreignKey:TargetLocationID;references:LocationID" json:"target_location,omitempty"`
}

func (TransactionLog) TableName() string { return "transaction_logs" }

// CategorySequence はカテゴリごとの連番払い出し用テーブル。
//
// 設計書 3.1 の「カテゴリごとに自動採番」を、同時登録時も衝突しない形で
// 実現するために設けた。採番は行ロックを取ったトランザクション内で行う。
type CategorySequence struct {
	Category string `gorm:"column:category;type:varchar(10);primaryKey" json:"category"`
	NextSeq  int    `gorm:"column:next_seq;not null" json:"next_seq"`
}

func (CategorySequence) TableName() string { return "category_sequences" }
