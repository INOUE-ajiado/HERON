import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
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
 * 機材詳細（設計書 3章 API `GET /api/equipments/{id}`）。
 *
 * 一般ユーザーはステータスと所在の閲覧のみ。
 * 管理者は貸出・返却・ステータス変更・ラベル印刷・除却を行える。
 */
@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, StatusBadgeComponent, IconComponent],
  template: `
    @if (loading()) {
      <p class="text-xs text-heron-3">読み込み中...</p>
    } @else if (error()) {
      <div class="heron-card p-6 text-center">
        <p class="text-sm text-red-700">{{ error() }}</p>
        <a routerLink="/equipments" class="heron-btn-secondary mt-4">機材一覧へ戻る</a>
      </div>
    } @else if (equipment(); as eq) {
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="heron-mono text-sm font-semibold text-heron-2">
            {{ eq.equipment_id }}
          </div>
          <h1 class="text-xl font-bold text-heron-navy">{{ eq.name }}</h1>
        </div>
        <app-status-badge [status]="eq.status" />
      </div>

      <!-- 基本情報 -->
      <dl class="heron-card mt-4 divide-y divide-heron-5/50">
        <div class="flex justify-between gap-4 px-4 py-3">
          <dt class="text-xs font-semibold text-heron-2">カテゴリ</dt>
          <dd class="text-xs text-heron-navy">
            {{ eq.category }} — {{ categoryLabel(eq.category) }}
          </dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3">
          <dt class="text-xs font-semibold text-heron-2">型番</dt>
          <dd class="text-xs text-heron-navy">{{ eq.model_number || '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3">
          <dt class="text-xs font-semibold text-heron-2">現在の所在</dt>
          <dd class="flex items-start justify-end gap-1.5 text-right text-xs text-heron-navy">
            @if (eq.status === 'in_use') {
              <app-icon name="user" class="mt-0.5" />
              <span>{{ eq.current_user?.name ?? '利用者不明' }}</span>
            } @else if (eq.current_location) {
              <app-icon name="pin" class="mt-0.5" />
              <span>
                {{ eq.current_location.room_name }}<br />
                {{ eq.current_location.shelf_name }}
              </span>
            } @else {
              <span>—</span>
            }
          </dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3">
          <dt class="text-xs font-semibold text-heron-2">購入日</dt>
          <dd class="text-xs text-heron-navy">
            {{ eq.purchased_at ? (eq.purchased_at | date: 'yyyy/MM/dd') : '—' }}
          </dd>
        </div>
        @if (eq.note) {
          <div class="px-4 py-3">
            <dt class="text-xs font-semibold text-heron-2">備考</dt>
            <dd class="mt-1 whitespace-pre-wrap text-xs text-heron-navy">{{ eq.note }}</dd>
          </div>
        }
      </dl>

      @if (message()) {
        <p class="mt-3 rounded-lg px-3 py-2 text-xs"
           [class]="messageIsError() ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'">
          {{ message() }}
        </p>
      }

      <!-- 管理者操作 -->
      @if (auth.isAdmin()) {
        <div class="heron-card mt-4 space-y-4 p-4">
          <h2 class="text-sm font-bold text-heron-navy">管理者操作</h2>

          @if (eq.status === 'available') {
            <div>
              <label class="heron-label">貸出先を選んで貸し出す</label>
              <div class="flex gap-2">
                <select class="heron-input" [(ngModel)]="targetUserId">
                  <option [ngValue]="null">選択してください</option>
                  @for (u of users(); track u.user_id) {
                    <option [ngValue]="u.user_id">{{ u.name }}</option>
                  }
                </select>
                <button
                  class="heron-btn-primary shrink-0"
                  [disabled]="busy() || targetUserId === null"
                  (click)="lend()"
                >
                  貸出
                </button>
              </div>
            </div>
          }

          @if (eq.status === 'in_use') {
            <div>
              <label class="heron-label">返却先を選んで返却する</label>
              <div class="flex gap-2">
                <select class="heron-input" [(ngModel)]="targetLocationId">
                  <option [ngValue]="null">選択してください</option>
                  @for (l of locations(); track l.location_id) {
                    <option [ngValue]="l.location_id">
                      {{ l.room_name }} / {{ l.shelf_name }}
                    </option>
                  }
                </select>
                <button
                  class="heron-btn-primary shrink-0"
                  [disabled]="busy() || targetLocationId === null"
                  (click)="doReturn()"
                >
                  返却
                </button>
              </div>
            </div>
          }

          <div>
            <label class="heron-label">ステータス変更</label>
            <div class="flex gap-2">
              <select class="heron-input" [(ngModel)]="newStatus">
                <option value="available">{{ statusLabel.available }}</option>
                <option value="maintenance">{{ statusLabel.maintenance }}</option>
              </select>
              <button class="heron-btn-secondary shrink-0" [disabled]="busy()" (click)="changeStatus()">
                変更
              </button>
            </div>
            <p class="mt-1 text-[11px] text-heron-3">
              ※ 貸出は上の「貸出」操作で行ってください。
            </p>
          </div>

          <div class="flex gap-2 pt-1">
            <a [routerLink]="['/print/label', eq.equipment_id]" class="heron-btn-secondary flex-1">
              <app-icon name="printer" />
              ラベル印刷
            </a>
            <button
              class="heron-btn flex-1 border border-red-300 bg-white text-red-700 hover:bg-red-50"
              [disabled]="busy() || eq.status === 'discarded'"
              (click)="discard()"
            >
              <app-icon name="trash" />
              除却
            </button>
          </div>
        </div>
      }

      <!-- 履歴 -->
      <section class="mt-6">
        <h2 class="text-sm font-bold text-heron-navy">最近の履歴</h2>
        @if (logs().length === 0) {
          <div class="heron-card mt-2 p-6 text-center text-xs text-heron-2">
            履歴がありません。
          </div>
        } @else {
          <ol class="mt-2 space-y-2">
            @for (log of logs(); track log.log_id) {
              <li class="heron-card px-4 py-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold text-heron-navy">
                    {{ actionLabel(log.action_type) }}
                  </span>
                  <span class="text-[11px] text-heron-3">
                    {{ log.timestamp | date: 'yyyy/MM/dd HH:mm' }}
                  </span>
                </div>
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
              </li>
            }
          </ol>
        }
      </section>
    }
  `,
})
export class EquipmentDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly statusLabel = STATUS_LABEL;

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
  targetLocationId: number | null = null;
  newStatus = 'available';

  private id = '';

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

  lend(): void {
    if (!this.targetUserId) return;
    this.run(this.api.lend(this.id, this.targetUserId), '貸出しました');
  }

  doReturn(): void {
    if (this.targetLocationId === null) return;
    this.run(this.api.return(this.id, this.targetLocationId), '返却しました');
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
