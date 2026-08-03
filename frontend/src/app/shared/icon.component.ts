import { Component, input } from '@angular/core';

/** 利用可能なアイコン名。 */
export type IconName =
  | 'home'
  | 'box'
  | 'camera'
  | 'shelf'
  | 'pin'
  | 'clock'
  | 'plus'
  | 'user'
  | 'printer'
  | 'trash'
  | 'lend'
  | 'return'
  | 'check'
  | 'close';

/**
 * CSS のみで描画するアイコン。
 *
 * 絵文字はフォント依存で字形・色・サイズが端末ごとに変わり、
 * ネイビー基調のUIに合わないため使用しない。すべて `currentColor` の
 * 図形として描画し、文字色とフォントサイズにそのまま追従させる。
 *
 * 図形は 1em 四方の箱の中に、ホスト要素と内部 <i> の疑似要素
 * （最大4つ）を組み合わせて構成する。
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: '<i></i>',
  host: {
    '[attr.data-icon]': 'name()',
    'aria-hidden': 'true',
  },
  styles: [
    `
      :host {
        --sw: 0.12em;
        display: inline-block;
        position: relative;
        width: 1em;
        height: 1em;
        flex: none;
        vertical-align: -0.13em;
        color: inherit;
      }

      i {
        position: absolute;
        inset: 0;
        display: block;
      }

      :host::before,
      :host::after,
      i::before,
      i::after {
        content: '';
        position: absolute;
        box-sizing: border-box;
      }

      /* ---- home: 屋根 + 躯体 ---- */
      :host([data-icon='home'])::before {
        left: 50%;
        top: 6%;
        transform: translateX(-50%);
        border-left: 0.5em solid transparent;
        border-right: 0.5em solid transparent;
        border-bottom: 0.4em solid currentColor;
      }
      :host([data-icon='home'])::after {
        left: 16%;
        top: 45%;
        width: 68%;
        height: 49%;
        border: var(--sw) solid currentColor;
        border-top: 0;
        border-radius: 0 0 0.08em 0.08em;
      }

      /* ---- box: 梱包箱 ---- */
      :host([data-icon='box'])::before {
        left: 8%;
        top: 16%;
        width: 84%;
        height: 76%;
        border: var(--sw) solid currentColor;
        border-radius: 0.1em;
      }
      :host([data-icon='box'])::after {
        left: 8%;
        top: 40%;
        width: 84%;
        height: var(--sw);
        background: currentColor;
      }
      :host([data-icon='box']) i::before {
        left: 42%;
        top: 16%;
        width: var(--sw);
        height: 24%;
        background: currentColor;
      }

      /* ---- camera: 本体 + レンズ + 上部の突起 ---- */
      :host([data-icon='camera'])::before {
        left: 4%;
        top: 26%;
        width: 92%;
        height: 62%;
        border: var(--sw) solid currentColor;
        border-radius: 0.14em;
      }
      :host([data-icon='camera'])::after {
        left: 33%;
        top: 42%;
        width: 34%;
        height: 34%;
        border: var(--sw) solid currentColor;
        border-radius: 50%;
      }
      :host([data-icon='camera']) i::before {
        left: 30%;
        top: 14%;
        width: 32%;
        height: var(--sw);
        background: currentColor;
        border-radius: 0.06em 0.06em 0 0;
      }

      /* ---- shelf: 棚（2段） ---- */
      :host([data-icon='shelf'])::before {
        left: 8%;
        top: 10%;
        width: 84%;
        height: 80%;
        border: var(--sw) solid currentColor;
        border-radius: 0.08em;
      }
      :host([data-icon='shelf'])::after {
        left: 8%;
        top: 40%;
        width: 84%;
        height: var(--sw);
        background: currentColor;
      }
      :host([data-icon='shelf']) i::before {
        left: 8%;
        top: 66%;
        width: 84%;
        height: var(--sw);
        background: currentColor;
      }

      /* ---- pin: 地図ピン ---- */
      :host([data-icon='pin'])::before {
        left: 18%;
        top: 8%;
        width: 64%;
        height: 64%;
        border: var(--sw) solid currentColor;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
      }
      :host([data-icon='pin'])::after {
        left: 41%;
        top: 27%;
        width: 18%;
        height: 18%;
        border-radius: 50%;
        background: currentColor;
      }

      /* ---- clock: 時計（履歴） ---- */
      :host([data-icon='clock'])::before {
        left: 6%;
        top: 6%;
        width: 88%;
        height: 88%;
        border: var(--sw) solid currentColor;
        border-radius: 50%;
      }
      :host([data-icon='clock'])::after {
        left: 47%;
        top: 24%;
        width: 0.1em;
        height: 28%;
        background: currentColor;
        border-radius: 0.05em;
      }
      :host([data-icon='clock']) i::before {
        left: 47%;
        top: 46%;
        width: 26%;
        height: 0.1em;
        background: currentColor;
        border-radius: 0.05em;
      }

      /* ---- plus ---- */
      :host([data-icon='plus'])::before {
        left: 50%;
        top: 12%;
        width: 0.14em;
        height: 76%;
        background: currentColor;
        transform: translateX(-50%);
        border-radius: 0.07em;
      }
      :host([data-icon='plus'])::after {
        top: 50%;
        left: 12%;
        width: 76%;
        height: 0.14em;
        background: currentColor;
        transform: translateY(-50%);
        border-radius: 0.07em;
      }

      /* ---- user: 頭部 + 肩 ---- */
      :host([data-icon='user'])::before {
        left: 32%;
        top: 8%;
        width: 36%;
        height: 36%;
        border: var(--sw) solid currentColor;
        border-radius: 50%;
      }
      :host([data-icon='user'])::after {
        left: 14%;
        top: 54%;
        width: 72%;
        height: 46%;
        border: var(--sw) solid currentColor;
        border-bottom: 0;
        border-radius: 50% 50% 0 0;
      }

      /* ---- printer: 給紙 + 本体 + 排紙 ---- */
      :host([data-icon='printer'])::before {
        left: 24%;
        top: 4%;
        width: 52%;
        height: 22%;
        border: var(--sw) solid currentColor;
        border-bottom: 0;
      }
      :host([data-icon='printer'])::after {
        left: 6%;
        top: 26%;
        width: 88%;
        height: 38%;
        border: var(--sw) solid currentColor;
        border-radius: 0.1em;
      }
      :host([data-icon='printer']) i::before {
        left: 24%;
        top: 64%;
        width: 52%;
        height: 32%;
        border: var(--sw) solid currentColor;
        border-top: 0;
      }

      /* ---- trash: 蓋 + 本体 ---- */
      :host([data-icon='trash'])::before {
        left: 12%;
        top: 20%;
        width: 76%;
        height: var(--sw);
        background: currentColor;
        border-radius: 0.06em;
      }
      :host([data-icon='trash'])::after {
        left: 22%;
        top: 26%;
        width: 56%;
        height: 68%;
        border: var(--sw) solid currentColor;
        border-top: 0;
        border-radius: 0 0 0.1em 0.1em;
      }
      :host([data-icon='trash']) i::before {
        left: 38%;
        top: 8%;
        width: 24%;
        height: var(--sw);
        background: currentColor;
      }

      /* ---- lend: 棚から上へ出す矢印 ---- */
      :host([data-icon='lend'])::before {
        left: 50%;
        top: 12%;
        width: var(--sw);
        height: 42%;
        background: currentColor;
        transform: translateX(-50%);
      }
      :host([data-icon='lend'])::after {
        left: 50%;
        top: 20%;
        width: 0.32em;
        height: 0.32em;
        border-left: var(--sw) solid currentColor;
        border-top: var(--sw) solid currentColor;
        transform: translate(-50%, -50%) rotate(45deg);
      }
      :host([data-icon='lend']) i::before {
        left: 10%;
        top: 62%;
        width: 80%;
        height: 32%;
        border: var(--sw) solid currentColor;
        border-top: 0;
        border-radius: 0 0 0.08em 0.08em;
      }

      /* ---- return: 棚へ下ろす矢印 ---- */
      :host([data-icon='return'])::before {
        left: 50%;
        top: 6%;
        width: var(--sw);
        height: 42%;
        background: currentColor;
        transform: translateX(-50%);
      }
      :host([data-icon='return'])::after {
        left: 50%;
        top: 40%;
        width: 0.32em;
        height: 0.32em;
        border-right: var(--sw) solid currentColor;
        border-bottom: var(--sw) solid currentColor;
        transform: translate(-50%, -50%) rotate(45deg);
      }
      :host([data-icon='return']) i::before {
        left: 10%;
        top: 62%;
        width: 80%;
        height: 32%;
        border: var(--sw) solid currentColor;
        border-top: 0;
        border-radius: 0 0 0.08em 0.08em;
      }

      /* ---- check ---- */
      :host([data-icon='check'])::before {
        left: 24%;
        top: 10%;
        width: 42%;
        height: 72%;
        border-right: 0.14em solid currentColor;
        border-bottom: 0.14em solid currentColor;
        transform: rotate(40deg);
      }

      /* ---- close ---- */
      :host([data-icon='close'])::before,
      :host([data-icon='close'])::after {
        left: 50%;
        top: 50%;
        width: 0.13em;
        height: 84%;
        background: currentColor;
        border-radius: 0.07em;
      }
      :host([data-icon='close'])::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }
      :host([data-icon='close'])::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
