import { Injectable, signal } from '@angular/core';
import { ApprovalRequest, ApprovalStatus, StampInfo, TimelineStep, PurchaseItem } from './approval.model';

const STORAGE_KEY = 'heron_approval_requests_v3';
const ALL_STORAGE_KEYS = [
  'heron_approval_requests_v3',
  'heron_approval_requests_v2',
  'heron_approval_requests_v1',
  'heron_approval_requests',
];

@Injectable({
  providedIn: 'root',
})
export class ApprovalService {
  readonly requests = signal<ApprovalRequest[]>([]);

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 全過去キーのストレージデータを一括収集・統合マイグレーションする処理
   * ユーザーが作成した申請データが一切消えないように保護します。
   */
  private loadFromStorage() {
    const mergedMap = new Map<string, ApprovalRequest>();

    // 1. デフォルトデモデータを先に登録
    const defaultData = [
      this.createSampleRequest(),
      this.createCompletedSampleRequest(),
    ];
    defaultData.forEach((req) => mergedMap.set(req.id, req));

    // 2. すべての過去ストレージキーを巡回スキャンして全データをマージ
    ALL_STORAGE_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((req: ApprovalRequest) => {
              if (req && req.id) {
                // 既存のサンプルよりユーザー変更・新規データを優先
                mergedMap.set(req.id, req);
              }
            });
          }
        } catch (e) {
          console.error(`Failed to parse storage key ${key}`, e);
        }
      }
    });

    const mergedList = Array.from(mergedMap.values());

    // 3. 最新データをセットし、ストレージに同期書き込み
    this.requests.set(mergedList);
    this.saveToStorage(mergedList);
  }

  private saveToStorage(data: ApprovalRequest[]) {
    // 全キーに同期保存してデータ保護を徹底
    ALL_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error(`Failed to save to storage key ${key}`, e);
      }
    });
    this.requests.set([...data]);
  }

  getAll(): ApprovalRequest[] {
    return this.requests();
  }

  getById(id: string): ApprovalRequest | undefined {
    return this.requests().find((r) => r.id === id);
  }

  createRequest(reqData: Omit<ApprovalRequest, 'id' | 'status' | 'timeline' | 'stamps'>): ApprovalRequest {
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = reqData.applicant_name ? reqData.applicant_name.split(' ')[0] || reqData.applicant_name : '申請者';

    const newTimeline: TimelineStep[] = [
      { id: '1', title: '① 申請者提出', role: '提出者', approverName: reqData.applicant_name, updatedAt: timeStr, completed: true, current: false },
      { id: '2', title: '② プロデューサー承認', role: 'プロデューサー', approverName: '', updatedAt: '', completed: false, current: true },
      { id: '3', title: '③ DXチーム確認', role: 'DXチーム', approverName: '', updatedAt: '', completed: false, current: false },
      { id: '4', title: '④ 代表承認', role: '代表', approverName: '', updatedAt: '', completed: false, current: false },
    ];

    const newStamps: StampInfo[] = [
      { roleLabel: '代表', approverName: '', approvedDate: '', completed: false },
      { roleLabel: 'DXチーム', approverName: '', approvedDate: '', completed: false },
      { roleLabel: 'プロデューサー', approverName: '', approvedDate: '', completed: false },
      { roleLabel: '提出者', approverName: lastName, approvedDate: stampDate, completed: true },
    ];

    const newReq: ApprovalRequest = {
      ...reqData,
      id: 'APR-' + Date.now().toString().slice(-6),
      status: 'submitted',
      timeline: newTimeline,
      stamps: newStamps,
    };

    const updated = [newReq, ...this.requests()];
    this.saveToStorage(updated);
    return newReq;
  }

  /**
   * 申請内容の更新 (「① 申請者提出 (submitted)」のステータス時のみ可能)
   */
  updateRequest(id: string, updatedData: Partial<ApprovalRequest>): ApprovalRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = list[index];
    if (req.status !== 'submitted') {
      console.warn('Cannot edit approval request after producer approval.');
      return null;
    }

    const updatedReq: ApprovalRequest = {
      ...req,
      ...updatedData,
    };

    list[index] = updatedReq;
    this.saveToStorage(list);
    return updatedReq;
  }

  advanceApproval(id: string, currentApproverName: string): ApprovalRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = { ...list[index] };
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = currentApproverName ? currentApproverName.split(' ')[0] || currentApproverName : '承認者';

    if (req.status === 'submitted') {
      req.status = 'producer_approved';
      req.timeline = req.timeline.map((step) => {
        if (step.id === '2') return { ...step, approverName: currentApproverName, updatedAt: timeStr, completed: true, current: false };
        if (step.id === '3') return { ...step, current: true };
        return step;
      });
      req.stamps = req.stamps.map((stamp) => {
        if (stamp.roleLabel === 'プロデューサー') return { ...stamp, approverName: lastName, approvedDate: stampDate, completed: true };
        return stamp;
      });
    } else if (req.status === 'producer_approved') {
      req.status = 'dx_confirmed';
      req.timeline = req.timeline.map((step) => {
        if (step.id === '3') return { ...step, approverName: currentApproverName, updatedAt: timeStr, completed: true, current: false };
        if (step.id === '4') return { ...step, current: true };
        return step;
      });
      req.stamps = req.stamps.map((stamp) => {
        if (stamp.roleLabel === 'DXチーム') return { ...stamp, approverName: lastName, approvedDate: stampDate, completed: true };
        return stamp;
      });
    } else if (req.status === 'dx_confirmed') {
      req.status = 'president_approved';
      req.timeline = req.timeline.map((step) => {
        if (step.id === '4') return { ...step, approverName: currentApproverName, updatedAt: timeStr, completed: true, current: false };
        return step;
      });
      req.stamps = req.stamps.map((stamp) => {
        if (stamp.roleLabel === '代表') return { ...stamp, approverName: lastName, approvedDate: stampDate, completed: true };
        return stamp;
      });
    }

    list[index] = req;
    this.saveToStorage(list);
    return req;
  }

  private createSampleRequest(): ApprovalRequest {
    const items: PurchaseItem[] = [
      {
        name: 'Google Antigravity Enterprise ライセンス (開発特化型AI)',
        price: 15000,
        quantity: 2,
        purchase_url: 'https://antigravity.google/enterprise',
        image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'コードセキュリティ ＆ 自動監査アドオン',
        price: 5000,
        quantity: 2,
        purchase_url: 'https://antigravity.google/security',
        image_url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=600&q=80',
      },
    ];
    return {
      id: 'APR-20260313',
      title: '開発用生成AIツールの見直しおよび「Google Antigravity」の導入',
      applicant_name: '山田 惇斗',
      applicant_department: '総務部 デジタル推進課',
      created_at: '2026/03/13',
      desired_date: '2026-03-19',
      new_item_name: 'Google Antigravity Enterprise 外1点',
      items: items,
      cancel_item_name: 'ChatGPT (既存契約の解除)',
      usage_purpose: '社内ポータルサイトの開発・保守・コードレビュー、およびアーキテクチャ設計。',
      reason_detail:
        '現在、社内ポータルサイトの継続的なアップデートおよび保守運用において、開発効率化を目的に生成AIを利用しております。この度、更なる開発速度の向上と品質の担保を目的として、既存ツールを見直し、最新の開発特化型AI「Google Antigravity」への切り替えを申請いたします。\n\n■ 主な選定理由\n・既存ツールと比較し、設計図からのコード生成精度が約40%向上している点。\n・弊社採用インフラとの親和性が高く、デプロイ自動化の連携が容易である点。\n・開発特化のセキュリティ機能を備え、機密情報の取り扱いがより安全である点。',
      attachment_note: 'AIツール月額コスト比較レポート_260313.pdf',
      estimated_amount: '40,000円',
      status: 'submitted',
      timeline: [
        { id: '1', title: '① 申請者提出', role: '提出者', approverName: '山田 惇斗', updatedAt: '2026/03/13 10:00', completed: true, current: false },
        { id: '2', title: '② プロデューサー承認', role: 'プロデューサー', approverName: '', updatedAt: '', completed: false, current: true },
        { id: '3', title: '③ DXチーム確認', role: 'DXチーム', approverName: '', updatedAt: '', completed: false, current: false },
        { id: '4', title: '④ 代表承認', role: '代表', approverName: '', updatedAt: '', completed: false, current: false },
      ],
      stamps: [
        { roleLabel: '代表', approverName: '', approvedDate: '', completed: false },
        { roleLabel: 'DXチーム', approverName: '', approvedDate: '', completed: false },
        { roleLabel: 'プロデューサー', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '提出者', approverName: '山田', approvedDate: '2026/3/13', completed: true },
      ],
    };
  }

  private createCompletedSampleRequest(): ApprovalRequest {
    const items: PurchaseItem[] = [
      {
        name: 'Wacom Cintiq Pro 27（液晶ペンタブレット）',
        price: 388000,
        quantity: 1,
        purchase_url: 'https://www.amazon.co.jp/dp/B0BGD5Z49H',
        image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Wacom Cintiq Pro 27 Stand（専用スタンド）',
        price: 80000,
        quantity: 1,
        purchase_url: 'https://www.amazon.co.jp/dp/B0BGDBF82M',
        image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'エルゴノミクス プロペン3 ツールセット',
        price: 20000,
        quantity: 1,
        purchase_url: 'https://www.amazon.co.jp/dp/B0BGDD987N',
        image_url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=600&q=80',
      },
    ];
    return {
      id: 'APR-20260201',
      title: 'デザイン受託開発用 Wacom 液晶ペンタブレットおよび周辺機器の更新・購入申請',
      applicant_name: '佐藤 健太',
      applicant_department: 'クリエイティブ開発課',
      created_at: '2026/02/01',
      desired_date: '2026-02-10',
      new_item_name: 'Wacom Cintiq Pro 27 外2点',
      items: items,
      cancel_item_name: '古いペンタブレット (型番: DTK-2200)',
      usage_purpose: '新規社内UIデザイナー用作画端末の準備および業務効率化。',
      reason_detail:
        'クリエイティブ開発課における新規プロジェクト対応および作業効率向上のため、高性能液晶タブレットおよび周辺環境アクセサリの導入を申請いたしました。全承認ステップを経て決済完了済みです。',
      attachment_note: '機材導入見積書_260201.pdf',
      estimated_amount: '488,000円',
      status: 'president_approved',
      timeline: [
        { id: '1', title: '① 申請者提出', role: '提出者', approverName: '佐藤 健太', updatedAt: '2026/02/01 09:30', completed: true, current: false },
        { id: '2', title: '② プロデューサー承認', role: 'プロデューサー', approverName: '中村 プロデューサー', updatedAt: '2026/02/02 11:15', completed: true, current: false },
        { id: '3', title: '③ DXチーム確認', role: 'DXチーム', approverName: '松山 DX', updatedAt: '2026/02/02 15:40', completed: true, current: false },
        { id: '4', title: '④ 代表承認', role: '代表', approverName: '井上 代表', updatedAt: '2026/02/03 10:20', completed: true, current: false },
      ],
      stamps: [
        { roleLabel: '代表', approverName: '井上', approvedDate: '2026/2/3', completed: true },
        { roleLabel: 'DXチーム', approverName: '松山', approvedDate: '2026/2/2', completed: true },
        { roleLabel: 'プロデューサー', approverName: '中村', approvedDate: '2026/2/2', completed: true },
        { roleLabel: '提出者', approverName: '佐藤', approvedDate: '2026/2/1', completed: true },
      ],
    };
  }
}
