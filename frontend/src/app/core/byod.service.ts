import { Injectable, signal } from '@angular/core';
import {
  ByodRequest,
  ByodStatus,
  ByodStampInfo,
  ByodTimelineStep,
  ByodDevice,
  ByodExternalMedia,
} from './byod.model';

const STORAGE_KEY = 'heron_byod_requests_v1';

@Injectable({
  providedIn: 'root',
})
export class ByodService {
  readonly requests = signal<ByodRequest[]>([]);

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
        console.error('Failed to parse byod storage', e);
      }
    }

    // デモ用サンプルデータを初期セット
    const samples = [
      this.createSampleSubmittedRequest(),
      this.createSampleManagerApprovedRequest(),
      this.createSampleApprovedRequest(),
    ];
    this.requests.set(samples);
    this.saveToStorage(samples);
  }

  private saveToStorage(data: ByodRequest[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save BYOD requests to storage', e);
    }
    this.requests.set([...data]);
  }

  getAll(): ByodRequest[] {
    return this.requests();
  }

  getById(id: string): ByodRequest | undefined {
    return this.requests().find((r) => r.id === id);
  }

  /**
   * 新規BYOD申請の作成
   */
  createRequest(
    reqData: Omit<
      ByodRequest,
      | 'id'
      | 'doc_no'
      | 'status'
      | 'timeline'
      | 'stamps'
      | 'count_pc'
      | 'count_tablet'
      | 'count_media'
      | 'count_other'
      | 'sheet_count'
    >
  ): ByodRequest {
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = reqData.applicant_name
      ? reqData.applicant_name.split(' ')[0] || reqData.applicant_name
      : '申請者';

    // 台数自動集計
    let countPc = 0;
    let countTablet = 0;
    let countOther = 0;
    reqData.devices.forEach((d) => {
      const label = (d.device_type_label || '').toLowerCase();
      if (label.includes('tablet') || label.includes('ipad') || label.includes('タブレット')) {
        countTablet++;
      } else if (label.includes('pc') || label.includes('mac') || label.includes('windows')) {
        countPc++;
      } else {
        countOther++;
      }
    });
    const countMedia = reqData.external_media.length;

    const newTimeline: ByodTimelineStep[] = [
      {
        id: '1',
        title: '① 申請者提出・誓約',
        role: '申請者',
        approverName: reqData.applicant_name,
        updatedAt: timeStr,
        completed: true,
        current: false,
      },
      {
        id: '2',
        title: '② 所属長審査・承認',
        role: '所属長 (プロデューサー/部長)',
        approverName: '',
        updatedAt: '',
        completed: false,
        current: true,
      },
      {
        id: '3',
        title: '③ 情報セキュリティ責任者決裁',
        role: '情報セキュリティ責任者',
        approverName: '',
        updatedAt: '',
        completed: false,
        current: false,
      },
    ];

    const newStamps: ByodStampInfo[] = [
      { roleLabel: '情報セキュリティ責任者', approverName: '', approvedDate: '', completed: false },
      { roleLabel: '所属長', approverName: '', approvedDate: '', completed: false },
      { roleLabel: '申請者', approverName: lastName, approvedDate: stampDate, completed: true },
    ];

    const newReq: ByodRequest = {
      ...reqData,
      id: 'BYOD-' + Date.now().toString().slice(-6),
      doc_no: 'SEC-FORM-2026-' + String(this.requests().length + 1).padStart(3, '0'),
      count_pc: countPc,
      count_tablet: countTablet,
      count_media: countMedia,
      count_other: countOther,
      sheet_count: Math.max(1, Math.ceil(reqData.devices.length / 2)),
      status: 'submitted',
      timeline: newTimeline,
      stamps: newStamps,
    };

    const updated = [newReq, ...this.requests()];
    this.saveToStorage(updated);
    return newReq;
  }

  /**
   * 申請内容の更新 (submitted 時のみ可能)
   */
  updateRequest(id: string, updatedData: Partial<ByodRequest>): ByodRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = list[index];
    if (req.status !== 'submitted') {
      console.warn('Cannot edit BYOD request after approval process started.');
      return null;
    }

    // 台数再集計
    let countPc = req.count_pc;
    let countTablet = req.count_tablet;
    let countOther = req.count_other;
    if (updatedData.devices) {
      countPc = 0;
      countTablet = 0;
      countOther = 0;
      updatedData.devices.forEach((d) => {
        const label = (d.device_type_label || '').toLowerCase();
        if (label.includes('tablet') || label.includes('ipad') || label.includes('タブレット')) {
          countTablet++;
        } else if (label.includes('pc') || label.includes('mac') || label.includes('windows')) {
          countPc++;
        } else {
          countOther++;
        }
      });
    }
    const countMedia = updatedData.external_media
      ? updatedData.external_media.length
      : req.count_media;

    const updatedReq: ByodRequest = {
      ...req,
      ...updatedData,
      count_pc: countPc,
      count_tablet: countTablet,
      count_media: countMedia,
      count_other: countOther,
    };

    list[index] = updatedReq;
    this.saveToStorage(list);
    return updatedReq;
  }

  /**
   * 所属長による承認
   */
  approveByManager(id: string, managerName: string): ByodRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = { ...list[index] };
    if (req.status !== 'submitted') return null;

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = managerName ? managerName.split(' ')[0] || managerName : '所属長';

    req.status = 'manager_approved';
    req.manager_approved_date = timeStr;
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
      if (stamp.roleLabel === '所属長') {
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
   * 情報セキュリティ責任者による決裁 (最終承認 ＆ ステッカー番号交付)
   */
  approveBySecurity(
    id: string,
    securityAdminName: string,
    verifiedNote?: string
  ): ByodRequest | null {
    const list = [...this.requests()];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const req = { ...list[index] };
    if (req.status !== 'manager_approved') return null;

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stampDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const lastName = securityAdminName
      ? securityAdminName.split(' ')[0] || securityAdminName
      : 'セキ責';

    // 有効期限: 翌年度の3月31日または1年後
    const nextYear = now.getFullYear() + 1;
    const expireDate = `${nextYear}年03月31日`;

    req.status = 'security_approved';
    req.security_approved_date = timeStr;
    req.expire_date = expireDate;

    // ステッカー番号が未設定の場合、自動採番交付
    let stickerSeq = 1;
    req.devices = req.devices.map((d, idx) => {
      const stk = d.sticker_no || `STK-${now.getFullYear()}-${String(stickerSeq++).padStart(3, '0')}`;
      return {
        ...d,
        sticker_no: stk,
        admin_verified_encryption: true,
        admin_verified_security: true,
        admin_sticker_attached: true,
        admin_checker_name: securityAdminName,
      };
    });

    req.external_media = req.external_media.map((m, idx) => {
      const stk = m.sticker_no || `STK-${now.getFullYear()}-M${String(idx + 1).padStart(2, '0')}`;
      return {
        ...m,
        sticker_no: stk,
        admin_confirmed: true,
      };
    });

    req.timeline = req.timeline.map((step) => {
      if (step.id === '3') {
        return {
          ...step,
          approverName: securityAdminName,
          updatedAt: timeStr,
          completed: true,
          current: false,
        };
      }
      return step;
    });

    req.stamps = req.stamps.map((stamp) => {
      if (stamp.roleLabel === '情報セキュリティ責任者') {
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
   * 差戻し
   */
  rejectRequest(id: string, rejectorName: string, reason: string): ByodRequest | null {
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

  /** サンプル1: 申請中 (木村 拓也 / 作画部 / Mac Studio & iPad) */
  private createSampleSubmittedRequest(): ByodRequest {
    return {
      id: 'BYOD-20261008-01',
      doc_no: 'SEC-FORM-2026-001',
      created_at: '2026/10/08',
      apply_type: 'new',
      employment_type: 'freelance',
      applicant_name: '木村 拓也',
      applicant_department: '作画部',
      applicant_role: '原画マン',
      staff_number: 'A-042',
      contact_info: '090-2345-6789 / 内線: なし (個人携帯)',
      count_pc: 1,
      count_tablet: 1,
      count_media: 1,
      count_other: 0,
      sheet_count: 1,
      devices: [
        {
          id: 'dev-1',
          device_category: 'pc_tablet',
          device_type_label: 'Mac デスクトップ (Mac Studio)',
          sticker_no: '',
          manufacturer: 'Apple / Mac Studio M2 Max',
          model_or_serial: 'MQH73J/A / C02GV89XMD6R',
          os_version: 'macOS Sonoma 14.6.1',
          mac_address: 'F0:18:98:3A:4C:12',
          encryption: 'filevault',
          security_software: 'ESET Cyber Security Pro',
          auto_update: true,
          purpose: '第7話クライマックスシーンのアクション作画・レイアウトデータ作成および自宅作業環境との連携。',
        },
        {
          id: 'dev-2',
          device_category: 'pc_tablet',
          device_type_label: 'タブレット (iPad Pro 12.9)',
          sticker_no: '',
          manufacturer: 'Apple / iPad Pro 12.9インチ 第6世代',
          model_or_serial: 'MNXQ3J/A / DMPX7942KDJ1',
          os_version: 'iPadOS 17.5.1',
          mac_address: 'BC:D0:74:11:22:33',
          encryption: 'ios',
          security_software: 'iPadOS標準 (パスコード6桁・生体認証)',
          auto_update: true,
          purpose: 'Clip Studio Paint によるデジタル原画作画・チェック作業。社内Wi-Fiへの接続。',
        },
      ],
      external_media: [
        {
          no: 3,
          media_type: 'ssd',
          capacity: '1TB',
          maker_and_model: 'SanDisk Extreme Portable SSD',
          serial_or_name: 'SDSSDE61-1T00 / SN: 231189401',
          has_encryption: true,
          encryption_method: 'ハードウェアAES 256bit暗号化',
          sticker_no: '',
        },
      ],
      pledge_agreed: true,
      pledge_date: '2026/10/08',
      status: 'submitted',
      timeline: [
        {
          id: '1',
          title: '① 申請者提出・誓約',
          role: '申請者',
          approverName: '木村 拓也',
          updatedAt: '2026/10/08 11:30',
          completed: true,
          current: false,
        },
        {
          id: '2',
          title: '② 所属長審査・承認',
          role: '所属長 (プロデューサー/部長)',
          approverName: '',
          updatedAt: '',
          completed: false,
          current: true,
        },
        {
          id: '3',
          title: '③ 情報セキュリティ責任者決裁',
          role: '情報セキュリティ責任者',
          approverName: '',
          updatedAt: '',
          completed: false,
          current: false,
        },
      ],
      stamps: [
        { roleLabel: '情報セキュリティ責任者', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '所属長', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '申請者', approverName: '木村', approvedDate: '2026/10/8', completed: true },
      ],
    };
  }

  /** サンプル2: 所属長承認済 (渡辺 美香 / CG・撮影部 / 自作Windows PC) */
  private createSampleManagerApprovedRequest(): ByodRequest {
    return {
      id: 'BYOD-20261007-02',
      doc_no: 'SEC-FORM-2026-002',
      created_at: '2026/10/07',
      apply_type: 'new',
      employment_type: 'regular',
      applicant_name: '渡辺 美香',
      applicant_department: 'CG・撮影部',
      applicant_role: '3Dモデラー・演出',
      staff_number: 'E-108',
      contact_info: '03-5912-xxxx (内線: 304)',
      count_pc: 1,
      count_tablet: 0,
      count_media: 2,
      count_other: 0,
      sheet_count: 1,
      devices: [
        {
          id: 'dev-1',
          device_category: 'pc_tablet',
          device_type_label: 'Windows タワー型PC',
          sticker_no: 'STK-2026-002',
          manufacturer: '自作 (AMD Ryzen 9 / RTX 4090搭載)',
          model_or_serial: 'DESKTOP-CUSTOM-99 / SN: MB-X670-8842',
          os_version: 'Windows 11 Pro 23H2',
          mac_address: '00:1A:2B:3C:4D:5E',
          encryption: 'bitlocker',
          security_software: 'Microsoft Defender for Endpoint',
          auto_update: true,
          purpose: '劇場版PV用Unreal Engine 5によるリアルタイム背景アセット構築およびGPUレンダリング検証。',
          admin_verified_encryption: true,
          admin_verified_security: true,
        },
      ],
      external_media: [
        {
          no: 3,
          media_type: 'ssd',
          capacity: '2TB',
          maker_and_model: 'Samsung T7 Shield SSD',
          serial_or_name: 'MU-PE2T0S / S68XNS0W123456',
          has_encryption: true,
          encryption_method: 'AES 256bit ハードウェア暗号化',
          sticker_no: 'STK-2026-M01',
        },
        {
          no: 4,
          media_type: 'usb',
          capacity: '128GB',
          maker_and_model: 'KIOXIA TransMemory U365',
          serial_or_name: 'LU365K128GG4 / SN: KX-99201',
          has_encryption: true,
          encryption_method: 'BitLocker To Go',
          sticker_no: 'STK-2026-M02',
        },
      ],
      pledge_agreed: true,
      pledge_date: '2026/10/07',
      status: 'manager_approved',
      manager_approved_date: '2026/10/07 16:45',
      timeline: [
        {
          id: '1',
          title: '① 申請者提出・誓約',
          role: '申請者',
          approverName: '渡辺 美香',
          updatedAt: '2026/10/07 10:15',
          completed: true,
          current: false,
        },
        {
          id: '2',
          title: '② 所属長審査・承認',
          role: '所属長 (プロデューサー/部長)',
          approverName: '松山 CG部長',
          updatedAt: '2026/10/07 16:45',
          completed: true,
          current: false,
        },
        {
          id: '3',
          title: '③ 情報セキュリティ責任者決裁',
          role: '情報セキュリティ責任者',
          approverName: '',
          updatedAt: '',
          completed: false,
          current: true,
        },
      ],
      stamps: [
        { roleLabel: '情報セキュリティ責任者', approverName: '', approvedDate: '', completed: false },
        { roleLabel: '所属長', approverName: '松山', approvedDate: '2026/10/7', completed: true },
        { roleLabel: '申請者', approverName: '渡辺', approvedDate: '2026/10/7', completed: true },
      ],
    };
  }

  /** サンプル3: 決裁完了 (中村 健一郎 / 演出部 / MacBook Pro 16) */
  private createSampleApprovedRequest(): ByodRequest {
    return {
      id: 'BYOD-20260915-03',
      doc_no: 'SEC-FORM-2026-003',
      created_at: '2026/09/15',
      apply_type: 'new',
      employment_type: 'contract',
      applicant_name: '中村 健一郎',
      applicant_department: '演出部',
      applicant_role: '助監督・絵コンテ',
      staff_number: 'C-019',
      contact_info: '090-8877-6655 / 内線: 205',
      count_pc: 1,
      count_tablet: 0,
      count_media: 1,
      count_other: 0,
      sheet_count: 1,
      devices: [
        {
          id: 'dev-1',
          device_category: 'pc_tablet',
          device_type_label: 'Mac ノートPC (MacBook Pro 16)',
          sticker_no: 'STK-2026-004',
          manufacturer: 'Apple / MacBook Pro 16 M3 Max',
          model_or_serial: 'MUW63J/A / C02K9982MD6W',
          os_version: 'macOS Sonoma 14.5',
          mac_address: '3C:06:30:4A:BC:DE',
          encryption: 'filevault',
          security_software: 'Sophos Home Premium (法人登録)',
          auto_update: true,
          purpose: '各話数絵コンテ作成、ビデオコンテ（Vコン）編集、およびダビング・アフレコ現場での映像照合用。',
          admin_verified_encryption: true,
          admin_verified_security: true,
          admin_sticker_attached: true,
          admin_checker_name: '情報セキュリティ室',
        },
      ],
      external_media: [
        {
          no: 3,
          media_type: 'ssd',
          capacity: '4TB',
          maker_and_model: 'Crucial X9 Pro Portable SSD',
          serial_or_name: 'CT4000X9PROSSD9 / SN: CRU-4TB-0091',
          has_encryption: true,
          encryption_method: 'APFS 暗号化ボリューム',
          sticker_no: 'STK-2026-M04',
          admin_confirmed: true,
        },
      ],
      pledge_agreed: true,
      pledge_date: '2026/09/15',
      status: 'security_approved',
      manager_approved_date: '2026/09/15 14:00',
      security_approved_date: '2026/09/16 11:20',
      expire_date: '2027年03月31日',
      timeline: [
        {
          id: '1',
          title: '① 申請者提出・誓約',
          role: '申請者',
          approverName: '中村 健一郎',
          updatedAt: '2026/09/15 09:30',
          completed: true,
          current: false,
        },
        {
          id: '2',
          title: '② 所属長審査・承認',
          role: '所属長 (プロデューサー/部長)',
          approverName: '井上 統括P',
          updatedAt: '2026/09/15 14:00',
          completed: true,
          current: false,
        },
        {
          id: '3',
          title: '③ 情報セキュリティ責任者決裁',
          role: '情報セキュリティ責任者',
          approverName: '情報セキュリティ室長',
          updatedAt: '2026/09/16 11:20',
          completed: true,
          current: false,
        },
      ],
      stamps: [
        { roleLabel: '情報セキュリティ責任者', approverName: 'セキュリティ', approvedDate: '2026/9/16', completed: true },
        { roleLabel: '所属長', approverName: '井上', approvedDate: '2026/9/15', completed: true },
        { roleLabel: '申請者', approverName: '中村', approvedDate: '2026/9/15', completed: true },
      ],
    };
  }
}
