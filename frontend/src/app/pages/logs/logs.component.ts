import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { ACTION_LABEL, ActionType, TransactionLog } from '../../core/models';

/**
 * 全利用者の履歴閲覧（設計書 第1部 2章、管理者限定）。
 *
 * 「いつ・誰が・どこへ動かしたか」の証跡を時系列で確認する。
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">操作履歴</h1>
    <p class="mt-1 text-xs text-heron-2">全 {{ total() }} 件</p>

    @if (loading()) {
      <p class="mt-4 text-xs text-heron-3">読み込み中...</p>
    } @else if (items().length === 0) {
      <div class="heron-card mt-4 p-8 text-center text-xs text-heron-2">
        履歴がありません。
      </div>
    } @else {
      <ol class="mt-4 space-y-2">
        @for (log of items(); track log.log_id) {
          <li class="heron-card px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <span
                  class="heron-chip"
                  [class]="'heron-chip ' + actionClass(log.action_type)"
                >
                  {{ actionLabel(log.action_type) }}
                </span>
                <a
                  [routerLink]="['/equipments', log.equipment_id]"
                  class="heron-mono ml-2 text-xs font-semibold text-heron-navy underline underline-offset-2"
                >
                  {{ log.equipment_id }}
                </a>
                @if (log.equipment) {
                  <div class="mt-1 truncate text-xs text-heron-1">{{ log.equipment.name }}</div>
                }
                <div class="mt-1 text-[11px] text-heron-2">
                  操作者: {{ log.actor?.name ?? log.actor_user_id }}
                  @if (log.target_user) {
                    ／ 貸出先: {{ log.target_user.name }}
                  }
                  @if (log.target_location) {
                    ／ 場所: {{ log.target_location.room_name }} /
                    {{ log.target_location.shelf_name }}
                  }
                </div>
              </div>
              <span class="shrink-0 text-[11px] text-heron-3">
                {{ log.timestamp | date: 'MM/dd HH:mm' }}
              </span>
            </div>
          </li>
        }
      </ol>

      @if (totalPages() > 1) {
        <div class="mt-4 flex items-center justify-center gap-3">
          <button class="heron-btn-secondary" [disabled]="page() <= 1" (click)="go(page() - 1)">
            前へ
          </button>
          <span class="text-xs text-heron-2">{{ page() }} / {{ totalPages() }}</span>
          <button
            class="heron-btn-secondary"
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

  /** 操作種別ごとに色を変え、履歴を目で追いやすくする。 */
  actionClass(a: ActionType): string {
    switch (a) {
      case 'lend':
        return 'bg-status-inuse';
      case 'return':
        return 'bg-status-available';
      case 'inventory':
        return 'bg-heron-2';
      case 'discard':
        return 'bg-status-discarded';
      default:
        return 'bg-heron-3';
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
