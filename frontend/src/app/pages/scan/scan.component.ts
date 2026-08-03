import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { Equipment, Location, User } from '../../core/models';
import { ScannerService, normalizeEquipmentId } from '../../core/scanner.service';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

/**
 * 単一スキャン画面（設計書 3.3）。
 *
 * 管理者がスマホのカメラで機材のQRをスキャンすると機材情報がポップアップし、
 * その場で「誰に貸すか」を選んで貸出、または「返却」を1タップで完了させる。
 */
@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, IconComponent],
  template: `
    <h1 class="text-xl font-bold text-heron-navy">貸出・返却スキャン</h1>
    <p class="mt-1 text-xs text-heron-2">
      機材のQRラベルをカメラにかざしてください。
    </p>

    @if (!cameraAvailable) {
      <div class="heron-card mt-4 border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
        このブラウザではカメラを利用できません。HTTPS または localhost
        でアクセスしてください。下の手入力欄は利用できます。
      </div>
    }

    <!-- カメラビュー -->
    <div class="heron-card mt-4 overflow-hidden">
      <div class="relative aspect-[4/3] bg-heron-navy">
        <video
          #video
          class="h-full w-full object-cover"
          playsinline
          muted
          autoplay
        ></video>

        <!-- 読み取りガイド -->
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="h-48 w-48 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(42,58,74,0.45)]"></div>
        </div>

        @if (scanning()) {
          <div class="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white">
            <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
            スキャン中
          </div>
        }
      </div>

      <div class="flex gap-2 p-3">
        @if (scanning()) {
          <button class="heron-btn-secondary flex-1" (click)="stopScan()">停止</button>
        } @else {
          <button
            class="heron-btn-primary flex-1"
            [disabled]="!cameraAvailable"
            (click)="startScan()"
          >
            カメラを起動
          </button>
        }
      </div>
    </div>

    <!-- 手入力（ラベル汚損・カメラ不可時のフォールバック） -->
    <div class="heron-card mt-3 p-4">
      <label class="heron-label">機材IDを手入力</label>
      <div class="flex gap-2">
        <input
          class="heron-input heron-mono"
          placeholder="HRN-TAB-0108"
          [(ngModel)]="manualId"
          (keyup.enter)="lookupManual()"
        />
        <button class="heron-btn-secondary shrink-0" (click)="lookupManual()">照会</button>
      </div>
    </div>

    @if (message()) {
      <p class="mt-3 rounded-lg px-3 py-2 text-xs"
         [class]="messageIsError() ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'">
        {{ message() }}
      </p>
    }

    <!-- 読み取り結果ポップアップ -->
    @if (target(); as eq) {
      <div class="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
        <div class="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="heron-mono text-xs font-semibold text-heron-2">
                {{ eq.equipment_id }}
              </div>
              <div class="text-base font-bold text-heron-navy">{{ eq.name }}</div>
              @if (eq.model_number) {
                <div class="text-[11px] text-heron-2">{{ eq.model_number }}</div>
              }
            </div>
            <app-status-badge [status]="eq.status" />
          </div>

          <div class="mt-3 rounded-lg bg-heron-silver/60 px-3 py-2 text-[11px] text-heron-1">
            @if (eq.status === 'in_use') {
              現在の利用者: <strong>{{ eq.current_user?.name ?? '不明' }}</strong>
            } @else if (eq.current_location) {
              現在の所在:
              <strong>
                {{ eq.current_location.room_name }} / {{ eq.current_location.shelf_name }}
              </strong>
            } @else {
              所在は未設定です
            }
          </div>

          <!-- 貸出中 → 返却 -->
          @if (eq.status === 'in_use') {
            <div class="mt-4">
              <label class="heron-label">返却先の保管場所</label>
              <select class="heron-input" [(ngModel)]="selectedLocationId">
                <option [ngValue]="null">選択してください</option>
                @for (l of locations(); track l.location_id) {
                  <option [ngValue]="l.location_id">
                    {{ l.room_name }} / {{ l.shelf_name }}
                  </option>
                }
              </select>
              <button
                class="heron-btn-primary mt-3 w-full"
                [disabled]="submitting() || selectedLocationId === null"
                (click)="doReturn(eq)"
              >
                <app-icon name="return" />
                返却する
              </button>
            </div>
          }

          <!-- 保管中 → 貸出 -->
          @else if (eq.status === 'available') {
            <div class="mt-4">
              <label class="heron-label">貸出先</label>
              <select class="heron-input" [(ngModel)]="selectedUserId">
                <option [ngValue]="null">選択してください</option>
                @for (u of users(); track u.user_id) {
                  <option [ngValue]="u.user_id">{{ u.name }}</option>
                }
              </select>
              <button
                class="heron-btn-primary mt-3 w-full"
                [disabled]="submitting() || selectedUserId === null"
                (click)="doLend(eq)"
              >
                <app-icon name="lend" />
                貸し出す
              </button>
            </div>
          }

          <!-- メンテナンス／廃棄 -->
          @else {
            <p class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              この機材は「{{ eq.status === 'maintenance' ? '修理・メンテナンス中' : '廃棄・除却' }}」のため、
              貸出・返却の操作はできません。
            </p>
          }

          <div class="mt-3 flex gap-2">
            <a
              [routerLink]="['/equipments', eq.equipment_id]"
              class="heron-btn-secondary flex-1"
            >
              詳細を開く
            </a>
            <button class="heron-btn-ghost flex-1" (click)="close()">閉じる</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ScanComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly scanner = inject(ScannerService);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly cameraAvailable = ScannerService.isCameraAvailable();
  readonly scanning = signal(false);
  readonly submitting = signal(false);
  readonly target = signal<Equipment | null>(null);
  readonly users = signal<User[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly message = signal('');
  readonly messageIsError = signal(false);

  manualId = '';
  selectedUserId: string | null = null;
  selectedLocationId: number | null = null;

  /** 同じQRを連続で拾い続けないためのガード。 */
  private lastScannedId = '';

  constructor() {
    this.api.listUsers().subscribe({ next: (r) => this.users.set(r.items ?? []) });
    this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
  }

  ngAfterViewInit(): void {
    if (this.cameraAvailable) void this.startScan();
  }

  ngOnDestroy(): void {
    void this.scanner.stop();
  }

  async startScan(): Promise<void> {
    this.scanning.set(true);
    await this.scanner.start(
      this.videoRef().nativeElement,
      (text) => this.onScanned(text),
      (msg) => {
        this.scanning.set(false);
        this.setMessage(msg, true);
      },
    );
  }

  async stopScan(): Promise<void> {
    await this.scanner.stop();
    this.scanning.set(false);
  }

  lookupManual(): void {
    const id = normalizeEquipmentId(this.manualId);
    if (!id) {
      this.setMessage('機材IDの形式が正しくありません（例: HRN-TAB-0108）', true);
      return;
    }
    this.fetchEquipment(id);
  }

  close(): void {
    this.target.set(null);
    this.selectedUserId = null;
    this.selectedLocationId = null;
    this.lastScannedId = '';
  }

  doLend(eq: Equipment): void {
    if (!this.selectedUserId) return;
    this.submitting.set(true);
    this.api.lend(eq.equipment_id, this.selectedUserId).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.setMessage(
          `${updated.equipment_id} を ${updated.current_user?.name ?? ''} さんへ貸し出しました`,
          false,
        );
        this.close();
      },
      error: (err) => {
        this.submitting.set(false);
        this.setMessage(err?.error?.error ?? '貸出処理に失敗しました', true);
      },
    });
  }

  doReturn(eq: Equipment): void {
    if (this.selectedLocationId === null) return;
    this.submitting.set(true);
    this.api.return(eq.equipment_id, this.selectedLocationId).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.setMessage(`${updated.equipment_id} を返却しました`, false);
        this.close();
      },
      error: (err) => {
        this.submitting.set(false);
        this.setMessage(err?.error?.error ?? '返却処理に失敗しました', true);
      },
    });
  }

  private onScanned(text: string): void {
    const id = normalizeEquipmentId(text);
    if (!id) {
      this.setMessage(`HERON のラベルではありません: ${text.slice(0, 40)}`, true);
      return;
    }
    // ポップアップ表示中や同一コードの再検出では再照会しない。
    if (this.target() !== null || id === this.lastScannedId) return;
    this.lastScannedId = id;
    this.fetchEquipment(id);
  }

  private fetchEquipment(id: string): void {
    this.api.getEquipment(id).subscribe({
      next: (detail) => {
        this.target.set(detail.equipment);
        this.message.set('');
        // 返却先の初期値として、現在の所在を選んでおく。
        this.selectedLocationId = detail.equipment.current_location_id;
      },
      error: (err) => {
        this.lastScannedId = '';
        this.setMessage(err?.error?.error ?? `機材が見つかりません: ${id}`, true);
      },
    });
  }

  private setMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.messageIsError.set(isError);
  }
}
