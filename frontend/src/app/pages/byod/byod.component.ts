import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ByodService } from '../../core/byod.service';
import {
  ByodRequest,
  ByodStatus,
  ByodApplyType,
  ByodEmploymentType,
  ByodDevice,
  ByodExternalMedia,
  BYOD_STATUS_DISPLAY,
  EMPLOYMENT_TYPE_LABELS,
  APPLY_TYPE_LABELS,
} from '../../core/byod.model';
import { IconComponent } from '../../shared/icon.component';

type FilterType = 'all' | 'pending_manager' | 'pending_security' | 'completed';
type DocViewTab = 'both' | 'pledge' | 'device_detail';

@Component({
  selector: 'app-byod',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <!-- エッジ・トゥ・エッジ フルキャンバスコンテナ -->
    <div class="-mx-4 -my-4 md:-mx-6 md:-my-5 min-h-[calc(100vh-3.5rem)] flex flex-col bg-slate-100/80 text-slate-800 font-sans">
      
      <!-- トップ ヘッダーバー -->
      <header class="border-b border-slate-200 bg-white px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-30 shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
            <app-icon name="box" class="text-lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-bold text-slate-900 tracking-tight">BYOD（私物情報端末等）利用申請</h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                セキュリティ誓約・管理台帳
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              個人PC・タブレット・USBストレージ持込申請（利用申請書 兼 誓約書 ＆ 機材明細書 自動生成）
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-700/20 transition-all duration-200 active:scale-95"
          >
            <span class="text-base leading-none font-normal">+</span>
            <span>新規BYOD申請を作成</span>
          </button>
        </div>
      </header>

      <!-- メイン 2カラム スプリットビュー -->
      <div class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        <!-- 左サイドペイン: BYOD申請一覧 -->
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

              @if (pendingSecurityCount() > 0) {
                <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-full animate-pulse">
                  <span>🛡️ 責任者決裁待ち</span>
                  <span>{{ pendingSecurityCount() }}件</span>
                </span>
              }
            </div>

            <!-- クイックフィルターボタン -->
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                (click)="setFilter('all')"
                [class.bg-blue-700]="activeFilter() === 'all'"
                [class.text-white]="activeFilter() === 'all'"
                [class.bg-white]="activeFilter() !== 'all'"
                [class.text-slate-600]="activeFilter() !== 'all'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                全件
              </button>
              <button
                type="button"
                (click)="setFilter('pending_manager')"
                [class.bg-amber-600]="activeFilter() === 'pending_manager'"
                [class.text-white]="activeFilter() === 'pending_manager'"
                [class.bg-white]="activeFilter() !== 'pending_manager'"
                [class.text-slate-600]="activeFilter() !== 'pending_manager'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                ⏳ 所属長待ち
              </button>
              <button
                type="button"
                (click)="setFilter('pending_security')"
                [class.bg-indigo-600]="activeFilter() === 'pending_security'"
                [class.text-white]="activeFilter() === 'pending_security'"
                [class.bg-white]="activeFilter() !== 'pending_security'"
                [class.text-slate-600]="activeFilter() !== 'pending_security'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                🛡️ 責任者待ち
              </button>
              <button
                type="button"
                (click)="setFilter('completed')"
                [class.bg-emerald-600]="activeFilter() === 'completed'"
                [class.text-white]="activeFilter() === 'completed'"
                [class.bg-white]="activeFilter() !== 'completed'"
                [class.text-slate-600]="activeFilter() !== 'completed'"
                class="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 transition"
              >
                ✅ 決裁完了
              </button>
            </div>
          </div>

          <!-- スクロール可能な一覧エリア -->
          <div class="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[35vh] lg:max-h-none bg-slate-50/30">
            @for (req of filteredRequests(); track req.id) {
              <div
                (click)="selectRequest(req)"
                [class.bg-blue-50/70]="selectedRequest()?.id === req.id"
                [class.border-blue-600]="selectedRequest()?.id === req.id"
                [class.shadow-md]="selectedRequest()?.id === req.id"
                [class.bg-slate-100/70]="req.status === 'security_approved' && selectedRequest()?.id !== req.id"
                [class.border-slate-200]="selectedRequest()?.id !== req.id"
                class="group p-3 rounded-xl border bg-white hover:border-blue-300 hover:shadow-xs cursor-pointer transition-all duration-150 relative overflow-hidden"
              >
                <!-- アクティブインジケータ -->
                @if (selectedRequest()?.id === req.id) {
                  <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-700"></div>
                }

                <div class="flex justify-between items-start mb-1.5 gap-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-300">
                      {{ applyTypeLabel(req.apply_type) }}
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

                <div class="flex items-center justify-between gap-1 mb-1">
                  <h3 class="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                    {{ req.applicant_name }}
                    <span class="text-[10px] font-normal text-slate-500">
                      ({{ req.applicant_department }} / {{ employmentTypeLabel(req.employment_type) }})
                    </span>
                  </h3>
                  <span class="text-[9.5px] font-mono text-slate-400">{{ req.created_at }}</span>
                </div>

                <!-- 申請機材サマリーバッジ -->
                <div class="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span class="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                    💻 PC: {{ req.count_pc }}台
                  </span>
                  @if (req.count_tablet > 0) {
                    <span class="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">
                      📱 タブレット: {{ req.count_tablet }}台
                    </span>
                  }
                  @if (req.count_media > 0) {
                    <span class="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                      💾 記録媒体: {{ req.count_media }}個
                    </span>
                  }
                </div>

                <!-- 端末機種名のプレビュー -->
                <div class="text-[10.5px] text-slate-500 truncate pt-1 border-t border-slate-100">
                  @if (req.devices.length > 0) {
                    <span>{{ req.devices[0].manufacturer }}</span>
                    @if (req.devices.length > 1) {
                      <span class="text-slate-400"> 外{{ req.devices.length - 1 }}件</span>
                    }
                  }
                </div>
              </div>
            } @empty {
              <div class="p-8 text-center text-slate-400 text-xs">
                該当するBYOD申請はありません。
              </div>
            }
          </div>
        </aside>

        <!-- 右メインペイン: BYOD申請プレビュー ＆ 承認キャンバス -->
        <main class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 flex flex-col items-center">
          @if (selectedRequest(); as req) {
            <div class="w-full space-y-3.5 max-w-4xl">
              
              <!-- 承認進捗 ＆ アクションカード -->
              <div class="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                <!-- ヘッダー -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 class="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-blue-700"></span>
                      <span>BYOD 審査・承認フロー進捗</span>
                    </h3>
                    <div class="mt-1 flex items-center gap-2">
                      <span
                        class="text-xs font-bold px-2 py-0.5 rounded-full border"
                        [ngClass]="statusDisplay(req.status).colorClass"
                      >
                        {{ statusDisplay(req.status).label }}
                      </span>
                      @if (req.expire_date) {
                        <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          有効期限: {{ req.expire_date }}
                        </span>
                      }
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
                        <span>{{ req.status === 'security_approved' ? '決裁完了（編集不可）' : '審査中（編集不可）' }}</span>
                      </span>
                    }

                    <!-- 所属長承認ボタン (submitted 時) -->
                    @if (req.status === 'submitted') {
                      <button
                        type="button"
                        (click)="approveAsManager(req)"
                        class="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm shadow-blue-700/20 transition active:scale-95"
                      >
                        <span>✓</span>
                        <span>所属長として承認する</span>
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

                    <!-- セキュリティ責任者決裁ボタン (manager_approved 時) -->
                    @if (req.status === 'manager_approved') {
                      <button
                        type="button"
                        (click)="approveAsSecurity(req)"
                        class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm shadow-emerald-600/20 transition active:scale-95 animate-pulse"
                      >
                        <span>🛡️</span>
                        <span>情報セキュリティ責任者として決裁（ステッカー交付）</span>
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
                      <div class="stepper-icon">
                        @if (step.completed) {
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        } @else {
                          <span>{{ idx + 1 }}</span>
                        }
                      </div>

                      <div class="stepper-title">{{ step.title }}</div>
                      <div class="stepper-subtitle">
                        @if (step.completed) {
                          <span class="text-emerald-700 font-bold">{{ step.approverName }}</span>
                        } @else if (step.current) {
                          <span class="text-blue-700 font-bold">審査待ち</span>
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

                <!-- 書類切替ナビゲーションバー -->
                <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    プレビュー表示切替：
                  </div>
                  <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                    <button
                      type="button"
                      (click)="docViewTab.set('both')"
                      [class.bg-white]="docViewTab() === 'both'"
                      [class.shadow-xs]="docViewTab() === 'both'"
                      [class.text-blue-800]="docViewTab() === 'both'"
                      [class.font-bold]="docViewTab() === 'both'"
                      class="px-3 py-1 rounded-md text-slate-600 transition"
                    >
                      📚 2枚すべて表示
                    </button>
                    <button
                      type="button"
                      (click)="docViewTab.set('pledge')"
                      [class.bg-white]="docViewTab() === 'pledge'"
                      [class.shadow-xs]="docViewTab() === 'pledge'"
                      [class.text-blue-800]="docViewTab() === 'pledge'"
                      [class.font-bold]="docViewTab() === 'pledge'"
                      class="px-3 py-1 rounded-md text-slate-600 transition"
                    >
                      📄 1. 利用申請書 兼 誓約書
                    </button>
                    <button
                      type="button"
                      (click)="docViewTab.set('device_detail')"
                      [class.bg-white]="docViewTab() === 'device_detail'"
                      [class.shadow-xs]="docViewTab() === 'device_detail'"
                      [class.text-blue-800]="docViewTab() === 'device_detail'"
                      [class.font-bold]="docViewTab() === 'device_detail'"
                      class="px-3 py-1 rounded-md text-slate-600 transition"
                    >
                      💻 2. 端末・記録媒体 明細書
                    </button>
                  </div>
                </div>
              </div>

              <!-- 印刷・PDF出力対象コンテナ -->
              <div id="print-area" class="space-y-6">

                <!-- ════════════════════════════════════════════════════════════
                     【書類1】私物情報端末等 利用申請書 兼 誓約書
                     ════════════════════════════════════════════════════════════ -->
                @if (docViewTab() === 'both' || docViewTab() === 'pledge') {
                  <div class="doc-page bg-white text-slate-900 rounded-xl shadow-md p-6 sm:p-9 space-y-4 border border-slate-200">
                    <!-- ドキュメントヘッダー -->
                    <div class="flex justify-between items-start text-[11px] text-slate-600 border-b border-slate-200 pb-2">
                      <div>文書番号：<span class="font-mono font-bold">{{ req.doc_no }}</span></div>
                      <div>制定日：2026年4月1日 / 改訂：第1版</div>
                    </div>

                    <div class="text-center pt-1 pb-2">
                      <h1 class="text-xl sm:text-2xl font-bold tracking-[0.2em] text-slate-900 border-b-2 border-slate-900 pb-2 inline-block w-full">
                        私物情報端末等 利用申請書 兼 誓約書
                      </h1>
                    </div>

                    <p class="text-xs leading-relaxed text-justify text-slate-800 indent-4">
                      <b>株式会社亜細亜堂</b>（以下「会社」という）に対し、業務遂行を目的として私物情報端末および外部記録媒体（以下「私物端末等」という）を社内ネットワーク（有線LAN／無線Wi-Fi）に接続し、業務データを取り扱うにあたり、下記の通り申請いたします。併せて、後記の「私物情報端末等 利用誓約条項」を遵守することを固く誓約いたします。
                    </p>

                    <!-- 1. 申請者情報 -->
                    <div>
                      <div class="text-xs font-bold text-slate-900 border-l-4 border-blue-900 pl-2 mb-1.5">
                        1. 申請者情報
                      </div>
                      <table class="byod-table text-xs">
                        <tr>
                          <th class="w-[18%]">申請日</th>
                          <td class="w-[42%] font-mono">{{ req.created_at }}</td>
                          <th class="w-[20%]">雇用形態 / 区分</th>
                          <td class="w-[20%]">
                            <span class="font-bold text-blue-900">☑ {{ employmentTypeLabel(req.employment_type) }}</span>
                          </td>
                        </tr>
                        <tr>
                          <th>所属部署</th>
                          <td>{{ req.applicant_department }}</td>
                          <th>役職 / 職名</th>
                          <td>{{ req.applicant_role || 'スタッフ' }}</td>
                        </tr>
                        <tr>
                          <th>社員/スタッフ番号</th>
                          <td class="font-mono">{{ req.staff_number || '—' }}</td>
                          <th>連絡先（内線/携帯）</th>
                          <td class="font-mono">{{ req.contact_info }}</td>
                        </tr>
                        <tr>
                          <th>氏名（自署）</th>
                          <td colspan="3" class="text-base font-bold tracking-wider py-2">
                            {{ req.applicant_name }}
                          </td>
                        </tr>
                      </table>
                    </div>

                    <!-- 2. 申請機材サマリー -->
                    <div>
                      <div class="text-xs font-bold text-slate-900 border-l-4 border-blue-900 pl-2 mb-1.5">
                        2. 申請機材サマリー（詳細は「別紙：申請対象端末・記録媒体明細書」に記載）
                      </div>
                      <table class="byod-table text-xs">
                        <tr>
                          <th class="w-[22%]">申請機材内訳<br><span class="text-[10px] text-slate-500 font-normal">（該当数）</span></th>
                          <td colspan="3">
                            PC（Windows/Mac等）：<b class="text-blue-900">（ {{ req.count_pc }} ）台</b> &nbsp;&nbsp;／&nbsp;&nbsp;
                            タブレット（iPad等）：<b class="text-blue-900">（ {{ req.count_tablet }} ）台</b><br>
                            外部記録媒体（USBメモリ・SSD等）：<b class="text-blue-900">（ {{ req.count_media }} ）個</b> &nbsp;&nbsp;／&nbsp;&nbsp;
                            その他：<b>（ {{ req.count_other }} ）点</b>
                          </td>
                        </tr>
                        <tr>
                          <th>添付別紙枚数</th>
                          <td>別紙明細書：<b class="text-blue-900">計（ {{ req.sheet_count }} ）枚</b> 添付</td>
                          <th class="w-[20%]">申請区分</th>
                          <td><span class="font-bold text-blue-900">☑ {{ applyTypeLabel(req.apply_type) }}</span></td>
                        </tr>
                      </table>
                    </div>

                    <!-- 3. 私物情報端末等 利用誓約条項 -->
                    <div>
                      <div class="text-xs font-bold text-slate-900 border-l-4 border-blue-900 pl-2 mb-1.5">
                        3. 私物情報端末等 利用誓約条項
                      </div>
                      <div class="p-3 bg-slate-50 border border-slate-300 rounded text-[11px] leading-relaxed text-slate-700 max-h-56 overflow-y-auto space-y-1.5">
                        <div>
                          <strong class="text-blue-950">第1条（目的及び遵守義務）</strong>
                          <p class="pl-2">申請者は、株式会社亜細亜堂の情報資産および知的財産を保護し、機密情報および個人情報の漏洩等を未然に防止するため、本誓約書各条項および会社の定める情報セキュリティ関連諸規程を遵守することを誓約します。</p>
                        </div>
                        <div>
                          <strong class="text-blue-950">第2条（申請および承認、シャドーITの禁止）</strong>
                          <p class="pl-2">承認端末等のみを社内ネットワーク（有線LAN、Wi-Fi、VPN）へ接続し、未登録機器の無断接続を一切行いません。承認後に交付される「管理登録ステッカー」を現品に貼付し、判読可能な状態を維持します。</p>
                        </div>
                        <div>
                          <strong class="text-blue-950">第3条（セキュリティ基準の遵守義務）</strong>
                          <p class="pl-2">ストレージ暗号化（BitLocker/FileVault/iOSパスコード）、最新パッチ適用、自動画面ロック（10分以内）、セキュリティ対策ソフトウェアの常時稼働を徹底し、ファイル共有ソフト等の使用・脱獄改造を行いません。</p>
                        </div>
                        <div>
                          <strong class="text-blue-950">第4条（機密保持及びデータ管理）</strong>
                          <p class="pl-2">業務目的外の利用・第三者開示を禁じ、個人用クラウド（Google Drive, Dropbox等）への業務データ保存を行いません。退職時・承認満了時にはデータを完全消去します。</p>
                        </div>
                        <div>
                          <strong class="text-blue-950">第5条（アクセスログの取得・監視および検査への同意）</strong>
                          <p class="pl-2">会社が通信トラフィック等のログを取得・監視することに同意し、セキュリティ疑義時の端末検査に協力します。</p>
                        </div>
                        <div>
                          <strong class="text-blue-950">第6条（紛失・盗難・事故発生時の即時報告）</strong>
                          <p class="pl-2">端末や外部媒体の紛失、盗難、感染の疑いが生じた際は、直ちに情報セキュリティ責任者および所属長へ報告し、二次被害防止措置を実行します。</p>
                        </div>
                        <div>
                          <strong class="text-blue-950">第7条（違反時の措置および損害賠償）／ 第8条（退職時の措置）</strong>
                          <p class="pl-2">違反時は就業規則に基づく懲戒処分および損害賠償責任の対象となることを承諾します。退職時は本承認は失効し、業務データを全消去します。</p>
                        </div>
                      </div>
                    </div>

                    <!-- 4. 誓約・署名欄 -->
                    <div class="p-3.5 border-2 border-slate-900 bg-white space-y-3">
                      <div class="text-xs font-bold text-center text-slate-900">
                        「私は、上記事項および社内セキュリティ方針の趣旨を完全に理解・承諾の上、本誓約書に記載のすべての義務を誠実に履行することを誓約し、私物端末等の利用を申請します。」
                      </div>
                      <div class="flex justify-between items-end text-xs pt-1">
                        <div>
                          誓約日：<span class="font-mono font-bold">{{ req.pledge_date || req.created_at }}</span><br>
                          所属部署：<u>&nbsp;&nbsp;{{ req.applicant_department }}&nbsp;&nbsp;</u>
                        </div>
                        <div class="flex items-center gap-2">
                          <span>氏名（自署）：<u>&nbsp;&nbsp;{{ req.applicant_name }}&nbsp;&nbsp;</u></span>
                          <!-- 申請者デジタル印 -->
                          <div class="w-10 h-10 border border-slate-700 border-dashed rounded-full flex items-center justify-center text-[10px] text-slate-500 font-serif">
                            @if (req.stamps[2] && req.stamps[2].completed) {
                              <span class="text-rose-600 font-bold">㊞ {{ req.stamps[2].approverName }}</span>
                            } @else {
                              ㊞
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 5. 会社総合承認欄 -->
                    <div>
                      <div class="text-xs font-bold text-slate-900 border-l-4 border-blue-900 pl-2 mb-1.5">
                        4. 会社総合承認欄（※以下は記入しないでください）
                      </div>
                      <table class="byod-table text-xs text-center">
                        <tr class="bg-slate-100 font-bold">
                          <th class="w-[33%] text-center">所属長 承認印</th>
                          <th class="w-[34%] text-center">情報セキュリティ責任者 承認印</th>
                          <th class="w-[33%] text-center">総合承認日・有効期限</th>
                        </tr>
                        <tr>
                          <!-- 所属長印 -->
                          <td class="h-16 vertical-middle">
                            @if (req.stamps[1] && req.stamps[1].completed) {
                              <div class="inline-flex flex-col items-center justify-center p-1 border-2 border-double border-rose-600 rounded-full w-12 h-12 text-rose-600 font-serif leading-none">
                                <span class="text-[7px]">所属長</span>
                                <span class="text-[6.5px] border-y border-rose-600 py-0.5 my-0.5">{{ req.stamps[1].approvedDate }}</span>
                                <span class="text-[8px] font-bold">{{ req.stamps[1].approverName }}</span>
                              </div>
                            } @else {
                              <span class="text-slate-300 text-xs">未承認</span>
                            }
                          </td>

                          <!-- セキュリティ責任者印 -->
                          <td class="h-16 vertical-middle">
                            @if (req.stamps[0] && req.stamps[0].completed) {
                              <div class="inline-flex flex-col items-center justify-center p-1 border-2 border-double border-rose-600 rounded-full w-12 h-12 text-rose-600 font-serif leading-none">
                                <span class="text-[7px]">セキ責</span>
                                <span class="text-[6.5px] border-y border-rose-600 py-0.5 my-0.5">{{ req.stamps[0].approvedDate }}</span>
                                <span class="text-[8px] font-bold">{{ req.stamps[0].approverName }}</span>
                              </div>
                            } @else {
                              <span class="text-slate-300 text-xs">未決裁</span>
                            }
                          </td>

                          <td class="text-left text-[11px] p-2 leading-relaxed">
                            承認日：<span class="font-mono font-bold">{{ req.security_approved_date || '2026年&nbsp;&nbsp;月&nbsp;&nbsp;日' }}</span><br>
                            有効期限：<span class="font-mono font-bold text-blue-900">{{ req.expire_date || '2027年03月31日' }}</span><br>
                            <span class="text-[9.5px] text-slate-500">（※最長1年 / 毎年度更新）</span>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <div class="text-[9px] text-slate-400 flex justify-between pt-1 border-t border-slate-200">
                      <span>株式会社亜細亜堂 情報セキュリティ管理システム</span>
                      <span>PAGE 1 OF 2</span>
                    </div>
                  </div>
                }

                <!-- ════════════════════════════════════════════════════════════
                     【書類2】申請対象端末・外部記録媒体 明細書
                     ════════════════════════════════════════════════════════════ -->
                @if (docViewTab() === 'both' || docViewTab() === 'device_detail') {
                  <div class="doc-page bg-white text-slate-900 rounded-xl shadow-md p-6 sm:p-9 space-y-4 border border-slate-200">
                    <div class="flex justify-between items-start text-[11px] text-slate-600 border-b border-slate-200 pb-2">
                      <div><b>機材明細書（兼 管理台帳）</b> / 株式会社亜細亜堂</div>
                      <div>
                        所属：<u>&nbsp;&nbsp;{{ req.applicant_department }}&nbsp;&nbsp;</u>&nbsp;&nbsp;
                        氏名：<u>&nbsp;&nbsp;{{ req.applicant_name }}&nbsp;&nbsp;</u>
                        （全{{ req.sheet_count }}枚中 1枚目）
                      </div>
                    </div>

                    <div class="text-center pt-1 pb-1">
                      <h1 class="text-xl sm:text-2xl font-bold tracking-[0.15em] text-slate-900 border-b-2 border-slate-900 pb-2 inline-block w-full">
                        申請対象端末・外部記録媒体 明細書
                      </h1>
                    </div>

                    <p class="text-[11px] text-slate-500 leading-tight">
                      ※申請する機器・外部記録媒体ごとに枠を分けて記入してください。<br>
                      ※USBメモリ等の外部記憶媒体については、承認後に交付される「管理登録ステッカー」を現品に必ず貼付してください。
                    </p>

                    <!-- 機材記入カード一覧 -->
                    @for (device of req.devices; track device.id; let idx = $index) {
                      <div class="border border-slate-600 rounded-md overflow-hidden bg-white text-xs">
                        <div class="bg-slate-200 px-3 py-1.5 font-bold flex justify-between items-center border-b border-slate-600">
                          <div>
                            機材番号［ {{ idx + 1 }} ］（ {{ device.device_type_label }} ）
                          </div>
                          <div class="text-[11px] text-slate-800">
                            ステッカー番号：
                            <b class="font-mono text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-400">
                              【 {{ device.sticker_no || '交付待ち' }} 】
                            </b>
                          </div>
                        </div>

                        <table class="byod-table text-xs">
                          <tr>
                            <th class="w-[20%]">メーカー / 機種名</th>
                            <td class="w-[30%] font-medium">{{ device.manufacturer }}</td>
                            <th class="w-[20%]">型番 / シリアルNo.</th>
                            <td class="w-[30%] font-mono">{{ device.model_or_serial }}</td>
                          </tr>
                          <tr>
                            <th>OS / バージョン</th>
                            <td class="font-mono">{{ device.os_version }}</td>
                            <th>MACアドレス<br><span class="text-[9.5px] font-normal text-slate-500">(Wi-Fi / LAN)</span></th>
                            <td class="font-mono font-bold text-slate-800">{{ device.mac_address || '—' }}</td>
                          </tr>
                          <tr>
                            <th>暗号化設定<br><span class="text-[9px] bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-bold">必須</span></th>
                            <td colspan="3">
                              <span class="font-bold text-blue-900">
                                ☑ {{ getEncryptionLabel(device.encryption) }}
                              </span>
                              <span class="text-[10px] text-slate-500 ml-2">（常時ストレージ全体暗号化）</span>
                            </td>
                          </tr>
                          <tr>
                            <th>セキュリティソフト</th>
                            <td>
                              {{ device.security_software }}
                              <span class="text-[10px] text-slate-500 font-mono ml-1">
                                (自動更新: {{ device.auto_update ? '☑有' : '無' }})
                              </span>
                            </td>
                            <th>業務上の利用理由</th>
                            <td class="text-[11px] leading-relaxed">{{ device.purpose }}</td>
                          </tr>
                          <tr class="bg-slate-50 text-[10.5px]">
                            <th>管理部門確認欄<br><span class="text-[9px] text-slate-400 font-normal">(※記入不要)</span></th>
                            <td colspan="3">
                              <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex items-center gap-3">
                                  <span>{{ device.admin_verified_encryption ? '☑' : '☐' }} 暗号化目視確認済</span>
                                  <span>{{ device.admin_verified_security ? '☑' : '☐' }} セキュリティ対策ソフト確認済</span>
                                  <span>{{ device.admin_sticker_attached ? '☑' : '☐' }} 管理ステッカー貼付完了</span>
                                </div>
                                <div class="font-serif text-slate-600">
                                  ［確認印：{{ device.admin_checker_name ? device.admin_checker_name : '　　' }}］
                                </div>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </div>
                    }

                    <!-- 外部記録媒体向け一括記載欄 -->
                    <div>
                      <div class="text-xs font-bold text-slate-900 border-l-4 border-blue-900 pl-2 mb-1.5">
                        外部記録媒体（USBメモリ・SDカード・外付けSSD/HDD等）一括記載欄
                      </div>
                      <table class="byod-table text-xs text-center">
                        <tr class="bg-slate-200 font-bold text-[11px]">
                          <th class="w-[6%] text-center">No</th>
                          <th class="w-[25%] text-center">種別・メーカー・容量</th>
                          <th class="w-[25%] text-center">シリアル番号 / 識別名</th>
                          <th class="w-[22%] text-center">暗号化機能の有無</th>
                          <th class="w-[22%] text-center">ステッカー番号 / 管理印</th>
                        </tr>
                        @for (media of req.external_media; track media.no) {
                          <tr>
                            <td class="font-bold font-mono">{{ media.no }}</td>
                            <td class="text-left">
                              <span class="font-bold text-blue-900">☑ {{ media.media_type.toUpperCase() }}</span>
                              <div class="text-[10px] text-slate-600">{{ media.maker_and_model }} ({{ media.capacity }})</div>
                            </td>
                            <td class="font-mono text-left text-[11px]">{{ media.serial_or_name }}</td>
                            <td class="text-left text-[10.5px]">
                              @if (media.has_encryption) {
                                <span class="font-bold text-emerald-800">☑ 暗号化あり</span>
                                <div class="text-[9.5px] text-slate-500">{{ media.encryption_method || 'ハードウェア暗号化' }}</div>
                              } @else {
                                <span class="text-amber-800">☐ なし（会社承認要）</span>
                              }
                            </td>
                            <td class="text-left text-[10px] font-mono leading-tight">
                              ステッカー：【{{ media.sticker_no || '未交付' }}】<br>
                              確認印：［{{ media.admin_confirmed ? '確認済' : '　　' }}］
                            </td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="5" class="p-3 text-slate-400 text-[11px]">
                              外部記録媒体の申請はありません。
                            </td>
                          </tr>
                        }
                      </table>
                    </div>

                    <div class="text-[9px] text-slate-400 flex justify-between pt-1 border-t border-slate-200">
                      <span>株式会社亜細亜堂 情報セキュリティ管理システム</span>
                      <span>PAGE 2 OF 2</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div class="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-700 text-3xl mb-3">
                💻
              </div>
              <h3 class="text-sm font-bold text-slate-600">申請が選択されていません</h3>
              <p class="text-xs text-slate-400 mt-1">左側の一覧からBYOD申請を選択するか、新規申請を作成してください。</p>
            </div>
          }
        </main>
      </div>

      <!-- 新規申請 / 編集モーダル -->
      @if (showFormModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 my-6">
            <!-- モーダルヘッダー -->
            <div class="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-slate-900">
                  {{ isEditing() ? 'BYOD利用申請の内容を編集' : '新規 BYOD利用申請の起案' }}
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">
                  社内ネットワークに接続する私物PC・外部メディアの仕様とセキュリティ設定を入力してください。
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

            <!-- フォーム入力エリア -->
            <form (ngSubmit)="submitForm()" class="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              
              <!-- 申請区分 ＆ 雇用形態 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">申請区分 <span class="text-rose-500">*</span></label>
                  <select
                    [(ngModel)]="formData.apply_type"
                    name="apply_type"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="new">新規申請</option>
                    <option value="update">追加・変更申請</option>
                    <option value="annual">年次更新</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">雇用形態 / 区分 <span class="text-rose-500">*</span></label>
                  <select
                    [(ngModel)]="formData.employment_type"
                    name="employment_type"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="regular">正社員</option>
                    <option value="contract">契約社員</option>
                    <option value="dispatch">派遣スタッフ</option>
                    <option value="freelance">業務委託 (アニメーター/演出等)</option>
                  </select>
                </div>
              </div>

              <!-- 申請者情報 -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">申請者氏名 <span class="text-rose-500">*</span></label>
                  <input
                    type="text"
                    [(ngModel)]="formData.applicant_name"
                    name="applicant_name"
                    required
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">所属部署 <span class="text-rose-500">*</span></label>
                  <select
                    [(ngModel)]="formData.applicant_department"
                    name="applicant_department"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="作画部">作画部</option>
                    <option value="制作部">制作部</option>
                    <option value="仕上部">仕上部</option>
                    <option value="美術部">美術部</option>
                    <option value="CG・撮影部">CG・撮影部</option>
                    <option value="演出部">演出部</option>
                    <option value="総務部">総務部</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">役職 / 職名</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.applicant_role"
                    name="applicant_role"
                    placeholder="例: 原画マン, 3Dモデラー, 制作進行"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">社員/スタッフ番号</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.staff_number"
                    name="staff_number"
                    placeholder="例: A-042"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">連絡先（内線/携帯番号） <span class="text-rose-500">*</span></label>
                  <input
                    type="text"
                    [(ngModel)]="formData.contact_info"
                    name="contact_info"
                    required
                    placeholder="例: 090-xxxx-xxxx / 内線: 201"
                    class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <!-- 端末・デバイス入力欄 (複数可能) -->
              <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h4 class="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>💻 申請対象端末（PC / タブレット等）</span>
                    <span class="text-[10px] text-slate-500 font-normal">({{ formData.devices.length }}台)</span>
                  </h4>
                  <button
                    type="button"
                    (click)="addDevice()"
                    class="text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
                  >
                    + 端末を追加
                  </button>
                </div>

                @for (dev of formData.devices; track dev.id; let idx = $index) {
                  <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 relative">
                    <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span class="font-bold text-slate-700">機材［{{ idx + 1 }}］</span>
                      @if (formData.devices.length > 1) {
                        <button
                          type="button"
                          (click)="removeDevice(idx)"
                          class="text-rose-600 hover:text-rose-700 text-[11px] font-bold"
                        >
                          削除
                        </button>
                      }
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">種別</label>
                        <input
                          type="text"
                          [(ngModel)]="dev.device_type_label"
                          [name]="'dev_type_' + idx"
                          placeholder="例: Windows PC, MacBook Pro, iPad"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">メーカー / 機種名 <span class="text-rose-500">*</span></label>
                        <input
                          type="text"
                          [(ngModel)]="dev.manufacturer"
                          [name]="'dev_maker_' + idx"
                          required
                          placeholder="例: Apple / MacBook Pro 16"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">型番 / シリアルNo. <span class="text-rose-500">*</span></label>
                        <input
                          type="text"
                          [(ngModel)]="dev.model_or_serial"
                          [name]="'dev_serial_' + idx"
                          required
                          placeholder="例: C02GXXXXX"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">OS / バージョン <span class="text-rose-500">*</span></label>
                        <input
                          type="text"
                          [(ngModel)]="dev.os_version"
                          [name]="'dev_os_' + idx"
                          required
                          placeholder="例: macOS 14.5 / Windows 11 23H2"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">MACアドレス (Wi-Fi/LAN)</label>
                        <input
                          type="text"
                          [(ngModel)]="dev.mac_address"
                          [name]="'dev_mac_' + idx"
                          placeholder="例: AA:BB:CC:DD:EE:FF"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">暗号化設定 <span class="text-rose-500">*</span></label>
                        <select
                          [(ngModel)]="dev.encryption"
                          [name]="'dev_enc_' + idx"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                        >
                          <option value="bitlocker">BitLocker (Windows)</option>
                          <option value="filevault">FileVault (Mac)</option>
                          <option value="ios">iOS/iPadOS パスコード保護</option>
                          <option value="hardware">ハードウェア暗号化</option>
                          <option value="other">その他</option>
                        </select>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">セキュリティ対策ソフト名</label>
                        <input
                          type="text"
                          [(ngModel)]="dev.security_software"
                          [name]="'dev_sec_' + idx"
                          placeholder="例: ESET, Defender, Sophos"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-0.5">業務上の利用理由 <span class="text-rose-500">*</span></label>
                        <input
                          type="text"
                          [(ngModel)]="dev.purpose"
                          [name]="'dev_purpose_' + idx"
                          required
                          placeholder="例: 作画データ作成および自宅・スタジオ間の同期作業"
                          class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                }
              </div>

              <!-- 外部記録媒体入力欄 (複数可能) -->
              <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h4 class="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>💾 外部記録媒体（USBメモリ・外付けSSD/HDD等）</span>
                    <span class="text-[10px] text-slate-500 font-normal">({{ formData.external_media.length }}個)</span>
                  </h4>
                  <button
                    type="button"
                    (click)="addMedia()"
                    class="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
                  >
                    + 外部媒体を追加
                  </button>
                </div>

                @for (med of formData.external_media; track med.no; let mIdx = $index) {
                  <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    <div>
                      <label class="block text-[11px] font-bold text-slate-600 mb-0.5">種別</label>
                      <select
                        [(ngModel)]="med.media_type"
                        [name]="'med_type_' + mIdx"
                        class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="usb">USBメモリ</option>
                        <option value="ssd">ポータブルSSD</option>
                        <option value="hdd">外付けHDD</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-slate-600 mb-0.5">メーカー・機種・容量</label>
                      <input
                        type="text"
                        [(ngModel)]="med.maker_and_model"
                        [name]="'med_maker_' + mIdx"
                        placeholder="例: SanDisk Extreme (1TB)"
                        class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-slate-600 mb-0.5">シリアル番号 / 識別名</label>
                      <input
                        type="text"
                        [(ngModel)]="med.serial_or_name"
                        [name]="'med_serial_' + mIdx"
                        placeholder="例: SN: 231189401"
                        class="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div class="flex items-center justify-between pt-3 sm:pt-0">
                      <label class="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          [(ngModel)]="med.has_encryption"
                          [name]="'med_enc_' + mIdx"
                          class="w-4 h-4 rounded text-blue-700"
                        />
                        <span class="text-[11px] font-bold text-slate-700">暗号化あり</span>
                      </label>
                      <button
                        type="button"
                        (click)="removeMedia(mIdx)"
                        class="text-rose-600 hover:text-rose-700 text-[11px] font-bold ml-2"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- 誓約書同意チェックボックス -->
              <div class="p-3.5 bg-blue-50 border-2 border-blue-300 rounded-xl space-y-1.5">
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="formData.pledge_agreed"
                    name="pledge_agreed"
                    required
                    class="w-4 h-4 rounded text-blue-700 mt-0.5"
                  />
                  <div class="text-xs text-blue-950 font-bold leading-relaxed">
                    【必須】株式会社亜細亜堂の「私物情報端末等 利用誓約条項（第1条〜第8条）」の全内容を熟読の上、完全に承諾し、業務上の秘密保持およびセキュリティ義務を誠実に履行することを誓約します。
                  </div>
                </label>
              </div>

              <!-- フッターアクション -->
              <div class="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  (click)="closeFormModal()"
                  class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  [disabled]="!formData.pledge_agreed"
                  class="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition active:scale-95"
                >
                  {{ isEditing() ? '変更を保存する' : '誓約書を提出する' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- 差戻しモーダル -->
      @if (showRejectModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div class="px-6 py-4 border-b border-slate-200 bg-rose-50 flex items-center justify-between">
              <h3 class="text-base font-bold text-rose-950">BYOD申請の差戻し</h3>
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
                  placeholder="暗号化設定の確認不足やセキュリティソフトの導入不備等、差戻しの理由を入力してください。"
                  class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-rose-500"
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
      /* テーブルスタイル（亜細亜堂 公式書式再現） */
      .byod-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
      }

      .byod-table th,
      .byod-table td {
        border: 1px solid #475569;
        padding: 5px 8px;
        vertical-align: middle;
      }

      .byod-table th {
        background-color: #f1f5f9;
        font-weight: 600;
        text-align: left;
        color: #1e293b;
      }

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
        background-color: #dbeafe;
        border-color: #1d4ed8;
        color: #1d4ed8;
        transform: scale(1.1);
        box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.15);
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
export class ByodComponent {
  private readonly byodService = inject(ByodService);
  private readonly auth = inject(AuthService);

  readonly requests = this.byodService.requests;
  readonly selectedRequest = signal<ByodRequest | null>(null);
  readonly activeFilter = signal<FilterType>('all');
  readonly docViewTab = signal<DocViewTab>('both');

  // モーダル制御
  readonly showFormModal = signal(false);
  readonly isEditing = signal(false);
  readonly showRejectModal = signal(false);

  // PDF出力状態
  readonly isGeneratingPDF = signal(false);

  // フォームデータ
  formData: {
    id?: string;
    apply_type: ByodApplyType;
    employment_type: ByodEmploymentType;
    applicant_name: string;
    applicant_department: string;
    applicant_role: string;
    staff_number: string;
    contact_info: string;
    devices: ByodDevice[];
    external_media: ByodExternalMedia[];
    pledge_agreed: boolean;
  } = this.getEmptyFormData();

  rejectReason = '';

  // 責任者決裁待ち件数
  readonly pendingSecurityCount = computed(
    () => this.requests().filter((r) => r.status === 'manager_approved').length
  );

  // フィルタリングされた申請リスト
  readonly filteredRequests = computed(() => {
    const list = this.requests();
    const filter = this.activeFilter();
    if (filter === 'all') return list;
    if (filter === 'pending_manager')
      return list.filter((r) => r.status === 'submitted');
    if (filter === 'pending_security')
      return list.filter((r) => r.status === 'manager_approved');
    if (filter === 'completed')
      return list.filter((r) => r.status === 'security_approved');
    return list;
  });

  constructor() {
    const current = this.requests();
    if (current.length > 0) {
      this.selectedRequest.set(current[0]);
    }
  }

  setFilter(filter: FilterType) {
    this.activeFilter.set(filter);
  }

  selectRequest(req: ByodRequest) {
    this.selectedRequest.set(req);
  }

  statusDisplay(status: ByodStatus) {
    return BYOD_STATUS_DISPLAY[status];
  }

  employmentTypeLabel(type: ByodEmploymentType) {
    return EMPLOYMENT_TYPE_LABELS[type] || type;
  }

  applyTypeLabel(type: ByodApplyType) {
    return APPLY_TYPE_LABELS[type] || type;
  }

  getEncryptionLabel(enc: string) {
    switch (enc) {
      case 'bitlocker':
        return 'BitLocker (Windows暗号化)';
      case 'filevault':
        return 'FileVault (Mac暗号化)';
      case 'ios':
        return 'iOS/iPadOS パスコード保護';
      case 'hardware':
        return 'ハードウェア暗号化';
      default:
        return 'その他暗号化設定済';
    }
  }

  // --- モーダル制御 ---

  openCreateModal() {
    this.isEditing.set(false);
    this.formData = this.getEmptyFormData();
    const currentUser = this.auth.user();
    if (currentUser) {
      this.formData.applicant_name = currentUser.name || '';
      this.formData.applicant_department = (currentUser as any).department || '作画部';
    }
    this.showFormModal.set(true);
  }

  openEditModal(req: ByodRequest) {
    if (req.status !== 'submitted') return;
    this.isEditing.set(true);
    this.formData = {
      id: req.id,
      apply_type: req.apply_type,
      employment_type: req.employment_type,
      applicant_name: req.applicant_name,
      applicant_department: req.applicant_department,
      applicant_role: req.applicant_role,
      staff_number: req.staff_number,
      contact_info: req.contact_info,
      devices: JSON.parse(JSON.stringify(req.devices)),
      external_media: JSON.parse(JSON.stringify(req.external_media)),
      pledge_agreed: req.pledge_agreed,
    };
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  addDevice() {
    const newIdx = this.formData.devices.length + 1;
    this.formData.devices.push({
      id: 'dev-' + Date.now(),
      device_category: 'pc_tablet',
      device_type_label: 'PC / タブレット',
      manufacturer: '',
      model_or_serial: '',
      os_version: '',
      mac_address: '',
      encryption: 'filevault',
      security_software: '',
      auto_update: true,
      purpose: '',
    });
  }

  removeDevice(index: number) {
    if (this.formData.devices.length > 1) {
      this.formData.devices.splice(index, 1);
    }
  }

  addMedia() {
    const newNo = this.formData.devices.length + this.formData.external_media.length + 1;
    this.formData.external_media.push({
      no: newNo,
      media_type: 'usb',
      capacity: '64GB',
      maker_and_model: '',
      serial_or_name: '',
      has_encryption: true,
      encryption_method: 'AES 256bit',
      sticker_no: '',
    });
  }

  removeMedia(index: number) {
    this.formData.external_media.splice(index, 1);
  }

  submitForm() {
    if (!this.formData.pledge_agreed) return;

    const now = new Date();
    const created_at = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    if (this.isEditing() && this.formData.id) {
      const updated = this.byodService.updateRequest(this.formData.id, {
        apply_type: this.formData.apply_type,
        employment_type: this.formData.employment_type,
        applicant_name: this.formData.applicant_name,
        applicant_department: this.formData.applicant_department,
        applicant_role: this.formData.applicant_role,
        staff_number: this.formData.staff_number,
        contact_info: this.formData.contact_info,
        devices: this.formData.devices,
        external_media: this.formData.external_media,
        pledge_agreed: true,
        pledge_date: created_at,
      });
      if (updated) {
        this.selectedRequest.set(updated);
      }
    } else {
      const created = this.byodService.createRequest({
        apply_type: this.formData.apply_type,
        employment_type: this.formData.employment_type,
        applicant_name: this.formData.applicant_name,
        applicant_department: this.formData.applicant_department,
        applicant_role: this.formData.applicant_role,
        staff_number: this.formData.staff_number,
        contact_info: this.formData.contact_info,
        created_at,
        devices: this.formData.devices,
        external_media: this.formData.external_media,
        pledge_agreed: true,
        pledge_date: created_at,
      });
      this.selectedRequest.set(created);
    }

    this.showFormModal.set(false);
  }

  // --- 承認アクション ---

  approveAsManager(req: ByodRequest) {
    const currentUser = this.auth.user();
    const managerName = currentUser ? currentUser.name : '所属長 (プロデューサー)';
    const updated = this.byodService.approveByManager(req.id, managerName);
    if (updated) {
      this.selectedRequest.set(updated);
    }
  }

  approveAsSecurity(req: ByodRequest) {
    const currentUser = this.auth.user();
    const securityName = currentUser ? `${currentUser.name} (情報セキュリティ室)` : '情報セキュリティ室長';
    const updated = this.byodService.approveBySecurity(req.id, securityName);
    if (updated) {
      this.selectedRequest.set(updated);
    }
  }

  openRejectModal(req: ByodRequest) {
    this.rejectReason = '';
    this.showRejectModal.set(true);
  }

  confirmRejectAction() {
    const selected = this.selectedRequest();
    if (!selected) return;

    const currentUser = this.auth.user();
    const rejector = currentUser ? currentUser.name : '審査担当';
    const updated = this.byodService.rejectRequest(selected.id, rejector, this.rejectReason);
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
      clone.style.padding = '10px 14px';

      const opt = {
        margin: [4, 4, 4, 4],
        filename: `BYOD利用申請書_${req.id}_${req.applicant_name}.pdf`,
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
      apply_type: 'new' as ByodApplyType,
      employment_type: 'freelance' as ByodEmploymentType,
      applicant_name: '',
      applicant_department: '作画部',
      applicant_role: '',
      staff_number: '',
      contact_info: '',
      devices: [
        {
          id: 'dev-1',
          device_category: 'pc_tablet' as const,
          device_type_label: 'Mac ノートPC',
          manufacturer: 'Apple / MacBook Pro 16',
          model_or_serial: '',
          os_version: 'macOS Sonoma 14.5',
          mac_address: '',
          encryption: 'filevault' as const,
          security_software: 'ESET Cyber Security',
          auto_update: true,
          purpose: '作画データ制作および自宅作業環境との連携。',
        },
      ],
      external_media: [
        {
          no: 2,
          media_type: 'ssd' as const,
          capacity: '1TB',
          maker_and_model: 'SanDisk Extreme Portable SSD',
          serial_or_name: '',
          has_encryption: true,
          encryption_method: 'ハードウェア暗号化',
          sticker_no: '',
        },
      ],
      pledge_agreed: true,
    };
  }
}
