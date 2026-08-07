import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { ACTION_LABEL, ActionType, TransactionLog } from '../../core/models';

/**
 * 全利用者の履歴閲覧 (HERON Navy テーマ ＆ プレミアムタイムライン UI)。
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          操作履歴
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">いつ・誰が・何を・どのように操作したかの全監査ログ</p>
      </div>

      <div class="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded border border-slate-200 shadow-2xs">
        全 <span class="text-[#2A3A4A] font-mono text-sm font-extrabold">{{ total() }}</span> 件
      </div>
    </div>

    @if (loading()) {
      <p class="py-8 text-center text-xs text-slate-400">読み込み中...</p>
    } @else if (items().length === 0) {
      <div class="mt-4 p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
        操作履歴がありません。
      </div>
    } @else {
      <div class="mt-4 overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-2xs">
        <ol class="divide-y divide-slate-100">
          @for (log of items(); track log.log_id) {
            <li class="p-3.5 hover:bg-slate-50/80 transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-start gap-3 min-w-0">
                <span
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shrink-0 mt-0.5 shadow-2xs"
                  [class]="actionBadgeClass(log.action_type)"
                >
                  {{ actionLabel(log.action_type) }}
                </span>

                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <a
                      [routerLink]="['/equipments', log.equipment_id]"
                      class="heron-mono font-bold text-[#2A3A4A] text-xs hover:underline"
                    >
                      {{ log.equipment_id }}
                    </a>
                    @if (log.equipment?.name) {
                      <span class="font-bold text-slate-900 text-xs truncate max-w-xs">{{ log.equipment?.name }}</span>
                    }
                  </div>

                  <div class="mt-1 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>操作者: <strong class="text-slate-800">{{ log.actor?.name ?? log.actor_user_id }}</strong></span>
                    @if (log.target_user) {
                      <span class="text-slate-400">|</span>
                      <span>貸出先: <strong class="text-[#2A3A4A]">{{ log.target_user.name }}</strong></span>
                    }
                    @if (log.target_location) {
                      <span class="text-slate-400">|</span>
                      <span>場所: <strong class="text-emerald-800">{{ log.target_location.room_name }} / {{ log.target_location.shelf_name }}</strong></span>
                    }
                    @if (log.note) {
                      <span class="text-slate-400">|</span>
                      <span class="text-slate-500 italic">({{ log.note }})</span>
                    }
                  </div>
                </div>
              </div>

              <div class="shrink-0 text-right">
                <span class="font-mono text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                  {{ log.timestamp | date: 'yyyy/MM/dd HH:mm:ss' }}
                </span>
              </div>
            </li>
          }
        </ol>
      </div>

      @if (totalPages() > 1) {
        <div class="mt-4 flex items-center justify-center gap-3">
          <button class="heron-btn-secondary text-xs" [disabled]="page() <= 1" (click)="go(page() - 1)">
            前へ
          </button>
          <span class="text-xs font-bold text-slate-600 font-mono">{{ page() }} / {{ totalPages() }}</span>
          <button
            class="heron-btn-secondary text-xs"
            [disabled]="page() >= totalPages()"
            (click)="go(page() + 1)"
          >
            次へ
          </button>
        </div>
      }
    }
  `,
})
export class LogsComponent {
  private readonly api = inject(ApiService);

  readonly items = signal<TransactionLog[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly perPage = 30;
  readonly loading = signal(true);

  constructor() {
    this.load();
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
