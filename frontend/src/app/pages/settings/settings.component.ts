import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import {
  CategoryMaster,
  DepartmentMaster,
  MasterService,
  ShelfMaster,
} from '../../core/master.service';
import { IconComponent } from '../../shared/icon.component';

type SettingsTab = 'all' | 'shelves' | 'departments' | 'categories';

/**
 * 保管場所・マスタ統合設定ページ (Edge-to-Edge フルキャンバスデザイン)
 * - 1. 保管場所（棚コード・部屋名・棚名）の登録・編集・削除・棚QRラベル印刷
 * - 2. 部署コード（部署ID）の登録・編集・削除
 * - 3. 機材カテゴリの登録・編集・削除
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <!-- 完全エッジ・トゥ・エッジ フルキャンバスコンテナ -->
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] md:min-h-screen flex flex-col bg-slate-100/80 text-slate-800 font-sans">
      <!-- トップ ヘッダーバー (Edge-to-Edge Seamless Header) -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-14 md:top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#2A3A4A] text-[#90CFD6] flex items-center justify-center shadow-xs shrink-0">
            <app-icon name="pin" class="text-lg" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-base font-bold text-[#2A3A4A] tracking-tight">
                保管場所・マスタ設定（棚コード ／ 部署コード ／ 機材カテゴリ）
              </h1>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A3A4A] text-[#90CFD6]">
                統合マスタ管理
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              機材の保管場所（棚コード・ラベル印刷）、自動採番用の部署コード（部署ID）、機材カテゴリを1ページで追加・編集・管理します
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="syncMasters()"
            class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs transition"
            [disabled]="syncing()"
          >
            <app-icon name="clock" />
            <span>{{ syncing() ? '同期中...' : 'Firestore同期' }}</span>
          </button>
        </div>
      </header>

      <!-- トースト通知 (Edge-to-Edge Banner) -->
      @if (toastMessage()) {
        <div
          class="px-4 md:px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b shrink-0"
          [class]="
            toastIsError()
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-emerald-900 text-white border-emerald-700'
          "
        >
          <div class="flex items-center gap-2">
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-[11px]"
              [class]="toastIsError() ? 'bg-rose-500' : 'bg-emerald-500'"
            >
              <app-icon [name]="toastIsError() ? 'close' : 'check'" />
            </span>
            <span>{{ toastMessage() }}</span>
          </div>
          <button type="button" (click)="toastMessage.set('')" class="opacity-80 hover:opacity-100">
            <app-icon name="close" />
          </button>
        </div>
      }

      <!-- KPI サマリーストリップ (Edge-to-Edge 4分割グリッド) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200 bg-white shrink-0">
        <div
          (click)="activeTab.set('shelves')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-white hover:bg-slate-50 cursor-pointer transition"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2A3A4A] text-[#90CFD6] font-bold text-base shrink-0">
            <app-icon name="shelf" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-slate-500">1. 保管場所 (棚コード)</div>
            <div class="font-mono text-lg font-extrabold text-[#2A3A4A] leading-tight">
              {{ master.shelves().length }} <span class="text-[10px] font-normal text-slate-500">箇所 (QRラベル対応)</span>
            </div>
          </div>
        </div>

        <div
          (click)="activeTab.set('departments')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-blue-50/30 hover:bg-blue-50/60 cursor-pointer transition"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white font-bold text-base shrink-0">
            <app-icon name="user" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-blue-900">2. 部署コード (部署ID)</div>
            <div class="font-mono text-lg font-extrabold text-blue-950 leading-tight">
              {{ master.departments().length }} <span class="text-[10px] font-normal text-slate-500">部署 (採番プレフィックス)</span>
            </div>
          </div>
        </div>

        <div
          (click)="activeTab.set('categories')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-emerald-50/30 hover:bg-emerald-50/60 cursor-pointer transition"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-base shrink-0">
            <app-icon name="box" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-emerald-900">3. 機材カテゴリ</div>
            <div class="font-mono text-lg font-extrabold text-emerald-950 leading-tight">
              {{ master.categories().length }} <span class="text-[10px] font-normal text-slate-500">種別 (付属品テンプレート連動)</span>
            </div>
          </div>
        </div>

        <div
          (click)="activeTab.set('all')"
          class="flex items-center gap-3 px-4 md:px-5 py-3 bg-amber-50/30 hover:bg-amber-50/60 cursor-pointer transition"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-base shrink-0">
            <app-icon name="key" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-amber-900">機材ID 自動採番ルール例</div>
            <div class="font-mono text-sm font-extrabold text-amber-950 leading-tight truncate">
              {{ sampleEquipmentId() }}
            </div>
          </div>
        </div>
      </div>

      <!-- タブ切替 ＆ 検索フィルターバー (Edge-to-Edge Subheader) -->
      <div class="border-b border-slate-200 bg-slate-50 px-4 md:px-6 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 shrink-0">
        <div class="inline-flex flex-wrap rounded-xl bg-slate-200/80 p-1 self-start">
          <button
            type="button"
            (click)="activeTab.set('all')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'all'
                ? 'bg-[#2A3A4A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="pin" />
            <span>すべて同時表示 (統合ビュー)</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('shelves')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'shelves'
                ? 'bg-[#2A3A4A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="shelf" />
            <span>1. 保管場所・棚コード ({{ master.shelves().length }})</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('departments')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'departments'
                ? 'bg-[#2A3A4A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="user" />
            <span>2. 部署コード ({{ master.departments().length }})</span>
          </button>
          <button
            type="button"
            (click)="activeTab.set('categories')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            [class]="
              activeTab() === 'categories'
                ? 'bg-[#2A3A4A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <app-icon name="box" />
            <span>3. 機材カテゴリ ({{ master.categories().length }})</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="search"
            [(ngModel)]="searchQuery"
            placeholder="コード・部屋名・部署名・カテゴリ名で検索..."
            class="w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
          />
          @if (searchQuery) {
            <button
              type="button"
              (click)="searchQuery = ''"
              class="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600"
            >
              クリア
            </button>
          }
        </div>
      </div>

      <!-- メイン エッジ・トゥ・エッジ コンテンツグリッド -->
      <div
        class="flex-1 grid grid-cols-1 divide-y xl:divide-y-0 xl:divide-x divide-slate-200 bg-white border-b border-slate-200"
        [class]="activeTab() === 'all' ? 'xl:grid-cols-3' : 'xl:grid-cols-1'"
      >
        <!-- =========================================================================
             セクション 1: 保管場所（棚コード・部屋名・棚名）マスタ
             ========================================================================= -->
        @if (activeTab() === 'all' || activeTab() === 'shelves') {
          <section class="flex flex-col min-w-0">
            <!-- セクションヘッダー -->
            <div class="px-4 md:px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2">
                  <app-icon name="shelf" />
                  <span>1. 保管場所 (棚コード) マスタ</span>
                </h2>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  部屋名・棚名と「棚コード」の登録・編集・棚QRラベル印刷
                </p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-[#2A3A4A] text-white font-mono text-xs font-bold">
                {{ filteredShelves().length }} 件
              </span>
            </div>

            <!-- 新規追加フォーム -->
            <form
              (ngSubmit)="addShelf()"
              class="p-4 md:px-5 bg-slate-50/40 border-b border-slate-200 space-y-2.5"
            >
              <div class="text-[11px] font-bold text-[#2A3A4A] flex items-center gap-1.5">
                <app-icon name="plus" />
                <span>新規保管場所 (棚コード) を追加</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    棚コード <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newShelfCode"
                    [(ngModel)]="newShelfCode"
                    placeholder="例: SHELF-A1"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    部屋名 <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newRoomName"
                    [(ngModel)]="newRoomName"
                    placeholder="例: 第1作画室"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    棚・ラック名 <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newShelfName"
                    [(ngModel)]="newShelfName"
                    placeholder="例: 機材棚A-1段目"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                class="w-full py-2 px-3 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <app-icon name="plus" />
                <span>保管場所 (棚コード) を追加</span>
              </button>
            </form>

            <!-- 登録済み一覧 (インライン編集対応) -->
            <div class="divide-y divide-slate-200 flex-1">
              @for (s of filteredShelves(); track s.code) {
                <div class="p-4 md:px-5 hover:bg-slate-50/70 transition">
                  @if (editingShelfOriginalCode() === s.code) {
                    <!-- 編集モード -->
                    <div class="space-y-2.5 rounded-xl bg-amber-50/70 border border-amber-300 p-3">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                          <app-icon name="edit" />
                          <span>保管場所「{{ s.code }}」を編集中</span>
                        </span>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">棚コード</label>
                          <input
                            type="text"
                            [(ngModel)]="editShelfForm.code"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">部屋名</label>
                          <input
                            type="text"
                            [(ngModel)]="editShelfForm.room_name"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">棚・ラック名</label>
                          <input
                            type="text"
                            [(ngModel)]="editShelfForm.shelf_name"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div class="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          (click)="cancelEditShelf()"
                          class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          (click)="saveEditShelf()"
                          class="px-3.5 py-1.5 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                        >
                          <app-icon name="check" />
                          <span>変更を保存</span>
                        </button>
                      </div>
                    </div>
                  } @else {
                    <!-- 通常表示モード -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div class="min-w-0 space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="inline-block rounded bg-[#2A3A4A] px-2 py-0.5 font-mono text-xs font-bold text-[#90CFD6]">
                            {{ s.code }}
                          </span>
                          <span class="text-xs font-extrabold text-slate-900">
                            {{ s.room_name }}
                          </span>
                          <span class="text-xs text-slate-600 font-medium">
                            ／ {{ s.shelf_name }}
                          </span>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                        <a
                          [routerLink]="['/print/shelf-label', s.code]"
                          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-[#2A3A4A] transition"
                        >
                          <app-icon name="printer" />
                          <span>棚ラベル印刷</span>
                        </a>
                        <button
                          type="button"
                          (click)="startEditShelf(s)"
                          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition"
                        >
                          <app-icon name="edit" />
                          <span>編集</span>
                        </button>
                        <button
                          type="button"
                          (click)="removeShelf(s)"
                          class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition"
                        >
                          <span>削除</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @empty {
                <div class="p-8 text-center text-xs text-slate-400">
                  該当する保管場所（棚コード）がありません。
                </div>
              }
            </div>
          </section>
        }

        <!-- =========================================================================
             セクション 2: 部署コード（部署ID）マスタ
             ========================================================================= -->
        @if (activeTab() === 'all' || activeTab() === 'departments') {
          <section class="flex flex-col min-w-0">
            <!-- セクションヘッダー -->
            <div class="px-4 md:px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2">
                  <app-icon name="user" />
                  <span>2. 部署コード (部署ID) マスタ</span>
                </h2>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  機材管理番号の先頭プレフィックス（例: DEV, ANIM, SALES）の登録・編集
                </p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-blue-700 text-white font-mono text-xs font-bold">
                {{ filteredDepartments().length }} 件
              </span>
            </div>

            <!-- 新規追加フォーム -->
            <form
              (ngSubmit)="addDepartment()"
              class="p-4 md:px-5 bg-slate-50/40 border-b border-slate-200 space-y-2.5"
            >
              <div class="text-[11px] font-bold text-[#2A3A4A] flex items-center gap-1.5">
                <app-icon name="plus" />
                <span>新規部署コードを追加</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    部署コード <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newDeptCode"
                    [(ngModel)]="newDeptCode"
                    placeholder="例: DEV"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    部署名 <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newDeptName"
                    [(ngModel)]="newDeptName"
                    placeholder="例: 開発部"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                class="w-full py-2 px-3 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <app-icon name="plus" />
                <span>部署コードを追加</span>
              </button>
            </form>

            <!-- 登録済み一覧 (インライン編集対応) -->
            <div class="divide-y divide-slate-200 flex-1">
              @for (d of filteredDepartments(); track d.code) {
                <div class="p-4 md:px-5 hover:bg-slate-50/70 transition">
                  @if (editingDeptOriginalCode() === d.code) {
                    <!-- 編集モード -->
                    <div class="space-y-2.5 rounded-xl bg-amber-50/70 border border-amber-300 p-3">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                          <app-icon name="edit" />
                          <span>部署「{{ d.code }}」を編集中</span>
                        </span>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">部署コード</label>
                          <input
                            type="text"
                            [(ngModel)]="editDeptForm.code"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">部署名</label>
                          <input
                            type="text"
                            [(ngModel)]="editDeptForm.name"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div class="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          (click)="cancelEditDept()"
                          class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          (click)="saveEditDept()"
                          class="px-3.5 py-1.5 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                        >
                          <app-icon name="check" />
                          <span>変更を保存</span>
                        </button>
                      </div>
                    </div>
                  } @else {
                    <!-- 通常表示モード -->
                    <div class="flex items-center justify-between gap-2.5">
                      <div class="min-w-0 flex flex-wrap items-center gap-2">
                        <span class="inline-block rounded bg-blue-50 border border-blue-200 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-900">
                          {{ d.code }}
                        </span>
                        <span class="text-xs font-extrabold text-slate-900">
                          {{ d.name }}
                        </span>
                        <span class="text-[10px] font-mono text-slate-400">
                          (例: {{ d.code }}-PC-00001)
                        </span>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          (click)="startEditDept(d)"
                          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition"
                        >
                          <app-icon name="edit" />
                          <span>編集</span>
                        </button>
                        <button
                          type="button"
                          (click)="removeDept(d)"
                          class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition"
                        >
                          <span>削除</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @empty {
                <div class="p-8 text-center text-xs text-slate-400">
                  該当する部署コードがありません。
                </div>
              }
            </div>
          </section>
        }

        <!-- =========================================================================
             セクション 3: 機材カテゴリマスタ
             ========================================================================= -->
        @if (activeTab() === 'all' || activeTab() === 'categories') {
          <section class="flex flex-col min-w-0">
            <!-- セクションヘッダー -->
            <div class="px-4 md:px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-extrabold text-[#2A3A4A] flex items-center gap-2">
                  <app-icon name="box" />
                  <span>3. 機材カテゴリマスタ</span>
                </h2>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  機材種別コード（例: PC, DSP, TAB, CAM）の登録・編集
                </p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold">
                {{ filteredCategories().length }} 件
              </span>
            </div>

            <!-- 新規追加フォーム -->
            <form
              (ngSubmit)="addCategory()"
              class="p-4 md:px-5 bg-slate-50/40 border-b border-slate-200 space-y-2.5"
            >
              <div class="text-[11px] font-bold text-[#2A3A4A] flex items-center gap-1.5">
                <app-icon name="plus" />
                <span>新規機材カテゴリを追加</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    カテゴリコード <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newCatCode"
                    [(ngModel)]="newCatCode"
                    placeholder="例: TAB"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600 mb-0.5">
                    カテゴリ名 <span class="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="newCatName"
                    [(ngModel)]="newCatName"
                    placeholder="例: ペンタブ・液タブ"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A3A4A]"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                class="w-full py-2 px-3 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <app-icon name="plus" />
                <span>機材カテゴリを追加</span>
              </button>
            </form>

            <!-- 登録済み一覧 (インライン編集対応) -->
            <div class="divide-y divide-slate-200 flex-1">
              @for (c of filteredCategories(); track c.code) {
                <div class="p-4 md:px-5 hover:bg-slate-50/70 transition">
                  @if (editingCatOriginalCode() === c.code) {
                    <!-- 編集モード -->
                    <div class="space-y-2.5 rounded-xl bg-amber-50/70 border border-amber-300 p-3">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                          <app-icon name="edit" />
                          <span>カテゴリ「{{ c.code }}」を編集中</span>
                        </span>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">カテゴリコード</label>
                          <input
                            type="text"
                            [(ngModel)]="editCatForm.code"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-bold text-slate-600 mb-0.5">カテゴリ名</label>
                          <input
                            type="text"
                            [(ngModel)]="editCatForm.name"
                            class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div class="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          (click)="cancelEditCat()"
                          class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          (click)="saveEditCat()"
                          class="px-3.5 py-1.5 rounded-lg bg-[#2A3A4A] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                        >
                          <app-icon name="check" />
                          <span>変更を保存</span>
                        </button>
                      </div>
                    </div>
                  } @else {
                    <!-- 通常表示モード -->
                    <div class="flex items-center justify-between gap-2.5">
                      <div class="min-w-0 flex flex-wrap items-center gap-2">
                        <span class="inline-block rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-900">
                          {{ c.code }}
                        </span>
                        <span class="text-xs font-extrabold text-slate-900">
                          {{ c.name }}
                        </span>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          (click)="startEditCat(c)"
                          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition"
                        >
                          <app-icon name="edit" />
                          <span>編集</span>
                        </button>
                        <button
                          type="button"
                          (click)="removeCat(c)"
                          class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition"
                        >
                          <span>削除</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @empty {
                <div class="p-8 text-center text-xs text-slate-400">
                  該当する機材カテゴリがありません。
                </div>
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(ApiService);
  readonly master = inject(MasterService);

  readonly activeTab = signal<SettingsTab>('all');
  readonly syncing = signal(false);
  readonly toastMessage = signal('');
  readonly toastIsError = signal(false);

  searchQuery = '';

  // 新規保管場所フォーム
  newShelfCode = '';
  newRoomName = '';
  newShelfName = '';

  // 新規部署フォーム
  newDeptCode = '';
  newDeptName = '';

  // 新規カテゴリフォーム
  newCatCode = '';
  newCatName = '';

  // 編集状態（保管場所）
  readonly editingShelfOriginalCode = signal<string | null>(null);
  editShelfForm: ShelfMaster = { code: '', room_name: '', shelf_name: '' };

  // 編集状態（部署）
  readonly editingDeptOriginalCode = signal<string | null>(null);
  editDeptForm: DepartmentMaster = { code: '', name: '' };

  // 編集状態（カテゴリ）
  readonly editingCatOriginalCode = signal<string | null>(null);
  editCatForm: CategoryMaster = { code: '', name: '' };

  readonly sampleEquipmentId = computed(() => {
    const dept = this.master.departments()[0]?.code || 'DEV';
    const cat = this.master.categories()[0]?.code || 'PC';
    return `${dept}-${cat}-00001`;
  });

  filteredShelves(): ShelfMaster[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.master.shelves();
    return this.master
      .shelves()
      .filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.room_name.toLowerCase().includes(q) ||
          s.shelf_name.toLowerCase().includes(q),
      );
  }

  filteredDepartments(): DepartmentMaster[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.master.departments();
    return this.master
      .departments()
      .filter((d) => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
  }

  filteredCategories(): CategoryMaster[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.master.categories();
    return this.master
      .categories()
      .filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }

  async syncMasters(): Promise<void> {
    this.syncing.set(true);
    try {
      await this.master.refresh();
      this.showToast('Firestore から最新の保管場所・部署・カテゴリマスタを同期しました', false);
    } finally {
      this.syncing.set(false);
    }
  }

  // --- 1. 保管場所（棚コード）操作 ---

  addShelf(): void {
    if (!this.newShelfCode.trim() || !this.newRoomName.trim() || !this.newShelfName.trim()) {
      this.showToast('棚コード・部屋名・棚名のすべてを入力してください', true);
      return;
    }
    try {
      const code = this.newShelfCode.toUpperCase().trim();
      const room = this.newRoomName.trim();
      const shelf = this.newShelfName.trim();
      this.master.addShelf({ code, room_name: room, shelf_name: shelf });
      this.api.createLocation(room, `${code} (${shelf})`).subscribe();
      this.newShelfCode = '';
      this.newRoomName = '';
      this.newShelfName = '';
      this.showToast(`保管場所「${code} (${room} / ${shelf})」を追加しました`, false);
    } catch (err: any) {
      this.showToast(err?.message ?? '保管場所の追加に失敗しました', true);
    }
  }

  startEditShelf(s: ShelfMaster): void {
    this.editingShelfOriginalCode.set(s.code);
    this.editShelfForm = { ...s };
  }

  cancelEditShelf(): void {
    this.editingShelfOriginalCode.set(null);
  }

  saveEditShelf(): void {
    const orig = this.editingShelfOriginalCode();
    if (!orig) return;
    try {
      this.master.updateShelf(orig, this.editShelfForm);
      this.editingShelfOriginalCode.set(null);
      this.showToast(
        `保管場所「${this.editShelfForm.code.toUpperCase().trim()}」の設定を更新しました`,
        false,
      );
    } catch (err: any) {
      this.showToast(err?.message ?? '保管場所の更新に失敗しました', true);
    }
  }

  removeShelf(s: ShelfMaster): void {
    if (!confirm(`保管場所「${s.code} — ${s.room_name} / ${s.shelf_name}」を削除しますか？`)) return;
    this.master.removeShelf(s.code);
    this.showToast(`保管場所「${s.code}」を削除しました`, false);
  }

  // --- 2. 部署コード操作 ---

  addDepartment(): void {
    if (!this.newDeptCode.trim() || !this.newDeptName.trim()) {
      this.showToast('部署コードと部署名を入力してください', true);
      return;
    }
    try {
      const code = this.newDeptCode.toUpperCase().trim();
      const name = this.newDeptName.trim();
      this.master.addDepartment({ code, name });
      this.newDeptCode = '';
      this.newDeptName = '';
      this.showToast(`部署コード「${code} — ${name}」を追加しました`, false);
    } catch (err: any) {
      this.showToast(err?.message ?? '部署の追加に失敗しました', true);
    }
  }

  startEditDept(d: DepartmentMaster): void {
    this.editingDeptOriginalCode.set(d.code);
    this.editDeptForm = { ...d };
  }

  cancelEditDept(): void {
    this.editingDeptOriginalCode.set(null);
  }

  saveEditDept(): void {
    const orig = this.editingDeptOriginalCode();
    if (!orig) return;
    try {
      this.master.updateDepartment(orig, this.editDeptForm);
      this.editingDeptOriginalCode.set(null);
      this.showToast(
        `部署コード「${this.editDeptForm.code.toUpperCase().trim()} — ${this.editDeptForm.name.trim()}」を更新しました`,
        false,
      );
    } catch (err: any) {
      this.showToast(err?.message ?? '部署の更新に失敗しました', true);
    }
  }

  removeDept(d: DepartmentMaster): void {
    if (!confirm(`部署「${d.code} — ${d.name}」を削除しますか？`)) return;
    this.master.removeDepartment(d.code);
    this.showToast(`部署「${d.code}」を削除しました`, false);
  }

  // --- 3. 機材カテゴリ操作 ---

  addCategory(): void {
    if (!this.newCatCode.trim() || !this.newCatName.trim()) {
      this.showToast('カテゴリコードとカテゴリ名を入力してください', true);
      return;
    }
    try {
      const code = this.newCatCode.toUpperCase().trim();
      const name = this.newCatName.trim();
      this.master.addCategory({ code, name });
      this.newCatCode = '';
      this.newCatName = '';
      this.showToast(`機材カテゴリ「${code} — ${name}」を追加しました`, false);
    } catch (err: any) {
      this.showToast(err?.message ?? 'カテゴリの追加に失敗しました', true);
    }
  }

  startEditCat(c: CategoryMaster): void {
    this.editingCatOriginalCode.set(c.code);
    this.editCatForm = { ...c };
  }

  cancelEditCat(): void {
    this.editingCatOriginalCode.set(null);
  }

  saveEditCat(): void {
    const orig = this.editingCatOriginalCode();
    if (!orig) return;
    try {
      this.master.updateCategory(orig, this.editCatForm);
      this.editingCatOriginalCode.set(null);
      this.showToast(
        `機材カテゴリ「${this.editCatForm.code.toUpperCase().trim()} — ${this.editCatForm.name.trim()}」を更新しました`,
        false,
      );
    } catch (err: any) {
      this.showToast(err?.message ?? 'カテゴリの更新に失敗しました', true);
    }
  }

  removeCat(c: CategoryMaster): void {
    if (!confirm(`カテゴリ「${c.code} — ${c.name}」を削除しますか？`)) return;
    this.master.removeCategory(c.code);
    this.showToast(`カテゴリ「${c.code}」を削除しました`, false);
  }

  private showToast(msg: string, isError: boolean): void {
    this.toastMessage.set(msg);
    this.toastIsError.set(isError);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set('');
      }
    }, 4500);
  }
}
