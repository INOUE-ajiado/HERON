import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { MasterService } from '../../core/master.service';
import { Equipment, InventoryResult, Location } from '../../core/models';
import { ScannerService, normalizeEquipmentId } from '../../core/scanner.service';
import { IconComponent } from '../../shared/icon.component';

interface ShelfOption {
  key: string | number;
  code: string;
  room_name: string;
  shelf_name: string;
}

/**
 * 棚卸しモード（設計書 3.3 連続スキャン / エッジ・トゥー・エッジ フルキャンバス UI）。
 *
 * 「対象の部屋・棚」を選択後カメラを起動し、次々にQRを読み込ませる。
 * 確定時に一括送信し、対象機材の現在位置をその棚に上書きして
 * 「保管中」ステータスとして棚卸しログを記録する。
 */
@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, IconComponent, RouterLink],
  template: `
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] md:min-h-screen flex flex-col bg-slate-100/80 text-slate-800 font-sans">

      <!-- 1. トップヘッダー (Sticky Edge-to-Edge) -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-14 md:top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-[#2A3A4A] flex items-center justify-center text-white shadow-xs shrink-0">
            <svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-sm md:text-base font-extrabold tracking-tight text-slate-900 truncate">
                棚卸しモード（連続スキャン・所在照合）
              </h1>
              @if (!started()) {
                <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  STEP 1: 対象棚の選択
                </span>
              } @else if (!result()) {
                <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  STEP 2: 連続スキャン中
                </span>
              } @else {
                <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  STEP 3: 棚卸し完了
                </span>
              }
            </div>
            <p class="text-[11px] text-slate-500 truncate hidden sm:block">
              対象の保管場所（棚コード）を選択し、カメラまたは手入力・バーコードリーダーで機材を連続スキャンして所在を一括更新します
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          @if (started() && !result()) {
            <button
              type="button"
              (click)="cancel()"
              class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer"
            >
              棚を選び直す
            </button>
            <button
              type="button"
              [disabled]="submitting() || scanned().length === 0"
              (click)="submit()"
              class="px-3.5 py-1.5 text-xs font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded-md shadow-xs transition cursor-pointer disabled:opacity-40"
            >
              {{ submitting() ? '送信中...' : '棚卸しを確定 (' + scanned().length + '件)' }}
            </button>
          } @else if (result()) {
            <button
              type="button"
              (click)="reset()"
              class="px-3.5 py-1.5 text-xs font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded-md shadow-xs transition cursor-pointer"
            >
              別の棚を棚卸しする
            </button>
          }
        </div>
      </header>

      <!-- 2. KPI サマリーストリップ (Edge-to-Edge 4分割グリッド) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200 bg-white shrink-0">
        <div class="p-3.5 md:px-6 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">対象の保管場所 (棚)</div>
            <div class="text-sm md:text-base font-extrabold text-slate-900 truncate mt-0.5">
              {{ locationLabel() || '未選択' }}
            </div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-mono font-bold shrink-0">棚</span>
        </div>

        <div class="p-3.5 md:px-6 flex items-center justify-between">
          <div>
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">当該棚の台帳機材数</div>
            <div class="text-xl md:text-2xl font-black text-slate-900 font-mono mt-0.5">
              {{ locationId !== null ? expectedEquipments().length : '—' }}
            </div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">台</span>
        </div>

        <div class="p-3.5 md:px-6 flex items-center justify-between">
          <div>
            <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              スキャン済み件数
            </div>
            <div class="text-xl md:text-2xl font-black text-blue-700 font-mono mt-0.5">{{ scanned().length }}</div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center text-xs font-bold">読</span>
        </div>

        <div class="p-3.5 md:px-6 flex items-center justify-between">
          <div>
            <div class="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              未スキャン残数 (照合待ち)
            </div>
            <div class="text-xl md:text-2xl font-black text-amber-700 font-mono mt-0.5">
              {{ locationId !== null ? remainingExpected().length : '—' }}
            </div>
          </div>
          <span class="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center text-xs font-bold">残</span>
        </div>
      </div>

      <!-- 3. メインコンテンツ領域 (Edge-to-Edge Full-Bleed) -->
      <div class="flex-1 bg-white flex flex-col">

        <!-- ==================== STEP 1: 対象の棚を選択 ==================== -->
        @if (!started()) {
          <!-- サブヘッダーバー: ドロップダウン選択 + 開始ボタン -->
          <div class="border-b border-slate-200 bg-slate-50 px-4 md:px-6 py-3 shrink-0">
            <div class="flex flex-col md:flex-row md:items-center gap-2.5">
              <div class="flex items-center gap-2 flex-1">
                <label class="text-xs font-extrabold text-slate-700 shrink-0">対象の部屋・棚:</label>
                <select
                  class="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-md font-bold text-slate-800 focus:outline-none focus:border-[#2A3A4A]"
                  [(ngModel)]="locationId"
                >
                  <option [ngValue]="null">-- 棚卸しを行う保管場所（棚）を選択してください --</option>
                  @for (opt of shelfOptions(); track opt.key) {
                    <option [ngValue]="opt.key">
                      [{{ opt.code }}] {{ opt.room_name }} / {{ opt.shelf_name }} （現在 {{ countEquipmentsAt(opt.key) }} 台）
                    </option>
                  }
                </select>
              </div>

              <button
                type="button"
                class="px-5 py-2 text-xs font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded-md shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
                [disabled]="locationId === null"
                (click)="start()"
              >
                <app-icon name="camera" />
                <span>選択した棚の棚卸しを開始</span>
              </button>
            </div>

            @if (!cameraAvailable) {
              <p class="mt-2 rounded bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] text-amber-900">
                ※ カメラを利用できない環境ですが、バーコードリーダーまたは手入力での棚卸しが可能です。
              </p>
            }
          </div>

          <!-- 保管場所（棚）クイック選択テーブル (Edge-to-Edge) -->
          <div class="flex-1">
            <div class="px-4 md:px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-extrabold text-slate-700">保管場所（棚）一覧からクリックしてすぐ開始</span>
              <span class="text-[11px] text-slate-400 font-mono">全 {{ shelfOptions().length }} 箇所</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th class="py-2.5 pl-4 md:pl-6 pr-3 w-40">棚コード</th>
                    <th class="py-2.5 px-3">部屋・フロア</th>
                    <th class="py-2.5 px-3">棚・ロッカー名</th>
                    <th class="py-2.5 px-3 w-36">現在の台帳保管数</th>
                    <th class="py-2.5 pl-3 pr-4 md:pr-6 text-right w-44">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 text-xs bg-white border-b border-slate-200">
                  @for (opt of shelfOptions(); track opt.key) {
                    <tr
                      class="hover:bg-slate-50/90 transition-colors cursor-pointer"
                      [class.bg-blue-50/40]="locationId === opt.key"
                      (click)="locationId = opt.key"
                    >
                      <td class="py-3 pl-4 md:pl-6 pr-3 font-mono font-bold text-[#2A3A4A]">
                        <span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">{{ opt.code }}</span>
                      </td>
                      <td class="py-3 px-3 font-bold text-slate-800">{{ opt.room_name }}</td>
                      <td class="py-3 px-3 text-slate-700 font-semibold">{{ opt.shelf_name }}</td>
                      <td class="py-3 px-3">
                        <span class="font-mono font-extrabold text-slate-900">{{ countEquipmentsAt(opt.key) }}</span>
                        <span class="text-[11px] text-slate-500 ml-1">台</span>
                      </td>
                      <td class="py-3 pl-3 pr-4 md:pr-6 text-right">
                        <button
                          type="button"
                          (click)="selectAndStart(opt.key, $event)"
                          class="px-3 py-1 text-[11px] font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded shadow-2xs transition cursor-pointer"
                        >
                          この棚を棚卸し開始 →
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- ==================== STEP 2: 連続スキャン & リアルタイム照合 ==================== -->
        @if (started() && !result()) {
          <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">

            <!-- 左ペイン: カメラビュー & 手入力・バーコード入力 (lg:col-span-5) -->
            <div class="lg:col-span-5 bg-slate-50/60 flex flex-col">
              <!-- カメラプレビュー (Edge-to-Edge within pane) -->
              <div class="relative aspect-[4/3] bg-[#2A3A4A] border-b border-slate-200 overflow-hidden">
                <video #video class="h-full w-full object-cover" playsinline muted autoplay></video>
                <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div class="h-44 w-44 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(42,58,74,0.45)]"></div>
                </div>
                <div class="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded text-[11px] font-bold">
                  対象棚: {{ locationLabel() }}
                </div>
                <div class="absolute inset-x-0 bottom-0 bg-black/65 px-4 py-2 text-center text-white flex items-center justify-center gap-2">
                  <span class="text-2xl font-black font-mono text-sky-300">{{ scanned().length }}</span>
                  <span class="text-xs font-bold">件 スキャン済み</span>
                </div>
              </div>

              <!-- 手入力 / バーコードリーダー入力バー -->
              <div class="p-4 border-b border-slate-200 bg-white space-y-2.5">
                <label class="block text-[11px] font-extrabold text-slate-700">
                  機材ID または シリアル番号(S/N) で追加（バーコードリーダー対応）
                </label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <input
                      class="heron-input heron-mono pr-8 w-full text-xs"
                      placeholder="例: DEV-TAB-00001 または S/N"
                      [(ngModel)]="manualId"
                      (keyup.enter)="addManual()"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 pointer-events-none">
                      <app-icon name="camera" />
                    </span>
                  </div>
                  <button
                    type="button"
                    class="px-4 py-1.5 text-xs font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded-md shrink-0 cursor-pointer"
                    (click)="addManual()"
                  >
                    追加
                  </button>
                </div>

                @if (lastMessage()) {
                  <div
                    class="rounded-md px-3 py-2 text-xs font-bold border"
                    [class]="lastIsError() ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'"
                  >
                    {{ lastMessage() }}
                  </div>
                }
              </div>

              <!-- 確定・中止アクションバー -->
              <div class="p-4 flex gap-2 mt-auto bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  class="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 flex-1 cursor-pointer"
                  (click)="cancel()"
                >
                  中止して戻る
                </button>
                <button
                  type="button"
                  class="px-4 py-2.5 text-xs font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded-md shadow-xs flex-2 cursor-pointer disabled:opacity-40"
                  [disabled]="submitting() || scanned().length === 0"
                  (click)="submit()"
                >
                  {{ submitting() ? '送信中...' : '棚卸しを確定する (' + scanned().length + '件)' }}
                </button>
              </div>
            </div>

            <!-- 右ペイン: スキャン済みリスト & 当該棚の未スキャン機材照合テーブル (lg:col-span-7) -->
            <div class="lg:col-span-7 bg-white flex flex-col">
              <!-- セクション1: 今回スキャン済みの機材一覧 -->
              <div class="px-4 md:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span class="text-xs font-extrabold text-slate-800">
                  スキャン済み機材リスト ({{ scanned().length }} 件)
                </span>
                @if (scanned().length > 0) {
                  <span class="text-[11px] text-slate-500">最新のスキャンが先頭に表示されます</span>
                }
              </div>

              @if (scanned().length === 0) {
                <div class="py-10 text-center border-b border-slate-200 px-4">
                  <p class="text-xs font-bold text-slate-500">まだ機材がスキャンされていません</p>
                  <p class="text-[11px] text-slate-400 mt-1">カメラにQRコードをかざすか、機材ID / シリアル番号を入力してください。</p>
                </div>
              } @else {
                <div class="overflow-x-auto border-b border-slate-200">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr class="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th class="py-2 pl-4 md:pl-6 pr-3 w-36">機材ID</th>
                        <th class="py-2 px-3">機材名 / シリアル番号(S/N)</th>
                        <th class="py-2 px-3 w-36">照合判定</th>
                        <th class="py-2 pl-3 pr-4 md:pr-6 text-right w-20">操作</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 text-xs">
                      @for (id of reversedScanned(); track id) {
                        @let eq = findEquipment(id);
                        <tr class="hover:bg-slate-50/80">
                          <td class="py-2.5 pl-4 md:pl-6 pr-3 font-mono font-bold text-[#2A3A4A] whitespace-nowrap">
                            {{ id }}
                          </td>
                          <td class="py-2.5 px-3">
                            @if (eq) {
                              <div class="font-bold text-slate-900">{{ eq.name }}</div>
                              @if (eq.serial_number) {
                                <div class="text-[10px] font-mono text-slate-500">S/N: {{ eq.serial_number }}</div>
                              }
                            } @else {
                              <span class="text-amber-700 font-bold">未登録の機材ID</span>
                            }
                          </td>
                          <td class="py-2.5 px-3 whitespace-nowrap">
                            @if (!eq) {
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                台帳未登録
                              </span>
                            } @else if (isAtSelectedLocation(eq)) {
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                所在一致 OK
                              </span>
                            } @else {
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                他所から移動反映
                              </span>
                            }
                          </td>
                          <td class="py-2.5 pl-3 pr-4 md:pr-6 text-right whitespace-nowrap">
                            <button
                              type="button"
                              (click)="remove(id)"
                              class="text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              取消
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- セクション2: 当該棚にあるはずの未スキャン機材リスト -->
              <div class="px-4 md:px-6 py-2.5 bg-amber-50/60 border-b border-slate-200 flex items-center justify-between">
                <span class="text-xs font-extrabold text-amber-900">
                  この棚に登録されている未スキャン機材 ({{ remainingExpected().length }} 件)
                </span>
                <span class="text-[10px] text-amber-700 font-semibold">ラベル汚損時は「目視確認で追加」も可能</span>
              </div>

              @if (remainingExpected().length === 0) {
                <div class="py-8 text-center px-4 text-xs text-emerald-700 font-bold bg-emerald-50/20">
                  この棚に登録されているすべての機材がスキャン済みです！
                </div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr class="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th class="py-2 pl-4 md:pl-6 pr-3 w-36">機材ID</th>
                        <th class="py-2 px-3">機材名 / シリアル番号(S/N)</th>
                        <th class="py-2 pl-3 pr-4 md:pr-6 text-right w-36">目視確認</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 text-xs">
                      @for (eq of remainingExpected(); track eq.equipment_id) {
                        <tr class="hover:bg-slate-50/80">
                          <td class="py-2.5 pl-4 md:pl-6 pr-3 font-mono font-bold text-slate-700">
                            {{ eq.equipment_id }}
                          </td>
                          <td class="py-2.5 px-3">
                            <div class="font-bold text-slate-800">{{ eq.name }}</div>
                            @if (eq.serial_number) {
                              <div class="text-[10px] font-mono text-slate-500">S/N: {{ eq.serial_number }}</div>
                            }
                          </td>
                          <td class="py-2.5 pl-3 pr-4 md:pr-6 text-right">
                            <button
                              type="button"
                              (click)="appendDirect(eq.equipment_id)"
                              class="px-2.5 py-1 text-[11px] font-bold text-[#2A3A4A] bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
                            >
                              + 目視確認で追加
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }

        <!-- ==================== STEP 3: 棚卸し完了レポート (Edge-to-Edge) ==================== -->
        @if (result(); as r) {
          <!-- 完了バナー -->
          <div class="border-b border-emerald-200 bg-emerald-50/70 px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="text-xs font-extrabold text-emerald-800 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
                棚卸し結果を台帳へ反映しました
              </div>
              <p class="text-[11px] text-emerald-700 mt-0.5">
                対象棚: <strong>{{ locationLabel() }}</strong> — スキャンされた機材の現在地をこの棚へ更新し、監査ログに記録しました。
              </p>
            </div>
            <button
              type="button"
              (click)="reset()"
              class="px-4 py-2 text-xs font-bold text-white bg-[#2A3A4A] hover:bg-[#1f2c38] rounded-md shadow-xs shrink-0 cursor-pointer"
            >
              続けて別の棚を棚卸しする
            </button>
          </div>

          <!-- 結果 4分割サマリー -->
          <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200 bg-white">
            <div class="p-4 md:px-6 bg-emerald-50/20">
              <div class="text-[11px] font-bold text-emerald-800">反映済み (所在確認OK)</div>
              <div class="text-2xl font-black font-mono text-emerald-900 mt-1">{{ r.updated.length }} <span class="text-xs font-normal">件</span></div>
            </div>
            <div class="p-4 md:px-6 bg-sky-50/20">
              <div class="text-[11px] font-bold text-sky-800">他所からの移動反映</div>
              <div class="text-2xl font-black font-mono text-sky-900 mt-1">{{ r.moved_in.length }} <span class="text-xs font-normal">件</span></div>
            </div>
            <div class="p-4 md:px-6 bg-rose-50/20">
              <div class="text-[11px] font-bold text-rose-800">未発見（要実地確認）</div>
              <div class="text-2xl font-black font-mono text-rose-900 mt-1">{{ r.missing.length }} <span class="text-xs font-normal">件</span></div>
            </div>
            <div class="p-4 md:px-6 bg-amber-50/20">
              <div class="text-[11px] font-bold text-amber-800">台帳未登録ID</div>
              <div class="text-2xl font-black font-mono text-amber-900 mt-1">{{ r.not_found.length }} <span class="text-xs font-normal">件</span></div>
            </div>
          </div>

          <!-- 未発見・未登録・反映済みの詳細フルワイドテーブル -->
          <div class="divide-y divide-slate-200">
            @if (r.missing.length > 0) {
              <div>
                <div class="px-4 md:px-6 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
                  <span class="text-xs font-extrabold text-rose-900">
                    未発見機材（この棚にあるはずだが読み取られなかった機材: {{ r.missing.length }} 件）
                  </span>
                  <span class="text-[11px] text-rose-700">※ 所在情報は変更していません。実地で確認してください。</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <tbody class="divide-y divide-slate-200 text-xs">
                      @for (id of r.missing; track id) {
                        @let eq = findEquipment(id);
                        <tr class="hover:bg-rose-50/30">
                          <td class="py-2.5 pl-4 md:pl-6 pr-3 w-40 font-mono font-bold text-rose-900">
                            <a [routerLink]="['/equipments', id]" class="hover:underline">{{ id }}</a>
                          </td>
                          <td class="py-2.5 px-3 font-bold text-slate-800">{{ eq?.name ?? '—' }}</td>
                          <td class="py-2.5 pl-3 pr-4 md:pr-6 font-mono text-[11px] text-slate-500">
                            {{ eq?.serial_number ? 'S/N: ' + eq?.serial_number : '' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

            @if (r.not_found.length > 0) {
              <div>
                <div class="px-4 md:px-6 py-2.5 bg-amber-50 border-b border-amber-200">
                  <span class="text-xs font-extrabold text-amber-900">
                    システムに存在しない未登録機材ID ({{ r.not_found.length }} 件)
                  </span>
                </div>
                <div class="px-4 md:px-6 py-3 flex flex-wrap gap-2">
                  @for (id of r.not_found; track id) {
                    <span class="heron-mono rounded bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                      {{ id }}
                    </span>
                  }
                </div>
              </div>
            }

            @if (r.updated.length > 0) {
              <div>
                <div class="px-4 md:px-6 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span class="text-xs font-extrabold text-slate-700">
                    今回棚卸し完了した機材一覧 ({{ r.updated.length }} 件)
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <tbody class="divide-y divide-slate-200 text-xs">
                      @for (id of r.updated; track id) {
                        @let eq = findEquipment(id);
                        <tr class="hover:bg-slate-50">
                          <td class="py-2.5 pl-4 md:pl-6 pr-3 w-40 font-mono font-bold text-[#2A3A4A]">
                            <a [routerLink]="['/equipments', id]" class="hover:underline">{{ id }}</a>
                          </td>
                          <td class="py-2.5 px-3 font-bold text-slate-800">{{ eq?.name ?? '—' }}</td>
                          <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {{ eq?.serial_number ? 'S/N: ' + eq?.serial_number : '' }}
                          </td>
                          <td class="py-2.5 pl-3 pr-4 md:pr-6 text-right">
                            @if (r.moved_in.includes(id)) {
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                他棚から移動反映
                              </span>
                            } @else {
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                所在確認済
                              </span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class InventoryComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  readonly master = inject(MasterService);
  private readonly scanner = inject(ScannerService);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly cameraAvailable = ScannerService.isCameraAvailable();
  readonly locations = signal<Location[]>([]);
  readonly allEquipments = signal<Equipment[]>([]);
  readonly scanned = signal<string[]>([]);
  readonly started = signal(false);
  readonly submitting = signal(false);
  readonly result = signal<InventoryResult | null>(null);
  readonly lastMessage = signal('');
  readonly lastIsError = signal(false);

  locationId: number | string | null = null;
  manualId = '';

  /** MasterServiceの棚マスタを優先しつつ、旧 Location マスタも統合して選択肢化 */
  readonly shelfOptions = computed<ShelfOption[]>(() => {
    const shelves = this.master.shelves();
    const opts: ShelfOption[] = shelves.map((s) => ({
      key: s.code,
      code: s.code,
      room_name: s.room_name,
      shelf_name: s.shelf_name,
    }));

    const existingNames = new Set(shelves.map((s) => `${s.room_name}/${s.shelf_name}`));
    for (const loc of this.locations()) {
      if (!existingNames.has(`${loc.room_name}/${loc.shelf_name}`)) {
        opts.push({
          key: loc.location_id,
          code: `LOC-${loc.location_id}`,
          room_name: loc.room_name,
          shelf_name: loc.shelf_name,
        });
      }
    }
    return opts;
  });

  /** 現在選択中の棚に台帳上登録されている機材一覧 */
  readonly expectedEquipments = computed<Equipment[]>(() => {
    const loc = this.locationId;
    if (loc === null) return [];
    return this.allEquipments().filter(
      (eq) => eq.status !== 'discarded' && this.matchesLocation(eq, loc),
    );
  });

  /** 現在選択中の棚にあるはずだが、まだスキャンされていない機材一覧 */
  readonly remainingExpected = computed<Equipment[]>(() => {
    const scannedSet = new Set(this.scanned());
    return this.expectedEquipments().filter((eq) => !scannedSet.has(eq.equipment_id));
  });

  constructor() {
    this.api.listLocations().subscribe({ next: (r) => this.locations.set(r.items ?? []) });
    this.loadEquipments();
  }

  private loadEquipments(): void {
    this.api.listEquipments({ per_page: 1000 }).subscribe({
      next: (r) => this.allEquipments.set(r.items ?? []),
    });
  }

  ngOnDestroy(): void {
    void this.scanner.stop();
  }

  matchesLocation(eq: Equipment, key: number | string | null): boolean {
    if (key === null) return false;
    if (typeof key === 'string') {
      return (eq.shelf_code ?? '').toUpperCase() === key.toUpperCase();
    }
    return Number(eq.current_location_id) === Number(key);
  }

  isAtSelectedLocation(eq: Equipment): boolean {
    return this.matchesLocation(eq, this.locationId);
  }

  countEquipmentsAt(key: number | string): number {
    return this.allEquipments().filter(
      (eq) => eq.status !== 'discarded' && this.matchesLocation(eq, key),
    ).length;
  }

  findEquipment(id: string): Equipment | undefined {
    return this.allEquipments().find((e) => e.equipment_id === id);
  }

  locationLabel(): string {
    if (this.locationId === null) return '';
    const opt = this.shelfOptions().find((o) => o.key === this.locationId);
    return opt ? `[${opt.code}] ${opt.room_name} / ${opt.shelf_name}` : String(this.locationId);
  }

  /** 直近に読んだものを先頭に出す（連続スキャン中の確認しやすさ優先）。 */
  reversedScanned(): string[] {
    return [...this.scanned()].reverse();
  }

  selectAndStart(key: number | string, event: Event): void {
    event.stopPropagation();
    this.locationId = key;
    this.start();
  }

  start(): void {
    if (this.locationId === null) return;
    this.started.set(true);
    this.result.set(null);
    this.scanned.set([]);
    this.lastMessage.set('');

    if (!this.cameraAvailable) return;
    // video 要素は @if の描画後に現れるため、次のフレームで起動する。
    queueMicrotask(() => {
      const el = this.videoRef()?.nativeElement;
      if (!el) return;
      void this.scanner.start(
        el,
        (text) => this.onScanned(text),
        (msg) => this.notify(msg, true),
      );
    });
  }

  cancel(): void {
    void this.scanner.stop();
    this.started.set(false);
    this.scanned.set([]);
    this.lastMessage.set('');
  }

  reset(): void {
    this.result.set(null);
    this.started.set(false);
    this.scanned.set([]);
    this.locationId = null;
    this.lastMessage.set('');
    this.loadEquipments();
  }

  addManual(): void {
    const raw = this.manualId.trim();
    if (!raw) return;

    // 1. シリアル番号 (S/N) 完全一致を優先チェック
    const bySerial = this.allEquipments().find(
      (e) => e.serial_number && e.serial_number.trim().toUpperCase() === raw.toUpperCase(),
    );
    if (bySerial) {
      this.append(bySerial.equipment_id);
      this.manualId = '';
      return;
    }

    // 2. 機材ID として正規化
    const id = normalizeEquipmentId(raw);
    if (!id) {
      this.notify('機材ID または登録済みシリアル番号(S/N)の形式が正しくありません（例: DEV-TAB-00001）', true);
      return;
    }
    this.append(id);
    this.manualId = '';
  }

  appendDirect(equipmentId: string): void {
    this.append(equipmentId);
  }

  remove(id: string): void {
    this.scanned.update((list) => list.filter((x) => x !== id));
  }

  submit(): void {
    if (this.locationId === null) return;
    this.submitting.set(true);
    this.api.inventory(this.locationId, this.scanned()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        void this.scanner.stop();
        this.result.set(res);
        this.loadEquipments();
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify(err?.error?.error ?? '棚卸しの送信に失敗しました', true);
      },
    });
  }

  private onScanned(text: string): void {
    const id = normalizeEquipmentId(text);
    if (!id) {
      this.notify('HERON のラベルではありません', true);
      return;
    }
    this.append(id);
  }

  /** 重複読み取りは無視し、追加できたときだけフィードバックする。 */
  private append(id: string): void {
    if (this.scanned().includes(id)) {
      this.notify(`${id} はすでに読み取り済みです`, false);
      return;
    }
    this.scanned.update((list) => [...list, id]);
    this.notify(`${id} をスキャンリストに追加しました`, false);
    // 連続スキャンのテンポを妨げないよう、端末が対応していれば短く振動させる。
    navigator.vibrate?.(40);
  }

  private notify(text: string, isError: boolean): void {
    this.lastMessage.set(text);
    this.lastIsError.set(isError);
  }
}
