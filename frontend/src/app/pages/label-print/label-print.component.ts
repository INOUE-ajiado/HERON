import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import QRCode from 'qrcode';

import { ApiService } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * ラベル印刷ビュー（設計書 第3部 4章 / 3.3）。
 *
 * ルート: /print/label/:id
 *
 * 実装方針:
 *  - 30mm × 15mm・余白ゼロの描画領域を @media print / @page で厳密に定義
 *    （定義は styles.css 側）
 *  - QRコードは TypeScript 側で生成した Base64(data URL) を img として配置
 *  - 「印刷」ボタンで window.print() を呼び、OS標準のダイアログから
 *    NIIMBOT M2 を選択して出力する
 *
 * 物理ラベルには機材IDのみを印字する。部署名・使用者名は変動するため
 * DB 上のメタデータとして扱う（設計書 3.1）。
 */
@Component({
  selector: 'app-label-print',
  standalone: true,
  imports: [IconComponent],
  template: `
    <!-- 画面表示のみ（印刷時は .no-print で除外） -->
    <div class="no-print min-h-screen bg-heron-silver p-5">
      <div class="mx-auto max-w-md">
        <h1 class="text-lg font-bold text-heron-navy">ラベル印刷</h1>

        @if (error()) {
          <p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {{ error() }}
          </p>
        } @else if (loading()) {
          <p class="mt-4 text-xs text-heron-2">読み込み中...</p>
        } @else {
          <div class="heron-card mt-4 p-4">
            <div class="heron-mono text-sm font-bold text-heron-navy">
              {{ equipmentId() }}
            </div>
            <div class="mt-0.5 text-xs text-heron-2">{{ name() }}</div>
          </div>

          <!-- 実寸プレビュー（30mm × 15mm） -->
          <p class="mt-5 text-[11px] font-semibold text-heron-2">
            印刷プレビュー（実寸 30mm × 15mm）
          </p>
          <div class="mt-2 inline-block border border-dashed border-heron-3 bg-white p-2">
            <div class="label-sheet">
              <img class="label-qr" [src]="qrDataUrl()" alt="QRコード" />
              <div class="label-text">
                <div class="label-prefix">{{ idPrefix() }}</div>
                <div class="label-serial">{{ idSerial() }}</div>
              </div>
            </div>
          </div>

          <button class="heron-btn-primary mt-6 w-full" (click)="print()">
            <app-icon name="printer" />
            印刷する
          </button>

          <div class="mt-4 rounded-lg bg-white/70 p-3 text-[11px] leading-relaxed text-heron-1">
            <strong>NIIMBOT M2 への出力手順</strong><br />
            1. プリンタを Bluetooth または USB で PC とペアリングしておく<br />
            2. 「印刷する」を押し、プリンタ一覧から NIIMBOT M2 を選択<br />
            3. 用紙サイズを 30mm × 15mm、余白なし、倍率100%（等倍）に設定<br />
            4. ブラウザの「ヘッダーとフッター」は必ずオフにする
          </div>
        }
      </div>
    </div>

    <!-- 印刷対象。画面上は隠し、印刷時のみ現れる。 -->
    @if (!loading() && !error()) {
      <div class="print-only">
        <div class="label-sheet">
          <img class="label-qr" [src]="qrDataUrl()" alt="" />
          <div class="label-text">
            <div class="label-prefix">{{ idPrefix() }}</div>
            <div class="label-serial">{{ idSerial() }}</div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* 30mm × 15mm のシール内レイアウト。左にQR、右に機材ID。 */
      .label-sheet {
        width: 30mm;
        height: 15mm;
        display: flex;
        align-items: center;
        gap: 0.8mm;
        padding: 0.8mm;
        box-sizing: border-box;
        background: #fff;
        overflow: hidden;
      }

      .label-qr {
        width: 13.4mm;
        height: 13.4mm;
        flex-shrink: 0;
        image-rendering: pixelated; /* 縮小時に QR のセルを潰さない */
      }

      /*
       * 機材IDは "HRN-TAB" と "0001" の2行に分けて配置する。
       * 30mm 幅に12文字を1行で収めると極端に小さくなるため、
       * 意味の切れ目で改行して連番を大きく見せる。
       */
      .label-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        color: #000;
        font-family: 'Consolas', 'SFMono-Regular', monospace;
        line-height: 1.1;
      }

      .label-prefix {
        font-size: 2.4mm;
        font-weight: 700;
        letter-spacing: -0.03em;
        white-space: nowrap;
      }

      .label-serial {
        font-size: 3.6mm;
        font-weight: 700;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .print-only {
        display: none;
      }

      @media print {
        .print-only {
          display: block;
        }
      }
    `,
  ],
})
export class LabelPrintComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly equipmentId = signal('');
  readonly name = signal('');

  /** ラベル表示用に "HRN-TAB-0001" を "HRN-TAB" と "0001" に分ける。 */
  readonly idPrefix = computed(() => {
    const parts = this.equipmentId().split('-');
    return parts.length === 3 ? `${parts[0]}-${parts[1]}` : this.equipmentId();
  });

  readonly idSerial = computed(() => {
    const parts = this.equipmentId().split('-');
    return parts.length === 3 ? parts[2] : '';
  });

  readonly qrDataUrl = signal('');
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.equipmentId.set(id);

    this.api.getEquipment(id).subscribe({
      next: async (detail) => {
        this.name.set(detail.equipment.name);
        try {
          this.qrDataUrl.set(await buildQr(detail.equipment.equipment_id));
          this.loading.set(false);
        } catch {
          this.error.set('QRコードの生成に失敗しました');
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? `機材が見つかりません: ${id}`);
        this.loading.set(false);
      },
    });
  }

  print(): void {
    window.print();
  }
}

/**
 * 機材IDを内容とする QR を Base64 の data URL として生成する。
 *
 * 小さなシールでも読み取れるよう、誤り訂正は M、余白は最小限に抑える。
 * QRの内容は機材ID文字列そのものとし、URL は入れない
 * （スキャナ側では URL 形式も受け付けるが、印字は最短にして密度を下げる）。
 */
function buildQr(equipmentId: string): Promise<string> {
  return QRCode.toDataURL(equipmentId, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
