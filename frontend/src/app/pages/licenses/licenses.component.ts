import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import {
  LICENSE_AUTH_TYPE_LABELS,
  LICENSE_STATUS_LABELS,
  LicenseAuthType,
  LicenseStatus,
  SOFTWARE_CATEGORY_LABELS,
  SoftwareCategory,
  SoftwareLicense,
} from '../../core/license.model';
import { EmailBuildOptions, LicenseService } from '../../core/license.service';
import { IconComponent } from '../../shared/icon.component';

interface UserGroupSummary {
  userName: string;
  userEmail: string;
  department: string;
  role: string;
  device: string;
  licenses: SoftwareLicense[];
}

@Component({
  selector: 'app-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <!-- 完全エッジ・トゥ・エッジ フルキャンバスコンテナ -->
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] md:min-h-screen flex flex-col bg-slate-100/80 text-slate-800 font-sans">
      <!-- トップ ヘッダーバー (Edge-to-Edge Seamless Sticky Header) -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-14 md:top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-[#2A3A4A] text-[#90CFD6] flex items-center justify-center shadow-xs shrink-0">
            <app-icon name="key" class="text-lg" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-base font-bold text-[#2A3A4A] tracking-tight">
                ライセンス・アカウント台帳
              </h1>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A3A4A] text-[#90CFD6]">
                シリアル ＆ 利用者紐付け管理
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5 truncate">
              Microsoft Office・CLIP STUDIO PAINT・Adobe Photoshop等のアカウント／シリアルコード管理と、利用者へのHTML案内メールプレビュー・送信
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <a
            routerLink="/spec/license"
            class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs transition"
          >
            <app-icon name="doc" />
            <span>仕様書</span>
          </a>
          <button
            type="button"
            (click)="openCreateModal()"
            class="heron-btn-primary text-xs font-bold shadow-xs flex items-center gap-1.5 px-3.5 py-2"
          >
            <app-icon name="plus" />
            <span>新規ライセンス・シリアル登録</span>
          </button>
        </div>
      </header>

      <!-- トースト通知 (Edge-to-Edge Banner) -->
      @if (toastMessage()) {
        <div class="bg-emerald-900 text-white px-4 md:px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b border-emerald-700 shrink-0">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px]">
              <app-icon name="check" />
            </span>
            <span>{{ toastMessage() }}</span>
          </div>
          <button type="button" (click)="toastMessage.set('')" class="text-emerald-200 hover:text-white text-sm flex items-center justify-center">
            <app-icon name="close" />
          </button>
        </div>
      }

      <!-- KPI 統計ストリップ (Edge-to-Edge 4分割グリッド) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200 bg-white shrink-0">
        <div
          (click)="statusFilter = ''; viewMode.set('list')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-white hover:bg-slate-50 cursor-pointer transition"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2A3A4A] text-[#90CFD6] font-bold text-base shrink-0">
            <app-icon name="key" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-slate-500">登録ライセンス総数</div>
            <div class="font-mono text-lg font-extrabold text-[#2A3A4A] leading-tight">
              {{ licenses().length }} <span class="text-[10px] font-normal text-slate-500">件</span>
            </div>
          </div>
        </div>

        <div
          (click)="statusFilter = statusFilter === 'assigned' ? '' : 'assigned'; viewMode.set('list')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-blue-50/25 hover:bg-blue-50/60 cursor-pointer transition"
          [class.ring-2]="statusFilter === 'assigned'"
          [class.ring-inset]="statusFilter === 'assigned'"
          [class.ring-blue-600]="statusFilter === 'assigned'"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-base shrink-0">
            <app-icon name="user" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-blue-900">スタッフ割当済 (稼働中)</div>
            <div class="font-mono text-lg font-extrabold text-blue-950 leading-tight">
              {{ countAssigned() }} <span class="text-[10px] font-normal text-slate-500">件 ({{ userGroups().length }}名)</span>
            </div>
          </div>
        </div>

        <div
          (click)="statusFilter = statusFilter === 'available' ? '' : 'available'; viewMode.set('list')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-emerald-50/25 hover:bg-emerald-50/60 cursor-pointer transition"
          [class.ring-2]="statusFilter === 'available'"
          [class.ring-inset]="statusFilter === 'available'"
          [class.ring-emerald-600]="statusFilter === 'available'"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-base shrink-0">
            <app-icon name="box" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-emerald-900">未割当 (空き在庫)</div>
            <div class="font-mono text-lg font-extrabold text-emerald-950 leading-tight">
              {{ countAvailable() }} <span class="text-[10px] font-normal text-slate-500">件</span>
            </div>
          </div>
        </div>

        <div
          (click)="viewMode.set('users')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-amber-50/25 hover:bg-amber-50/60 cursor-pointer transition"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-base shrink-0">
            <app-icon name="mail" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-amber-900">案内メール送信済</div>
            <div class="font-mono text-lg font-extrabold text-amber-950 leading-tight">
              {{ countMailSent() }} <span class="text-[10px] font-normal text-slate-500">/ {{ countAssigned() }} 件</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ビュー切替タブ ＆ 検索・フィルタバー (Edge-to-Edge Subheader) -->
      <div class="border-b border-slate-200 bg-slate-50 px-4 md:px-6 py-2.5 space-y-2.5 shrink-0">
        <div class="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <!-- 表示モード切替 -->
          <div class="inline-flex rounded-xl bg-slate-200/80 p-1 self-start">
            <button
              type="button"
              (click)="viewMode.set('list')"
              class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
              [class]="
                viewMode() === 'list'
                  ? 'bg-[#2A3A4A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              "
            >
              <app-icon name="key" />
              <span>ライセンス・シリアル一覧 ({{ filteredLicenses().length }})</span>
            </button>
            <button
              type="button"
              (click)="viewMode.set('users')"
              class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
              [class]="
                viewMode() === 'users'
                  ? 'bg-[#2A3A4A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              "
            >
              <app-icon name="user" />
              <span>スタッフ別 紐付け一覧 ({{ userGroups().length }}名)</span>
            </button>
          </div>

          <!-- 検索＆シリアルマスク一括切替 -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative flex-1 sm:w-64">
              <input
                type="search"
                [(ngModel)]="searchQuery"
                placeholder="ソフト名・利用者名・シリアル・部署で検索..."
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
              />
            </div>

            <select
              [(ngModel)]="statusFilter"
              class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
            >
              <option value="">すべての状態</option>
              <option value="assigned">割当済 (利用中)</option>
              <option value="available">未割当 (空き在庫)</option>
              <option value="maintenance">移行・調整中</option>
              <option value="expired">期限切れ・解約</option>
            </select>

            <button
              type="button"
              (click)="showAllSecrets.set(!showAllSecrets())"
              class="px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5"
              [class]="
                showAllSecrets()
                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              "
            >
              <app-icon name="eye" />
              <span>{{ showAllSecrets() ? 'シリアル・PWを隠す' : 'シリアル・PWを表示' }}</span>
            </button>
          </div>
        </div>

        <!-- アプリ種別ピルフィルタ -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            (click)="categoryFilter.set('')"
            class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition border flex items-center gap-1.5"
            [class]="
              categoryFilter() === ''
                ? 'bg-[#2A3A4A] text-white border-[#2A3A4A]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            "
          >
            <span>すべて ({{ licenses().length }})</span>
          </button>
          <button
            type="button"
            (click)="categoryFilter.set('microsoft_office')"
            class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition border flex items-center gap-1.5"
            [class]="
              categoryFilter() === 'microsoft_office'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            "
          >
            <app-icon name="doc" />
            <span>Microsoft Office / 365 ({{ countByCategory('microsoft_office') }})</span>
          </button>
          <button
            type="button"
            (click)="categoryFilter.set('clip_studio')"
            class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition border flex items-center gap-1.5"
            [class]="
              categoryFilter() === 'clip_studio'
                ? 'bg-indigo-700 text-white border-indigo-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            "
          >
            <app-icon name="edit" />
            <span>CLIP STUDIO PAINT ({{ countByCategory('clip_studio') }})</span>
          </button>
          <button
            type="button"
            (click)="categoryFilter.set('adobe_cc')"
            class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition border flex items-center gap-1.5"
            [class]="
              categoryFilter() === 'adobe_cc'
                ? 'bg-rose-700 text-white border-rose-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            "
          >
            <app-icon name="monitor" />
            <span>Adobe Photoshop / CC ({{ countByCategory('adobe_cc') }})</span>
          </button>
          <button
            type="button"
            (click)="categoryFilter.set('dcc_3d')"
            class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition border flex items-center gap-1.5"
            [class]="
              categoryFilter() === 'dcc_3d'
                ? 'bg-purple-700 text-white border-purple-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            "
          >
            <app-icon name="camera" />
            <span>映像・3DCGツール ({{ countByCategory('dcc_3d') }})</span>
          </button>
          <button
            type="button"
            (click)="categoryFilter.set('security_utility')"
            class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition border flex items-center gap-1.5"
            [class]="
              categoryFilter() === 'security_utility'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            "
          >
            <app-icon name="shield" />
            <span>セキュリティ・業務 ({{ countByCategory('security_utility') }})</span>
          </button>
        </div>
      </div>

      <!-- =========================================================================
           ビュー1: ライセンス・シリアル台帳一覧 (Edge-to-Edge Full-Width Rows)
           ========================================================================= -->
      @if (viewMode() === 'list') {
        <div class="flex-1 bg-white divide-y divide-slate-200 border-b border-slate-200">
          @for (lic of filteredLicenses(); track lic.id) {
            <div
              class="px-4 md:px-6 py-4 transition hover:bg-slate-50/70"
              [class]="lic.status === 'available' ? 'bg-emerald-50/10' : 'bg-white'"
            >
              <div class="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:justify-between">
                <!-- 左: ソフト概要 ＆ シリアル・アカウント情報 -->
                <div class="space-y-2.5 flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-[#2A3A4A] border border-slate-200">
                      {{ lic.management_code }}
                    </span>
                    <span
                      class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                      [class]="getCategoryBadgeClass(lic.category)"
                    >
                      {{ getCategoryLabel(lic.category) }}
                    </span>
                    <span
                      class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                      [class]="getStatusBadgeClass(lic.status)"
                    >
                      {{ getStatusLabel(lic.status) }}
                    </span>
                    @if (lic.last_mail_sent_at) {
                      <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        <app-icon name="mail" />
                        <span>案内送信済 ({{ lic.last_mail_sent_at }})</span>
                      </span>
                    }
                  </div>

                  <div>
                    <h3 class="text-sm sm:text-base font-extrabold text-[#2A3A4A]">
                      {{ lic.software_name }}
                    </h3>
                    <p class="text-xs text-slate-500">
                      {{ lic.vendor }} ／ {{ lic.edition_plan }}
                      @if (lic.max_devices) {
                        <span class="ml-2 text-slate-600 font-semibold">（最大 {{ lic.max_devices }} 台まで）</span>
                      }
                    </p>
                  </div>

                  <!-- アカウントID / PW / シリアルコード ボックス -->
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200/80 text-xs">
                    <div>
                      <div class="text-[10px] font-bold text-slate-400">ログインアカウントID</div>
                      <div class="mt-0.5 flex items-center gap-1.5 font-mono font-bold text-slate-800 truncate">
                        <span class="truncate">{{ lic.account_id || '― (シリアル単体)' }}</span>
                        @if (lic.account_id) {
                          <button
                            type="button"
                            (click)="copyText(lic.account_id, 'アカウントID')"
                            class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                            title="コピー"
                          >
                            <app-icon name="copy" />
                            <span>コピー</span>
                          </button>
                        }
                      </div>
                    </div>

                    <div>
                      <div class="text-[10px] font-bold text-slate-400">初期・管理パスワード</div>
                      <div class="mt-0.5 flex items-center gap-1.5 font-mono text-slate-800">
                        @if (lic.account_password) {
                          <span>
                            {{ isSecretVisible(lic.id) ? lic.account_password : '••••••••••••' }}
                          </span>
                          <button
                            type="button"
                            (click)="toggleSecret(lic.id)"
                            class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          >
                            <app-icon name="eye" />
                            <span>{{ isSecretVisible(lic.id) ? '隠す' : '表示' }}</span>
                          </button>
                          <button
                            type="button"
                            (click)="copyText(lic.account_password, 'パスワード')"
                            class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          >
                            <app-icon name="copy" />
                            <span>コピー</span>
                          </button>
                        } @else {
                          <span class="text-slate-400">―</span>
                        }
                      </div>
                    </div>

                    <div>
                      <div class="text-[10px] font-bold text-slate-400">シリアルコード / プロダクトキー</div>
                      <div class="mt-0.5 flex items-center gap-1.5 font-mono font-bold text-rose-700">
                        @if (lic.serial_code) {
                          <span class="truncate">
                            {{ isSecretVisible(lic.id) ? lic.serial_code : maskSerial(lic.serial_code) }}
                          </span>
                          <button
                            type="button"
                            (click)="toggleSecret(lic.id)"
                            class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                          >
                            <app-icon name="eye" />
                            <span>{{ isSecretVisible(lic.id) ? '隠す' : '表示' }}</span>
                          </button>
                          <button
                            type="button"
                            (click)="copyText(lic.serial_code, 'シリアルコード')"
                            class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                          >
                            <app-icon name="copy" />
                            <span>コピー</span>
                          </button>
                        } @else {
                          <span class="text-slate-400 font-normal">― (アカウント認証)</span>
                        }
                      </div>
                    </div>
                  </div>

                  @if (lic.note) {
                    <p class="text-[11px] text-slate-500 leading-relaxed flex items-center gap-1.5">
                      <app-icon name="doc" class="text-slate-400 shrink-0" />
                      <span>{{ lic.note }}</span>
                    </p>
                  }
                </div>

                <!-- 右: 紐付けスタッフ情報 ＆ アクションボタン -->
                <div class="lg:w-80 shrink-0 flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  @if (lic.status === 'assigned' && lic.assigned_user_name) {
                    <div class="space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                          <app-icon name="user" />
                          <span>紐付け利用者</span>
                        </span>
                        <span class="text-[10px] text-slate-400">割当: {{ lic.assigned_date || '―' }}</span>
                      </div>
                      <div class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-1.5">
                        <span>{{ lic.assigned_user_name }}</span>
                        @if (lic.assigned_department) {
                          <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                            {{ lic.assigned_department }}
                          </span>
                        }
                      </div>
                      <div class="text-xs font-mono text-slate-600 truncate flex items-center gap-1.5">
                        <app-icon name="mail" class="text-slate-400 shrink-0" />
                        <span class="truncate">{{ lic.assigned_user_email || 'メールアドレス未設定' }}</span>
                      </div>
                      @if (lic.assigned_device) {
                        <div class="text-[11px] text-slate-600 truncate flex items-center gap-1.5">
                          <app-icon name="monitor" class="text-slate-400 shrink-0" />
                          <span class="truncate">{{ lic.assigned_device }}</span>
                        </div>
                      }
                      @if (lic.expiration_date) {
                        <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <app-icon name="clock" class="text-slate-400 shrink-0" />
                          <span>更新/期限: <strong class="font-semibold text-slate-700">{{ lic.expiration_date }}</strong></span>
                        </div>
                      }
                    </div>

                    <div class="pt-2 border-t border-slate-200/80 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        (click)="openEmailPreviewModal(lic)"
                        class="w-full py-2 px-3 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-[0.99]"
                      >
                        <app-icon name="mail" />
                        <span>HTML案内メールを作成・確認</span>
                      </button>
                      <button
                        type="button"
                        (click)="openAssignModal(lic)"
                        class="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition"
                      >
                        紐付け変更
                      </button>
                      <button
                        type="button"
                        (click)="openEditModal(lic)"
                        class="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        (click)="unassign(lic)"
                        class="py-1.5 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition"
                      >
                        解除
                      </button>
                    </div>
                  } @else {
                    <div class="py-3 text-center space-y-1">
                      <div class="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1">
                        <app-icon name="check" />
                        <span>未割当（空きライセンス在庫）</span>
                      </div>
                      <p class="text-[11px] text-slate-500">
                        スタッフに紐付けると、そのままHTML案内メールを作成・送信できます
                      </p>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        (click)="openAssignModal(lic)"
                        class="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <app-icon name="user" />
                        <span>スタッフに紐付ける</span>
                      </button>
                      <button
                        type="button"
                        (click)="openEmailPreviewModal(lic)"
                        class="py-2 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                        title="案内メールのプレビューを確認"
                      >
                        <app-icon name="eye" />
                        <span>メール確認</span>
                      </button>
                      <button
                        type="button"
                        (click)="openEditModal(lic)"
                        class="py-2 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                      >
                        編集
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="p-16 text-center space-y-2 bg-white">
              <div class="text-sm font-bold text-slate-700">条件に一致するライセンス・アカウントが見つかりません</div>
              <p class="text-xs text-slate-500">検索条件を変更するか、「新規ライセンス・シリアル登録」から追加してください。</p>
            </div>
          }
        </div>
      }

      <!-- =========================================================================
           ビュー2: スタッフ（利用者）別 紐付け一覧 (Edge-to-Edge Grid)
           ========================================================================= -->
      @if (viewMode() === 'users') {
        <div class="flex-1 bg-white grid grid-cols-1 md:grid-cols-2 divide-y md:divide-x divide-slate-200 border-b border-slate-200">
          @for (group of userGroups(); track group.userName + group.userEmail) {
            <div class="p-4 md:p-6 bg-white space-y-3 hover:bg-slate-50/40 transition">
              <div class="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-base font-extrabold text-[#2A3A4A]">{{ group.userName }}</span>
                    @if (group.department) {
                      <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {{ group.department }}
                      </span>
                    }
                    @if (group.role) {
                      <span class="text-[11px] text-slate-500">{{ group.role }}</span>
                    }
                  </div>
                  <div class="text-xs font-mono text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <app-icon name="mail" />
                    <span>{{ group.userEmail || 'メールアドレス未登録' }}</span>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                  保有: {{ group.licenses.length }} 件
                </span>
              </div>

              <div class="space-y-2">
                @for (lic of group.licenses; track lic.id) {
                  <div class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-mono text-[10px] font-bold text-slate-500">{{ lic.management_code }}</span>
                        <span class="text-xs font-bold text-[#2A3A4A] truncate">{{ lic.software_name }}</span>
                      </div>
                      <div class="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                        ID: {{ lic.account_id || '―' }}
                        @if (lic.serial_code) {
                          <span class="ml-2 text-rose-700">
                            Key: {{ isSecretVisible(lic.id) ? lic.serial_code : maskSerial(lic.serial_code) }}
                          </span>
                        }
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="openEmailPreviewModal(lic)"
                      class="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <app-icon name="mail" />
                      <span>案内メール</span>
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- =========================================================================
         モーダル1: HTML案内メール 作成・送信前プレビュー確認モーダル
         ========================================================================= -->
    @if (showEmailModal() && emailTargetLicense(); as targetLic) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-2 sm:p-4"
        (click)="showEmailModal.set(false)"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-6xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          (click)="$event.stopPropagation()"
        >
          <!-- モーダルヘッダー -->
          <div class="px-5 py-3.5 bg-[#2A3A4A] text-white flex items-center justify-between shrink-0">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-2 py-0.5 rounded bg-[#90CFD6]/20 text-[#90CFD6] border border-[#90CFD6]/40">
                  送信前プレビュー確認
                </span>
                <h3 class="text-sm sm:text-base font-bold">
                  HTML案内メール作成・表示内容確認（{{ targetLic.software_name }}）
                </h3>
              </div>
              <p class="text-[11px] text-slate-300 mt-0.5">
                右側のプレビュー画面で、受信者に届くHTMLメールの実際の見た目を確認してから送信・コピーできます
              </p>
            </div>
            <button
              type="button"
              (click)="showEmailModal.set(false)"
              class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm"
            >
              <app-icon name="close" />
            </button>
          </div>

          <!-- インラインエラー通知（メールアドレス未入力時など） -->
          @if (emailValidationError()) {
            <div class="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs font-bold text-rose-800 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-2">
                <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white text-[10px]">!</span>
                <span>{{ emailValidationError() }}</span>
              </div>
              <button type="button" (click)="emailValidationError.set('')" class="text-rose-500 hover:text-rose-800">
                <app-icon name="close" />
              </button>
            </div>
          }

          <!-- モーダルボディ (左: 送信設定・文面調整 / 右: リアルタイムHTMLメール表示プレビュー) -->
          <div class="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <!-- 左ペイン: 宛先・セキュリティマスク設定・補足メッセージ (5カラム) -->
            <div class="lg:col-span-5 p-4 sm:p-5 space-y-4 bg-slate-50/70 lg:overflow-y-auto">
              <div class="rounded-xl bg-white p-3.5 border border-slate-200 space-y-3 shadow-sm">
                <div class="text-xs font-bold text-[#2A3A4A] border-b border-slate-100 pb-1.5">
                  1. 宛先・件名の確認
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 mb-1">宛先スタッフ氏名</label>
                  <input
                    type="text"
                    [ngModel]="emailOptions().recipientName"
                    (ngModelChange)="updateEmailOption({ recipientName: $event })"
                    placeholder="例: 桜井 裕介"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 mb-1">送信先メールアドレス <span class="text-rose-500">*</span></label>
                  <input
                    type="email"
                    [ngModel]="emailOptions().recipientEmail"
                    (ngModelChange)="updateEmailOption({ recipientEmail: $event })"
                    placeholder="example@ajiado.co.jp"
                    class="w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    [class]="emailValidationError() && !emailOptions().recipientEmail.trim() ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 mb-1">メール件名</label>
                  <input
                    type="text"
                    [ngModel]="emailOptions().subject"
                    (ngModelChange)="updateEmailOption({ subject: $event })"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                  />
                </div>
              </div>

              <!-- セキュリティ表示切替（プレビューに即時反映） -->
              <div class="rounded-xl bg-white p-3.5 border border-slate-200 space-y-2.5 shadow-sm">
                <div class="text-xs font-bold text-[#2A3A4A] border-b border-slate-100 pb-1.5">
                  2. 機密情報（PW・シリアル）の本文表示設定
                </div>

                <label class="flex items-start gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    [ngModel]="emailOptions().includeSerial"
                    (ngModelChange)="updateEmailOption({ includeSerial: $event })"
                    class="mt-0.5 h-4 w-4 rounded text-[#2A3A4A]"
                  />
                  <span>
                    <strong class="text-slate-800">シリアルコードをメール本文にそのまま記載する</strong>
                    <span class="block text-[11px] text-slate-500">OFFにすると「XXXX-XXXX（別送）」と伏字で表示されます</span>
                  </span>
                </label>

                <label class="flex items-start gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    [ngModel]="emailOptions().includePassword"
                    (ngModelChange)="updateEmailOption({ includePassword: $event })"
                    class="mt-0.5 h-4 w-4 rounded text-[#2A3A4A]"
                  />
                  <span>
                    <strong class="text-slate-800">初期パスワードをメール本文にそのまま記載する</strong>
                    <span class="block text-[11px] text-slate-500">OFFにすると「●●●●●●●●（別送）」と伏字で表示されます</span>
                  </span>
                </label>
              </div>

              <!-- 個別補足メッセージ -->
              <div class="rounded-xl bg-white p-3.5 border border-slate-200 space-y-2 shadow-sm">
                <div class="text-xs font-bold text-[#2A3A4A]">
                  3. 管理者からの補足・個別メッセージ（任意）
                </div>
                <textarea
                  rows="3"
                  [ngModel]="emailOptions().customMessage"
                  (ngModelChange)="updateEmailOption({ customMessage: $event })"
                  placeholder="例: 第1作画室の液タブPC（DEV-TAB-00001）に導入してください。不明点があれば内線204までご連絡ください。"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                ></textarea>
                <p class="text-[10px] text-slate-400">
                  ※ 入力すると右側のHTMLプレビュー内の「管理者からの補足・個別連絡事項」枠にリアルタイム反映されます。
                </p>
              </div>

              <!-- 過去の送信履歴 -->
              @if (targetLic.mail_history && targetLic.mail_history.length > 0) {
                <div class="rounded-xl bg-blue-50/70 p-3 border border-blue-200 text-xs space-y-1">
                  <div class="font-bold text-blue-950 flex items-center gap-1.5">
                    <app-icon name="clock" />
                    <span>過去の案内メール送信履歴</span>
                  </div>
                  @for (h of targetLic.mail_history.slice(0, 3); track h.id) {
                    <div class="text-[11px] text-blue-900">
                      ・{{ h.sent_at }} ➔ {{ h.recipient_name }} ({{ h.recipient_email }}) [担当: {{ h.sent_by }}]
                    </div>
                  }
                </div>
              }
            </div>

            <!-- 右ペイン: 送信前プレビュー確認エリア (7カラム) -->
            <div class="lg:col-span-7 p-4 sm:p-5 flex flex-col min-h-0 bg-slate-100">
              <!-- プレビューモード切替バー -->
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
                <div class="flex items-center gap-1.5">
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="text-xs font-extrabold text-slate-700">送信時の表示プレビュー（リアルタイム更新）</span>
                </div>

                <div class="inline-flex rounded-lg bg-slate-200 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    (click)="emailPreviewTab.set('visual')"
                    class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                    [class]="emailPreviewTab() === 'visual' ? 'bg-white text-[#2A3A4A] shadow-sm' : 'text-slate-600 hover:text-slate-900'"
                  >
                    <app-icon name="eye" />
                    <span>HTMLメール表示</span>
                  </button>
                  <button
                    type="button"
                    (click)="emailPreviewTab.set('html')"
                    class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                    [class]="emailPreviewTab() === 'html' ? 'bg-white text-[#2A3A4A] shadow-sm' : 'text-slate-600 hover:text-slate-900'"
                  >
                    <app-icon name="doc" />
                    <span>HTMLソース</span>
                  </button>
                  <button
                    type="button"
                    (click)="emailPreviewTab.set('text')"
                    class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                    [class]="emailPreviewTab() === 'text' ? 'bg-white text-[#2A3A4A] shadow-sm' : 'text-slate-600 hover:text-slate-900'"
                  >
                    <app-icon name="doc" />
                    <span>テキスト版</span>
                  </button>
                </div>
              </div>

              <!-- メーラー風ヘッダーバー -->
              <div class="rounded-t-xl bg-white border border-b-0 border-slate-300 px-4 py-2.5 text-xs space-y-1 shrink-0">
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 font-bold w-12 shrink-0">宛先:</span>
                  <span class="font-bold text-slate-800 truncate">{{ emailOptions().recipientName || '（氏名未入力）' }} &lt;{{ emailOptions().recipientEmail || 'メールアドレス未入力' }}&gt;</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 font-bold w-12 shrink-0">件名:</span>
                  <span class="font-bold text-[#2A3A4A] truncate">{{ emailOptions().subject }}</span>
                </div>
              </div>

              <!-- プレビュー本体 -->
              <div class="flex-1 min-h-[320px] rounded-b-xl border border-slate-300 bg-slate-100 overflow-y-auto">
                @if (emailPreviewTab() === 'visual') {
                  <div [innerHTML]="safeHtmlPreview()"></div>
                } @else if (emailPreviewTab() === 'html') {
                  <pre class="p-4 text-[11px] font-mono bg-slate-900 text-slate-100 overflow-x-auto whitespace-pre-wrap leading-relaxed m-0 min-h-full">{{ rawHtmlPreview() }}</pre>
                } @else {
                  <pre class="p-4 text-xs font-mono text-slate-800 bg-white whitespace-pre-wrap leading-relaxed m-0 min-h-full">{{ plainTextPreview() }}</pre>
                }
              </div>
            </div>
          </div>

          <!-- モーダルフッター (確認後の送信アクション) -->
          <div class="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
              <app-icon name="check" class="text-emerald-600" />
              <span><strong>ヒント:</strong> 「HTMLデザインをコピー」を押して Gmail / Outlook の本文に貼り付けると、上のプレビュー通りの装飾で送信できます。</span>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                (click)="downloadHtmlEmail()"
                class="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <app-icon name="download" />
                <span>HTML保存 (.html)</span>
              </button>
              <button
                type="button"
                (click)="openInMailer()"
                class="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <app-icon name="mail" />
                <span>メーラーで開く</span>
              </button>
              <button
                type="button"
                (click)="copyRichHtmlEmail()"
                class="px-3.5 py-2 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold transition flex items-center gap-1.5"
              >
                <app-icon name="copy" />
                <span>HTMLデザインをコピー (Gmail/Outlook貼付用)</span>
              </button>
              <button
                type="button"
                (click)="confirmAndSendEmail()"
                class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5"
              >
                <app-icon name="mail" />
                <span>表示内容を確認して案内メールを送信</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- =========================================================================
         モーダル2: スタッフ紐付け（割当）モーダル
         ========================================================================= -->
    @if (showAssignModal() && assignTargetLicense(); as assignLic) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
          <div class="px-5 py-4 bg-[#2A3A4A] text-white flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold flex items-center gap-1.5">
                <app-icon name="user" class="text-[#90CFD6]" />
                <span>ライセンスの利用者紐付け設定</span>
              </h3>
              <p class="text-[11px] text-slate-300 mt-0.5">{{ assignLic.management_code }}: {{ assignLic.software_name }}</p>
            </div>
            <button type="button" (click)="showAssignModal.set(false)" class="text-slate-300 hover:text-white">
              <app-icon name="close" />
            </button>
          </div>

          <form (ngSubmit)="saveAssignment()" class="p-5 space-y-3.5 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">利用者氏名 <span class="text-rose-500">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="assignForm.assigned_user_name"
                  name="assigned_user_name"
                  placeholder="例: 桜井 裕介"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">メールアドレス (案内メール送付先) <span class="text-rose-500">*</span></label>
                <input
                  type="email"
                  [(ngModel)]="assignForm.assigned_user_email"
                  name="assigned_user_email"
                  placeholder="例: sakurai@ajiado.co.jp"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">所属部署</label>
                <select
                  [(ngModel)]="assignForm.assigned_department"
                  name="assigned_department"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="作画部">作画部</option>
                  <option value="制作部">制作部</option>
                  <option value="演出部">演出部</option>
                  <option value="CG・撮影部">CG・撮影部</option>
                  <option value="美術・色彩部">美術・色彩部</option>
                  <option value="クリエイティブ開発課">クリエイティブ開発課</option>
                  <option value="総務部">総務部</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">役職・担当工程</label>
                <input
                  type="text"
                  [(ngModel)]="assignForm.assigned_role"
                  name="assigned_role"
                  placeholder="例: デジタル原画 / 制作進行"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">導入対象端末 (機材ID / PC名)</label>
                <input
                  type="text"
                  [(ngModel)]="assignForm.assigned_device"
                  name="assigned_device"
                  placeholder="例: DEV-PC-00004 (第1作画室 PC)"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">割当日</label>
                <input
                  type="date"
                  [(ngModel)]="assignForm.assigned_date"
                  name="assigned_date"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div class="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <label class="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-blue-900">
                <input
                  type="checkbox"
                  [(ngModel)]="openPreviewAfterAssign"
                  name="openPreviewAfterAssign"
                  class="h-4 w-4 rounded"
                />
                <span>保存後に続けて「HTML案内メール確認画面」を開く</span>
              </label>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="showAssignModal.set(false)"
                  class="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white font-bold shadow-xs"
                >
                  紐付けを保存
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- =========================================================================
         モーダル3: 新規登録・編集モーダル
         ========================================================================= -->
    @if (showFormModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden my-auto">
          <div class="px-5 py-4 bg-[#2A3A4A] text-white flex items-center justify-between">
            <h3 class="text-sm font-bold flex items-center gap-1.5">
              <app-icon [name]="editingId() ? 'edit' : 'plus'" class="text-[#90CFD6]" />
              <span>{{ editingId() ? 'ライセンス・シリアル情報の編集' : '新規ソフトウェアライセンス・シリアル登録' }}</span>
            </h3>
            <button type="button" (click)="showFormModal.set(false)" class="text-slate-300 hover:text-white">
              <app-icon name="close" />
            </button>
          </div>

          <form (ngSubmit)="saveForm()" class="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">管理番号 <span class="text-rose-500">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="formData.management_code"
                  name="management_code"
                  placeholder="例: LIC-CSP-003"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">アプリ種別カテゴリ <span class="text-rose-500">*</span></label>
                <select
                  [(ngModel)]="formData.category"
                  (ngModelChange)="onCategoryChange($event)"
                  name="category"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-bold"
                >
                  <option value="microsoft_office">Microsoft Office / 365</option>
                  <option value="clip_studio">CLIP STUDIO PAINT (クリスタ)</option>
                  <option value="adobe_cc">Adobe (Photoshop / AE / CC)</option>
                  <option value="dcc_3d">映像・3DCG (Maya / Storyboard等)</option>
                  <option value="security_utility">セキュリティ・業務ツール</option>
                  <option value="other">その他アプリケーション</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">認証方式</label>
                <select
                  [(ngModel)]="formData.auth_type"
                  name="auth_type"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="serial_and_account">アカウント＋シリアル併用</option>
                  <option value="account_only">アカウントID/PWログイン型</option>
                  <option value="serial_only">シリアルコード単体型</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">ソフトウェア・製品名 <span class="text-rose-500">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="formData.software_name"
                  name="software_name"
                  placeholder="例: CLIP STUDIO PAINT EX / Adobe Photoshop CC"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">ベンダー / プラン・エディション</label>
                <input
                  type="text"
                  [(ngModel)]="formData.edition_plan"
                  name="edition_plan"
                  placeholder="例: 法人2デバイスプラン / グループ版コンプリート"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <!-- アカウント ＆ シリアル入力枠 -->
            <div class="rounded-xl bg-blue-50/60 border border-blue-200 p-3.5 space-y-3">
              <div class="font-bold text-blue-950 flex items-center gap-1.5">
                <app-icon name="key" />
                <span>アカウント ＆ シリアルコード情報</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">ログインアカウントID / メール</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.account_id"
                    name="account_id"
                    placeholder="例: csp-anim03@ajiado.co.jp"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">初期パスワード / 管理用パスワード</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.account_password"
                    name="account_password"
                    placeholder="例: CspEx#2026Anim"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="sm:col-span-2">
                  <label class="block font-bold text-slate-700 mb-1">シリアルコード / プロダクトキー / アクティベーションコード</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.serial_code"
                    name="serial_code"
                    placeholder="例: SP30EJJ-XXXX-XXXX-XXXX-XXXX"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">最大利用台数</label>
                  <input
                    type="number"
                    [(ngModel)]="formData.max_devices"
                    name="max_devices"
                    min="1"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">ポータル / ダウンロードURL</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.portal_url"
                    name="portal_url"
                    placeholder="https://portal.office.com"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">更新期限 / 有効期限</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.expiration_date"
                    name="expiration_date"
                    placeholder="例: 2027-03-31 または 永続"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <!-- 紐付け情報（任意：登録と同時に割当可能） -->
            <div class="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800 flex items-center gap-1.5">
                  <app-icon name="user" />
                  <span>利用者紐付け（空欄の場合は「空き在庫」として登録）</span>
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">利用者氏名</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.assigned_user_name"
                    name="form_user_name"
                    placeholder="例: 桜井 裕介"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">利用者メールアドレス</label>
                  <input
                    type="email"
                    [(ngModel)]="formData.assigned_user_email"
                    name="form_user_email"
                    placeholder="例: sakurai@ajiado.co.jp"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">所属部署</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.assigned_department"
                    name="form_dept"
                    placeholder="例: 作画部 / 制作部"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">導入端末・PC名</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.assigned_device"
                    name="form_device"
                    placeholder="例: DEV-TAB-00001"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">備考・管理メモ</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.note"
                    name="form_note"
                    placeholder="例: 第2期作画スタッフ増員分"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-200 flex items-center justify-between">
              @if (editingId()) {
                <button
                  type="button"
                  (click)="deleteCurrentLicense()"
                  class="px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-1.5"
                >
                  <app-icon name="trash" />
                  <span>削除する</span>
                </button>
              } @else {
                <span></span>
              }

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="showFormModal.set(false)"
                  class="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  class="px-5 py-2 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white font-bold shadow-xs"
                >
                  保存する
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class LicensesComponent {
  readonly licenseService = inject(LicenseService);
  readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly licenses = this.licenseService.licenses;

  readonly viewMode = signal<'list' | 'users'>('list');
  readonly categoryFilter = signal<string>('');
  readonly showAllSecrets = signal<boolean>(false);
  readonly revealedIds = signal<Set<string>>(new Set());
  readonly toastMessage = signal<string>('');

  searchQuery = '';
  statusFilter = '';

  // モーダル制御
  readonly showEmailModal = signal<boolean>(false);
  readonly emailTargetLicense = signal<SoftwareLicense | null>(null);
  readonly emailPreviewTab = signal<'visual' | 'html' | 'text'>('visual');
  readonly emailValidationError = signal<string>('');

  readonly emailOptions = signal<EmailBuildOptions>({
    recipientName: '',
    recipientEmail: '',
    subject: '',
    includePassword: true,
    includeSerial: true,
    customMessage: '',
    senderName: '情報システム担当',
  });

  readonly showAssignModal = signal<boolean>(false);
  readonly assignTargetLicense = signal<SoftwareLicense | null>(null);
  openPreviewAfterAssign = true;
  assignForm = {
    assigned_user_name: '',
    assigned_user_email: '',
    assigned_department: '作画部',
    assigned_role: '',
    assigned_device: '',
    assigned_date: new Date().toISOString().slice(0, 10),
  };

  readonly showFormModal = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);
  formData = this.getEmptyForm();

  // KPI 計算
  readonly countAssigned = computed(
    () => this.licenses().filter((l) => l.status === 'assigned').length
  );
  readonly countAvailable = computed(
    () => this.licenses().filter((l) => l.status === 'available').length
  );
  readonly countMailSent = computed(
    () =>
      this.licenses().filter(
        (l) => l.status === 'assigned' && Boolean(l.last_mail_sent_at)
      ).length
  );

  // プレビュー用のメモ化 Computed シグナル（入力変更時のみ再計算し、DOM再生成によるスクロール飛びを防止）
  readonly rawHtmlPreview = computed<string>(() => {
    const lic = this.emailTargetLicense();
    if (!lic) return '';
    return this.licenseService.buildHtmlEmail(lic, this.emailOptions());
  });

  readonly rawBodyHtmlPreview = computed<string>(() => {
    const lic = this.emailTargetLicense();
    if (!lic) return '';
    return this.licenseService.buildHtmlEmailBody(lic, this.emailOptions());
  });

  readonly plainTextPreview = computed<string>(() => {
    const lic = this.emailTargetLicense();
    if (!lic) return '';
    return this.licenseService.buildPlainTextEmail(lic, this.emailOptions());
  });

  readonly safeHtmlPreview = computed<SafeHtml>(() => {
    return this.sanitizer.bypassSecurityTrustHtml(this.rawBodyHtmlPreview());
  });

  filteredLicenses(): SoftwareLicense[] {
    const q = this.searchQuery.trim().toLowerCase();
    const cat = this.categoryFilter();
    const st = this.statusFilter;

    return this.licenses().filter((l) => {
      if (cat && l.category !== cat) return false;
      if (st && l.status !== st) return false;
      if (!q) return true;

      return (
        l.software_name.toLowerCase().includes(q) ||
        l.management_code.toLowerCase().includes(q) ||
        (l.assigned_user_name || '').toLowerCase().includes(q) ||
        (l.assigned_user_email || '').toLowerCase().includes(q) ||
        (l.assigned_department || '').toLowerCase().includes(q) ||
        (l.account_id || '').toLowerCase().includes(q) ||
        (l.serial_code || '').toLowerCase().includes(q) ||
        (l.assigned_device || '').toLowerCase().includes(q)
      );
    });
  }

  readonly userGroups = computed<UserGroupSummary[]>(() => {
    const map = new Map<string, UserGroupSummary>();
    for (const lic of this.licenses()) {
      if (lic.status !== 'assigned' || !lic.assigned_user_name) continue;
      const key = `${lic.assigned_user_name}__${lic.assigned_user_email || ''}`;
      const existing = map.get(key);
      if (existing) {
        existing.licenses.push(lic);
      } else {
        map.set(key, {
          userName: lic.assigned_user_name,
          userEmail: lic.assigned_user_email || '',
          department: lic.assigned_department || '',
          role: lic.assigned_role || '',
          device: lic.assigned_device || '',
          licenses: [lic],
        });
      }
    }
    return Array.from(map.values());
  });

  countByCategory(cat: SoftwareCategory): number {
    return this.licenses().filter((l) => l.category === cat).length;
  }

  getCategoryLabel(cat: SoftwareCategory): string {
    return SOFTWARE_CATEGORY_LABELS[cat] || cat;
  }

  getStatusLabel(st: LicenseStatus): string {
    return LICENSE_STATUS_LABELS[st] || st;
  }

  getCategoryBadgeClass(cat: SoftwareCategory): string {
    switch (cat) {
      case 'microsoft_office':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'clip_studio':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'adobe_cc':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'dcc_3d':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'security_utility':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  getStatusBadgeClass(st: LicenseStatus): string {
    switch (st) {
      case 'assigned':
        return 'bg-blue-600 text-white border-blue-600';
      case 'available':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'maintenance':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'expired':
        return 'bg-slate-200 text-slate-600 border-slate-300';
    }
  }

  isSecretVisible(id: string): boolean {
    return this.showAllSecrets() || this.revealedIds().has(id);
  }

  toggleSecret(id: string): void {
    const next = new Set(this.revealedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.revealedIds.set(next);
  }

  maskSerial(serial: string): string {
    if (!serial) return '';
    if (serial.length <= 8) return '••••••••';
    return serial.slice(0, 6) + '-••••-••••-' + serial.slice(-4);
  }

  async copyText(text: string | undefined, label: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(`${label}をクリップボードにコピーしました`);
    } catch {
      this.showToast(`${label}のコピーに失敗しました`);
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set('');
      }
    }, 4000);
  }

  // --- HTML案内メール プレビュー ＆ 送信 ---

  updateEmailOption(patch: Partial<EmailBuildOptions>): void {
    this.emailOptions.update((prev) => ({ ...prev, ...patch }));
    if (patch.recipientEmail !== undefined && patch.recipientEmail.trim()) {
      this.emailValidationError.set('');
    }
  }

  openEmailPreviewModal(lic: SoftwareLicense): void {
    this.emailTargetLicense.set(lic);
    this.emailPreviewTab.set('visual');
    this.emailValidationError.set('');
    const currentUser = this.auth.user();
    this.emailOptions.set({
      recipientName: lic.assigned_user_name || '',
      recipientEmail: lic.assigned_user_email || '',
      subject: `【HERON】${lic.software_name} ライセンス・アカウント割当のご案内 (${lic.management_code})`,
      includePassword: true,
      includeSerial: true,
      customMessage: lic.assigned_device
        ? `対象端末「${lic.assigned_device}」にてセットアップを行ってください。`
        : '',
      senderName: currentUser?.name || '情報システム・機材管理担当',
    });
    this.showEmailModal.set(true);
  }

  async copyRichHtmlEmail(): Promise<void> {
    const bodyHtml = this.rawBodyHtmlPreview();
    const fullHtml = this.rawHtmlPreview();
    const text = this.plainTextPreview();
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/html': new Blob([bodyHtml], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
        this.showToast(
          'HTMLデザインのままクリップボードにコピーしました！GmailやOutlookの本文にそのまま貼り付けできます。'
        );
        return;
      }
    } catch {
      // fallback
    }
    await navigator.clipboard.writeText(fullHtml);
    this.showToast('HTMLソースをクリップボードにコピーしました');
  }

  downloadHtmlEmail(): void {
    const lic = this.emailTargetLicense();
    if (!lic) return;
    const html = this.rawHtmlPreview();
    const opts = this.emailOptions();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ライセンス案内_${lic.management_code}_${opts.recipientName || 'user'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('HTMLメールファイルをダウンロードしました');
  }

  openInMailer(): void {
    const opts = this.emailOptions();
    const mailto = `mailto:${encodeURIComponent(opts.recipientEmail.trim())}?subject=${encodeURIComponent(
      opts.subject
    )}&body=${encodeURIComponent(this.plainTextPreview())}`;
    window.open(mailto, '_blank');
  }

  confirmAndSendEmail(): void {
    const lic = this.emailTargetLicense();
    if (!lic) return;
    const opts = this.emailOptions();
    if (!opts.recipientEmail.trim()) {
      this.emailValidationError.set(
        '送信先メールアドレスが未入力です。左側の「1. 宛先・件名の確認」にメールアドレスを入力してください。'
      );
      return;
    }

    // 未割当ライセンスや氏名・メール変更時はライセンス台帳の紐付け情報も同期更新
    if (
      opts.recipientName.trim() &&
      (lic.status !== 'assigned' ||
        lic.assigned_user_name !== opts.recipientName.trim() ||
        lic.assigned_user_email !== opts.recipientEmail.trim())
    ) {
      this.licenseService.updateLicense(lic.id, {
        status: 'assigned',
        assigned_user_name: opts.recipientName.trim(),
        assigned_user_email: opts.recipientEmail.trim(),
        assigned_date:
          lic.assigned_date || new Date().toISOString().slice(0, 10),
      });
    }

    const updated = this.licenseService.recordMailSent(lic.id, {
      sent_by: opts.senderName,
      recipient_name: opts.recipientName.trim() || 'ご担当者',
      recipient_email: opts.recipientEmail.trim(),
      subject: opts.subject,
      included_credentials: opts.includePassword || opts.includeSerial,
    });

    if (updated) {
      this.emailTargetLicense.set(updated);
    }

    // リッチHTMLをクリップボードにも自動セットし、実送信も即座に行えるようにする
    void this.copyRichHtmlEmail();
    this.showEmailModal.set(false);
    this.showToast(
      `${opts.recipientName || 'ご担当者'} 様 (${opts.recipientEmail}) へのHTML案内メール送信を記録しました（クリップボードにHTML本文をコピー済）`
    );
  }

  // --- 利用者紐付けモーダル ---

  openAssignModal(lic: SoftwareLicense): void {
    this.assignTargetLicense.set(lic);
    this.assignForm = {
      assigned_user_name: lic.assigned_user_name || '',
      assigned_user_email: lic.assigned_user_email || '',
      assigned_department: lic.assigned_department || '作画部',
      assigned_role: lic.assigned_role || '',
      assigned_device: lic.assigned_device || '',
      assigned_date:
        lic.assigned_date || new Date().toISOString().slice(0, 10),
    };
    this.openPreviewAfterAssign = true;
    this.showAssignModal.set(true);
  }

  saveAssignment(): void {
    const lic = this.assignTargetLicense();
    if (!lic) return;
    const updated = this.licenseService.assignUser(lic.id, this.assignForm);
    this.showAssignModal.set(false);
    this.showToast(
      `「${lic.software_name}」を ${this.assignForm.assigned_user_name} 様に紐付けました`
    );
    if (updated && this.openPreviewAfterAssign) {
      this.openEmailPreviewModal(updated);
    }
  }

  unassign(lic: SoftwareLicense): void {
    if (
      !confirm(
        `${lic.assigned_user_name} 様の「${lic.software_name}」紐付けを解除し、空き在庫に戻しますか？`
      )
    ) {
      return;
    }
    this.licenseService.unassignUser(lic.id);
    this.showToast(`「${lic.software_name}」を未割当（空き在庫）に戻しました`);
  }

  // --- 新規登録・編集モーダル ---

  openCreateModal(): void {
    this.editingId.set(null);
    this.formData = this.getEmptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(lic: SoftwareLicense): void {
    this.editingId.set(lic.id);
    this.formData = {
      management_code: lic.management_code,
      category: lic.category,
      software_name: lic.software_name,
      vendor: lic.vendor,
      edition_plan: lic.edition_plan,
      auth_type: lic.auth_type,
      account_id: lic.account_id || '',
      account_password: lic.account_password || '',
      serial_code: lic.serial_code || '',
      contract_no: lic.contract_no || '',
      portal_url: lic.portal_url || '',
      max_devices: lic.max_devices || 2,
      assigned_user_name: lic.assigned_user_name || '',
      assigned_user_email: lic.assigned_user_email || '',
      assigned_department: lic.assigned_department || '作画部',
      assigned_role: lic.assigned_role || '',
      assigned_device: lic.assigned_device || '',
      assigned_date:
        lic.assigned_date || new Date().toISOString().slice(0, 10),
      expiration_date: lic.expiration_date || '',
      cost_memo: lic.cost_memo || '',
      note: lic.note || '',
    };
    this.showFormModal.set(true);
  }

  onCategoryChange(cat: SoftwareCategory): void {
    if (this.editingId()) return;
    if (cat === 'microsoft_office') {
      this.formData.software_name = 'Microsoft 365 Business Standard';
      this.formData.vendor = 'Microsoft';
      this.formData.portal_url = 'https://portal.office.com';
      this.formData.auth_type = 'account_only';
    } else if (cat === 'clip_studio') {
      this.formData.software_name = 'CLIP STUDIO PAINT EX';
      this.formData.vendor = 'CELSYS (セルシス)';
      this.formData.portal_url = 'https://accounts.clip-studio.com';
      this.formData.auth_type = 'serial_and_account';
    } else if (cat === 'adobe_cc') {
      this.formData.software_name = 'Adobe Photoshop CC / Creative Cloud';
      this.formData.vendor = 'Adobe';
      this.formData.portal_url = 'https://creativecloud.adobe.com';
      this.formData.auth_type = 'account_only';
    }
  }

  saveForm(): void {
    const hasUser = Boolean(this.formData.assigned_user_name.trim());
    const status: LicenseStatus = hasUser ? 'assigned' : 'available';

    const id = this.editingId();
    if (id) {
      this.licenseService.updateLicense(id, {
        ...this.formData,
        status,
      });
      this.showToast('ライセンス情報を更新しました');
    } else {
      this.licenseService.createLicense({
        ...this.formData,
        status,
      });
      this.showToast('新規ライセンス・シリアルを登録しました');
    }
    this.showFormModal.set(false);
  }

  deleteCurrentLicense(): void {
    const id = this.editingId();
    if (!id) return;
    if (!confirm('このライセンス情報を削除してもよろしいですか？')) return;
    this.licenseService.deleteLicense(id);
    this.showFormModal.set(false);
    this.showToast('ライセンス情報を削除しました');
  }

  private getEmptyForm() {
    const nextNum = String(this.licenses().length + 1).padStart(3, '0');
    return {
      management_code: `LIC-APP-${nextNum}`,
      category: 'clip_studio' as SoftwareCategory,
      software_name: 'CLIP STUDIO PAINT EX',
      vendor: 'CELSYS (セルシス)',
      edition_plan: '法人ボリュームライセンス (2デバイスプラン)',
      auth_type: 'serial_and_account' as LicenseAuthType,
      account_id: '',
      account_password: '',
      serial_code: '',
      contract_no: '',
      portal_url: 'https://accounts.clip-studio.com',
      max_devices: 2,
      assigned_user_name: '',
      assigned_user_email: '',
      assigned_department: '作画部',
      assigned_role: '',
      assigned_device: '',
      assigned_date: new Date().toISOString().slice(0, 10),
      expiration_date: '2027-03-31',
      cost_memo: '',
      note: '',
    };
  }
}
