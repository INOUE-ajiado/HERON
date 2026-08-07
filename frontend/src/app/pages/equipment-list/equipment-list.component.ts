import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MasterService } from '../../core/master.service';
import { CATEGORY_LABEL, Equipment, EquipmentStatus, STATUS_LABEL, User } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * 機材台帳・検索 (二重貸出防止ガード付き)。
 */
@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, IconComponent],
  template: `
    <!-- ページタイトルバー -->
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          機材台帳・検索
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">登録機材の検索・バーコード照合・貸出返却・ステータス管理</p>
      </div>

      @if (auth.isAdmin()) {
        <a routerLink="/equipments/new" class="heron-btn-primary text-xs">
          <app-icon name="plus" />
          機材新規登録
        </a>
      }
    </div>

    <!-- フラットコントロールバー (検索・バーコードスキャン一体型) -->
    <div class="py-3 border-b border-slate-200 bg-slate-100/60 -mx-4 px-4 md:-mx-6 md:px-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <!-- バーコード/QR照合入力 -->
        <form (ngSubmit)="scanMatch()" class="flex items-center gap-2 flex-1 max-w-md">
          <div class="relative w-full">
            <span class="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
              <app-icon name="box" />
            </span>
            <input
              type="text"
              class="heron-input pl-8 text-xs font-mono uppercase bg-white"
              placeholder="バーコード / 機材IDをスキャン・入力"
              [(ngModel)]="scanInput"
              name="scanInput"
              autofocus
            />
          </div>
          <button type="submit" class="heron-btn-primary shrink-0 text-xs" [disabled]="scanning()">
            {{ scanning() ? '照合中...' : '照合' }}
          </button>
        </form>

        <!-- フィルタ項目 -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="flex items-center gap-1.5 min-w-[180px]">
            <span class="text-slate-600 font-bold text-[11px]">検索:</span>
            <input
              type="search"
              class="heron-input text-xs bg-white"
              placeholder="名称, 型番..."
              [(ngModel)]="query"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 font-bold text-[11px]">カテゴリ:</span>
            <select class="heron-input text-xs bg-white w-28" [(ngModel)]="categoryFilter">
              <option value="">すべて</option>
              @for (c of master.categories(); track c.code) {
                <option [value]="c.code">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 font-bold text-[11px]">ステータス:</span>
            <select class="heron-input text-xs bg-white w-28" [(ngModel)]="statusFilter">
              <option value="">すべて</option>
              <option value="available">{{ statusLabel.available }}</option>
              <option value="in_use">{{ statusLabel.in_use }}</option>
              <option value="maintenance">{{ statusLabel.maintenance }}</option>
              <option value="discarded">{{ statusLabel.discarded }}</option>
            </select>
          </div>

          <div class="text-[11px] text-slate-500 font-bold ml-auto bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs">
            該当: <span class="text-[#2A3A4A] font-mono text-sm font-extrabold">{{ filtered().length }}</span> 件
          </div>
        </div>
      </div>

      @if (scanError()) {
        <p class="mt-2 text-xs text-red-600 font-semibold">{{ scanError() }}</p>
      }
    </div>

    <!-- スキャン一致表示 (照合時) -->
    @if (matchedEquipment(); as match) {
      <div class="my-3 rounded-lg border border-blue-300 bg-blue-50/90 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div class="flex items-center gap-3 min-w-0">
          <span class="rounded bg-[#2A3A4A] px-2.5 py-0.5 text-[10px] font-bold text-white shrink-0">スキャン一致</span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs font-bold text-[#2A3A4A]">{{ match.equipment_id }}</span>
              <span class="font-bold text-sm text-slate-900 truncate">{{ match.name }}</span>
            </div>
            <div class="text-[11px] text-slate-600">
              {{ categoryLabel(match.category) }} {{ match.model_number ? '/ ' + match.model_number : '' }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <app-status-badge [status]="match.status" />

          @if (auth.isAdmin()) {
            @if (match.status === 'available') {
              <div class="flex items-center gap-1.5">
                <select class="heron-input text-xs bg-white w-32" [(ngModel)]="targetUserId">
                  <option [ngValue]="null">ユーザー選択</option>
                  @for (u of users(); track u.user_id) {
                    <option [ngValue]="u.user_id">{{ u.name }}</option>
                  }
                </select>
                <select class="heron-input text-xs bg-white w-32" [(ngModel)]="targetLocationId">
                  <option [ngValue]="null">棚ID選択</option>
                  @for (s of master.shelves(); track s.code) {
                    <option [ngValue]="s.code">[{{ s.code }}] {{ s.shelf_name }}</option>
                  }
                </select>
                <button
                  class="heron-btn-primary text-xs disabled:opacity-40"
                  [disabled]="actionBusy() || !targetUserId || !targetLocationId"
                  (click)="quickLend(match)"
                >
                  {{ actionBusy() ? '処理中...' : '貸出' }}
                </button>
              </div>
            } @else if (match.status === 'in_use') {
              <button
                class="heron-btn-primary text-xs bg-emerald-700 hover:bg-emerald-800"
                [disabled]="actionBusy()"
                (click)="quickReturn(match)"
              >
                返却
              </button>
            }
          }

          <a [routerLink]="['/equipments', match.equipment_id]" class="heron-btn-secondary text-xs">
            詳細
          </a>
          <button (click)="matchedEquipment.set(null)" class="text-xs text-slate-400 hover:text-slate-600 px-1">✕</button>
        </div>
      </div>
    }

    <!-- HERON Navy テーマテーブル -->
    <div class="mt-3">
      @if (loading()) {
        <p class="py-8 text-center text-xs text-slate-400">読み込み中...</p>
      } @else if (filtered().length === 0) {
        <div class="py-12 text-center text-xs text-slate-400">
          該当する機材が見つかりません。
        </div>
      } @else {
        <div class="overflow-x-auto rounded-md border border-slate-200/80 shadow-2xs">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-[#2A3A4A] text-white font-bold tracking-wider text-[11px]">
                <th class="py-2.5 px-3.5">機材ID / 機材名</th>
                <th class="py-2.5 px-3.5">カテゴリ</th>
                <th class="py-2.5 px-3.5">型番</th>
                <th class="py-2.5 px-3.5">ステータス / 所在</th>
                <th class="py-2.5 px-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (eq of filtered(); track eq.equipment_id) {
                <tr class="hover:bg-slate-50/90 transition-colors duration-150" [class.bg-blue-50/70]="matchedEquipment()?.equipment_id === eq.equipment_id">
                  <td class="py-2.5 px-3.5">
                    <div class="heron-mono font-bold text-[#2A3A4A] text-xs">{{ eq.equipment_id }}</div>
                    <div class="font-bold text-slate-900 text-xs">{{ eq.name }}</div>
                  </td>
                  <td class="py-2.5 px-3.5 text-slate-600 font-medium">
                    {{ categoryLabel(eq.category) }}
                  </td>
                  <td class="py-2.5 px-3.5 font-mono text-slate-600">
                    {{ eq.model_number || '—' }}
                  </td>
                  <td class="py-2.5 px-3.5">
                    <div class="flex items-center gap-2">
                      <app-status-badge [status]="eq.status" />
                      <span class="text-[11px] text-slate-600 font-medium">
                        @if (eq.status === 'in_use') {
                          {{ eq.current_user?.name ?? '利用者' }}
                        } @else if (eq.current_location) {
                          {{ eq.current_location.room_name }} / {{ eq.current_location.shelf_name }}
                        }
                      </span>
                    </div>
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
export class EquipmentListComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly master = inject(MasterService);

  readonly statusLabel = STATUS_LABEL;

  readonly items = signal<Equipment[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly scanning = signal(false);
  readonly actionBusy = signal(false);
  readonly scanError = signal('');

  scanInput = '';
  query = '';
  categoryFilter = '';
  statusFilter = '';

  targetUserId: string | null = null;
  targetLocationId: string | null = null;

  readonly matchedEquipment = signal<Equipment | null>(null);

  readonly filtered = computed(() => {
    const q = this.query.trim().toLowerCase();
    const cat = this.categoryFilter;
    const st = this.statusFilter as EquipmentStatus | '';

    return this.items().filter((eq) => {
      if (cat && eq.category !== cat) return false;
      if (st && eq.status !== st) return false;

      if (!q) return true;
      const haystack = [
        eq.equipment_id,
        eq.name,
        eq.model_number ?? '',
        eq.current_user?.name ?? '',
        eq.current_location?.room_name ?? '',
        eq.current_location?.shelf_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  constructor() {
    this.loadData();
    if (this.auth.isAdmin()) {
      this.api.listUsers().subscribe({ next: (r) => this.users.set(r.items ?? []) });
    }
  }

  private loadData(): void {
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

  scanMatch(): void {
    if (!this.scanInput.trim()) return;
    const targetId = this.scanInput.trim().toUpperCase();
    this.scanning.set(true);
    this.scanError.set('');

    this.api.getEquipment(targetId).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.matchedEquipment.set(res.equipment);
        this.scanInput = '';
      },
      error: () => {
        this.scanning.set(false);
        this.scanError.set(`機材ID「${targetId}」は見つかりませんでした`);
      },
    });
  }

  quickLend(eq: Equipment): void {
    if (!this.targetUserId || !this.targetLocationId || this.actionBusy()) return;
    if (eq.status === 'in_use') {
      this.scanError.set('この機材はすでに貸出中であるため、二重貸出はできません');
      return;
    }
    this.actionBusy.set(true);

    this.api.lend(eq.equipment_id, this.targetUserId).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.matchedEquipment.set(null);
        this.loadData();
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.scanError.set(err?.error?.error ?? 'この機材はすでに貸出中です。二重貸出はできません。');
      },
    });
  }

  quickReturn(eq: Equipment): void {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.api.return(eq.equipment_id, 1).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.matchedEquipment.set(null);
        this.loadData();
      },
      error: () => this.actionBusy.set(false),
    });
  }
}
