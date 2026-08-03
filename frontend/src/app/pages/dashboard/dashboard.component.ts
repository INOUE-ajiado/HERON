import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Equipment, STATUS_LABEL, Stats } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * ホーム画面。
 *
 * 一般ユーザー: 自身が借用中の機材一覧（設計書 第1部 2章）。
 * 管理者: 上記に加えてステータス別の集計と主要操作への導線。
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, IconComponent],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">
      こんにちは、{{ auth.user()?.name }} さん
    </h1>
    <p class="mt-1 text-xs text-heron-2">
      {{ auth.isAdmin() ? '管理者 (Admin)' : '一般 (General)' }} として
      ログインしています
    </p>

    @if (auth.isAdmin()) {
      <!-- 管理者向け: ステータス別サマリ -->
      <section class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        @for (card of statCards(); track card.key) {
          <div class="heron-card p-4">
            <div class="text-[11px] font-semibold text-heron-2">{{ card.label }}</div>
            <div class="mt-1 text-3xl font-bold text-heron-navy">{{ card.value }}</div>
          </div>
        }
      </section>

      <!-- 管理者向け: 主要操作 -->
      <section class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a routerLink="/scan" class="heron-card bg-heron-gradient p-5 text-white transition hover:opacity-90">
          <app-icon name="camera" class="text-[1.6rem]" />
          <div class="mt-2 text-sm font-bold">貸出・返却スキャン</div>
          <div class="mt-1 text-[11px] opacity-90">QRを読んで1タップで処理</div>
        </a>
        <a routerLink="/inventory" class="heron-card p-5 transition hover:bg-heron-silver">
          <app-icon name="shelf" class="text-[1.6rem] text-heron-1" />
          <div class="mt-2 text-sm font-bold text-heron-navy">棚卸しモード</div>
          <div class="mt-1 text-[11px] text-heron-2">棚を選んで連続スキャン</div>
        </a>
        <a routerLink="/equipments/new" class="heron-card p-5 transition hover:bg-heron-silver">
          <app-icon name="plus" class="text-[1.6rem] text-heron-1" />
          <div class="mt-2 text-sm font-bold text-heron-navy">機材の新規登録</div>
          <div class="mt-1 text-[11px] text-heron-2">IDを自動採番して登録</div>
        </a>
      </section>
    }

    <!-- 自身が借用中の機材 -->
    <section class="mt-8">
      <h2 class="text-sm font-bold text-heron-navy">現在お借りしている機材</h2>

      @if (loading()) {
        <p class="mt-3 text-xs text-heron-3">読み込み中...</p>
      } @else if (mine().length === 0) {
        <div class="heron-card mt-3 p-6 text-center text-xs text-heron-2">
          現在借用中の機材はありません。
        </div>
      } @else {
        <ul class="mt-3 space-y-2">
          @for (eq of mine(); track eq.equipment_id) {
            <li>
              <a
                [routerLink]="['/equipments', eq.equipment_id]"
                class="heron-card flex items-center justify-between gap-3 p-4 transition hover:bg-heron-silver"
              >
                <div class="min-w-0">
                  <div class="heron-mono text-xs font-semibold text-heron-2">
                    {{ eq.equipment_id }}
                  </div>
                  <div class="truncate text-sm font-semibold text-heron-navy">
                    {{ eq.name }}
                  </div>
                </div>
                <app-status-badge [status]="eq.status" />
              </a>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly mine = signal<Equipment[]>([]);
  readonly loading = signal(true);
  readonly statCards = signal<{ key: string; label: string; value: number }[]>([]);

  constructor() {
    this.api.myEquipments().subscribe({
      next: (res) => {
        this.mine.set(res.items ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    if (this.auth.isAdmin()) {
      this.api.stats().subscribe({
        next: (s) => this.statCards.set(toCards(s)),
      });
    }
  }
}

function toCards(s: Stats): { key: string; label: string; value: number }[] {
  return [
    { key: 'total', label: '稼働機材 合計', value: s.active_total },
    { key: 'available', label: STATUS_LABEL.available, value: s.by_status.available ?? 0 },
    { key: 'in_use', label: STATUS_LABEL.in_use, value: s.by_status.in_use ?? 0 },
    {
      key: 'maintenance',
      label: STATUS_LABEL.maintenance,
      value: s.by_status.maintenance ?? 0,
    },
  ];
}
