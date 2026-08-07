import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MasterService } from '../../core/master.service';
import {
  ACTION_LABEL,
  ActionType,
  CATEGORY_LABEL,
  Equipment,
  Location,
  STATUS_LABEL,
  TransactionLog,
  User,
} from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * 機材詳細 (二重貸出防止ガード付き).
 */
@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, StatusBadgeComponent, IconComponent],
  template: `
    @if (loading()) {
      <p class="py-8 text-center text-xs text-slate-400">読み込み中...</p>
    } @else if (error()) {
      <div class="py-8 text-center max-w-md mx-auto">
        <p class="text-xs text-red-700 font-semibold">{{ error() }}</p>
        <a routerLink="/equipments" class="heron-btn-secondary mt-4 text-xs">機材一覧へ戻る</a>
      </div>
    } @else if (equipment(); as eq) {
      <!-- ページヘッダー -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div class="flex items-center gap-3 min-w-0">
          <a routerLink="/equipments" class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-[#2A3A4A] hover:bg-slate-200 transition">
            <app-icon name="box" />
          </a>
          <div>
            <div class="flex items-center gap-2">
              <span class="heron-mono text-xs font-bold text-[#2A3A4A]">{{ eq.equipment_id }}</span>
              <app-status-badge [status]="eq.status" />
            </div>
            <h1 class="text-lg font-bold text-slate-900 truncate">{{ eq.name }}</h1>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a [routerLink]="['/print/label', eq.equipment_id]" class="heron-btn-secondary text-xs">
            <app-icon name="printer" />
            ラベル印刷
          </a>
          @if (auth.isAdmin()) {
            <button
              class="heron-btn text-xs border border-rose-200 text-rose-700 hover:bg-rose-50"
              [disabled]="busy() || eq.status === 'discarded'"
              (click)="discard()"
            >
              <app-icon name="trash" />
              除却
            </button>
          }
        </div>
      </div>

      @if (message()) {
        <p class="mt-3 rounded px-3 py-2 text-xs font-medium shadow-2xs"
           [class]="messageIsError() ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'">
          {{ message() }}
        </p>
      }

      <!-- 2カラム プレミアムレイアウト -->
      <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <!-- 左カラム (5/12): 貸出状況 ＆ スペック情報 -->
        <div class="space-y-4 lg:col-span-5">
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
                  <dt class="text-slate-600 font-semibold">貸出日時:</dt>
                  <dd class="font-mono text-xs text-slate-800">
                    {{ lastLendDate() ? (lastLendDate() | date: 'yyyy/MM/dd HH:mm') : (currentDate | date: 'yyyy/MM/dd HH:mm') }}
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

          <!-- スペック表 (HERON Navy テーマ) -->
          <div>
            <h2 class="text-xs font-bold text-[#2A3A4A] pb-1.5 border-b border-slate-200 flex items-center gap-1.5">
              <span class="inline-block w-1 h-3.5 bg-[#2A3A4A] rounded-full"></span>
              機材スペック・情報
            </h2>
            <dl class="divide-y divide-slate-100 text-xs">
              <div class="flex justify-between py-2">
                <dt class="font-semibold text-slate-500">カテゴリ</dt>
                <dd class="font-bold text-slate-900">
                  {{ eq.category }} — {{ categoryLabel(eq.category) }}
                </dd>
              </div>
              <div class="flex justify-between py-2">
                <dt class="font-semibold text-slate-500">型番</dt>
                <dd class="font-mono text-slate-800">{{ eq.model_number || '—' }}</dd>
              </div>
              <div class="flex justify-between py-2">
                <dt class="font-semibold text-slate-500">保管場所 (棚ID)</dt>
                <dd class="font-bold text-emerald-800">
                  {{ currentShelfText(eq) }}
                </dd>
              </div>
              <div class="flex justify-between py-2">
                <dt class="font-semibold text-slate-500">購入日</dt>
                <dd class="text-slate-800">
                  {{ eq.purchased_at ? (eq.purchased_at | date: 'yyyy/MM/dd') : '—' }}
                </dd>
              </div>
              @if (eq.note) {
                <div class="py-2">
                  <dt class="font-semibold text-slate-500 mb-1">備考</dt>
                  <dd class="whitespace-pre-wrap text-slate-700 bg-slate-50 p-2 rounded text-[11px] border border-slate-200/60">{{ eq.note }}</dd>
                </div>
              }
            </dl>
          </div>
        </div>

        <!-- 右カラム (7/12): 管理者割当操作 ＆ 履歴 -->
        <div class="space-y-5 lg:col-span-7">
          <!-- 管理者割当操作 (保管中 available の場合のみ貸出フォームを表示し二重貸出を防止) -->
          @if (auth.isAdmin()) {
            <div class="space-y-3">
              <h2 class="text-xs font-bold text-[#2A3A4A] pb-1.5 border-b border-slate-200 flex items-center gap-1.5">
                <span class="inline-block w-1 h-3.5 bg-[#2A3A4A] rounded-full"></span>
                管理者割当・貸出返却
              </h2>

              @if (eq.status === 'available') {
                <div class="rounded-md bg-slate-50/80 p-3.5 border border-slate-200 shadow-2xs space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-[#2A3A4A]">ユーザー紐付け・貸出登録</span>
                    <span class="text-[10px] text-slate-500">※ ユーザー名・棚ID必須</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label class="heron-label text-[11px]" for="targetUser">1. 対象ユーザー <span class="text-red-600">*</span></label>
                      <select id="targetUser" class="heron-input text-xs bg-white" [(ngModel)]="targetUserId">
                        <option [ngValue]="null">選択してください</option>
                        @for (u of users(); track u.user_id) {
                          <option [ngValue]="u.user_id">{{ u.name }} ({{ u.login_id }})</option>
                        }
                      </select>
                    </div>

                    <div>
                      <label class="heron-label text-[11px]" for="targetShelf">2. 保管場所 (棚ID) <span class="text-red-600">*</span></label>
                      <select id="targetShelf" class="heron-input text-xs bg-white" [(ngModel)]="targetLocationId">
                        <option [ngValue]="null">選択してください</option>
                        @for (s of master.shelves(); track s.code) {
                          <option [ngValue]="s.code">
                            [{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}
                          </option>
                        }
                      </select>
                    </div>
                  </div>

                  <div class="flex justify-end pt-1">
                    <button
                      class="heron-btn-primary text-xs disabled:opacity-40"
                      [disabled]="busy() || targetUserId === null || targetLocationId === null"
                      (click)="lend()"
                    >
                      {{ busy() ? '処理中...' : '紐付けて貸出を実行' }}
                    </button>
                  </div>
                </div>
              } @else if (eq.status === 'in_use') {
                <!-- 貸出中の場合は二重貸出を防止するため返却操作のみ案内 -->
                <div class="rounded-md bg-blue-50/50 p-3 border border-blue-200/70 text-xs text-blue-900 flex items-center justify-between">
                  <span class="font-bold">この機材は現在貸出中です（二重貸出防止ブロック中）</span>
                </div>
              }

              <div class="flex flex-wrap items-center gap-3 pt-2">
                @if (eq.status === 'in_use') {
                  <div class="flex items-center gap-2">
                    <select class="heron-input text-xs w-44 bg-white" [(ngModel)]="returnLocationId">
                      <option [ngValue]="null">返却先棚を選択</option>
                      @for (s of master.shelves(); track s.code) {
                        <option [ngValue]="s.code">[{{ s.code }}] {{ s.shelf_name }}</option>
                      }
                    </select>
                    <button
                      class="heron-btn-primary text-xs shrink-0 bg-emerald-700 hover:bg-emerald-800"
                      [disabled]="busy() || returnLocationId === null"
                      (click)="doReturn()"
                    >
                      返却処理
                    </button>
                  </div>
                }

                <div class="flex items-center gap-2 ml-auto">
                  <span class="text-[11px] font-bold text-slate-600">ステータス変更:</span>
                  <select class="heron-input text-xs w-32 bg-white" [(ngModel)]="newStatus">
                    <option value="available">{{ statusLabel.available }}</option>
                    <option value="maintenance">{{ statusLabel.maintenance }}</option>
                  </select>
                  <button class="heron-btn-secondary text-xs shrink-0" [disabled]="busy()" (click)="changeStatus()">
                    変更
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- フラット履歴タイムライン -->
          <div>
            <h2 class="text-xs font-bold text-[#2A3A4A] pb-1.5 border-b border-slate-200 flex items-center justify-between">
              <span class="flex items-center gap-1.5"><app-icon name="clock" /> 移動・貸出履歴</span>
              <span class="text-[10px] text-slate-500 font-bold">直近 {{ logs().length }} 件</span>
            </h2>

            @if (logs().length === 0) {
              <p class="py-6 text-center text-xs text-slate-400">履歴がありません。</p>
            } @else {
              <ol class="mt-2 space-y-1.5 max-h-72 overflow-y-auto">
                @for (log of logs(); track log.log_id) {
                  <li class="p-2 border border-slate-100 rounded text-xs hover:bg-slate-50 transition-colors">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-[#2A3A4A]">{{ actionLabel(log.action_type) }}</span>
                      <span class="font-mono text-[10px] text-slate-500">{{ log.timestamp | date: 'yyyy/MM/dd HH:mm' }}</span>
                    </div>
                    <div class="mt-0.5 text-[11px] text-slate-600">
                      操作者: {{ log.actor?.name ?? log.actor_user_id }}
                      @if (log.target_user) {
                        ／ 貸出先: <strong class="text-[#2A3A4A]">{{ log.target_user.name }}</strong>
                      }
                      @if (log.target_location) {
                        ／ 場所: {{ log.target_location.room_name }} / {{ log.target_location.shelf_name }}
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class EquipmentDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly master = inject(MasterService);

  readonly statusLabel = STATUS_LABEL;
  readonly currentDate = new Date();

  readonly equipment = signal<Equipment | null>(null);
  readonly logs = signal<TransactionLog[]>([]);
  readonly users = signal<User[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly messageIsError = signal(false);

  targetUserId: string | null = null;
  targetLocationId: number | string | null = null;
  returnLocationId: number | string | null = null;
  newStatus = 'available';

  private id = '';

  readonly lastLendDate = computed(() => {
    const lendLog = this.logs().find((l) => l.action_type === 'lend');
    return lendLog ? lendLog.timestamp : null;
  });

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();

    if (this.auth.isAdmin()) {
      this.api.listUsers().subscribe({ next: (r) => this.users.set(r.items ?? []) });
      this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
    }
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

  lend(): void {
    if (!this.targetUserId || !this.targetLocationId) return;
    const currentEq = this.equipment();
    if (currentEq && currentEq.status === 'in_use') {
      this.notify('この機材はすでに貸出中であるため貸出できません', true);
      return;
    }

    this.busy.set(true);
    this.api.lend(this.id, this.targetUserId).subscribe({
      next: () => {
        const locVal = typeof this.targetLocationId === 'number' ? this.targetLocationId : undefined;
        this.api.updateEquipment(this.id, {
          location_id: locVal,
          current_user_id: this.targetUserId,
          status: 'in_use',
        }).subscribe({
          next: () => {
            this.busy.set(false);
            this.notify('ユーザーと棚IDを紐付けて貸出しました', false);
            this.targetUserId = null;
            this.targetLocationId = null;
            this.load();
          },
          error: () => {
            this.busy.set(false);
            this.notify('貸出しました', false);
            this.load();
          },
        });
      },
      error: (err) => {
        this.busy.set(false);
        this.notify(err?.error?.error ?? 'この機材はすでに貸出中です。二重貸出はできません。', true);
      },
    });
  }

  doReturn(): void {
    if (this.returnLocationId === null) return;
    const locId = typeof this.returnLocationId === 'number' ? this.returnLocationId : 1;
    this.run(this.api.return(this.id, locId), '返却しました');
  }

  changeStatus(): void {
    this.run(
      this.api.updateEquipment(this.id, { status: this.newStatus }),
      'ステータスを変更しました',
    );
  }

  discard(): void {
    if (!confirm('この機材を除却しますか？（履歴は保持されます）')) return;
    this.busy.set(true);
    this.api.discardEquipment(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/equipments']);
      },
      error: (err) => {
        this.busy.set(false);
        this.notify(err?.error?.error ?? '除却に失敗しました', true);
      },
    });
  }

  private run(obs: { subscribe: (o: object) => void }, okMessage: string): void {
    this.busy.set(true);
    obs.subscribe({
      next: () => {
        this.busy.set(false);
        this.notify(okMessage, false);
        this.targetUserId = null;
        this.targetLocationId = null;
        this.returnLocationId = null;
        this.load();
      },
      error: (err: { error?: { error?: string } }) => {
        this.busy.set(false);
        this.notify(err?.error?.error ?? '処理に失敗しました', true);
      },
    });
  }

  private load(): void {
    this.api.getEquipment(this.id).subscribe({
      next: (detail) => {
        this.equipment.set(detail.equipment);
        this.logs.set(detail.recent_logs ?? []);
        this.targetLocationId = detail.equipment.current_location_id;
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? `機材が見つかりません: ${this.id}`);
        this.loading.set(false);
      },
    });
  }

  private notify(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }
}
