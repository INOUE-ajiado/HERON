import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-license-spec',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="space-y-6 max-w-5xl mx-auto pb-12">
      <!-- ヘッダー -->
      <div class="flex flex-col gap-3 pb-4 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
              <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
              ライセンス・シリアル管理システム 仕様書
            </h1>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[#2A3A4A] text-[#90CFD6]">
              Software Asset & HTML Mail Guide
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Microsoft Office / CLIP STUDIO PAINT / Adobe Photoshop等のアカウント・シリアルコード管理と、利用者へのHTML案内メールプレビュー・送信機能の設計仕様
          </p>
        </div>

        <div class="flex items-center gap-2 print:hidden">
          <a
            routerLink="/licenses"
            class="px-3.5 py-2 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
          >
            <span>🔑 ライセンス台帳ページへ移動</span>
          </a>
          <button
            type="button"
            (click)="printPage()"
            class="heron-btn-secondary text-xs font-bold flex items-center gap-1.5"
          >
            <app-icon name="printer" />
            <span>印刷 / PDF保存</span>
          </button>
        </div>
      </div>

      <!-- 1. システム概要 -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <h2 class="text-sm font-extrabold text-[#2A3A4A] border-b border-slate-200 pb-2">
          1. 目的と管理対象ソフトウェア
        </h2>
        <p class="text-xs text-slate-700 leading-relaxed">
          アニメーション制作現場では、制作進行向けの <strong>Microsoft 365 (Excel / Word / Teams)</strong>、デジタル作画スタッフ向けの <strong>CLIP STUDIO PAINT EX</strong>、撮影・美術・演出向けの <strong>Adobe Creative Cloud (Photoshop / After Effects / Premiere Pro)</strong>、および絵コンテ・3DCGツール（Storyboard Pro / Maya 等）など、多様な商用ソフトウェアライセンスが稼働しています。<br />
          本ページでは、それらの<strong>「アカウントID」「初期パスワード」「シリアルコード（プロダクトキー）」</strong>と<strong>「誰に・どの端末で割り当てているか」</strong>を一元管理し、割当時に誤送信を防ぐ<strong>送信前プレビュー付きのHTML案内メール</strong>を発行します。
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div class="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <div class="text-xs font-bold text-blue-950">📘 Microsoft Office / 365</div>
            <p class="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Microsoft 365 Business Standard や永続版 Office 2024 のアカウントID・初期パスワード・プロダクトキーと利用可能台数（最大5台等）を管理。
            </p>
          </div>
          <div class="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
            <div class="text-xs font-bold text-indigo-950">🎨 CLIP STUDIO PAINT (クリスタ)</div>
            <p class="text-[11px] text-slate-600 mt-1 leading-relaxed">
              法人ボリュームライセンス（2デバイスプラン等）の30桁シリアルナンバー・アクティベーションコードと、作画スタッフ・液タブ端末の紐付けを管理。
            </p>
          </div>
          <div class="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            <div class="text-xs font-bold text-rose-950">🅰️ Adobe Photoshop / CC・その他</div>
            <p class="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Photoshop 単体プランや Creative Cloud コンプリートプラン、Storyboard Pro、ESET ウイルス対策ソフト等の契約番号・キーを一括管理。
            </p>
          </div>
        </div>
      </section>

      <!-- 2. 利用者紐付けと2つのビュー -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <h2 class="text-sm font-extrabold text-[#2A3A4A] border-b border-slate-200 pb-2">
          2. スタッフ紐付け管理とデュアルビュー
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
            <div class="font-bold text-[#2A3A4A]">🔑 ① ライセンス・シリアル一覧ビュー</div>
            <p class="text-slate-600 leading-relaxed">
              ライセンス1契約（1シリアル）単位で在庫状況（割当済／未割当の空き在庫／調整中／期限切れ）を確認できます。普段はシリアルコードとパスワードが伏字（マスク表示）で保護されており、必要な時だけ「表示」またはワンクリック「コピー」が可能です。
            </p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
            <div class="font-bold text-[#2A3A4A]">👥 ② スタッフ（利用者）別 紐付け一覧ビュー</div>
            <p class="text-slate-600 leading-relaxed">
              「誰がどのソフトウェアライセンスをいくつ保有しているか」をスタッフ単位で自動集計して表示します。入退社やプロジェクト異動時のライセンス棚卸し・回収漏れ防止に直結します。
            </p>
          </div>
        </div>
      </section>

      <!-- 3. HTML案内メール 送信前プレビュー＆送信フロー -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <h2 class="text-sm font-extrabold text-[#2A3A4A] border-b border-slate-200 pb-2">
          3. HTML形式の案内メール作成 ＆ 送信前プレビュー確認機能
        </h2>
        <p class="text-xs text-slate-700 leading-relaxed">
          ライセンスをスタッフに紐付けた後、「✉️ HTML案内メールを作成・確認」ボタンを押すと、<strong>実際に送信する前に受信者側のメーラーでの表示内容を100%確認できるプレビューモーダル</strong>が起動します。
        </p>

        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="w-full text-left text-xs">
            <thead class="bg-[#2A3A4A] text-white text-[11px]">
              <tr>
                <th class="py-2.5 px-3">機能ステップ</th>
                <th class="py-2.5 px-3">仕様詳細</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              <tr>
                <td class="py-2.5 px-3 font-bold text-[#2A3A4A] whitespace-nowrap">① ソフト別手順の自動挿入</td>
                <td class="py-2.5 px-3 text-slate-600">
                  Microsoft 365、CLIP STUDIO PAINT、Adobe Creative Cloud など、選んだカテゴリに応じたインストール手順・認証ステップがHTMLメール内に自動生成されます。
                </td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-[#2A3A4A] whitespace-nowrap">② 機密情報の伏字トグル</td>
                <td class="py-2.5 px-3 text-slate-600">
                  送信前チェックとして「シリアルコードを本文に記載する」「初期パスワードを本文に記載する」を個別にON/OFFでき、OFFにすると即座にプレビュー上が伏字（別送案内）に切り替わります。
                </td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-[#2A3A4A] whitespace-nowrap">③ 3モードの送信前確認</td>
                <td class="py-2.5 px-3 text-slate-600">
                  <strong>「🖼 HTMLメール表示」</strong>（実際の装飾・配色プレビュー）、<strong>「&lt;/&gt; HTMLソース」</strong>、<strong>「📄 テキスト版」</strong>をタブで切り替えて事前検証できます。
                </td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-[#2A3A4A] whitespace-nowrap">④ リッチHTMLコピー ＆ 送信記録</td>
                <td class="py-2.5 px-3 text-slate-600">
                  <code>ClipboardItem (text/html)</code> に対応しており、Gmail や Outlook の作成画面にペーストするだけでHTMLテーブル・バナー装飾のまま送信できます。送信実行時にはライセンス台帳に「最終送信日時・送信履歴ログ」が記録されます。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class LicenseSpecComponent {
  printPage(): void {
    window.print();
  }
}
