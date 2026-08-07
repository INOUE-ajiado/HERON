import { Component, signal } from '@angular/core';

import { IconComponent } from '../../shared/icon.component';

interface TocItem {
  id: string;
  label: string;
  group: string;
}

/**
 * HERON システム仕様書。
 *
 * 「何をするのか」「どう動くのか」を、図・操作手順・運用手順で網羅する資料ページ。
 * 図はすべてインライン SVG で描画し、外部ライブラリや画像ファイルに依存しない。
 */
@Component({
  selector: 'app-system-spec',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col gap-3 pb-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          HERON システム仕様書
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          このシステムが「何をするのか」「どう動くのか」を、構成図・シーケンス図・処理フロー・操作手順・運用手順で網羅した資料です
        </p>
      </div>
      <button type="button" (click)="print()" class="heron-btn-secondary text-xs font-bold shrink-0">
        <app-icon name="printer" />
        印刷 / PDF保存
      </button>
    </div>

    <div class="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start">
      <!-- 目次 -->
      <nav class="shrink-0 xl:sticky xl:top-4 xl:w-56 print:hidden">
        <div class="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div class="text-[10px] font-bold tracking-widest text-slate-400 mb-2">目次</div>
          @for (group of groups; track group) {
            <div class="mb-2 last:mb-0">
              <div class="text-[10px] font-bold text-[#2A3A4A] mb-1">{{ group }}</div>
              <ul class="space-y-0.5">
                @for (item of tocFor(group); track item.id) {
                  <li>
                    <button
                      type="button"
                      (click)="scrollTo(item.id)"
                      class="w-full text-left text-[11px] leading-snug text-slate-600 hover:text-blue-700 hover:underline"
                    >
                      {{ item.label }}
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </nav>

      <div class="min-w-0 flex-1 space-y-8">
        <!-- ============================= 1. 概要 ============================= -->
        <section id="overview" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            1. このシステムは何をするのか
          </h2>

          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            HERON は、アニメーションスタジオの社内機材（液タブ・PC・モニター・カメラ等）を
            <strong>1台ずつ固有IDで管理する台帳システム</strong>です。機材にQRコード付きラベルを貼り、
            スマートフォンやPCのブラウザから、<strong>誰が・いつ・どの機材を・どこへ動かしたか</strong>を記録します。
          </p>

          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (card of purposeCards; track card.title) {
              <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                <div class="text-xs font-bold text-[#2A3A4A]">{{ card.title }}</div>
                <p class="mt-1 text-[11px] leading-relaxed text-slate-600">{{ card.body }}</p>
              </div>
            }
          </div>

          <h3 class="mt-5 text-xs font-bold text-[#2A3A4A]">解決したい課題</h3>
          <div class="mt-2 overflow-x-auto rounded-md border border-slate-200/80">
            <table class="w-full min-w-[540px] text-left text-[11px]">
              <thead>
                <tr class="bg-[#2A3A4A] text-white font-bold text-[10px] tracking-wider">
                  <th class="py-2 px-3 w-1/2">これまでの困りごと</th>
                  <th class="py-2 px-3">HERON でどうなるか</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (row of problemRows; track row[0]) {
                  <tr>
                    <td class="py-2 px-3 text-slate-600">{{ row[0] }}</td>
                    <td class="py-2 px-3 text-slate-800 font-medium">{{ row[1] }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="mt-4 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-900">
            <strong>現在の稼働状況：</strong>
            本システムは他基幹システムと接続する前の<strong>単体テスト環境</strong>です。
            データは Firebase (Cloud Firestore) に保存され、許可されたテストメンバー全員で共有されます。
          </div>
        </section>

        <!-- ============================= 2. 全体構成 ============================= -->
        <section id="architecture" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            2. システム全体構成
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            利用者のブラウザ上で動く画面（Angular）が、Firebase の認証とデータベースに直接つながる構成です。
            専用のサーバーを常時動かす必要がなく、URL を開くだけで全員が同じデータを見られます。
          </p>

          <figure class="mt-3">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 720 330" class="w-full min-w-[620px]" role="img" aria-label="システム全体構成図">
                <defs>
                  <marker id="arw" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
                  </marker>
                </defs>

                <!-- 利用者 -->
                <rect x="16" y="110" width="120" height="96" rx="8" fill="#2A3A4A" />
                <text x="76" y="140" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">利用者</text>
                <text x="76" y="162" text-anchor="middle" font-size="10" fill="#90CFD6">PC ブラウザ</text>
                <text x="76" y="178" text-anchor="middle" font-size="10" fill="#90CFD6">スマートフォン</text>
                <text x="76" y="194" text-anchor="middle" font-size="10" fill="#90CFD6">カメラでQR読取</text>

                <!-- フロントエンド -->
                <rect x="196" y="86" width="170" height="144" rx="8" fill="#ffffff" stroke="#2A3A4A" stroke-width="2" />
                <text x="281" y="110" text-anchor="middle" font-size="12" font-weight="700" fill="#2A3A4A">HERON 画面</text>
                <text x="281" y="128" text-anchor="middle" font-size="9.5" fill="#64748b">Angular 20 / Tailwind</text>
                <line x1="212" y1="140" x2="350" y2="140" stroke="#e2e8f0" stroke-width="1" />
                <text x="281" y="158" text-anchor="middle" font-size="9.5" fill="#334155">機材台帳・貸出・返却</text>
                <text x="281" y="176" text-anchor="middle" font-size="9.5" fill="#334155">棚卸し・履歴・マスタ</text>
                <text x="281" y="194" text-anchor="middle" font-size="9.5" fill="#334155">ラベル印刷</text>
                <text x="281" y="214" text-anchor="middle" font-size="9" fill="#64748b">Firebase Hosting で配信</text>

                <!-- Firebase -->
                <rect x="424" y="40" width="272" height="240" rx="10" fill="#F8FAFC" stroke="#cbd5e1" stroke-dasharray="4 3" />
                <text x="560" y="62" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">Google Firebase</text>

                <rect x="444" y="78" width="232" height="52" rx="7" fill="#ffffff" stroke="#2563eb" stroke-width="1.5" />
                <text x="560" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#1d4ed8">Firebase Authentication</text>
                <text x="560" y="116" text-anchor="middle" font-size="9.5" fill="#475569">Google アカウントでログイン</text>

                <rect x="444" y="144" width="232" height="76" rx="7" fill="#ffffff" stroke="#0f766e" stroke-width="1.5" />
                <text x="560" y="164" text-anchor="middle" font-size="11" font-weight="700" fill="#0f766e">Cloud Firestore</text>
                <text x="560" y="182" text-anchor="middle" font-size="9.5" fill="#475569">機材 / 操作ログ / 保管場所</text>
                <text x="560" y="198" text-anchor="middle" font-size="9.5" fill="#475569">利用者 / 各種マスタ / 版数</text>
                <text x="560" y="214" text-anchor="middle" font-size="9" fill="#94a3b8">セキュリティルールで保護</text>

                <rect x="444" y="234" width="232" height="30" rx="7" fill="#ffffff" stroke="#cbd5e1" />
                <text x="560" y="253" text-anchor="middle" font-size="9.5" fill="#64748b">Firebase Hosting（画面の配信）</text>

                <!-- ラベルプリンタ -->
                <rect x="196" y="256" width="170" height="52" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />
                <text x="281" y="277" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">NIIMBOT M2</text>
                <text x="281" y="294" text-anchor="middle" font-size="9.5" fill="#64748b">ブラウザの印刷機能で出力</text>

                <!-- 矢印 -->
                <line x1="138" y1="158" x2="192" y2="158" stroke="#475569" stroke-width="1.6" marker-end="url(#arw)" />
                <line x1="368" y1="122" x2="440" y2="104" stroke="#475569" stroke-width="1.6" marker-end="url(#arw)" />
                <line x1="368" y1="170" x2="440" y2="178" stroke="#475569" stroke-width="1.6" marker-end="url(#arw)" />
                <line x1="281" y1="232" x2="281" y2="252" stroke="#475569" stroke-width="1.6" marker-end="url(#arw)" />
                <text x="392" y="104" text-anchor="middle" font-size="8.5" fill="#64748b">認証</text>
                <text x="398" y="190" text-anchor="middle" font-size="8.5" fill="#64748b">読み書き</text>
                <text x="296" y="246" font-size="8.5" fill="#64748b">印刷</text>
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図2-1. システム全体構成</figcaption>
          </figure>

          <div class="mt-3 overflow-x-auto rounded-md border border-slate-200/80">
            <table class="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr class="bg-slate-100 text-[#2A3A4A] font-bold text-[10px] tracking-wider">
                  <th class="py-2 px-3">構成要素</th>
                  <th class="py-2 px-3">採用技術</th>
                  <th class="py-2 px-3">役割</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (row of stackRows; track row[0]) {
                  <tr>
                    <td class="py-2 px-3 font-bold text-[#2A3A4A] whitespace-nowrap">{{ row[0] }}</td>
                    <td class="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{{ row[1] }}</td>
                    <td class="py-2 px-3 text-slate-600">{{ row[2] }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============================= 3. データ構造 ============================= -->
        <section id="data" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            3. データ構造
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            データは Cloud Firestore の「コレクション」に保存されます。中心にあるのは
            <strong>機材</strong>で、そこに<strong>利用者</strong>と<strong>保管場所</strong>が紐づき、
            すべての操作が<strong>操作ログ</strong>として積み上がっていきます。
          </p>

          <figure class="mt-3">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 720 350" class="w-full min-w-[640px]" role="img" aria-label="データ構造の関連図">
                <defs>
                  <marker id="arw2" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
                  </marker>
                </defs>

                <!-- 機材 (中心) -->
                <rect x="270" y="130" width="180" height="92" rx="8" fill="#2A3A4A" />
                <text x="360" y="152" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff">equipments（機材）</text>
                <text x="360" y="172" text-anchor="middle" font-size="9" fill="#90CFD6">DEV-TAB-00001</text>
                <text x="360" y="188" text-anchor="middle" font-size="9" fill="#cbd5e1">名称 / 型番 / カテゴリ</text>
                <text x="360" y="203" text-anchor="middle" font-size="9" fill="#cbd5e1">状態 / 貸出先 / 保管場所</text>
                <text x="360" y="217" text-anchor="middle" font-size="9" fill="#cbd5e1">付属品チェックリスト</text>

                <!-- 利用者 -->
                <rect x="40" y="40" width="170" height="62" rx="7" fill="#ffffff" stroke="#2563eb" stroke-width="1.5" />
                <text x="125" y="60" text-anchor="middle" font-size="11" font-weight="700" fill="#1d4ed8">users（利用者）</text>
                <text x="125" y="77" text-anchor="middle" font-size="9" fill="#475569">氏名 / メール / 権限</text>
                <text x="125" y="92" text-anchor="middle" font-size="9" fill="#94a3b8">ログイン時に自動登録</text>

                <!-- 保管場所 -->
                <rect x="40" y="248" width="170" height="62" rx="7" fill="#ffffff" stroke="#0f766e" stroke-width="1.5" />
                <text x="125" y="268" text-anchor="middle" font-size="11" font-weight="700" fill="#0f766e">locations / shelves</text>
                <text x="125" y="285" text-anchor="middle" font-size="9" fill="#475569">部屋名 / 棚名 / 棚コード</text>
                <text x="125" y="300" text-anchor="middle" font-size="9" fill="#94a3b8">（保管場所マスタ）</text>

                <!-- 操作ログ -->
                <rect x="510" y="130" width="180" height="92" rx="7" fill="#ffffff" stroke="#b45309" stroke-width="1.5" />
                <text x="600" y="152" text-anchor="middle" font-size="11" font-weight="700" fill="#b45309">logs（操作ログ）</text>
                <text x="600" y="170" text-anchor="middle" font-size="9" fill="#475569">いつ / 誰が / 何を</text>
                <text x="600" y="185" text-anchor="middle" font-size="9" fill="#475569">貸出・返却・棚卸し</text>
                <text x="600" y="200" text-anchor="middle" font-size="9" fill="#475569">登録・更新・除却</text>
                <text x="600" y="215" text-anchor="middle" font-size="8.5" font-weight="700" fill="#b45309">追記のみ（変更・削除不可）</text>

                <!-- マスタ -->
                <rect x="270" y="278" width="180" height="52" rx="7" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />
                <text x="360" y="298" text-anchor="middle" font-size="10.5" font-weight="700" fill="#334155">departments / categories</text>
                <text x="360" y="315" text-anchor="middle" font-size="9" fill="#64748b">部署・カテゴリマスタ（採番に使用）</text>

                <!-- 採番 -->
                <rect x="270" y="40" width="180" height="52" rx="7" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />
                <text x="360" y="60" text-anchor="middle" font-size="10.5" font-weight="700" fill="#334155">counters（採番カウンタ）</text>
                <text x="360" y="77" text-anchor="middle" font-size="9" fill="#64748b">機材IDの連番を払い出す</text>

                <!-- アクセス管理 -->
                <rect x="510" y="248" width="180" height="62" rx="7" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />
                <text x="600" y="268" text-anchor="middle" font-size="10.5" font-weight="700" fill="#334155">test_members / versions</text>
                <text x="600" y="285" text-anchor="middle" font-size="9" fill="#64748b">アクセス許可リスト</text>
                <text x="600" y="300" text-anchor="middle" font-size="9" fill="#64748b">バージョン履歴</text>

                <!-- 線 -->
                <line x1="212" y1="80" x2="268" y2="140" stroke="#94a3b8" stroke-width="1.4" marker-end="url(#arw2)" />
                <text x="228" y="104" font-size="8.5" fill="#64748b">貸出先</text>
                <line x1="212" y1="272" x2="268" y2="212" stroke="#94a3b8" stroke-width="1.4" marker-end="url(#arw2)" />
                <text x="222" y="252" font-size="8.5" fill="#64748b">所在</text>
                <line x1="452" y1="176" x2="506" y2="176" stroke="#94a3b8" stroke-width="1.4" marker-end="url(#arw2)" />
                <text x="462" y="168" font-size="8.5" fill="#64748b">記録</text>
                <line x1="360" y1="96" x2="360" y2="126" stroke="#94a3b8" stroke-width="1.4" marker-end="url(#arw2)" />
                <line x1="360" y1="274" x2="360" y2="226" stroke="#94a3b8" stroke-width="1.4" marker-end="url(#arw2)" />
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図3-1. コレクションの関連</figcaption>
          </figure>

          <div class="mt-3 overflow-x-auto rounded-md border border-slate-200/80">
            <table class="w-full min-w-[600px] text-left text-[11px]">
              <thead>
                <tr class="bg-[#2A3A4A] text-white font-bold text-[10px] tracking-wider">
                  <th class="py-2 px-3">コレクション</th>
                  <th class="py-2 px-3">保持する内容</th>
                  <th class="py-2 px-3">主なキー</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (row of collectionRows; track row[0]) {
                  <tr>
                    <td class="py-2 px-3 font-mono font-bold text-[#2A3A4A] whitespace-nowrap">{{ row[0] }}</td>
                    <td class="py-2 px-3 text-slate-600">{{ row[1] }}</td>
                    <td class="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{{ row[2] }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============================= 4. 機材ID ============================= -->
        <section id="numbering" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            4. 機材IDと採番ルール
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            機材IDは登録時にシステムが自動で採番します。手入力はできません。
            連番はデータベース側のカウンタから払い出すため、複数人が同時に登録しても番号は重複しません。
          </p>

          <figure class="mt-3">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 640 220" class="w-full min-w-[560px]" role="img" aria-label="機材IDの構造">
                <rect x="90" y="40" width="460" height="60" rx="8" fill="#0f172a" />
                <text x="180" y="82" text-anchor="middle" font-size="30" font-weight="700" font-family="monospace" fill="#90CFD6">DEV</text>
                <text x="256" y="82" text-anchor="middle" font-size="30" font-weight="700" font-family="monospace" fill="#64748b">-</text>
                <text x="330" y="82" text-anchor="middle" font-size="30" font-weight="700" font-family="monospace" fill="#fbbf24">TAB</text>
                <text x="400" y="82" text-anchor="middle" font-size="30" font-weight="700" font-family="monospace" fill="#64748b">-</text>
                <text x="480" y="82" text-anchor="middle" font-size="30" font-weight="700" font-family="monospace" fill="#ffffff">00001</text>

                <line x1="180" y1="106" x2="180" y2="132" stroke="#90CFD6" stroke-width="1.5" />
                <line x1="330" y1="106" x2="330" y2="152" stroke="#fbbf24" stroke-width="1.5" />
                <line x1="480" y1="106" x2="480" y2="172" stroke="#94a3b8" stroke-width="1.5" />

                <text x="180" y="147" text-anchor="middle" font-size="11" font-weight="700" fill="#0f766e">部署コード</text>
                <text x="180" y="162" text-anchor="middle" font-size="9" fill="#64748b">DEV / ANIM / SALES / HQ</text>

                <text x="330" y="167" text-anchor="middle" font-size="11" font-weight="700" fill="#b45309">カテゴリコード</text>
                <text x="330" y="182" text-anchor="middle" font-size="9" fill="#64748b">TAB / PC / DSP / CAM</text>

                <text x="480" y="187" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">5桁の連番</text>
                <text x="480" y="202" text-anchor="middle" font-size="9" fill="#64748b">部署×カテゴリごとに 1 から</text>

                <text x="320" y="24" text-anchor="middle" font-size="10" fill="#64748b">
                  機材ID（QRコードにもこの文字列が入ります）
                </text>
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図4-1. 機材IDの構造</figcaption>
          </figure>

          <ul class="mt-3 space-y-1.5 text-[11px] leading-relaxed text-slate-700">
            <li>・部署コードとカテゴリコードは<strong>マスタ設定</strong>画面で追加・削除できます。</li>
            <li>・連番は <span class="font-mono">部署_カテゴリ</span> の組み合わせごとに独立しています（DEV-TAB と DEV-PC は別系列）。</li>
            <li>・一度払い出した番号は、機材を除却しても再利用されません。</li>
          </ul>
        </section>

        <!-- ============================= 5. ライフサイクル ============================= -->
        <section id="lifecycle" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            5. 機材のライフサイクル（状態遷移）
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            機材は常に次の4つのいずれかの状態を持ちます。状態が変わる操作は、すべて操作ログに残ります。
          </p>

          <figure class="mt-3">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 700 300" class="w-full min-w-[620px]" role="img" aria-label="機材の状態遷移図">
                <defs>
                  <marker id="arw3" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
                  </marker>
                </defs>

                <circle cx="60" cy="120" r="14" fill="#0f172a" />
                <text x="60" y="152" text-anchor="middle" font-size="9" fill="#64748b">新規登録</text>

                <rect x="140" y="88" width="150" height="64" rx="8" fill="#ecfdf5" stroke="#059669" stroke-width="1.8" />
                <text x="215" y="114" text-anchor="middle" font-size="13" font-weight="700" fill="#065f46">保管中</text>
                <text x="215" y="132" text-anchor="middle" font-size="9" font-family="monospace" fill="#059669">available</text>

                <rect x="400" y="88" width="150" height="64" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1.8" />
                <text x="475" y="114" text-anchor="middle" font-size="13" font-weight="700" fill="#1e3a8a">貸出中</text>
                <text x="475" y="132" text-anchor="middle" font-size="9" font-family="monospace" fill="#2563eb">in_use</text>

                <rect x="140" y="212" width="150" height="60" rx="8" fill="#fffbeb" stroke="#d97706" stroke-width="1.8" />
                <text x="215" y="238" text-anchor="middle" font-size="12" font-weight="700" fill="#92400e">メンテナンス中</text>
                <text x="215" y="255" text-anchor="middle" font-size="9" font-family="monospace" fill="#d97706">maintenance</text>

                <rect x="400" y="212" width="150" height="60" rx="8" fill="#fff1f2" stroke="#e11d48" stroke-width="1.8" />
                <text x="475" y="238" text-anchor="middle" font-size="12" font-weight="700" fill="#9f1239">除却済み</text>
                <text x="475" y="255" text-anchor="middle" font-size="9" font-family="monospace" fill="#e11d48">discarded</text>

                <!-- 遷移 -->
                <line x1="76" y1="120" x2="136" y2="120" stroke="#334155" stroke-width="1.6" marker-end="url(#arw3)" />

                <path d="M292,106 L396,106" stroke="#334155" stroke-width="1.6" fill="none" marker-end="url(#arw3)" />
                <text x="344" y="99" text-anchor="middle" font-size="10" font-weight="700" fill="#1d4ed8">貸出</text>

                <path d="M396,136 L292,136" stroke="#334155" stroke-width="1.6" fill="none" marker-end="url(#arw3)" />
                <text x="344" y="152" text-anchor="middle" font-size="10" font-weight="700" fill="#059669">返却</text>

                <path d="M198,156 L198,208" stroke="#334155" stroke-width="1.6" fill="none" marker-end="url(#arw3)" />
                <path d="M232,208 L232,156" stroke="#334155" stroke-width="1.6" fill="none" marker-end="url(#arw3)" />
                <text x="150" y="188" font-size="9" fill="#92400e">修理へ</text>
                <text x="240" y="188" font-size="9" fill="#065f46">復帰</text>

                <path d="M292,142 L396,224" stroke="#334155" stroke-width="1.6" stroke-dasharray="4 3" fill="none" marker-end="url(#arw3)" />
                <text x="330" y="200" font-size="9" fill="#9f1239">除却</text>

                <rect x="576" y="88" width="110" height="184" rx="7" fill="#f8fafc" stroke="#e2e8f0" />
                <text x="631" y="110" text-anchor="middle" font-size="9.5" font-weight="700" fill="#334155">棚卸し</text>
                <text x="631" y="128" text-anchor="middle" font-size="8.5" fill="#64748b">状態は変えず</text>
                <text x="631" y="142" text-anchor="middle" font-size="8.5" fill="#64748b">所在（棚）だけを</text>
                <text x="631" y="156" text-anchor="middle" font-size="8.5" fill="#64748b">更新します</text>
                <line x1="592" y1="170" x2="670" y2="170" stroke="#e2e8f0" />
                <text x="631" y="190" text-anchor="middle" font-size="8.5" fill="#64748b">除却済みの機材は</text>
                <text x="631" y="204" text-anchor="middle" font-size="8.5" fill="#64748b">貸出も棚卸しも</text>
                <text x="631" y="218" text-anchor="middle" font-size="8.5" fill="#64748b">対象外になります</text>
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図5-1. 機材の状態遷移</figcaption>
          </figure>

          <div class="mt-3 rounded-md border border-blue-200 bg-blue-50/70 p-3 text-[11px] leading-relaxed text-blue-900">
            <strong>二重貸出の防止：</strong>
            すでに「貸出中」の機材にもう一度貸出をかけようとすると、システムが処理を拒否します。
            「この機材はすでに貸出中です」と表示された場合は、先に返却処理を行ってください。
          </div>
        </section>

        <!-- ============================= 6. シーケンス図 ============================= -->
        <section id="sequences" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            6. 主要処理のシーケンス
          </h2>

          <h3 class="mt-4 text-xs font-bold text-[#2A3A4A]">6-1. ログイン（アクセス制御）</h3>
          <p class="mt-1.5 text-[11px] leading-relaxed text-slate-700">
            ログインは Google アカウントの1タップのみです。認証に成功しても、許可リストに載っていないアカウントは弾かれます。
          </p>
          <figure class="mt-2">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 700 300" class="w-full min-w-[620px]" role="img" aria-label="ログイン処理のシーケンス図">
                <defs>
                  <marker id="sq1" markerWidth="8" markerHeight="8" refX="7" refY="2.5" orient="auto">
                    <path d="M0,0 L0,5 L7,2.5 z" fill="#334155" />
                  </marker>
                </defs>

                <!-- レーン -->
                <rect x="20" y="16" width="120" height="30" rx="6" fill="#2A3A4A" />
                <text x="80" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">利用者</text>
                <rect x="200" y="16" width="120" height="30" rx="6" fill="#2A3A4A" />
                <text x="260" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">ログイン画面</text>
                <rect x="380" y="16" width="130" height="30" rx="6" fill="#1d4ed8" />
                <text x="445" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">Google 認証</text>
                <rect x="560" y="16" width="120" height="30" rx="6" fill="#0f766e" />
                <text x="620" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">Firestore</text>

                <line x1="80" y1="46" x2="80" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />
                <line x1="260" y1="46" x2="260" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />
                <line x1="445" y1="46" x2="445" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />
                <line x1="620" y1="46" x2="620" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />

                <line x1="80" y1="76" x2="256" y2="76" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="168" y="70" text-anchor="middle" font-size="9" fill="#334155">「Googleでログイン」を押す</text>

                <line x1="260" y1="106" x2="441" y2="106" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="350" y="100" text-anchor="middle" font-size="9" fill="#334155">認証をリクエスト</text>

                <line x1="445" y1="136" x2="264" y2="136" stroke="#334155" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#sq1)" />
                <text x="355" y="130" text-anchor="middle" font-size="9" fill="#334155">アカウント情報を返す</text>

                <line x1="260" y1="166" x2="616" y2="166" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="438" y="160" text-anchor="middle" font-size="9" fill="#334155">許可リスト（test_members）を取得</text>

                <line x1="620" y1="196" x2="264" y2="196" stroke="#334155" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#sq1)" />
                <text x="442" y="190" text-anchor="middle" font-size="9" fill="#334155">許可メンバー一覧</text>

                <rect x="196" y="212" width="128" height="34" rx="5" fill="#f1f5f9" stroke="#94a3b8" />
                <text x="260" y="226" text-anchor="middle" font-size="8.5" fill="#334155">社内ドメイン または</text>
                <text x="260" y="239" text-anchor="middle" font-size="8.5" fill="#334155">許可リストに存在するか判定</text>

                <line x1="256" y1="272" x2="84" y2="272" stroke="#059669" stroke-width="1.6" marker-end="url(#sq1)" />
                <text x="170" y="266" text-anchor="middle" font-size="9" font-weight="700" fill="#065f46">許可 → 機材台帳へ</text>
                <text x="470" y="272" font-size="9" font-weight="700" fill="#9f1239">不許可 → エラーを表示してログイン画面に留まる</text>
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図6-1. ログイン処理</figcaption>
          </figure>

          <h3 class="mt-5 text-xs font-bold text-[#2A3A4A]">6-2. 貸出</h3>
          <figure class="mt-2">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 700 300" class="w-full min-w-[620px]" role="img" aria-label="貸出処理のシーケンス図">
                <rect x="20" y="16" width="130" height="30" rx="6" fill="#2A3A4A" />
                <text x="85" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">担当者</text>
                <rect x="230" y="16" width="150" height="30" rx="6" fill="#2A3A4A" />
                <text x="305" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">機材台帳（ドロワー）</text>
                <rect x="480" y="16" width="140" height="30" rx="6" fill="#0f766e" />
                <text x="550" y="36" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">Firestore</text>

                <line x1="85" y1="46" x2="85" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />
                <line x1="305" y1="46" x2="305" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />
                <line x1="550" y1="46" x2="550" y2="288" stroke="#cbd5e1" stroke-dasharray="4 4" />

                <line x1="85" y1="74" x2="301" y2="74" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="193" y="68" text-anchor="middle" font-size="9" fill="#334155">QRを読む / 一覧から機材を選ぶ</text>

                <line x1="305" y1="102" x2="546" y2="102" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="425" y="96" text-anchor="middle" font-size="9" fill="#334155">機材の現在の状態を取得</text>

                <rect x="470" y="114" width="160" height="30" rx="5" fill="#fff1f2" stroke="#e11d48" />
                <text x="550" y="133" text-anchor="middle" font-size="8.5" fill="#9f1239">貸出中・除却済みなら中止</text>

                <line x1="85" y1="168" x2="301" y2="168" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="193" y="162" text-anchor="middle" font-size="9" fill="#334155">貸出先の利用者と棚を選び実行</text>

                <line x1="305" y1="198" x2="546" y2="198" stroke="#334155" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="425" y="192" text-anchor="middle" font-size="9" fill="#334155">状態を「貸出中」に更新</text>

                <line x1="305" y1="228" x2="546" y2="228" stroke="#b45309" stroke-width="1.6" marker-end="url(#sq1)" />
                <text x="425" y="222" text-anchor="middle" font-size="9" font-weight="700" fill="#b45309">操作ログを1件追記</text>

                <line x1="546" y1="258" x2="309" y2="258" stroke="#059669" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#sq1)" />
                <line x1="301" y1="282" x2="89" y2="282" stroke="#059669" stroke-width="1.4" marker-end="url(#sq1)" />
                <text x="193" y="276" text-anchor="middle" font-size="9" font-weight="700" fill="#065f46">完了メッセージを表示</text>
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図6-2. 貸出処理（返却も同じ流れで、状態が「保管中」に戻ります）</figcaption>
          </figure>

          <h3 class="mt-5 text-xs font-bold text-[#2A3A4A]">6-3. 棚卸しの処理フロー</h3>
          <p class="mt-1.5 text-[11px] leading-relaxed text-slate-700">
            棚を1つ選び、その棚にある機材のQRを次々に読み取ります。読み取り終えて実行すると、
            読み取った機材の所在がその棚に更新され、結果が4つに分類されて表示されます。
          </p>
          <figure class="mt-2">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 700 420" class="w-full min-w-[620px]" role="img" aria-label="棚卸しの処理フロー図">
                <defs>
                  <marker id="fl" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
                  </marker>
                </defs>

                <rect x="252" y="16" width="180" height="34" rx="17" fill="#2A3A4A" />
                <text x="342" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">棚卸しを開始</text>

                <rect x="252" y="72" width="180" height="38" rx="6" fill="#ffffff" stroke="#334155" stroke-width="1.5" />
                <text x="342" y="96" text-anchor="middle" font-size="10.5" fill="#0f172a">対象の棚を選択</text>

                <rect x="252" y="132" width="180" height="38" rx="6" fill="#ffffff" stroke="#334155" stroke-width="1.5" />
                <text x="342" y="150" text-anchor="middle" font-size="10.5" fill="#0f172a">機材のQRを読み取る</text>
                <text x="342" y="164" text-anchor="middle" font-size="8.5" fill="#64748b">（繰り返し・重複は自動で無視）</text>

                <polygon points="342,192 452,228 342,264 232,228" fill="#fffbeb" stroke="#d97706" stroke-width="1.5" />
                <text x="342" y="224" text-anchor="middle" font-size="10" font-weight="700" fill="#92400e">読み取った機材は</text>
                <text x="342" y="238" text-anchor="middle" font-size="10" font-weight="700" fill="#92400e">台帳に存在するか</text>

                <rect x="486" y="208" width="190" height="40" rx="6" fill="#fff1f2" stroke="#e11d48" stroke-width="1.5" />
                <text x="581" y="226" text-anchor="middle" font-size="10" font-weight="700" fill="#9f1239">未登録（not_found）</text>
                <text x="581" y="240" text-anchor="middle" font-size="8.5" fill="#9f1239">結果一覧に警告として表示</text>

                <rect x="252" y="286" width="180" height="40" rx="6" fill="#ffffff" stroke="#334155" stroke-width="1.5" />
                <text x="342" y="304" text-anchor="middle" font-size="10.5" fill="#0f172a">所在をこの棚に更新し</text>
                <text x="342" y="318" text-anchor="middle" font-size="10.5" fill="#0f172a">操作ログを記録</text>

                <rect x="24" y="286" width="190" height="40" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" />
                <text x="119" y="304" text-anchor="middle" font-size="10" font-weight="700" fill="#475569">除却済み（skipped）</text>
                <text x="119" y="318" text-anchor="middle" font-size="8.5" fill="#64748b">対象外として除外</text>

                <rect x="120" y="352" width="200" height="52" rx="6" fill="#ecfdf5" stroke="#059669" stroke-width="1.5" />
                <text x="220" y="372" text-anchor="middle" font-size="10" font-weight="700" fill="#065f46">照合済み / 所在変更</text>
                <text x="220" y="388" text-anchor="middle" font-size="8.5" fill="#065f46">updated / moved_in</text>

                <rect x="364" y="352" width="200" height="52" rx="6" fill="#fffbeb" stroke="#d97706" stroke-width="1.5" />
                <text x="464" y="372" text-anchor="middle" font-size="10" font-weight="700" fill="#92400e">未読取（missing）</text>
                <text x="464" y="388" text-anchor="middle" font-size="8.5" fill="#92400e">この棚にあるはずが読まれなかった</text>

                <line x1="342" y1="50" x2="342" y2="68" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <line x1="342" y1="110" x2="342" y2="128" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <line x1="342" y1="170" x2="342" y2="188" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <line x1="452" y1="228" x2="482" y2="228" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <text x="466" y="220" text-anchor="middle" font-size="8.5" fill="#9f1239">いいえ</text>
                <line x1="342" y1="264" x2="342" y2="282" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <text x="352" y="278" font-size="8.5" fill="#065f46">はい</text>
                <line x1="232" y1="228" x2="119" y2="228" stroke="#334155" stroke-width="1.5" />
                <line x1="119" y1="228" x2="119" y2="282" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <text x="150" y="222" font-size="8.5" fill="#475569">除却済み</text>
                <line x1="300" y1="326" x2="240" y2="348" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
                <line x1="384" y1="326" x2="444" y2="348" stroke="#334155" stroke-width="1.5" marker-end="url(#fl)" />
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図6-3. 棚卸しの処理フロー</figcaption>
          </figure>
        </section>

        <!-- ============================= 7. 画面と権限 ============================= -->
        <section id="screens" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            7. 画面構成と権限
          </h2>

          <figure class="mt-3">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 700 260" class="w-full min-w-[620px]" role="img" aria-label="画面遷移図">
                <defs>
                  <marker id="nv" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
                  </marker>
                </defs>

                <rect x="20" y="100" width="120" height="48" rx="7" fill="#2A3A4A" />
                <text x="80" y="122" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">ログイン</text>
                <text x="80" y="137" text-anchor="middle" font-size="8.5" fill="#90CFD6">Google 認証</text>

                <rect x="196" y="92" width="150" height="64" rx="7" fill="#eff6ff" stroke="#2563eb" stroke-width="1.8" />
                <text x="271" y="116" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1e3a8a">機材台帳・検索</text>
                <text x="271" y="132" text-anchor="middle" font-size="8.5" fill="#1d4ed8">一覧 / 検索 / 詳細ドロワー</text>
                <text x="271" y="146" text-anchor="middle" font-size="8.5" fill="#1d4ed8">登録・編集・貸出・返却</text>

                <rect x="404" y="16" width="128" height="36" rx="6" fill="#ffffff" stroke="#94a3b8" />
                <text x="468" y="33" text-anchor="middle" font-size="10" fill="#334155">ラベル印刷</text>
                <text x="468" y="45" text-anchor="middle" font-size="8" fill="#94a3b8">管理者のみ</text>

                <rect x="404" y="64" width="128" height="36" rx="6" fill="#ffffff" stroke="#94a3b8" />
                <text x="468" y="81" text-anchor="middle" font-size="10" fill="#334155">棚卸し</text>
                <text x="468" y="93" text-anchor="middle" font-size="8" fill="#94a3b8">管理者のみ</text>

                <rect x="404" y="112" width="128" height="36" rx="6" fill="#ffffff" stroke="#94a3b8" />
                <text x="468" y="129" text-anchor="middle" font-size="10" fill="#334155">保管場所マスタ</text>
                <text x="468" y="141" text-anchor="middle" font-size="8" fill="#94a3b8">管理者のみ</text>

                <rect x="404" y="160" width="128" height="36" rx="6" fill="#ffffff" stroke="#94a3b8" />
                <text x="468" y="177" text-anchor="middle" font-size="10" fill="#334155">マスタ設定</text>
                <text x="468" y="189" text-anchor="middle" font-size="8" fill="#94a3b8">管理者のみ</text>

                <rect x="404" y="208" width="128" height="36" rx="6" fill="#ffffff" stroke="#94a3b8" />
                <text x="468" y="225" text-anchor="middle" font-size="10" fill="#334155">操作履歴</text>
                <text x="468" y="237" text-anchor="middle" font-size="8" fill="#94a3b8">管理者のみ</text>

                <rect x="574" y="88" width="112" height="72" rx="6" fill="#f8fafc" stroke="#cbd5e1" />
                <text x="630" y="110" text-anchor="middle" font-size="9.5" font-weight="700" fill="#334155">資料・設定</text>
                <text x="630" y="128" text-anchor="middle" font-size="8.5" fill="#64748b">仕様書（PDF）</text>
                <text x="630" y="142" text-anchor="middle" font-size="8.5" fill="#64748b">システム仕様書</text>
                <text x="630" y="156" text-anchor="middle" font-size="8.5" fill="#64748b">テスト設定</text>

                <line x1="142" y1="124" x2="192" y2="124" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#nv)" />
                <line x1="348" y1="112" x2="400" y2="40" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#nv)" />
                <line x1="348" y1="116" x2="400" y2="86" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#nv)" />
                <line x1="348" y1="126" x2="400" y2="130" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#nv)" />
                <line x1="348" y1="136" x2="400" y2="176" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#nv)" />
                <line x1="348" y1="142" x2="400" y2="222" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#nv)" />
                <line x1="536" y1="124" x2="570" y2="124" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#nv)" />
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図7-1. 画面遷移</figcaption>
          </figure>

          <div class="mt-3 overflow-x-auto rounded-md border border-slate-200/80">
            <table class="w-full min-w-[600px] text-left text-[11px]">
              <thead>
                <tr class="bg-[#2A3A4A] text-white font-bold text-[10px] tracking-wider">
                  <th class="py-2 px-3">画面</th>
                  <th class="py-2 px-3">できること</th>
                  <th class="py-2 px-3 whitespace-nowrap">権限</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (row of screenRows; track row[0]) {
                  <tr>
                    <td class="py-2 px-3 font-bold text-[#2A3A4A] whitespace-nowrap">{{ row[0] }}</td>
                    <td class="py-2 px-3 text-slate-600">{{ row[1] }}</td>
                    <td class="py-2 px-3 whitespace-nowrap">
                      <span
                        class="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        [class]="
                          row[2] === '管理者'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        "
                      >
                        {{ row[2] }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="mt-3 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-900">
            <strong>テスト環境での権限について：</strong>
            現在は Google ログインしたメンバー全員が<strong>管理者</strong>として扱われるため、上記の全画面を利用できます。
            一般ユーザー権限は基幹システム連携時に有効化する想定です。
          </div>
        </section>

        <!-- ============================= 8. 操作手順書 ============================= -->
        <section id="manual" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            8. 取扱説明書・操作手順書
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            日常的に行う操作を、手順どおりに並べています。上から順に実行すれば完了します。
          </p>

          <div class="mt-3 space-y-4">
            @for (proc of procedures; track proc.title) {
              <div class="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div class="flex items-center justify-between gap-2 bg-[#2A3A4A] px-3.5 py-2">
                  <div class="text-xs font-bold text-white">{{ proc.title }}</div>
                  <div class="text-[10px] text-[#90CFD6] whitespace-nowrap">{{ proc.where }}</div>
                </div>
                <ol class="divide-y divide-slate-100">
                  @for (step of proc.steps; track step; let i = $index) {
                    <li class="flex gap-3 px-3.5 py-2.5">
                      <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] font-bold text-[#2A3A4A]">
                        {{ i + 1 }}
                      </span>
                      <span class="text-[11px] leading-relaxed text-slate-700">{{ step }}</span>
                    </li>
                  }
                </ol>
                @if (proc.note) {
                  <p class="border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-[10.5px] leading-relaxed text-slate-600">
                    <strong>補足：</strong>{{ proc.note }}
                  </p>
                }
              </div>
            }
          </div>
        </section>

        <!-- ============================= 9. 運用マニュアル ============================= -->
        <section id="operations" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            9. 運用マニュアル
          </h2>

          <h3 class="mt-4 text-xs font-bold text-[#2A3A4A]">9-1. 運用サイクル</h3>
          <figure class="mt-2">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
              <svg viewBox="0 0 700 200" class="w-full min-w-[620px]" role="img" aria-label="運用サイクルの図">
                <defs>
                  <marker id="op" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#2A3A4A" />
                  </marker>
                </defs>

                <rect x="16" y="66" width="130" height="68" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5" />
                <text x="81" y="90" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1e3a8a">機材の受入</text>
                <text x="81" y="106" text-anchor="middle" font-size="8.5" fill="#1d4ed8">台帳に登録</text>
                <text x="81" y="120" text-anchor="middle" font-size="8.5" fill="#1d4ed8">ラベルを貼付</text>

                <rect x="190" y="66" width="130" height="68" rx="8" fill="#ecfdf5" stroke="#059669" stroke-width="1.5" />
                <text x="255" y="90" text-anchor="middle" font-size="10.5" font-weight="700" fill="#065f46">日常の貸出返却</text>
                <text x="255" y="106" text-anchor="middle" font-size="8.5" fill="#059669">QRを読んで</text>
                <text x="255" y="120" text-anchor="middle" font-size="8.5" fill="#059669">その場で記録</text>

                <rect x="364" y="66" width="130" height="68" rx="8" fill="#fffbeb" stroke="#d97706" stroke-width="1.5" />
                <text x="429" y="90" text-anchor="middle" font-size="10.5" font-weight="700" fill="#92400e">定期棚卸し</text>
                <text x="429" y="106" text-anchor="middle" font-size="8.5" fill="#b45309">棚ごとに読み取り</text>
                <text x="429" y="120" text-anchor="middle" font-size="8.5" fill="#b45309">差異を確認</text>

                <rect x="538" y="66" width="146" height="68" rx="8" fill="#fff1f2" stroke="#e11d48" stroke-width="1.5" />
                <text x="611" y="90" text-anchor="middle" font-size="10.5" font-weight="700" fill="#9f1239">更新・除却</text>
                <text x="611" y="106" text-anchor="middle" font-size="8.5" fill="#e11d48">修理・入替の記録</text>
                <text x="611" y="120" text-anchor="middle" font-size="8.5" fill="#e11d48">廃棄時に除却</text>

                <line x1="148" y1="100" x2="186" y2="100" stroke="#2A3A4A" stroke-width="1.5" marker-end="url(#op)" />
                <line x1="322" y1="100" x2="360" y2="100" stroke="#2A3A4A" stroke-width="1.5" marker-end="url(#op)" />
                <line x1="496" y1="100" x2="534" y2="100" stroke="#2A3A4A" stroke-width="1.5" marker-end="url(#op)" />

                <path d="M255,140 L255,172 L429,172 L429,140" stroke="#94a3b8" stroke-width="1.3" fill="none" stroke-dasharray="4 3" marker-end="url(#op)" />
                <text x="342" y="188" text-anchor="middle" font-size="8.5" fill="#64748b">操作ログはすべて自動で蓄積され、履歴画面からいつでも追跡できます</text>
              </svg>
            </div>
            <figcaption class="mt-1.5 text-[10px] text-slate-500">図9-1. 運用サイクル</figcaption>
          </figure>

          <h3 class="mt-5 text-xs font-bold text-[#2A3A4A]">9-2. 運用ルール</h3>
          <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (rule of operationRules; track rule.title) {
              <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                <div class="text-[11px] font-bold text-[#2A3A4A]">{{ rule.title }}</div>
                <p class="mt-1 text-[11px] leading-relaxed text-slate-600">{{ rule.body }}</p>
              </div>
            }
          </div>

          <h3 class="mt-5 text-xs font-bold text-[#2A3A4A]">9-3. 困ったときは（トラブルシューティング）</h3>
          <div class="mt-2 overflow-x-auto rounded-md border border-slate-200/80">
            <table class="w-full min-w-[580px] text-left text-[11px]">
              <thead>
                <tr class="bg-slate-100 text-[#2A3A4A] font-bold text-[10px] tracking-wider">
                  <th class="py-2 px-3 w-2/5">症状</th>
                  <th class="py-2 px-3">対処</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (row of troubleRows; track row[0]) {
                  <tr>
                    <td class="py-2 px-3 font-medium text-slate-800">{{ row[0] }}</td>
                    <td class="py-2 px-3 text-slate-600">{{ row[1] }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============================= 10. 制約 ============================= -->
        <section id="limits" class="scroll-mt-4">
          <h2 class="text-base font-bold text-[#2A3A4A] border-b-2 border-[#2A3A4A] pb-1.5">
            10. 現時点の制約・既知の課題
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-slate-700">
            単体テスト環境として運用中のため、以下は未実装または暫定仕様です。運用時はご留意ください。
          </p>
          <ul class="mt-3 space-y-2">
            @for (limit of knownLimits; track limit.title) {
              <li class="rounded-md border border-slate-200 bg-white p-3">
                <div class="text-[11px] font-bold text-[#2A3A4A]">{{ limit.title }}</div>
                <p class="mt-0.5 text-[11px] leading-relaxed text-slate-600">{{ limit.body }}</p>
              </li>
            }
          </ul>

          <p class="mt-4 text-[10px] text-slate-400">
            この資料は HERON の実装に基づいて作成しています。仕様変更があった場合は、テスト設定ページの Ver情報とあわせて更新してください。
          </p>
        </section>
      </div>
    </div>
  `,
})
export class SystemSpecComponent {
  readonly groups = ['システムの理解', '動作の仕組み', '使い方'];

  private readonly toc = signal<TocItem[]>([
    { id: 'overview', label: '1. このシステムは何をするのか', group: 'システムの理解' },
    { id: 'architecture', label: '2. システム全体構成', group: 'システムの理解' },
    { id: 'data', label: '3. データ構造', group: 'システムの理解' },
    { id: 'numbering', label: '4. 機材IDと採番ルール', group: '動作の仕組み' },
    { id: 'lifecycle', label: '5. 機材のライフサイクル', group: '動作の仕組み' },
    { id: 'sequences', label: '6. 主要処理のシーケンス', group: '動作の仕組み' },
    { id: 'screens', label: '7. 画面構成と権限', group: '動作の仕組み' },
    { id: 'manual', label: '8. 取扱説明書・操作手順書', group: '使い方' },
    { id: 'operations', label: '9. 運用マニュアル', group: '使い方' },
    { id: 'limits', label: '10. 制約・既知の課題', group: '使い方' },
  ]);

  tocFor(group: string): TocItem[] {
    return this.toc().filter((t) => t.group === group);
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  print(): void {
    window.print();
  }

  readonly purposeCards = [
    {
      title: '1台ずつ識別する',
      body: '機材ごとに固有IDとQRコードラベルを発行し、同じ型番の機材も個体単位で区別します。',
    },
    {
      title: '所在を追跡する',
      body: 'いま誰が借りているのか、どの部屋のどの棚にあるのかを、常に台帳で確認できます。',
    },
    {
      title: '操作を記録する',
      body: '貸出・返却・棚卸し・登録・更新・除却のすべてを、操作者と時刻つきで自動記録します。',
    },
    {
      title: '棚卸しを速くする',
      body: 'スマートフォンのカメラでQRを連続で読み取り、棚単位の照合を短時間で終えられます。',
    },
  ];

  readonly problemRows: [string, string][] = [
    ['どの機材を誰が持っているか分からない', '台帳を開けば貸出先と状態がすぐ分かる'],
    ['同じ型番の機材が区別できない', '個体ごとの固有IDとQRラベルで1台ずつ識別'],
    ['棚卸しに時間がかかる', 'カメラで連続読み取りし、差異を自動で3分類'],
    ['付属品の欠品に気づけない', '機材ごとの付属品チェックリストで完備／欠品を管理'],
    ['いつ誰が動かしたのか追えない', '全操作が改ざんできない操作ログとして残る'],
  ];

  readonly stackRows: [string, string, string][] = [
    ['画面（フロントエンド）', 'Angular 20 / Tailwind CSS', '利用者が操作するすべての画面'],
    ['認証', 'Firebase Authentication', 'Google アカウントによるログイン'],
    ['データベース', 'Cloud Firestore', '機材・ログ・マスタの保存と全端末への共有'],
    ['配信', 'Firebase Hosting', '画面をインターネット経由で配信'],
    ['QR読取', '@zxing/browser', '端末のカメラでQRコードを解読'],
    ['ラベル印刷', 'NIIMBOT M2', 'ブラウザの印刷機能を通じてラベルを出力'],
  ];

  readonly collectionRows: [string, string, string][] = [
    ['equipments', '機材本体。名称・型番・カテゴリ・状態・貸出先・保管場所・付属品', '機材ID'],
    ['logs', '操作ログ。登録／更新／貸出／返却／棚卸し／除却の記録', '自動採番'],
    ['locations', '保管場所（部屋名・棚名）', '保管場所ID'],
    ['shelves', '棚マスタ（棚コード・部屋名・棚名）', '棚コード'],
    ['users', '利用者。ログインしたメンバーを自動登録', '利用者ID'],
    ['departments / categories', '部署・カテゴリのマスタ', 'コード'],
    ['counters', '機材IDの連番カウンタ', '部署_カテゴリ'],
    ['test_members', 'テスト環境にログインできるメールアドレス', 'メールアドレス'],
    ['versions', 'リリースごとの版数と変更内容', '版数'],
  ];

  readonly screenRows: [string, string, string][] = [
    ['機材台帳・検索', '機材の一覧・検索、詳細ドロワーからの登録・編集・貸出・返却・付属品確認', '全員'],
    ['棚卸し', '棚を選んでQRを連続読み取りし、所在をまとめて照合', '管理者'],
    ['保管場所', '棚コード・部屋名・棚名の登録と、棚ラベルの印刷', '管理者'],
    ['マスタ設定', '部署コード・カテゴリコードの追加と削除', '管理者'],
    ['履歴', '全機材の操作ログの閲覧', '管理者'],
    ['ラベル印刷', '機材のQRコードラベルを印刷', '管理者'],
    ['仕様書', '基本設計仕様書（PDF）の閲覧とダウンロード', '全員'],
    ['システム仕様書', '本資料。構成図・手順書・運用マニュアル', '全員'],
    ['テスト設定', 'アクセス許可メンバーの管理と Ver情報の記録', '管理者'],
  ];

  readonly procedures = [
    {
      title: '機材を新しく登録する',
      where: '機材台帳・検索',
      steps: [
        '画面右上の「新規登録」を押し、右側のドロワーを開く。',
        '機材名（必須）、部署、カテゴリ、型番を入力する。',
        '保管場所のプルダウンから、置き場所の棚を選ぶ。',
        '付属品チェックリストを確認し、不要な項目は削除、足りない項目は追加する。',
        '「登録する」を押す。機材IDが自動採番され、詳細画面に切り替わる。',
        '続けてラベルを印刷し、機材本体の見やすい位置に貼る。',
      ],
      note: '機材IDは自動採番のため入力欄はありません。番号は部署とカテゴリの組み合わせごとに連番となります。',
    },
    {
      title: '機材を貸し出す',
      where: '機材台帳・検索',
      steps: [
        '機材のQRラベルをカメラで読み取るか、一覧から対象の機材を選ぶ。',
        '詳細ドロワーで、現在の状態が「保管中」であることを確認する。',
        '貸出先の利用者を選ぶ。',
        '返却時に戻す棚を選ぶ。',
        '「貸出する」を押す。状態が「貸出中」に変わり、操作ログが記録される。',
      ],
      note: 'すでに貸出中の機材は二重に貸し出せません。エラーが出た場合は、先に返却処理を済ませてください。',
    },
    {
      title: '機材を返却する',
      where: '機材台帳・検索',
      steps: [
        '返却された機材のQRラベルを読み取る、または一覧から選ぶ。',
        '詳細ドロワーで、状態が「貸出中」であることを確認する。',
        '付属品チェックリストで、付属品がすべて揃っているかを確認する。',
        '欠品があればチェックを外す（この時点で記録が更新される）。',
        '「返却する」を押す。状態が「保管中」に戻る。',
        '機材を所定の棚に戻す。',
      ],
      note: '付属品のチェックを付け外しした時点でも操作ログが残るため、いつ欠品が判明したかを後から追えます。',
    },
    {
      title: '棚卸しを行う',
      where: '棚卸し',
      steps: [
        '棚卸しを行う棚を選択して「開始」を押す。',
        'その棚にある機材のQRラベルを、順番にカメラで読み取る。',
        '読み取った機材IDが画面に積み上がっていくことを確認する（重複は自動で無視される）。',
        'QRが読めない機材は、機材IDを手入力で追加する。',
        'すべて読み終えたら「棚卸しを実行」を押す。',
        '結果画面で「未読取」と「未登録」を確認し、現物を探すか台帳を修正する。',
      ],
      note: '棚卸しでは機材の状態（保管中・貸出中）は変わりません。更新されるのは所在（棚）だけです。',
    },
    {
      title: 'ラベルを印刷して貼る',
      where: '機材台帳・検索 → ラベル印刷',
      steps: [
        '機材の詳細から「ラベル印刷」を開く。',
        'プレビューで機材IDとQRコードが正しいことを確認する。',
        'NIIMBOT M2 の電源を入れ、ラベルをセットする。',
        'ブラウザの印刷ダイアログでプリンタに NIIMBOT M2 を選び、印刷する。',
        '機材本体の、汚れにくく読み取りやすい平らな面に貼る。',
      ],
      note: '棚のラベルは「保管場所」画面から棚ごとに印刷できます。棚にも貼っておくと棚卸しが速くなります。',
    },
    {
      title: 'テストメンバーを追加する',
      where: 'テスト設定',
      steps: [
        'テスト設定ページを開く。',
        '「新規許可メールアドレス」に、追加する Google アカウントのメールアドレスを入力する。',
        '「テストメンバーを追加」を押す。',
        '一覧に追加されたことを確認する（全端末に即時反映される）。',
        '本人にログインしてもらい、アクセスできることを確認する。',
      ],
      note: '社内ドメイン（@ajiado.co.jp）のアカウントは、登録しなくても自動的にログインできます。',
    },
    {
      title: 'バージョン情報を記録する',
      where: 'テスト設定',
      steps: [
        'デプロイが完了したら、テスト設定ページの Ver情報 欄を開く。',
        '機能やページの追加なら「中型アップデート」、それ以外の修正なら「小型アップデート」を選ぶ。',
        '概要を1行で入力する。',
        '変更・更新内容に、何を追加・変更・修正したのかを具体的に書く。',
        '「Ver情報を記録する」を押す。版数は自動で繰り上がる。',
      ],
      note: '版数は VER（大型）.（中型）.（小型）の形式です。大型は原則として使用しません。',
    },
  ];

  readonly operationRules = [
    {
      title: 'ラベルは受入時にその場で貼る',
      body: '登録だけして後で貼ろうとすると、どの機材がどのIDか分からなくなります。登録→印刷→貼付を1セットで行ってください。',
    },
    {
      title: '貸出と返却はその場で記録する',
      body: '後でまとめて入力すると、実物と台帳がずれます。持ち出す瞬間・戻す瞬間にQRを読む運用にしてください。',
    },
    {
      title: '棚卸しは棚単位で区切る',
      body: '複数の棚をまとめて読み取ると、所在が最後に選んだ棚に上書きされます。必ず棚ごとに実行してください。',
    },
    {
      title: '操作ログは消せない',
      body: '記録の改ざんを防ぐため、操作ログは追記のみで、後から書き換えることも削除することもできません。誤った操作は、正しい操作をやり直して記録を上書きしてください。',
    },
    {
      title: 'アクセス権はテスト設定で管理する',
      body: '退職・異動などでアクセスが不要になったメンバーは、テスト設定ページから許可解除してください。',
    },
    {
      title: 'デプロイのたびに Ver情報を残す',
      body: '何をいつ変えたのかが分からなくなると、不具合の切り分けができません。デプロイごとに必ず記録してください。',
    },
  ];

  readonly troubleRows: [string, string][] = [
    [
      'ログインできない（アクセス権限がありませんと表示される）',
      'そのGoogleアカウントが許可リストに未登録です。管理者にテスト設定ページから追加してもらってください。',
    ],
    [
      '再度ログインを求められた',
      'Google認証のセッションが切れています。操作者を正しく記録するための仕様です。もう一度ログインしてください。',
    ],
    ['カメラでQRが読めない', 'ラベルの汚れ・反射・ピントを確認してください。読めない場合は機材IDを手入力できます。'],
    ['機材IDが見つからないと表示される', 'その機材はまだ台帳に登録されていません。機材台帳から新規登録してください。'],
    ['貸出できない', '対象がすでに貸出中か、除却済みです。詳細ドロワーで現在の状態を確認してください。'],
    [
      '他の人が登録した機材が見えない',
      '画面を再読み込みしてください。データは共有されているため、最新の状態が読み込まれます。',
    ],
    ['画面の表示が古いままに見える', 'ブラウザを再読み込みしてください。それでも直らない場合は管理者に連絡してください。'],
  ];

  readonly knownLimits = [
    {
      title: '権限は全員が管理者',
      body: 'テスト環境ではログインしたメンバー全員が管理者として扱われます。一般ユーザー向けの制限は基幹システム連携時に有効化する想定です。',
    },
    {
      title: '返却先の棚が固定',
      body: '返却時に棚を選んでも、現在の実装では所在が既定の棚に設定されます。正しい棚を反映したい場合は、返却後に詳細ドロワーの編集から保管場所を変更してください。',
    },
    {
      title: '除却の操作は画面から実行できない',
      body: '除却（廃棄）の処理はシステム内部には用意されていますが、画面上のボタンとしてはまだ提供していません。',
    },
    {
      title: 'メンテナンス状態への変更は画面から実行できない',
      body: '状態としては用意されていますが、画面から「メンテナンス中」に切り替える操作は未提供です。',
    },
    {
      title: '検索は読み込み済みデータに対して行われる',
      body: '機材の検索・絞り込みは画面上のデータに対して実行されます。登録件数が大きく増えた場合は、サーバー側での検索に切り替える必要があります。',
    },
  ];
}
