import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import QRCode from 'qrcode';

import { ApiService } from '../../core/api.service';
import { CATEGORY_LABEL, Equipment } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

export type QrSizePreset = 'small' | 'medium' | 'large';
export type TextScalePreset = 'compact' | 'auto' | 'large';

/**
 * ラベル印刷ビュー（設計書 第3部 4章「ラベル印字」）。
 * ルート: /print/label/:id
 *
 * 設計書の指定通り「幅 30mm × 高さ 15mm」のラベルサイズで描画。
 * - 余白とQRコードのクワイエットゾーンを最適化
 * - 機材ID・機材名・型番・シリアル番号の文字数に応じてフォントサイズと複数行折り返しを自動計算し、
 *   長い名称やシリアル番号でも文字が見切れないレイアウトを実現。
 * - 画面のプレビューとコピー／ダウンロードされるPNG画像を完全に一致（高解像度Canvas直接描画）。
 */
@Component({
  selector: 'app-label-print',
  standalone: true,
  imports: [IconComponent, RouterLink, FormsModule],
  template: `
    <div class="no-print min-h-screen bg-heron-silver p-5">
      <div class="mx-auto max-w-lg">
        <!-- ナビゲーションヘッダー -->
        <div class="mb-3 flex items-center justify-between">
          <a
            [routerLink]="['/equipments', equipmentId()]"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-heron-1 hover:text-heron-navy"
          >
            <app-icon name="box" />
            機材台帳画面に戻る
          </a>
          <a
            routerLink="/equipments"
            class="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
          >
            <app-icon name="plus" />
            続けて機材を登録・検索
          </a>
        </div>

        <div class="flex items-center justify-between">
          <h1 class="text-lg font-bold text-heron-navy">機材ラベル印刷</h1>
          <span class="rounded bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">
            M2_H-I323060021 対応 (30mm × 15mm)
          </span>
        </div>

        @if (loading()) {
          <p class="mt-4 text-xs text-heron-3">読み込み中...</p>
        } @else if (error()) {
          <p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {{ error() }}
          </p>
        } @else if (equipment(); as eq) {
          <!-- 対象機材情報カード -->
          <div class="heron-card mt-4 p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="heron-mono text-sm font-bold text-heron-navy">
                {{ eq.equipment_id }}
              </div>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                {{ eq.category }} / {{ categoryLabel(eq.category) }}
              </span>
            </div>
            <div class="mt-1 text-xs font-bold text-slate-900 break-all">{{ eq.name }}</div>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-heron-2 font-mono">
              <span>型番: {{ eq.model_number || '—' }}</span>
              @if (eq.serial_number) {
                <span class="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-heron-navy border border-blue-200">
                  S/N: {{ eq.serial_number }}
                </span>
              }
            </div>
          </div>

          <!-- レイアウト微調整コントロール (QRサイズ・文字サイズ) -->
          <div class="mt-4 rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-[#2A3A4A]">ラベルレイアウト調整（文字見切れ防止・自動折返し済）</span>
              <span class="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                自動フィット有効
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">QRコードサイズ:</label>
                <div class="grid grid-cols-3 gap-1 rounded border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    (click)="setQrSize('small')"
                    class="py-1 rounded text-[11px] font-bold transition"
                    [class]="qrSize() === 'small' ? 'bg-[#2A3A4A] text-white shadow-2xs' : 'text-slate-600 hover:bg-white'"
                  >
                    小 (文字優先)
                  </button>
                  <button
                    type="button"
                    (click)="setQrSize('medium')"
                    class="py-1 rounded text-[11px] font-bold transition"
                    [class]="qrSize() === 'medium' ? 'bg-[#2A3A4A] text-white shadow-2xs' : 'text-slate-600 hover:bg-white'"
                  >
                    標準 (推奨)
                  </button>
                  <button
                    type="button"
                    (click)="setQrSize('large')"
                    class="py-1 rounded text-[11px] font-bold transition"
                    [class]="qrSize() === 'large' ? 'bg-[#2A3A4A] text-white shadow-2xs' : 'text-slate-600 hover:bg-white'"
                  >
                    大
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">文字サイズ基準:</label>
                <div class="grid grid-cols-3 gap-1 rounded border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    (click)="setTextScale('compact')"
                    class="py-1 rounded text-[11px] font-bold transition"
                    [class]="textScale() === 'compact' ? 'bg-[#2A3A4A] text-white shadow-2xs' : 'text-slate-600 hover:bg-white'"
                  >
                    小さめ
                  </button>
                  <button
                    type="button"
                    (click)="setTextScale('auto')"
                    class="py-1 rounded text-[11px] font-bold transition"
                    [class]="textScale() === 'auto' ? 'bg-[#2A3A4A] text-white shadow-2xs' : 'text-slate-600 hover:bg-white'"
                  >
                    自動最適
                  </button>
                  <button
                    type="button"
                    (click)="setTextScale('large')"
                    class="py-1 rounded text-[11px] font-bold transition"
                    [class]="textScale() === 'large' ? 'bg-[#2A3A4A] text-white shadow-2xs' : 'text-slate-600 hover:bg-white'"
                  >
                    大きめ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ラベル印字プレビュー（実寸 30mm×15mm ＆ 拡大確認プレビュー） -->
          <div class="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
            <div class="flex flex-wrap items-start gap-6">
              <!-- 1. 実寸プレビュー (30mm × 15mm) -->
              <div>
                <p class="text-[11px] font-bold text-heron-navy mb-1.5">
                  実寸プレビュー（30mm × 15mm）
                </p>
                <div class="inline-block border border-dashed border-slate-400 bg-slate-50 p-1.5 rounded">
                  @if (previewDataUrl()) {
                    <img
                      [src]="previewDataUrl()"
                      alt="ラベル実寸プレビュー"
                      class="block bg-white shadow-2xs"
                      style="width: 30mm; height: 15mm; object-fit: contain;"
                    />
                  }
                </div>
              </div>

              <!-- 2. 拡大確認用プレビュー (文字内容確認用・2倍表示) -->
              <div class="flex-1 min-w-[230px]">
                <p class="text-[11px] font-bold text-slate-600 mb-1.5">
                  拡大プレビュー（印字内容確認用・200%拡大）
                </p>
                <div class="inline-block border border-slate-300 bg-slate-50 p-2 rounded shadow-inner">
                  @if (previewDataUrl()) {
                    <img
                      [src]="previewDataUrl()"
                      alt="ラベル拡大プレビュー"
                      class="block bg-white border border-slate-200"
                      style="width: 60mm; height: 30mm; object-fit: contain;"
                    />
                  }
                </div>
              </div>
            </div>

            <p class="text-[10px] text-slate-500 leading-relaxed">
              ※ プレビュー画像は実際にコピー・印刷される画像データそのものです。長い機材名や型番・シリアル番号も余白内に自動折り返し・縮小されて見切れずに印字されます。
            </p>
          </div>

          @if (directStatusMessage()) {
            <div class="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
              <p class="font-bold flex items-center gap-1"><app-icon name="check" /> ステータス:</p>
              <p class="mt-1 leading-relaxed">{{ directStatusMessage() }}</p>
            </div>
          }

          <div class="mt-5 flex flex-col gap-2.5">
            <button
              class="heron-btn-primary w-full py-3.5 text-sm font-bold shadow-md bg-blue-700 hover:bg-blue-800"
              (click)="copyLabelImage()"
            >
              <app-icon name="printer" />
              ラベル画像をコピー (NIIMBOT アプリに貼り付け)
            </button>

            <button class="heron-btn-secondary w-full text-xs" (click)="downloadLabelImage()">
              ラベル画像をダウンロード (PNG)
            </button>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <a
                routerLink="/equipments"
                class="heron-btn-secondary text-xs text-center border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center gap-1"
              >
                <app-icon name="plus" />
                続けて新規登録
              </a>
              <a
                [routerLink]="['/equipments', equipmentId()]"
                class="heron-btn-secondary text-xs text-center border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center gap-1"
              >
                <app-icon name="box" />
                機材台帳へ戻る
              </a>
            </div>
          </div>

          <div class="mt-4 rounded-lg bg-white/95 p-4 text-[11px] leading-relaxed text-heron-1 shadow-sm border border-slate-200">
            <strong class="text-heron-navy font-bold text-xs flex items-center gap-1.5 mb-1">
              <app-icon name="printer" /> NIIMBOT 公式アプリでの印刷手順
            </strong>
            1. 上の「<strong>ラベル画像をコピー</strong>」ボタンを押します。<br />
            2. NIIMBOT 公式アプリ (NIIMBOT Desktop) を開き、<code>Cmd + V</code> (貼り付け) を行います。<br />
            3. アプリ上の「印刷」ボタンを押すと、M2_H-I323060021 から 30mm×15mm のラベルが出力されます。
          </div>
        }
      </div>
    </div>
  `,
})
export class LabelPrintComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly equipmentId = signal('');
  readonly equipment = signal<Equipment | null>(null);
  readonly previewDataUrl = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly directStatusMessage = signal('');

  readonly qrSize = signal<QrSizePreset>('medium');
  readonly textScale = signal<TextScalePreset>('auto');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.equipmentId.set(id);

    if (!id) {
      this.error.set('機材IDが指定されていません');
      this.loading.set(false);
      return;
    }

    this.api.getEquipment(id).subscribe({
      next: (detail) => {
        this.equipment.set(detail.equipment);
        this.loading.set(false);
        void this.refreshPreview();
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? '機材情報の取得に失敗しました');
        this.loading.set(false);
      },
    });
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
  }

  setQrSize(size: QrSizePreset): void {
    this.qrSize.set(size);
    void this.refreshPreview();
  }

  setTextScale(scale: TextScalePreset): void {
    this.textScale.set(scale);
    void this.refreshPreview();
  }

  private async refreshPreview(): Promise<void> {
    try {
      const canvas = await this.createLabelCanvas();
      this.previewDataUrl.set(canvas.toDataURL('image/png'));
    } catch {
      // ignore preview error
    }
  }

  /**
   * 30mm × 15mm (アスペクト比 2:1) の高精細ラベル Canvas (720px × 360px) を描画する。
   * - 余白を最小限に抑え、QRコードのクワイエットゾーンをラベル背景と共有することで文字領域を最大化。
   * - 機材ID・機材名・型番・シリアル番号のすべてを measureText で計測し、
   *   自動縮小および複数行折り返しによって1文字も見切れないように描画する。
   */
  private async createLabelCanvas(): Promise<HTMLCanvasElement> {
    const W = 720;
    const H = 360;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas Context Error');

    // 背景白塗り
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    const eq = this.equipment();
    const idStr = (eq ? eq.equipment_id : this.equipmentId()) || '';
    const nameStr = (eq ? eq.name : '') || '';
    const catStr = (eq ? eq.category : '') || '';
    const modelStr = (eq?.model_number || '').trim();
    const serialStr = (eq?.serial_number || '').trim();

    // QRコードのサイズ決定 (余白を詰めてテキスト領域を広く確保)
    const qrPreset = this.qrSize();
    const qrPx = qrPreset === 'small' ? 190 : qrPreset === 'large' ? 250 : 216;
    const padX = 14;
    const padY = 14;

    // QRコード生成 (margin: 0 にして外周の白背景をクワイエットゾーンとして活用)
    const qrImg = new Image();
    qrImg.src = await buildQr(idStr);
    await new Promise((res) => {
      qrImg.onload = res;
      qrImg.onerror = res;
    });

    // 左側: QRコードを上部寄りに配置し、その下にカテゴリバッジを配置
    const hasCatBadge = Boolean(catStr);
    const badgeH = hasCatBadge ? 42 : 0;
    const totalLeftH = qrPx + (hasCatBadge ? badgeH + 10 : 0);
    const qrY = Math.max(padY, Math.floor((H - totalLeftH) / 2));
    ctx.drawImage(qrImg, padX, qrY, qrPx, qrPx);

    if (hasCatBadge) {
      const badgeY = qrY + qrPx + 10;
      ctx.fillStyle = '#2A3A4A';
      roundRect(ctx, padX, badgeY, qrPx, badgeH, 6);
      ctx.fill();

      const catFull = `${catStr} ${this.categoryLabel(catStr)}`.trim();
      ctx.fillStyle = '#FFFFFF';
      drawSingleLineFitted(
        ctx,
        catFull,
        padX + qrPx / 2,
        badgeY + badgeH / 2,
        qrPx - 16,
        22,
        12,
        'bold',
        'sans-serif',
        'center',
      );
    }

    // 右側: テキスト描画領域 (余白を最小化し、横幅を最大限確保)
    const textX = padX + qrPx + 16;
    const textMaxW = W - textX - padX;

    const scaleMul =
      this.textScale() === 'compact' ? 0.88 : this.textScale() === 'large' ? 1.12 : 1.0;

    // 1. 最上段: 機材ID (1行・自動縮小フィット)
    const idTopY = padY;
    const idBoxH = 56;
    ctx.fillStyle = '#000000';
    drawSingleLineFitted(
      ctx,
      idStr,
      textX,
      idTopY + idBoxH / 2,
      textMaxW,
      Math.round(52 * scaleMul),
      18,
      'bold',
      'Consolas, "SFMono-Regular", monospace',
      'left',
    );

    // 区切り細線
    const dividerY = idTopY + idBoxH + 4;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textX, dividerY);
    ctx.lineTo(W - padX, dividerY);
    ctx.stroke();

    // 下段のサブ情報行（型番・シリアル番号）を組み立て
    const subLines: string[] = [];
    if (modelStr && serialStr) {
      subLines.push(`型番: ${modelStr}`);
      subLines.push(`S/N : ${serialStr}`);
    } else if (serialStr) {
      subLines.push(`S/N: ${serialStr}`);
    } else if (modelStr) {
      subLines.push(`型番: ${modelStr}`);
    } else if (catStr) {
      subLines.push(`区分: ${catStr} (${this.categoryLabel(catStr)})`);
    }

    // 下段領域の高さ計算
    const bottomAreaH = subLines.length >= 2 ? 92 : subLines.length === 1 ? 52 : 0;
    const bottomTopY = H - padY - bottomAreaH;

    // 2. 中段: 機材名 (複数行折り返し＋自動フォント縮小で見切れ完全防止)
    const nameTopY = dividerY + 8;
    const nameAreaH = Math.max(70, bottomTopY - nameTopY - 8);
    ctx.fillStyle = '#0F172A';
    drawMultilineFitted(ctx, nameStr, textX, nameTopY, textMaxW, nameAreaH, {
      maxFont: Math.round(40 * scaleMul),
      minFont: 15,
      maxLines: 3,
      fontWeight: 'bold',
      fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
      lineHeightRatio: 1.18,
    });

    // 3. 下段: 型番・シリアル番号ボックス (各行自動縮小 or 折り返しで見切れ防止)
    if (subLines.length > 0) {
      ctx.fillStyle = '#F1F5F9';
      roundRect(ctx, textX, bottomTopY, textMaxW, bottomAreaH, 6);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const innerPadX = 10;
      const innerW = textMaxW - innerPadX * 2;
      ctx.fillStyle = '#1E293B';

      if (subLines.length === 1) {
        drawMultilineFitted(
          ctx,
          subLines[0],
          textX + innerPadX,
          bottomTopY + 6,
          innerW,
          bottomAreaH - 12,
          {
            maxFont: Math.round(28 * scaleMul),
            minFont: 13,
            maxLines: 2,
            fontWeight: 'bold',
            fontFamily: 'Consolas, "SFMono-Regular", monospace',
            lineHeightRatio: 1.15,
          },
        );
      } else {
        const eachH = (bottomAreaH - 10) / 2;
        drawSingleLineFitted(
          ctx,
          subLines[0],
          textX + innerPadX,
          bottomTopY + 5 + eachH / 2,
          innerW,
          Math.round(26 * scaleMul),
          12,
          'bold',
          'Consolas, "SFMono-Regular", monospace',
          'left',
        );
        ctx.fillStyle = '#0F172A';
        drawSingleLineFitted(
          ctx,
          subLines[1],
          textX + innerPadX,
          bottomTopY + 5 + eachH + eachH / 2,
          innerW,
          Math.round(26 * scaleMul),
          12,
          'bold',
          'Consolas, "SFMono-Regular", monospace',
          'left',
        );
      }
    }

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
            'ラベル画像をクリップボードにコピーしました！ NIIMBOT 公式アプリを開いて Cmd + V (貼り付け) してください。',
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
      link.download = `${this.equipmentId()}_label.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.directStatusMessage.set(`「${this.equipmentId()}_label.png」を保存しました！`);
    } catch (err: any) {
      this.directStatusMessage.set(`保存エラー: ${err?.message || ''}`);
    }
  }
}

function buildQr(id: string): Promise<string> {
  return QRCode.toDataURL(id, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 10,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

/** 1行テキストを指定幅内に収まるようフォントサイズを自動縮小して描画する */
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
  align: CanvasTextAlign = 'left',
): void {
  if (!text) return;
  let fontSize = maxFont;
  while (fontSize > minFont) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 1;
  }
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  // 万一 minFont でも超える場合は Canvas の maxWidth 引数で横圧縮して見切れを確実に防ぐ
  ctx.fillText(text, x, centerY, maxWidth);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** 複数行折り返し＋フォント自動縮小で、どんな長文も見切れずにボックス内に収める */
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
