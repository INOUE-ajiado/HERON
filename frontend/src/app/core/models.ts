/** バックエンド API と対応するデータ型（設計書 第3部 2章）。 */

export type Role = 'admin' | 'general';

/** 機材ステータス（設計書 3.2）。 */
export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'discarded';

export interface User {
  user_id: string;
  login_id: string;
  name: string;
  role: Role;
}

export interface Location {
  location_id: number;
  room_name: string;
  shelf_name: string;
}

export interface Equipment {
  equipment_id: string;
  name: string;
  category: string;
  model_number: string;
  status: EquipmentStatus;
  current_user_id: string | null;
  current_location_id: number | null;
  purchased_at: string | null;
  note: string;
  current_user?: User | null;
  current_location?: Location | null;
}

export type ActionType =
  | 'lend'
  | 'return'
  | 'inventory'
  | 'update'
  | 'create'
  | 'discard';

export interface TransactionLog {
  log_id: number;
  equipment_id: string;
  action_type: ActionType;
  actor_user_id: string;
  target_user_id: string | null;
  target_location_id: number | null;
  note: string;
  timestamp: string;
  equipment?: Equipment | null;
  actor?: User | null;
  target_user?: User | null;
  target_location?: Location | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface EquipmentDetail {
  equipment: Equipment;
  recent_logs: TransactionLog[];
}

/** 棚卸し結果（設計書 3.3 連続スキャン）。 */
export interface InventoryResult {
  location_id: number;
  /** 今回スキャンして当該ロケーションへ反映した機材。 */
  updated: string[];
  /** 他の場所・貸出中から移動してきた機材。 */
  moved_in: string[];
  /** 当該ロケーションにあるはずだがスキャンされなかった機材（紛失候補）。 */
  missing: string[];
  /** DB に存在しない機材ID。 */
  not_found: string[];
  /** 廃棄済みのためスキップした機材。 */
  skipped: string[];
}

export interface Stats {
  by_status: Record<EquipmentStatus, number>;
  active_total: number;
}

/** ステータスの日本語表示名（設計書 3.2 の呼称に合わせる）。 */
export const STATUS_LABEL: Record<EquipmentStatus, string> = {
  available: '保管中',
  in_use: '利用中',
  maintenance: '修理・メンテナンス中',
  discarded: '廃棄・除却',
};

/** ステータス表示に使う背景色クラス。 */
export const STATUS_CLASS: Record<EquipmentStatus, string> = {
  available: 'bg-status-available',
  in_use: 'bg-status-inuse',
  maintenance: 'bg-status-maintenance',
  discarded: 'bg-status-discarded',
};

/** 操作種別の日本語表示名。 */
export const ACTION_LABEL: Record<ActionType, string> = {
  lend: '貸出',
  return: '返却',
  inventory: '棚卸し',
  update: '更新',
  create: '新規登録',
  discard: '除却',
};

/** カテゴリの日本語表示名（設計書 3.1 のカテゴリ例）。 */
export const CATEGORY_LABEL: Record<string, string> = {
  PC: 'パソコン',
  DSP: 'ディスプレイ',
  TAB: 'ペンタブ・液タブ',
  CAM: 'カメラ',
};
