import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { CATEGORY_LABEL, Equipment, Location } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/**
 * 機材の新規登録（設計書 3.1 / API `POST /api/equipments`）。
 *
 * IDはカテゴリごとにシステムが自動採番するため、入力欄は設けない。
 * 登録直後はそのままラベル印刷に進めるようにしている。
 */
@Component({
  selector: 'app-equipment-form',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">機材の新規登録</h1>

    @if (created(); as eq) {
      <!-- 登録完了 -->
      <div class="heron-card mt-4 p-6 text-center">
        <div
          class="mx-auto flex h-11 w-11 items-center justify-center rounded-full
                 bg-status-available text-[1.15rem] text-white"
        >
          <app-icon name="check" />
        </div>
        <p class="mt-3 text-xs text-heron-2">登録が完了しました。採番されたIDは:</p>
        <p class="heron-mono mt-1 text-2xl font-bold text-heron-navy">
          {{ eq.equipment_id }}
        </p>
        <p class="mt-1 text-sm text-heron-1">{{ eq.name }}</p>

        <div class="mt-6 flex flex-col gap-2 sm:flex-row">
          <a [routerLink]="['/print/label', eq.equipment_id]" class="heron-btn-primary flex-1">
            <app-icon name="printer" />
            ラベルを印刷する
          </a>
          <button class="heron-btn-secondary flex-1" (click)="again()">
            続けて登録する
          </button>
          <a [routerLink]="['/equipments', eq.equipment_id]" class="heron-btn-ghost flex-1">
            詳細を開く
          </a>
        </div>
      </div>
    } @else {
      <form (ngSubmit)="submit()" class="heron-card mt-4 space-y-4 p-5">
        <div>
          <label class="heron-label" for="name">機材名 <span class="text-red-600">*</span></label>
          <input
            id="name"
            name="name"
            class="heron-input"
            placeholder="例: Wacom Cintiq Pro 24"
            [(ngModel)]="name"
            required
          />
        </div>

        <div>
          <label class="heron-label" for="category">
            カテゴリ <span class="text-red-600">*</span>
          </label>
          <select id="category" name="category" class="heron-input" [(ngModel)]="category">
            @for (c of categories; track c) {
              <option [value]="c">{{ c }} — {{ categoryLabel(c) }}</option>
            }
          </select>
          <p class="mt-1 text-[11px] text-heron-3">
            機材IDは HRN-{{ category }}-XXXX の形式で自動採番されます。
          </p>
        </div>

        <div>
          <label class="heron-label" for="model">型番</label>
          <input
            id="model"
            name="model"
            class="heron-input"
            placeholder="例: DTH-2420"
            [(ngModel)]="modelNumber"
          />
        </div>

        <div>
          <label class="heron-label" for="location">初期の保管場所</label>
          <select id="location" name="location" class="heron-input" [(ngModel)]="locationId">
            <option [ngValue]="null">未設定</option>
            @for (l of locations(); track l.location_id) {
              <option [ngValue]="l.location_id">
                {{ l.room_name }} / {{ l.shelf_name }}
              </option>
            }
          </select>
        </div>

        <div>
          <label class="heron-label" for="purchased">購入日</label>
          <input
            id="purchased"
            name="purchased"
            type="date"
            class="heron-input"
            [(ngModel)]="purchasedAt"
          />
        </div>

        <div>
          <label class="heron-label" for="note">備考</label>
          <textarea
            id="note"
            name="note"
            rows="3"
            class="heron-input"
            [(ngModel)]="note"
          ></textarea>
        </div>

        @if (error()) {
          <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{{ error() }}</p>
        }

        <div class="flex gap-2">
          <a routerLink="/equipments" class="heron-btn-secondary flex-1">キャンセル</a>
          <button type="submit" class="heron-btn-primary flex-1" [disabled]="saving()">
            {{ saving() ? '登録中...' : '登録してIDを採番' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class EquipmentFormComponent {
  private readonly api = inject(ApiService);

  readonly categories = ['PC', 'DSP', 'TAB', 'CAM'];

  name = '';
  category = 'TAB';
  modelNumber = '';
  locationId: number | null = null;
  purchasedAt = '';
  note = '';

  readonly locations = signal<Location[]>([]);
  readonly created = signal<Equipment | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');

  constructor() {
    this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
  }

  submit(): void {
    if (!this.name.trim()) {
      this.error.set('機材名を入力してください');
      return;
    }
    this.saving.set(true);
    this.error.set('');

    this.api
      .createEquipment({
        name: this.name.trim(),
        category: this.category,
        model_number: this.modelNumber.trim(),
        location_id: this.locationId,
        purchased_at: this.purchasedAt || undefined,
        note: this.note.trim(),
      })
      .subscribe({
        next: (eq) => {
          this.saving.set(false);
          this.created.set(eq);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.error ?? '登録に失敗しました');
        },
      });
  }

  /** 続けて登録する。カテゴリと保管場所は据え置き、個体情報だけ空にする。 */
  again(): void {
    this.created.set(null);
    this.name = '';
    this.modelNumber = '';
    this.note = '';
  }
}
