import { Injectable, NgZone, inject } from '@angular/core';
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

/** 機材IDの形式（設計書 3.1）。 */
const EQUIPMENT_ID_PATTERN = /^HRN-[A-Z]{2,3}-\d{4}$/;

/**
 * スキャン文字列から機材IDを取り出す。
 *
 * QRコードに URL（例: https://heron.local/e/HRN-TAB-0108）が入っていても
 * 末尾セグメントを機材IDとして解釈する。バックエンド側でも同じ正規化を行う。
 */
export function normalizeEquipmentId(raw: string): string | null {
  let s = (raw ?? '').trim().toUpperCase();
  if (!s) return null;
  const slash = s.lastIndexOf('/');
  if (slash >= 0) s = s.slice(slash + 1);
  return EQUIPMENT_ID_PATTERN.test(s) ? s : null;
}

/**
 * カメラによる QR 連続読み取りを扱うサービス。
 *
 * 設計書 4章の非機能要件（カメラ起動の高速化・連続スキャン時の軽快さ）に対し、
 * ・QR のみをデコード対象にしてフォーマット探索を省く
 * ・背面カメラを優先選択する
 * ・読み取りコールバックを NgZone 外→内へ明示的に戻して不要な変更検知を避ける
 * という方針を取る。
 */
@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly zone = inject(NgZone);
  private controls: IScannerControls | null = null;

  /** カメラが利用可能な文脈か（HTTPS または localhost）を返す。 */
  static isCameraAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      (window.isSecureContext || location.hostname === 'localhost')
    );
  }

  /**
   * スキャンを開始する。読み取るたびに onResult が呼ばれる。
   * 同じコードの連続検出は呼び出し側で抑制すること。
   */
  async start(
    video: HTMLVideoElement,
    onResult: (text: string) => void,
    onError?: (message: string) => void,
  ): Promise<void> {
    await this.stop();

    // QR のみに絞ることで 1 フレームあたりのデコード負荷を下げる。
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 400,
    });

    try {
      const deviceId = await pickRearCamera();
      this.controls = await reader.decodeFromVideoDevice(
        deviceId,
        video,
        (result) => {
          if (!result) return;
          // zxing のコールバックは Zone 外で発火するため、明示的に戻す。
          this.zone.run(() => onResult(result.getText()));
        },
      );
    } catch (e) {
      const message =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'カメラの使用が許可されていません。ブラウザの権限設定を確認してください。'
          : `カメラを起動できませんでした: ${(e as Error).message}`;
      this.zone.run(() => onError?.(message));
    }
  }

  /** スキャンを停止し、カメラを解放する。 */
  async stop(): Promise<void> {
    this.controls?.stop();
    this.controls = null;
  }
}

/**
 * 背面カメラを優先して deviceId を選ぶ。
 *
 * 端末によっては複数の背面カメラ（広角・望遠）が並ぶため、
 * ラベルに "back" / "背面" を含む最初のものを使う。判別できない場合は
 * undefined を返し、zxing の既定選択に任せる。
 */
async function pickRearCamera(): Promise<string | undefined> {
  try {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (devices.length === 0) return undefined;
    const rear = devices.find((d) => /back|rear|環境|背面/i.test(d.label));
    return (rear ?? devices[devices.length - 1]).deviceId;
  } catch {
    return undefined;
  }
}
