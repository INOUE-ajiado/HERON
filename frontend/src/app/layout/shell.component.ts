import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { IconComponent, IconName } from '../shared/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  adminOnly: boolean;
  exact: boolean;
}

/**
 * 共通シェル (「機材台帳・検索」一本化ナビゲーション).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="flex min-h-screen flex-col md:flex-row bg-white">
      <!-- サイドバー（md 以上） -->
      <aside
        class="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-heron-navy md:flex"
      >
        <!-- ロゴ ＆ タイトルヘッダー -->
        <div class="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-sm border border-slate-200 overflow-hidden">
            <img src="icon.png" alt="HERON Logo" class="h-full w-full object-contain scale-110" />
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <div class="heron-brand-font text-lg text-white leading-none tracking-tight flex items-center">
              <span class="inline-block text-[11px] font-extrabold text-[#90CFD6] mr-0.5 relative -top-1.5 leading-none">++</span>
              <span>HERON..</span>
            </div>
            <div class="mt-1 text-[10px] text-slate-400 leading-none">社内機材管理システム</div>
          </div>
        </div>

        <nav class="flex-1 space-y-0.5 p-3">
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

        <div class="border-t border-slate-800 p-4">
          <div class="text-xs font-bold text-white">{{ user()?.name }}</div>
          <div class="text-[10px] text-slate-400">{{ roleLabel() }}</div>
          <button
            type="button"
            (click)="auth.logout()"
            class="mt-2 text-[11px] text-slate-400 underline underline-offset-2 hover:text-white"
          >
            ログアウト
          </button>
        </div>
      </aside>

      <!-- モバイルヘッダー -->
      <header
        class="flex items-center justify-between bg-heron-navy px-4 py-2.5 md:hidden shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-sm border border-slate-200 overflow-hidden">
            <img src="icon.png" alt="HERON Logo" class="h-full w-full object-contain scale-110" />
          </div>
          <div class="heron-brand-font text-base text-white tracking-tight flex items-center">
            <span class="inline-block text-[10px] font-extrabold text-[#90CFD6] mr-0.5 relative -top-1.5 leading-none">++</span>
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
      <main class="flex-1 min-w-0 overflow-x-hidden pb-20 md:pb-0 bg-white">
        <div class="w-full max-w-full px-4 py-4 md:px-6 md:py-5">
          <router-outlet />
        </div>
      </main>

      <!-- モバイル下部タブ -->
      <nav
        class="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white md:hidden"
      >
        @for (item of visibleNav(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-blue-700 font-bold"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]
                   font-medium text-slate-500"
          >
            <app-icon [name]="item.icon" class="text-base" />
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  private readonly nav = signal<NavItem[]>([
    { path: '/equipments', label: '機材台帳・検索', icon: 'box', adminOnly: false, exact: false },
    { path: '/inventory', label: '棚卸し', icon: 'shelf', adminOnly: true, exact: false },
    { path: '/locations', label: '保管場所', icon: 'pin', adminOnly: true, exact: false },
    { path: '/settings', label: 'マスタ設定', icon: 'pin', adminOnly: true, exact: false },
    { path: '/logs', label: '履歴', icon: 'clock', adminOnly: true, exact: false },
  ]);

  readonly visibleNav = computed(() =>
    this.nav().filter((item) => !item.adminOnly || this.auth.isAdmin()),
  );

  readonly roleLabel = computed(() =>
    this.auth.isAdmin() ? '管理者 (Admin)' : '一般 (General)',
  );
}
