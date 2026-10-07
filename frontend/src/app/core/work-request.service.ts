import { Injectable, signal } from '@angular/core';
import {
  WorkRequest,
  WorkRequestStatus,
  WorkStampInfo,
  WorkTimelineStep,
} from './work-request.model';

const STORAGE_KEY = 'heron_work_requests_v1';

@Injectable({
  providedIn: 'root',
})
export class WorkRequestService {
  readonly requests = signal<WorkRequest[]>([]);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.requests.set(parsed);
          return;
        }
      } catch (e) {
        console.error('Failed to parse work requests storage', e);
      }
    }

    // デモ用サンプルデータを初期セット
    const samples = [
      this.createSampleHolidayWork(),
      this.createSampleLeaveRequest(),
      this.createSampleOvertimeRequest(),
    ];
    this.requests.set(samples);
    this.saveToStorage(samples);
  }

  private saveToStorage(data: WorkRequest[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save work requests to storage', e);
    }
    this.requests.set([...data]);
  }

  getAll(): WorkRequest[] {
    return this.requests();
  }

  getById(id: string): WorkRequest | undefined {
    return this.requests().find((r) => r.id === id);
  }

  /**
   * 新規業務申請の作成
   */
  createRequest(
    reqData: Omit<WorkRequest, 'id' | 'status' | 'timeline' | 'stamps'>
  ): WorkRequest {
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = reqData.applicant_name
      ? reqData.applicant_name.split(' ')[0] || reqData.applicant_name
      : '申請者';

    const newTimeline: WorkTimelineStep[] = [
      {
        id: '1',
        title: '① 申請者提出',
        role: '提出者',
        approverName: reqData.applicant_name,
        updatedAt: timeStr,
        completed: true,
        current: false,
      },
      {
        id: '2',
        title: '② 上長確認・許諾',
        role: '上長 (制作デスク/P)',
        approverName: '',
        updatedAt: '',
        completed: false,
        current: true,
      },
      {
        id: '3',
        title: '③ 総務受領・勤怠反映',
        role: '総務部 (勤怠管理)',
        approverName: '',
        updatedAt: '',
        completed: false,
        current: false,
      },
    ];

    const newStamps: WorkStampInfo[] = [
      { roleLabel: '総務', approverName: '', approvedDate: '', completed: false },
      { roleLabel: '上長', approverName: '', approvedDate: '', completed: false },
      { roleLabel: '提出者', approverName: lastName, approvedDate: stampDate, completed: true },
    ];

    const newReq: WorkRequest = {
      ...reqData,
      id: 'WR-' + Date.now().toString().slice(-6),
      status: 'submitted',
      timeline: newTimeline,
      stamps: newStamps,
    };

    const updated = [newReq, ...this.requests()];
    this.saveToStorage(updated);
    return newReq;
  }

  /**
   * 申請内容の編集（① 申請者提出 submitted 時のみ可能）
   */
  updateRequest(
    id: string,
    updatedData: Partial<WorkRequest>
  ): WorkRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = list[index];
    if (req.status !== 'submitted') {
      console.warn('Cannot edit work request after manager approval.');
      return null;
    }

    const updatedReq: WorkRequest = {
      ...req,
      ...updatedData,
    };

    list[index] = updatedReq;
    this.saveToStorage(list);
    return updatedReq;
  }

  /**
   * 上長による許諾 (manager_approved への進展)
   * 許諾されると総務へ自動連絡が届くステータスに移行
   */
  approveByManager(id: string, managerName: string): WorkRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = { ...list[index] };
    if (req.status !== 'submitted') return null;

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = managerName ? managerName.split(' ')[0] || managerName : '上長';

    req.status = 'manager_approved';
    req.timeline = req.timeline.map((step) => {
      if (step.id === '2') {
        return {
          ...step,
          approverName: managerName,
          updatedAt: timeStr,
          completed: true,
          current: false,
        };
      }
      if (step.id === '3') {
        return { ...step, current: true };
      }
      return step;
    });

    req.stamps = req.stamps.map((stamp) => {
      if (stamp.roleLabel === '上長') {
        return {
          ...stamp,
          approverName: lastName,
          approvedDate: stampDate,
          completed: true,
        };
      }
      return stamp;
    });

    list[index] = req;
    this.saveToStorage(list);
    return req;
  }

  /**
   * 総務による受領・勤怠システム反映 (admin_confirmed への進展)
   */
  confirmByAdmin(
    id: string,
    adminName: string,
    generalAffairsNote?: string
  ): WorkRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = { ...list[index] };
    if (req.status !== 'manager_approved') return null;

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = adminName ? adminName.split(' ')[0] || adminName : '総務';

    req.status = 'admin_confirmed';
    req.general_affairs_note = generalAffairsNote || '勤怠管理システム（タイムカード/労務台帳）に反映完了しました。';
    req.confirmed_by = adminName;
    req.confirmed_at = timeStr;

    req.timeline = req.timeline.map((step) => {
      if (step.id === '3') {
        return {
          ...step,
          approverName: adminName,
          updatedAt: timeStr,
          completed: true,
          current: false,
        };
      }
      return step;
    });

    req.stamps = req.stamps.map((stamp) => {
      if (stamp.roleLabel === '総務') {
        return {
          ...stamp,
          approverName: lastName,
          approvedDate: stampDate,
          completed: true,
        };
      }
      return stamp;
    });

    list[index] = req;
    this.saveToStorage(list);
    return req;
  }

  /**
   * 差戻し / 却下
   */
  rejectRequest(id: string, rejectorName: string, reason: string): WorkRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = { ...list[index] };
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    req.status = 'rejected';
    req.rejection_reason = reason;
    req.timeline = req.timeline.map((step) => {
      if (step.current) {
        return {
          ...step,
          approverName: `${rejectorName} (差戻し)`,
          updatedAt: timeStr,
          current: false,
        };
      }
      return step;
    });

    list[index] = req;
    this.saveToStorage(list);
    return req;
  }

  // --- デモ用サンプルデータ作成 ---

  /** サンプル1: 休日出勤申請（上長確認待ち） */
  private createSampleHolidayWork(): WorkRequest {
    return {
      id: 'WR-20261007-01',
      request_type: 'holiday_work',
      title: '第7話 カッティング出し準備に伴う休日出勤申請',
      applicant_name: '桜井 裕介',
      applicant_department: '制作部',
      applicant_role: '制作進行',
      created_at: '2026/10/07',
      target_date: '2026-10-11',
      time_range: '10:00 〜 19:00',
      hours_estimated: 8,
      substitute_date: '2026-10-14',
      anime_project: '『HERON: THE ANIMATION 第2期』',
      episode_or_process: '#07 作画回収・カッティング出し準備',
      deadline_date: '2026-10-12',
      reason_detail:
        '翌週月曜朝（10/12 10:00）の第7話カッティング出しに向け、週末アップ予定の原画カット（C-120〜C-155）の特出しスキャン・回収およびタイムシートチェック、動画検査出しの準備を集中的に行うため。作業終了後、代休として10/14（水）の取得を希望します。',
      emergency_contact: '090-1234-5678 (社用携帯) / Slack: @sakurai_p',
      status: 'submitted',
      timeline: [
        {
          id: '1',
          title: '① 申請者提出',
          role: '提出者',
          approverName: '桜井 裕介',
          updatedAt: '2026/10/07 14:30',
          completed: true,
          current: false,
        },
        {
          id: '2',
          title: '② 上長確認・許諾',
          role: '上長 (制作デスク/P)',
          approverName: '',
          updatedAt: '',
          completed: false,
          current: true,
        },
        {
          id: '3',
          title: '③ 総務受領・勤怠反映',
          role: '総務部 (勤怠管理)',
          approverName: '',
          updatedAt: '',
          completed: false,
          current: false,
        },
      ],
      stamps: [
        { roleLabel: '総務', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '上長', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '提出者', approverName: '桜井', approvedDate: '2026/10/7', completed: true },
      ],
    };
  }

  /** サンプル2: 休暇申請（上長許諾済 ➔ 総務勤怠反映待ち） */
  private createSampleLeaveRequest(): WorkRequest {
    return {
      id: 'WR-20261006-02',
      request_type: 'leave',
      title: '#05原画アップ完了に伴う振替休日（代休）取得申請',
      applicant_name: '佐々木 葵',
      applicant_department: '作画部',
      applicant_role: '原画マン',
      created_at: '2026/10/06',
      target_date: '2026-10-09',
      leave_type: 'substitute',
      leave_unit: 'full_day',
      hours_estimated: 8,
      anime_project: '『HERON: THE ANIMATION 第2期』',
      episode_or_process: '#05 作画（アクションパートLO/原画）',
      deadline_date: '2026-10-05',
      reason_detail:
        '先週日曜日（10/4）に実施した第5話アクションパート作画集中作業（休日出勤）の振替休日を取得いたします。担当カットの原画出しは10/5に全て完了しており、作監修正戻り後の修正対応は週明け10/12より着手いたします。',
      emergency_contact: '080-9876-5432 / Discord: @aoi_anim',
      status: 'manager_approved',
      timeline: [
        {
          id: '1',
          title: '① 申請者提出',
          role: '提出者',
          approverName: '佐々木 葵',
          updatedAt: '2026/10/06 11:20',
          completed: true,
          current: false,
        },
        {
          id: '2',
          title: '② 上長確認・許諾',
          role: '上長 (制作デスク/P)',
          approverName: '井上 デスク',
          updatedAt: '2026/10/06 17:45',
          completed: true,
          current: false,
        },
        {
          id: '3',
          title: '③ 総務受領・勤怠反映',
          role: '総務部 (勤怠管理)',
          approverName: '',
          updatedAt: '',
          completed: false,
          current: true,
        },
      ],
      stamps: [
        { roleLabel: '総務', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '上長', approverName: '井上', approvedDate: '2026/10/6', completed: true },
        { roleLabel: '提出者', approverName: '佐々木', approvedDate: '2026/10/6', completed: true },
      ],
    };
  }

  /** サンプル3: 残業申請（総務勤怠反映完了） */
  private createSampleOvertimeRequest(): WorkRequest {
    return {
      id: 'WR-20261005-03',
      request_type: 'overtime',
      title: '劇場版 特報PVコンテ撮・編集立ち会いに伴う残業申請',
      applicant_name: '高橋 俊樹',
      applicant_department: '演出部',
      applicant_role: '演出・助監督',
      created_at: '2026/10/05',
      target_date: '2026-10-05',
      time_range: '19:00 〜 23:00',
      hours_estimated: 4,
      has_midnight_overtime: true,
      anime_project: '『劇場版 HERON -蒼穹の軌跡-』',
      episode_or_process: '特報PV コンテ撮・オフライン編集立ち会い',
      deadline_date: '2026-10-06',
      reason_detail:
        '翌日の製作委員会プレビュー向け特報PV第1弾のオフライン編集立ち会い、および追加カットのタイムシート再調整のため。外部編集スタジオ（銀座）での立ち会い作業を含みます。',
      emergency_contact: '090-3344-5566 / 内線: 204',
      status: 'admin_confirmed',
      general_affairs_note:
        '10/5 深夜残業（1時間）含む残業4.0時間を勤怠集計システムへ登録完了。36協定月間時間枠内であることを確認済み。',
      confirmed_by: '総務部 労務担当',
      confirmed_at: '2026/10/06 09:30',
      timeline: [
        {
          id: '1',
          title: '① 申請者提出',
          role: '提出者',
          approverName: '高橋 俊樹',
          updatedAt: '2026/10/05 16:10',
          completed: true,
          current: false,
        },
        {
          id: '2',
          title: '② 上長確認・許諾',
          role: '上長 (制作デスク/P)',
          approverName: '中村 プロデューサー',
          updatedAt: '2026/10/05 18:00',
          completed: true,
          current: false,
        },
        {
          id: '3',
          title: '③ 総務受領・勤怠反映',
          role: '総務部 (勤怠管理)',
          approverName: '総務部 労務担当',
          updatedAt: '2026/10/06 09:30',
          completed: true,
          current: false,
        },
      ],
      stamps: [
        { roleLabel: '総務', approverName: '総務', approvedDate: '2026/10/6', completed: true },
        { roleLabel: '上長', approverName: '中村', approvedDate: '2026/10/5', completed: true },
        { roleLabel: '提出者', approverName: '高橋', approvedDate: '2026/10/5', completed: true },
      ],
    };
  }
}
