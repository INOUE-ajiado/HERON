import { Component, computed, effect, inject, signal } from '@angular/core';
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
      <div class="mx-auto max-w-lg">
        <!-- ナビゲーションヘッダー -->
        <div class="mb-3 flex items-center justify-between">
          <a
            routerLink="/settings"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-heron-1 hover:text-heron-navy"
          >
            <app-icon name="shelf" />
            保管場所・マスタ設定に戻る
          </a>
          <a routerLink="/inventory" class="text-xs text-heron-2 hover:underline">
            棚卸し画面へ
          </a>
        </div>

        <div class="flex items-center justify-between">
          <h1 class="text-lg font-bold text-heron-navy">棚コード ラベル印刷</h1>
          <span class="rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
            棚用QRシール (30mm × 15mm)
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

          <!-- 実寸プレビュー（30mm × 15mm）＆ 拡大確認プレビュー -->
          <div class="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
            <div class="flex flex-wrap items-start gap-6">
              <div>
                <p class="text-[11px] font-bold text-heron-navy mb-1.5">
                  実寸プレビュー（30mm × 15mm）
                </p>
                <div class="inline-block border border-dashed border-slate-400 bg-slate-50 p-1.5 rounded">
                  @if (previewDataUrl()) {
                    <img
                      [src]="previewDataUrl()"
                      alt="棚ラベル実寸プレビュー"
                      class="block bg-white shadow-2xs"
                      style="width: 30mm; height: 15mm; object-fit: contain;"
                    />
                  }
                </div>
              </div>

              <div class="flex-1 min-w-[230px]">
                <p class="text-[11px] font-bold text-slate-600 mb-1.5">
                  拡大プレビュー（印字内容確認用・200%拡大）
                </p>
                <div class="inline-block border border-slate-300 bg-slate-50 p-2 rounded shadow-inner">
                  @if (previewDataUrl()) {
                    <img
                      [src]="previewDataUrl()"
                      alt="棚ラベル拡大プレビュー"
                      class="block bg-white border border-slate-200"
                      style="width: 60mm; height: 30mm; object-fit: contain;"
                    />
                  }
                </div>
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
            <button
              class="heron-btn-primary w-full py-3.5 text-sm font-bold shadow-md bg-emerald-700 hover:bg-emerald-800"
              (click)="copyLabelImage()"
            >
              <app-icon name="printer" />
              棚ラベル画像をコピー (NIIMBOT アプリに貼り付け)
            </button>

            <button class="heron-btn-secondary w-full text-xs" (click)="downloadLabelImage()">
              棚ラベル画像をダウンロード (PNG)
            </button>

            <a
              routerLink="/settings"
              class="heron-btn-secondary w-full text-xs text-center border-slate-300 bg-white hover:bg-slate-50"
            >
              保管場所・マスタ設定に戻る
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
})
export class ShelfLabelPrintComponent {
  private readonly master = inject(MasterService);
  private readonly route = inject(ActivatedRoute);

  readonly shelfCode = signal('');
  readonly previewDataUrl = signal('');
  readonly directStatusMessage = signal('');

  readonly shelf = computed<ShelfMaster | undefined>(() => {
    const code = this.shelfCode();
    return this.master.shelves().find((s) => s.code === code);
  });

  constructor() {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    this.shelfCode.set(code);
    effect(() => {
      const s = this.shelf();
      if (s || code) {
        void this.refreshPreview();
      }
    });
  }

  private async refreshPreview(): Promise<void> {
    try {
      const canvas = await this.createLabelCanvas();
      this.previewDataUrl.set(canvas.toDataURL('image/png'));
    } catch {
      // ignore
    }
  }

  private async createLabelCanvas(): Promise<HTMLCanvasElement> {
    const W = 720;
    const H = 360;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas Context Error');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    const s = this.shelf();
    const code = s ? s.code : this.shelfCode();
    const room = s ? s.room_name : '';
    const shelfName = s ? s.shelf_name : '';

    const padX = 14;
    const padY = 14;
    const qrPx = 224;

    const qrImg = new Image();
    qrImg.src = await buildQr(code);
    await new Promise((res) => {
      qrImg.onload = res;
      qrImg.onerror = res;
    });
    const qrY = Math.floor((H - qrPx) / 2);
    ctx.drawImage(qrImg, padX, qrY, qrPx, qrPx);

    const textX = padX + qrPx + 18;
    const textMaxW = W - textX - padX;

    // 1. 棚コードタグ
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 26px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('保管棚コード', textX, padY + 4, textMaxW);

    // 2. 棚コード本体 (自動縮小フィット)
    ctx.fillStyle = '#000000';
    drawSingleLineFitted(
      ctx,
      code,
      textX,
      padY + 72,
      textMaxW,
      58,
      20,
      'bold',
      'Consolas, "SFMono-Regular", monospace',
    );

    // 区切り線
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textX, 128);
    ctx.lineTo(W - padX, 128);
    ctx.stroke();

    // 3. 部屋名・棚名 (複数行折り返し＋自動縮小フィット)
    ctx.fillStyle = '#1E293B';
    const fullPlace = [room, shelfName].filter(Boolean).join(' / ');
    drawMultilineFitted(ctx, fullPlace, textX, 140, textMaxW, H - 140 - padY, {
      maxFont: 38,
      minFont: 16,
      maxLines: 3,
      fontWeight: 'bold',
      fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
      lineHeightRatio: 1.2,
    });

    return canvas;
  }

  async copyLabelImage(): Promise<void> {
    try {
      const canvas = await this.createLabelCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          this.directStatusMessage.set(
            '棚ラベル画像をクリップボードにコピーしました！ NIIMBOT アプリで Cmd + V 貼り付けしてください。',
          );
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
    margin: 0,
    scale: 10,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

function drawSingleLineFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  centerY: number,
  maxWidth: number,
  maxFont: number,
  minFont: number,
  fontWeight: string,
  fontFamily: string,
): void {
  if (!text) return;
  let fontSize = maxFont;
  while (fontSize > minFont) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 1;
  }
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, centerY, maxWidth);
  ctx.textBaseline = 'alphabetic';
}

function drawMultilineFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  topY: number,
  maxWidth: number,
  maxHeight: number,
  opts: {
    maxFont: number;
    minFont: number;
    maxLines: number;
    fontWeight: string;
    fontFamily: string;
    lineHeightRatio: number;
  },
): void {
  if (!text) return;
  let chosenFont = opts.minFont;
  let chosenLines: string[] = [text];

  for (let font = opts.maxFont; font >= opts.minFont; font -= 1) {
    ctx.font = `${opts.fontWeight} ${font}px ${opts.fontFamily}`;
    const lines = wrapTextByChar(ctx, text, maxWidth);
    const totalH = lines.length * font * opts.lineHeightRatio;
    if (lines.length <= opts.maxLines && totalH <= maxHeight) {
      chosenFont = font;
      chosenLines = lines;
      break;
    }
    if (font === opts.minFont) {
      chosenFont = font;
      chosenLines = wrapTextByChar(ctx, text, maxWidth);
    }
  }

  ctx.font = `${opts.fontWeight} ${chosenFont}px ${opts.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lineH = chosenFont * opts.lineHeightRatio;
  const totalTextH = chosenLines.length * lineH;
  const startY = topY + Math.max(0, (maxHeight - totalTextH) / 2);

  for (let i = 0; i < chosenLines.length; i++) {
    ctx.fillText(chosenLines[i], x, startY + i * lineH, maxWidth);
  }
  ctx.textBaseline = 'alphabetic';
}

function wrapTextByChar(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of Array.from(text)) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
