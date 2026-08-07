import {
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { InventoryResult, Location } from '../../core/models';
import { ScannerService, normalizeEquipmentId } from '../../core/scanner.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * 棚卸しモード（設計書 3.3 連続スキャン）。
 *
 * 「対象の部屋・棚」を選択後カメラを起動し、次々にQRを読み込ませる。
 * 確定時に一括送信し、対象機材の現在位置をその棚に上書きして
 * 「保管中」ステータスとして棚卸しログを記録する。
 */
@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">棚卸しモード</h1>

    <!-- STEP 1: 対象の棚を選択 -->
    @if (!started()) {
      <div class="heron-card mt-4 p-5">
        <p class="text-xs text-heron-2">
          棚卸しを行う「部屋・棚」を選択してから、カメラを起動してください。
        </p>

        <label class="heron-label mt-4">対象の部屋・棚</label>
        <select class="heron-input" [(ngModel)]="locationId">
          <option [ngValue]="null">選択してください</option>
          @for (l of locations(); track l.location_id) {
            <option [ngValue]="l.location_id">
              {{ l.room_name }} / {{ l.shelf_name }}
            </option>
          }
        </select>

        @if (!cameraAvailable) {
          <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            カメラを利用できない環境です。手入力での棚卸しは可能です。
          </p>
        }

        <button
          class="heron-btn-primary mt-4 w-full"
          [disabled]="locationId === null"
          (click)="start()"
        >
          <app-icon name="camera" />
          棚卸しを開始
        </button>
      </div>
    }

    <!-- STEP 2: 連続スキャン -->
    @if (started() && !result()) {
      <div class="heron-card mt-4 p-3">
        <div class="text-[11px] font-semibold text-heron-2">対象の棚</div>
        <div class="text-sm font-bold text-heron-navy">{{ locationLabel() }}</div>
      </div>

      <div class="heron-card mt-3 overflow-hidden">
        <div class="relative aspect-[4/3] bg-heron-navy">
          <video #video class="h-full w-full object-cover" playsinline muted autoplay></video>
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div class="h-44 w-44 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(42,58,74,0.4)]"></div>
          </div>
          <div class="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2 text-center text-white">
            <span class="text-2xl font-bold">{{ scanned().length }}</span>
            <span class="ml-1 text-xs">件 読み取り済み</span>
          </div>
        </div>
      </div>

      @if (lastMessage()) {
        <p class="mt-2 rounded-lg px-3 py-2 text-xs"
           [class]="lastIsError() ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'">
          {{ lastMessage() }}
        </p>
      }

      <!-- 手入力 ＆ カメラQR読み取り -->
      <div class="heron-card mt-3 p-3">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <input
              class="heron-input heron-mono pr-8 w-full"
              placeholder="DEV-TAB-00001 (手入力/カメラ読み取り)"
              [(ngModel)]="manualId"
              (keyup.enter)="addManual()"
            />
            <span class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-blue-700 font-bold pointer-events-none">
              <app-icon name="camera" />
            </span>
          </div>
          <button class="heron-btn-secondary shrink-0 font-bold" (click)="addManual()">追加</button>
        </div>
      </div>

      <!-- 読み取り済みリスト -->
      @if (scanned().length > 0) {
        <ul class="mt-3 space-y-1.5">
          @for (id of reversedScanned(); track id) {
            <li class="heron-card flex items-center justify-between px-3 py-2">
              <span class="heron-mono text-sm font-semibold text-heron-navy">{{ id }}</span>
              <button
                class="flex items-center gap-1 text-xs text-heron-3 hover:text-red-600"
                (click)="remove(id)"
                [attr.aria-label]="id + ' を取り消す'"
              >
                <app-icon name="close" class="text-[0.7rem]" />
                取消
              </button>
            </li>
          }
        </ul>
      }

      <div class="sticky bottom-20 mt-4 flex gap-2 md:bottom-4">
        <button class="heron-btn-secondary flex-1" (click)="cancel()">中止</button>
        <button
          class="heron-btn-primary flex-1"
          [disabled]="submitting() || scanned().length === 0"
          (click)="submit()"
        >
          {{ submitting() ? '送信中...' : '棚卸しを確定 (' + scanned().length + '件)' }}
        </button>
      </div>
    }

    <!-- STEP 3: 結果 -->
    @if (result(); as r) {
      <div class="heron-card mt-4 p-5">
        <h2 class="text-base font-bold text-heron-navy">棚卸し結果</h2>
        <p class="mt-1 text-xs text-heron-2">{{ locationLabel() }}</p>

        <dl class="mt-4 grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-emerald-50 p-3">
            <dt class="text-[11px] font-semibold text-emerald-800">反映済み</dt>
            <dd class="text-2xl font-bold text-emerald-900">{{ r.updated.length }}</dd>
          </div>
          <div class="rounded-lg bg-sky-50 p-3">
            <dt class="text-[11px] font-semibold text-sky-800">他所からの移動</dt>
            <dd class="text-2xl font-bold text-sky-900">{{ r.moved_in.length }}</dd>
          </div>
          <div class="rounded-lg bg-red-50 p-3">
            <dt class="text-[11px] font-semibold text-red-800">未発見（要確認）</dt>
            <dd class="text-2xl font-bold text-red-900">{{ r.missing.length }}</dd>
          </div>
          <div class="rounded-lg bg-amber-50 p-3">
            <dt class="text-[11px] font-semibold text-amber-800">未登録ID</dt>
            <dd class="text-2xl font-bold text-amber-900">{{ r.not_found.length }}</dd>
          </div>
        </dl>

        @if (r.missing.length > 0) {
          <div class="mt-4">
            <h3 class="text-xs font-bold text-red-800">
              この棚にあるはずだが読み取られなかった機材
            </h3>
            <ul class="mt-2 space-y-1">
              @for (id of r.missing; track id) {
                <li class="heron-mono rounded bg-red-50 px-3 py-1.5 text-xs text-red-900">
                  {{ id }}
                </li>
              }
            </ul>
            <p class="mt-2 text-[11px] text-heron-2">
              ※ これらの所在情報は変更していません。実地で確認してください。
            </p>
          </div>
        }

        @if (r.not_found.length > 0) {
          <div class="mt-4">
            <h3 class="text-xs font-bold text-amber-800">システムに存在しない機材ID</h3>
            <ul class="mt-2 space-y-1">
              @for (id of r.not_found; track id) {
                <li class="heron-mono rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                  {{ id }}
                </li>
              }
            </ul>
          </div>
        }

        <button class="heron-btn-primary mt-5 w-full" (click)="reset()">
          続けて別の棚を棚卸しする
        </button>
      </div>
    }
  `,
})
export class InventoryComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly scanner = inject(ScannerService);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly cameraAvailable = ScannerService.isCameraAvailable();
  readonly locations = signal<Location[]>([]);
  readonly scanned = signal<string[]>([]);
  readonly started = signal(false);
  readonly submitting = signal(false);
  readonly result = signal<InventoryResult | null>(null);
  readonly lastMessage = signal('');
  readonly lastIsError = signal(false);

  locationId: number | null = null;
  manualId = '';

  constructor() {
    this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
  }

  ngOnDestroy(): void {
    void this.scanner.stop();
  }

  locationLabel(): string {
    const loc = this.locations().find((l) => l.location_id === this.locationId);
    return loc ? `${loc.room_name} / ${loc.shelf_name}` : '';
  }

  /** 直近に読んだものを先頭に出す（連続スキャン中の確認しやすさ優先）。 */
  reversedScanned(): string[] {
    return [...this.scanned()].reverse();
  }

  start(): void {
    if (this.locationId === null) return;
    this.started.set(true);
    this.result.set(null);
    this.scanned.set([]);

    if (!this.cameraAvailable) return;
    // video 要素は @if の描画後に現れるため、次のフレームで起動する。
    queueMicrotask(() => {
      const el = this.videoRef()?.nativeElement;
      if (!el) return;
      void this.scanner.start(
        el,
        (text) => this.onScanned(text),
        (msg) => this.notify(msg, true),
      );
    });
  }

  cancel(): void {
    void this.scanner.stop();
    this.started.set(false);
    this.scanned.set([]);
    this.lastMessage.set('');
  }

  reset(): void {
    this.result.set(null);
    this.started.set(false);
    this.scanned.set([]);
    this.locationId = null;
    this.lastMessage.set('');
  }

  addManual(): void {
    const id = normalizeEquipmentId(this.manualId);
    if (!id) {
      this.notify('機材IDの形式が正しくありません（例: HRN-TAB-0108）', true);
      return;
    }
    this.append(id);
    this.manualId = '';
  }

  remove(id: string): void {
    this.scanned.update((list) => list.filter((x) => x !== id));
  }

  submit(): void {
    if (this.locationId === null) return;
    this.submitting.set(true);
    this.api.inventory(this.locationId, this.scanned()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        void this.scanner.stop();
        this.result.set(res);
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify(err?.error?.error ?? '棚卸しの送信に失敗しました', true);
      },
    });
  }

  private onScanned(text: string): void {
    const id = normalizeEquipmentId(text);
    if (!id) {
      this.notify('HERON のラベルではありません', true);
      return;
    }
    this.append(id);
  }

  /** 重複読み取りは無視し、追加できたときだけフィードバックする。 */
  private append(id: string): void {
    if (this.scanned().includes(id)) {
      this.notify(`${id} は読み取り済みです`, false);
      return;
    }
    this.scanned.update((list) => [...list, id]);
    this.notify(`${id} を追加しました`, false);
    // 連続スキャンのテンポを妨げないよう、端末が対応していれば短く振動させる。
    navigator.vibrate?.(40);
  }

  private notify(text: string, isError: boolean): void {
    this.lastMessage.set(text);
    this.lastIsError.set(isError);
  }
}
