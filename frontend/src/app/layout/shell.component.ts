import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

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
  subLabel: string;
  icon: IconName;
  pageKey: AppPageKey;
  exact: boolean;
}

/**
 * 共通シェル (PC常設サイドバー ＆ スマホ専用ハンバーガー・スライドドロワーメニュー対応).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div
      class="flex min-h-screen flex-col md:flex-row bg-white"
      (touchstart)="onGlobalTouchStart($event)"
      (touchend)="onGlobalTouchEnd($event)"
    >
      <!-- ==================== PC用 常設サイドバー（md 以上） ==================== -->
      <aside
        class="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-heron-navy md:flex print:hidden sticky top-0 h-screen z-30"
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
            <a
              routerLink="/spec"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <span class="flex items-center gap-2 truncate">
                <app-icon name="doc" class="text-sm text-[#90CFD6]" />
                <span>設計書・仕様書</span>
              </span>
              <span class="px-1.5 py-0.2 rounded bg-slate-800 text-[#90CFD6] text-[9px] font-bold">
                全7編
              </span>
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
              class="mt-1 text-[11px] text-slate-400 underline underline-offset-2 hover:text-white cursor-pointer"
            >
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      <!-- ==================== スマホ専用 スティッキーヘッダー（md 未満） ==================== -->
      <header
        class="sticky top-0 z-40 flex h-14 items-center justify-between bg-heron-navy px-3 border-b border-slate-800 shadow-md md:hidden print:hidden shrink-0"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <!-- 左上 常設ハンバーガーメニューボタン（アニメーションギミック付き） -->
          <button
            type="button"
            (click)="toggleMobileMenu()"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-label="メインメニューを開閉"
            class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/90 text-white border border-slate-700/80 shadow-xs active:scale-95 transition cursor-pointer"
          >
            <div class="w-5 h-4 flex flex-col justify-between items-center">
              <span
                class="block h-0.5 w-5 bg-[#90CFD6] rounded-full transform transition-all duration-300 origin-center"
                [class.translate-y-[7px]]="mobileMenuOpen()"
                [class.rotate-45]="mobileMenuOpen()"
              ></span>
              <span
                class="block h-0.5 w-5 bg-white rounded-full transition-all duration-200"
                [class.opacity-0]="mobileMenuOpen()"
                [class.scale-x-0]="mobileMenuOpen()"
              ></span>
              <span
                class="block h-0.5 w-5 bg-[#90CFD6] rounded-full transform transition-all duration-300 origin-center"
                [class.-translate-y-[7px]]="mobileMenuOpen()"
                [class.-rotate-45]="mobileMenuOpen()"
              ></span>
            </div>
          </button>

          <!-- HERON ブランドロゴ ＆ 現在ページタイトル -->
          <a routerLink="/equipments" class="flex items-center gap-2 min-w-0">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-xs border border-slate-200 overflow-hidden">
              <img src="icon.png" alt="HERON Logo" class="h-full w-full object-contain scale-110" />
            </div>
            <div class="min-w-0">
              <div class="heron-brand-font text-sm text-white leading-none tracking-tight flex items-center">
                <span class="inline-block text-[10px] font-[900] text-[#90CFD6] mr-0.5 relative -top-1 leading-none" style="-webkit-text-stroke: 0.4px #90CFD6;">++</span>
                <span>HERON..</span>
              </div>
              <div class="text-[10px] font-bold text-[#90CFD6] truncate mt-0.5 leading-none">
                {{ currentPageTitle() }}
              </div>
            </div>
          </a>
        </div>

        <!-- 右側: ログインユーザーバッジ ＆ メニュー開閉トリガー -->
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="toggleMobileMenu()"
            class="flex items-center gap-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 px-2.5 py-1.5 text-left active:scale-95 transition cursor-pointer"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span class="text-[11px] font-bold text-slate-200 max-w-[96px] truncate">{{ user()?.name }}</span>
          </button>
        </div>
      </header>

      <!-- ==================== スマホ専用 スライドサイドドロワー（md 未満） ==================== -->
      <!-- 1. 背景オーバーレイ (フェードイン/アウト + タップで閉じる) -->
      <div
        class="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs transition-opacity duration-300 md:hidden print:hidden"
        [class.opacity-100]="mobileMenuOpen()"
        [class.pointer-events-auto]="mobileMenuOpen()"
        [class.opacity-0]="!mobileMenuOpen()"
        [class.pointer-events-none]="!mobileMenuOpen()"
        (click)="closeMobileMenu()"
        aria-hidden="true"
      ></div>

      <!-- 2. 左からスライドインするドロワー本体 -->
      <aside
        class="fixed inset-y-0 left-0 z-50 w-72 max-w-[84vw] bg-heron-navy text-white shadow-2xl border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-out md:hidden print:hidden"
        [class.translate-x-0]="mobileMenuOpen()"
        [class.-translate-x-full]="!mobileMenuOpen()"
        aria-label="スマホ用スライドサイドメニュー"
      >
        <!-- ドロワー最上部: ロゴ ＆ 閉じるボタン -->
        <div class="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-900/50">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-sm border border-slate-200 overflow-hidden">
              <img src="icon.png" alt="HERON Logo" class="h-full w-full object-contain scale-110" />
            </div>
            <div class="min-w-0">
              <div class="heron-brand-font text-base text-white leading-none tracking-tight flex items-center">
                <span class="inline-block text-[11px] font-[900] text-[#90CFD6] mr-0.5 relative -top-1 leading-none" style="-webkit-text-stroke: 0.4px #90CFD6;">++</span>
                <span>HERON..</span>
              </div>
              <div class="mt-1 text-[10px] text-slate-400 leading-none">社内機材管理システム</div>
            </div>
          </div>

          <button
            type="button"
            (click)="closeMobileMenu()"
            aria-label="メニューを閉じる"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition cursor-pointer"
          >
            <app-icon name="close" class="text-sm" />
          </button>
        </div>

        <!-- ログイン中ユーザー情報カード -->
        <div class="px-4 py-3 border-b border-slate-800/90 bg-slate-900/30 shrink-0">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">ログイン中アカウント</div>
              <div class="text-sm font-extrabold text-white truncate mt-0.5">{{ user()?.name }}</div>
              <div class="text-[11px] text-[#90CFD6] font-semibold mt-0.5">{{ roleLabel() }}</div>
            </div>
            <button
              type="button"
              (click)="logoutFromMobile()"
              class="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-rose-950/80 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-rose-200 shrink-0 transition cursor-pointer"
            >
              ログアウト
            </button>
          </div>
        </div>

        <!-- メインナビゲーションリスト (スクロール領域) -->
        <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div class="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            メインメニュー
          </div>

          @for (item of visibleNav(); track item.path) {
            <a
              [routerLink]="item.path"
              (click)="closeMobileMenu()"
              routerLinkActive="bg-blue-600 text-white shadow-xs"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-slate-200 transition hover:bg-slate-800/90 active:scale-[0.99]"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-[#90CFD6]">
                  <app-icon [name]="item.icon" class="text-base" />
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold leading-tight truncate">{{ item.label }}</div>
                  <div class="text-[10px] text-slate-400 leading-tight truncate mt-0.5">{{ item.subLabel }}</div>
                </div>
              </div>
              <svg class="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </a>
          }
        </div>

        <!-- ドロワー下部: 設計書・仕様書 ＆ テスト設定 -->
        <div class="shrink-0 border-t border-slate-800 p-3 space-y-1.5 bg-slate-900/60">
          @if (access.canAccessPage('specs')) {
            <a
              routerLink="/spec"
              (click)="closeMobileMenu()"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              <span class="flex items-center gap-2 truncate">
                <app-icon name="doc" class="text-sm text-[#90CFD6]" />
                <span>設計書・仕様書ポータル</span>
              </span>
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[#90CFD6] text-[10px] font-bold">
                全7編
              </span>
            </a>
          }

          @if (access.canAccessPage('test-members')) {
            <a
              routerLink="/test-members"
              (click)="closeMobileMenu()"
              routerLinkActive="bg-blue-600 text-white font-bold"
              class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#90CFD6] hover:bg-slate-800 transition border border-slate-700/70 bg-slate-900/50"
            >
              <span class="flex items-center gap-2 truncate">
                <app-icon name="user" class="text-sm" />
                <span>テスト設定・Ver情報</span>
              </span>
              <span class="text-[10px] font-mono text-slate-400">v1.0</span>
            </a>
          }
        </div>
      </aside>

      <!-- ==================== 本文 (クリーンフルキャンバス) ==================== -->
      <main class="flex-1 min-w-0 overflow-x-hidden bg-white">
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
                class="px-3 py-1 rounded bg-[#2A3A4A] text-white hover:bg-slate-800 text-[11px] font-bold transition shadow-sm cursor-pointer"
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
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly access = inject(AccessControlService);
  private readonly router = inject(Router);
  readonly user = this.auth.user;

  /** スマホ用スライドメニューの開閉状態 */
  readonly mobileMenuOpen = signal(false);
  readonly currentUrl = signal(this.router.url);

  private touchStartX = 0;
  private touchStartY = 0;

  private readonly nav = signal<NavItem[]>([
    {
      path: '/equipments',
      label: '機材台帳・検索',
      subLabel: '貸出・返却・シリアル管理',
      icon: 'box',
      pageKey: 'equipments',
      exact: false,
    },
    {
      path: '/licenses',
      label: 'ライセンス管理',
      subLabel: 'ソフト契約・アカウント割当',
      icon: 'key',
      pageKey: 'licenses',
      exact: false,
    },
    {
      path: '/approval',
      label: '稟議申請',
      subLabel: '新規購入・契約の承認ワークフロー',
      icon: 'doc',
      pageKey: 'approval',
      exact: false,
    },
    {
      path: '/work-request',
      label: '業務申請',
      subLabel: 'アカウント発行・権限・サポート依頼',
      icon: 'clock',
      pageKey: 'work-request',
      exact: false,
    },
    {
      path: '/byod',
      label: 'BYOD申請',
      subLabel: '私物端末の業務利用申請・審査',
      icon: 'box',
      pageKey: 'byod',
      exact: false,
    },
    {
      path: '/inventory',
      label: '棚卸し',
      subLabel: 'QR連続スキャン・実地所在照合',
      icon: 'shelf',
      pageKey: 'inventory',
      exact: false,
    },
    {
      path: '/settings',
      label: '保管場所・マスタ設定',
      subLabel: '棚コード・部署・機材カテゴリ設定',
      icon: 'pin',
      pageKey: 'settings',
      exact: false,
    },
    {
      path: '/logs',
      label: '操作履歴',
      subLabel: '全トランザクション監査ログ',
      icon: 'clock',
      pageKey: 'logs',
      exact: false,
    },
    {
      path: '/admin',
      label: '管理ページ (権限)',
      subLabel: 'ロール・機能アクセス権限の制御',
      icon: 'shield',
      pageKey: 'admin',
      exact: false,
    },
  ]);

  readonly visibleNav = computed(() =>
    this.nav().filter((item) => this.access.canAccessPage(item.pageKey)),
  );

  readonly currentPageTitle = computed(() => {
    const url = this.currentUrl();
    const matched = this.nav().find((item) => url.startsWith(item.path));
    if (matched) return matched.label;
    if (url.startsWith('/spec')) return '設計書・仕様書';
    if (url.startsWith('/test-members')) return 'テスト設定・Ver情報';
    return '社内機材管理システム';
  });

  readonly roleLabel = computed(() => {
    const role = this.access.effectiveRole();
    const meta = ACCESS_ROLE_META[role];
    return meta ? meta.label : '一般ユーザー (Lv.1)';
  });

  constructor() {
    // ルート遷移時に自動でスマホメニューを閉じる
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects || e.url);
        this.mobileMenuOpen.set(false);
      });

    // ドロワーが開いている間は背面スクロールをロック
    effect(() => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = this.mobileMenuOpen() ? 'hidden' : '';
      }
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logoutFromMobile(): void {
    this.closeMobileMenu();
    this.auth.logout();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.mobileMenuOpen()) {
      this.closeMobileMenu();
    }
  }

  /** スマホ画面左端からの右スワイプでメニューを開き、左スワイプで閉じるジェスチャー */
  onGlobalTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onGlobalTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length !== 1) return;
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    const deltaY = Math.abs(event.changedTouches[0].clientY - this.touchStartY);

    // 縦スクロール操作の場合は無視
    if (deltaY > 40) return;

    // 画面左端 (28px以内) から右へ 60px 以上スワイプしたらドロワーを開く
    if (!this.mobileMenuOpen() && this.touchStartX <= 28 && deltaX > 60) {
      this.mobileMenuOpen.set(true);
      return;
    }

    // ドロワーが開いている時に左へ 60px 以上スワイプしたらドロワーを閉じる
    if (this.mobileMenuOpen() && deltaX < -60) {
      this.mobileMenuOpen.set(false);
    }
  }

  getRoleShortLabel(role: keyof typeof ACCESS_ROLE_META): string {
    return ACCESS_ROLE_META[role]?.label || role;
  }
}
