import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import QRCode from 'qrcode';

import { MasterService, ShelfMaster } from '../../core/master.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * 棚コードバーコードラベル印刷ビュー。
 * ルート: /print/shelf-label/:code
 */
@Component({
  selector: 'app-shelf-label-print',
  standalone: true,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="no-print min-h-screen bg-heron-silver p-5">
      <div class="mx-auto max-w-md">
        <!-- ナビゲーションヘッダー -->
        <div class="mb-3 flex items-center justify-between">
          <a routerLink="/settings" class="inline-flex items-center gap-1.5 text-xs font-semibold text-heron-1 hover:text-heron-navy">
            <app-icon name="shelf" />
            マスタ設定に戻る
          </a>
          <a routerLink="/inventory" class="text-xs text-heron-2 hover:underline">
            棚卸し画面へ
          </a>
        </div>

        <div class="flex items-center justify-between">
          <h1 class="text-lg font-bold text-heron-navy">棚コード ラベル印刷</h1>
          <span class="rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
            棚用バーコードシール
          </span>
        </div>

        @if (!shelf()) {
          <p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            指定された棚コード「{{ shelfCode() }}」が見つかりません。
          </p>
        } @else {
          <div class="heron-card mt-4 p-4">
            <div class="heron-mono text-sm font-bold text-heron-navy">
              {{ shelf()?.code }}
            </div>
            <div class="mt-0.5 text-xs text-heron-2">
              {{ shelf()?.room_name }} / {{ shelf()?.shelf_name }}
            </div>
          </div>

          <!-- 実寸プレビュー（30mm × 15mm） -->
          <p class="mt-5 text-[11px] font-semibold text-heron-2">
            棚ラベル 印刷プレビュー（実寸 30mm × 15mm）
          </p>
          <div class="mt-2 inline-block border border-dashed border-heron-3 bg-white p-2">
            <div class="label-sheet">
              <img class="label-qr" [src]="qrDataUrl()" alt="バーコード/QR" />
              <div class="label-text">
                <div class="label-tag">棚コード</div>
                <div class="label-code">{{ shelf()?.code }}</div>
                <div class="label-name">{{ shelf()?.room_name }} {{ shelf()?.shelf_name }}</div>
              </div>
            </div>
          </div>

          @if (directStatusMessage()) {
            <div class="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200">
              <p class="font-bold flex items-center gap-1"><app-icon name="check" /> 状態:</p>
              <p class="mt-1 leading-relaxed">{{ directStatusMessage() }}</p>
            </div>
          }

          <div class="mt-6 flex flex-col gap-2.5">
            <button class="heron-btn-primary w-full py-3.5 text-sm font-bold shadow-md bg-emerald-700 hover:bg-emerald-800" (click)="copyLabelImage()">
              <app-icon name="printer" />
              棚ラベル画像をコピー (NIIMBOT アプリに貼り付け)
            </button>

            <button class="heron-btn-secondary w-full text-xs" (click)="downloadLabelImage()">
              棚ラベル画像をダウンロード (PNG)
            </button>

            <a routerLink="/settings" class="heron-btn-secondary w-full text-xs text-center border-slate-300 bg-white hover:bg-slate-50">
              マスタ設定に戻る
            </a>
          </div>

          <div class="mt-4 rounded-lg bg-white/95 p-4 text-[11px] leading-relaxed text-heron-1 shadow-sm border border-slate-200">
            <strong class="text-heron-navy font-bold text-xs flex items-center gap-1.5 mb-1">
              <app-icon name="shelf" /> 棚ラベルの活用手順
            </strong>
            1. 「<strong>棚ラベル画像をコピー</strong>」を押し、NIIMBOT アプリで <code>Cmd + V</code> 貼り付けして印刷します。<br />
            2. 印刷されたシールを対象の保管棚・ラックに貼付します。<br />
            3. スマホカメラやスキャナーで読み取ることで、棚卸し時の棚照合が瞬時に完了します！
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
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
        image-rendering: pixelated;
      }

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

      .label-tag {
        font-size: 1.6mm;
        font-weight: 700;
        color: #047857;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      .label-code {
        font-size: 2.8mm;
        font-weight: 700;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      .label-name {
        font-size: 1.8mm;
        font-weight: 500;
        color: #333;
        margin-top: 0.2mm;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class ShelfLabelPrintComponent {
  private readonly master = inject(MasterService);
  private readonly route = inject(ActivatedRoute);

  readonly shelfCode = signal('');
  readonly qrDataUrl = signal('');
  readonly directStatusMessage = signal('');

  readonly shelf = computed<ShelfMaster | undefined>(() => {
    const code = this.shelfCode();
    return this.master.shelves().find((s) => s.code === code);
  });

  constructor() {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    this.shelfCode.set(code);
    if (code) {
      buildQr(code).then((url) => this.qrDataUrl.set(url));
    }
  }

  private async createLabelCanvas(): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas Context Error');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 360, 180);

    const s = this.shelf();
    const code = s ? s.code : this.shelfCode();
    const room = s ? s.room_name : '';
    const shelfName = s ? s.shelf_name : '';

    // QR描画
    const qrImg = new Image();
    qrImg.src = await buildQr(code);
    await new Promise((res) => {
      qrImg.onload = res;
      qrImg.onerror = res;
    });
    ctx.drawImage(qrImg, 12, 12, 156, 156);

    // テキスト描画
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('棚コード', 176, 42);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 36px Consolas, monospace';
    ctx.fillText(code, 176, 92);

    ctx.fillStyle = '#333333';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${room} ${shelfName}`, 176, 142);

    return canvas;
  }

  async copyLabelImage(): Promise<void> {
    try {
      const canvas = await this.createLabelCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          this.directStatusMessage.set('棚ラベル画像をクリップボードにコピーしました！ NIIMBOT アプリで Cmd + V 貼り付けしてください。');
        } catch {
          this.downloadLabelImage();
        }
      }, 'image/png');
    } catch (err: any) {
      this.directStatusMessage.set(`エラー: ${err?.message || '画像生成エラー'}`);
    }
  }

  async downloadLabelImage(): Promise<void> {
    try {
      const canvas = await this.createLabelCanvas();
      const link = document.createElement('a');
      link.download = `${this.shelfCode()}_shelf_label.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.directStatusMessage.set(`「${this.shelfCode()}_shelf_label.png」を保存しました！`);
    } catch (err: any) {
      this.directStatusMessage.set(`保存エラー: ${err?.message || ''}`);
    }
  }
}

function buildQr(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
