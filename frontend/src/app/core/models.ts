/**
 * HERON データモデル定義（設計書 第3部 2章）。
 */

/** 機材ステータス */
export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'discarded';

/** 操作種別 */
export type ActionType = 'lend' | 'return' | 'inventory' | 'create' | 'update' | 'discard';

/** 付属品アイテム */
export interface AccessoryItem {
  name: string;
  present: boolean;
}

/** ログインレスポンス */
export interface LoginResponse {
  token: string;
  user: User;
}

/** 部署 */
export interface Department {
  code: string;
  name: string;
}

/** カテゴリ */
export interface Category {
  code: string;
  name: string;
  prefix: string;
}

/** 保管場所 */
export interface Location {
  location_id: number;
  room_name: string;
  shelf_name: string;
}

/** ユーザー */
export interface User {
  user_id: string;
  login_id: string;
  name: string;
  role: 'admin' | 'general';
}

/** 機材 */
export interface Equipment {
  equipment_id: string;
  name: string;
  category: string;
  model_number?: string;
  status: EquipmentStatus;
  current_user_id?: string | null;
  current_location_id?: number | null;
  /** 棚マスタのコード（画面の保管場所プルダウンが扱う値） */
  shelf_code?: string | null;
  purchased_at?: string | null;
  note?: string;

  // 紐づく表示用オブジェクト
  current_user?: User | null;
  current_location?: Location | null;

  // 付属品チェックリスト
  accessories?: AccessoryItem[];
}

/** 取引・移動ログ */
export interface TransactionLog {
  /** Firestore ドキュメント ID（一覧の trackBy に使う一意キー） */
  id?: string;
  log_id: number;
  equipment_id: string;
  action_type: ActionType;
  actor_user_id: string;
  target_user_id?: string | null;
  target_location_id?: number | null;
  note?: string;
  timestamp: string;

  actor?: User;
  target_user?: User;
  target_location?: Location;
  equipment?: Equipment;
}

/** 機材詳細レスポンス (`GET /api/equipments/:id`) */
export interface EquipmentDetail {
  equipment: Equipment;
  recent_logs: TransactionLog[];
}

/** 棚卸し実行結果 (`POST /api/transactions/inventory`) */
export interface InventoryResult {
  location_id: number;
  updated: string[];
  moved_in: string[];
  missing: string[];
  not_found: string[];
  skipped: string[];
}

/** ページネーション付きレスポンス */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

/** 簡易一覧レスポンス */
export interface ListResult<T> {
  items: T[];
  total: number;
}

/** 統計レスポンス (`GET /api/stats`) */
export interface Stats {
  by_status: Record<EquipmentStatus, number>;
  active_total: number;
}

/** 日本語表示用ラベルマップ */
export const STATUS_LABEL: Record<EquipmentStatus, string> = {
  available: '保管中',
  in_use: '貸出中',
  maintenance: 'メンテナンス中',
  discarded: '除却済み',
};

export const ACTION_LABEL: Record<ActionType, string> = {
  lend: '貸出',
  return: '返却',
  inventory: '棚卸し',
  create: '新規登録',
  update: '更新',
  discard: '除却',
};

export const CATEGORY_LABEL: Record<string, string> = {
  TAB: '液晶タブレット',
  PC: 'デスクトップPC',
  LAP: 'ノートPC',
  DSP: 'ディスプレイ',
  CAM: 'カメラ・撮影機器',
  OTH: 'その他機材',
};
