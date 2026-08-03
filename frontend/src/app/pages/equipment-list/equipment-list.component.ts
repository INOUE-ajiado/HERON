import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap } from 'rxjs';

import { ApiService, EquipmentQuery } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  CATEGORY_LABEL,
  Equipment,
  Location,
  STATUS_LABEL,
} from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * 機材検索・一覧（設計書 第1部 2章）。
 *
 * 一般ユーザーもステータスと所在の確認のために利用できる。
 */
@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, IconComponent],
  template: `
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-heron-navy">機材一覧</h1>
      @if (auth.isAdmin()) {
        <a routerLink="/equipments/new" class="heron-btn-primary shrink-0">
          <app-icon name="plus" />
          新規登録
        </a>
      }
    </div>

    <!-- 検索条件 -->
    <div class="heron-card mt-4 space-y-3 p-4">
      <input
        class="heron-input"
        placeholder="機材ID・名称・型番で検索"
        [(ngModel)]="keyword"
        (ngModelChange)="onFilterChange()"
      />

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label class="heron-label">カテゴリ</label>
          <select class="heron-input" [(ngModel)]="category" (ngModelChange)="onFilterChange()">
            <option value="">すべて</option>
            @for (c of categories; track c) {
              <option [value]="c">{{ c }} — {{ categoryLabel(c) }}</option>
            }
          </select>
        </div>

        <div>
          <label class="heron-label">ステータス</label>
          <select class="heron-input" [(ngModel)]="status" (ngModelChange)="onFilterChange()">
            <option value="">すべて</option>
            @for (s of statuses; track s.value) {
              <option [value]="s.value">{{ s.label }}</option>
            }
          </select>
        </div>

        <div>
          <label class="heron-label">保管場所</label>
          <select
            class="heron-input"
            [(ngModel)]="locationId"
            (ngModelChange)="onFilterChange()"
          >
            <option [ngValue]="null">すべて</option>
            @for (l of locations(); track l.location_id) {
              <option [ngValue]="l.location_id">
                {{ l.room_name }} / {{ l.shelf_name }}
              </option>
            }
          </select>
        </div>
      </div>
    </div>

    <!-- 結果 -->
    @if (loading()) {
      <p class="mt-4 text-xs text-heron-3">読み込み中...</p>
    } @else {
      <p class="mt-4 text-xs text-heron-2">{{ total() }} 件</p>

      @if (items().length === 0) {
        <div class="heron-card mt-2 p-8 text-center text-xs text-heron-2">
          条件に一致する機材がありません。
        </div>
      } @else {
        <ul class="mt-2 space-y-2">
          @for (eq of items(); track eq.equipment_id) {
            <li>
              <a
                [routerLink]="['/equipments', eq.equipment_id]"
                class="heron-card flex items-start justify-between gap-3 p-4 transition hover:bg-heron-silver"
              >
                <div class="min-w-0 flex-1">
                  <div class="heron-mono text-xs font-semibold text-heron-2">
                    {{ eq.equipment_id }}
                  </div>
                  <div class="truncate text-sm font-semibold text-heron-navy">
                    {{ eq.name }}
                  </div>
                  <div class="mt-1 flex items-center gap-1.5 truncate text-[11px] text-heron-2">
                    @if (eq.status === 'in_use') {
                      <app-icon name="user" />
                      <span class="truncate">{{ eq.current_user?.name ?? '（利用者不明）' }}</span>
                    } @else if (eq.current_location) {
                      <app-icon name="pin" />
                      <span class="truncate">
                        {{ eq.current_location.room_name }} /
                        {{ eq.current_location.shelf_name }}
                      </span>
                    } @else {
                      <span>所在未設定</span>
                    }
                  </div>
                </div>
                <app-status-badge [status]="eq.status" />
              </a>
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <div class="mt-4 flex items-center justify-center gap-3">
            <button
              class="heron-btn-secondary"
              [disabled]="page() <= 1"
              (click)="goPage(page() - 1)"
            >
              前へ
            </button>
            <span class="text-xs text-heron-2">{{ page() }} / {{ totalPages() }}</span>
            <button
              class="heron-btn-secondary"
              [disabled]="page() >= totalPages()"
              (click)="goPage(page() + 1)"
            >
              次へ
            </button>
          </div>
        }
      }
    }
  `,
})
export class EquipmentListComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly categories = ['PC', 'DSP', 'TAB', 'CAM'];
  readonly statuses = [
    { value: 'available', label: STATUS_LABEL.available },
    { value: 'in_use', label: STATUS_LABEL.in_use },
    { value: 'maintenance', label: STATUS_LABEL.maintenance },
    { value: 'discarded', label: STATUS_LABEL.discarded },
  ];

  keyword = '';
  category = '';
  status = '';
  locationId: number | null = null;

  readonly items = signal<Equipment[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly perPage = signal(25);
  readonly loading = signal(true);

  private readonly search$ = new Subject<EquipmentQuery>();

  constructor() {
    // 入力のたびに投げず、打鍵が落ち着いてから検索する。
    this.search$
      .pipe(
        debounceTime(250),
        switchMap((q) => this.api.listEquipments(q)),
      )
      .subscribe({
        next: (res) => {
          this.items.set(res.items ?? []);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.api.listLocations().subscribe({
      next: (res) => this.locations.set(res.items ?? []),
    });

    this.fetch();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.perPage()));
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetch();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.search$.next({
      q: this.keyword || undefined,
      category: this.category || undefined,
      status: this.status || undefined,
      location_id: this.locationId ?? undefined,
      // 廃棄済みは明示的に絞り込んだときだけ表示する。
      include_discarded: this.status === 'discarded' ? true : undefined,
      page: this.page(),
      per_page: this.perPage(),
    });
  }
}
