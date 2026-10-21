import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import {
  ACCESS_ROLE_META,
  AccessControlService,
  AppPageKey,
} from '../core/access-control.service';
import { AuthService } from '../core/auth.service';
import { IconComponent, IconName } from '../shared/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  pageKey: AppPageKey;
  exact: boolean;
}

/**
 * 共通シェル (ロール＆個人別ページアクセス権限連動ナビゲーション ＆ 権限プレビューバナー対応).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="flex min-h-screen flex-col md:flex-row bg-white">
      <!-- サイドバー（md 以上） -->
      <aside
        class="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-heron-navy md:flex print:hidden sticky top-0 h-screen z-20"
      >
        <!-- ロゴ ＆ タイトルヘッダー -->
        <div class="px-4 py-4 border-b border-slate-800 flex items-center gap-3 shrink-0">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-sm border border-slate-200 overflow-hidden">
            <img src="icon.png" alt="HERON Logo" class="h-full w-full object-contain scale-110" />
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <div class="heron-brand-font text-lg text-white leading-none tracking-tight flex items-center">
              <span class="inline-block text-[12px] font-[900] text-[#90CFD6] mr-0.5 relative -top-1.5 leading-none" style="-webkit-text-stroke: 0.4px #90CFD6;">++</span>
              <span>HERON..</span>
            </div>
            <div class="mt-1 text-[10px] text-slate-400 leading-none">社内機材管理システム</div>
          </div>
        </div>

        <!-- ナビゲーション (スクロールエリア) -->
        <nav class="flex-1 overflow-y-auto space-y-0.5 p-3">
          @for (item of visibleNav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-blue-600 text-white font-bold"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium
                     text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <app-icon [name]="item.icon" class="text-base" />
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <!-- サイドバー下部 (常時最下部固定: 仕様書リンク ＆ 管理設定 ＆ ログインユーザー表示) -->
        <div class="shrink-0 border-t border-slate-800 p-2.5 space-y-1 bg-heron-navy">
          @if (access.canAccessPage('specs')) {
            <!-- 基本設計書リンク (PDF) -->
            <a
              routerLink="/spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="box" class="text-sm text-[#90CFD6]" />
              <span>基本設計書</span>
            </a>

            <!-- システム仕様書 -->
            <a
              routerLink="/system-spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="doc" class="text-sm text-[#90CFD6]" />
              <span>システム仕様書</span>
            </a>

            <!-- 稟議システム仕様書 -->
            <a
              routerLink="/approval-spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="doc" class="text-sm text-[#90CFD6]" />
              <span>稟議システム仕様書</span>
            </a>

            <!-- 業務申請仕様書 -->
            <a
              routerLink="/work-request-spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="clock" class="text-sm text-[#90CFD6]" />
              <span>業務申請仕様書</span>
            </a>

            <!-- BYOD仕様書 -->
            <a
              routerLink="/byod-spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="box" class="text-sm text-[#90CFD6]" />
              <span>BYOD仕様書</span>
            </a>

            <!-- ライセンス仕様書 -->
            <a
              routerLink="/license-spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="key" class="text-sm text-[#90CFD6]" />
              <span>ライセンス仕様書</span>
            </a>

            <!-- 権限管理仕様書 -->
            <a
              routerLink="/admin-spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <app-icon name="shield" class="text-sm text-[#90CFD6]" />
              <span>権限管理仕様書</span>
            </a>
          }

          @if (access.canAccessPage('test-members')) {
            <a
              routerLink="/test-members"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-bold text-[#90CFD6] hover:bg-slate-800 hover:text-white transition border border-slate-700/60 bg-slate-900/40"
            >
              <app-icon name="user" class="text-sm" />
              <span>テスト設定・Ver情報</span>
            </a>
          }

          <div class="pt-1.5 px-1 border-t border-slate-800/80">
            <div class="text-xs font-bold text-white truncate">{{ user()?.name }}</div>
            <div class="text-[10px] text-[#90CFD6] font-semibold">{{ roleLabel() }}</div>
            <button
              type="button"
              (click)="auth.logout()"
              class="mt-1 text-[11px] text-slate-400 underline underline-offset-2 hover:text-white"
            >
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      <!-- モバイルヘッダー -->
      <header
        class="flex items-center justify-between bg-heron-navy px-4 py-2.5 md:hidden print:hidden shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-sm border border-slate-200 overflow-hidden">
            <img src="icon.png" alt="HERON Logo" class="h-full w-full object-contain scale-110" />
          </div>
          <div class="heron-brand-font text-base text-white tracking-tight flex items-center">
            <span class="inline-block text-[11px] font-[900] text-[#90CFD6] mr-0.5 relative -top-1.5 leading-none" style="-webkit-text-stroke: 0.4px #90CFD6;">++</span>
            <span>HERON..</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-300">{{ user()?.name }}</span>
          <button
            type="button"
            (click)="auth.logout()"
            class="text-xs text-slate-400 underline underline-offset-2"
          >
            ログアウト
          </button>
        </div>
      </header>

      <!-- 本文 (クリーンフルキャンバス) -->
      <main class="flex-1 min-w-0 overflow-x-hidden pb-20 md:pb-0 print:pb-0 bg-white">
        <!-- 権限シミュレーター動作中バナー -->
        @if (access.previewRole(); as simRole) {
          <div class="bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 border-b border-amber-500 print:hidden">
            <div class="flex items-center gap-2">
              <app-icon name="eye" />
              <span>
                【権限プレビュー表示中】現在「{{ getRoleShortLabel(simRole) }}」の権限視点でサイドバーとアクセス制限をシミュレートしています
              </span>
            </div>
            <div class="flex items-center gap-2">
              <a
                routerLink="/admin"
                class="px-2.5 py-1 rounded bg-slate-900/15 hover:bg-slate-900/25 text-slate-950 text-[11px] font-bold transition"
              >
                管理ページを開く
              </a>
              <button
                type="button"
                (click)="access.previewRole.set(null)"
                class="px-3 py-1 rounded bg-[#2A3A4A] text-white hover:bg-slate-800 text-[11px] font-bold transition shadow-sm"
              >
                通常表示 (管理者) に戻す
              </button>
            </div>
          </div>
        }

        <div class="w-full max-w-full px-4 py-4 md:px-6 md:py-5 print:p-0">
          <router-outlet />
        </div>
      </main>

      <!-- モバイル下部タブ (横スクロール対応で文字潰れ防止) -->
      <nav
        class="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-slate-200 bg-white md:hidden print:hidden"
      >
        @for (item of visibleNav(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-blue-700 font-bold"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="flex min-w-[68px] shrink-0 flex-1 flex-col items-center gap-0.5 px-1.5 py-2 text-[10px]
                   font-medium text-slate-500 whitespace-nowrap"
          >
            <app-icon [name]="item.icon" class="text-base" />
            <span>{{ item.label }}</span>
          </a>
        }
        @if (access.canAccessPage('specs')) {
          <a
            routerLink="/spec"
            routerLinkActive="text-blue-700 font-bold"
            class="flex min-w-[68px] shrink-0 flex-1 flex-col items-center gap-0.5 px-1.5 py-2 text-[10px] font-medium text-slate-500 whitespace-nowrap"
          >
            <app-icon name="box" class="text-base" />
            <span>基本設計書</span>
          </a>
          <a
            routerLink="/system-spec"
            routerLinkActive="text-blue-700 font-bold"
            class="flex min-w-[68px] shrink-0 flex-1 flex-col items-center gap-0.5 px-1.5 py-2 text-[10px] font-medium text-slate-500 whitespace-nowrap"
          >
            <app-icon name="doc" class="text-base" />
            <span>システム仕様</span>
          </a>
        }
      </nav>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly access = inject(AccessControlService);
  readonly user = this.auth.user;

  private readonly nav = signal<NavItem[]>([
    { path: '/equipments', label: '機材台帳・検索', icon: 'box', pageKey: 'equipments', exact: false },
    { path: '/licenses', label: 'ライセンス管理', icon: 'key', pageKey: 'licenses', exact: false },
    { path: '/approval', label: '稟議申請', icon: 'doc', pageKey: 'approval', exact: false },
    { path: '/work-request', label: '業務申請', icon: 'clock', pageKey: 'work-request', exact: false },
    { path: '/byod', label: 'BYOD申請', icon: 'box', pageKey: 'byod', exact: false },
    { path: '/inventory', label: '棚卸し', icon: 'shelf', pageKey: 'inventory', exact: false },
    { path: '/locations', label: '保管場所', icon: 'pin', pageKey: 'locations', exact: false },
    { path: '/settings', label: 'マスタ設定', icon: 'pin', pageKey: 'settings', exact: false },
    { path: '/logs', label: '履歴', icon: 'clock', pageKey: 'logs', exact: false },
    { path: '/admin', label: '管理ページ (権限)', icon: 'shield', pageKey: 'admin', exact: false },
  ]);

  readonly visibleNav = computed(() =>
    this.nav().filter((item) => this.access.canAccessPage(item.pageKey)),
  );

  readonly roleLabel = computed(() => {
    const role = this.access.effectiveRole();
    const meta = ACCESS_ROLE_META[role];
    return meta ? meta.label : '一般ユーザー (Lv.1)';
  });

  getRoleShortLabel(role: keyof typeof ACCESS_ROLE_META): string {
    return ACCESS_ROLE_META[role]?.label || role;
  }
}
