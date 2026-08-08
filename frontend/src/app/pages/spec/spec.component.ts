import { Component } from '@angular/core';

import { IconComponent } from '../../shared/icon.component';

/**
 * HERON 基本設計書 (HERON_System_Design-v2.pdf) 閲覧コンポーネント。
 */
@Component({
  selector: 'app-spec',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          HERON 基本設計書 (v2.0)
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">システムアーキテクチャ、データモデル、QRコード運用規定を定めた基本設計書 (PDF)</p>
      </div>

      <div class="flex items-center gap-2">
        <a
          href="HERON_System_Design-v2.pdf"
          target="_blank"
          download="HERON_System_Design-v2.pdf"
          class="heron-btn-primary text-xs font-bold shadow-xs flex items-center gap-1.5"
        >
          <app-icon name="printer" />
          PDFをダウンロード
        </a>
      </div>
    </div>

    <!-- PDF インラインビューア (全画面レスポンシブ) -->
    <div class="mt-4 rounded-lg border border-slate-200 bg-slate-900 shadow-sm overflow-hidden">
      <iframe
        src="HERON_System_Design-v2.pdf#toolbar=1"
        class="w-full h-[calc(100vh-180px)] min-h-[500px] border-none"
        title="HERON 基本設計書 (v2.0)"
      ></iframe>
    </div>
  `,
})
export class SpecComponent {}
