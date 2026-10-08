/**
 * BYOD (私物情報端末等) 利用申請の型定義
 * 株式会社亜細亜堂 セキュリティ規程準拠
 */

export type ByodStatus =
  | 'submitted'          // ① 申請中 (所属長承認待ち)
  | 'manager_approved'   // ② 所属長承認済 (情報セキュリティ責任者承認待ち)
  | 'security_approved'  // ③ 決裁完了 (情報セキュリティ責任者承認済)
  | 'rejected';          // 差戻し / 却下

export type ByodApplyType = 'new' | 'update' | 'annual'; // 新規申請 / 追加・変更申請 / 年次更新
export type ByodEmploymentType = 'regular' | 'contract' | 'dispatch' | 'freelance'; // 正社員 / 契約 / 派遣 / 業務委託

export interface ByodDevice {
  id: string;
  device_category: 'pc_tablet' | 'media' | 'other';
  device_type_label: string; // 例: Windows PC, Mac, iPad
  sticker_no?: string;        // 管理ステッカー番号 例: STK-2026-001
  manufacturer: string;       // メーカー / 機種名 例: Apple MacBook Pro 16
  model_or_serial: string;    // 型番 / シリアルNo.
  os_version: string;         // OS / バージョン 例: macOS Sonoma 14.5
  mac_address?: string;       // MACアドレス (Wi-Fi / LAN)
  encryption: 'bitlocker' | 'filevault' | 'ios' | 'hardware' | 'other'; // 暗号化設定
  encryption_other?: string;
  security_software: string;  // セキュリティソフト名 例: ESET, Defender
  auto_update: boolean;       // 自動更新: 有 / 無
  purpose: string;            // 業務上の利用理由
  // 管理部門確認欄
  admin_verified_encryption?: boolean;
  admin_verified_security?: boolean;
  admin_sticker_attached?: boolean;
  admin_checker_name?: string;
}

export interface ByodExternalMedia {
  no: number;
  media_type: 'usb' | 'ssd' | 'hdd' | 'other';
  capacity: string;          // 容量 例: 1TB, 64GB
  maker_and_model: string;   // 種別・メーカー・容量
  serial_or_name: string;    // シリアル番号 / 識別名
  has_encryption: boolean;   // 暗号化機能の有無
  encryption_method?: string;// 暗号化方式
  sticker_no?: string;       // ステッカー番号
  admin_confirmed?: boolean; // 確認印
}

export interface ByodTimelineStep {
  id: string;
  title: string;
  role: string;
  approverName?: string;
  updatedAt?: string;
  completed: boolean;
  current: boolean;
}

export interface ByodStampInfo {
  roleLabel: string;      // 'セキュリティ責任者' | '所属長' | '申請者'
  approverName?: string;  // 印影に表示する姓
  approvedDate?: string;  // YYYY/M/D
  completed: boolean;
}

export interface ByodRequest {
  id: string;              // 申請番号 例: BYOD-2026-001
  doc_no: string;          // 文書番号 例: SEC-FORM-2026-001
  created_at: string;      // 申請日 (YYYY/MM/DD)
  apply_type: ByodApplyType;
  employment_type: ByodEmploymentType;

  // 申請者情報
  applicant_name: string;
  applicant_department: string;
  applicant_role: string;
  staff_number: string;
  contact_info: string;    // 連絡先（内線/携帯）

  // 機材サマリー
  count_pc: number;
  count_tablet: number;
  count_media: number;
  count_other: number;
  sheet_count: number;     // 別紙枚数

  // 端末・メディア明細
  devices: ByodDevice[];
  external_media: ByodExternalMedia[];

  // 誓約・承認
  pledge_agreed: boolean;
  pledge_date?: string;

  status: ByodStatus;
  timeline: ByodTimelineStep[];
  stamps: ByodStampInfo[];

  manager_approved_date?: string;
  security_approved_date?: string;
  expire_date?: string;     // 有効期限（承認日より最長1年）
  rejection_reason?: string;
}

export const BYOD_STATUS_DISPLAY: Record<
  ByodStatus,
  { label: string; shortLabel: string; colorClass: string; badgeBg: string }
> = {
  submitted: {
    label: '① 申請中 (所属長承認待ち)',
    shortLabel: '所属長確認待ち',
    colorClass: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  manager_approved: {
    label: '② 所属長承認済 (セキュリティ責任者決裁待ち)',
    shortLabel: '責任者決裁待ち',
    colorClass: 'bg-blue-100 text-blue-800 border-blue-300',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  security_approved: {
    label: '③ 決裁完了 (利用許可・ステッカー交付)',
    shortLabel: '決裁完了・許可済',
    colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: '差戻し / 却下',
    shortLabel: '差戻し',
    colorClass: 'bg-rose-100 text-rose-800 border-rose-300',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const EMPLOYMENT_TYPE_LABELS: Record<ByodEmploymentType, string> = {
  regular: '正社員',
  contract: '契約社員',
  dispatch: '派遣スタッフ',
  freelance: '業務委託',
};

export const APPLY_TYPE_LABELS: Record<ByodApplyType, string> = {
  new: '新規申請',
  update: '追加・変更申請',
  annual: '年次更新',
};
