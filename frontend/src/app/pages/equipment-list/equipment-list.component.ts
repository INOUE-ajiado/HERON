import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MasterService } from '../../core/master.service';
import {
  ACTION_LABEL,
  ActionType,
  CATEGORY_LABEL,
  Equipment,
  EquipmentStatus,
  STATUS_LABEL,
  TransactionLog,
  User,
} from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * 機材台帳・検索 (行クリックによる右サイドスライド詳細ドロワー対応)。
 */
@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, StatusBadgeComponent, IconComponent],
  template: `
    <!-- ページタイトルバー -->
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          機材台帳・検索
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">行をクリックすると右側に詳細・貸出操作パネルが開きます</p>
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

    <!-- HERON Navy テーマテーブル (行クリックでドロワー展開のため操作カラムを排除) -->
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
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (eq of filtered(); track eq.equipment_id) {
                <tr
                  (click)="openDrawer(eq)"
                  class="cursor-pointer hover:bg-blue-50/60 transition-colors duration-150"
                  [class.bg-blue-50/90]="activeEquipment()?.equipment_id === eq.equipment_id"
                >
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
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- 右サイドスライド式詳細ドロワー (Slide-over Drawer Panel) -->
    @if (drawerOpen()) {
      <!-- バックドロップ領域 -->
      <div
        class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        (click)="closeDrawer()"
      ></div>

      <!-- スライドパネル -->
      <div
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out border-l border-slate-200"
      >
        <!-- ドロワーヘッダー -->
        <div class="flex items-center justify-between border-b border-slate-200 bg-[#2A3A4A] px-5 py-4 text-white">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white">
              <app-icon name="box" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold text-[#90CFD6]">{{ activeEquipment()?.equipment_id }}</span>
                @if (activeEquipment(); as eq) {
                  <app-status-badge [status]="eq.status" />
                }
              </div>
              <h2 class="text-sm font-bold text-white truncate">{{ activeEquipment()?.name }}</h2>
            </div>
          </div>

          <button
            type="button"
            (click)="closeDrawer()"
            class="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <!-- ドロワー本文 -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          @if (drawerLoading()) {
            <p class="py-8 text-center text-xs text-slate-400">詳細情報を読み込み中...</p>
          } @else if (activeEquipment(); as eq) {
            <!-- 通知メッセージ -->
            @if (drawerMessage()) {
              <p class="rounded px-3 py-2 text-xs font-medium shadow-2xs"
                 [class]="drawerMessageIsError() ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'">
                {{ drawerMessage() }}
              </p>
            }

            <!-- 貸出中ハイライト -->
            @if (eq.status === 'in_use') {
              <div class="rounded-md border border-blue-200 bg-blue-50/70 p-3.5 space-y-2 shadow-2xs">
                <div class="flex items-center justify-between text-xs font-bold text-[#2A3A4A] border-b border-blue-200/60 pb-1.5">
                  <span class="flex items-center gap-1.5"><app-icon name="user" /> 現在の貸出・利用状況</span>
                  <span class="rounded-full bg-[#2A3A4A] px-2.5 py-0.5 text-[10px] text-white font-bold">貸出中</span>
                </div>

                <dl class="space-y-1.5 text-xs">
                  <div class="flex justify-between items-center">
                    <dt class="text-slate-600 font-semibold">借用ユーザー:</dt>
                    <dd class="font-bold text-[#2A3A4A]">
                      {{ eq.current_user?.name ?? '設定済みユーザー' }}
                      @if (eq.current_user?.login_id) {
                        <span class="text-[11px] font-normal text-slate-500">({{ eq.current_user?.login_id }})</span>
                      }
                    </dd>
                  </div>

                  <div class="flex justify-between items-center">
                    <dt class="text-slate-600 font-semibold">保管場所 (棚ID):</dt>
                    <dd class="font-bold text-emerald-800">
                      {{ currentShelfText(eq) }}
                    </dd>
                  </div>
                </dl>
              </div>
            }

            <!-- 管理者貸出・返却操作 (二重貸出防止ガード付き) -->
            @if (auth.isAdmin()) {
              <div class="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
                <h3 class="text-xs font-bold text-[#2A3A4A] flex items-center gap-1.5">
                  <app-icon name="user" /> 管理者割当・貸出返却操作
                </h3>

                @if (eq.status === 'available') {
                  <div class="space-y-2.5">
                    <div>
                      <label class="heron-label text-[11px]">1. 貸出先ユーザー <span class="text-red-600">*</span></label>
                      <select class="heron-input text-xs bg-white" [(ngModel)]="targetUserId">
                        <option [ngValue]="null">選択してください</option>
                        @for (u of users(); track u.user_id) {
                          <option [ngValue]="u.user_id">{{ u.name }} ({{ u.login_id }})</option>
                        }
                      </select>
                    </div>

                    <div>
                      <label class="heron-label text-[11px]">2. 保管場所 (棚ID) <span class="text-red-600">*</span></label>
                      <select class="heron-input text-xs bg-white" [(ngModel)]="targetLocationId">
                        <option [ngValue]="null">選択してください</option>
                        @for (s of master.shelves(); track s.code) {
                          <option [ngValue]="s.code">[{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}</option>
                        }
                      </select>
                    </div>

                    <button
                      class="heron-btn-primary w-full text-xs font-bold py-2 mt-1"
                      [disabled]="actionBusy() || !targetUserId || !targetLocationId"
                      (click)="drawerLend(eq)"
                    >
                      {{ actionBusy() ? '処理中...' : 'ユーザーと棚IDを紐付けて貸出' }}
                    </button>
                  </div>
                } @else if (eq.status === 'in_use') {
                  <div class="space-y-2">
                    <p class="text-xs text-slate-600 font-medium">返却先の棚コードを指定して返却処理を行います:</p>
                    <div class="flex items-center gap-2">
                      <select class="heron-input text-xs bg-white flex-1" [(ngModel)]="targetLocationId">
                        <option [ngValue]="null">返却先棚を選択</option>
                        @for (s of master.shelves(); track s.code) {
                          <option [ngValue]="s.code">[{{ s.code }}] {{ s.shelf_name }}</option>
                        }
                      </select>
                      <button
                        class="heron-btn-primary text-xs bg-emerald-700 hover:bg-emerald-800 shrink-0"
                        [disabled]="actionBusy() || !targetLocationId"
                        (click)="drawerReturn(eq)"
                      >
                        {{ actionBusy() ? '処理中...' : '返却処理' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- 機材スペック表 -->
            <div class="space-y-2">
              <h3 class="text-xs font-bold text-[#2A3A4A] pb-1 border-b border-slate-200">機材スペック詳細</h3>
              <dl class="divide-y divide-slate-100 text-xs">
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">機材名</dt>
                  <dd class="font-bold text-slate-900">{{ eq.name }}</dd>
                </div>
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">カテゴリ</dt>
                  <dd class="text-slate-800">{{ categoryLabel(eq.category) }}</dd>
                </div>
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">型番</dt>
                  <dd class="font-mono text-slate-800">{{ eq.model_number || '—' }}</dd>
                </div>
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">保管場所</dt>
                  <dd class="font-bold text-emerald-800">{{ currentShelfText(eq) }}</dd>
                </div>
              </dl>
            </div>

            <!-- 直近移動・貸出履歴 -->
            <div class="space-y-2">
              <h3 class="text-xs font-bold text-[#2A3A4A] pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>移動・貸出履歴</span>
                <span class="text-[10px] text-slate-400 font-normal">直近 {{ drawerLogs().length }} 件</span>
              </h3>

              @if (drawerLogs().length === 0) {
                <p class="py-4 text-center text-xs text-slate-400">履歴がありません。</p>
              } @else {
                <ol class="space-y-1.5 max-h-48 overflow-y-auto">
                  @for (log of drawerLogs(); track log.log_id) {
                    <li class="p-2 border border-slate-100 rounded text-xs bg-slate-50/50">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-[#2A3A4A]">{{ actionLabel(log.action_type) }}</span>
                        <span class="font-mono text-[10px] text-slate-400">{{ log.timestamp | date: 'yyyy/MM/dd HH:mm' }}</span>
                      </div>
                      <div class="mt-0.5 text-[11px] text-slate-600">
                        操作者: {{ log.actor?.name ?? log.actor_user_id }}
                        @if (log.target_user) {
                          ／ 貸出先: <strong>{{ log.target_user.name }}</strong>
                        }
                      </div>
                    </li>
                  }
                </ol>
              }
            </div>
          }
        </div>

        <!-- ドロワーフッター (印刷ページへの移動など) -->
        @if (activeEquipment(); as eq) {
          <div class="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
            <a
              [routerLink]="['/print/label', eq.equipment_id]"
              class="heron-btn-secondary text-xs flex-1 text-center"
            >
              <app-icon name="printer" />
              ラベル印刷へ
            </a>
            <a
              [routerLink]="['/equipments', eq.equipment_id]"
              class="heron-btn-ghost text-xs flex-1 text-center"
            >
              個別ページで開く
            </a>
          </div>
        }
      </div>
    }
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

  // 右サイドドロワー関連の状態
  readonly drawerOpen = signal(false);
  readonly drawerLoading = signal(false);
  readonly activeEquipment = signal<Equipment | null>(null);
  readonly drawerLogs = signal<TransactionLog[]>([]);
  readonly drawerMessage = signal('');
  readonly drawerMessageIsError = signal(false);

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

  actionLabel(a: ActionType): string {
    return ACTION_LABEL[a] ?? a;
  }

  currentShelfText(eq: Equipment): string {
    if (eq.current_location) {
      return `${eq.current_location.room_name} / ${eq.current_location.shelf_name}`;
    }
    const shelves = this.master.shelves();
    if (shelves.length > 0) {
      return `[${shelves[0].code}] ${shelves[0].room_name} / ${shelves[0].shelf_name}`;
    }
    return '未設定';
  }

  openDrawer(eq: Equipment): void {
    this.activeEquipment.set(eq);
    this.drawerOpen.set(true);
    this.drawerLoading.set(true);
    this.drawerMessage.set('');
    this.targetUserId = null;
    this.targetLocationId = null;

    this.api.getEquipment(eq.equipment_id).subscribe({
      next: (res) => {
        this.activeEquipment.set(res.equipment);
        this.drawerLogs.set(res.recent_logs ?? []);
        this.drawerLoading.set(false);
      },
      error: () => this.drawerLoading.set(false),
    });
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.activeEquipment.set(null);
    this.drawerMessage.set('');
  }

  drawerLend(eq: Equipment): void {
    if (!this.targetUserId || !this.targetLocationId || this.actionBusy()) return;
    if (eq.status === 'in_use') {
      this.drawerMessage.set('この機材はすでに貸出中であるため、二重貸出はできません');
      this.drawerMessageIsError.set(true);
      return;
    }

    this.actionBusy.set(true);
    this.api.lend(eq.equipment_id, this.targetUserId).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.drawerMessage.set('ユーザーと棚IDを紐付けて貸出しました');
        this.drawerMessageIsError.set(false);
        this.openDrawer(eq);
        this.loadData();
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.drawerMessage.set(err?.error?.error ?? 'この機材はすでに貸出中です');
        this.drawerMessageIsError.set(true);
      },
    });
  }

  drawerReturn(eq: Equipment): void {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.api.return(eq.equipment_id, 1).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.drawerMessage.set('返却処理が完了しました');
        this.drawerMessageIsError.set(false);
        this.openDrawer(eq);
        this.loadData();
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.drawerMessage.set(err?.error?.error ?? '返却処理に失敗しました');
        this.drawerMessageIsError.set(true);
      },
    });
  }

  scanMatch(): void {
    if (!this.scanInput.trim()) return;
    const targetId = this.scanInput.trim().toUpperCase();
    this.scanning.set(true);
    this.scanError.set('');

    this.api.getEquipment(targetId).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.scanInput = '';
        this.openDrawer(res.equipment);
      },
      error: () => {
        this.scanning.set(false);
        this.scanError.set(`機材ID「${targetId}」は見つかりませんでした`);
      },
    });
  }
}
