import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { WorkRequestService } from '../../core/work-request.service';
import {
  WorkRequest,
  WorkRequestType,
  WorkRequestStatus,
  WORK_TYPE_CONFIG,
  WORK_STATUS_DISPLAY,
  LEAVE_TYPE_LABELS,
} from '../../core/work-request.model';
import { IconComponent } from '../../shared/icon.component';

type FilterType = 'all' | WorkRequestType | 'pending_manager' | 'pending_admin';

@Component({
  selector: 'app-work-request',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <!-- エッジ・トゥ・エッジ フルキャンバスコンテナ -->
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] flex flex-col bg-slate-100/80 text-slate-800 font-sans">
      
      <!-- トップ ヘッダーバー -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
            <app-icon name="clock" class="text-lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-bold text-slate-900 tracking-tight">アニメ制作 業務申請ワークスペース</h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                勤怠管理連携
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              休日出勤・休暇・残業申請（①申請者 ➔ ②上長許諾 ➔ ③総務勤怠管理連携）
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-indigo-500/20 transition-all duration-200 active:scale-95"
          >
            <span class="text-base leading-none font-normal">+</span>
            <span>新規業務申請を作成</span>
          </button>
        </div>
      </header>

      <!-- メイン 2カラム スプリットビュー -->
      <div class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        <!-- 左サイドペイン: 業務申請一覧ナビゲーション -->
        <aside class="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col shrink-0">
          <!-- フィルタータブエリア -->
          <div class="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                <span>申請一覧</span>
                <span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {{ filteredRequests().length }}
                </span>
              </span>

              <!-- 総務連携待ちの警告バッジ -->
              @if (pendingAdminCount() > 0) {
                <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-300 rounded-full animate-pulse">
                  <span>📢 総務未受領</span>
                  <span>{{ pendingAdminCount() }}件</span>
                </span>
              }
            </div>

            <!-- クイックフィルターボタン -->
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                (click)="setFilter('all')"
                [class.bg-indigo-600]="activeFilter() === 'all'"
                [class.text-white]="activeFilter() === 'all'"
                [class.bg-white]="activeFilter() !== 'all'"
                [class.text-slate-600]="activeFilter() !== 'all'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                全件
              </button>
              <button
                type="button"
                (click)="setFilter('holiday_work')"
                [class.bg-amber-600]="activeFilter() === 'holiday_work'"
                [class.text-white]="activeFilter() === 'holiday_work'"
                [class.bg-white]="activeFilter() !== 'holiday_work'"
                [class.text-slate-600]="activeFilter() !== 'holiday_work'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                🌅 休日出勤
              </button>
              <button
                type="button"
                (click)="setFilter('leave')"
                [class.bg-emerald-600]="activeFilter() === 'leave'"
                [class.text-white]="activeFilter() === 'leave'"
                [class.bg-white]="activeFilter() !== 'leave'"
                [class.text-slate-600]="activeFilter() !== 'leave'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                🌴 休暇
              </button>
              <button
                type="button"
                (click)="setFilter('overtime')"
                [class.bg-indigo-600]="activeFilter() === 'overtime'"
                [class.text-white]="activeFilter() === 'overtime'"
                [class.bg-white]="activeFilter() !== 'overtime'"
                [class.text-slate-600]="activeFilter() !== 'overtime'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                ⏱️ 残業
              </button>
              <button
                type="button"
                (click)="setFilter('pending_admin')"
                [class.bg-blue-600]="activeFilter() === 'pending_admin'"
                [class.text-white]="activeFilter() === 'pending_admin'"
                [class.bg-white]="activeFilter() !== 'pending_admin'"
                [class.text-slate-600]="activeFilter() !== 'pending_admin'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                📢 総務受領待ち
              </button>
            </div>
          </div>

          <!-- スクロール可能な一覧エリア -->
          <div class="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[35vh] lg:max-h-none bg-slate-50/30">
            @for (req of filteredRequests(); track req.id) {
              <div
                (click)="selectRequest(req)"
                [class.bg-indigo-50/70]="selectedRequest()?.id === req.id"
                [class.border-indigo-500]="selectedRequest()?.id === req.id"
                [class.shadow-md]="selectedRequest()?.id === req.id"
                [class.bg-slate-100/70]="req.status === 'admin_confirmed' && selectedRequest()?.id !== req.id"
                [class.border-slate-200]="selectedRequest()?.id !== req.id"
                class="group p-3 rounded-xl border bg-white hover:border-indigo-300 hover:shadow-xs cursor-pointer transition-all duration-150 relative overflow-hidden"
              >
                <!-- アクティブインジケータ -->
                @if (selectedRequest()?.id === req.id) {
                  <div class="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                }

                <div class="flex justify-between items-start mb-1.5 gap-2">
                  <div class="flex items-center gap-1.5">
                    <!-- 申請種別バッジ -->
                    <span
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                      [ngClass]="typeConfig(req.request_type).badgeClass"
                    >
                      {{ typeConfig(req.request_type).iconEmoji }} {{ typeConfig(req.request_type).label }}
                    </span>
                    <span class="text-[10px] font-mono text-slate-400">{{ req.id }}</span>
                  </div>

                  <!-- ステータスバッジ -->
                  <span
                    class="text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                    [ngClass]="statusDisplay(req.status).colorClass"
                  >
                    {{ statusDisplay(req.status).shortLabel }}
                  </span>
                </div>

                <h3
                  class="text-xs font-bold line-clamp-2 leading-snug mb-1"
                  [class.text-slate-800]="selectedRequest()?.id === req.id || req.status !== 'admin_confirmed'"
                  [class.text-slate-600]="req.status === 'admin_confirmed' && selectedRequest()?.id !== req.id"
                  [class.group-hover:text-indigo-700]="selectedRequest()?.id !== req.id"
                >
                  {{ req.title }}
                </h3>

                <!-- 作品名 ＆ 工程バッジ -->
                <div class="mb-1.5 flex flex-wrap items-center gap-1">
                  <span class="text-[9.5px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[150px]">
                    {{ req.anime_project }}
                  </span>
                  <span class="text-[9px] text-slate-500 font-mono">
                    {{ req.episode_or_process }}
                  </span>
                </div>

                <div class="text-[11px] text-slate-500 flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <span class="flex items-center gap-1.5 truncate">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span class="font-medium text-slate-700">{{ req.applicant_name }}</span>
                    <span class="text-[10px] text-slate-400">({{ req.applicant_role || req.applicant_department }})</span>
                  </span>
                  <span class="text-[10px] font-mono text-slate-400 shrink-0">
                    対象: {{ req.target_date }}
                  </span>
                </div>
              </div>
            } @empty {
              <div class="p-8 text-center text-slate-400 text-xs">
                該当する業務申請はありません。
              </div>
            }
          </div>
        </aside>

        <!-- 右メインペイン: 業務申請プレビュー ＆ 承認キャンバス -->
        <main class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 flex flex-col items-center">
          @if (selectedRequest(); as req) {
            <div class="w-full space-y-3.5 max-w-4xl">
              
              <!-- 統合された 承認進捗 ＆ アクションカード -->
              <div class="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                <!-- ヘッダー -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 class="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <span>承認・勤怠連携フロー (ワークフロー進捗)</span>
                    </h3>
                    <div class="mt-1 flex items-center gap-2">
                      <span
                        class="text-xs font-bold px-2 py-0.5 rounded-full border"
                        [ngClass]="statusDisplay(req.status).colorClass"
                      >
                        {{ statusDisplay(req.status).label }}
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <!-- ① 申請者提出 (submitted) のみ編集可能 -->
                    @if (req.status === 'submitted') {
                      <button
                        type="button"
                        (click)="openEditModal(req)"
                        class="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3 py-2 rounded-lg transition active:scale-95 shadow-xs"
                      >
                        <span>✏️</span>
                        <span>申請内容を編集</span>
                      </button>
                    } @else {
                      <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                        <span>🔒</span>
                        <span>{{ req.status === 'admin_confirmed' ? '勤怠反映完了（ロック）' : '上長許諾済（ロック）' }}</span>
                      </span>
                    }

                    <!-- 上長承認ボタン (submitted 時) -->
                    @if (req.status === 'submitted') {
                      <button
                        type="button"
                        (click)="approveAsManager(req)"
                        class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm shadow-indigo-600/20 transition active:scale-95"
                      >
                        <span>✓</span>
                        <span>上長として許諾する</span>
                      </button>

                      <button
                        type="button"
                        (click)="openRejectModal(req)"
                        class="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs px-3 py-2 rounded-lg transition active:scale-95"
                      >
                        <span>✕</span>
                        <span>差戻し</span>
                      </button>
                    }

                    <!-- 総務受領・勤怠反映ボタン (manager_approved 時) -->
                    @if (req.status === 'manager_approved') {
                      <button
                        type="button"
                        (click)="openAdminConfirmModal(req)"
                        class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm shadow-emerald-600/20 transition active:scale-95 animate-pulse"
                      >
                        <span>🏢</span>
                        <span>総務受領・勤怠システムへ反映</span>
                      </button>
                    }

                    <!-- PDFダイレクトダウンロードボタン -->
                    <button
                      type="button"
                      (click)="downloadPDF()"
                      [disabled]="isGeneratingPDF()"
                      class="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition active:scale-95 disabled:opacity-50"
                    >
                      @if (isGeneratingPDF()) {
                        <span class="animate-spin text-sm">🌀</span>
                        <span>PDF生成中...</span>
                      } @else {
                        <app-icon name="doc" class="text-sm text-white" />
                        <span>PDFダウンロード</span>
                      }
                    </button>
                  </div>
                </div>

                <!-- 水平ステッパー UI (3段階) -->
                <div class="stepper-horizontal pt-1">
                  @for (step of req.timeline; track step.id; let idx = $index) {
                    <div
                      class="stepper-item"
                      [class.completed]="step.completed"
                      [class.active]="step.current"
                    >
                      <!-- アイコン -->
                      <div class="stepper-icon">
                        @if (step.completed) {
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        } @else {
                          <span>{{ idx + 1 }}</span>
                        }
                      </div>

                      <!-- タイトル & サブタイトル -->
                      <div class="stepper-title">{{ step.title }}</div>
                      <div class="stepper-subtitle">
                        @if (step.completed) {
                          <span class="text-emerald-700 font-bold">{{ step.approverName }}</span>
                        } @else if (step.current) {
                          <span class="text-indigo-600 font-bold">対応待ち</span>
                        } @else {
                          <span class="text-slate-400">未到達</span>
                        }
                      </div>

                      <div class="stepper-time">
                        @if (step.updatedAt) {
                          {{ step.updatedAt }}
                        } @else if (step.current) {
                          審査・確認中
                        } @else {
                          -
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- 【総務連絡連携ハイライトカード】 -->
                @if (req.status === 'manager_approved') {
                  <div class="p-3.5 rounded-xl bg-blue-50/90 border-2 border-blue-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div class="flex items-start gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 text-base font-bold">
                        📢
                      </div>
                      <div>
                        <h4 class="text-xs font-bold text-blue-900">
                          【総務連絡】上長による許諾が完了しました。総務部（勤怠管理）へ連絡が届いています。
                        </h4>
                        <p class="text-[11px] text-blue-700 mt-0.5">
                          勤怠管理担当者は内容を確認の上、タイムカード／36協定管理／代休有給台帳へ登録し、下記の「総務受領・勤怠システムへ反映」を実行してください。
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="openAdminConfirmModal(req)"
                      class="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition"
                    >
                      受領・反映手続きへ
                    </button>
                  </div>
                } @else if (req.status === 'admin_confirmed') {
                  <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
                    <div class="text-emerald-600 font-bold text-sm shrink-0">✅</div>
                    <div class="flex-1">
                      <div class="font-bold flex items-center gap-2">
                        <span>総務部 勤怠システム反映完了</span>
                        <span class="text-[10px] text-emerald-700 font-mono font-normal">({{ req.confirmed_at }} / 担当: {{ req.confirmed_by }})</span>
                      </div>
                      <p class="text-[11px] text-emerald-800 mt-0.5">
                        {{ req.general_affairs_note }}
                      </p>
                    </div>
                  </div>
                } @else if (req.status === 'rejected') {
                  <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                    <div class="text-rose-600 font-bold text-sm shrink-0">✕</div>
                    <div>
                      <div class="font-bold">申請は差戻しされました</div>
                      <p class="text-[11px] text-rose-800 mt-0.5">
                        理由: {{ req.rejection_reason || '記載なし' }}
                      </p>
                    </div>
                  </div>
                }
              </div>

              <!-- 業務申請書 プレビュー用紙 (A4完全対応・スタイリッシュレイアウト) -->
              <div id="print-area" class="bg-white text-slate-900 rounded-xl shadow-md p-5 sm:p-7 space-y-3.5 border border-slate-200">
                <!-- ドキュメントヘッダー -->
                <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <h1 class="text-xl sm:text-2xl font-bold tracking-[0.25em] text-slate-900 leading-none mb-0.5">
                        業務申請書
                      </h1>
                      <span
                        class="text-[11px] font-bold px-2 py-0.5 rounded border leading-none"
                        [ngClass]="typeConfig(req.request_type).badgeClass"
                      >
                        {{ typeConfig(req.request_type).label }}
                      </span>
                    </div>
                    <p class="text-[9px] tracking-widest text-slate-400 uppercase font-mono mt-1">
                      WORK REQUEST FORM (ANIMATION PRODUCTION)
                    </p>
                  </div>
                  <div class="text-right text-[11px] text-slate-600 space-y-0.2">
                    <p>管理番号：<span class="font-mono font-bold">{{ req.id }}</span></p>
                    <p>申請日：{{ req.created_at }}</p>
                  </div>
                </div>

                <!-- 申請者情報 ＆ 印影欄 -->
                <div class="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div class="w-full md:w-1/2 space-y-1.5 pt-0.5">
                    <div class="flex items-center text-xs">
                      <span class="w-24 font-bold text-slate-500">所属部門</span>
                      <span class="font-medium text-slate-900">{{ req.applicant_department }}</span>
                    </div>
                    <div class="flex items-center text-xs">
                      <span class="w-24 font-bold text-slate-500">役職・職種</span>
                      <span class="font-medium text-slate-900">{{ req.applicant_role || 'スタッフ' }}</span>
                    </div>
                    <div class="flex items-center text-xs">
                      <span class="w-24 font-bold text-slate-500">申請者氏名</span>
                      <span class="font-bold text-slate-900 text-sm">{{ req.applicant_name }}</span>
                    </div>
                    @if (req.emergency_contact) {
                      <div class="flex items-center text-xs">
                        <span class="w-24 font-bold text-slate-500">緊急連絡先</span>
                        <span class="text-slate-700 text-xs font-mono">{{ req.emergency_contact }}</span>
                      </div>
                    }
                  </div>

                  <!-- デジタル認印（二重丸朱色印 3連枠: 総務 / 上長 / 提出者） -->
                  <div class="flex border border-slate-900 rounded overflow-hidden shadow-xs shrink-0">
                    @for (stamp of req.stamps; track stamp.roleLabel) {
                      <div class="w-[72px] h-[68px] border-r border-slate-900 last:border-r-0 flex flex-col items-center justify-between py-0.5 shrink-0 bg-white">
                        <div class="w-full text-center text-[8.5px] bg-slate-100 py-0.5 font-bold border-b border-slate-900 text-slate-700 whitespace-nowrap px-0.5 tracking-tighter">
                          {{ stamp.roleLabel }}
                        </div>

                        <div class="flex-grow flex items-center justify-center w-full p-0.5">
                          @if (stamp.completed) {
                            <div class="w-[44px] h-[44px] border-[2.5px] border-double border-[#e60012] rounded-full text-[#e60012] font-serif flex items-center justify-center select-none mix-blend-multiply">
                              <div class="w-full h-full flex flex-col items-center justify-center leading-none p-[1px]">
                                <div class="text-[6.5px] scale-90 font-bold tracking-tighter truncate max-w-[40px]">
                                  {{ stamp.roleLabel }}
                                </div>
                                <div class="text-[6px] border-y border-[#e60012] w-[92%] text-center py-[0.5px] my-[0.5px] font-mono font-bold tracking-tighter leading-tight whitespace-nowrap">
                                  {{ stamp.approvedDate }}
                                </div>
                                <div class="text-[8.5px] font-bold tracking-tight">
                                  {{ stamp.approverName }}
                                </div>
                              </div>
                            </div>
                          } @else {
                            <span class="text-[8.5px] text-slate-300">未印</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- 件名 -->
                <div>
                  <div class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">Subject / 申請件名</div>
                  <div class="text-sm font-bold border-l-4 border-indigo-600 pl-3 py-1.5 bg-slate-50 text-slate-900 rounded-r">
                    {{ req.title }}
                  </div>
                </div>

                <!-- アニメ制作現場コンテキスト ＆ 勤務詳細テーブル -->
                <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div class="bg-slate-100/80 px-3 py-2 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                    <span>【アニメ制作 業務・日程詳細】</span>
                    <span class="text-[10px] text-slate-500 font-normal">担当作品・工程・勤務予定</span>
                  </div>

                  <div class="p-3 bg-white space-y-2.5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <!-- 担当作品名 -->
                      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">担当作品名（プロジェクト）</div>
                        <div class="text-xs font-bold text-slate-900">{{ req.anime_project }}</div>
                      </div>

                      <!-- 担当話数・工程 -->
                      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">担当話数 / 制作工程</div>
                        <div class="text-xs font-bold text-indigo-800">{{ req.episode_or_process }}</div>
                      </div>
                    </div>

                    <!-- 申請種別に応じた詳細情報 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <!-- 対象日 -->
                      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">対象予定日</div>
                        <div class="text-xs font-bold text-slate-900 font-mono">
                          {{ req.target_date }}
                          @if (req.target_end_date) {
                            〜 {{ req.target_end_date }}
                          }
                        </div>
                      </div>

                      <!-- 時間帯 / 予定時間数 -->
                      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">予定時間帯 / 時間数</div>
                        <div class="text-xs font-bold text-slate-900">
                          @if (req.time_range) {
                            <span>{{ req.time_range }}</span>
                          }
                          @if (req.hours_estimated) {
                            <span class="ml-1 text-indigo-700">({{ req.hours_estimated }}時間)</span>
                          }
                        </div>
                      </div>

                      <!-- 振替休日 / 休暇区分 / 深夜残業 -->
                      <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        @if (req.request_type === 'holiday_work') {
                          <div class="text-[10px] font-bold text-amber-700 mb-0.5">振替休日（代休）予定日</div>
                          <div class="text-xs font-bold text-slate-900 font-mono">
                            {{ req.substitute_date || '未定（後日申請）' }}
                          </div>
                        } @else if (req.request_type === 'leave') {
                          <div class="text-[10px] font-bold text-emerald-700 mb-0.5">休暇区分 / 取得単位</div>
                          <div class="text-xs font-bold text-slate-900">
                            {{ getLeaveLabel(req.leave_type) }} ({{ req.leave_unit === 'half_am' ? '午前半休' : req.leave_unit === 'half_pm' ? '午後半休' : '全日休' }})
                          </div>
                        } @else if (req.request_type === 'overtime') {
                          <div class="text-[10px] font-bold text-indigo-700 mb-0.5">深夜残業 (22時以降)</div>
                          <div class="text-xs font-bold" [class.text-rose-600]="req.has_midnight_overtime" [class.text-slate-600]="!req.has_midnight_overtime">
                            {{ req.has_midnight_overtime ? 'あり（深夜割増対象）' : 'なし' }}
                          </div>
                        }
                      </div>
                    </div>

                    @if (req.deadline_date) {
                      <div class="text-[11px] text-slate-600 flex items-center gap-1.5 px-1">
                        <span class="font-bold text-slate-500">関連締切・納品日:</span>
                        <span class="font-mono font-bold text-rose-600">{{ req.deadline_date }}</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- 申請事由・業務内容詳細 -->
                <div>
                  <div class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Reason / 申請事由・具体的業務内容</div>
                  <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {{ req.reason_detail }}
                  </div>
                </div>

                <!-- 総務労務管理欄 (勤怠システム反映記録) -->
                <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div class="bg-slate-100/80 px-3 py-1.5 font-bold text-slate-600 border-b border-slate-200 text-[10.5px] flex items-center justify-between">
                    <span>【総務部 勤怠管理・労務記録欄】</span>
                    <span>36協定・代休有休台帳連携</span>
                  </div>
                  <div class="p-3 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div class="text-[9.5px] font-bold text-slate-400">総務受領ステータス</div>
                      <div class="font-bold text-xs mt-0.5">
                        @if (req.status === 'admin_confirmed') {
                          <span class="text-emerald-700">● 勤怠システム反映済</span>
                        } @else if (req.status === 'manager_approved') {
                          <span class="text-blue-600">● 総務連絡受領中 (未反映)</span>
                        } @else {
                          <span class="text-slate-400">○ 上長確認中</span>
                        }
                      </div>
                    </div>
                    <div>
                      <div class="text-[9.5px] font-bold text-slate-400">総務受付担当者</div>
                      <div class="font-medium text-xs mt-0.5 text-slate-800">
                        {{ req.confirmed_by || '—' }}
                      </div>
                    </div>
                    <div>
                      <div class="text-[9.5px] font-bold text-slate-400">勤怠反映日時</div>
                      <div class="font-mono text-xs mt-0.5 text-slate-800">
                        {{ req.confirmed_at || '—' }}
                      </div>
                    </div>
                  </div>
                  @if (req.general_affairs_note) {
                    <div class="px-3 pb-2.5 pt-0 bg-white border-t border-slate-100">
                      <div class="text-[9.5px] font-bold text-slate-400 mb-0.5">総務連絡・労務メモ:</div>
                      <div class="text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                        {{ req.general_affairs_note }}
                      </div>
                    </div>
                  }
                </div>

                <!-- 用紙フッター -->
                <div class="pt-2 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
                  <span>++HERON.. ANIMATION STUDIO ATTENDANCE SYSTEM</span>
                  <span>PAGE 1 OF 1</span>
                </div>
              </div>
            </div>
          } @else {
            <div class="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div class="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 text-3xl mb-3">
                ⏱️
              </div>
              <h3 class="text-sm font-bold text-slate-600">申請が選択されていません</h3>
              <p class="text-xs text-slate-400 mt-1">左側の一覧から業務申請を選択するか、新規申請を作成してください。</p>
            </div>
          }
        </main>
      </div>

      <!-- 新規申請 / 編集モーダル -->
      @if (showFormModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 my-8">
            <!-- モーダルヘッダー -->
            <div class="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-slate-900">
                  {{ isEditing() ? '業務申請の内容を編集' : '新規業務申請の起案' }}
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">
                  アニメ制作現場の勤務予定・申請内容を入力してください。
                </p>
              </div>
              <button
                type="button"
                (click)="closeFormModal()"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                ✕
              </button>
            </div>

            <!-- 申請種別タブ（新規作成時） -->
            @if (!isEditing()) {
              <div class="px-6 pt-4 pb-2 bg-slate-50/50 border-b border-slate-200">
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">申請種別の選択</div>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    (click)="formData.request_type = 'holiday_work'"
                    [class.border-amber-500]="formData.request_type === 'holiday_work'"
                    [class.bg-amber-50]="formData.request_type === 'holiday_work'"
                    class="p-2.5 rounded-xl border border-slate-200 text-center transition flex flex-col items-center"
                  >
                    <span class="text-xl">🌅</span>
                    <span class="text-xs font-bold text-slate-800 mt-1">休日出勤申請</span>
                    <span class="text-[9.5px] text-slate-500 scale-90">土日祝出勤・代休指定</span>
                  </button>

                  <button
                    type="button"
                    (click)="formData.request_type = 'leave'"
                    [class.border-emerald-500]="formData.request_type === 'leave'"
                    [class.bg-emerald-50]="formData.request_type === 'leave'"
                    class="p-2.5 rounded-xl border border-slate-200 text-center transition flex flex-col items-center"
                  >
                    <span class="text-xl">🌴</span>
                    <span class="text-xs font-bold text-slate-800 mt-1">休暇申請</span>
                    <span class="text-[9.5px] text-slate-500 scale-90">有休・代休・半休</span>
                  </button>

                  <button
                    type="button"
                    (click)="formData.request_type = 'overtime'"
                    [class.border-indigo-500]="formData.request_type === 'overtime'"
                    [class.bg-indigo-50]="formData.request_type === 'overtime'"
                    class="p-2.5 rounded-xl border border-slate-200 text-center transition flex flex-col items-center"
                  >
                    <span class="text-xl">⏱️</span>
                    <span class="text-xs font-bold text-slate-800 mt-1">残業申請</span>
                    <span class="text-[9.5px] text-slate-500 scale-90">時間外・深夜残業</span>
                  </button>
                </div>
              </div>
            }

            <!-- フォーム入力エリア -->
            <form (ngSubmit)="submitForm()" class="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <!-- 件名 -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  申請件名 <span class="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  [(ngModel)]="formData.title"
                  name="title"
                  required
                  placeholder="例: 第7話 カッティング出し準備に伴う休日出勤申請"
                  class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <!-- 申請者情報 -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    申請者氏名 <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.applicant_name"
                    name="applicant_name"
                    required
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    所属部門 <span class="text-rose-500">*</span>
                  </label>
                  <select
                    [(ngModel)]="formData.applicant_department"
                    name="applicant_department"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="制作部">制作部</option>
                    <option value="作画部">作画部</option>
                    <option value="仕上部">仕上部</option>
                    <option value="美術部">美術部</option>
                    <option value="CG・撮影部">CG・撮影部</option>
                    <option value="演出部">演出部</option>
                    <option value="総務部">総務部</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    役職・担当職種
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.applicant_role"
                    name="applicant_role"
                    placeholder="例: 制作進行, 原画マン, 作監"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <!-- アニメ現場情報: 作品名・話数/工程 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    担当作品名（プロジェクト） <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.anime_project"
                    name="anime_project"
                    required
                    placeholder="例: 『HERON: THE ANIMATION 第2期』"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    担当話数 / 制作工程 <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.episode_or_process"
                    name="episode_or_process"
                    required
                    placeholder="例: #07 作画回収・カッティング出し準備"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <!-- 日時設定 -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    対象年月日 <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="formData.target_date"
                    name="target_date"
                    required
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    予定時間帯
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.time_range"
                    name="time_range"
                    placeholder="例: 10:00 〜 19:00"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    予定時間数 (時間)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    [(ngModel)]="formData.hours_estimated"
                    name="hours_estimated"
                    placeholder="例: 8 または 3.5"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <!-- 種別ごとの個別項目 -->
              @if (formData.request_type === 'holiday_work') {
                <div class="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <label class="block text-xs font-bold text-amber-900 mb-1">
                    振替休日（代休）取得予定日
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="formData.substitute_date"
                    name="substitute_date"
                    class="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <p class="text-[10px] text-amber-700 mt-1">※未定の場合は空欄でも構いません（後日申請可能）</p>
                </div>
              } @else if (formData.request_type === 'leave') {
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div>
                    <label class="block text-xs font-bold text-emerald-900 mb-1">休暇区分</label>
                    <select
                      [(ngModel)]="formData.leave_type"
                      name="leave_type"
                      class="w-full text-xs px-3 py-2 border border-emerald-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="annual">年次有給休暇</option>
                      <option value="substitute">振替休日（代休）</option>
                      <option value="special">特別休暇</option>
                      <option value="condolence">慶弔休暇</option>
                      <option value="absence">欠勤・私傷病</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-emerald-900 mb-1">取得単位</label>
                    <select
                      [(ngModel)]="formData.leave_unit"
                      name="leave_unit"
                      class="w-full text-xs px-3 py-2 border border-emerald-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="full_day">全日休（1日）</option>
                      <option value="half_am">午前半休</option>
                      <option value="half_pm">午後半休</option>
                    </select>
                  </div>
                </div>
              } @else if (formData.request_type === 'overtime') {
                <div class="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="formData.has_midnight_overtime"
                      name="has_midnight_overtime"
                      class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span class="text-xs font-bold text-indigo-900">22:00以降の深夜残業を含む</span>
                  </label>
                  <p class="text-[10px] text-indigo-700 mt-1">※深夜労働割増および健康管理チェックの対象となります</p>
                </div>
              }

              <!-- 理由・業務詳細 -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  申請事由・具体的業務内容 <span class="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  [(ngModel)]="formData.reason_detail"
                  name="reason_detail"
                  required
                  placeholder="理由や業務内容、カット番号、回収予定などを入力してください。"
                  class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                ></textarea>
              </div>

              <!-- 緊急連絡先 ＆ 締切日 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    緊急連絡先（電話 / 社内チャット）
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.emergency_contact"
                    name="emergency_contact"
                    placeholder="例: 090-xxxx-xxxx / Slack @name"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    関連締切日・納品日
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="formData.deadline_date"
                    name="deadline_date"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <!-- フッターアクション -->
              <div class="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  (click)="closeFormModal()"
                  class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  class="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition active:scale-95"
                >
                  {{ isEditing() ? '変更を保存する' : '申請を提出する' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- 総務受領・勤怠反映モーダル -->
      @if (showAdminModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div class="px-6 py-4 border-b border-slate-200 bg-emerald-50 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xl">🏢</span>
                <h3 class="text-base font-bold text-emerald-950">総務受領・勤怠システム反映</h3>
              </div>
              <button
                type="button"
                (click)="showAdminModal.set(false)"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div class="p-6 space-y-4">
              <p class="text-xs text-slate-600 leading-relaxed">
                上長による許諾を確認しました。勤怠管理（タイムカード集計、36協定管理、振替休日・有給休暇台帳）への反映を行います。
              </p>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  総務確認・受領担当者名 <span class="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  [(ngModel)]="adminFormName"
                  placeholder="例: 総務部 労務担当"
                  class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  勤怠反映メモ・労務管理コメント
                </label>
                <textarea
                  rows="3"
                  [(ngModel)]="adminFormNote"
                  placeholder="例: 振替休日を10/14付与で台帳登録完了。36協定月間時間枠内確認済。"
                  class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              <div class="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  (click)="showAdminModal.set(false)"
                  class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  (click)="confirmAdminAction()"
                  class="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition active:scale-95"
                >
                  受領・勤怠反映を完了する
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- 差戻しモーダル -->
      @if (showRejectModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div class="px-6 py-4 border-b border-slate-200 bg-rose-50 flex items-center justify-between">
              <h3 class="text-base font-bold text-rose-950">申請の差戻し</h3>
              <button
                type="button"
                (click)="showRejectModal.set(false)"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">差戻し理由</label>
                <textarea
                  rows="3"
                  [(ngModel)]="rejectReason"
                  placeholder="差戻しの理由や再提出の指示を入力してください。"
                  class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                ></textarea>
              </div>
              <div class="flex justify-end gap-2.5">
                <button
                  type="button"
                  (click)="showRejectModal.set(false)"
                  class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  (click)="confirmRejectAction()"
                  class="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  差戻しを実行
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* 水平ステッパー UI */
      .stepper-horizontal {
        display: flex;
        align-items: flex-start;
        position: relative;
        width: 100%;
      }

      .stepper-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
        padding: 0 4px;
      }

      .stepper-item:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 15px;
        left: 50%;
        width: 100%;
        height: 2px;
        background-color: #e2e8f0;
        z-index: 1;
      }

      .stepper-item.completed:not(:last-child)::after {
        background-color: #10b981;
      }

      .stepper-icon {
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background-color: #f1f5f9;
        border: 2px solid #cbd5e1;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        z-index: 2;
        transition: all 0.2s ease;
      }

      .stepper-item.active .stepper-icon {
        background-color: #e0e7ff;
        border-color: #4f46e5;
        color: #4f46e5;
        transform: scale(1.1);
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
      }

      .stepper-item.completed .stepper-icon {
        background-color: #10b981;
        border-color: #10b981;
        color: #ffffff;
      }

      .stepper-title {
        font-size: 10.5px;
        font-weight: 700;
        margin-top: 6px;
        color: #334155;
      }

      .stepper-subtitle {
        font-size: 9.5px;
        margin-top: 1px;
      }

      .stepper-time {
        font-size: 8.5px;
        color: #94a3b8;
        font-family: ui-monospace, monospace;
        margin-top: 1px;
      }
    `,
  ],
})
export class WorkRequestComponent {
  private readonly workService = inject(WorkRequestService);
  private readonly auth = inject(AuthService);

  readonly requests = this.workService.requests;
  readonly selectedRequest = signal<WorkRequest | null>(null);
  readonly activeFilter = signal<FilterType>('all');

  // モーダル制御
  readonly showFormModal = signal(false);
  readonly isEditing = signal(false);
  readonly showAdminModal = signal(false);
  readonly showRejectModal = signal(false);

  // PDF出力状態
  readonly isGeneratingPDF = signal(false);

  // フォームデータ
  formData: {
    id?: string;
    request_type: WorkRequestType;
    title: string;
    applicant_name: string;
    applicant_department: string;
    applicant_role: string;
    target_date: string;
    target_end_date: string;
    time_range: string;
    hours_estimated?: number;
    substitute_date: string;
    leave_type: 'annual' | 'substitute' | 'special' | 'condolence' | 'absence';
    leave_unit: 'full_day' | 'half_am' | 'half_pm' | 'hourly';
    has_midnight_overtime: boolean;
    anime_project: string;
    episode_or_process: string;
    deadline_date: string;
    reason_detail: string;
    emergency_contact: string;
  } = this.getEmptyFormData();

  // 総務確認用
  adminFormName = '総務部 労務担当';
  adminFormNote = '';

  // 差戻し用
  rejectReason = '';

  // 総務未受領の件数
  readonly pendingAdminCount = computed(
    () => this.requests().filter((r) => r.status === 'manager_approved').length
  );

  // フィルタリングされた申請リスト
  readonly filteredRequests = computed(() => {
    const list = this.requests();
    const filter = this.activeFilter();
    if (filter === 'all') return list;
    if (filter === 'pending_manager')
      return list.filter((r) => r.status === 'submitted');
    if (filter === 'pending_admin')
      return list.filter((r) => r.status === 'manager_approved');
    return list.filter((r) => r.request_type === filter);
  });

  constructor() {
    // 初期選択
    const current = this.requests();
    if (current.length > 0) {
      this.selectedRequest.set(current[0]);
    }
  }

  setFilter(filter: FilterType) {
    this.activeFilter.set(filter);
  }

  selectRequest(req: WorkRequest) {
    this.selectedRequest.set(req);
  }

  typeConfig(type: WorkRequestType) {
    return WORK_TYPE_CONFIG[type];
  }

  statusDisplay(status: WorkRequestStatus) {
    return WORK_STATUS_DISPLAY[status];
  }

  getLeaveLabel(type?: string) {
    if (!type) return '有給休暇';
    return LEAVE_TYPE_LABELS[type] || type;
  }

  // --- モーダル制御 ---

  openCreateModal() {
    this.isEditing.set(false);
    this.formData = this.getEmptyFormData();
    // ログイン中のユーザー名を初期値に設定
    const currentUser = this.auth.user();
    if (currentUser) {
      this.formData.applicant_name = currentUser.name || '';
      this.formData.applicant_department = (currentUser as any).department || '制作部';
    }
    this.showFormModal.set(true);
  }

  openEditModal(req: WorkRequest) {
    if (req.status !== 'submitted') return;
    this.isEditing.set(true);
    this.formData = {
      id: req.id,
      request_type: req.request_type,
      title: req.title,
      applicant_name: req.applicant_name,
      applicant_department: req.applicant_department,
      applicant_role: req.applicant_role || '',
      target_date: req.target_date,
      target_end_date: req.target_end_date || '',
      time_range: req.time_range || '',
      hours_estimated: req.hours_estimated,
      substitute_date: req.substitute_date || '',
      leave_type: (req.leave_type as any) || 'annual',
      leave_unit: req.leave_unit || 'full_day',
      has_midnight_overtime: !!req.has_midnight_overtime,
      anime_project: req.anime_project,
      episode_or_process: req.episode_or_process,
      deadline_date: req.deadline_date || '',
      reason_detail: req.reason_detail,
      emergency_contact: req.emergency_contact || '',
    };
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  submitForm() {
    const now = new Date();
    const created_at = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    if (this.isEditing() && this.formData.id) {
      const updated = this.workService.updateRequest(this.formData.id, {
        title: this.formData.title,
        applicant_name: this.formData.applicant_name,
        applicant_department: this.formData.applicant_department,
        applicant_role: this.formData.applicant_role,
        target_date: this.formData.target_date,
        target_end_date: this.formData.target_end_date,
        time_range: this.formData.time_range,
        hours_estimated: this.formData.hours_estimated,
        substitute_date: this.formData.substitute_date,
        leave_type: this.formData.leave_type,
        leave_unit: this.formData.leave_unit,
        has_midnight_overtime: this.formData.has_midnight_overtime,
        anime_project: this.formData.anime_project,
        episode_or_process: this.formData.episode_or_process,
        deadline_date: this.formData.deadline_date,
        reason_detail: this.formData.reason_detail,
        emergency_contact: this.formData.emergency_contact,
      });
      if (updated) {
        this.selectedRequest.set(updated);
      }
    } else {
      const created = this.workService.createRequest({
        request_type: this.formData.request_type,
        title: this.formData.title,
        applicant_name: this.formData.applicant_name,
        applicant_department: this.formData.applicant_department,
        applicant_role: this.formData.applicant_role,
        created_at,
        target_date: this.formData.target_date,
        target_end_date: this.formData.target_end_date,
        time_range: this.formData.time_range,
        hours_estimated: this.formData.hours_estimated,
        substitute_date: this.formData.substitute_date,
        leave_type: this.formData.leave_type,
        leave_unit: this.formData.leave_unit,
        has_midnight_overtime: this.formData.has_midnight_overtime,
        anime_project: this.formData.anime_project,
        episode_or_process: this.formData.episode_or_process,
        deadline_date: this.formData.deadline_date,
        reason_detail: this.formData.reason_detail,
        emergency_contact: this.formData.emergency_contact,
      });
      this.selectedRequest.set(created);
    }

    this.showFormModal.set(false);
  }

  // --- 上長承認（許諾） ---

  approveAsManager(req: WorkRequest) {
    const currentUser = this.auth.user();
    const managerName = currentUser ? currentUser.name : '上長 (制作デスク)';
    const updated = this.workService.approveByManager(req.id, managerName);
    if (updated) {
      this.selectedRequest.set(updated);
    }
  }

  // --- 総務受領・勤怠反映 ---

  openAdminConfirmModal(req: WorkRequest) {
    const currentUser = this.auth.user();
    this.adminFormName = currentUser ? `${currentUser.name} (総務)` : '総務部 労務担当';
    this.adminFormNote =
      req.request_type === 'holiday_work'
        ? `休日出勤（${req.hours_estimated || 8}h）を勤怠台帳に登録。振替休日（${req.substitute_date || '後日申請'}）付与枠を確保しました。`
        : req.request_type === 'leave'
        ? `休暇（${this.getLeaveLabel(req.leave_type)}）をタイムカードに反映。有給・代休残日数を更新しました。`
        : `残業（${req.hours_estimated || 4}h）を勤怠集計システムへ連携。36協定時間枠内確認済。`;
    this.showAdminModal.set(true);
  }

  confirmAdminAction() {
    const selected = this.selectedRequest();
    if (!selected) return;

    const updated = this.workService.confirmByAdmin(
      selected.id,
      this.adminFormName,
      this.adminFormNote
    );
    if (updated) {
      this.selectedRequest.set(updated);
    }
    this.showAdminModal.set(false);
  }

  // --- 差戻し ---

  openRejectModal(req: WorkRequest) {
    this.rejectReason = '';
    this.showRejectModal.set(true);
  }

  confirmRejectAction() {
    const selected = this.selectedRequest();
    if (!selected) return;

    const currentUser = this.auth.user();
    const rejector = currentUser ? currentUser.name : '上長';
    const updated = this.workService.rejectRequest(
      selected.id,
      rejector,
      this.rejectReason
    );
    if (updated) {
      this.selectedRequest.set(updated);
    }
    this.showRejectModal.set(false);
  }

  // --- PDFダイレクトダウンロード ---

  async downloadPDF() {
    const req = this.selectedRequest();
    if (!req) return;

    this.isGeneratingPDF.set(true);

    try {
      if (!(window as any).html2pdf) {
        await this.loadScript(
          'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
        );
      }

      const html2pdf = (window as any).html2pdf;
      const element = document.getElementById('print-area');
      if (!element) return;

      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.margin = '0';
      clone.style.width = '794px';
      clone.style.maxWidth = '794px';
      clone.style.padding = '24px 28px';

      const opt = {
        margin: [6, 6, 6, 6],
        filename: `業務申請書_${req.id}_${req.applicant_name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(clone).save();
    } catch (e) {
      console.error('Failed to generate PDF', e);
      window.print();
    } finally {
      this.isGeneratingPDF.set(false);
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }

  private getEmptyFormData() {
    return {
      request_type: 'holiday_work' as WorkRequestType,
      title: '',
      applicant_name: '',
      applicant_department: '制作部',
      applicant_role: '',
      target_date: '',
      target_end_date: '',
      time_range: '10:00 〜 19:00',
      hours_estimated: 8,
      substitute_date: '',
      leave_type: 'annual' as const,
      leave_unit: 'full_day' as const,
      has_midnight_overtime: false,
      anime_project: '『HERON: THE ANIMATION 第2期』',
      episode_or_process: '',
      deadline_date: '',
      reason_detail: '',
      emergency_contact: '',
    };
  }
}
