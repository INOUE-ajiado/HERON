import { Component, computed, input } from '@angular/core';

import { EquipmentStatus, STATUS_LABEL } from '../core/models';

/** ステータスをLED発光ドット付きピル型モダンバッジで表示する。 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-xs border transition-all"
      [class]="badgeClass()"
    >
      <span class="h-1.5 w-1.5 rounded-full animate-pulse" [class]="dotClass()"></span>
      <span>{{ label() }}</span>
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<EquipmentStatus>();

  readonly label = computed(() => STATUS_LABEL[this.status()] ?? this.status());

  readonly badgeClass = computed(() => {
    switch (this.status()) {
      case 'available':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      case 'in_use':
        return 'bg-blue-50 text-blue-900 border-blue-200/80';
      case 'maintenance':
        return 'bg-amber-50 text-amber-900 border-amber-200/80';
      case 'discarded':
        return 'bg-rose-50 text-rose-800 border-rose-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  });

  readonly dotClass = computed(() => {
    switch (this.status()) {
      case 'available':
        return 'bg-emerald-500';
      case 'in_use':
        return 'bg-blue-600';
      case 'maintenance':
        return 'bg-amber-500';
      case 'discarded':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  });
}
