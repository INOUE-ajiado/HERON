import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-work-request-spec',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      <!-- ドキュメントヘッダー -->
      <div class="border-b border-slate-200 pb-6 bg-white p-6 rounded-2xl border shadow-xs">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <app-icon name="clock" class="text-xl" />
          </div>
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-widest">HERON System Documentation</span>
            <h1 class="text-2xl font-bold text-slate-900">アニメ制作 業務申請（休日出勤・休暇・残業）仕様書</h1>
          </div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed mt-2">
          アニメーション制作現場における「休日出勤申請」「休暇申請」「残業申請」の申請・上長許諾ワークフロー、および総務部（勤怠管理）への自動連携に関する技術仕様書です。
        </p>
      </div>

      <!-- 目次ナビゲーション -->
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs space-y-2">
        <div class="font-bold text-slate-700 uppercase tracking-wider mb-2">目次 (Table of Contents)</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-indigo-600 font-medium">
          <a href="#section-1" class="hover:underline flex items-center gap-1.5"><span>1. システム概要・アニメ現場向け背景</span></a>
          <a href="#section-2" class="hover:underline flex items-center gap-1.5"><span>2. 3段階 承認・勤怠連携ワークフロー</span></a>
          <a href="#section-3" class="hover:underline flex items-center gap-1.5"><span>3. 申請種別と入力項目仕様</span></a>
          <a href="#section-4" class="hover:underline flex items-center gap-1.5"><span>4. 上長許諾 ＆ 総務部勤怠連携メカニズム</span></a>
          <a href="#section-5" class="hover:underline flex items-center gap-1.5"><span>5. デジタル認印・出力仕様 (PDF/印刷)</span></a>
          <a href="#section-6" class="hover:underline flex items-center gap-1.5"><span>6. データモデル・アーキテクチャ</span></a>
        </div>
      </div>

      <!-- Section 1: システム概要 -->
      <section id="section-1" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
          <span>1. システム概要・アニメ現場向け背景</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            アニメーション制作現場（スタジオ）では、各話数の作画出し・動検・仕上・背景・撮影・カッティング・納品といった厳密な進行スケジュールが存在し、放送・配信・劇場公開のデッドラインに合わせて急遽の休日出勤や深夜残業、あるいは工程アップ後のまとまった代休取得が頻繁に発生します。
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div class="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl">
              <div class="font-bold text-amber-900 mb-1">🌅 休日出勤申請</div>
              <div class="text-[11px] text-slate-600">土日・祝日の出勤予定と、振替休日（代休）の指定を一元管理。カッティング出し等の特出し作業に対応。</div>
            </div>
            <div class="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <div class="font-bold text-emerald-900 mb-1">🌴 休暇申請</div>
              <div class="text-[11px] text-slate-600">有給休暇、代休取得、午前・午後の半休に対応。原画アップ後や話数納品後のリフレッシュを円滑化。</div>
            </div>
            <div class="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
              <div class="font-bold text-indigo-900 mb-1">⏱️ 残業申請</div>
              <div class="text-[11px] text-slate-600">所定時間外および22:00以降の深夜残業の事前申請。36協定順守とスタッフの健康管理を両立。</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: ワークフロー仕様 -->
      <section id="section-2" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
          <span>2. 3段階 承認・勤怠連携ワークフロー</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            業務申請は、アニメ制作の現場実務に即した「3段階順次ワークフロー」で処理されます。
          </p>

          <!-- ワークフローステップ図 -->
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-mono text-[11px]">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div class="p-2.5 bg-white border border-slate-300 rounded-lg shadow-2xs flex-1">
                <div class="font-bold text-slate-800">① 申請者提出 (submitted)</div>
                <div class="text-[10px] text-slate-500 font-sans mt-0.5">制作進行・アニメーター・演出による起案・提出者認印押印</div>
              </div>
              <span class="text-slate-400 font-bold self-center">➔</span>
              <div class="p-2.5 bg-indigo-50 border border-indigo-300 rounded-lg shadow-2xs flex-1">
                <div class="font-bold text-indigo-900">② 上長確認・許諾 (manager_approved)</div>
                <div class="text-[10px] text-indigo-700 font-sans mt-0.5">制作デスク／プロデューサー／部門リーダーによる内容審査・許諾</div>
              </div>
              <span class="text-slate-400 font-bold self-center">➔</span>
              <div class="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg shadow-2xs flex-1">
                <div class="font-bold text-emerald-900">③ 総務受領・勤怠反映 (admin_confirmed)</div>
                <div class="text-[10px] text-emerald-700 font-sans mt-0.5">総務部労務担当によるタイムカード・36協定・代休台帳への反映</div>
              </div>
            </div>
          </div>

          <div class="border border-slate-200 rounded-xl overflow-hidden mt-2">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th class="p-2.5">ステータス</th>
                  <th class="p-2.5">表示名</th>
                  <th class="p-2.5">申請内容の編集権限</th>
                  <th class="p-2.5">押印状態</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr>
                  <td class="p-2.5 font-mono font-bold text-amber-700">submitted</td>
                  <td class="p-2.5">① 申請中 (上長確認待ち)</td>
                  <td class="p-2.5 text-emerald-600 font-bold">可能 (申請内容を編集可)</td>
                  <td class="p-2.5">提出者印のみ</td>
                </tr>
                <tr>
                  <td class="p-2.5 font-mono font-bold text-blue-700">manager_approved</td>
                  <td class="p-2.5">② 上長許諾済 (総務勤怠連携中)</td>
                  <td class="p-2.5 text-slate-400 font-bold">不可 (編集ロック)</td>
                  <td class="p-2.5">提出者印 ＋ 上長印</td>
                </tr>
                <tr>
                  <td class="p-2.5 font-mono font-bold text-emerald-700">admin_confirmed</td>
                  <td class="p-2.5">③ 完了 (総務勤怠反映済)</td>
                  <td class="p-2.5 text-slate-400 font-bold">不可 (全手続完了)</td>
                  <td class="p-2.5">提出者印 ＋ 上長印 ＋ 総務印（全印押印）</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section 3: 申請種別と入力項目 -->
      <section id="section-3" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
          <span>3. 申請種別とアニメ現場特有の入力項目仕様</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            一般的な勤怠フォームとは異なり、アニメーション制作スタジオの文脈に特化した項目を備えています。
          </p>
          <div class="space-y-2.5">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="font-bold text-slate-800 text-xs mb-1">🎬 アニメ制作固有項目</div>
              <ul class="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li><strong>担当作品名（anime_project）</strong>: 『HERON: THE ANIMATION 第2期』等のプロジェクト名。作品別工数管理に直結。</li>
                <li><strong>担当話数・制作工程（episode_or_process）</strong>: 「#07 原画・LO回収」「#04 作監修正・動検」「特報PV 編集立ち会い」等、具体的なパートを記録。</li>
                <li><strong>関連締切・納品日（deadline_date）</strong>: カッティング日、V編日、作監出し日などの締切を明示し、申請の妥当性を裏付け。</li>
                <li><strong>緊急連絡先（emergency_contact）</strong>: 休日や深夜作業時の緊急対応用連絡先（社用携帯、Slack、Discord）。</li>
              </ul>
            </div>

            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="font-bold text-slate-800 text-xs mb-1">📋 申請種別固有項目</div>
              <ul class="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li><strong>休日出勤</strong>: 振替休日（代休）予定日を指定可能。未定時は後日申請可能。</li>
                <li><strong>休暇申請</strong>: 休暇区分（有給休暇、代休、特別休暇、慶弔休暇、欠勤）および取得単位（全日休、午前半休、午後半休）を選択。</li>
                <li><strong>残業申請</strong>: 予定時間数および22:00以降の深夜残業有無（深夜労働割増チェック）を管理。</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: 上長許諾 ＆ 総務部勤怠連携 -->
      <section id="section-4" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
          <span>4. 上長許諾 ＆ 総務部勤怠連携メカニズム</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            ユーザーからの要件である<strong>「上長に申請して、許諾されれば申請が通り、勤怠管理を行う総務に連絡が届く仕組み」</strong>を以下の設計で実現しています。
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
              <div class="font-bold text-blue-900 flex items-center gap-1.5">
                <span>📢</span>
                <span>自動通知・総務連携フラグ</span>
              </div>
              <p class="text-[11px] text-blue-800">
                上長が「許諾する」ボタンを押下した瞬間、ステータスが <code class="bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-mono">manager_approved</code> に更新され、左側ナビゲーションに「📢 総務未受領（○件）」のアラートバッジが即時表示されます。
              </p>
            </div>

            <div class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
              <div class="font-bold text-emerald-900 flex items-center gap-1.5">
                <span>🏢</span>
                <span>総務受領・労務台帳記録</span>
              </div>
              <p class="text-[11px] text-emerald-800">
                総務労務担当者は「総務受領・勤怠システムへ反映」モーダルから受領確認を行い、36協定・代休付与・有給残日数控除メモを記録して承認を完了します。
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 5: デジタル認印・出力仕様 -->
      <section id="section-5" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
          <span>5. デジタル認印・出力仕様 (PDF/印刷)</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            社内デザインカタログ準拠の<strong>「二重丸印（朱色 #e60012）」</strong>を採用し、提出者・上長・総務の3連枠で押印状況をリアルタイム描画します。
          </p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] space-y-1">
            <p><strong>・サイズ:</strong> 44px × 44px コンパクト印影</p>
            <p><strong>・レイアウト:</strong> 上段: 役職（提出者/上長/総務） / 中段: 年月日（YYYY/M/D） / 下段: 承認者苗字</p>
            <p><strong>・ダイレクトPDF出力:</strong> html2pdf.js により、A4サイズ1枚に完全収容された美しい書式をワンクリックでダウンロード。</p>
          </div>
        </div>
      </section>

      <!-- Section 6: データモデル -->
      <section id="section-6" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
          <span>6. データモデル・ファイル構成</span>
        </h2>
        <div class="text-xs text-slate-700 leading-relaxed space-y-2">
          <p>AI_RULESの独立性・既存UI保護原則に厳格に従い、以下の独立モジュール群で構築されています。</p>
          <div class="border border-slate-200 rounded-xl overflow-hidden font-mono text-[11px]">
            <table class="w-full text-left">
              <thead class="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th class="p-2.5">モジュール</th>
                  <th class="p-2.5">ファイルパス</th>
                  <th class="p-2.5">役割</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr>
                  <td class="p-2.5 font-bold">Model</td>
                  <td class="p-2.5">frontend/src/app/core/work-request.model.ts</td>
                  <td class="p-2.5 font-sans">業務申請データ型・ステータス・設定定義</td>
                </tr>
                <tr>
                  <td class="p-2.5 font-bold">Service</td>
                  <td class="p-2.5">frontend/src/app/core/work-request.service.ts</td>
                  <td class="p-2.5 font-sans">状態管理 (Signal)・上長許諾・総務連携・ローカル保存</td>
                </tr>
                <tr>
                  <td class="p-2.5 font-bold">UI Component</td>
                  <td class="p-2.5">frontend/src/app/pages/work-request/work-request.component.ts</td>
                  <td class="p-2.5 font-sans">一覧・プレビュー・ステッパー・認印・PDF出力</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class WorkRequestSpecComponent {}
