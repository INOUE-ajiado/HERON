/**
 * ソフトウェア・ライセンス＆アカウント管理モデル
 * (Microsoft Office / CLIP STUDIO PAINT / Adobe Photoshop・CC / 各種シリアルコード管理)
 */

export type SoftwareCategory =
  | 'microsoft_office'
  | 'clip_studio'
  | 'adobe_cc'
  | 'dcc_3d'
  | 'security_utility'
  | 'other';

export type LicenseAuthType =
  | 'serial_and_account' // アカウント＋シリアルコード併用（クリスタ、Office等）
  | 'account_only'       // アカウント（ID/初期PW）割当型（Adobe CC、Microsoft 365等）
  | 'serial_only';       // シリアルコード / プロダクトキー単体型（永続版ソフト、ESET等）

export type LicenseStatus =
  | 'assigned'      // 利用者に紐付け済（稼働中）
  | 'available'     // 未割当（空き在庫）
  | 'maintenance'   // 移行中・一時保留
  | 'expired';      // 期限切れ・解約済

export interface LicenseMailHistory {
  id: string;
  sent_at: string;
  sent_by: string;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  included_credentials: boolean;
}

export interface SoftwareLicense {
  id: string;
  /** 管理番号 (例: LIC-CSP-001, LIC-MS-001) */
  management_code: string;
  /** ソフトウェアカテゴリ */
  category: SoftwareCategory;
  /** ソフトウェア・製品名 (例: CLIP STUDIO PAINT EX, Microsoft 365 Business Standard, Adobe Photoshop CC) */
  software_name: string;
  /** ベンダー名 (例: CELSYS, Microsoft, Adobe) */
  vendor: string;
  /** プラン・エディション (例: 年額2デバイスプラン, 法人コンプリートプラン, 永続ライセンス) */
  edition_plan: string;
  /** 認証種別 */
  auth_type: LicenseAuthType;

  // --- アカウント・シリアル情報 ---
  /** ログインアカウントID / メールアドレス */
  account_id?: string;
  /** 初期パスワード / 管理用パスワード */
  account_password?: string;
  /** シリアルコード / プロダクトキー / アクティベーションコード */
  serial_code?: string;
  /** 契約番号・ライセンス証書番号 */
  contract_no?: string;
  /** ダウンロードURL / ポータルURL */
  portal_url?: string;
  /** 利用可能台数上限 (例: 2台まで) */
  max_devices?: number;

  // --- 紐付け（割当先）情報 ---
  status: LicenseStatus;
  /** 紐付けられたスタッフ氏名 */
  assigned_user_name?: string;
  /** 紐付けられたスタッフのメールアドレス（案内メール送信先） */
  assigned_user_email?: string;
  /** 所属部署 (例: 作画部, 制作部, CG・撮影部, 美術部, 総務部) */
  assigned_department?: string;
  /** 役職・担当 (例: デジタル原画, 制作進行, 撮影監督) */
  assigned_role?: string;
  /** 導入端末ID・PC名 (例: DEV-PC-00012 / 第1作画室 Mac Studio) */
  assigned_device?: string;
  /** 割当日 (YYYY-MM-DD) */
  assigned_date?: string;

  // --- 契約・期限・備考 ---
  /** 契約更新日・有効期限 (YYYY-MM-DD) */
  expiration_date?: string;
  /** 月額/年額費用メモ (例: 年額 10,500円) */
  cost_memo?: string;
  /** 管理者メモ・備考 */
  note?: string;
  /** 最終更新日時 */
  updated_at: string;

  // --- 案内メール送信履歴 ---
  last_mail_sent_at?: string;
  mail_history: LicenseMailHistory[];
}

export const SOFTWARE_CATEGORY_LABELS: Record<SoftwareCategory, string> = {
  microsoft_office: 'Microsoft Office / 365',
  clip_studio: 'CLIP STUDIO PAINT (クリスタ)',
  adobe_cc: 'Adobe (Photoshop / AE / CC)',
  dcc_3d: '映像・3DCG (Maya / Storyboard / TVPaint)',
  security_utility: 'セキュリティ・業務ツール',
  other: 'その他アプリケーション',
};

export const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  assigned: '割当済 (利用中)',
  available: '未割当 (空き在庫)',
  maintenance: '移行・調整中',
  expired: '期限切れ・解約',
};

export const LICENSE_AUTH_TYPE_LABELS: Record<LicenseAuthType, string> = {
  serial_and_account: 'アカウント ＋ シリアルコード',
  account_only: 'アカウントID / PWログイン型',
  serial_only: 'シリアルコード / キー単体型',
};
