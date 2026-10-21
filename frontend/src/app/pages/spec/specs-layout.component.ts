import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { IconComponent, IconName } from '../../shared/icon.component';

export interface SpecNavItem {
  path: string;
  title: string;
  subtitle: string;
  category: 'core' | 'workflow' | 'management';
  icon: IconName;
  badge?: string;
  relatedPagePath?: string;
  relatedPageLabel?: string;
}

export interface SpecNavCategory {
  key: 'core' | 'workflow' | 'management';
  label: string;
}

/**
 * 仕様書・設計書 統合ポータルレイアウト
 * 左サイドバー（モバイル時は上部セレクター）から全7種類の設計書・仕様書をシームレスに切り替え閲覧可能。
 */
@Component({
  selector: 'app-specs-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row bg-slate-50/60 print:m-0 print:bg-white">
      <!-- 仕様書専用サイドバー (デスクトップ lg以上) -->
      <aside class="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 h-screen overflow-y-auto print:hidden">
        <!-- サイドバーヘッダー -->
        <div class="p-4 border-b border-slate-200 bg-slate-50/80">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#2A3A4A] text-[#90CFD6] flex items-center justify-center shadow-xs shrink-0">
              <app-icon name="doc" class="text-base" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h2 class="text-xs font-extrabold text-[#2A3A4A] tracking-tight truncate">
                  設計書・仕様書ポータル
                </h2>
                <span class="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-200 text-slate-700">
                  全{{ specItems.length }}編
                </span>
              </div>
              <p class="text-[10px] text-slate-500 mt-0.5 truncate">
                サイドバーから閲覧ドキュメントを切替
              </p>
            </div>
          </div>
        </div>

        <!-- カテゴリ別 仕様書リスト -->
        <nav class="flex-1 p-3 space-y-4 overflow-y-auto">
          @for (cat of categories; track cat.key) {
            <div class="space-y-1">
              <div class="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {{ cat.label }}
              </div>
              @for (item of getItemsByCategory(cat.key); track item.path) {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-[#2A3A4A] text-white shadow-xs border-[#2A3A4A]"
                  #rla="routerLinkActive"
                  class="group flex items-start gap-2.5 rounded-xl border border-transparent px-3 py-2.5 transition-all hover:bg-slate-100"
                >
                  <div
                    class="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    [ngClass]="
                      rla.isActive
                        ? 'bg-white/15 text-[#90CFD6]'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-[#2A3A4A]'
                    "
                  >
                    <app-icon [name]="item.icon" class="text-sm" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-1">
                      <span
                        class="text-xs font-bold leading-snug truncate"
                        [ngClass]="rla.isActive ? 'text-white' : 'text-slate-800'"
                      >
                        {{ item.title }}
                      </span>
                      @if (item.badge) {
                        <span
                          class="text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0"
                          [ngClass]="
                            rla.isActive
                              ? 'bg-[#90CFD6]/20 text-[#90CFD6]'
                              : 'bg-slate-200/80 text-slate-600'
                          "
                        >
                          {{ item.badge }}
                        </span>
                      }
                    </div>
                    <div
                      class="text-[10px] mt-0.5 leading-tight truncate"
                      [ngClass]="rla.isActive ? 'text-slate-300' : 'text-slate-500'"
                    >
                      {{ item.subtitle }}
                    </div>
                  </div>
                </a>
              }
            </div>
          }
        </nav>

        <!-- サイドバー下部: 関連機能ページへのショートカット -->
        @if (activeItem(); as current) {
          @if (current.relatedPagePath) {
            <div class="p-3 border-t border-slate-200 bg-slate-50/70">
              <div class="text-[10px] font-bold text-slate-400 mb-1.5 px-1">
                対象機能の画面を開く
              </div>
              <a
                [routerLink]="current.relatedPagePath"
                class="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-xs font-bold text-[#2A3A4A] shadow-2xs transition"
              >
                <span class="flex items-center gap-1.5 truncate">
                  <app-icon [name]="current.icon" class="text-blue-700" />
                  <span class="truncate">{{ current.relatedPageLabel }}</span>
                </span>
                <span class="text-[10px] text-blue-700 shrink-0">移動 ➔</span>
              </a>
            </div>
          }
        }
      </aside>

      <!-- モバイル・タブレット用 上部切替バー (lg未満で表示) -->
      <div class="lg:hidden border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-20 shadow-2xs print:hidden">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-[#2A3A4A] text-[#90CFD6] flex items-center justify-center">
              <app-icon name="doc" class="text-xs" />
            </div>
            <span class="text-xs font-extrabold text-[#2A3A4A]">設計書・仕様書切替</span>
          </div>
          @if (activeItem(); as current) {
            @if (current.relatedPagePath) {
              <a
                [routerLink]="current.relatedPagePath"
                class="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
              >
                <span>{{ current.relatedPageLabel }}へ</span>
                <span>➔</span>
              </a>
            }
          }
        </div>
        <div class="flex gap-1.5 overflow-x-auto pb-1">
          @for (item of specItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-[#2A3A4A] text-white border-[#2A3A4A]"
              #mobileRla="routerLinkActive"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 transition"
              [ngClass]="
                mobileRla.isActive
                  ? 'bg-[#2A3A4A] text-white border-[#2A3A4A]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              "
            >
              <app-icon [name]="item.icon" class="text-xs" />
              <span>{{ item.title }}</span>
            </a>
          }
        </div>
      </div>

      <!-- 右メイン領域: 選択された仕様書の本文 -->
      <div class="flex-1 min-w-0 p-4 md:p-6 lg:p-8 print:p-0">
        <router-outlet />
      </div>
    </div>
  `,
})
export class SpecsLayoutComponent {
  private readonly router = inject(Router);

  readonly categories: SpecNavCategory[] = [
    { key: 'core', label: '1. システム全体設計' },
    { key: 'workflow', label: '2. 申請・承認ワークフロー仕様' },
    { key: 'management', label: '3. 資産・権限セキュリティ仕様' },
  ];

  readonly specItems: SpecNavItem[] = [
    {
      path: '/spec/basic',
      title: '基本設計書 (PDF)',
      subtitle: 'アーキテクチャ・データモデル・QR運用規定',
      category: 'core',
      icon: 'box',
      badge: 'PDF',
      relatedPagePath: '/equipments',
      relatedPageLabel: '機材台帳・検索ページ',
    },
    {
      path: '/spec/system',
      title: 'システム仕様書',
      subtitle: '構成図・シーケンス図・処理フロー・運用手順',
      category: 'core',
      icon: 'doc',
      badge: '全体仕様',
      relatedPagePath: '/equipments',
      relatedPageLabel: '機材台帳・検索ページ',
    },
    {
      path: '/spec/approval',
      title: '稟議システム仕様書',
      subtitle: '4段階承認プロセス・電子印影・PDF出力仕様',
      category: 'workflow',
      icon: 'doc',
      relatedPagePath: '/approval',
      relatedPageLabel: '稟議申請ページ',
    },
    {
      path: '/spec/work-request',
      title: '業務申請仕様書',
      subtitle: '休日出勤・休暇・残業申請・総務勤怠連携',
      category: 'workflow',
      icon: 'clock',
      relatedPagePath: '/work-request',
      relatedPageLabel: '業務申請ページ',
    },
    {
      path: '/spec/byod',
      title: 'BYOD利用申請仕様書',
      subtitle: '私物端末利用誓約書・機材明細書・ステッカー交付',
      category: 'workflow',
      icon: 'monitor',
      relatedPagePath: '/byod',
      relatedPageLabel: 'BYOD申請ページ',
    },
    {
      path: '/spec/license',
      title: 'ライセンス管理仕様書',
      subtitle: 'シリアル台帳・利用者割当・HTML案内メール',
      category: 'management',
      icon: 'key',
      relatedPagePath: '/licenses',
      relatedPageLabel: 'ライセンス管理ページ',
    },
    {
      path: '/spec/admin',
      title: '権限管理システム仕様書',
      subtitle: 'RBACロール制御・個人別ページアクセス制御',
      category: 'management',
      icon: 'shield',
      relatedPagePath: '/admin',
      relatedPageLabel: '管理ページ (権限)',
    },
  ];

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly activeItem = computed(() => {
    const url = this.currentUrl();
    return (
      this.specItems.find((item) => url.startsWith(item.path)) ?? this.specItems[0]
    );
  });

  getItemsByCategory(cat: SpecNavCategory['key']): SpecNavItem[] {
    return this.specItems.filter((item) => item.category === cat);
  }
}
