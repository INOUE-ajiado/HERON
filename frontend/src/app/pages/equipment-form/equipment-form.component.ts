import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, getDefaultAccessories } from '../../core/api.service';
import { MasterService } from '../../core/master.service';
import { AccessoryItem, CATEGORY_LABEL, Location, User } from '../../core/models';

/**
 * 機材の新規登録 (付属品チェックリスト対応)。
 */
@Component({
  selector: 'app-equipment-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          機材の新規登録
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">カテゴリ指定により管理IDが自動採番され、標準付属品セットが提示されます</p>
      </div>

      <a routerLink="/equipments" class="heron-btn-secondary text-xs">
        機材一覧へ戻る
      </a>
    </div>

    <form (ngSubmit)="submit()" class="mt-4 space-y-4 max-w-2xl bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
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

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="heron-label" for="deptId">
            部署ID (部署コード) <span class="text-red-600">*</span>
          </label>
          <select id="deptId" name="deptId" class="heron-input" [(ngModel)]="deptId">
            @for (d of master.departments(); track d.code) {
              <option [value]="d.code">{{ d.code }} — {{ d.name }}</option>
            }
          </select>
        </div>

        <div>
          <label class="heron-label" for="category">
            カテゴリ <span class="text-red-600">*</span>
          </label>
          <select id="category" name="category" class="heron-input" [(ngModel)]="category" (change)="onCategoryChange()">
            @for (c of master.categories(); track c.code) {
              <option [value]="c.code">{{ c.code }} — {{ c.name }}</option>
            }
          </select>
        </div>
      </div>

      <p class="text-[11px] text-slate-500 font-medium">
        ※ 機材管理IDは 「{{ deptId ? deptId.toUpperCase() : 'HRN' }}-{{ category }}-XXXXX」 の形式で自動採番されます。
      </p>

      <!-- 付属品チェックリストテンプレート -->
      <div class="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-2">
        <label class="heron-label text-xs font-bold text-[#2A3A4A] flex items-center justify-between">
          <span>セット付属品チェックリスト (ペン・ACアダプター等)</span>
          <span class="text-[10px] text-slate-500 font-normal">個別シール不要</span>
        </label>
        <div class="space-y-1.5">
          @for (acc of accessories; track acc.name; let i = $index) {
            <div class="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded border border-slate-200">
              <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                <input
                  type="checkbox"
                  class="rounded text-blue-600 focus:ring-blue-500"
                  [(ngModel)]="acc.present"
                  [name]="'acc_' + i"
                />
                <span>{{ acc.name }}</span>
              </label>
              <span class="text-[10px] font-bold" [class]="acc.present ? 'text-emerald-700' : 'text-amber-700'">
                {{ acc.present ? '✓ 付属' : '✗ 欠品' }}
              </span>
            </div>
          }
        </div>
      </div>

      <div>
        <label class="heron-label" for="model">型番</label>
        <input
          id="model"
          name="model"
          class="heron-input font-mono"
          placeholder="例: DTH-2420"
          [(ngModel)]="modelNumber"
        />
      </div>

      <!-- 棚コード (保管場所) 選択 -->
      <div>
        <label class="heron-label" for="location">
          保管場所 (棚コード) <span class="text-red-600">*</span>
        </label>
        <select id="location" name="location" class="heron-input" [(ngModel)]="locationId">
          <option [ngValue]="null">選択してください</option>
          @for (s of master.shelves(); track s.code) {
            <option [ngValue]="s.code">
              [{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}
            </option>
          }
        </select>
        <p class="mt-1 text-[11px] text-slate-500">
          棚卸しや現物管理のため、使用者を紐付ける場合も保管先の棚コードを指定してください。
        </p>
      </div>

      <div>
        <label class="heron-label" for="user">初期の使用者 (利用者)</label>
        <select id="user" name="user" class="heron-input" [(ngModel)]="userId">
          <option [ngValue]="null">未設定（保管中）</option>
          @for (u of users(); track u.user_id) {
            <option [ngValue]="u.user_id">
              {{ u.name }} ({{ u.login_id }})
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
        <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 font-semibold">{{ error() }}</p>
      }

      <div class="flex gap-2 pt-2 border-t border-slate-200">
        <a routerLink="/equipments" class="heron-btn-secondary flex-1">キャンセル</a>
        <button type="submit" class="heron-btn-primary flex-1 font-bold" [disabled]="saving()">
          {{ saving() ? '登録中...' : '登録してラベル印刷へ進む' }}
        </button>
      </div>
    </form>
  `,
})
export class EquipmentFormComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly master = inject(MasterService);

  name = '';
  deptId = 'DEV';
  category = 'TAB';
  modelNumber = '';
  locationId: number | string | null = null;
  userId: string | null = null;
  purchasedAt = '';
  note = '';

  accessories: AccessoryItem[] = getDefaultAccessories('TAB');

  readonly locations = signal<Location[]>([]);
  readonly users = signal<User[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');

  constructor() {
    this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
    this.api.listUsers().subscribe({ next: (r) => this.users.set(r.items ?? []) });
  }

  onCategoryChange(): void {
    this.accessories = getDefaultAccessories(this.category);
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

    const locVal = typeof this.locationId === 'number' ? this.locationId : null;

    this.api
      .createEquipment({
        name: this.name.trim(),
        category: this.category,
        dept_id: this.deptId.trim(),
        model_number: this.modelNumber.trim(),
        location_id: locVal,
        user_id: this.userId,
        purchased_at: this.purchasedAt || undefined,
        note: this.note.trim(),
        accessories: this.accessories,
      })
      .subscribe({
        next: (eq) => {
          this.saving.set(false);
          void this.router.navigate(['/print/label', eq.equipment_id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.error ?? '登録に失敗しました');
        },
      });
  }
}
