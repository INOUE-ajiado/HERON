import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import {
  SoftwareLicense,
  SoftwareCategory,
  SOFTWARE_CATEGORY_LABELS,
} from './license.model';

const STORAGE_KEY = 'heron_software_licenses_v1';
const FIRESTORE_COL = 'licenses';

export interface EmailBuildOptions {
  recipientName: string;
  recipientEmail: string;
  subject: string;
  includePassword: boolean;
  includeSerial: boolean;
  customMessage: string;
  senderName: string;
}

@Injectable({
  providedIn: 'root',
})
export class LicenseService {
  private readonly firebase = inject(FirebaseService);
  readonly licenses = signal<SoftwareLicense[]>([]);
  readonly syncing = signal<boolean>(false);

  constructor() {
    this.loadFromStorage();
    void this.syncFromFirestore();
  }

  private loadFromStorage(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.licenses.set(parsed);
          return;
        }
      } catch (e) {
        console.error('Failed to parse license storage', e);
      }
    }

    const samples = this.createSampleLicenses();
    this.licenses.set(samples);
    this.saveToStorage(samples);
  }

  private saveToStorage(data: SoftwareLicense[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save licenses to localStorage', e);
    }
    this.licenses.set([...data]);
  }

  /**
   * Firestore と同期（認証確立後に全端末で同じ台帳データを共有）
   */
  async syncFromFirestore(): Promise<void> {
    this.syncing.set(true);
    try {
      const fbUser = await this.firebase.waitForAuth();
      if (!fbUser) return;

      const db = this.firebase.getDb();
      const colRef = collection(db, FIRESTORE_COL);
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
        // 初回は現在のローカル（サンプル含む）を Firestore に書き込み
        const current = this.licenses();
        for (const item of current) {
          await setDoc(doc(db, FIRESTORE_COL, item.id), this.cleanUndefined(item));
        }
      } else {
        const remoteList = snapshot.docs.map((d) => d.data() as SoftwareLicense);
        // ID順・管理コード順で安定ソート
        remoteList.sort((a, b) =>
          (a.management_code || a.id).localeCompare(b.management_code || b.id)
        );
        this.saveToStorage(remoteList);
      }
    } catch (err) {
      console.warn('[HERON] ライセンス台帳の Firestore 同期をスキップしました (ローカルキャッシュを使用):', err);
    } finally {
      this.syncing.set(false);
    }
  }

  private async upsertToFirestore(item: SoftwareLicense): Promise<void> {
    try {
      const db = this.firebase.getDb();
      await setDoc(doc(db, FIRESTORE_COL, item.id), this.cleanUndefined(item));
    } catch (err) {
      console.warn('[HERON] Firestore へのライセンス保存に失敗しました:', err);
    }
  }

  private cleanUndefined(obj: any): Record<string, any> {
    return JSON.parse(JSON.stringify(obj));
  }

  private nowStr(): string {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }

  createLicense(
    input: Omit<SoftwareLicense, 'id' | 'updated_at' | 'mail_history'>
  ): SoftwareLicense {
    const newLic: SoftwareLicense = {
      ...input,
      id: 'LIC-' + Date.now().toString().slice(-6),
      updated_at: this.nowStr(),
      mail_history: [],
    };

    const updated = [newLic, ...this.licenses()];
    this.saveToStorage(updated);
    void this.upsertToFirestore(newLic);
    return newLic;
  }

  updateLicense(
    id: string,
    patch: Partial<SoftwareLicense>
  ): SoftwareLicense | null {
    const list = [...this.licenses()];
    const idx = list.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    const updatedItem: SoftwareLicense = {
      ...list[idx],
      ...patch,
      updated_at: this.nowStr(),
    };

    list[idx] = updatedItem;
    this.saveToStorage(list);
    void this.upsertToFirestore(updatedItem);
    return updatedItem;
  }

  deleteLicense(id: string): void {
    const updated = this.licenses().filter((l) => l.id !== id);
    this.saveToStorage(updated);
    try {
      const db = this.firebase.getDb();
      void deleteDoc(doc(db, FIRESTORE_COL, id));
    } catch {
      // ignore offline
    }
  }

  /**
   * 利用者の紐付け・割当更新
   */
  assignUser(
    id: string,
    assignment: {
      assigned_user_name: string;
      assigned_user_email: string;
      assigned_department: string;
      assigned_role: string;
      assigned_device: string;
      assigned_date: string;
    }
  ): SoftwareLicense | null {
    return this.updateLicense(id, {
      status: 'assigned',
      ...assignment,
    });
  }

  /**
   * 利用者の紐付け解除（空き在庫へ戻す）
   */
  unassignUser(id: string): SoftwareLicense | null {
    return this.updateLicense(id, {
      status: 'available',
      assigned_user_name: '',
      assigned_user_email: '',
      assigned_department: '',
      assigned_role: '',
      assigned_device: '',
      assigned_date: '',
    });
  }

  /**
   * 案内メール送信履歴の記録
   */
  recordMailSent(
    id: string,
    info: {
      sent_by: string;
      recipient_name: string;
      recipient_email: string;
      subject: string;
      included_credentials: boolean;
    }
  ): SoftwareLicense | null {
    const target = this.licenses().find((l) => l.id === id);
    if (!target) return null;

    const sentAt = this.nowStr();
    const entry = {
      id: 'MAIL-' + Date.now().toString().slice(-6),
      sent_at: sentAt,
      ...info,
    };

    return this.updateLicense(id, {
      last_mail_sent_at: sentAt,
      mail_history: [entry, ...(target.mail_history || [])],
    });
  }

  /**
   * ソフトウェア種別ごとのインストール・アクティベーション手順を取得
   */
  getActivationSteps(category: SoftwareCategory): string[] {
    switch (category) {
      case 'microsoft_office':
        return [
          '下記の「Microsoft 365 ポータルURL (https://portal.office.com)」にアクセスします。',
          '本メール記載の「ログインアカウントID」と「初期パスワード」でサインインします（初回サインイン時にパスワード変更が求められる場合は変更してください）。',
          '画面右上の「アプリをインストール」＞「Microsoft 365 アプリ」をクリックし、インストーラーを実行します。',
          'Excel や Word 起動後、同じアカウントでサインインされていることを確認してください。',
        ];
      case 'clip_studio':
        return [
          '下記の公式サイトまたは CLIP STUDIO ランチャーを起動し、記載の「クリスタアカウントID」でログインします。',
          '「CLIP STUDIO PAINT」を起動し、メニューの「ライセンス照合 / シリアルナンバー入力」を開きます。',
          '本メール記載の「シリアルコード（30桁 または アクティベーションコード）」を入力し、ライセンス認証を完了してください。',
          '※ 1ライセンスにつき許可された台数（原則：社内メイン機＋サブ機の計2台まで）を超えて認証しないようご注意ください。',
        ];
      case 'adobe_cc':
        return [
          '下記の「Adobe Creative Cloud ダウンロードページ」へアクセスし、Creative Cloud デスクトップアプリをインストールします。',
          '本メール記載の「Adobe ID（メールアドレス）」とパスワード（または社内 Google アカウント連携）でサインインします。',
          'アプリ一覧から「Photoshop」「After Effects」等の許可されたアプリケーションの「インストール」をクリックします。',
          '※ 退職・契約終了・端末変更時は必ず Creative Cloud から「ログアウト（ライセンス認証解除）」を行ってください。',
        ];
      case 'dcc_3d':
        return [
          '指定のインストーラーまたは製品ポータルからアプリケーションをPCへインストールします。',
          '初回起動時のライセンス認証画面にて、本メール記載の「アカウントID」または「シリアルコード / ライセンスキー」を入力します。',
          '正常にアクティベーションが完了し、制作プロジェクト用プラグインが読み込まれることを確認してください。',
        ];
      default:
        return [
          '指定のポータルURLまたは社内配布インストーラーからアプリケーションを導入してください。',
          '起動後の認証画面にて、本メール記載の「アカウント情報」および「シリアルコード」を入力して有効化してください。',
        ];
    }
  }

  /**
   * プレビュー表示およびリッチHTMLコピー用のメールボディHTMLを生成
   * （Tailwind Preflight の border-collapse: collapse 等の影響を受けない完全インラインスタイル）
   */
  buildHtmlEmailBody(lic: SoftwareLicense, opts: EmailBuildOptions): string {
    const esc = (str?: string) =>
      (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const categoryLabel = SOFTWARE_CATEGORY_LABELS[lic.category] || 'ソフトウェア';
    const steps = this.getActivationSteps(lic.category);
    const portalUrl = lic.portal_url || 'https://heron-dcd38.web.app';

    const displayPassword = lic.account_password
      ? opts.includePassword
        ? esc(lic.account_password)
        : '●●●●●●●● （※セキュリティ保護のため別チャット/口頭にて通知）'
      : '（設定なし / SSO認証）';

    const displaySerial = lic.serial_code
      ? opts.includeSerial
        ? esc(lic.serial_code)
        : 'XXXX-XXXX-XXXX-XXXX （※セキュリティ保護のため別送）'
      : '（アカウント紐付け型のためシリアル入力不要）';

    const customNoteHtml = opts.customMessage.trim()
      ? `
      <div style="margin-top: 20px; padding: 14px 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; text-align: left;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; margin-bottom: 4px;">■ 管理者からの補足・個別連絡事項</div>
        <div style="font-size: 13px; color: #78350f; line-height: 1.6; white-space: pre-wrap;">${esc(opts.customMessage)}</div>
      </div>`
      : '';

    const stepsHtml = steps
      .map(
        (s, i) => `
        <tr>
          <td style="vertical-align: top; padding: 6px 10px 6px 0; width: 28px; text-align: left;">
            <span style="display: inline-block; width: 20px; height: 20px; line-height: 20px; text-align: center; border-radius: 50%; background-color: #2A3A4A; color: #ffffff; font-size: 11px; font-weight: bold;">${i + 1}</span>
          </td>
          <td style="vertical-align: top; padding: 6px 0; font-size: 13px; color: #334155; line-height: 1.55; text-align: left;">
            ${esc(s)}
          </td>
        </tr>`
      )
      .join('');

    return `<div style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; text-align: left;">
  <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #f1f5f9; padding: 20px 12px;">
    <tr>
      <td align="center" style="text-align: center;">
        <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 640px; margin: 0 auto; border-collapse: separate; border-spacing: 0; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06); text-align: left;">
          
          <!-- ヘッダーバナー -->
          <tr>
            <td style="background-color: #2A3A4A; padding: 20px 24px; border-bottom: 3px solid #90CFD6; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: left; vertical-align: middle;">
                    <div style="font-size: 11px; color: #90CFD6; font-weight: bold; letter-spacing: 0.08em;">++ HERON SOFTWARE LICENSE PORTAL</div>
                    <div style="font-size: 17px; color: #ffffff; font-weight: bold; margin-top: 4px;">ソフトウェア・ライセンス割当のご案内</div>
                  </td>
                  <td align="right" style="text-align: right; vertical-align: middle; white-space: nowrap; padding-left: 8px;">
                    <span style="display: inline-block; background-color: rgba(144, 207, 214, 0.18); border: 1px solid #90CFD6; color: #90CFD6; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 999px;">
                      管理番号: ${esc(lic.management_code)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 本文エリア -->
          <tr>
            <td style="padding: 24px; text-align: left;">
              <!-- 宛名・挨拶 -->
              <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: bold; color: #0f172a;">
                ${esc(lic.assigned_department ? lic.assigned_department + ' ' : '')}${esc(opts.recipientName || 'ご担当者')} 様
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
                お疲れ様です。情報システム・機材管理担当（${esc(opts.senderName)}）です。<br />
                業務利用向けのソフトウェアライセンスおよびアカウントの紐付けが完了いたしましたので、下記の通りご案内いたします。内容をご確認の上、対象端末へのセットアップをお願いいたします。
              </p>

              <!-- 割当ソフトウェア概要カード -->
              <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9; text-align: left;">
                    <span style="display: inline-block; width: 4px; height: 12px; background-color: #2A3A4A; border-radius: 2px; vertical-align: -1px; margin-right: 6px;"></span>
                    <span style="font-size: 12px; font-weight: bold; color: #2A3A4A;">割当ソフトウェア情報</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; text-align: left;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; width: 130px; font-weight: bold; vertical-align: top; text-align: left;">ソフトウェア名</td>
                        <td style="padding: 5px 0; color: #0f172a; font-weight: bold; font-size: 14px; text-align: left;">${esc(lic.software_name)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; font-weight: bold; vertical-align: top; text-align: left;">カテゴリ / プラン</td>
                        <td style="padding: 5px 0; color: #334155; text-align: left;">${esc(categoryLabel)} ／ ${esc(lic.edition_plan)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; font-weight: bold; vertical-align: top; text-align: left;">割当対象端末</td>
                        <td style="padding: 5px 0; color: #334155; text-align: left;">${esc(lic.assigned_device || '指定業務用PC端末')}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; font-weight: bold; vertical-align: top; text-align: left;">割当日 / 有効期限</td>
                        <td style="padding: 5px 0; color: #334155; text-align: left;">${esc(lic.assigned_date || '本日')} 〜 ${esc(lic.expiration_date || '継続契約')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 認証・シリアルコード情報カード -->
              <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #bfdbfe; background-color: #dbeafe; text-align: left;">
                    <span style="display: inline-block; width: 4px; height: 12px; background-color: #1e3a8a; border-radius: 2px; vertical-align: -1px; margin-right: 6px;"></span>
                    <span style="font-size: 12px; font-weight: bold; color: #1e3a8a;">アカウント ＆ シリアルコード情報（社外秘・取扱注意）</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; text-align: left;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <tr>
                        <td style="padding: 6px 0; color: #1e40af; width: 130px; font-weight: bold; vertical-align: middle; text-align: left;">アカウントID</td>
                        <td style="padding: 6px 0; text-align: left;">
                          <code style="display: inline-block; background-color: #ffffff; padding: 4px 8px; border-radius: 4px; border: 1px solid #93c5fd; font-family: Consolas, Monaco, monospace; font-size: 13px; font-weight: bold; color: #0f172a;">${esc(lic.account_id || '（シリアルコード単体認証）')}</code>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #1e40af; font-weight: bold; vertical-align: middle; text-align: left;">初期パスワード</td>
                        <td style="padding: 6px 0; text-align: left;">
                          <code style="display: inline-block; background-color: #ffffff; padding: 4px 8px; border-radius: 4px; border: 1px solid #93c5fd; font-family: Consolas, Monaco, monospace; font-size: 13px; color: #0f172a;">${displayPassword}</code>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #1e40af; font-weight: bold; vertical-align: middle; text-align: left;">シリアルコード</td>
                        <td style="padding: 6px 0; text-align: left;">
                          <code style="display: inline-block; background-color: #ffffff; padding: 6px 10px; border-radius: 4px; border: 1px solid #93c5fd; font-family: Consolas, Monaco, monospace; font-size: 13px; font-weight: bold; color: #b91c1c; letter-spacing: 0.04em; word-break: break-all;">${displaySerial}</code>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #1e40af; font-weight: bold; vertical-align: middle; text-align: left;">ポータル / DL先</td>
                        <td style="padding: 6px 0; text-align: left;">
                          <a href="${esc(portalUrl)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: bold; text-decoration: underline; word-break: break-all;">${esc(portalUrl)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${customNoteHtml}

              <!-- セットアップ・利用開始手順 -->
              <div style="margin-top: 22px; text-align: left;">
                <div style="font-size: 13px; font-weight: bold; color: #2A3A4A; border-bottom: 2px solid #2A3A4A; padding-bottom: 6px; margin-bottom: 12px;">
                  インストール・ライセンス認証手順
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                  ${stepsHtml}
                </table>
              </div>

              <!-- 注意事項 -->
              <div style="margin-top: 24px; padding: 14px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11.5px; color: #64748b; line-height: 1.65; text-align: left;">
                <strong style="color: #334155;">【ライセンス利用上の遵守事項】</strong><br />
                ・本ライセンスおよびシリアルコードは、割当を受けたご本人および指定端末でのみご使用ください。<br />
                ・個人所有PCへの無断導入は禁止されています（私物端末で利用する場合は事前に「BYOD申請」の決裁が必要です）。<br />
                ・端末の入れ替えやプロジェクト異動・退職等で利用を終了する際は、必ずライセンス認証を解除の上、管理担当までご連絡ください。
              </div>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b;">
              株式会社亜細亜堂 ／ HERON 社内機材・ライセンス統合管理システム<br />
              ご不明な点がございましたら、総務部・情報システム担当までお問い合わせください。
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
  }

  /**
   * 送信前確認（HTMLソース表示・ファイル保存）および送信用の完全な HTML ドキュメント文字列を生成
   */
  buildHtmlEmail(lic: SoftwareLicense, opts: EmailBuildOptions): string {
    const esc = (str?: string) =>
      (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(opts.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
${this.buildHtmlEmailBody(lic, opts)}
</body>
</html>`;
  }

  /**
   * プレーンテキスト版メール本文を生成（メーラー起動やテキストコピー用）
   */
  buildPlainTextEmail(lic: SoftwareLicense, opts: EmailBuildOptions): string {
    const steps = this.getActivationSteps(lic.category);
    const pw = lic.account_password
      ? opts.includePassword
        ? lic.account_password
        : '●●●●●●●●（※別送）'
      : '（設定なし）';
    const serial = lic.serial_code
      ? opts.includeSerial
        ? lic.serial_code
        : 'XXXX-XXXX-XXXX-XXXX（※別送）'
      : '（アカウント認証型）';

    return `${lic.assigned_department ? lic.assigned_department + ' ' : ''}${opts.recipientName || 'ご担当者'} 様

お疲れ様です。情報システム・機材管理担当（${opts.senderName}）です。
業務利用向けのソフトウェアライセンスおよびアカウントの割当が完了いたしましたのでご案内いたします。

■ 割当ソフトウェア情報
・管理番号　　　: ${lic.management_code}
・ソフトウェア名: ${lic.software_name} (${lic.edition_plan})
・割当対象端末　: ${lic.assigned_device || '指定業務用PC端末'}
・有効期限　　　: ${lic.expiration_date || '継続契約'}

■ アカウント ＆ シリアルコード情報（社外秘）
・アカウントID　: ${lic.account_id || '（なし）'}
・初期パスワード: ${pw}
・シリアルコード: ${serial}
・ポータルURL 　: ${lic.portal_url || 'https://heron-dcd38.web.app'}
${opts.customMessage.trim() ? `\n■ 管理者からの補足連絡\n${opts.customMessage.trim()}\n` : ''}
■ セットアップ手順
${steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

--------------------------------------------------
株式会社亜細亜堂 ／ HERON 社内機材・ライセンス統合管理システム`;
  }

  private createSampleLicenses(): SoftwareLicense[] {
    return [
      {
        id: 'LIC-2026001',
        management_code: 'LIC-MS-001',
        category: 'microsoft_office',
        software_name: 'Microsoft 365 Business Standard',
        vendor: 'Microsoft',
        edition_plan: '法人年額プラン (Word / Excel / PowerPoint / Teams)',
        auth_type: 'account_only',
        account_id: 'sakurai@ajiado.co.jp',
        account_password: 'Ms365#Ajiado2026',
        serial_code: 'M365-BSTD-9920-AJIADO-01',
        contract_no: 'MS-ENT-2026-088',
        portal_url: 'https://portal.office.com',
        max_devices: 5,
        status: 'assigned',
        assigned_user_name: '桜井 裕介',
        assigned_user_email: 'sakurai@ajiado.co.jp',
        assigned_department: '制作部',
        assigned_role: '制作進行',
        assigned_device: 'DEV-PC-00004 (制作部 ノートPC #04)',
        assigned_date: '2026-04-01',
        expiration_date: '2027-03-31',
        cost_memo: '月額 1,874円 / 年額契約',
        note: '第7話制作進行管理・香盤表およびカット袋集計Excel用。スマホTeams併用。',
        updated_at: '2026/10/01 10:00',
        last_mail_sent_at: '2026/04/01 11:20',
        mail_history: [
          {
            id: 'MAIL-1001',
            sent_at: '2026/04/01 11:20',
            sent_by: '井上 健二',
            recipient_name: '桜井 裕介',
            recipient_email: 'sakurai@ajiado.co.jp',
            subject: '【HERON】Microsoft 365 Business Standard ライセンス割当のご案内',
            included_credentials: true,
          },
        ],
      },
      {
        id: 'LIC-2026002',
        management_code: 'LIC-CSP-001',
        category: 'clip_studio',
        software_name: 'CLIP STUDIO PAINT EX',
        vendor: 'CELSYS (セルシス)',
        edition_plan: '法人ボリュームライセンス (2デバイスプラン Ver.3.0)',
        auth_type: 'serial_and_account',
        account_id: 'csp-anim01@ajiado.co.jp',
        account_password: 'CspEx!2026Anim',
        serial_code: 'SP30EJJ-N8K4M2-7P9X3W-R5T2Q8-L4H6',
        contract_no: 'CEL-VL-2026-014',
        portal_url: 'https://accounts.clip-studio.com',
        max_devices: 2,
        status: 'assigned',
        assigned_user_name: '佐々木 葵',
        assigned_user_email: 'sasaki@ajiado.co.jp',
        assigned_department: '作画部',
        assigned_role: 'デジタル原画',
        assigned_device: 'DEV-TAB-00001 (第1作画室 Wacom Cintiq Pro 24)',
        assigned_date: '2026-05-10',
        expiration_date: '2027-05-09',
        cost_memo: '年額 10,500円',
        note: '社内メイン作画PC 1台 ＋ 自宅作業用iPad Pro (BYOD承認済) の計2台でアクティベーション済。',
        updated_at: '2026/10/05 14:30',
        last_mail_sent_at: '2026/05/10 15:00',
        mail_history: [
          {
            id: 'MAIL-1002',
            sent_at: '2026/05/10 15:00',
            sent_by: '井上 健二',
            recipient_name: '佐々木 葵',
            recipient_email: 'sasaki@ajiado.co.jp',
            subject: '【HERON】CLIP STUDIO PAINT EX シリアルコード・アカウント割当のご案内',
            included_credentials: true,
          },
        ],
      },
      {
        id: 'LIC-2026003',
        management_code: 'LIC-ADB-001',
        category: 'adobe_cc',
        software_name: 'Adobe Creative Cloud コンプリートプラン',
        vendor: 'Adobe',
        edition_plan: 'グループ版 (Photoshop / After Effects / Premiere / Illustrator)',
        auth_type: 'account_only',
        account_id: 'watanabe@ajiado.co.jp',
        account_password: 'AdobeCC#2026Studio',
        serial_code: 'ADOBE-VIP-84920-CCALL-01',
        contract_no: 'VIP-99402184A',
        portal_url: 'https://creativecloud.adobe.com',
        max_devices: 2,
        status: 'assigned',
        assigned_user_name: '渡辺 美香',
        assigned_user_email: 'watanabe@ajiado.co.jp',
        assigned_department: 'CG・撮影部',
        assigned_role: '撮影・コンポジット',
        assigned_device: 'DEV-PC-00002 (CG・撮影室 ワークステーション)',
        assigned_date: '2026-06-01',
        expiration_date: '2027-05-31',
        cost_memo: '月額 10,780円 (グループ版)',
        note: 'After Effects 2025 / Photoshop 2025 メイン利用。管理コンソールから招待・割当済。',
        updated_at: '2026/10/07 16:00',
        mail_history: [],
      },
      {
        id: 'LIC-2026004',
        management_code: 'LIC-ADB-002',
        category: 'adobe_cc',
        software_name: 'Adobe Photoshop CC (単体プラン)',
        vendor: 'Adobe',
        edition_plan: 'グループ版 単体サブスクリプション',
        auth_type: 'account_only',
        account_id: 'takahashi@ajiado.co.jp',
        account_password: 'PsCC#2026Art',
        serial_code: 'ADOBE-VIP-84920-PS-02',
        contract_no: 'VIP-99402184A',
        portal_url: 'https://creativecloud.adobe.com',
        max_devices: 2,
        status: 'assigned',
        assigned_user_name: '高橋 俊樹',
        assigned_user_email: 'takahashi@ajiado.co.jp',
        assigned_department: '演出部',
        assigned_role: '演出・助監督',
        assigned_device: 'DEV-PC-00007 (演出部 MacBook Pro 16)',
        assigned_date: '2026-07-15',
        expiration_date: '2027-05-31',
        cost_memo: '月額 4,180円',
        note: '美術ボードレタッチ・色彩設計チェックおよびコンテ撮素材加工用。',
        updated_at: '2026/10/08 11:00',
        mail_history: [],
      },
      {
        id: 'LIC-2026005',
        management_code: 'LIC-CSP-002',
        category: 'clip_studio',
        software_name: 'CLIP STUDIO PAINT EX',
        vendor: 'CELSYS (セルシス)',
        edition_plan: '法人ボリュームライセンス (2デバイスプラン Ver.3.0)',
        auth_type: 'serial_and_account',
        account_id: 'csp-anim02@ajiado.co.jp',
        account_password: 'CspEx!2026Reserve',
        serial_code: 'SP30EJJ-A9D2F4-6G8H1J-K3L5M7-N9P2',
        contract_no: 'CEL-VL-2026-014',
        portal_url: 'https://accounts.clip-studio.com',
        max_devices: 2,
        status: 'available',
        assigned_user_name: '',
        assigned_user_email: '',
        assigned_department: '',
        assigned_role: '',
        assigned_device: '',
        assigned_date: '',
        expiration_date: '2027-05-09',
        cost_memo: '年額 10,500円',
        note: '新規参加アニメーター・デジタル作画スタッフ割当用の空きライセンス在庫。',
        updated_at: '2026/10/10 09:30',
        mail_history: [],
      },
      {
        id: 'LIC-2026006',
        management_code: 'LIC-MS-002',
        category: 'microsoft_office',
        software_name: 'Microsoft Office Home & Business 2024',
        vendor: 'Microsoft',
        edition_plan: '永続ライセンス (2台まで)',
        auth_type: 'serial_and_account',
        account_id: 'office-admin02@ajiado.co.jp',
        account_password: 'Off2024#Setup',
        serial_code: 'YTMG3-N6DKC-DKB77-7M9GH-8HVX7',
        contract_no: 'MS-OEM-2026-12',
        portal_url: 'https://setup.office.com',
        max_devices: 2,
        status: 'assigned',
        assigned_user_name: '佐藤 健太',
        assigned_user_email: 'sato@ajiado.co.jp',
        assigned_department: 'クリエイティブ開発課',
        assigned_role: 'UIデザイナー・設定管理',
        assigned_device: 'DEV-PC-00009 (開発室 デスクトップPC)',
        assigned_date: '2026-08-01',
        expiration_date: '永続 (無期限)',
        cost_memo: '買い切り 39,980円',
        note: '機材同梱ではなくリテール永続版のため別端末への移管可能。',
        updated_at: '2026/10/12 13:15',
        mail_history: [],
      },
      {
        id: 'LIC-2026007',
        management_code: 'LIC-DCC-001',
        category: 'dcc_3d',
        software_name: 'Toon Boom Storyboard Pro 24',
        vendor: 'Toon Boom Animation',
        edition_plan: 'サブスクリプション (デジタル絵コンテ・Vコン制作)',
        auth_type: 'serial_and_account',
        account_id: 'nakamura@ajiado.co.jp',
        account_password: 'TbSbp24#Ajiado',
        serial_code: 'TB-SBP24-7741-9902-ABCD-EF01',
        contract_no: 'TB-JP-2026-005',
        portal_url: 'https://store.toonboom.com',
        max_devices: 1,
        status: 'assigned',
        assigned_user_name: '中村 健一郎',
        assigned_user_email: 'nakamura@ajiado.co.jp',
        assigned_department: '演出部',
        assigned_role: '助監督・絵コンテ',
        assigned_device: 'BYOD-20260915-03 (MacBook Pro 16 M3 Max)',
        assigned_date: '2026-09-16',
        expiration_date: '2027-09-15',
        cost_memo: '年額 98,000円',
        note: '劇場版ビデオコンテ（Vコン）作成用。BYOD承認済端末に導入。',
        updated_at: '2026/10/15 17:45',
        mail_history: [],
      },
      {
        id: 'LIC-2026008',
        management_code: 'LIC-SEC-001',
        category: 'security_utility',
        software_name: 'ESET PROTECT Entry (Endpoint Security)',
        vendor: 'ESET / キヤノンITソリューションズ',
        edition_plan: '法人向けボリュームライセンス (Mac / Windows 対応)',
        auth_type: 'serial_only',
        account_id: 'セキュリティ管理コンソール一括管理',
        account_password: '',
        serial_code: 'EAV-0394819204 / PLK: 3A4-99B-81C-20F-77D',
        contract_no: 'CITS-ESET-2026-50',
        portal_url: 'https://eset-info.canon-its.jp',
        max_devices: 50,
        status: 'assigned',
        assigned_user_name: '木村 拓也',
        assigned_user_email: 'kimura@ajiado.co.jp',
        assigned_department: '作画部',
        assigned_role: '原画マン',
        assigned_device: 'BYOD-20261008-01 (Mac Studio M2 Max)',
        assigned_date: '2026-10-08',
        expiration_date: '2027-03-31',
        cost_memo: '法人一括契約 (50シート)',
        note: '社内接続端末およびBYOD許可端末向けのウイルス対策・EDRライセンス。',
        updated_at: '2026/10/18 10:20',
        mail_history: [],
      },
    ];
  }
}
