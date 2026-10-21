import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-admin-spec',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="space-y-5 max-w-5xl mx-auto">
      <!-- ヘッダー -->
      <div class="flex flex-col gap-3 pb-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
              <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
              ユーザー＆ページアクセス権限管理システム 仕様書
            </h1>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A3A4A] text-[#90CFD6]">
              RBAC ＋ 個人別ページオーバーライド
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">
            申請系ページの全社員開放と、機材・アカウント管理系ページの管理者限定制御を実現する多段階アクセス制御仕様
          </p>
        </div>

        <a
          routerLink="/admin"
          class="heron-btn-primary text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <app-icon name="shield" />
          <span>管理ページへ戻る</span>
        </a>
      </div>

      <!-- 1. システム概要 -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2 border-b border-slate-100 pb-2">
          <app-icon name="shield" />
          <span>1. アクセス権限管理の基本方針</span>
        </h2>
        <p class="text-xs text-slate-600 leading-relaxed">
          HERONでは、全社員が日常業務で利用する<strong>「申請・ワークフロー系ページ（稟議申請・業務申請・BYOD申請）」</strong>と、社外秘のシリアルコードや資産情報を扱う<strong>「機材・アカウント管理系ページ（機材台帳・ライセンス管理・棚卸し・保管場所マスタ等）」</strong>を明確に分離し、ユーザーの権限レベル（Lv.1〜Lv.4）および個人別の特例設定によってページ単位でアクセス可否を制御します。
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-1">
            <div class="font-bold text-emerald-950 flex items-center gap-1.5">
              <app-icon name="check" />
              <span>全ユーザー開放領域（Lv.1 一般ユーザー〜）</span>
            </div>
            <ul class="text-[11px] text-emerald-900 space-y-1 pl-4 list-disc">
              <li><strong>稟議申請 (<code>/approval</code>)</strong>: 購入・契約・外注稟議の起案と進捗確認</li>
              <li><strong>業務申請 (<code>/work-request</code>)</strong>: 休日出勤・深夜残業・各種社内届出</li>
              <li><strong>BYOD申請 (<code>/byod</code>)</strong>: 私物端末の業務利用申請</li>
            </ul>
          </div>

          <div class="rounded-lg bg-blue-50/70 border border-blue-200 p-3.5 space-y-1">
            <div class="font-bold text-blue-950 flex items-center gap-1.5">
              <app-icon name="key" />
              <span>管理者限定領域（Lv.3 機材・アカウント管理者 / Lv.4 システム管理者）</span>
            </div>
            <ul class="text-[11px] text-blue-900 space-y-1 pl-4 list-disc">
              <li><strong>機材台帳・検索 (<code>/equipments</code>)</strong>: 機材登録・貸出返却・QR発行</li>
              <li><strong>ライセンス・アカウント管理 (<code>/licenses</code>)</strong>: Office / クリスタ / Adobe 等のシリアル管理・案内メール送信</li>
              <li><strong>棚卸し・保管場所・マスタ・履歴 (<code>/inventory</code> 他)</strong>: 資産棚卸しおよび監査ログ管理</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 2. 4段階の権限レベル（ロール）定義 -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2 border-b border-slate-100 pb-2">
          <app-icon name="user" />
          <span>2. 権限レベル（ロール）4段階定義</span>
        </h2>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-100 text-[#2A3A4A] border-b border-slate-200">
                <th class="py-2.5 px-3 font-bold">権限レベル</th>
                <th class="py-2.5 px-3 font-bold">対象者イメージ</th>
                <th class="py-2.5 px-3 font-bold">標準アクセス可能ページ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr>
                <td class="py-2.5 px-3 font-bold text-[#2A3A4A]">Lv.4 システム管理者 (<code>admin</code>)</td>
                <td class="py-2.5 px-3 text-slate-600">情報システム責任者・システムオーナー</td>
                <td class="py-2.5 px-3 text-slate-700">全ページ（管理ページ <code>/admin</code> を含むすべての機能）</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-blue-800">Lv.3 機材・アカウント管理者 (<code>asset_manager</code>)</td>
                <td class="py-2.5 px-3 text-slate-600">総務部・機材管理担当・ライセンス管理担当</td>
                <td class="py-2.5 px-3 text-slate-700">申請系全ページ ＋ 機材台帳・ライセンス管理・棚卸し・保管場所・マスタ・履歴</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-indigo-800">Lv.2 決裁・承認者 / デスク (<code>approver</code>)</td>
                <td class="py-2.5 px-3 text-slate-600">部門長・プロデューサー・制作デスク</td>
                <td class="py-2.5 px-3 text-slate-700">稟議申請・業務申請・BYOD申請・各種システム仕様書（※必要に応じて個別ページ開放可）</td>
              </tr>
              <tr>
                <td class="py-2.5 px-3 font-bold text-emerald-800">Lv.1 一般ユーザー (<code>general</code>)</td>
                <td class="py-2.5 px-3 text-slate-600">作画・CG・美術・制作進行等の一般スタッフ</td>
                <td class="py-2.5 px-3 text-slate-700">稟議申請・業務申請・BYOD申請のみ（機材台帳やライセンス管理は非表示・URL直接入力も自動リダイレクト）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 3. 判定ロジックと優先順位 -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2 border-b border-slate-100 pb-2">
          <app-icon name="key" />
          <span>3. ページアクセス判定アルゴリズムと優先順位</span>
        </h2>
        <ol class="text-xs text-slate-700 space-y-2 pl-5 list-decimal leading-relaxed">
          <li>
            <strong>アカウント状態チェック (<code>status === 'suspended'</code>)</strong>:
            一時停止に設定されたユーザーは全ページへのアクセスが即座に拒否されます。
          </li>
          <li>
            <strong>個人別ページオーバーライド判定 (<code>custom_permissions[pageKey]</code>)</strong>:
            ユーザー個別に「特例で許可 (<code>allow</code>)」が設定されているページは、基本ロールが一般ユーザーであってもアクセスが許可されます。逆に「個別に遮断 (<code>deny</code>)」が設定されている場合はアクセスが拒否されます。
          </li>
          <li>
            <strong>ロール別マトリクス判定 (<code>roleMatrix[user.role][pageKey]</code>)</strong>:
            個別オーバーライドが「ロール標準 (<code>inherit</code>)」の場合、タブ2の「権限レベル別 ページ開放マトリクス」の設定値に従って開閉が判定されます。
          </li>
          <li>
            <strong>ルートガード連動 (<code>pageAccessGuard</code>) ＆ サイドバー自動フィルタ</strong>:
            許可されていないページは左サイドバーおよびモバイル下部ナビゲーションから自動的に非表示となり、URLを直接入力した場合もそのユーザーが利用可能な最初のページ（一般ユーザーの場合は <code>/approval</code> 稟議申請ページ）へ安全にリダイレクトされます。
          </li>
        </ol>
      </section>
    </div>
  `,
})
export class AdminSpecComponent {}
