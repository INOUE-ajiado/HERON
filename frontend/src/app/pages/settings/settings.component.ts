import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MasterService, DepartmentMaster, CategoryMaster } from '../../core/master.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">マスタ設定管理</h1>
    <p class="mt-1 text-xs text-heron-2">
      自動採番や機材管理で利用する「部署ID (部署コード)」と「機材カテゴリ」を登録・編集します。
    </p>

    <!-- 保管場所マスタ統合の案内カード -->
    <div class="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
          <app-icon name="shelf" />
        </div>
        <div>
          <h3 class="text-xs font-bold text-blue-900">保管場所 (棚コード) マスタの一元管理</h3>
          <p class="text-[11px] text-blue-700 mt-0.5">
            棚コード、部屋名、棚・ラック名および棚バーコードラベルの印刷は「保管場所マスタ」で集約管理しています。
          </p>
        </div>
      </div>
      <a routerLink="/locations" class="heron-btn-primary text-xs shrink-0 bg-blue-700 hover:bg-blue-800">
        <app-icon name="shelf" />
        保管場所マスタへ進む
      </a>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- 部署IDマスタ設定 -->
      <div class="heron-card p-5 bg-white">
        <h2 class="text-base font-bold text-heron-navy flex items-center gap-2">
          部署ID (部署コード) マスタ
        </h2>
        <p class="mt-1 text-[11px] text-heron-3">
          管理名プレフィックスとして使われるコードです（例: DEV, ANIM, SALES）。
        </p>

        <!-- 新規部署追加フォーム -->
        <form (ngSubmit)="addDept()" class="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label class="heron-label" for="deptCode">部署コード <span class="text-red-600">*</span></label>
              <input
                id="deptCode"
                name="deptCode"
                class="heron-input uppercase"
                placeholder="例: DEV"
                [(ngModel)]="newDeptCode"
                required
              />
            </div>
            <div>
              <label class="heron-label" for="deptName">部署名 <span class="text-red-600">*</span></label>
              <input
                id="deptName"
                name="deptName"
                class="heron-input"
                placeholder="例: システム開発部"
                [(ngModel)]="newDeptName"
                required
              />
            </div>
          </div>
          <button type="submit" class="heron-btn-primary w-full text-xs">
            <app-icon name="plus" />
            部署を追加
          </button>
        </form>

        @if (deptError()) {
          <p class="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{{ deptError() }}</p>
        }

        <!-- 部署一覧 -->
        <div class="mt-4 space-y-2 max-h-72 overflow-y-auto">
          @for (d of master.departments(); track d.code) {
            <div class="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-white">
              <div>
                <span class="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                  {{ d.code }}
                </span>
                <span class="ml-2 text-xs text-slate-700">{{ d.name }}</span>
              </div>
              <button
                type="button"
                (click)="removeDept(d)"
                class="text-xs text-slate-400 hover:text-red-600"
              >
                削除
              </button>
            </div>
          }
        </div>
      </div>

      <!-- 機材カテゴリマスタ設定 -->
      <div class="heron-card p-5 bg-white">
        <h2 class="text-base font-bold text-heron-navy flex items-center gap-2">
          機材カテゴリマスタ
        </h2>
        <p class="mt-1 text-[11px] text-heron-3">
          機材種別のコードです（例: PC, DSP, TAB, CAM）。
        </p>

        <!-- 新規カテゴリ追加フォーム -->
        <form (ngSubmit)="addCat()" class="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label class="heron-label" for="catCode">カテゴリコード <span class="text-red-600">*</span></label>
              <input
                id="catCode"
                name="catCode"
                class="heron-input uppercase"
                placeholder="例: VR"
                [(ngModel)]="newCatCode"
                required
              />
            </div>
            <div>
              <label class="heron-label" for="catName">カテゴリ名 <span class="text-red-600">*</span></label>
              <input
                id="catName"
                name="catName"
                class="heron-input"
                placeholder="例: VRゴーグル"
                [(ngModel)]="newCatName"
                required
              />
            </div>
          </div>
          <button type="submit" class="heron-btn-primary w-full text-xs">
            <app-icon name="plus" />
            カテゴリを追加
          </button>
        </form>

        @if (catError()) {
          <p class="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{{ catError() }}</p>
        }

        <!-- カテゴリ一覧 -->
        <div class="mt-4 space-y-2 max-h-72 overflow-y-auto">
          @for (c of master.categories(); track c.code) {
            <div class="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-white">
              <div>
                <span class="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                  {{ c.code }}
                </span>
                <span class="ml-2 text-xs text-slate-700">{{ c.name }}</span>
              </div>
              <button
                type="button"
                (click)="removeCat(c)"
                class="text-xs text-slate-400 hover:text-red-600"
              >
                削除
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  readonly master = inject(MasterService);

  newDeptCode = '';
  newDeptName = '';
  readonly deptError = signal('');

  newCatCode = '';
  newCatName = '';
  readonly catError = signal('');

  addDept(): void {
    if (!this.newDeptCode || !this.newDeptName) {
      this.deptError.set('部署コードと部署名を入力してください');
      return;
    }
    this.deptError.set('');
    try {
      this.master.addDepartment({ code: this.newDeptCode, name: this.newDeptName });
      this.newDeptCode = '';
      this.newDeptName = '';
    } catch (err: any) {
      this.deptError.set(err?.message ?? '追加に失敗しました');
    }
  }

  removeDept(dept: DepartmentMaster): void {
    if (!confirm(`部署「${dept.code} — ${dept.name}」を削除しますか？`)) return;
    this.master.removeDepartment(dept.code);
  }

  addCat(): void {
    if (!this.newCatCode || !this.newCatName) {
      this.catError.set('カテゴリコードとカテゴリ名を入力してください');
      return;
    }
    this.catError.set('');
    try {
      this.master.addCategory({ code: this.newCatCode, name: this.newCatName });
      this.newCatCode = '';
      this.newCatName = '';
    } catch (err: any) {
      this.catError.set(err?.message ?? '追加に失敗しました');
    }
  }

  removeCat(cat: CategoryMaster): void {
    if (!confirm(`カテゴリ「${cat.code} — ${cat.name}」を削除しますか？`)) return;
    this.master.removeCategory(cat.code);
  }
}
