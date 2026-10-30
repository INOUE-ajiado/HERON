import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { ACTION_LABEL, ActionType, TransactionLog } from '../../core/models';

/**
 * 全利用者の履歴閲覧 (HERON エッジ・トゥー・エッジ フルキャンバス UI)。
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  template: `
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] md:min-h-screen flex flex-col bg-slate-100/80 text-slate-800 font-sans">

      <!-- 1. トップヘッダー (Sticky Edge-to-Edge) -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-14 md:top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-[#2A3A4A] flex items-center justify-center text-white shadow-xs shrink-0">
            <svg class="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-sm md:text-base font-extrabold tracking-tight text-slate-900 truncate">
                操作履歴・監査ログ
              </h1>
              <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                全 {{ total() }} 件
              </span>
            </div>
            <p class="text-[11px] text-slate-500 truncate hidden sm:block">
              いつ・誰が・何を・どのように操作したかの全トランザクション監査ログ
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="reload()"
            [disabled]="loading()"
            class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <svg class="w-3.5 h-3.5 text-slate-500" [class.animate-spin]="loading()" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span class="hidden sm:inline">最新に更新</span>
          </button>
        </div>
      </header>

      <!-- 2. KPI サマリーストリップ (Edge-to-Edge 4分割グリッド) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200 bg-white shrink-0">
        <button
          type="button"
          (click)="setActionFilter('')"
          class="p-3.5 md:px-6 text-left hover:bg-slate-50/80 transition flex items-center justify-between cursor-pointer"
          [class.bg-slate-50]="actionFilter === ''"
        >
          <div>
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">全操作ログ</div>
            <div class="text-xl md:text-2xl font-black text-slate-900 font-mono mt-0.5">{{ total() }}</div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-mono font-bold">ALL</span>
        </button>

        <button
          type="button"
          (click)="setActionFilter('lend')"
          class="p-3.5 md:px-6 text-left hover:bg-blue-50/40 transition flex items-center justify-between cursor-pointer"
          [class.bg-blue-50/50]="actionFilter === 'lend'"
        >
          <div>
            <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              貸出操作
            </div>
            <div class="text-xl md:text-2xl font-black text-blue-700 font-mono mt-0.5">{{ countByAction('lend') }}</div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center text-xs font-bold">出</span>
        </button>

        <button
          type="button"
          (click)="setActionFilter('return')"
          class="p-3.5 md:px-6 text-left hover:bg-emerald-50/40 transition flex items-center justify-between cursor-pointer"
          [class.bg-emerald-50/50]="actionFilter === 'return'"
        >
          <div>
            <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              返却操作
            </div>
            <div class="text-xl md:text-2xl font-black text-emerald-700 font-mono mt-0.5">{{ countByAction('return') }}</div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center text-xs font-bold">返</span>
        </button>

        <button
          type="button"
          (click)="setActionFilter('create')"
          class="p-3.5 md:px-6 text-left hover:bg-indigo-50/40 transition flex items-center justify-between cursor-pointer"
          [class.bg-indigo-50/50]="actionFilter === 'create'"
        >
          <div>
            <div class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              新規登録・その他
            </div>
            <div class="text-xl md:text-2xl font-black text-indigo-700 font-mono mt-0.5">{{ countOtherActions() }}</div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center text-xs font-bold">録</span>
        </button>
      </div>

      <!-- 3. 検索・フィルタバー (Edge-to-Edge Subheader) -->
      <div class="border-b border-slate-200 bg-slate-50 px-4 md:px-6 py-2.5 shrink-0">
        <div class="flex flex-col md:flex-row md:items-center gap-2">
          <!-- キーワード検索 -->
          <div class="relative flex-1">
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/>
            </svg>
            <input
              type="search"
              [(ngModel)]="q"
              (ngModelChange)="onFilterChange()"
              placeholder="機材ID・機材名・操作者・貸出先・場所・備考で絞り込み..."
              class="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#2A3A4A] focus:ring-1 focus:ring-[#2A3A4A]"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- 操作種別フィルタ -->
            <select
              [(ngModel)]="actionFilter"
              (ngModelChange)="onFilterChange()"
              class="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:border-[#2A3A4A]"
            >
              <option value="">すべての操作種別</option>
              <option value="lend">貸出</option>
              <option value="return">返却</option>
              <option value="create">新規登録</option>
              <option value="inventory">棚卸し</option>
              <option value="discard">廃棄</option>
            </select>

            @if (q || actionFilter) {
              <button
                type="button"
                (click)="resetFilter()"
                class="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition cursor-pointer"
              >
                クリア
              </button>
            }

            <span class="text-[11px] font-mono font-bold text-slate-500 ml-auto md:ml-1">
              {{ filteredItems().length }} / {{ items().length }} 件表示
            </span>
          </div>
        </div>
      </div>

      <!-- 4. メインテーブル領域 (Edge-to-Edge Full-Bleed) -->
      <div class="flex-1 bg-white flex flex-col justify-between">
        @if (loading()) {
          <div class="py-16 text-center text-xs text-slate-400">操作履歴を読み込み中...</div>
        } @else if (filteredItems().length === 0) {
          <div class="py-16 text-center px-4">
            <p class="text-sm font-bold text-slate-600">該当する操作履歴がありません</p>
            <p class="text-xs text-slate-400 mt-1">機材の登録・貸出・返却・棚卸しを行うと自動的にここへ記録されます。</p>
          </div>
        } @else {
          <div>
            <!-- PC用 フルワイド・データテーブル -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th class="py-2.5 pl-4 md:pl-6 pr-3 w-44">日時</th>
                    <th class="py-2.5 px-3 w-28">操作種別</th>
                    <th class="py-2.5 px-3">対象機材 (機材ID / 機材名)</th>
                    <th class="py-2.5 px-3 w-40">操作者</th>
                    <th class="py-2.5 px-3 w-56">貸出先 / 保管場所</th>
                    <th class="py-2.5 pl-3 pr-4 md:pr-6">備考・メモ</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 text-xs bg-white border-b border-slate-200">
                  @for (log of filteredItems(); track log.id ?? log.log_id) {
                    <tr class="hover:bg-slate-50/90 transition-colors">
                      <!-- 日時 -->
                      <td class="py-3 pl-4 md:pl-6 pr-3 whitespace-nowrap">
                        <span class="font-mono text-[11px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                          {{ log.timestamp | date: 'yyyy/MM/dd HH:mm:ss' }}
                        </span>
                      </td>

                      <!-- 操作種別 -->
                      <td class="py-3 px-3 whitespace-nowrap">
                        <span
                          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs"
                          [class]="actionBadgeClass(log.action_type)"
                        >
                          {{ actionLabel(log.action_type) }}
                        </span>
                      </td>

                      <!-- 対象機材 -->
                      <td class="py-3 px-3">
                        <div class="flex items-center gap-2 min-w-0">
                          <a
                            [routerLink]="['/equipments', log.equipment_id]"
                            class="heron-mono font-bold text-[#2A3A4A] text-xs hover:underline shrink-0 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80"
                          >
                            {{ log.equipment_id }}
                          </a>
                          @if (log.equipment?.name) {
                            <span class="font-bold text-slate-900 text-xs truncate">{{ log.equipment?.name }}</span>
                          }
                        </div>
                      </td>

                      <!-- 操作者 -->
                      <td class="py-3 px-3 whitespace-nowrap">
                        <span class="font-bold text-slate-800 text-xs">
                          {{ log.actor?.name ?? log.actor_user_id }}
                        </span>
                      </td>

                      <!-- 貸出先 / 保管場所 -->
                      <td class="py-3 px-3">
                        <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                          @if (log.target_user) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200/60 font-bold">
                              貸出先: {{ log.target_user.name }}
                            </span>
                          }
                          @if (log.target_location) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold">
                              {{ log.target_location.room_name }} / {{ log.target_location.shelf_name }}
                            </span>
                          }
                          @if (!log.target_user && !log.target_location) {
                            <span class="text-slate-400">—</span>
                          }
                        </div>
                      </td>

                      <!-- 備考・メモ -->
                      <td class="py-3 pl-3 pr-4 md:pr-6">
                        @if (log.note) {
                          <span class="text-slate-600 text-xs">{{ log.note }}</span>
                        } @else {
                          <span class="text-slate-300 text-[11px]">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- モバイル用 Edge-to-Edge リスト -->
            <div class="md:hidden divide-y divide-slate-200 border-b border-slate-200">
              @for (log of filteredItems(); track log.id ?? log.log_id) {
                <div class="p-4 hover:bg-slate-50 transition flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span
                        class="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shrink-0 shadow-2xs"
                        [class]="actionBadgeClass(log.action_type)"
                      >
                        {{ actionLabel(log.action_type) }}
                      </span>
                      <a
                        [routerLink]="['/equipments', log.equipment_id]"
                        class="heron-mono font-bold text-[#2A3A4A] text-xs hover:underline shrink-0"
                      >
                        {{ log.equipment_id }}
                      </a>
                    </div>
                    <span class="font-mono text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded shrink-0">
                      {{ log.timestamp | date: 'yyyy/MM/dd HH:mm:ss' }}
                    </span>
                  </div>

                  @if (log.equipment?.name) {
                    <div class="font-bold text-slate-900 text-xs truncate">
                      {{ log.equipment?.name }}
                    </div>
                  }

                  <div class="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>操作者: <strong class="text-slate-800">{{ log.actor?.name ?? log.actor_user_id }}</strong></span>
                    @if (log.target_user) {
                      <span class="text-slate-300">|</span>
                      <span>貸出先: <strong class="text-[#2A3A4A]">{{ log.target_user.name }}</strong></span>
                    }
                    @if (log.target_location) {
                      <span class="text-slate-300">|</span>
                      <span>場所: <strong class="text-emerald-800">{{ log.target_location.room_name }} / {{ log.target_location.shelf_name }}</strong></span>
                    }
                    @if (log.note) {
                      <span class="text-slate-300">|</span>
                      <span class="text-slate-500 italic">({{ log.note }})</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- ページネーションフッター (Edge-to-Edge) -->
          @if (totalPages() > 1) {
            <div class="border-t border-slate-200 bg-slate-50 px-4 md:px-6 py-3 flex items-center justify-between">
              <span class="text-xs text-slate-500 font-mono">
                Page <strong class="text-slate-800">{{ page() }}</strong> of {{ totalPages() }} (全 {{ total() }} 件)
              </span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  [disabled]="page() <= 1"
                  (click)="go(page() - 1)"
                >
                  前へ
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  [disabled]="page() >= totalPages()"
                  (click)="go(page() + 1)"
                >
                  次へ
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class LogsComponent {
  private readonly api = inject(ApiService);

  readonly items = signal<TransactionLog[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly perPage = 50;
  readonly loading = signal(true);

  q = '';
  actionFilter = '';
  private readonly filterTrigger = signal(0);

  readonly filteredItems = computed(() => {
    this.filterTrigger();
    const keyword = this.q.trim().toLowerCase();
    const action = this.actionFilter;

    return this.items().filter((log) => {
      if (action && log.action_type !== action) return false;
      if (!keyword) return true;
      const hay = [
        log.equipment_id,
        log.equipment?.name ?? '',
        log.actor?.name ?? '',
        log.actor_user_id ?? '',
        log.target_user?.name ?? '',
        log.target_location?.room_name ?? '',
        log.target_location?.shelf_name ?? '',
        log.note ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(keyword);
    });
  });

  constructor() {
    this.load();
  }

  onFilterChange(): void {
    this.filterTrigger.update((v) => v + 1);
  }

  setActionFilter(action: string): void {
    this.actionFilter = this.actionFilter === action ? '' : action;
    this.onFilterChange();
  }

  resetFilter(): void {
    this.q = '';
    this.actionFilter = '';
    this.onFilterChange();
  }

  countByAction(action: ActionType): number {
    return this.items().filter((l) => l.action_type === action).length;
  }

  countOtherActions(): number {
    return this.items().filter((l) => l.action_type !== 'lend' && l.action_type !== 'return').length;
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.perPage));
  }

  actionLabel(a: ActionType): string {
    return ACTION_LABEL[a] ?? a;
  }

  actionBadgeClass(a: ActionType): string {
    switch (a) {
      case 'lend':
        return 'bg-blue-600';
      case 'return':
        return 'bg-emerald-600';
      case 'inventory':
        return 'bg-[#2A3A4A]';
      case 'create':
        return 'bg-indigo-600';
      case 'discard':
        return 'bg-rose-600';
      default:
        return 'bg-slate-600';
    }
  }

  reload(): void {
    this.load();
  }

  go(p: number): void {
    this.page.set(p);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listLogs(this.page(), this.perPage).subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
