import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { MasterService } from '../../core/master.service';
import { CATEGORY_LABEL, Equipment, Location, User } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * QR / バーコードスキャナ画面 (高密度 2カラム レイアウト)。
 */
@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [FormsModule, StatusBadgeComponent, IconComponent],
  template: `
    <div class="flex items-center justify-between border-b border-slate-200 pb-3">
      <div>
        <h1 class="text-lg font-bold text-heron-navy">バーコード / QRスキャン照合</h1>
        <p class="text-xs text-heron-2">バーコードまたは機材IDを入力・スキャンして即時貸出・返却を行います。</p>
      </div>
    </div>

    <!-- 2カラム構成 -->
    <div class="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
      <!-- 左カラム (5/12): 読取・入力操作 -->
      <div class="space-y-4 lg:col-span-5">
        <form (ngSubmit)="search()" class="heron-card p-4 bg-white space-y-3">
          <h2 class="text-xs font-bold text-heron-navy pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <app-icon name="box" />
            機材ID / QRコード入力
          </h2>

          <div>
            <label class="heron-label text-[11px]" for="inputId">機材ID (例: DEV-TAB-00001)</label>
            <input
              id="inputId"
              name="inputId"
              class="heron-input text-xs uppercase"
              placeholder="コードを入力またはスキャン"
              [(ngModel)]="scannedId"
              autofocus
            />
          </div>

          <button type="submit" class="heron-btn-primary w-full text-xs font-bold bg-blue-700 hover:bg-blue-800" [disabled]="loading()">
            {{ loading() ? '照合中...' : '機材を検索・照合' }}
          </button>
        </form>
      </div>

      <!-- 右カラム (7/12): 照合結果 & 貸出返却アクション -->
      <div class="space-y-4 lg:col-span-7">
        @if (error()) {
          <div class="rounded-lg bg-red-50 p-4 text-xs text-red-700 border border-red-200">
            {{ error() }}
          </div>
        }

        @if (equipment(); as eq) {
          <div class="heron-card p-4 bg-white space-y-4">
            <div class="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div class="heron-mono text-xs font-bold text-heron-2">{{ eq.equipment_id }}</div>
                <h3 class="text-base font-bold text-heron-navy">{{ eq.name }}</h3>
                <div class="text-xs text-slate-500 mt-0.5">{{ categoryLabel(eq.category) }} {{ eq.model_number }}</div>
              </div>
              <app-status-badge [status]="eq.status" />
            </div>

            <!-- 貸出操作 -->
            @if (eq.status === 'available') {
              <div class="rounded-lg bg-blue-50/70 p-3.5 border border-blue-200 space-y-3">
                <h4 class="text-xs font-bold text-blue-900">この機材を貸し出す（ユーザー ＋ 棚ID 必須）</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label class="heron-label text-[11px]" for="scUser">貸出先ユーザー <span class="text-red-600">*</span></label>
                    <select id="scUser" class="heron-input text-xs bg-white" [(ngModel)]="targetUserId">
                      <option [ngValue]="null">選択してください</option>
                      @for (u of users(); track u.user_id) {
                        <option [ngValue]="u.user_id">{{ u.name }} ({{ u.login_id }})</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="heron-label text-[11px]" for="scShelf">保管場所 (棚ID) <span class="text-red-600">*</span></label>
                    <select id="scShelf" class="heron-input text-xs bg-white" [(ngModel)]="targetLocationId">
                      <option [ngValue]="null">選択してください</option>
                      @for (s of master.shelves(); track s.code) {
                        <option [ngValue]="s.code">
                          [{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}
                        </option>
                      }
                    </select>
                  </div>
                </div>
                <button
                  class="heron-btn-primary w-full text-xs font-bold bg-blue-700 hover:bg-blue-800 disabled:opacity-40"
                  [disabled]="busy() || targetUserId === null || targetLocationId === null"
                  (click)="lend()"
                >
                  <app-icon name="lend" />
                  ユーザーと棚IDを紐付けて貸出
                </button>
              </div>
            }

            <!-- 返却操作 -->
            @if (eq.status === 'in_use') {
              <div class="rounded-lg bg-emerald-50/70 p-3.5 border border-emerald-200 space-y-3">
                <h4 class="text-xs font-bold text-emerald-900">この機材を返却する</h4>
                <div>
                  <label class="heron-label text-[11px]" for="scReturnShelf">返却先棚 <span class="text-red-600">*</span></label>
                  <select id="scReturnShelf" class="heron-input text-xs bg-white" [(ngModel)]="targetLocationId">
                    <option [ngValue]="null">選択してください</option>
                    @for (s of master.shelves(); track s.code) {
                      <option [ngValue]="s.code">
                        [{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}
                      </option>
                    }
                  </select>
                </div>
                <button
                  class="heron-btn-primary w-full text-xs font-bold bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40"
                  [disabled]="busy() || targetLocationId === null"
                  (click)="doReturn()"
                >
                  返却処理を実行
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ScanComponent {
  private readonly api = inject(ApiService);
  readonly master = inject(MasterService);

  scannedId = '';
  readonly equipment = signal<Equipment | null>(null);
  readonly users = signal<User[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  targetUserId: string | null = null;
  targetLocationId: number | string | null = null;

  constructor() {
    this.api.listUsers().subscribe({ next: (r) => this.users.set(r.items ?? []) });
    this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
  }

  search(): void {
    if (!this.scannedId.trim()) return;
    this.loading.set(true);
    this.error.set('');
    this.equipment.set(null);

    this.api.getEquipment(this.scannedId.trim().toUpperCase()).subscribe({
      next: (res) => {
        this.equipment.set(res.equipment);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? '機材が見つかりません');
        this.loading.set(false);
      },
    });
  }

  lend(): void {
    const eq = this.equipment();
    if (!eq || !this.targetUserId || !this.targetLocationId) return;
    this.busy.set(true);

    this.api.lend(eq.equipment_id, this.targetUserId).subscribe({
      next: () => {
        this.busy.set(false);
        this.search();
      },
      error: () => this.busy.set(false),
    });
  }

  doReturn(): void {
    const eq = this.equipment();
    if (!eq) return;
    this.busy.set(true);

    this.api.return(eq.equipment_id, 1).subscribe({
      next: () => {
        this.busy.set(false);
        this.search();
      },
      error: () => this.busy.set(false),
    });
  }
}
