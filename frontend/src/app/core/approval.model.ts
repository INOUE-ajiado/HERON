/**
 * 稟議申請の型定義
 */

export type ApprovalStatus =
  | 'submitted'          // ① 申請者提出済（プロデューサー承認待ち）
  | 'producer_approved'  // ② プロデューサー承認済（DXチーム確認待ち）
  | 'dx_confirmed'       // ③ DXチーム確認済（代表承認待ち）
  | 'president_approved' // ④ 代表承認済（決済完了）
  | 'rejected';          // 却下

export interface TimelineStep {
  id: string;
  title: string;          // 例: '① 申請者提出', '② プロデューサー承認', '③ DXチーム確認', '④ 代表承認'
  role: string;           // 例: '申請者', 'プロデューサー', 'DXチーム', '代表'
  approverName?: string;  // 承認者・担当者名
  updatedAt?: string;     // 承認・処理日時 (YYYY/MM/DD HH:mm)
  completed: boolean;     // 処理済みか
  current: boolean;       // 現在進行中か
}

export interface StampInfo {
  roleLabel: string;      // '代表' | 'DXチーム' | 'プロデューサー' | '提出者'
  approverName?: string;  // 印影に表示する姓
  approvedDate?: string;  // 3/13 などの形式
  completed: boolean;
}

/** 購入品目（商品名・単価・個数・個別購入先URL・個別画像URL） */
export interface PurchaseItem {
  name: string;
  price: number;
  quantity: number;
  purchase_url?: string;
  image_url?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;                 // 件名
  applicant_name: string;        // 申請者名
  applicant_department: string;  // 所属部門
  created_at: string;            // 起案日
  desired_date: string;          // 決済希望日
  
  // 詳細・概要
  new_item_name: string;         // 【新規導入】（単一または代表品目名）
  new_items?: string[];          // 後方互換用
  items?: PurchaseItem[];        // 【新規導入・購入品目】明細（商品名・金額・個数・URL・画像）
  cancel_item_name: string;      // 【契約終了】
  usage_purpose: string;         // 【主な用途】
  reason_detail: string;         // 申請理由・目的詳細
  
  // 拡張項目
  purchase_url?: string;         // 全体購入先ページリンク (Amazonなど)
  image_url?: string;            // 全体稟議書画像リンク
  attachment_note?: string;      // 添付資料・備考
  estimated_amount?: string;     // 概算金額・合計計算値
  
  // ステータス ＆ 承認履歴
  status: ApprovalStatus;
  timeline: TimelineStep[];
  stamps: StampInfo[];
}

export const STATUS_DISPLAY: Record<ApprovalStatus, { label: string; colorClass: string }> = {
  submitted: { label: '① 申請中 (プロデューサー確認待ち)', colorClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  producer_approved: { label: '② プロデューサー承認済 (DXチーム確認待ち)', colorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  dx_confirmed: { label: '③ DXチーム確認済 (代表承認待ち)', colorClass: 'bg-purple-100 text-purple-800 border-purple-300' },
  president_approved: { label: '④ 代表承認済 (決済完了)', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: '差戻し / 却下', colorClass: 'bg-rose-100 text-rose-800 border-rose-300' },
};
