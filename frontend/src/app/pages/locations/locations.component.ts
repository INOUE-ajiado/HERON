import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { MasterService, ShelfMaster } from '../../core/master.service';
import { Location } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/**
 * 保管場所マスタの管理 (HERON Navy テーマカラー ＆ プレミアム UI)。
 */
@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          保管場所 (棚コード) マスタ
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          部屋と棚の組み合わせおよび「棚コード」で機材の保管場所と棚卸しを管理します。
        </p>
      </div>
    </div>

    <!-- 2カラム プレミアム構成 -->
    <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- 左カラム (4/12): 新規追加フォーム -->
      <div class="space-y-3 lg:col-span-4">
        <h2 class="text-xs font-bold text-[#2A3A4A] pb-1.5 border-b border-slate-200 flex items-center gap-1.5">
          <app-icon name="plus" />
          保管場所 (棚コード) 追加
        </h2>

        <form (ngSubmit)="add()" class="space-y-3 bg-slate-50/80 p-3.5 rounded-md border border-slate-200 shadow-2xs">
          <div>
            <label class="heron-label text-[11px]" for="shelfCode">
              棚コード <span class="text-red-600">*</span>
            </label>
            <div class="relative">
              <input
                id="shelfCode"
                name="shelfCode"
                class="heron-input text-xs uppercase bg-white font-mono pr-8"
                placeholder="例: SHELF-DEV01"
                [(ngModel)]="shelfCode"
                required
              />
              <span class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-blue-700 font-bold pointer-events-none" title="カメラで棚QR読み取り">
                <app-icon name="camera" />
              </span>
            </div>
          </div>

          <div>
            <label class="heron-label text-[11px]" for="room">
              部屋名 <span class="text-red-600">*</span>
            </label>
            <input
              id="room"
              name="room"
              class="heron-input text-xs bg-white"
              placeholder="例: 開発室"
              [(ngModel)]="roomName"
              required
            />
          </div>

          <div>
            <label class="heron-label text-[11px]" for="shelf">
              棚・保管名 <span class="text-red-600">*</span>
            </label>
            <input
              id="shelf"
              name="shelf"
              class="heron-input text-xs bg-white"
              placeholder="例: メイン保管棚"
              [(ngModel)]="shelfName"
              required
            />
          </div>

          @if (message()) {
            <p class="rounded px-3 py-2 text-xs font-medium shadow-2xs"
               [class]="messageIsError() ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'">
              {{ message() }}
            </p>
          }

          <button type="submit" class="heron-btn-primary w-full text-xs font-bold" [disabled]="busy()">
            <app-icon name="plus" />
            保管場所を追加
          </button>
        </form>
      </div>

      <!-- 右カラム (8/12): 登録済み棚一覧 & ラベル印刷 -->
      <div class="space-y-3 lg:col-span-8">
        <div class="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <h2 class="text-xs font-bold text-[#2A3A4A] flex items-center gap-1.5">
            <app-icon name="shelf" />
            登録済み保管場所・棚一覧
          </h2>
          <span class="text-xs text-slate-500 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">{{ shelves().length }} 件</span>
        </div>

        @if (shelves().length === 0) {
          <p class="py-8 text-center text-xs text-slate-400">保管場所が登録されていません。</p>
        } @else {
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            @for (s of shelves(); track s.code) {
              <div class="rounded-md border border-slate-200/80 p-3 bg-white hover:border-[#2A3A4A]/50 hover:shadow-xs transition-all duration-150 flex flex-col justify-between gap-2">
                <div>
                  <div class="flex items-center justify-between">
                    <span class="inline-block rounded bg-[#2A3A4A] px-2 py-0.5 font-mono text-xs font-bold text-white shadow-2xs">
                      {{ s.code }}
                    </span>
                    <button
                      class="text-xs text-slate-400 hover:text-rose-600 font-semibold"
                      (click)="remove(s)"
                    >
                      削除
                    </button>
                  </div>
                  <div class="mt-1.5 text-xs font-bold text-slate-900">
                    {{ s.room_name }}
                  </div>
                  <div class="text-[11px] text-slate-600 font-medium">{{ s.shelf_name }}</div>
                </div>

                <div class="pt-2 border-t border-slate-100 flex justify-end">
                  <a
                    [routerLink]="['/print/shelf-label', s.code]"
                    class="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-[#2A3A4A] hover:bg-slate-200 transition"
                  >
                    <app-icon name="printer" />
                    棚ラベル印刷
                  </a>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class LocationsComponent {
  private readonly api = inject(ApiService);
  readonly master = inject(MasterService);

  readonly busy = signal(false);
  readonly message = signal('');
  readonly messageIsError = signal(false);

  shelfCode = '';
  roomName = '';
  shelfName = '';

  readonly shelves = computed(() => this.master.shelves());

  add(): void {
    if (!this.shelfCode.trim() || !this.roomName.trim() || !this.shelfName.trim()) {
      this.notify('棚コード・部屋名・棚名のすべてを入力してください', true);
      return;
    }
    this.busy.set(true);
    try {
      this.master.addShelf({
        code: this.shelfCode.toUpperCase().trim(),
        room_name: this.roomName.trim(),
        shelf_name: this.shelfName.trim(),
      });
      this.api.createLocation(this.roomName.trim(), `${this.shelfCode.toUpperCase()} (${this.shelfName.trim()})`).subscribe();
      this.busy.set(false);
      this.notify('保管場所 (棚コード) を追加しました', false);
      this.shelfCode = '';
      this.roomName = '';
      this.shelfName = '';
    } catch (err: any) {
      this.busy.set(false);
      this.notify(err?.message ?? '追加に失敗しました', true);
    }
  }

  remove(s: ShelfMaster): void {
    if (!confirm(`保管場所「${s.code} — ${s.room_name} / ${s.shelf_name}」を削除しますか？`)) return;
    this.master.removeShelf(s.code);
    this.notify('削除しました', false);
  }

  private notify(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }
}
