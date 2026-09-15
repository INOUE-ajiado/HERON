import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-approval-spec',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      <!-- ドキュメントヘッダー -->
      <div class="border-b border-slate-200 pb-6 bg-white p-6 rounded-2xl border shadow-xs">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <app-icon name="doc" class="text-xl" />
          </div>
          <div>
            <span class="text-xs font-bold text-blue-600 uppercase tracking-widest">HERON System Documentation</span>
            <h1 class="text-2xl font-bold text-slate-900">機材・ツール購入 稟議システム 仕様書</h1>
          </div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed mt-2">
          HERONシステム内に構築されたデジタル稟議申請・4段階承認ワークフローおよび印影管理機能に関する詳細な技術仕様書です。
        </p>
      </div>

      <!-- 目次ナビゲーション -->
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs space-y-2">
        <div class="font-bold text-slate-700 uppercase tracking-wider mb-2">目次 (Table of Contents)</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-blue-600 font-medium">
          <a href="#section-1" class="hover:underline flex items-center gap-1.5"><span>1. システム概要・目的</span></a>
          <a href="#section-2" class="hover:underline flex items-center gap-1.5"><span>2. 承認ワークフロー仕様</span></a>
          <a href="#section-3" class="hover:underline flex items-center gap-1.5"><span>3. 入力・申請フォーム仕様</span></a>
          <a href="#section-4" class="hover:underline flex items-center gap-1.5"><span>4. 出力・認印スタンプ仕様</span></a>
          <a href="#section-5" class="hover:underline flex items-center gap-1.5"><span>5. UI/UXデザイン仕様</span></a>
          <a href="#section-6" class="hover:underline flex items-center gap-1.5"><span>6. データモデル・構造</span></a>
        </div>
      </div>

      <!-- Section 1: システム概要 -->
      <section id="section-1" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          <span>1. システム概要・目的</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            本システムは、HERON（社内機材管理システム）内において機材の新規購入、ライセンスツールの導入、既存契約の解約・見直し等を行うためのデジタル稟議決裁プラットフォームです。
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div class="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl">
              <div class="font-bold text-blue-900 mb-1">ペーパーレス化</div>
              <div class="text-[11px] text-slate-600">従来の紙での押印申請を全自動デジタル化し、認印スタンプをリアルタイム生成。</div>
            </div>
            <div class="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <div class="font-bold text-emerald-900 mb-1">承認可視化</div>
              <div class="text-[11px] text-slate-600">水平プログレスステッパーにより、現在の審議状況と担当者を一目で識別。</div>
            </div>
            <div class="p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl">
              <div class="font-bold text-purple-900 mb-1">ユーザー連携</div>
              <div class="text-[11px] text-slate-600">ログイン中ユーザー情報を自動判定・反映し、起案者の入力コストを削減。</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: 承認ワークフロー仕様 -->
      <section id="section-2" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          <span>2. 4段階承認ワークフロー仕様</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>稟議申請は以下の固定4段階ステップを順次通過することで最終決裁（代表承認）完了となります。</p>
          
          <div class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
            <div class="p-3.5 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="font-bold text-slate-800">① 申請者提出 (Submitted)</div>
              <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">起案完了</span>
            </div>
            <div class="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="font-bold text-slate-800">② プロデューサー承認 (Producer Approved)</div>
              <span class="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">一次承認</span>
            </div>
            <div class="p-3.5 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="font-bold text-slate-800">③ DXチーム確認 (DX Confirmed)</div>
              <span class="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">技術・運用レビュー</span>
            </div>
            <div class="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="font-bold text-slate-800">④ 代表承認 (President Approved / 決済完了)</div>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">最終決済完了</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: 入力・申請フォーム仕様 -->
      <section id="section-3" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          <span>3. 入力・申請フォーム仕様</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <table class="w-full border-collapse border border-slate-200 text-left">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold">
                <th class="border border-slate-200 p-2.5 w-32">項目名</th>
                <th class="border border-slate-200 p-2.5 w-24">入力形式</th>
                <th class="border border-slate-200 p-2.5">仕様・補足説明</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr>
                <td class="border border-slate-200 p-2.5 font-bold">起案者名</td>
                <td class="border border-slate-200 p-2.5">自動補完</td>
                <td class="border border-slate-200 p-2.5">ログインユーザー（<code class="bg-slate-100 px-1 py-0.5 rounded text-blue-700">AuthService.user()</code>）の氏名を自動設定（読み取り専用）。</td>
              </tr>
              <tr>
                <td class="border border-slate-200 p-2.5 font-bold">決済希望日 *</td>
                <td class="border border-slate-200 p-2.5">カレンダー</td>
                <td class="border border-slate-200 p-2.5"><code class="bg-slate-100 px-1 py-0.5 rounded text-blue-700">&lt;input type="date"&gt;</code> による直感的な日付選択。デフォルト値は本日+7日。</td>
              </tr>
              <tr>
                <td class="border border-slate-200 p-2.5 font-bold">使用者・対象者</td>
                <td class="border border-slate-200 p-2.5">テキスト</td>
                <td class="border border-slate-200 p-2.5">「このアイテム/ツールは誰が必要としているのか」を明確化する登録項目（全体・品目個別ともに設定可能）。</td>
              </tr>
              <tr>
                <td class="border border-slate-200 p-2.5 font-bold">購入先URL</td>
                <td class="border border-slate-200 p-2.5">URLテキスト</td>
                <td class="border border-slate-200 p-2.5">Amazon等の販売ページリンクを入力・プレビュー表示に対応。</td>
              </tr>
              <tr>
                <td class="border border-slate-200 p-2.5 font-bold">稟議画像URL</td>
                <td class="border border-slate-200 p-2.5">URLテキスト</td>
                <td class="border border-slate-200 p-2.5">参考画像の直リンクを入力することで、稟議書内に埋め込み表示。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Section 4: 出力・認印スタンプ仕様 -->
      <section id="section-4" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          <span>4. 出力・認印スタンプ（印影）仕様</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            承認ステップが完了すると、稟議書プレビュー内の該当役職枠（代表、DXチーム、プロデューサー、提出者）へ自動的に赤い丸型の電子認印が描画されます。
          </p>
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div class="font-bold text-slate-800">印影の構成ルール:</div>
            <ul class="list-disc pl-5 space-y-1 text-slate-600">
              <li><strong>枠線</strong>: 赤色（<code class="bg-slate-100 px-1 py-0.5 rounded text-rose-600">border-rose-600</code>）の丸型二重丸（円形）。</li>
              <li><strong>印字内容</strong>: 上段に承認者苗字（例: 山田 / 井上）、下段に承認日付（例: 3/13）。</li>
              <li><strong>自動整列</strong>: 各印影ブロックの幅を74pxに設定し、<code class="bg-slate-100 px-1 py-0.5 rounded">whitespace-nowrap</code> により文字溢れ・縦崩れを防止。</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Section 5: UI/UXデザイン仕様 -->
      <section id="section-5" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          <span>5. UI/UXデザイン仕様</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="font-bold text-slate-800 mb-1">真のエッジ・トゥ・エッジ</div>
              <div class="text-slate-600 text-[11px]">ネガティブマージンにより画面全幅を活用し、余計な空隙を削除。</div>
            </div>
            <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="font-bold text-slate-800 mb-1">水平ステッパー (Pattern 01)</div>
              <div class="text-slate-600 text-[11px]">UIカタログ標準の横型プログレスバーによる直感的なステップ表現。</div>
            </div>
            <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="font-bold text-slate-800 mb-1">優先度ソート</div>
              <div class="text-slate-600 text-[11px]">進行中の案件を上部に集約し、完了案件はブランク色で下部に配置。</div>
            </div>
            <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="font-bold text-slate-800 mb-1">常時最下部固定サイドバー</div>
              <div class="text-slate-600 text-[11px]">スクロール位置に関わらず、サイドバー下部のリンク・情報が常時表示。</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 6: データモデル構造 -->
      <section id="section-6" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          <span>6. データモデル定義 (ApprovalRequest & PurchaseItem)</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed">
          <pre class="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto font-mono text-[11px] leading-normal"><code>export interface PurchaseItem &#123;
  name: string;                  // 商品名・品目名
  price: number;                 // 単価 (円)
  quantity: number;              // 数量
  purchase_url?: string;         // 購入先URL
  image_url?: string;            // 商品画像URL
  target_user?: string;          // 使用者・対象者 (誰が必要としているか)
&#125;

export interface ApprovalRequest &#123;
  id: string;                    // 識別ID (例: APR-20260313)
  title: string;                 // 件名
  applicant_name: string;        // 起案者氏名
  applicant_department: string;  // 所属部門
  created_at: string;            // 起案日 (YYYY/MM/DD)
  desired_date: string;          // 決済希望日 (YYYY-MM-DD)
  target_user?: string;          // 主な使用者・利用対象者
  new_item_name: string;         // 【新規導入】
  items?: PurchaseItem[];        // 【新規導入・購入品目明細】
  cancel_item_name: string;      // 【契約終了】
  usage_purpose: string;         // 【主な用途】
  reason_detail: string;         // 申請理由・目的
  purchase_url?: string;         // 購入先ページリンク
  image_url?: string;            // 稟議画像リンク
  attachment_note?: string;      // 添付資料・備考
  estimated_amount?: string;     // 概算金額
  status: ApprovalStatus;        // ステータス型
  timeline: TimelineStep[];      // ステッパー用履歴
  stamps: StampInfo[];           // 認印用配列
&#125;</code></pre>
        </div>
      </section>

      <footer class="pt-4 text-center text-slate-400 text-xs border-t border-slate-200">
        © 2026 HERON Approval Specification Guide
      </footer>
    </div>
  `,
})
export class ApprovalSpecComponent {}
