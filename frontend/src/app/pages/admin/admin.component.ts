import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ACCESS_ROLE_META,
  APP_PAGE_DEFINITIONS,
  AccessControlService,
  AccessRole,
  AppPageDefinition,
  AppPageKey,
  ManagedUser,
  PageOverrideState,
} from '../../core/access-control.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="space-y-4">
      <!-- ページタイトルヘッダー -->
      <div class="flex flex-col gap-3 pb-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
              <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
              管理ページ（ユーザー ＆ ページアクセス権限管理）
            </h1>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A3A4A] text-[#90CFD6]">
              RBAC ＋ 個別ページ制御
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">
            HERONにログインできるユーザーの管理と、「どの権限レベル（または個人）がどのページまで開けるか」を詳細に設定します
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <a
            routerLink="/admin-spec"
            class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm transition"
          >
            <app-icon name="doc" />
            <span>権限管理仕様書</span>
          </a>
          <button
            type="button"
            (click)="syncFirestore()"
            class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm transition"
            [disabled]="access.syncing()"
          >
            <app-icon name="clock" />
            <span>{{ access.syncing() ? '同期中...' : 'Firestore同期' }}</span>
          </button>
          <button
            type="button"
            (click)="openCreateUserModal()"
            class="heron-btn-primary text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <app-icon name="plus" />
            <span>新規ユーザー追加・権限付与</span>
          </button>
        </div>
      </div>

      <!-- トースト通知 -->
      @if (toastMessage()) {
        <div class="rounded-xl bg-emerald-900 text-white px-4 py-3 text-xs font-bold shadow-lg flex items-center justify-between border border-emerald-700">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px]">
              <app-icon name="check" />
            </span>
            <span>{{ toastMessage() }}</span>
          </div>
          <button type="button" (click)="toastMessage.set('')" class="text-emerald-200 hover:text-white">
            <app-icon name="close" />
          </button>
        </div>
      }

      <!-- 権限シミュレーター（プレビュー切替バー） -->
      <div class="rounded-xl border border-slate-300 bg-gradient-to-r from-[#2A3A4A] to-slate-800 text-white p-3.5 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-[#90CFD6]/20 border border-[#90CFD6]/50 text-[#90CFD6] text-[10px] font-bold">
                権限動作シミュレーター
              </span>
              <span class="text-xs font-bold">
                各権限レベルでの「左サイドバー表示」と「アクセス可能ページ」を即座にテストできます
              </span>
            </div>
            <p class="text-[11px] text-slate-300">
              ※「一般ユーザー」に切り替えると、左メニューから機材台帳やライセンス管理が消え、稟議・業務・BYOD申請のみが表示されることを確認できます。
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              (click)="setPreviewRole(null)"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border"
              [class]="
                access.previewRole() === null
                  ? 'bg-[#90CFD6] text-[#2A3A4A] border-[#90CFD6] shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:bg-slate-700'
              "
            >
              <app-icon name="shield" />
              <span>通常表示 (システム管理者)</span>
            </button>
            <button
              type="button"
              (click)="setPreviewRole('asset_manager')"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border"
              [class]="
                access.previewRole() === 'asset_manager'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:bg-slate-700'
              "
            >
              <app-icon name="eye" />
              <span>機材・アカウント管理者視点</span>
            </button>
            <button
              type="button"
              (click)="setPreviewRole('approver')"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border"
              [class]="
                access.previewRole() === 'approver'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:bg-slate-700'
              "
            >
              <app-icon name="eye" />
              <span>承認者・デスク視点</span>
            </button>
            <button
              type="button"
              (click)="setPreviewRole('general')"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border"
              [class]="
                access.previewRole() === 'general'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-600 hover:bg-slate-700'
              "
            >
              <app-icon name="eye" />
              <span>一般ユーザー視点 (申請系のみ)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI サマリーカード -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-100/80 border border-slate-200/80 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2A3A4A] text-[#90CFD6] font-bold text-base shrink-0">
            <app-icon name="user" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-slate-500">登録管理ユーザー総数</div>
            <div class="font-mono text-lg font-extrabold text-[#2A3A4A] leading-tight">
              {{ users().length }} <span class="text-[10px] font-normal text-slate-500">名 (有効 {{ countActiveUsers() }}名)</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200/70 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white font-bold text-base shrink-0">
            <app-icon name="shield" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-blue-900">管理者 (システム / 機材・アカウント)</div>
            <div class="font-mono text-lg font-extrabold text-blue-950 leading-tight">
              {{ countAdminsAndManagers() }} <span class="text-[10px] font-normal text-slate-500">名 (台帳・シリアル管理可)</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-base shrink-0">
            <app-icon name="doc" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-emerald-900">一般・承認者 (申請系ページ中心)</div>
            <div class="font-mono text-lg font-extrabold text-emerald-950 leading-tight">
              {{ countGeneralAndApprovers() }} <span class="text-[10px] font-normal text-slate-500">名 (稟議・業務・BYOD)</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-base shrink-0">
            <app-icon name="key" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-amber-900">個別ページ特例設定ユーザー</div>
            <div class="font-mono text-lg font-extrabold text-amber-950 leading-tight">
              {{ countCustomOverrideUsers() }} <span class="text-[10px] font-normal text-slate-500">名 (個別許可・制限あり)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- メインタブ切替バー -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div class="inline-flex rounded-xl bg-slate-200/80 p-1">
          <button
            type="button"
            (click)="activeTab.set('users')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'users'
                ? 'bg-[#2A3A4A] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="user" />
            <span>1. ユーザー一覧 ＆ 個別アクセス権限 ({{ users().length }}名)</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('matrix')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'matrix'
                ? 'bg-[#2A3A4A] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="shield" />
            <span>2. 権限レベル別 ページ開放マトリクス設定</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('policy')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'policy'
                ? 'bg-[#2A3A4A] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="key" />
            <span>3. 社内ドメイン・全体ログイン制御ポリシー</span>
          </button>
        </div>
      </div>

      <!-- =========================================================================
           タブ1: ユーザー一覧 ＆ 個別アクセス権限管理
           ========================================================================= -->
      @if (activeTab() === 'users') {
        <div class="space-y-3">
          <!-- 検索・フィルタバー -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-wrap items-center gap-2 flex-1">
              <input
                type="search"
                [(ngModel)]="searchQuery"
                placeholder="氏名・メールアドレス・部署・役職で検索..."
                class="w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
              />

              <select
                [(ngModel)]="roleFilter"
                class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="">すべての権限レベル</option>
                <option value="admin">システム管理者 (Lv.4)</option>
                <option value="asset_manager">機材・アカウント管理者 (Lv.3)</option>
                <option value="approver">決裁・承認者 / デスク (Lv.2)</option>
                <option value="general">一般ユーザー / スタッフ (Lv.1)</option>
              </select>

              <select
                [(ngModel)]="statusFilter"
                class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="">すべての状態</option>
                <option value="active">ログイン許可 (有効)</option>
                <option value="suspended">一時停止・アクセス遮断</option>
              </select>
            </div>

            <div class="text-[11px] text-slate-500 font-semibold">
              表示中: <strong class="text-[#2A3A4A]">{{ filteredUsers().length }}</strong> / {{ users().length }} 名
            </div>
          </div>

          <!-- ユーザーカード一覧 -->
          <div class="grid grid-cols-1 gap-3">
            @for (u of filteredUsers(); track u.email) {
              <div
                class="rounded-xl border bg-white p-4 shadow-sm transition hover:border-slate-300"
                [class]="
                  u.status === 'suspended'
                    ? 'border-rose-200 bg-rose-50/20 opacity-80'
                    : 'border-slate-200'
                "
              >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <!-- 左: ユーザー基本情報 ＆ アクセス可能ページ一覧バッジ -->
                  <div class="space-y-2.5 flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm sm:text-base font-extrabold text-[#2A3A4A]">
                        {{ u.name }}
                      </span>
                      <span class="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {{ u.email }}
                      </span>
                      @if (u.department) {
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {{ u.department }}
                        </span>
                      }
                      @if (u.title) {
                        <span class="text-[11px] text-slate-500">{{ u.title }}</span>
                      }
                      @if (u.status === 'active') {
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <app-icon name="check" />
                          <span>アクセス許可中</span>
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                          <app-icon name="close" />
                          <span>アクセス停止・遮断中</span>
                        </span>
                      }
                    </div>

                    <!-- このユーザーが開けるページ / 開けないページの視覚化 -->
                    <div class="rounded-lg bg-slate-50 p-3 border border-slate-200/80 space-y-2">
                      <div class="flex flex-wrap items-center justify-between gap-1">
                        <span class="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                          <app-icon name="shield" class="text-[#2A3A4A]" />
                          <span>このユーザーがアクセスできるページ一覧:</span>
                        </span>
                        @if (hasCustomOverrides(u)) {
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            個別ページ特例設定あり
                          </span>
                        }
                      </div>

                      <div class="flex flex-wrap gap-1.5">
                        @for (page of allPages; track page.key) {
                          @if (access.canUserAccessPage(u, page.key)) {
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border"
                              [class]="
                                u.custom_permissions[page.key] === 'allow'
                                  ? 'bg-amber-50 text-amber-900 border-amber-400'
                                  : page.group === 'workflow'
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                    : 'bg-blue-50 text-blue-900 border-blue-200'
                              "
                            >
                              <app-icon name="check" />
                              <span>{{ page.label }}</span>
                              @if (u.custom_permissions[page.key] === 'allow') {
                                <span class="text-[9px] px-1 rounded bg-amber-200 text-amber-950">特例許可</span>
                              }
                            </span>
                          } @else {
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-slate-100/80 text-slate-400 border-slate-200 line-through"
                              title="このユーザーからは非表示・アクセス不可"
                            >
                              <span>{{ page.label }}</span>
                              @if (u.custom_permissions[page.key] === 'deny') {
                                <span class="no-underline text-[9px] px-1 rounded bg-rose-100 text-rose-800 font-bold">個別拒否</span>
                              }
                            </span>
                          }
                        }
                      </div>
                    </div>

                    @if (u.note) {
                      <p class="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <app-icon name="doc" class="text-slate-400 shrink-0" />
                        <span>{{ u.note }}</span>
                      </p>
                    }
                  </div>

                  <!-- 右: 権限レベル変更プルダウン ＆ 個別ページ設定ボタン -->
                  <div class="lg:w-80 shrink-0 flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-500 mb-1">
                        基本権限レベル（ロール）の即時切替
                      </label>
                      <select
                        [ngModel]="u.role"
                        (ngModelChange)="changeUserRole(u, $event)"
                        [disabled]="u.email === 'inoue@ajiado.co.jp'"
                        class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-[#2A3A4A] focus:outline-none focus:ring-2 focus:ring-[#2A3A4A] disabled:bg-slate-100"
                      >
                        <option value="admin">システム管理者 (Lv.4: 全ページ管理)</option>
                        <option value="asset_manager">機材・アカウント管理者 (Lv.3: 機材・シリアル)</option>
                        <option value="approver">決裁・承認者 / デスク (Lv.2: 申請・承認)</option>
                        <option value="general">一般ユーザー (Lv.1: 稟議・申請系のみ)</option>
                      </select>
                      <div class="mt-1 text-[10px] text-slate-500 leading-snug">
                        {{ getRoleDescription(u.role) }}
                      </div>
                    </div>

                    <div class="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        (click)="openEditUserModal(u)"
                        class="w-full py-2 px-3 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <app-icon name="edit" />
                        <span>詳細・ページ別の個別許可/制限を設定</span>
                      </button>

                      @if (u.email !== 'inoue@ajiado.co.jp') {
                        <button
                          type="button"
                          (click)="toggleStatus(u)"
                          class="flex-1 py-1.5 px-2.5 rounded-lg border text-[11px] font-bold transition"
                          [class]="
                            u.status === 'active'
                              ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                              : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
                          "
                        >
                          {{ u.status === 'active' ? '一時停止にする' : 'アクセス許可に戻す' }}
                        </button>
                        <button
                          type="button"
                          (click)="deleteUser(u)"
                          class="py-1.5 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition"
                        >
                          削除
                        </button>
                      } @else {
                        <span class="w-full text-center text-[10px] font-bold text-slate-400 py-1">
                          ※ システムオーナーは常時フルアクセス保護されています
                        </span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-2">
                <div class="text-sm font-bold text-slate-700">条件に一致するユーザーが見つかりません</div>
                <p class="text-xs text-slate-500">検索条件を変更するか、「新規ユーザー追加・権限付与」から登録してください。</p>
              </div>
            }
          </div>
        </div>
      }

      <!-- =========================================================================
           タブ2: 権限レベル（ロール）別 ページアクセス制御マトリクス
           ========================================================================= -->
      @if (activeTab() === 'matrix') {
        <div class="space-y-4">
          <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="space-y-1 text-xs text-blue-950">
              <div class="font-bold flex items-center gap-1.5">
                <app-icon name="shield" />
                <span>権限レベル（ロール）ごとの標準アクセス可能ページ設定</span>
              </div>
              <p class="text-[11px] text-blue-900 leading-relaxed">
                ・<strong>申請・ワークフロー系（稟議申請・業務申請・BYOD申請）</strong>は、原則として全ユーザー（一般ユーザー含む）に開放します。<br />
                ・<strong>機材台帳・ライセンス管理・棚卸し等の管理系ページ</strong>は、原則として管理者（システム管理者／機材・アカウント管理者）のみが開けるように制御します。<br />
                ・下のチェックボックスをクリックすると、各ロールがアクセスできるページをリアルタイムに切り替えられます。
              </p>
            </div>

            <button
              type="button"
              (click)="resetMatrix()"
              class="shrink-0 px-3.5 py-2 rounded-lg border border-blue-300 bg-white hover:bg-blue-100 text-blue-900 text-xs font-bold shadow-sm transition"
            >
              推奨セキュリティ設定に戻す
            </button>
          </div>

          <!-- マトリクステーブル -->
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr class="bg-[#2A3A4A] text-white">
                  <th class="py-3 px-4 w-72 font-bold">対象ページ ／ 機能区分</th>
                  <th class="py-3 px-3 font-bold">ページ概要</th>
                  @for (r of roleColumns; track r) {
                    <th class="py-3 px-3 text-center w-32 font-bold">
                      <div>{{ roleMeta[r].shortLabel }}</div>
                      <div class="text-[10px] font-normal text-[#90CFD6]">Lv.{{ roleMeta[r].level }}</div>
                    </th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                @for (group of pageGroups; track group.group) {
                  <!-- グループ見出し行 -->
                  <tr class="bg-slate-100/90">
                    <td colspan="6" class="py-2 px-4 font-extrabold text-[#2A3A4A] text-xs">
                      <span class="inline-block w-2 h-2 rounded-full mr-1.5" [class]="group.dotClass"></span>
                      {{ group.title }}
                    </td>
                  </tr>

                  @for (page of group.pages; track page.key) {
                    <tr class="hover:bg-slate-50 transition">
                      <td class="py-3 px-4">
                        <div class="font-bold text-[#2A3A4A] flex items-center gap-1.5">
                          <span>{{ page.label }}</span>
                          <code class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{{ page.path }}</code>
                        </div>
                      </td>
                      <td class="py-3 px-3 text-[11px] text-slate-600">
                        {{ page.description }}
                      </td>
                      @for (r of roleColumns; track r) {
                        <td class="py-3 px-3 text-center">
                          <button
                            type="button"
                            (click)="toggleMatrixCell(r, page.key)"
                            [disabled]="r === 'admin' && page.key === 'admin'"
                            class="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition w-24"
                            [class]="
                              access.roleMatrix()[r][page.key]
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                            "
                          >
                            @if (access.roleMatrix()[r][page.key]) {
                              <app-icon name="check" />
                              <span>開放</span>
                            } @else {
                              <app-icon name="close" />
                              <span>制限</span>
                            }
                          </button>
                        </td>
                      }
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- =========================================================================
           タブ3: 社内ドメイン・全体ログイン制御ポリシー
           ========================================================================= -->
      @if (activeTab() === 'policy') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2">
                <app-icon name="shield" />
                <span>社内ドメイン（&#64;ajiado.co.jp）ログイン＆初期権限ポリシー</span>
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                Google Workspace 認証でログインした社内スタッフに対するデフォルトのアクセス範囲を制御します
              </p>
            </div>

            <div class="space-y-4 text-xs">
              <label class="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  [ngModel]="access.domainPolicy().allowAjiadoDomain"
                  (ngModelChange)="updatePolicy({ allowAjiadoDomain: $event })"
                  class="mt-0.5 h-4 w-4 rounded text-[#2A3A4A]"
                />
                <div class="space-y-1">
                  <div class="font-bold text-slate-900">
                    社内ドメイン（&#64;ajiado.co.jp）のGoogleアカウントによるログインを許可する
                  </div>
                  <p class="text-[11px] text-slate-500 leading-relaxed">
                    ONの場合、&#64;ajiado.co.jp のメールアドレスを持つ社員は個別事前登録なしでもログインして「稟議申請」「業務申請」「BYOD申請」を利用できます。
                  </p>
                </div>
              </label>

              <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <label class="block font-bold text-slate-900">
                  未登録の社内スタッフがログインした際に自動適用する基本権限レベル
                </label>
                <select
                  [ngModel]="access.domainPolicy().defaultDomainRole"
                  (ngModelChange)="updatePolicy({ defaultDomainRole: $event })"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#2A3A4A]"
                >
                  <option value="general">一般ユーザー (Lv.1: 稟議・業務・BYOD申請のみ開放 / 機材・アカウント管理は遮断) 【推奨】</option>
                  <option value="approver">決裁・承認者 (Lv.2: 申請系 ＋ 仕様書閲覧)</option>
                  <option value="asset_manager">機材・アカウント管理者 (Lv.3: 機材台帳・ライセンス管理も開放)</option>
                </select>
                <p class="text-[11px] text-slate-500 leading-relaxed">
                  ※「一般ユーザー (Lv.1)」に設定しておくと、一般社員がログインしても稟議書などの申請系ページしか開けず、機材台帳やライセンス・シリアル管理ページは管理者として登録されたメンバーしか開けない安全な状態になります。
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2">
                <app-icon name="key" />
                <span>権限設計ガイドライン（HERON アクセス制御方式）</span>
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                ロールベース制御（RBAC）と個人別ページオーバーライドの優先順位について
              </p>
            </div>

            <div class="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div class="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
                <div class="font-bold text-emerald-950">1. 全ユーザー開放ページ（申請・ワークフロー系）</div>
                <p class="text-[11px] text-emerald-900 mt-0.5">
                  「稟議申請 (<code>/approval</code>)」「業務申請 (<code>/work-request</code>)」「BYOD申請 (<code>/byod</code>)」は日常業務で全スタッフが起案・提出するため、Lv.1（一般ユーザー）から標準で利用可能です。
                </p>
              </div>

              <div class="p-3 rounded-lg bg-blue-50/70 border border-blue-200">
                <div class="font-bold text-blue-950">2. 管理者限定ページ（機材・アカウント・シリアル管理系）</div>
                <p class="text-[11px] text-blue-900 mt-0.5">
                  「機材台帳 (<code>/equipments</code>)」「ライセンス管理 (<code>/licenses</code>)」「棚卸し (<code>/inventory</code>)」「保管場所 (<code>/locations</code>)」「マスタ設定 (<code>/settings</code>)」「操作履歴 (<code>/logs</code>)」は社外秘のシリアルコードや資産情報を含むため、原則として Lv.3 以上の管理者のみアクセス可能です。
                </p>
              </div>

              <div class="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
                <div class="font-bold text-amber-950">3. 個人別の特例ページ許可 / 制限（オーバーライド）</div>
                <p class="text-[11px] text-amber-900 mt-0.5">
                  「普段は一般ユーザーだが、制作デスク業務のため『機材台帳』だけ見られるようにしたい」といった場合、ユーザー一覧の「詳細・ページ別の個別許可/制限を設定」から1ページ単位で特例許可を付与できます。
                </p>
              </div>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- =========================================================================
         モーダル: ユーザー新規追加・編集 ＆ ページ別個別アクセス権限設定
         ========================================================================= -->
    @if (showUserModal()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-2 sm:p-4"
        (click)="showUserModal.set(false)"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          (click)="$event.stopPropagation()"
        >
          <!-- モーダルヘッダー -->
          <div class="px-5 py-3.5 bg-[#2A3A4A] text-white flex items-center justify-between shrink-0">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-2 py-0.5 rounded bg-[#90CFD6]/20 text-[#90CFD6] border border-[#90CFD6]/40">
                  ユーザー＆ページ権限設定
                </span>
                <h3 class="text-sm sm:text-base font-bold">
                  {{ isEditingUser() ? 'ユーザーの権限レベル ＆ ページ別アクセス詳細設定' : '新規アクセス許可ユーザーの登録' }}
                </h3>
              </div>
            </div>
            <button
              type="button"
              (click)="showUserModal.set(false)"
              class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
            >
              <app-icon name="close" />
            </button>
          </div>

          @if (formError()) {
            <div class="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs font-bold text-rose-800 flex items-center justify-between shrink-0">
              <span>{{ formError() }}</span>
              <button type="button" (click)="formError.set('')" class="text-rose-500">
                <app-icon name="close" />
              </button>
            </div>
          }

          <!-- モーダルボディ -->
          <div class="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 text-xs">
            <!-- 1. 基本プロフィール ＆ 基本権限レベル -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Googleアカウント (メールアドレス) <span class="text-rose-500">*</span></label>
                <input
                  type="email"
                  [(ngModel)]="userForm.email"
                  [disabled]="isEditingUser() && userForm.email === 'inoue@ajiado.co.jp'"
                  placeholder="例: staff@ajiado.co.jp"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-100"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">ユーザー氏名 <span class="text-rose-500">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="userForm.name"
                  placeholder="例: 佐藤 健太"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">アカウント状態</label>
                <select
                  [(ngModel)]="userForm.status"
                  [disabled]="userForm.email === 'inoue@ajiado.co.jp'"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-bold"
                >
                  <option value="active">アクセス許可 (有効)</option>
                  <option value="suspended">一時停止 (ログイン＆全ページ遮断)</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">所属部署</label>
                <input
                  type="text"
                  [(ngModel)]="userForm.department"
                  placeholder="例: 作画部 / 制作部 / 総務部"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">役職・担当業務</label>
                <input
                  type="text"
                  [(ngModel)]="userForm.title"
                  placeholder="例: 制作進行 / デジタル作画 / 機材管理"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">管理メモ・備考</label>
                <input
                  type="text"
                  [(ngModel)]="userForm.note"
                  placeholder="例: 第2スタジオ機材担当のため機材台帳のみ許可"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <!-- 2. 基本権限レベル（ロール）選択カード -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <div class="font-bold text-[#2A3A4A] flex items-center gap-1.5">
                <app-icon name="shield" />
                <span>基本権限レベル（ロール）の選択</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                @for (r of roleColumns; track r) {
                  <button
                    type="button"
                    (click)="userForm.role = r"
                    [disabled]="userForm.email === 'inoue@ajiado.co.jp' && r !== 'admin'"
                    class="p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5"
                    [class]="
                      userForm.role === r
                        ? 'border-[#2A3A4A] bg-[#2A3A4A] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    "
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-extrabold text-xs">{{ roleMeta[r].shortLabel }}</span>
                      <span
                        class="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        [class]="userForm.role === r ? 'bg-[#90CFD6] text-[#2A3A4A] font-bold' : 'bg-slate-100 text-slate-600'"
                      >
                        Lv.{{ roleMeta[r].level }}
                      </span>
                    </div>
                    <p
                      class="text-[10px] leading-relaxed"
                      [class]="userForm.role === r ? 'text-slate-200' : 'text-slate-500'"
                    >
                      {{ roleMeta[r].description }}
                    </p>
                  </button>
                }
              </div>
            </div>

            <!-- 3. ページ別のアクセス詳細カスタマイズ（個別許可 / 個別拒否 / ロール標準） -->
            <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div class="px-4 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="font-bold text-[#2A3A4A] flex items-center gap-1.5">
                    <app-icon name="key" />
                    <span>ページごとのアクセス権限の詳細設定（個人別オーバーライド）</span>
                  </div>
                  <p class="text-[11px] text-slate-500 mt-0.5">
                    基本は「ロール標準に従う」のままで問題ありません。特定のページだけ例外的に見せたい場合は「特例で許可」、隠したい場合は「個別に遮断」を選択してください。
                  </p>
                </div>
                <button
                  type="button"
                  (click)="clearFormOverrides()"
                  class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-600"
                >
                  すべて「ロール標準」に戻す
                </button>
              </div>

              <div class="divide-y divide-slate-100">
                @for (page of allPages; track page.key) {
                  <div class="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50/80">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-[#2A3A4A]">{{ page.label }}</span>
                        <code class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{{ page.path }}</code>
                        <span
                          class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [class]="
                            isFormPageAllowed(page.key)
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-200 text-slate-600'
                          "
                        >
                          {{ isFormPageAllowed(page.key) ? '結果: アクセス可能' : '結果: アクセス不可 (非表示)' }}
                        </span>
                      </div>
                      <div class="text-[11px] text-slate-500 truncate">{{ page.description }}</div>
                    </div>

                    <div class="inline-flex rounded-lg bg-slate-200/80 p-0.5 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        (click)="setFormPageOverride(page.key, 'inherit')"
                        class="px-2.5 py-1 rounded-md text-[11px] font-bold transition"
                        [class]="
                          getFormPageOverride(page.key) === 'inherit'
                            ? 'bg-white text-[#2A3A4A] shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        "
                      >
                        ロール標準 ({{ access.roleMatrix()[userForm.role][page.key] ? '開放' : '制限' }})
                      </button>
                      <button
                        type="button"
                        (click)="setFormPageOverride(page.key, 'allow')"
                        class="px-2.5 py-1 rounded-md text-[11px] font-bold transition"
                        [class]="
                          getFormPageOverride(page.key) === 'allow'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        "
                      >
                        特例で許可
                      </button>
                      <button
                        type="button"
                        (click)="setFormPageOverride(page.key, 'deny')"
                        [disabled]="userForm.email === 'inoue@ajiado.co.jp' && page.key === 'admin'"
                        class="px-2.5 py-1 rounded-md text-[11px] font-bold transition disabled:opacity-40"
                        [class]="
                          getFormPageOverride(page.key) === 'deny'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        "
                      >
                        個別に遮断
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- モーダルフッター -->
          <div class="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              (click)="showUserModal.set(false)"
              class="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              キャンセル
            </button>
            <button
              type="button"
              (click)="saveUserForm()"
              class="px-5 py-2 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <app-icon name="check" />
              <span>ユーザーとページ権限設定を保存</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminComponent {
  readonly access = inject(AccessControlService);
  readonly users = this.access.managedUsers;

  readonly activeTab = signal<'users' | 'matrix' | 'policy'>('users');
  readonly toastMessage = signal<string>('');

  searchQuery = '';
  roleFilter = '';
  statusFilter = '';

  readonly roleColumns: AccessRole[] = ['admin', 'asset_manager', 'approver', 'general'];
  readonly roleMeta = ACCESS_ROLE_META;
  readonly allPages = APP_PAGE_DEFINITIONS;

  readonly pageGroups: {
    group: string;
    title: string;
    dotClass: string;
    pages: AppPageDefinition[];
  }[] = [
    {
      group: 'workflow',
      title: '1. 申請・ワークフロー系ページ（全ユーザー基本開放：稟議・業務・BYOD）',
      dotClass: 'bg-emerald-500',
      pages: APP_PAGE_DEFINITIONS.filter((p) => p.group === 'workflow'),
    },
    {
      group: 'asset_admin',
      title: '2. 機材・アカウント・シリアル管理系ページ（原則：管理者のみ開放）',
      dotClass: 'bg-blue-600',
      pages: APP_PAGE_DEFINITIONS.filter((p) => p.group === 'asset_admin'),
    },
    {
      group: 'system_admin',
      title: '3. システム管理・設計仕様書系ページ',
      dotClass: 'bg-purple-600',
      pages: APP_PAGE_DEFINITIONS.filter((p) => p.group === 'system_admin'),
    },
  ];

  // KPI
  readonly countActiveUsers = computed(
    () => this.users().filter((u) => u.status === 'active').length
  );
  readonly countAdminsAndManagers = computed(
    () =>
      this.users().filter(
        (u) => u.status === 'active' && (u.role === 'admin' || u.role === 'asset_manager')
      ).length
  );
  readonly countGeneralAndApprovers = computed(
    () =>
      this.users().filter(
        (u) => u.status === 'active' && (u.role === 'general' || u.role === 'approver')
      ).length
  );
  readonly countCustomOverrideUsers = computed(
    () => this.users().filter((u) => this.hasCustomOverrides(u)).length
  );

  // モーダル制御
  readonly showUserModal = signal<boolean>(false);
  readonly isEditingUser = signal<boolean>(false);
  readonly formError = signal<string>('');

  userForm: Omit<ManagedUser, 'updated_at'> = this.getEmptyUserForm();

  filteredUsers(): ManagedUser[] {
    const q = this.searchQuery.trim().toLowerCase();
    const rf = this.roleFilter;
    const sf = this.statusFilter;

    return this.users().filter((u) => {
      if (rf && u.role !== rf) return false;
      if (sf && u.status !== sf) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.note.toLowerCase().includes(q)
      );
    });
  }

  getRoleDescription(role: AccessRole): string {
    return ACCESS_ROLE_META[role]?.description || '';
  }

  hasCustomOverrides(u: ManagedUser): boolean {
    if (!u.custom_permissions) return false;
    return Object.values(u.custom_permissions).some(
      (v) => v === 'allow' || v === 'deny'
    );
  }

  setPreviewRole(role: AccessRole | null): void {
    this.access.previewRole.set(role);
    if (role === null) {
      this.showToast('権限シミュレーターを終了し、通常の「システム管理者」表示に戻しました');
    } else {
      this.showToast(
        `現在「${ACCESS_ROLE_META[role].shortLabel}」の権限視点でサイドバーとページ制限をプレビュー中です`
      );
    }
  }

  async syncFirestore(): Promise<void> {
    await this.access.syncFromFirestore();
    this.showToast('Firestore から最新のユーザーおよびアクセス権限設定を同期しました');
  }

  async changeUserRole(user: ManagedUser, newRole: AccessRole): Promise<void> {
    await this.access.updateUserRole(user.email, newRole);
    this.showToast(
      `${user.name} 様の基本権限レベルを「${ACCESS_ROLE_META[newRole].shortLabel}」に変更しました`
    );
  }

  async toggleStatus(user: ManagedUser): Promise<void> {
    await this.access.toggleUserStatus(user.email);
    const nextLabel = user.status === 'active' ? '一時停止（アクセス遮断）' : 'アクセス許可';
    this.showToast(`${user.name} 様のアカウント状態を「${nextLabel}」に変更しました`);
  }

  async deleteUser(user: ManagedUser): Promise<void> {
    if (!confirm(`${user.name} (${user.email}) を管理一覧から削除しますか？`)) return;
    await this.access.deleteManagedUser(user.email);
    this.showToast(`${user.name} 様を削除しました`);
  }

  // --- マトリクス・ポリシー操作 ---

  async toggleMatrixCell(role: AccessRole, pageKey: AppPageKey): Promise<void> {
    await this.access.toggleRolePagePermission(role, pageKey);
    const pageLabel =
      APP_PAGE_DEFINITIONS.find((p) => p.key === pageKey)?.label || pageKey;
    const isNowOpen = this.access.roleMatrix()[role][pageKey];
    this.showToast(
      `「${ACCESS_ROLE_META[role].shortLabel}」の「${pageLabel}」へのアクセスを【${
        isNowOpen ? '開放' : '制限'
      }】に更新しました`
    );
  }

  async resetMatrix(): Promise<void> {
    await this.access.resetMatrixToDefault();
    this.showToast(
      'ページアクセス権限マトリクスを推奨セキュリティ設定（申請系は全社員開放／機材・アカウント系は管理者限定）に戻しました'
    );
  }

  async updatePolicy(patch: Parameters<AccessControlService['updateDomainPolicy']>[0]): Promise<void> {
    await this.access.updateDomainPolicy(patch);
    this.showToast('社内ドメイン・全体ログイン制御ポリシーを更新しました');
  }

  // --- ユーザー追加・詳細権限モーダル ---

  openCreateUserModal(): void {
    this.isEditingUser.set(false);
    this.formError.set('');
    this.userForm = this.getEmptyUserForm();
    this.showUserModal.set(true);
  }

  openEditUserModal(u: ManagedUser): void {
    this.isEditingUser.set(true);
    this.formError.set('');
    this.userForm = {
      email: u.email,
      name: u.name,
      department: u.department,
      title: u.title,
      role: u.role,
      status: u.status,
      custom_permissions: { ...(u.custom_permissions || {}) },
      note: u.note,
    };
    this.showUserModal.set(true);
  }

  getFormPageOverride(pageKey: AppPageKey): PageOverrideState {
    return this.userForm.custom_permissions[pageKey] || 'inherit';
  }

  setFormPageOverride(pageKey: AppPageKey, state: PageOverrideState): void {
    const next = { ...this.userForm.custom_permissions };
    if (state === 'inherit') {
      delete next[pageKey];
    } else {
      next[pageKey] = state;
    }
    this.userForm.custom_permissions = next;
  }

  clearFormOverrides(): void {
    this.userForm.custom_permissions = {};
  }

  isFormPageAllowed(pageKey: AppPageKey): boolean {
    if (this.userForm.status === 'suspended') return false;
    const ov = this.userForm.custom_permissions[pageKey];
    if (ov === 'allow') return true;
    if (ov === 'deny') return false;
    return Boolean(this.access.roleMatrix()[this.userForm.role]?.[pageKey]);
  }

  async saveUserForm(): Promise<void> {
    if (!this.userForm.email.trim() || !this.userForm.email.includes('@')) {
      this.formError.set('有効なメールアドレス（Googleアカウント）を入力してください。');
      return;
    }
    if (!this.userForm.name.trim()) {
      this.formError.set('ユーザー氏名を入力してください。');
      return;
    }

    await this.access.upsertManagedUser(this.userForm);
    this.showUserModal.set(false);
    this.showToast(
      `${this.userForm.name} 様 (${this.userForm.email}) のアクセス権限設定を保存しました`
    );
  }

  private getEmptyUserForm(): Omit<ManagedUser, 'updated_at'> {
    return {
      email: '',
      name: '',
      department: '作画部',
      title: 'スタッフ',
      role: 'general',
      status: 'active',
      custom_permissions: {},
      note: '',
    };
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set('');
      }
    }, 4500);
  }
}
