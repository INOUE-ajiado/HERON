import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import QRCode from 'qrcode';

import { ApiService } from '../../core/api.service';
import { CATEGORY_LABEL, Equipment } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/**
 * ラベル印刷ビュー（設計書 第3部 4章「ラベル印字」）。
 * ルート: /print/label/:id
 *
 * 設計書の指定通り「幅 30mm × 高さ 15mm」のラベルサイズで描画。
 * プリンターへの直接コマンド送信に対応するため、
 * 「M2_H-I323060021」専用 Web Bluetooth 直接印刷プロトコルを実装。
 */
@Component({
  selector: 'app-label-print',
  standalone: true,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="no-print min-h-screen bg-heron-silver p-5">
      <div class="mx-auto max-w-md">
        <!-- ナビゲーションヘッダー -->
        <div class="mb-3 flex items-center justify-between">
          <a [routerLink]="['/equipments', equipmentId()]" class="inline-flex items-center gap-1.5 text-xs font-semibold text-heron-1 hover:text-heron-navy">
            <app-icon name="box" />
            機材詳細画面に戻る
          </a>
          <a routerLink="/equipments/new" class="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
            <app-icon name="plus" />
            続けて機材を新規登録
          </a>
        </div>

        <div class="flex items-center justify-between">
          <h1 class="text-lg font-bold text-heron-navy">機材ラベル印刷</h1>
          <span class="rounded bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">
            M2_H-I323060021 対応
          </span>
        </div>

        @if (loading()) {
          <p class="mt-4 text-xs text-heron-3">読み込み中...</p>
        } @else if (error()) {
          <p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {{ error() }}
          </p>
        } @else if (equipment(); as eq) {
          <div class="heron-card mt-4 p-4">
            <div class="heron-mono text-sm font-bold text-heron-navy">
              {{ eq.equipment_id }}
            </div>
            <div class="mt-0.5 text-xs font-medium text-heron-1">{{ eq.name }}</div>
            <div class="mt-1 text-[11px] text-heron-2">
              {{ eq.category }} / {{ categoryLabel(eq.category) }}
              @if (eq.model_number) {
                / {{ eq.model_number }}
              }
            </div>
          </div>

          <!-- 実寸プレビュー (30mm × 15mm) -->
          <p class="mt-5 text-[11px] font-semibold text-heron-2">
            ラベル印字プレビュー（実寸 30mm × 15mm）
          </p>
          <div class="mt-2 inline-block border border-dashed border-heron-3 bg-white p-2">
            <div class="label-sheet">
              <img class="label-qr" [src]="qrDataUrl()" alt="QRコード" />
              <div class="label-text">
                <div class="label-id">{{ eq.equipment_id }}</div>
                <div class="label-name">{{ eq.name }}</div>
                <div class="label-sub">
                  {{ eq.category }}
                  @if (eq.model_number) {
                    / {{ eq.model_number }}
                  }
                </div>
              </div>
            </div>
          </div>

          @if (directStatusMessage()) {
            <div class="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
              <p class="font-bold flex items-center gap-1"><app-icon name="check" /> ステータス:</p>
              <p class="mt-1 leading-relaxed">{{ directStatusMessage() }}</p>
            </div>
          }

          <div class="mt-6 flex flex-col gap-2.5">
            <button class="heron-btn-primary w-full py-3.5 text-sm font-bold shadow-md bg-blue-700 hover:bg-blue-800" (click)="copyLabelImage()">
              <app-icon name="printer" />
              ラベル画像をコピー (NIIMBOT アプリに貼り付け)
            </button>

            <button class="heron-btn-secondary w-full text-xs" (click)="downloadLabelImage()">
              ラベル画像をダウンロード (PNG)
            </button>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <a routerLink="/equipments/new" class="heron-btn-secondary text-xs text-center border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center gap-1">
                <app-icon name="plus" />
                続けて新規登録
              </a>
              <a [routerLink]="['/equipments', equipmentId()]" class="heron-btn-secondary text-xs text-center border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center gap-1">
                <app-icon name="box" />
                詳細画面へ進む
              </a>
            </div>
          </div>

          <div class="mt-4 rounded-lg bg-white/95 p-4 text-[11px] leading-relaxed text-heron-1 shadow-sm border border-slate-200">
            <strong class="text-heron-navy font-bold text-xs flex items-center gap-1.5 mb-1">
              <app-icon name="printer" /> NIIMBOT 公式アプリでの印刷手順
            </strong>
            1. 上の「<strong>ラベル画像をコピー</strong>」ボタンを押します。<br />
            2. NIIMBOT 公式アプリ (NIIMBOT Desktop) を開き、<code>Cmd + V</code> (貼り付け) を行います。<br />
            3. アプリ上の「印刷」ボタンを押すと、M2_H-I323060021 から30mm×15mmのラベルが出力されます。
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

      .label-id {
        font-size: 2.8mm;
        font-weight: 700;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      .label-name {
        font-size: 2mm;
        font-weight: 700;
        margin-top: 0.2mm;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .label-sub {
        font-size: 1.5mm;
        color: #444;
        margin-top: 0.2mm;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class LabelPrintComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly equipmentId = signal('');
  readonly equipment = signal<Equipment | null>(null);
  readonly qrDataUrl = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly directStatusMessage = signal('');

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
        buildQr(detail.equipment.equipment_id).then((url) =>
          this.qrDataUrl.set(url),
        );
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

  private async createLabelCanvas(): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas Context Error');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 360, 180);

    const eq = this.equipment();
    const idStr = eq ? eq.equipment_id : this.equipmentId();
    const nameStr = eq ? eq.name : '';
    const subStr = eq ? `${eq.category} ${eq.model_number || ''}` : '';

    const qrImg = new Image();
    qrImg.src = await buildQr(idStr);
    await new Promise((res) => {
      qrImg.onload = res;
      qrImg.onerror = res;
    });
    ctx.drawImage(qrImg, 12, 12, 156, 156);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Consolas, monospace';
    ctx.fillText(idStr, 176, 56);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(nameStr.substring(0, 10), 176, 104);

    ctx.fillStyle = '#444444';
    ctx.font = '18px sans-serif';
    ctx.fillText(subStr.substring(0, 14), 176, 146);

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
          this.directStatusMessage.set('ラベル画像をクリップボードにコピーしました！ NIIMBOT 公式アプリを開いて Cmd + V (貼り付け) してください。');
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
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
