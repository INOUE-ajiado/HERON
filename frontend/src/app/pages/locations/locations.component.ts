import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { Location } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/**
 * 保管場所マスタの管理（設計書 第1部 2章「マスタデータ（部屋、棚情報）の管理」）。
 */
@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">保管場所マスタ</h1>
    <p class="mt-1 text-xs text-heron-2">部屋と棚の組み合わせで機材の所在を管理します。</p>

    <!-- 新規登録 -->
    <form (ngSubmit)="add()" class="heron-card mt-4 space-y-3 p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="heron-label" for="room">部屋名</label>
          <input
            id="room"
            name="room"
            class="heron-input"
            placeholder="例: 第1作画室"
            [(ngModel)]="roomName"
          />
        </div>
        <div>
          <label class="heron-label" for="shelf">棚名</label>
          <input
            id="shelf"
            name="shelf"
            class="heron-input"
            placeholder="例: 機材棚A-3段目"
            [(ngModel)]="shelfName"
          />
        </div>
      </div>

      @if (message()) {
        <p class="rounded-lg px-3 py-2 text-xs"
           [class]="messageIsError() ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'">
          {{ message() }}
        </p>
      }

      <button type="submit" class="heron-btn-primary w-full sm:w-auto" [disabled]="busy()">
        <app-icon name="plus" />
        保管場所を追加
      </button>
    </form>

    <!-- 一覧 -->
    @if (loading()) {
      <p class="mt-4 text-xs text-heron-3">読み込み中...</p>
    } @else if (items().length === 0) {
      <div class="heron-card mt-4 p-8 text-center text-xs text-heron-2">
        保管場所が登録されていません。
      </div>
    } @else {
      <ul class="mt-4 space-y-2">
        @for (l of items(); track l.location_id) {
          <li class="heron-card flex items-center justify-between gap-3 px-4 py-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-heron-navy">
                {{ l.room_name }}
              </div>
              <div class="truncate text-[11px] text-heron-2">{{ l.shelf_name }}</div>
            </div>
            <button
              class="shrink-0 text-xs text-heron-3 hover:text-red-600"
              [disabled]="busy()"
              (click)="remove(l)"
            >
              削除
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class LocationsComponent {
  private readonly api = inject(ApiService);

  readonly items = signal<Location[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly messageIsError = signal(false);

  roomName = '';
  shelfName = '';

  constructor() {
    this.load();
  }

  add(): void {
    if (!this.roomName.trim() || !this.shelfName.trim()) {
      this.notify('部屋名と棚名の両方を入力してください', true);
      return;
    }
    this.busy.set(true);
    this.api.createLocation(this.roomName.trim(), this.shelfName.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify('保管場所を追加しました', false);
        this.roomName = '';
        this.shelfName = '';
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.notify(err?.error?.error ?? '追加に失敗しました', true);
      },
    });
  }

  remove(l: Location): void {
    if (!confirm(`「${l.room_name} / ${l.shelf_name}」を削除しますか？`)) return;
    this.busy.set(true);
    this.api.deleteLocation(l.location_id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify('削除しました', false);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        // 機材が紐づいている場合はサーバ側で 409 になる。
        this.notify(err?.error?.error ?? '削除に失敗しました', true);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listLocations().subscribe({
      next: (r) => {
        this.items.set(r.items ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private notify(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }
}
