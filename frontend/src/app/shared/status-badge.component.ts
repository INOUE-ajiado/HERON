import { Component, computed, input } from '@angular/core';

import { EquipmentStatus, STATUS_CLASS, STATUS_LABEL } from '../core/models';

/** ステータスを色付きチップで表示する（設計書 3.2）。 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="heron-chip" [class]="cls()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<EquipmentStatus>();

  readonly label = computed(() => STATUS_LABEL[this.status()] ?? this.status());
  readonly cls = computed(() => `heron-chip ${STATUS_CLASS[this.status()] ?? ''}`);
}
