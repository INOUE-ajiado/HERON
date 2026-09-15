import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ApprovalService } from '../../core/approval.service';
import { ApprovalRequest, STATUS_DISPLAY, PurchaseItem } from '../../core/approval.model';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <!-- 完全エッジ・トゥ・エッジ フルキャンバスコンテナ (ネガティブマージンでシェルパディングを相殺) -->
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] flex flex-col bg-slate-100/80 text-slate-800 font-sans">
      
      <!-- トップ ヘッダーバー (Edge-to-Edge Seamless Header) -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <app-icon name="doc" class="text-lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-bold text-slate-900 tracking-tight">デジタル稟議管理ワークスペース</h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                HERON Workflow
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              4段階承認プロセス（①申請者提出 ➔ ②プロデューサー承認 ➔ ③DXチーム確認 ➔ ④代表承認）
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95"
          >
            <span class="text-base leading-none font-normal">+</span>
            <span>新規稟議を作成</span>
          </button>
        </div>
      </header>

      <!-- メイン 2カラム エッジ・トゥ・エッジ スプリットビュー -->
      <div class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        <!-- 左サイドペイン: 稟議一覧ナビゲーション (lg:w-80 / lg:w-96) -->
        <aside class="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <span class="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <span>申請一覧</span>
              <span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {{ sortedRequests().length }}
              </span>
            </span>

            <span class="text-[10px] text-slate-400">進行中順ソート</span>
          </div>

          <!-- スクロール可能な一覧エリア (進行中が上、完了済みが下のブランク色) -->
          <div class="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[35vh] lg:max-h-none bg-slate-50/30">
            @for (req of sortedRequests(); track req.id) {
              <div
                (click)="selectRequest(req)"
                [class.bg-blue-50/80]="selectedRequest()?.id === req.id"
                [class.border-blue-500]="selectedRequest()?.id === req.id"
                [class.shadow-md]="selectedRequest()?.id === req.id"
                [class.bg-slate-100/70]="req.status === 'president_approved' && selectedRequest()?.id !== req.id"
                [class.border-slate-200]="req.status === 'president_approved' && selectedRequest()?.id !== req.id"
                [class.opacity-75]="req.status === 'president_approved' && selectedRequest()?.id !== req.id"
                class="group p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs cursor-pointer transition-all duration-150 relative overflow-hidden"
              >
                <!-- アクティブインジケータ -->
                @if (selectedRequest()?.id === req.id) {
                  <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                }

                <div class="flex justify-between items-start mb-1.5 gap-2">
                  <span
                    class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    [class.bg-slate-100]="req.status !== 'president_approved'"
                    [class.text-slate-500]="req.status !== 'president_approved'"
                    [class.bg-slate-200/60]="req.status === 'president_approved'"
                    [class.text-slate-400]="req.status === 'president_approved'"
                  >
                    {{ req.id }}
                  </span>
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    [ngClass]="STATUS_DISPLAY[req.status].colorClass"
                    [class.grayscale-30]="req.status === 'president_approved' && selectedRequest()?.id !== req.id"
                  >
                    {{ getShortStatusLabel(req.status) }}
                  </span>
                </div>

                <h3
                  class="text-xs font-bold line-clamp-2 leading-snug mb-1.5"
                  [class.text-slate-800]="req.status !== 'president_approved' || selectedRequest()?.id === req.id"
                  [class.text-slate-500]="req.status === 'president_approved' && selectedRequest()?.id !== req.id"
                  [class.group-hover:text-blue-700]="selectedRequest()?.id !== req.id"
                >
                  {{ req.title }}
                </h3>

                <div class="text-[11px] text-slate-500 flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <span class="flex items-center gap-1.5 truncate">
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      [class.bg-blue-500]="req.status !== 'president_approved'"
                      [class.bg-slate-300]="req.status === 'president_approved'"
                    ></span>
                    <span [class.text-slate-600]="req.status !== 'president_approved'">{{ req.applicant_name }}</span>
                  </span>
                  <span class="text-[10px] font-mono text-slate-400 shrink-0">{{ req.created_at }}</span>
                </div>
              </div>
            } @empty {
              <div class="p-8 text-center text-slate-400 text-xs">
                稟議申請がまだありません。
              </div>
            }
          </div>
        </aside>

        <!-- 右メインペイン: 稟議プレビュー ＆ 承認キャンバス (余白排除エッジ・トゥ・エッジ) -->
        <main class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 flex flex-col items-center">
          @if (selectedRequest(); as req) {
            <div class="w-full space-y-3.5">
              
              <!-- 統合された 承認進捗 ＆ アクションカード (コンパクト全幅) -->
              <div class="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                <!-- ヘッダー (左: タイトル, 右: アクションボタン / PDFダイレクトダウンロード) -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 class="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>承認フロー進捗状況 (承認ステータス)</span>
                  </h3>

                  <div class="flex flex-wrap items-center gap-2.5 shrink-0">
                    <!-- ① 申請者提出 (submitted) のみ編集可能 -->
                    @if (req.status === 'submitted') {
                      <button
                        type="button"
                        (click)="openEditModal(req)"
                        class="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3 py-2 rounded-lg transition active:scale-95 shadow-xs"
                      >
                        <span class="text-sm">✏️</span>
                        <span>申請内容を編集</span>
                      </button>
                    } @else {
                      <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium px-2.5 py-1.5 rounded-lg" title="承認手続きが開始されているため変更できません">
                        <span>🔒</span>
                        <span>{{ req.status === 'president_approved' ? '決裁完了（編集不可）' : '承認手続中（編集不可）' }}</span>
                      </span>
                    }

                    <!-- 承認進展ボタン -->
                    @if (req.status !== 'president_approved' && req.status !== 'rejected') {
                      <button
                        type="button"
                        (click)="advanceApproval(req)"
                        class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm shadow-emerald-600/20 transition active:scale-95"
                      >
                        <span class="text-sm">✓</span>
                        <span>{{ getNextApprovalBtnLabel(req.status) }}</span>
                      </button>
                    }

                    <!-- PDFダイレクトダウンロードボタン -->
                    <button
                      type="button"
                      (click)="downloadPDF()"
                      [disabled]="isGeneratingPDF()"
                      class="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      @if (isGeneratingPDF()) {
                        <span class="animate-spin text-sm">🌀</span>
                        <span>PDF生成中...</span>
                      } @else {
                        <app-icon name="doc" class="text-sm text-white" />
                        <span>PDFをダウンロード</span>
                      }
                    </button>
                  </div>
                </div>

                <!-- 水平ステッパー UI (UIカタログ Pattern 01 完全準拠) -->
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

                      <!-- ラベル ＆ 詳細情報 -->
                      <div class="stepper-title">{{ step.title }}</div>
                      <div class="stepper-subtitle">
                        @if (step.completed) {
                          <span class="text-emerald-700 font-bold">{{ step.approverName }}</span>
                        } @else if (step.current) {
                          <span class="text-blue-600 font-bold">承認待ち</span>
                        } @else {
                          <span class="text-slate-400">未到達</span>
                        }
                      </div>

                      <div class="stepper-time">
                        @if (step.updatedAt) {
                          {{ step.updatedAt }}
                        } @else if (step.current) {
                          審議中
                        } @else {
                          -
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- 稟議書プレビュー用紙 (空間マージンを限界まで最適化したスタイリッシュレイアウト) -->
              <div id="print-area" class="bg-white text-slate-900 rounded-xl shadow-md p-5 sm:p-7 space-y-3.5 border border-slate-200">
                <!-- ドキュメントヘッダー -->
                <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
                  <div>
                    <h1 class="text-xl sm:text-2xl font-bold tracking-[0.3em] text-slate-900 leading-none mb-0.5">稟議書</h1>
                    <p class="text-[9px] tracking-widest text-slate-400 uppercase font-mono">APPROVAL REQUEST FORM</p>
                  </div>
                  <div class="text-right text-[11px] text-slate-600 space-y-0.2">
                    <p>起案日：{{ req.created_at }}</p>
                    <p>決済希望日：{{ formatDisplayDate(req.desired_date) }}</p>
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
                      <span class="w-24 font-bold text-slate-500">起案者名</span>
                      <span class="font-medium text-slate-900 text-sm">{{ req.applicant_name }}</span>
                    </div>
                    @if (req.target_user) {
                      <div class="flex items-center text-xs">
                        <span class="w-24 font-bold text-blue-700">主な使用者</span>
                        <span class="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/80 text-xs">{{ req.target_user }}</span>
                      </div>
                    }
                    @if (req.estimated_amount) {
                      <div class="flex items-center text-xs">
                        <span class="w-24 font-bold text-slate-500">購入合計金額</span>
                        <span class="font-bold text-blue-700 text-sm">{{ req.estimated_amount }}</span>
                      </div>
                    }
                  </div>

                  <!-- 印影欄 -->
                  <div class="flex border border-slate-900 rounded overflow-hidden shadow-xs shrink-0">
                    @for (stamp of req.stamps; track stamp.roleLabel) {
                      <div class="w-[70px] h-[66px] border-r border-slate-900 last:border-r-0 flex flex-col items-center justify-between py-0.5 shrink-0 bg-white">
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
                  <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Subject / 件名</div>
                  <div class="text-sm font-bold border-l-4 border-slate-900 pl-3 py-1.5 bg-slate-50 text-slate-900 rounded-r">
                    {{ req.title }}
                  </div>
                </div>

                <!-- 概要 (画面上・PDF生成時ともに object-contain で完璧フィット) -->
                <div>
                  <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Summary / 概要</div>
                  <div class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                    
                    <!-- 明細テーブル -->
                    <div class="p-2.5 bg-white space-y-2">
                      <div class="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                        <span>【新規導入・購入品目明細】</span>
                        <span class="text-[9.5px] text-slate-400 font-normal">品目リストごとに使用者・商品画像・購入先URLを表示</span>
                      </div>
                      
                      @if (req.items && req.items.length > 0) {
                        <div class="space-y-2">
                          @for (item of req.items; track item.name; let idx = $index) {
                            <div class="p-2 bg-slate-50/70 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <!-- 左側: 商品画像 ＆ 商品情報 -->
                              <div class="flex items-start gap-2.5 flex-1 min-w-0">
                                @if (item.image_url) {
                                  <div class="w-14 h-14 shrink-0 bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs relative flex items-center justify-center p-0.5">
                                    <img
                                      [src]="item.image_url"
                                      alt="商品画像"
                                      class="w-full h-full object-contain"
                                      style="object-fit: contain !important;"
                                      (error)="onImageError($event)"
                                    />
                                    <div class="fallback-badge hidden w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[9.5px] p-1 text-center leading-tight">
                                      商品画像
                                    </div>
                                  </div>
                                } @else {
                                  <div class="w-10 h-10 shrink-0 bg-slate-200/60 rounded-md flex items-center justify-center text-slate-400 font-bold text-[9.5px]">
                                    No Img
                                  </div>
                                }

                                <div class="space-y-0.5 min-w-0 flex-1">
                                  <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                    <span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9.5px] font-mono">#{{ idx + 1 }}</span>
                                    <span class="truncate">{{ item.name }}</span>
                                  </div>

                                  <div class="text-[10.5px] text-slate-600 flex items-center gap-3">
                                    <span>単価: <strong class="font-mono text-slate-800">{{ formatCurrency(item.price) }}</strong></span>
                                    <span>数量: <strong class="font-mono text-slate-800">{{ item.quantity }}</strong></span>
                                  </div>

                                  @if (item.target_user) {
                                    <div class="text-[10px] text-blue-900 bg-blue-50/90 px-2 py-0.5 rounded border border-blue-200/80 inline-flex items-center gap-1 font-medium mt-0.5">
                                      <span class="font-bold text-blue-700">👤 使用者・対象者:</span>
                                      <span class="font-bold">{{ item.target_user }}</span>
                                    </div>
                                  }

                                  @if (item.purchase_url) {
                                    <div class="text-[10px] flex items-center gap-1 pt-0.2">
                                      <span class="text-slate-400 shrink-0">🔗 購入先:</span>
                                      <a
                                        [href]="item.purchase_url"
                                        target="_blank"
                                        rel="noopener"
                                        class="text-blue-600 underline font-medium hover:text-blue-800 truncate max-w-md"
                                      >
                                        {{ item.purchase_url }} ↗
                                      </a>
                                    </div>
                                  }
                                </div>
                              </div>

                              <!-- 右側: 小計金額 -->
                              <div class="text-right shrink-0 self-end sm:self-center border-t sm:border-t-0 border-slate-200 pt-1 sm:pt-0 w-full sm:w-auto">
                                <span class="text-[9.5px] text-slate-400 block">小計</span>
                                <span class="font-bold text-slate-900 font-mono text-xs">
                                  {{ formatCurrency(item.price * item.quantity) }}
                                </span>
                              </div>
                            </div>
                          }

                          <!-- 合計金額フッター -->
                          <div class="p-2 bg-blue-50/80 border border-blue-200 rounded-lg flex justify-between items-center text-xs font-bold text-blue-950">
                            <span>合計購入金額 (小計合算)</span>
                            <span class="font-mono text-sm text-blue-700">
                              {{ getRequestTotalAmount(req) }}
                            </span>
                          </div>
                        </div>
                      } @else {
                        <div class="font-medium text-slate-900 p-1 text-xs">
                          {{ req.new_item_name }}
                        </div>
                      }
                    </div>

                    @if (req.target_user) {
                      <div class="flex p-2 bg-blue-50/30 border-t border-slate-200">
                        <span class="w-24 font-bold text-blue-700 shrink-0">【使用者・対象者】</span>
                        <span class="font-bold text-slate-900">{{ req.target_user }}</span>
                      </div>
                    }
                    <div class="flex p-2 bg-slate-50/50">
                      <span class="w-24 font-bold text-slate-500 shrink-0">【契約終了】</span>
                      <span class="font-medium text-slate-900">{{ req.cancel_item_name || 'なし' }}</span>
                    </div>
                    <div class="flex p-2 bg-white">
                      <span class="w-24 font-bold text-slate-500 shrink-0">【主な用途】</span>
                      <span class="font-medium text-slate-900">{{ req.usage_purpose }}</span>
                    </div>
                  </div>
                </div>

                <!-- 申請理由・目的 -->
                <div>
                  <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Purpose / 申請理由・目的</div>
                  <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] text-slate-800 leading-normal whitespace-pre-wrap">
                    {{ req.reason_detail }}
                  </div>
                </div>

                <!-- 備考・添付資料 -->
                @if (req.attachment_note) {
                  <div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Attached Files / 備考・添付</div>
                    <div class="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] rounded-md border border-slate-200 font-mono">
                      📎 {{ req.attachment_note }}
                    </div>
                  </div>
                }
              </div>

            </div>
          } @else {
            <div class="p-16 text-center text-slate-400">
              左側のリストから稟議申請を選択してください。
            </div>
          }
        </main>
      </div>

      <!-- 稟議 作成 ＆ 編集 共通モーダル -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div class="bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{{ isEditMode() ? '申請内容の編集 (申請者提出段階)' : '新規稟議申請の作成' }}</span>
              </h2>
              <button
                type="button"
                (click)="closeCreateModal()"
                class="text-slate-400 hover:text-slate-700 text-xl font-bold transition"
              >
                ×
              </button>
            </div>

            <form (ngSubmit)="submitForm()" class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">起案者（自動反映）</label>
                  <input
                    type="text"
                    [value]="currentUser()?.name || 'ゲストユーザー'"
                    readonly
                    class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-bold"
                  />
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">所属部門 *</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.applicant_department"
                    name="applicant_department"
                    required
                    placeholder="例: 総務部 デジタル推進課"
                    class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">起案日</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.created_at"
                    name="created_at"
                    readonly
                    class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500"
                  />
                </div>

                <div>
                  <!-- カレンダー入力 (input type="date") -->
                  <label class="block font-bold text-blue-700 mb-1 flex items-center gap-1">
                    <span>決済希望日 *</span>
                    <span class="text-[10px] text-slate-500 font-normal">(カレンダー選択)</span>
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="formData.desired_date"
                    name="desired_date"
                    required
                    class="w-full bg-white border border-blue-400 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">件名 (Subject) *</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.title"
                    name="title"
                    required
                    placeholder="例: 開発用液晶タブレットの新規購入申請"
                    class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label class="block font-bold text-blue-800 mb-1 flex items-center gap-1">
                    <span>主な使用者・利用対象者</span>
                    <span class="text-[10px] text-slate-500 font-normal">(誰が必要としているか)</span>
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="formData.target_user"
                    name="target_user"
                    placeholder="例: 山田 惇斗（開発推進課）, UIデザインチーム全員"
                    class="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <!-- 動的計算対応【新規導入・購入品目】エリア (アイテムごとの個別画像 ＆ URL ＆ 使用者登録) -->
              <div class="space-y-3 bg-slate-50/90 p-4 border border-slate-200 rounded-xl">
                <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                  <label class="block font-bold text-slate-800">
                    【新規導入・購入品目リスト】 *
                    <span class="text-[10px] text-slate-500 font-normal ml-1">(品目ごとに商品名・使用者・金額・個数・購入先URL・画像を登録できます)</span>
                  </label>
                  <button
                    type="button"
                    (click)="addNewItemField()"
                    class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2.5 py-1 rounded-lg shadow-xs hover:bg-blue-50 transition"
                  >
                    <span>+ 品目を追加</span>
                  </button>
                </div>

                @for (item of formData.items; track $index; let idx = $index) {
                  <div class="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <span class="text-[11px] font-bold text-slate-400 w-5 shrink-0 text-center">{{ idx + 1 }}.</span>
                      
                      <!-- 商品名 -->
                      <div class="flex-1 w-full sm:w-auto">
                        <input
                          type="text"
                          [(ngModel)]="item.name"
                          [name]="'item_name_' + idx"
                          required
                          placeholder="商品名・品目名 (例: Wacom Cintiq Pro 16)"
                          class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                        />
                      </div>

                      <!-- 単価 (金額) -->
                      <div class="w-full sm:w-32 flex items-center gap-1">
                        <span class="text-[10px] font-bold text-slate-500 shrink-0">単価</span>
                        <input
                          type="number"
                          [(ngModel)]="item.price"
                          [name]="'item_price_' + idx"
                          min="0"
                          placeholder="円"
                          class="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 text-right font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <!-- 個数 -->
                      <div class="w-full sm:w-20 flex items-center gap-1">
                        <span class="text-[10px] font-bold text-slate-500 shrink-0">個数</span>
                        <input
                          type="number"
                          [(ngModel)]="item.quantity"
                          [name]="'item_qty_' + idx"
                          min="1"
                          placeholder="個"
                          class="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 text-center font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <!-- 小計自動計算 -->
                      <div class="w-full sm:w-28 text-right px-1 shrink-0">
                        <span class="text-[10px] text-slate-400 block">小計</span>
                        <span class="font-bold text-slate-900 font-mono text-xs">
                          {{ formatCurrency(getItemSubtotal(item)) }}
                        </span>
                      </div>

                      @if (formData.items.length > 1) {
                        <button
                          type="button"
                          (click)="removeNewItemField(idx)"
                          class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="品目を削除"
                        >
                          ✕
                        </button>
                      }
                    </div>

                    <!-- アイテムごとの使用者・対象者 / 購入先URL / 画像URL設定 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100 pl-7">
                      <div>
                        <label class="block text-[10px] font-bold text-blue-800 mb-0.5">👤 この品目の使用者・対象者</label>
                        <input
                          type="text"
                          [(ngModel)]="item.target_user"
                          [name]="'item_target_user_' + idx"
                          placeholder="例: 山田 惇斗（開発推進課）"
                          class="w-full bg-blue-50/50 border border-blue-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">購入先URL (Amazon等)</label>
                        <input
                          type="url"
                          [(ngModel)]="item.purchase_url"
                          [name]="'item_url_' + idx"
                          placeholder="https://www.amazon.co.jp/..."
                          class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">商品画像URL</label>
                        <input
                          type="url"
                          [(ngModel)]="item.image_url"
                          [name]="'item_img_' + idx"
                          placeholder="https://.../image.jpg"
                          class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                }

                <!-- 自動計算合計金額表示 -->
                <div class="flex justify-end items-center gap-2 pt-2 border-t border-slate-200 text-xs">
                  <span class="font-bold text-slate-600">合計購入金額 (自動計算):</span>
                  <span class="text-base font-bold text-blue-700 font-mono">
                    {{ formatCurrency(calculateTotalAmount()) }}
                  </span>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">【契約終了・除却品目】</label>
                <input
                  type="text"
                  [(ngModel)]="formData.cancel_item_name"
                  name="cancel_item_name"
                  placeholder="例: 古いタブレット (解約/廃棄)"
                  class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">【主な用途】 *</label>
                <input
                  type="text"
                  [(ngModel)]="formData.usage_purpose"
                  name="usage_purpose"
                  required
                  placeholder="例: UIデザインおよびイラスト素材制作"
                  class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">目的・申請理由詳細 *</label>
                <textarea
                  [(ngModel)]="formData.reason_detail"
                  name="reason_detail"
                  rows="4"
                  required
                  placeholder="導入の背景や目的、期待される効果等を具体的に入力してください。"
                  class="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">概算金額（自動計算）</label>
                  <input
                    type="text"
                    [value]="formatCurrency(calculateTotalAmount())"
                    readonly
                    class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-blue-700 font-bold font-mono"
                  />
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">添付資料・備考</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.attachment_note"
                    name="attachment_note"
                    placeholder="例: 見積書_202603.pdf"
                    class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  (click)="closeCreateModal()"
                  class="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  class="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition active:scale-95"
                >
                  {{ isEditMode() ? '変更内容を更新保存' : '稟議を申請する' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* UIカタログ Pattern 01: 水平型プログレス・ステッパー スタイル */
      .stepper-horizontal {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        position: relative;
        width: 100%;
        margin: 0 auto;
      }

      .stepper-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        text-align: center;
        padding: 0 4px;
      }

      /* ステップ間を繋ぐ接続線 */
      .stepper-item:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 18px;
        left: 50%;
        width: 100%;
        height: 3px;
        background-color: #e2e8f0; /* slate-200 */
        z-index: 1;
      }

      .stepper-item.completed:not(:last-child)::after {
        background-color: #10b981; /* emerald-500 */
      }

      .stepper-item.active:not(:last-child)::after {
        background: linear-gradient(to right, #2563eb 50%, #e2e8f0 50%);
      }

      /* アイコンスタイル */
      .stepper-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: #ffffff;
        border: 3px solid #cbd5e1; /* slate-300 */
        color: #94a3b8; /* slate-400 */
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.875rem;
        z-index: 2;
        margin-bottom: 8px;
        transition: all 0.3s ease;
      }

      .stepper-item.completed .stepper-icon {
        background-color: #10b981; /* emerald-500 */
        border-color: #10b981;
        color: #ffffff;
      }

      .stepper-item.active .stepper-icon {
        background-color: #ffffff;
        border-color: #2563eb; /* blue-600 */
        color: #2563eb;
        box-shadow: 0 0 0 4px #eff6ff; /* blue-50 */
      }

      /* テキストラベルスタイル */
      .stepper-title {
        font-size: 0.8rem;
        font-weight: 700;
        color: #1e293b; /* slate-800 */
        margin-bottom: 2px;
      }

      .stepper-item.active .stepper-title {
        color: #2563eb;
      }

      .stepper-subtitle {
        font-size: 0.75rem;
        color: #64748b; /* slate-500 */
      }

      .stepper-time {
        font-size: 0.7rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #94a3b8; /* slate-400 */
        margin-top: 2px;
      }

      @media print {
        body * {
          visibility: hidden;
        }
        #print-area,
        #print-area * {
          visibility: visible;
        }
        #print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
      }
    `,
  ],
})
export class ApprovalComponent {
  private readonly auth = inject(AuthService);
  private readonly approvalService = inject(ApprovalService);

  readonly currentUser = this.auth.user;
  readonly requests = computed(() => this.approvalService.requests());
  readonly selectedRequest = signal<ApprovalRequest | null>(null);

  // 申請中を上、申請完了を下にするソート済み一覧
  readonly sortedRequests = computed(() => {
    const list = [...this.approvalService.requests()];
    return list.sort((a, b) => {
      const isCompletedA = a.status === 'president_approved';
      const isCompletedB = b.status === 'president_approved';

      if (isCompletedA === isCompletedB) {
        return b.id.localeCompare(a.id);
      }
      return isCompletedA ? 1 : -1;
    });
  });

  readonly showCreateModal = signal<boolean>(false);
  readonly isEditMode = signal<boolean>(false);
  readonly isGeneratingPDF = signal<boolean>(false);
  editingRequestId: string | null = null;

  readonly STATUS_DISPLAY = STATUS_DISPLAY;

  // デフォルトで7日後の日付を YYYY-MM-DD 形式で作成
  private get defaultDesiredDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  // フォーム初期データ
  formData: {
    title: string;
    applicant_department: string;
    created_at: string;
    desired_date: string;
    target_user: string;
    items: { name: string; price: number; quantity: number; purchase_url?: string; image_url?: string; target_user?: string }[];
    cancel_item_name: string;
    usage_purpose: string;
    reason_detail: string;
    attachment_note: string;
  } = {
    title: '',
    applicant_department: '総務部 デジタル推進課',
    created_at: new Date().toLocaleDateString('ja-JP'),
    desired_date: this.defaultDesiredDate,
    target_user: '',
    items: [{ name: '', price: 0, quantity: 1, purchase_url: '', image_url: '', target_user: '' }],
    cancel_item_name: '',
    usage_purpose: '',
    reason_detail: '',
    attachment_note: '',
  };

  constructor() {
    const list = this.sortedRequests();
    if (list.length > 0) {
      this.selectedRequest.set(list[0]);
    }
  }

  selectRequest(req: ApprovalRequest) {
    this.selectedRequest.set(req);
  }

  getItemSubtotal(item: { price: number; quantity: number }): number {
    return (item.price || 0) * (item.quantity || 0);
  }

  calculateTotalAmount(): number {
    return this.formData.items.reduce(
      (sum, item) => sum + this.getItemSubtotal(item),
      0,
    );
  }

  formatCurrency(amount: number): string {
    return (amount || 0).toLocaleString('ja-JP') + '円';
  }

  getRequestTotalAmount(req: ApprovalRequest): string {
    if (req.items && req.items.length > 0) {
      const sum = req.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
      return this.formatCurrency(sum);
    }
    return req.estimated_amount || '0円';
  }

  addNewItemField() {
    this.formData.items.push({ name: '', price: 0, quantity: 1, purchase_url: '', image_url: '', target_user: '' });
  }

  removeNewItemField(index: number) {
    if (this.formData.items.length > 1) {
      this.formData.items.splice(index, 1);
    }
  }

  getShortStatusLabel(status: string): string {
    switch (status) {
      case 'submitted':
        return '① 申請中';
      case 'producer_approved':
        return '② プロデューサー承認済';
      case 'dx_confirmed':
        return '③ DXチーム確認済';
      case 'president_approved':
        return '④ 代表承認済';
      default:
        return '却下';
    }
  }

  getNextApprovalBtnLabel(status: string): string {
    switch (status) {
      case 'submitted':
        return 'プロデューサー承認を行う';
      case 'producer_approved':
        return 'DXチーム確認を行う';
      case 'dx_confirmed':
        return '代表承認を行う (完了)';
      default:
        return '承認';
    }
  }

  advanceApproval(req: ApprovalRequest) {
    const approverName = this.currentUser()?.name || '承認担当者';
    const updated = this.approvalService.advanceApproval(req.id, approverName);
    if (updated) {
      this.selectedRequest.set(updated);
    }
  }

  openCreateModal() {
    this.isEditMode.set(false);
    this.editingRequestId = null;
    this.formData.created_at = new Date().toLocaleDateString('ja-JP');
    this.formData.desired_date = this.defaultDesiredDate;
    this.formData.title = '';
    this.formData.applicant_department = '総務部 デジタル推進課';
    this.formData.target_user = '';
    this.formData.items = [{ name: '', price: 0, quantity: 1, purchase_url: '', image_url: '', target_user: '' }];
    this.formData.cancel_item_name = '';
    this.formData.usage_purpose = '';
    this.formData.reason_detail = '';
    this.formData.attachment_note = '';
    this.showCreateModal.set(true);
  }

  /** 編集モーダルの起動 (「① 申請者提出 (submitted)」の時のみ) */
  openEditModal(req: ApprovalRequest) {
    if (req.status !== 'submitted') return;
    this.isEditMode.set(true);
    this.editingRequestId = req.id;

    this.formData.title = req.title;
    this.formData.applicant_department = req.applicant_department;
    this.formData.created_at = req.created_at;
    this.formData.desired_date = req.desired_date || this.defaultDesiredDate;
    this.formData.target_user = req.target_user || '';
    this.formData.cancel_item_name = req.cancel_item_name || '';
    this.formData.usage_purpose = req.usage_purpose || '';
    this.formData.reason_detail = req.reason_detail || '';
    this.formData.attachment_note = req.attachment_note || '';

    if (req.items && req.items.length > 0) {
      this.formData.items = req.items.map((item) => ({ ...item }));
    } else {
      this.formData.items = [
        {
          name: req.new_item_name || '',
          price: 0,
          quantity: 1,
          purchase_url: '',
          image_url: '',
          target_user: req.target_user || '',
        },
      ];
    }

    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
    this.isEditMode.set(false);
    this.editingRequestId = null;
  }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return `${y}.${m}.${d}`;
    }
    return dateStr;
  }

  submitForm() {
    const applicantName = this.currentUser()?.name || '山田 惇斗';
    const validItems: PurchaseItem[] = this.formData.items
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        name: i.name.trim(),
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        purchase_url: i.purchase_url ? i.purchase_url.trim() : undefined,
        image_url: i.image_url ? i.image_url.trim() : undefined,
        target_user: i.target_user ? i.target_user.trim() : undefined,
      }));

    const primaryItemName =
      validItems.length > 0 ? validItems[0].name : '購入品目未入力';
    const totalAmountStr = this.formatCurrency(this.calculateTotalAmount());
    const mainTargetUser = this.formData.target_user.trim() || (validItems.length > 0 ? validItems[0].target_user : undefined);

    if (this.isEditMode() && this.editingRequestId) {
      // 編集更新
      const updated = this.approvalService.updateRequest(this.editingRequestId, {
        title: this.formData.title,
        applicant_department: this.formData.applicant_department,
        desired_date: this.formData.desired_date,
        target_user: mainTargetUser,
        new_item_name: primaryItemName,
        items: validItems,
        new_items: validItems.map((i) => i.name),
        cancel_item_name: this.formData.cancel_item_name,
        usage_purpose: this.formData.usage_purpose,
        reason_detail: this.formData.reason_detail,
        attachment_note: this.formData.attachment_note,
        estimated_amount: totalAmountStr,
      });

      if (updated) {
        this.selectedRequest.set(updated);
      }
    } else {
      // 新規申請作成
      const created = this.approvalService.createRequest({
        title: this.formData.title,
        applicant_name: applicantName,
        applicant_department: this.formData.applicant_department,
        created_at: this.formData.created_at,
        desired_date: this.formData.desired_date,
        target_user: mainTargetUser,
        new_item_name: primaryItemName,
        items: validItems,
        new_items: validItems.map((i) => i.name),
        cancel_item_name: this.formData.cancel_item_name,
        usage_purpose: this.formData.usage_purpose,
        reason_detail: this.formData.reason_detail,
        attachment_note: this.formData.attachment_note,
        estimated_amount: totalAmountStr,
      });

      this.selectedRequest.set(created);
    }

    this.closeCreateModal();
  }

  /**
   * 画像URLを安全にBase64 Data URLへ変換するマルチフェッチ関数
   * CORSプロキシ (wsrv.nl / corsproxy.io) 経由の強力なフォールバックを完備！
   */
  private async imageUrlToBase64(url: string): Promise<string | null> {
    if (!url || url.startsWith('data:')) return url;

    // 1. Image API + Canvas
    try {
      const dataUrl = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 120;
            canvas.height = img.naturalHeight || img.height || 120;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.92));
              return;
            }
          } catch (e) {}
          resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      if (dataUrl) return dataUrl;
    } catch (e) {}

    // 2. 直接 fetch API
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) return dataUrl;
      }
    } catch (e) {}

    // 3. CORSプロキシ経由の強制取得 (ビックカメラ等の直リンク禁止サイト用フォールバック)
    const proxyUrls = [
      `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
    ];

    for (const pUrl of proxyUrls) {
      try {
        const response = await fetch(pUrl);
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) return dataUrl;
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * クローン内の全画像をBase64化し、PDF上の画像要素へ object-fit: contain !important を強固に直接セット
   */
  private async convertImagesToBase64(container: HTMLElement): Promise<void> {
    const imgs = Array.from(container.querySelectorAll('img'));
    const promises = imgs.map(async (img) => {
      // PDF出力用クローン要素の画像タグへ object-fit: contain をインラインスタイルで強制設定
      img.style.objectFit = 'contain';
      img.style.width = '100%';
      img.style.height = '100%';

      const src = img.getAttribute('src') || img.src;
      if (!src || src.startsWith('data:')) return;

      const base64 = await this.imageUrlToBase64(src);
      if (base64) {
        img.src = base64;
      } else {
        const parent = img.parentElement;
        if (parent) {
          img.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.style.cssText =
            'width:100%;height:100%;background-color:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:bold;font-size:9px;border-radius:4px;border:1px solid #cbd5e1;text-align:center;padding:2px;';
          fallback.innerText = '商品画像';
          parent.appendChild(fallback);
        }
      }
    });
    await Promise.all(promises);
  }

  /**
   * PDF出力用クローンへ object-fit: contain を全自動適用し、100%見切れのない完全フィット仕様でPDF生成
   */
  async downloadPDF() {
    const req = this.selectedRequest();
    if (!req) return;

    const element = document.getElementById('print-area');
    if (!element) return;

    this.isGeneratingPDF.set(true);

    try {
      if (!(window as any).html2pdf) {
        await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
      }

      const html2pdf = (window as any).html2pdf;
      const cleanTitle = req.title.replace(/[\\/:*?"<>|]/g, '_');
      const filename = `【稟議書】${req.id}_${cleanTitle}.pdf`;

      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.boxShadow = 'none';
      clone.style.margin = '0';
      clone.style.borderRadius = '0';

      // 外部プロキシ併用型Base64自動エンコード ＆ PDF用画像object-fit: contain強制適用
      await this.convertImagesToBase64(clone);

      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          imageTimeout: 15000,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      await html2pdf().set(opt).from(clone).save();
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDFのダウンロード生成に失敗しました。時間をおいて再試行してください。');
    } finally {
      this.isGeneratingPDF.set(false);
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.body.appendChild(script);
    });
  }

  onImageError(event: Event) {
    const target = event.target as HTMLElement;
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent) {
      const fallback = parent.querySelector('.fallback-badge') as HTMLElement;
      if (fallback) {
        fallback.classList.remove('hidden');
      }
    }
  }
}
