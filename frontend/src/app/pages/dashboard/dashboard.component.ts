import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CATEGORY_LABEL, Equipment } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * ダッシュボード (HERON Navy テーマカラー ＆ プレミアム UI)。
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, IconComponent],
  template: `
    <!-- タイトルバー -->
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          ダッシュボード
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">ようこそ、{{ auth.user()?.name }} さん</p>
      </div>

      <div class="flex items-center gap-2">
        <a routerLink="/equipments" class="heron-btn-secondary text-xs">
          <app-icon name="box" />
          機材検索・台帳
        </a>
        @if (auth.isAdmin()) {
          <a routerLink="/equipments/new" class="heron-btn-primary text-xs">
            <app-icon name="plus" />
            機材を登録
          </a>
        }
      </div>
    </div>

    <!-- HERON Navy 統計インジケーター -->
    <div class="grid grid-cols-3 gap-4 py-4 border-b border-slate-200">
      <div class="flex items-center gap-3 p-2 rounded-lg bg-slate-100/70 border border-slate-200/60 shadow-2xs">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2A3A4A] text-white shadow-xs">
          <app-icon name="box" />
        </div>
        <div>
          <div class="text-[11px] font-bold text-slate-600">総機材数</div>
          <div class="font-mono text-xl font-bold text-[#2A3A4A]">{{ items().length }} <span class="text-xs font-normal text-slate-500">件</span></div>
        </div>
      </div>

      <div class="flex items-center gap-3 p-2 rounded-lg bg-blue-50/60 border border-blue-200/60 shadow-2xs">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
          <app-icon name="user" />
        </div>
        <div>
          <div class="text-[11px] font-bold text-blue-900">貸出中</div>
          <div class="font-mono text-xl font-bold text-blue-950">{{ countInUse() }} <span class="text-xs font-normal text-slate-500">件</span></div>
        </div>
      </div>

      <div class="flex items-center gap-3 p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60 shadow-2xs">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
          <app-icon name="check" />
        </div>
        <div>
          <div class="text-[11px] font-bold text-emerald-900">保管中</div>
          <div class="font-mono text-xl font-bold text-emerald-950">{{ countAvailable() }} <span class="text-xs font-normal text-slate-500">件</span></div>
        </div>
      </div>
    </div>

    <!-- プレミアムテーブル -->
    <div class="mt-4">
      <div class="flex items-center justify-between pb-2 border-b border-slate-200">
        <h2 class="text-xs font-bold text-[#2A3A4A] flex items-center gap-1.5">
          <app-icon name="box" />
          最新の機材管理状況
        </h2>
        <a routerLink="/equipments" class="text-xs font-bold text-[#2A3A4A] hover:text-blue-700 hover:underline">
          すべて見る ({{ items().length }}件) →
        </a>
      </div>

      @if (loading()) {
        <p class="py-8 text-center text-xs text-slate-400">読み込み中...</p>
      } @else if (items().length === 0) {
        <p class="py-12 text-center text-xs text-slate-400">登録されている機材がありません。</p>
      } @else {
        <div class="overflow-x-auto mt-2 rounded-md border border-slate-200/80 shadow-2xs">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-[#2A3A4A] text-white font-bold tracking-wider text-[11px]">
                <th class="py-2.5 px-3.5">機材ID / 名称</th>
                <th class="py-2.5 px-3.5">カテゴリ</th>
                <th class="py-2.5 px-3.5">ステータス</th>
                <th class="py-2.5 px-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (eq of items().slice(0, 10); track eq.equipment_id) {
                <tr class="hover:bg-slate-50/90 transition-colors duration-150">
                  <td class="py-2.5 px-3.5">
                    <div class="heron-mono font-bold text-[#2A3A4A] text-xs">{{ eq.equipment_id }}</div>
                    <div class="font-bold text-slate-900 text-xs truncate max-w-xs">{{ eq.name }}</div>
                  </td>
                  <td class="py-2.5 px-3.5 text-slate-600 font-medium">
                    {{ categoryLabel(eq.category) }}
                  </td>
                  <td class="py-2.5 px-3.5">
                    <app-status-badge [status]="eq.status" />
                  </td>
                  <td class="py-2.5 px-3.5 text-right">
                    <a [routerLink]="['/equipments', eq.equipment_id]" class="inline-flex items-center gap-1 text-xs text-[#2A3A4A] hover:text-blue-700 hover:underline font-bold">
                      詳細
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly items = signal<Equipment[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.api.listEquipments().subscribe({
      next: (r) => {
        this.items.set(r.items ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
  }

  countInUse(): number {
    return this.items().filter((i) => i.status === 'in_use').length;
  }

  countAvailable(): number {
    return this.items().filter((i) => i.status === 'available').length;
  }
}
