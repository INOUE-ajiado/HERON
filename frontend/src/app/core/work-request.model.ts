/**
 * 業務申請（休日出勤・休暇・残業）の型定義
 * アニメーション制作現場向けのワークフローシステム
 */

export type WorkRequestType =
  | 'holiday_work' // 休日出勤申請
  | 'leave'        // 休暇申請（有給・代休・特休等）
  | 'overtime';     // 残業申請

export type WorkRequestStatus =
  | 'submitted'        // ① 申請中 (上長承認待ち)
  | 'manager_approved' // ② 許諾済 (総務受領・勤怠反映待ち)
  | 'admin_confirmed'  // ③ 完了 (総務勤怠反映完了)
  | 'rejected';        // 差戻し / 却下

export interface WorkTimelineStep {
  id: string;
  title: string;          // 例: '① 申請者提出', '② 上長承認 (許諾)', '③ 総務受領 (勤怠反映)'
  role: string;           // 例: '申請者', '上長 (制作デスク/P)', '総務部 (勤怠管理)'
  approverName?: string;  // 承認者・担当者名
  updatedAt?: string;     // 処理日時 (YYYY/MM/DD HH:mm)
  completed: boolean;     // 処理済みか
  current: boolean;       // 現在進行中か
}

export interface WorkStampInfo {
  roleLabel: string;      // '総務' | '上長' | '提出者'
  approverName?: string;  // 印影に表示する姓
  approvedDate?: string;  // 10/7 などの形式
  completed: boolean;
}

export interface WorkRequest {
  id: string;
  request_type: WorkRequestType;
  title: string;                 // 件名
  applicant_name: string;        // 申請者名
  applicant_department: string;  // 所属部門 (例: 制作部, 作画部, 仕上部, 美術部, CG部, 演出部)
  applicant_role?: string;       // 役職・職種 (例: 制作進行, 原画, 動画検査, 作画監督, 演出, 背景)
  created_at: string;            // 申請日 (YYYY/MM/DD)

  // 対象日時・期間
  target_date: string;           // 対象日 (開始日)
  target_end_date?: string;      // 終了日 (連休の場合)
  time_range?: string;           // 時間帯 (例: '10:00 〜 19:00', '19:00 〜 22:30')
  hours_estimated?: number;      // 予定時間数 (例: 8, 3.5)

  // 申請種別ごとの個別項目
  // 1. 休日出勤
  substitute_date?: string;      // 振替休日（代休）取得予定日

  // 2. 休暇申請
  leave_type?: 'annual' | 'substitute' | 'special' | 'condolence' | 'absence' | 'half_am' | 'half_pm';
  leave_unit?: 'full_day' | 'half_am' | 'half_pm' | 'hourly'; // 全日休 / 前半休 / 後半休 / 時間休

  // 3. 残業申請
  has_midnight_overtime?: boolean; // 22:00以降の深夜残業有無

  // アニメーション制作現場特有の項目
  anime_project: string;         // 担当作品名 (例: 『HERON: THE ANIMATION 第2期』)
  episode_or_process: string;    // 担当話数・工程 (例: '#07 原画・LO回収', '#04 作監修正・動検')
  deadline_date?: string;        // 関連締切日・納品日 (例: '2026-10-15')
  reason_detail: string;         // 申請事由・業務詳細 (例: '第7話カッティング出しに向けた原画回収および特出しスキャン対応')
  emergency_contact?: string;    // 緊急連絡先 (携帯電話番号や社内チャット等)

  // ワークフロー & ステータス
  status: WorkRequestStatus;
  timeline: WorkTimelineStep[];
  stamps: WorkStampInfo[];

  // 総務連絡・勤怠反映（上長許諾後に総務へ連絡）
  general_affairs_note?: string; // 総務受領コメント (例: '有給残日数11日確認済。タイムカード連携完了。')
  confirmed_by?: string;         // 総務確認者名
  confirmed_at?: string;         // 総務確認日時
  rejection_reason?: string;     // 差戻し理由
}

export const WORK_TYPE_CONFIG: Record<
  WorkRequestType,
  { label: string; iconEmoji: string; colorClass: string; badgeClass: string; desc: string }
> = {
  holiday_work: {
    label: '休日出勤申請',
    iconEmoji: '🌅',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-300',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    desc: '土日・祝日の出勤、および振替休日（代休）の指定申請',
  },
  leave: {
    label: '休暇申請',
    iconEmoji: '🌴',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    desc: '年次有給休暇、代休、半休、慶弔休暇等の取得申請',
  },
  overtime: {
    label: '残業申請',
    iconEmoji: '⏱️',
    colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-300',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    desc: '所定就業時間を超える時間外労働・深夜残業の事前申請',
  },
};

export const WORK_STATUS_DISPLAY: Record<
  WorkRequestStatus,
  { label: string; shortLabel: string; colorClass: string; badgeBg: string }
> = {
  submitted: {
    label: '① 申請中 (上長確認・許諾待ち)',
    shortLabel: '上長確認待ち',
    colorClass: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  manager_approved: {
    label: '② 上長許諾済 (総務勤怠反映待ち)',
    shortLabel: '総務連絡・連携中',
    colorClass: 'bg-blue-100 text-blue-800 border-blue-300',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  admin_confirmed: {
    label: '③ 完了 (総務勤怠反映済)',
    shortLabel: '勤怠反映完了',
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

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '年次有給休暇',
  substitute: '振替休日（代休）',
  special: '特別休暇',
  condolence: '慶弔休暇',
  absence: '私傷病・欠勤',
  half_am: '午前半休',
  half_pm: '午後半休',
};
