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
 * 共通シェル。
 *
 * PC では左サイドバー、モバイルでは下部タブとして同じ導線を提供する。
 * 管理者のスキャン操作はモバイル前提のため（設計書 4章 UI/UX）、
 * 主要導線は親指の届く下部に固定する。
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="flex min-h-full flex-col md:flex-row">
      <!-- サイドバー（md 以上） -->
      <aside
        class="hidden w-60 shrink-0 flex-col border-r border-heron-5 bg-heron-navy md:flex"
      >
        <div class="px-5 py-6">
          <div class="text-2xl font-bold tracking-widest text-white">HERON</div>
          <div class="mt-1 text-[11px] text-heron-5">社内機材管理システム</div>
        </div>

        <nav class="flex-1 space-y-1 px-3">
          @for (item of visibleNav(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-heron-1 text-white"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                     text-heron-5 transition hover:bg-heron-1/70 hover:text-white"
            >
              <app-icon [name]="item.icon" class="text-[1.05rem]" />
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="border-t border-heron-1 px-5 py-4">
          <div class="text-sm font-semibold text-white">{{ user()?.name }}</div>
          <div class="text-[11px] text-heron-4">{{ roleLabel() }}</div>
          <button
            type="button"
            (click)="auth.logout()"
            class="mt-3 text-xs text-heron-5 underline underline-offset-2 hover:text-white"
          >
            ログアウト
          </button>
        </div>
      </aside>

      <!-- モバイルヘッダー -->
      <header
        class="flex items-center justify-between bg-heron-navy px-4 py-3 md:hidden"
      >
        <div class="text-lg font-bold tracking-widest text-white">HERON</div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-heron-5">{{ user()?.name }}</span>
          <button
            type="button"
            (click)="auth.logout()"
            class="text-xs text-heron-5 underline underline-offset-2"
          >
            ログアウト
          </button>
        </div>
      </header>

      <!-- 本文 -->
      <main class="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <div class="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
          <router-outlet />
        </div>
      </main>

      <!-- モバイル下部タブ -->
      <nav
        class="fixed inset-x-0 bottom-0 z-20 flex border-t border-heron-5 bg-white md:hidden"
      >
        @for (item of visibleNav(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-heron-navy"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px]
                   font-medium text-heron-3"
          >
            <app-icon [name]="item.icon" class="text-[1.15rem]" />
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
    { path: '/', label: 'ホーム', icon: 'home', adminOnly: false, exact: true },
    { path: '/equipments', label: '機材', icon: 'box', adminOnly: false, exact: false },
    { path: '/scan', label: 'スキャン', icon: 'camera', adminOnly: true, exact: false },
    { path: '/inventory', label: '棚卸し', icon: 'shelf', adminOnly: true, exact: false },
    { path: '/locations', label: '保管場所', icon: 'pin', adminOnly: true, exact: false },
    { path: '/logs', label: '履歴', icon: 'clock', adminOnly: true, exact: false },
  ]);

  readonly visibleNav = computed(() =>
    this.nav().filter((item) => !item.adminOnly || this.auth.isAdmin()),
  );

  readonly roleLabel = computed(() =>
    this.auth.isAdmin() ? '管理者 (Admin)' : '一般 (General)',
  );
}
