import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-byod-spec',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      <!-- ドキュメントヘッダー -->
      <div class="border-b border-slate-200 pb-6 bg-white p-6 rounded-2xl border shadow-xs">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <app-icon name="box" class="text-xl" />
          </div>
          <div>
            <span class="text-xs font-bold text-blue-700 uppercase tracking-widest">HERON Security Documentation</span>
            <h1 class="text-2xl font-bold text-slate-900">BYOD（私物情報端末等）利用申請 運用仕様書</h1>
          </div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed mt-2">
          株式会社亜細亜堂における私物情報端末（PC・タブレット）および外部記録媒体（USB・外付けSSD等）の社内接続・業務利用に関するセキュリティ基準および申請・承認ワークフローの技術仕様書です。
        </p>
      </div>

      <!-- 目次ナビゲーション -->
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs space-y-2">
        <div class="font-bold text-slate-700 uppercase tracking-wider mb-2">目次 (Table of Contents)</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-blue-700 font-medium">
          <a href="#section-1" class="hover:underline flex items-center gap-1.5"><span>1. 制定目的 ＆ シャドーIT対策</span></a>
          <a href="#section-2" class="hover:underline flex items-center gap-1.5"><span>2. 2種類の自動生成書類と構成</span></a>
          <a href="#section-3" class="hover:underline flex items-center gap-1.5"><span>3. 3段階 審査・決裁フロー</span></a>
          <a href="#section-4" class="hover:underline flex items-center gap-1.5"><span>4. 必須セキュリティ要件 (BitLocker / FileVault等)</span></a>
          <a href="#section-5" class="hover:underline flex items-center gap-1.5"><span>5. 管理ステッカー交付 ＆ 有効期限管理</span></a>
        </div>
      </div>

      <!-- Section 1 -->
      <section id="section-1" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-700 rounded-full"></span>
          <span>1. 制定目的 ＆ シャドーIT対策</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            アニメ制作現場では、クリエイター特有の作業環境へのこだわりや、自宅・スタジオ間のシームレスな作業のため、個人所有のPCやiPad、外付けSSDの持ち込みニーズが存在します。一方で、未登録端末の社内LAN接続や機密データの無断持ち出し（シャドーIT）は深刻な情報漏洩リスクとなります。
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div class="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl">
              <div class="font-bold text-blue-900 mb-1">公式申請プロセスの確立</div>
              <div class="text-[11px] text-slate-600">無断持ち込みを全面禁止し、必要な端末を正当な手続きで審査・許可する制度化。</div>
            </div>
            <div class="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <div class="font-bold text-emerald-900 mb-1">セキュリティ水準の担保</div>
              <div class="text-[11px] text-slate-600">ストレージ暗号化、自動画面ロック、ウイルス対策ソフトの導入を必須要件化。</div>
            </div>
            <div class="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
              <div class="font-bold text-indigo-900 mb-1">現品識別・ステッカー管理</div>
              <div class="text-[11px] text-slate-600">決裁済みのUSBストレージ等に「管理登録ステッカー」を貼付し、現場目視点検を可能に。</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2 -->
      <section id="section-2" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-700 rounded-full"></span>
          <span>2. 2種類の自動生成書類と構成</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            申請者がフォームに必要事項を入力するだけで、以下の2枚の公式書類（A4書式）が完全自動生成されます。
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5">
              <div class="font-bold text-slate-900 flex items-center gap-1.5">
                <span>📄</span>
                <span>【書類1】私物情報端末等 利用申請書 兼 誓約書</span>
              </div>
              <ul class="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>申請者情報（所属・氏名・雇用区分・スタッフ番号・連絡先）</li>
                <li>申請機材サマリー（PC・タブレット・外部媒体の台数内訳）</li>
                <li><strong>私物情報端末等 利用誓約条項（第1条〜第8条）</strong></li>
                <li>誓約・署名欄（誓約日・自署・デジタル印影）</li>
                <li>会社総合承認欄（所属長承認印・セキュリティ責任者承認印）</li>
              </ul>
            </div>

            <div class="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5">
              <div class="font-bold text-slate-900 flex items-center gap-1.5">
                <span>💻</span>
                <span>【書類2】申請対象端末・外部記録媒体 明細書</span>
              </div>
              <ul class="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>機材カード（メーカー・型番・シリアル・OS・MACアドレス）</li>
                <li>暗号化設定（BitLocker/FileVault/iOS等）・セキュリティソフト名</li>
                <li>業務上の利用理由</li>
                <li>外部記録媒体一括記載欄（USB/SSD/HDD、容量、暗号化有無）</li>
                <li>管理部門確認欄（暗号化目視確認・ステッカー番号・管理印）</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3 -->
      <section id="section-3" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-700 rounded-full"></span>
          <span>3. 3段階 審査・決裁フロー</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <div class="border border-slate-200 rounded-xl overflow-hidden font-mono text-[11px]">
            <table class="w-full text-left">
              <thead class="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th class="p-2.5">ステップ</th>
                  <th class="p-2.5">担当者</th>
                  <th class="p-2.5">処理内容</th>
                  <th class="p-2.5">ステータス</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr>
                  <td class="p-2.5 font-bold">① 申請者提出・誓約</td>
                  <td class="p-2.5">本人（スタッフ・アニメーター）</td>
                  <td class="p-2.5">端末スペック・理由入力、誓約条項同意</td>
                  <td class="p-2.5 text-amber-700 font-bold">submitted</td>
                </tr>
                <tr>
                  <td class="p-2.5 font-bold">② 所属長審査・承認</td>
                  <td class="p-2.5">プロデューサー / 部長</td>
                  <td class="p-2.5">業務上の持込必要性の精査、承認印押印</td>
                  <td class="p-2.5 text-blue-700 font-bold">manager_approved</td>
                </tr>
                <tr>
                  <td class="p-2.5 font-bold">③ セキュリティ責任者決裁</td>
                  <td class="p-2.5">情報セキュリティ責任者</td>
                  <td class="p-2.5">暗号化・セキュリティ確認、ステッカー交付・有効期限設定</td>
                  <td class="p-2.5 text-emerald-700 font-bold">security_approved</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section 4 -->
      <section id="section-4" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-700 rounded-full"></span>
          <span>4. 必須セキュリティ要件</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-2 text-slate-600">
          <ul class="list-disc list-inside space-y-1.5">
            <li><strong>ストレージ全体暗号化の義務:</strong> WindowsはBitLocker、MacはFileVault、iPadはパスコード保護が有効化されていること。</li>
            <li><strong>自動画面ロック:</strong> 離席時の盗撮・不正操作を防ぐため、10分以内の自動ロックを設定すること。</li>
            <li><strong>セキュリティ対策ソフト:</strong> 定義ファイルが常に自動更新される信頼できるウイルス対策ソフトが稼働していること。</li>
            <li><strong>シャドーITの禁止:</strong> 登録されていない私物スマートフォンや未承認USBメモリの社内ネットワーク接続・業務データ保存は厳禁。</li>
          </ul>
        </div>
      </section>

      <!-- Section 5 -->
      <section id="section-5" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-700 rounded-full"></span>
          <span>5. 管理ステッカー交付 ＆ 有効期限管理</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-2 text-slate-600">
          <p>
            情報セキュリティ責任者の決裁が完了すると、端末および外部記録媒体ごとに<strong>【STK-YYYY-XXX】</strong>の管理ステッカー番号が自動採番・交付されます。
          </p>
          <p>
            利用承認の有効期限は<strong>最長1年間（毎年度末更新）</strong>とし、機材の変更や買い替え、退職時は速やかに登録解除および業務データの完全消去を行います。
          </p>
        </div>
      </section>
    </div>
  `,
})
export class ByodSpecComponent {}
