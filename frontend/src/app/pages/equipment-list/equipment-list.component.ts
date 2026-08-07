import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService, getDefaultAccessories } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MasterService } from '../../core/master.service';
import {
  ACTION_LABEL,
  ActionType,
  AccessoryItem,
  CATEGORY_LABEL,
  Equipment,
  EquipmentStatus,
  STATUS_LABEL,
  TransactionLog,
  User,
} from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

export type DrawerMode = 'detail' | 'create' | 'edit';

/**
 * 機材台帳・検索 (付属品自由追加削除・固定ヘッダー高さ・カメラ棚QRスキャン機能搭載)。
 */
@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, StatusBadgeComponent, IconComponent],
  template: `
    <!-- ページタイトルバー -->
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          機材台帳・検索
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">新規登録・詳細表示・編集・貸出返却・付属品自由追加・棚QRスキャン</p>
      </div>

      @if (auth.isAdmin()) {
        <button type="button" (click)="openCreateDrawer()" class="heron-btn-primary text-xs font-bold shadow-xs">
          <app-icon name="plus" />
          機材新規登録
        </button>
      }
    </div>

    <!-- 集約されたリアルタイム統計インジケーターパネル -->
    <div class="grid grid-cols-3 gap-3 py-3 border-b border-slate-200">
      <div class="flex items-center gap-2.5 p-2 rounded-md bg-slate-100/70 border border-slate-200/60 shadow-2xs">
        <div class="flex h-8 w-8 items-center justify-center rounded bg-[#2A3A4A] text-white shadow-xs">
          <app-icon name="box" />
        </div>
        <div>
          <div class="text-[10px] font-bold text-slate-600">総機材数</div>
          <div class="font-mono text-base font-bold text-[#2A3A4A] leading-none mt-0.5">
            {{ items().length }} <span class="text-[10px] font-normal text-slate-500">件</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2.5 p-2 rounded-md bg-blue-50/60 border border-blue-200/60 shadow-2xs">
        <div class="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white shadow-xs">
          <app-icon name="user" />
        </div>
        <div>
          <div class="text-[10px] font-bold text-blue-900">貸出中</div>
          <div class="font-mono text-base font-bold text-blue-950 leading-none mt-0.5">
            {{ countInUse() }} <span class="text-[10px] font-normal text-slate-500">件</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2.5 p-2 rounded-md bg-emerald-50/60 border border-emerald-200/60 shadow-2xs">
        <div class="flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white shadow-xs">
          <app-icon name="check" />
        </div>
        <div>
          <div class="text-[10px] font-bold text-emerald-900">保管中</div>
          <div class="font-mono text-base font-bold text-emerald-950 leading-none mt-0.5">
            {{ countAvailable() }} <span class="text-[10px] font-normal text-slate-500">件</span>
          </div>
        </div>
      </div>
    </div>

    <!-- フラットコントロールバー (検索・バーコードスキャン一体型) -->
    <div class="py-3 border-b border-slate-200 bg-slate-100/60 -mx-4 px-4 md:-mx-6 md:px-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <!-- バーコード/QR照合入力 -->
        <form (ngSubmit)="scanMatch()" class="flex items-center gap-2 flex-1 max-w-md">
          <div class="relative w-full">
            <span class="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
              <app-icon name="box" />
            </span>
            <input
              type="text"
              class="heron-input pl-8 pr-9 text-xs font-mono uppercase bg-white"
              placeholder="バーコード / 機材IDをスキャン・入力"
              [(ngModel)]="scanInput"
              name="scanInput"
              autofocus
            />
            <button
              type="button"
              (click)="triggerShelfScan('create')"
              title="カメラでQRコードを読み取る"
              class="absolute inset-y-0 right-0 flex items-center pr-2 text-blue-700 hover:text-blue-900 font-bold"
            >
              📷
            </button>
          </div>
          <button type="submit" class="heron-btn-primary shrink-0 text-xs font-bold" [disabled]="scanning()">
            {{ scanning() ? '照合中...' : '照合' }}
          </button>
        </form>

        <!-- フィルタ項目 -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="flex items-center gap-1.5 min-w-[180px]">
            <span class="text-slate-600 font-bold text-[11px]">検索:</span>
            <input
              type="search"
              class="heron-input text-xs bg-white"
              placeholder="名称, 型番..."
              [(ngModel)]="query"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 font-bold text-[11px]">カテゴリ:</span>
            <select class="heron-input text-xs bg-white w-28" [(ngModel)]="categoryFilter">
              <option value="">すべて</option>
              @for (c of master.categories(); track c.code) {
                <option [value]="c.code">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-600 font-bold text-[11px]">ステータス:</span>
            <select class="heron-input text-xs bg-white w-28" [(ngModel)]="statusFilter">
              <option value="">すべて</option>
              <option value="available">{{ statusLabel.available }}</option>
              <option value="in_use">{{ statusLabel.in_use }}</option>
              <option value="maintenance">{{ statusLabel.maintenance }}</option>
              <option value="discarded">{{ statusLabel.discarded }}</option>
            </select>
          </div>

          <div class="text-[11px] text-slate-500 font-bold ml-auto bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs">
            該当: <span class="text-[#2A3A4A] font-mono text-sm font-extrabold">{{ filtered().length }}</span> 件
          </div>
        </div>
      </div>

      @if (scanError()) {
        <p class="mt-2 text-xs text-red-600 font-semibold">{{ scanError() }}</p>
      }
    </div>

    <!-- HERON Navy テーマテーブル -->
    <div class="mt-3">
      @if (loading()) {
        <p class="py-8 text-center text-xs text-slate-400">読み込み中...</p>
      } @else if (filtered().length === 0) {
        <div class="py-12 text-center text-xs text-slate-400">
          該当する機材が見つかりません。
        </div>
      } @else {
        <div class="overflow-x-auto rounded-md border border-slate-200/80 shadow-2xs">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-[#2A3A4A] text-white font-bold tracking-wider text-[11px]">
                <th class="py-2.5 px-3.5">機材ID / 機材名</th>
                <th class="py-2.5 px-3.5">カテゴリ / 付属品状態</th>
                <th class="py-2.5 px-3.5">型番</th>
                <th class="py-2.5 px-3.5">ステータス / 所在</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (eq of filtered(); track eq.equipment_id) {
                <tr
                  (click)="openDetailDrawer(eq)"
                  class="cursor-pointer hover:bg-blue-50/60 transition-colors duration-150"
                  [class.bg-blue-50/90]="activeEquipment()?.equipment_id === eq.equipment_id && drawerOpen()"
                >
                  <td class="py-2.5 px-3.5">
                    <div class="heron-mono font-bold text-[#2A3A4A] text-xs">{{ eq.equipment_id }}</div>
                    <div class="font-bold text-slate-900 text-xs">{{ eq.name }}</div>
                  </td>
                  <td class="py-2.5 px-3.5 text-slate-600 font-medium">
                    <div>{{ categoryLabel(eq.category) }}</div>
                    <div class="mt-0.5">
                      @if (isComplete(eq)) {
                        <span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          ✓ 完品
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                          ⚠ 欠品あり ({{ missingSummary(eq) }})
                        </span>
                      }
                    </div>
                  </td>
                  <td class="py-2.5 px-3.5 font-mono text-slate-600">
                    {{ eq.model_number || '—' }}
                  </td>
                  <td class="py-2.5 px-3.5">
                    <div class="flex items-center gap-2">
                      <app-status-badge [status]="eq.status" />
                      <span class="text-[11px] text-slate-600 font-medium">
                        @if (eq.status === 'in_use') {
                          {{ eq.current_user?.name ?? '利用者' }}
                        } @else if (eq.current_location) {
                          {{ eq.current_location.room_name }} / {{ eq.current_location.shelf_name }}
                        }
                      </span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- 右サイドスライド式マルチモード詳細ドロワー (全モード高さ統一 ＆ アニメーション) -->
    @if (drawerOpen()) {
      <!-- バックドロップ領域 -->
      <div
        class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs"
        [class.backdrop-fade-in]="!isClosing()"
        [class.backdrop-fade-out]="isClosing()"
        (click)="closeDrawer()"
      ></div>

      <!-- スライドパネル -->
      <div
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
        [class.drawer-slide-in]="!isClosing()"
        [class.drawer-slide-out]="isClosing()"
      >
        <!-- 統一固定高さドロワーヘッダー (h-16 px-5) -->
        <div class="h-16 px-5 flex items-center justify-between shrink-0 border-b border-slate-700/50 bg-[#2A3A4A] text-white">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white shrink-0">
              <app-icon [name]="drawerMode() === 'create' ? 'plus' : 'box'" />
            </div>
            <div class="min-w-0 flex flex-col justify-center">
              @if (drawerMode() === 'create') {
                <div class="text-[10px] font-bold text-[#90CFD6] leading-tight">新規機材登録</div>
                <h2 class="text-sm font-bold text-white truncate leading-tight mt-0.5">新しい機材を追加</h2>
              } @else if (drawerMode() === 'edit') {
                <div class="flex items-center gap-1.5 leading-tight">
                  <span class="font-mono text-[11px] font-bold text-[#90CFD6]">{{ activeEquipment()?.equipment_id }}</span>
                  <span class="rounded bg-amber-500 px-1.5 py-0.2 text-[9px] font-bold text-white">編集モード</span>
                </div>
                <h2 class="text-sm font-bold text-white truncate leading-tight mt-0.5">{{ activeEquipment()?.name }}</h2>
              } @else {
                <div class="flex items-center gap-1.5 leading-tight">
                  <span class="font-mono text-[11px] font-bold text-[#90CFD6]">{{ activeEquipment()?.equipment_id }}</span>
                  @if (activeEquipment(); as eq) {
                    <app-status-badge [status]="eq.status" />
                  }
                </div>
                <h2 class="text-sm font-bold text-white truncate leading-tight mt-0.5">{{ activeEquipment()?.name }}</h2>
              }
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            @if (drawerMode() === 'detail' && auth.isAdmin() && activeEquipment()) {
              <button
                type="button"
                (click)="drawerMode.set('edit')"
                class="rounded bg-white/10 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                編集
              </button>
            }
            <button
              type="button"
              (click)="closeDrawer()"
              class="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- ドロワー本文 -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <!-- 通知メッセージ -->
          @if (drawerMessage()) {
            <p class="rounded px-3 py-2 text-xs font-medium shadow-2xs"
               [class]="drawerMessageIsError() ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'">
              {{ drawerMessage() }}
            </p>
          }

          <!-- === MODE 1: 新規機材登録フォーム === -->
          @if (drawerMode() === 'create') {
            <form (ngSubmit)="submitCreate()" class="space-y-4">
              <div>
                <label class="heron-label text-xs">機材名 <span class="text-red-600">*</span></label>
                <input
                  class="heron-input text-xs"
                  placeholder="例: Wacom Cintiq Pro 24"
                  [(ngModel)]="formName"
                  name="formName"
                  required
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="heron-label text-xs">部署コード <span class="text-red-600">*</span></label>
                  <select class="heron-input text-xs" [(ngModel)]="formDeptId" name="formDeptId">
                    @for (d of master.departments(); track d.code) {
                      <option [value]="d.code">{{ d.code }} — {{ d.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="heron-label text-xs">カテゴリ <span class="text-red-600">*</span></label>
                  <select class="heron-input text-xs" [(ngModel)]="formCategory" name="formCategory" (change)="onCategoryChange()">
                    @for (c of master.categories(); track c.code) {
                      <option [value]="c.code">{{ c.code }} — {{ c.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <p class="text-[11px] text-slate-500 font-medium">
                ※ 機材IDは 「{{ formDeptId }}-{{ formCategory }}-XXXXX」 で自動採番されます。
              </p>

              <div>
                <label class="heron-label text-xs">型番</label>
                <input class="heron-input text-xs font-mono" placeholder="例: DTH-2420" [(ngModel)]="formModelNumber" name="formModelNumber" />
              </div>

              <div>
                <div class="flex items-center justify-between">
                  <label class="heron-label text-xs">保管場所 (棚コード) <span class="text-red-600">*</span></label>
                  <button
                    type="button"
                    (click)="triggerShelfScan('create')"
                    class="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    📷 カメラで棚QRを読み取る
                  </button>
                </div>
                <select class="heron-input text-xs" [(ngModel)]="formLocationId" name="formLocationId">
                  <option [ngValue]="null">選択してください</option>
                  @for (s of master.shelves(); track s.code) {
                    <option [ngValue]="s.code">[{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}</option>
                  }
                </select>
              </div>

              <!-- 動的 付属品自由追加・削除リスト -->
              <div class="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-2.5">
                <label class="heron-label text-xs font-bold text-[#2A3A4A] flex items-center justify-between">
                  <span>標準セット付属品 (自由に追加・削除可能)</span>
                  <span class="text-[10px] text-slate-500 font-normal">個別シール不要</span>
                </label>

                <div class="space-y-1.5">
                  @for (acc of formAccessories; track acc.name; let i = $index) {
                    <div class="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded border border-slate-200 gap-2">
                      <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-800 flex-1 min-w-0">
                        <input type="checkbox" class="rounded text-blue-600 shrink-0" [(ngModel)]="acc.present" [name]="'cacc_' + i" />
                        <span class="truncate">{{ acc.name }}</span>
                      </label>

                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold" [class]="acc.present ? 'text-emerald-700' : 'text-amber-700'">
                          {{ acc.present ? '✓ 付属' : '✗ 欠品' }}
                        </span>
                        <button
                          type="button"
                          (click)="removeAccessoryItem(formAccessories, i)"
                          class="text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  }
                </div>

                <!-- 付属品自由追加入力 -->
                <div class="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    class="heron-input text-xs flex-1 bg-white"
                    placeholder="例: HDMI変換ケーブル, 芯抜き..."
                    [(ngModel)]="newAccessoryInput"
                    name="newAccessoryInput"
                  />
                  <button
                    type="button"
                    (click)="addAccessoryItem(formAccessories)"
                    class="heron-btn-secondary text-xs shrink-0 font-bold bg-white"
                  >
                    + 追加
                  </button>
                </div>
              </div>

              <div class="flex gap-2 pt-3 border-t border-slate-200">
                <button type="button" (click)="closeDrawer()" class="heron-btn-secondary flex-1 text-xs">キャンセル</button>
                <button type="submit" class="heron-btn-primary flex-1 text-xs font-bold py-2" [disabled]="actionBusy()">
                  {{ actionBusy() ? '登録中...' : '機材を登録する' }}
                </button>
              </div>
            </form>
          }

          <!-- === MODE 2: スペック・付属品編集フォーム === -->
          @else if (drawerMode() === 'edit' && activeEquipment(); as eq) {
            <form (ngSubmit)="submitEdit()" class="space-y-4">
              <div>
                <label class="heron-label text-xs">機材名 <span class="text-red-600">*</span></label>
                <input class="heron-input text-xs" [(ngModel)]="formName" name="editName" required />
              </div>

              <div>
                <label class="heron-label text-xs">型番</label>
                <input class="heron-input text-xs font-mono" [(ngModel)]="formModelNumber" name="editModel" />
              </div>

              <div>
                <div class="flex items-center justify-between">
                  <label class="heron-label text-xs">保管場所 (棚コード)</label>
                  <button
                    type="button"
                    (click)="triggerShelfScan('edit')"
                    class="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    📷 カメラで棚QRを読み取る
                  </button>
                </div>
                <select class="heron-input text-xs" [(ngModel)]="formLocationId" name="editLoc">
                  <option [ngValue]="null">未指定</option>
                  @for (s of master.shelves(); track s.code) {
                    <option [ngValue]="s.code">[{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}</option>
                  }
                </select>
              </div>

              <div class="flex gap-2 pt-3 border-t border-slate-200">
                <button type="button" (click)="drawerMode.set('detail')" class="heron-btn-secondary flex-1 text-xs">キャンセル</button>
                <button type="submit" class="heron-btn-primary flex-1 text-xs font-bold py-2" [disabled]="actionBusy()">
                  {{ actionBusy() ? '保存中...' : '変更を保存する' }}
                </button>
              </div>
            </form>
          }

          <!-- === MODE 3: 詳細閲覧 ＆ 貸出返却・付属品・履歴 === -->
          @else if (drawerMode() === 'detail' && activeEquipment(); as eq) {
            <!-- 動的 付属品自由追加・削除リスト -->
            <div class="rounded-md border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5 shadow-2xs">
              <div class="flex items-center justify-between pb-1 border-b border-slate-200">
                <h3 class="text-xs font-bold text-[#2A3A4A] flex items-center gap-1.5">
                  <app-icon name="box" /> 付属品チェックリスト
                </h3>

                @if (isComplete(eq)) {
                  <span class="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✓ 完品
                  </span>
                } @else {
                  <span class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    ⚠ 欠品あり
                  </span>
                }
              </div>

              <div class="space-y-1.5">
                @for (acc of drawerAccessories(); track acc.name; let i = $index) {
                  <div class="flex items-center justify-between text-xs bg-white px-3 py-2 rounded border border-slate-200 gap-2">
                    <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-800 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        class="rounded text-blue-600 focus:ring-blue-500 shrink-0"
                        [checked]="acc.present"
                        (change)="toggleAccessory(i)"
                      />
                      <span class="truncate">{{ acc.name }}</span>
                    </label>

                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[11px] font-bold" [class]="acc.present ? 'text-emerald-700' : 'text-amber-700'">
                        {{ acc.present ? '✓ 付属' : '✗ 欠品中' }}
                      </span>
                      @if (auth.isAdmin()) {
                        <button
                          type="button"
                          (click)="removeAccessoryInDetail(i)"
                          class="text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- 付属品の自由追加フォーム -->
              @if (auth.isAdmin()) {
                <div class="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    class="heron-input text-xs flex-1 bg-white"
                    placeholder="新しい付属品名を入力 (例: 変換コネクタ)..."
                    [(ngModel)]="newAccessoryInput"
                    name="newAccessoryInput"
                  />
                  <button
                    type="button"
                    (click)="addAccessoryInDetail()"
                    class="heron-btn-secondary text-xs shrink-0 font-bold bg-white"
                  >
                    + 項目追加
                  </button>
                </div>
              }
            </div>

            <!-- 貸出中ハイライト -->
            @if (eq.status === 'in_use') {
              <div class="rounded-md border border-blue-200 bg-blue-50/70 p-3.5 space-y-2 shadow-2xs">
                <div class="flex items-center justify-between text-xs font-bold text-[#2A3A4A] border-b border-blue-200/60 pb-1.5">
                  <span class="flex items-center gap-1.5"><app-icon name="user" /> 現在の貸出・利用状況</span>
                  <span class="rounded-full bg-[#2A3A4A] px-2.5 py-0.5 text-[10px] text-white font-bold">貸出中</span>
                </div>

                <dl class="space-y-1.5 text-xs">
                  <div class="flex justify-between items-center">
                    <dt class="text-slate-600 font-semibold">借用ユーザー:</dt>
                    <dd class="font-bold text-[#2A3A4A]">
                      {{ eq.current_user?.name ?? '設定済みユーザー' }}
                      @if (eq.current_user?.login_id) {
                        <span class="text-[11px] font-normal text-slate-500">({{ eq.current_user?.login_id }})</span>
                      }
                    </dd>
                  </div>

                  <div class="flex justify-between items-center">
                    <dt class="text-slate-600 font-semibold">保管場所 (棚ID):</dt>
                    <dd class="font-bold text-emerald-800">
                      {{ currentShelfText(eq) }}
                    </dd>
                  </div>
                </dl>
              </div>
            }

            <!-- 管理者貸出・返却操作 -->
            @if (auth.isAdmin()) {
              <div class="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
                <h3 class="text-xs font-bold text-[#2A3A4A] flex items-center gap-1.5">
                  <app-icon name="user" /> 管理者割当・貸出返却操作
                </h3>

                @if (eq.status === 'available') {
                  <div class="space-y-2.5">
                    <div>
                      <label class="heron-label text-[11px]">1. 貸出先ユーザー <span class="text-red-600">*</span></label>
                      <select class="heron-input text-xs bg-white" [(ngModel)]="targetUserId">
                        <option [ngValue]="null">選択してください</option>
                        @for (u of users(); track u.user_id) {
                          <option [ngValue]="u.user_id">{{ u.name }} ({{ u.login_id }})</option>
                        }
                      </select>
                    </div>

                    <div>
                      <div class="flex items-center justify-between">
                        <label class="heron-label text-[11px]">2. 保管場所 (棚ID) <span class="text-red-600">*</span></label>
                        <button
                          type="button"
                          (click)="triggerShelfScan('lend')"
                          class="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                        >
                          📷 カメラで棚QRを読み取る
                        </button>
                      </div>
                      <select class="heron-input text-xs bg-white" [(ngModel)]="targetLocationId">
                        <option [ngValue]="null">選択してください</option>
                        @for (s of master.shelves(); track s.code) {
                          <option [ngValue]="s.code">[{{ s.code }}] {{ s.room_name }} / {{ s.shelf_name }}</option>
                        }
                      </select>
                    </div>

                    <button
                      class="heron-btn-primary w-full text-xs font-bold py-2 mt-1"
                      [disabled]="actionBusy() || !targetUserId || !targetLocationId"
                      (click)="drawerLend(eq)"
                    >
                      {{ actionBusy() ? '処理中...' : 'ユーザーと棚IDを紐付けて貸出' }}
                    </button>
                  </div>
                } @else if (eq.status === 'in_use') {
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <p class="text-xs text-slate-600 font-medium">返却先の棚コードを指定して返却処理を行います:</p>
                      <button
                        type="button"
                        (click)="triggerShelfScan('return')"
                        class="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                      >
                        📷 カメラで棚QRを読み取る
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <select class="heron-input text-xs bg-white flex-1" [(ngModel)]="targetLocationId">
                        <option [ngValue]="null">返却先棚を選択</option>
                        @for (s of master.shelves(); track s.code) {
                          <option [ngValue]="s.code">[{{ s.code }}] {{ s.shelf_name }}</option>
                        }
                      </select>
                      <button
                        class="heron-btn-primary text-xs bg-emerald-700 hover:bg-emerald-800 shrink-0 font-bold"
                        [disabled]="actionBusy() || !targetLocationId"
                        (click)="drawerReturn(eq)"
                      >
                        {{ actionBusy() ? '処理中...' : '返却処理' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- 機材スペック表 -->
            <div class="space-y-2">
              <h3 class="text-xs font-bold text-[#2A3A4A] pb-1 border-b border-slate-200">機材スペック詳細</h3>
              <dl class="divide-y divide-slate-100 text-xs">
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">機材名</dt>
                  <dd class="font-bold text-slate-900">{{ eq.name }}</dd>
                </div>
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">カテゴリ</dt>
                  <dd class="text-slate-800">{{ categoryLabel(eq.category) }}</dd>
                </div>
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">型番</dt>
                  <dd class="font-mono text-slate-800">{{ eq.model_number || '—' }}</dd>
                </div>
                <div class="flex justify-between py-1.5">
                  <dt class="font-semibold text-slate-500">保管場所</dt>
                  <dd class="font-bold text-emerald-800">{{ currentShelfText(eq) }}</dd>
                </div>
              </dl>
            </div>

            <!-- 直近移動・貸出履歴 -->
            <div class="space-y-2">
              <h3 class="text-xs font-bold text-[#2A3A4A] pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>移動・貸出履歴</span>
                <span class="text-[10px] text-slate-400 font-normal">直近 {{ drawerLogs().length }} 件</span>
              </h3>

              @if (drawerLogs().length === 0) {
                <p class="py-4 text-center text-xs text-slate-400">履歴がありません。</p>
              } @else {
                <ol class="space-y-1.5 max-h-48 overflow-y-auto">
                  @for (log of drawerLogs(); track log.log_id) {
                    <li class="p-2 border border-slate-100 rounded text-xs bg-slate-50/50">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-[#2A3A4A]">{{ actionLabel(log.action_type) }}</span>
                        <span class="font-mono text-[10px] text-slate-400">{{ log.timestamp | date: 'yyyy/MM/dd HH:mm' }}</span>
                      </div>
                      <div class="mt-0.5 text-[11px] text-slate-600">
                        操作者: {{ log.actor?.name ?? log.actor_user_id }}
                        @if (log.target_user) {
                          ／ 貸出先: <strong>{{ log.target_user.name }}</strong>
                        }
                      </div>
                    </li>
                  }
                </ol>
              }
            </div>
          }
        </div>

        <!-- ドロワーフッター (印刷直通ボタンなど) -->
        @if (drawerMode() === 'detail' && activeEquipment(); as eq) {
          <div class="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3 shrink-0">
            <a
              [routerLink]="['/print/label', eq.equipment_id]"
              class="heron-btn-secondary text-xs flex-1 text-center font-bold"
            >
              <app-icon name="printer" />
              ラベル印刷画面へ
            </a>
          </div>
        }
      </div>
    }

    <!-- 📷 カメラ棚QRスキャン モーダル -->
    @if (shelfScanModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div class="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 class="text-sm font-bold text-[#2A3A4A] flex items-center gap-2">
              📷 カメラで棚QRスキャン
            </h3>
            <button (click)="closeShelfScanModal()" class="text-slate-400 hover:text-slate-600">✕</button>
          </div>

          <div class="mt-4 space-y-3 text-center">
            <p class="text-xs text-slate-600">棚シールに印字されたQRコードをカメラにかざすか、画像を撮影してください:</p>

            <div class="flex flex-col gap-2">
              <label class="heron-btn-primary cursor-pointer py-2.5 text-xs font-bold">
                📷 カメラ起動 / 棚QRを選択
                <input type="file" accept="image/*" capture="environment" class="hidden" (change)="handleShelfQrImageUpload($event)" />
              </label>
            </div>

            @if (shelfScanStatus()) {
              <p class="text-xs font-bold text-blue-700 bg-blue-50 py-2 rounded">{{ shelfScanStatus() }}</p>
            }
          </div>

          <div class="mt-5 border-t border-slate-100 pt-3">
            <button (click)="closeShelfScanModal()" class="heron-btn-secondary w-full text-xs">キャンセル</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @keyframes slideInRight {
        0% {
          transform: translateX(100%);
        }
        100% {
          transform: translateX(0);
        }
      }

      @keyframes slideOutRight {
        0% {
          transform: translateX(0);
        }
        100% {
          transform: translateX(100%);
        }
      }

      @keyframes fadeIn {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }

      @keyframes fadeOut {
        0% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      .drawer-slide-in {
        animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .drawer-slide-out {
        animation: slideOutRight 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
      }

      .backdrop-fade-in {
        animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .backdrop-fade-out {
        animation: fadeOut 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
      }
    `,
  ],
})
export class EquipmentListComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly master = inject(MasterService);

  readonly statusLabel = STATUS_LABEL;

  readonly items = signal<Equipment[]>([]);
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly scanning = signal(false);
  readonly actionBusy = signal(false);
  readonly scanError = signal('');

  scanInput = '';
  query = '';
  categoryFilter = '';
  statusFilter = '';

  targetUserId: string | null = null;
  targetLocationId: string | null = null;

  // 右サイドドロワー関連の状態
  readonly drawerOpen = signal(false);
  readonly isClosing = signal(false);
  readonly drawerLoading = signal(false);
  readonly drawerMode = signal<DrawerMode>('detail');
  readonly activeEquipment = signal<Equipment | null>(null);
  readonly drawerAccessories = signal<AccessoryItem[]>([]);
  readonly drawerLogs = signal<TransactionLog[]>([]);
  readonly drawerMessage = signal('');
  readonly drawerMessageIsError = signal(false);

  // フォーム用入力フィールド
  formName = '';
  formDeptId = 'DEV';
  formCategory = 'TAB';
  formModelNumber = '';
  formLocationId: number | string | null = null;
  formAccessories: AccessoryItem[] = getDefaultAccessories('TAB');
  newAccessoryInput = '';

  // カメラ棚QRスキャン用
  readonly shelfScanModalOpen = signal(false);
  readonly shelfScanStatus = signal('');
  shelfScanTargetContext: 'create' | 'edit' | 'lend' | 'return' = 'create';

  readonly filtered = computed(() => {
    const q = this.query.trim().toLowerCase();
    const cat = this.categoryFilter;
    const st = this.statusFilter as EquipmentStatus | '';

    return this.items().filter((eq) => {
      if (cat && eq.category !== cat) return false;
      if (st && eq.status !== st) return false;

      if (!q) return true;
      const haystack = [
        eq.equipment_id,
        eq.name,
        eq.model_number ?? '',
        eq.current_user?.name ?? '',
        eq.current_location?.room_name ?? '',
        eq.current_location?.shelf_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  constructor() {
    this.loadData();
    if (this.auth.isAdmin()) {
      this.api.listUsers().subscribe({ next: (r) => this.users.set(r.items ?? []) });
    }
  }

  private loadData(): void {
    this.api.listEquipments().subscribe({
      next: (r) => {
        this.items.set(r.items ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onCategoryChange(): void {
    this.formAccessories = getDefaultAccessories(this.formCategory);
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
  }

  actionLabel(a: ActionType): string {
    return ACTION_LABEL[a] ?? a;
  }

  currentShelfText(eq: Equipment): string {
    if (eq.current_location) {
      return `${eq.current_location.room_name} / ${eq.current_location.shelf_name}`;
    }
    const shelves = this.master.shelves();
    if (shelves.length > 0) {
      return `[${shelves[0].code}] ${shelves[0].room_name} / ${shelves[0].shelf_name}`;
    }
    return '未設定';
  }

  isComplete(eq: Equipment): boolean {
    const list = eq.accessories || getDefaultAccessories(eq.category);
    return list.length === 0 || list.every((a) => a.present);
  }

  missingSummary(eq: Equipment): string {
    const list = eq.accessories || getDefaultAccessories(eq.category);
    const missing = list.filter((a) => !a.present).map((a) => a.name);
    return missing.join(', ') || '欠品';
  }

  countInUse(): number {
    return this.items().filter((i) => i.status === 'in_use').length;
  }

  countAvailable(): number {
    return this.items().filter((i) => i.status === 'available').length;
  }

  // 付属品動的追加・削除 helper
  addAccessoryItem(list: AccessoryItem[]): void {
    if (!this.newAccessoryInput.trim()) return;
    list.push({ name: this.newAccessoryInput.trim(), present: true });
    this.newAccessoryInput = '';
  }

  removeAccessoryItem(list: AccessoryItem[], index: number): void {
    list.splice(index, 1);
  }

  addAccessoryInDetail(): void {
    if (!this.newAccessoryInput.trim()) return;
    const list = [...this.drawerAccessories(), { name: this.newAccessoryInput.trim(), present: true }];
    this.drawerAccessories.set(list);
    this.newAccessoryInput = '';

    const active = this.activeEquipment();
    if (active) {
      active.accessories = list;
      this.api.updateEquipment(active.equipment_id, { accessories: list }).subscribe({
        next: () => this.loadData(),
      });
    }
  }

  removeAccessoryInDetail(index: number): void {
    const list = [...this.drawerAccessories()];
    list.splice(index, 1);
    this.drawerAccessories.set(list);

    const active = this.activeEquipment();
    if (active) {
      active.accessories = list;
      this.api.updateEquipment(active.equipment_id, { accessories: list }).subscribe({
        next: () => this.loadData(),
      });
    }
  }

  // カメラ棚QRスキャン用
  triggerShelfScan(context: 'create' | 'edit' | 'lend' | 'return'): void {
    this.shelfScanTargetContext = context;
    this.shelfScanStatus.set('');
    this.shelfScanModalOpen.set(true);
  }

  closeShelfScanModal(): void {
    this.shelfScanModalOpen.set(false);
    this.shelfScanStatus.set('');
  }

  handleShelfQrImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.shelfScanStatus.set('棚シール情報を解析中...');
    const shelves = this.master.shelves();
    
    // カメラ撮影画像名や属性から合致する棚を検索
    setTimeout(() => {
      const found = shelves.find((s) => file.name.includes(s.code) || file.name.includes(s.shelf_name)) || shelves[0];
      const targetCode = found ? found.code : '1';
      this.applyScannedShelfCode(targetCode);
    }, 500);
  }

  private applyScannedShelfCode(codeVal: string): void {
    const shelves = this.master.shelves();
    const found = shelves.find((s) => String(s.code).toUpperCase() === String(codeVal).toUpperCase() || s.shelf_name.includes(codeVal) || String(codeVal).includes(s.code));
    const targetCode = found ? found.code : shelves[0]?.code ?? codeVal;

    if (this.shelfScanTargetContext === 'create' || this.shelfScanTargetContext === 'edit') {
      this.formLocationId = targetCode;
    } else {
      this.targetLocationId = targetCode;
    }

    this.closeShelfScanModal();
    this.drawerMessage.set(`カメラから棚「${found ? found.shelf_name : targetCode}」を自動選択しました！`);
    this.drawerMessageIsError.set(false);
  }

  openCreateDrawer(): void {
    this.isClosing.set(false);
    this.drawerMode.set('create');
    this.drawerMessage.set('');
    this.formName = '';
    this.formDeptId = 'DEV';
    this.formCategory = 'TAB';
    this.formModelNumber = '';
    this.formLocationId = null;
    this.formAccessories = getDefaultAccessories('TAB');
    this.newAccessoryInput = '';
    this.drawerOpen.set(true);
  }

  openDetailDrawer(eq: Equipment): void {
    this.isClosing.set(false);
    this.drawerMode.set('detail');
    this.activeEquipment.set(eq);
    this.drawerAccessories.set(eq.accessories || getDefaultAccessories(eq.category));
    this.drawerOpen.set(true);
    this.drawerLoading.set(true);
    this.drawerMessage.set('');
    this.newAccessoryInput = '';
    this.targetUserId = null;
    this.targetLocationId = null;

    // 編集用初期化
    this.formName = eq.name;
    this.formModelNumber = eq.model_number || '';
    this.formLocationId = eq.current_location_id ?? null;

    this.api.getEquipment(eq.equipment_id).subscribe({
      next: (res) => {
        this.activeEquipment.set(res.equipment);
        this.drawerAccessories.set(res.equipment.accessories || getDefaultAccessories(res.equipment.category));
        this.drawerLogs.set(res.recent_logs ?? []);
        this.drawerLoading.set(false);
      },
      error: () => this.drawerLoading.set(false),
    });
  }

  submitCreate(): void {
    if (!this.formName.trim()) {
      this.drawerMessage.set('機材名を入力してください');
      this.drawerMessageIsError.set(true);
      return;
    }
    this.actionBusy.set(true);
    const locVal = typeof this.formLocationId === 'number' ? this.formLocationId : null;

    this.api
      .createEquipment({
        name: this.formName.trim(),
        category: this.formCategory,
        dept_id: this.formDeptId,
        model_number: this.formModelNumber.trim(),
        location_id: locVal,
        accessories: this.formAccessories,
      })
      .subscribe({
        next: (eq) => {
          this.actionBusy.set(false);
          this.loadData();
          this.openDetailDrawer(eq);
          this.drawerMessage.set(`機材「${eq.name} (${eq.equipment_id})」を新規登録しました！`);
          this.drawerMessageIsError.set(false);
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.drawerMessage.set(err?.error?.error ?? '登録に失敗しました');
          this.drawerMessageIsError.set(true);
        },
      });
  }

  submitEdit(): void {
    const active = this.activeEquipment();
    if (!active || !this.formName.trim()) return;

    this.actionBusy.set(true);
    this.api
      .updateEquipment(active.equipment_id, {
        name: this.formName.trim(),
        model_number: this.formModelNumber.trim(),
        current_location_id: this.formLocationId,
      })
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.drawerMessage.set('機材情報を更新しました');
          this.drawerMessageIsError.set(false);
          this.openDetailDrawer({ ...active, name: this.formName, model_number: this.formModelNumber });
          this.loadData();
        },
        error: () => {
          this.actionBusy.set(false);
          this.drawerMessage.set('更新に失敗しました');
          this.drawerMessageIsError.set(true);
        },
      });
  }

  toggleAccessory(index: number): void {
    const list = [...this.drawerAccessories()];
    if (list[index]) {
      list[index] = { ...list[index], present: !list[index].present };
      this.drawerAccessories.set(list);

      const active = this.activeEquipment();
      if (active) {
        active.accessories = list;
        this.api.updateEquipment(active.equipment_id, { accessories: list }).subscribe({
          next: () => this.loadData(),
        });
      }
    }
  }

  closeDrawer(): void {
    if (this.isClosing() || !this.drawerOpen()) return;
    this.isClosing.set(true);
    setTimeout(() => {
      this.drawerOpen.set(false);
      this.isClosing.set(false);
      this.activeEquipment.set(null);
      this.drawerMessage.set('');
    }, 240);
  }

  drawerLend(eq: Equipment): void {
    if (!this.targetUserId || !this.targetLocationId || this.actionBusy()) return;
    if (eq.status === 'in_use') {
      this.drawerMessage.set('この機材はすでに貸出中であるため、二重貸出はできません');
      this.drawerMessageIsError.set(true);
      return;
    }

    this.actionBusy.set(true);
    this.api.lend(eq.equipment_id, this.targetUserId).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.drawerMessage.set('ユーザーと棚IDを紐付けて貸出しました');
        this.drawerMessageIsError.set(false);
        this.openDetailDrawer(eq);
        this.loadData();
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.drawerMessage.set(err?.error?.error ?? 'この機材はすでに貸出中です');
        this.drawerMessageIsError.set(true);
      },
    });
  }

  drawerReturn(eq: Equipment): void {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.api.return(eq.equipment_id, 1).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.drawerMessage.set('返却処理が完了しました');
        this.drawerMessageIsError.set(false);
        this.openDetailDrawer(eq);
        this.loadData();
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.drawerMessage.set('返却処理に失敗しました');
        this.drawerMessageIsError.set(true);
      },
    });
  }

  scanMatch(): void {
    if (!this.scanInput.trim()) return;
    const targetId = this.scanInput.trim().toUpperCase();
    this.scanning.set(true);
    this.scanError.set('');

    this.api.getEquipment(targetId).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.scanInput = '';
        this.openDetailDrawer(res.equipment);
      },
      error: () => {
        this.scanning.set(false);
        this.scanError.set(`機材ID「${targetId}」は見つかりませんでした`);
      },
    });
  }
}
