import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import {
  FirestoreDataService,
  VersionBumpType,
  VersionEntry,
} from '../../core/firestore-data.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * HERON 単体テスト環境の「テスト設定」画面。
 *
 * 左: アクセス許可済み Google アカウント（テストメンバー）の管理。
 * 右: リリースごとの Ver情報（版数と変更内容）の記録。いずれも Firestore で全端末共有。
 */
@Component({
  selector: 'app-test-members',
  standalone: true,
  imports: [FormsModule, IconComponent, DatePipe],
  template: `
    <div class="flex flex-col gap-3 pb-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          テスト設定
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          単体テスト環境にログインできるメンバーと、リリースごとのバージョン情報を管理します
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          (click)="refreshData()"
          class="heron-btn-secondary text-xs font-bold"
          [disabled]="refreshing()"
        >
          {{ refreshing() ? '同期中...' : 'Firestore同期' }}
        </button>
        <div class="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded border border-slate-200 shadow-2xs whitespace-nowrap">
          許可メンバー:
          <span class="text-[#2A3A4A] font-mono text-sm font-extrabold">{{ auth.testMembers().length }}</span> 名
        </div>
      </div>
    </div>

    <!-- 注意カード -->
    <div class="mt-4 rounded-md border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 shadow-2xs leading-relaxed space-y-1">
      <div class="font-bold flex items-center gap-1.5 text-blue-950">
        <app-icon name="user" /> HERON 単体テストサーバー（基幹システム連携前）アクセス制御仕様
      </div>
      <p>
        ・本HERONアプリは現在、他基幹システムへの接続前の<strong>単体テストサーバー環境</strong>です。<br />
        ・セキュリティ保護のため、ここで登録された Google アカウント（メールアドレス）を持つメンバーのみがGoogleログインできます。<br />
        ・未登録のGoogleアカウントからのログインは自動的にアクセスが遮断・拒否されます。<br />
        ・<strong>テストメンバーデータは Firebase Firestore に保存され、全端末で即時同期されます。</strong>
      </p>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- 左: テストメンバー管理 -->
      <section>
        <h2 class="text-xs font-bold text-[#2A3A4A] mb-2 flex items-center gap-1.5">
          アクセス許可済みGoogleアカウント一覧
          <span class="text-[10px] font-normal text-slate-400">(Firestore 保存)</span>
        </h2>

        <!-- メンバー追加フォーム -->
        <form
          (ngSubmit)="addMember()"
          class="mb-3 flex flex-col sm:flex-row sm:items-end gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs"
        >
          <div class="flex-1 w-full">
            <label class="heron-label text-xs">新規許可メールアドレス (Googleアカウント)</label>
            <input
              type="email"
              class="heron-input text-xs font-mono"
              placeholder="例: member@ajiado.co.jp"
              [(ngModel)]="newEmail"
              name="newEmail"
              required
            />
          </div>

          <button
            type="submit"
            class="heron-btn-primary shrink-0 text-xs font-bold py-2 px-4 whitespace-nowrap"
            [disabled]="saving()"
          >
            <app-icon name="plus" />
            {{ saving() ? '登録中...' : 'テストメンバーを追加' }}
          </button>
        </form>

        @if (message()) {
          <p
            class="mb-3 rounded px-3 py-2 text-xs font-semibold"
            [class]="
              messageIsError()
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            "
          >
            {{ message() }}
          </p>
        }

        <div class="overflow-x-auto rounded-md border border-slate-200/80 bg-white shadow-2xs">
          <table class="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr class="bg-[#2A3A4A] text-white font-bold tracking-wider text-[11px]">
                <th class="py-2.5 px-3.5">メールアドレス</th>
                <th class="py-2.5 px-3.5">状態</th>
                <th class="py-2.5 px-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              @for (email of auth.testMembers(); track email) {
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="py-2.5 px-3.5 font-mono font-bold text-[#2A3A4A]">{{ email }}</td>
                  <td class="py-2.5 px-3.5">
                    <span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      <app-icon name="check" /> アクセス許可
                    </span>
                  </td>
                  <td class="py-2.5 px-3.5 text-right">
                    @if (email === 'inoue@ajiado.co.jp') {
                      <span class="text-[10px] font-bold text-slate-400">システム所有者</span>
                    } @else {
                      <button
                        type="button"
                        (click)="removeMember(email)"
                        class="text-xs text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded transition border border-rose-200"
                        [disabled]="saving()"
                      >
                        許可解除
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- 右: Ver情報 -->
      <section>
        <h2 class="text-xs font-bold text-[#2A3A4A] mb-2 flex items-center gap-1.5">
          Ver情報 (リリース履歴)
          <span class="text-[10px] font-normal text-slate-400">(Firestore 保存)</span>
        </h2>

        <!-- 現在のバージョン -->
        <div class="rounded-md border border-slate-200/80 bg-[#2A3A4A] text-white p-4 shadow-2xs">
          <div class="text-[10px] font-bold tracking-widest text-[#90CFD6]">現在のバージョン</div>
          @if (current(); as cur) {
            <div class="mt-0.5 font-mono text-2xl font-extrabold tracking-tight">{{ cur.version }}</div>
            <div class="mt-1 text-xs font-bold">{{ cur.title }}</div>
            <div class="mt-0.5 text-[10px] text-slate-300">
              {{ cur.released_at | date: 'yyyy/MM/dd HH:mm' }} ・ {{ cur.released_by }}
            </div>
          } @else {
            <div class="mt-0.5 font-mono text-2xl font-extrabold tracking-tight">
              {{ loading() ? '読み込み中' : '未記録' }}
            </div>
          }
        </div>

        <!-- 採番ルールの説明 -->
        <p class="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          <span class="font-mono font-bold text-[#2A3A4A]">VER 1 . 1 . 1</span> の左から
          <strong>大型</strong>（ほぼ発生しないため通常は使用しない）／
          <strong>中型</strong>（機能の追加・ページの追加など）／
          <strong>小型</strong>（それ以外の細かいデプロイ）で繰り上がります。
        </p>

        <!-- Ver情報の記録フォーム -->
        <form (ngSubmit)="addVersion()" class="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
          <div>
            <label class="heron-label text-xs">アップデート種別</label>
            <div class="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                (click)="bumpType.set('minor')"
                class="rounded-md border px-3 py-2 text-left text-[11px] font-bold transition"
                [class]="
                  bumpType() === 'minor'
                    ? 'border-[#2A3A4A] bg-[#2A3A4A] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                "
              >
                中型アップデート
                <span class="block font-normal opacity-80">機能・ページの追加</span>
              </button>
              <button
                type="button"
                (click)="bumpType.set('patch')"
                class="rounded-md border px-3 py-2 text-left text-[11px] font-bold transition"
                [class]="
                  bumpType() === 'patch'
                    ? 'border-[#2A3A4A] bg-[#2A3A4A] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                "
              >
                小型アップデート
                <span class="block font-normal opacity-80">その他の細かい更新</span>
              </button>
            </div>
            <p class="mt-1.5 text-[11px] text-slate-500">
              記録される版数:
              <span class="font-mono font-bold text-[#2A3A4A]">{{ nextVersion() }}</span>
            </p>
          </div>

          <div>
            <label class="heron-label text-xs" for="verTitle">概要 <span class="text-red-600">*</span></label>
            <input
              id="verTitle"
              name="verTitle"
              class="heron-input text-xs"
              placeholder="例: 棚卸し結果のCSV出力を追加"
              [(ngModel)]="versionTitle"
            />
          </div>

          <div>
            <label class="heron-label text-xs" for="verDesc">
              変更・更新内容 <span class="text-red-600">*</span>
            </label>
            <textarea
              id="verDesc"
              name="verDesc"
              rows="4"
              class="heron-input text-xs leading-relaxed"
              placeholder="何を追加・変更・修正したのかを具体的に記入してください。&#10;例: 棚卸し画面の結果一覧にCSV出力ボタンを追加。読み取り済み・所在変更・未読取の3区分をそのまま出力できるようにした。"
              [(ngModel)]="versionDescription"
            ></textarea>
          </div>

          @if (versionMessage()) {
            <p
              class="rounded px-3 py-2 text-xs font-semibold"
              [class]="
                versionMessageIsError()
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              "
            >
              {{ versionMessage() }}
            </p>
          }

          <button type="submit" class="heron-btn-primary w-full text-xs font-bold" [disabled]="savingVersion()">
            <app-icon name="plus" />
            {{ savingVersion() ? '記録中...' : 'Ver情報を記録する' }}
          </button>
        </form>

        <!-- 履歴 -->
        <div class="mt-4">
          <h3 class="text-[11px] font-bold text-slate-500 mb-2">
            更新履歴 <span class="font-mono">{{ versions().length }}</span> 件
          </h3>

          @if (loading()) {
            <p class="py-6 text-center text-xs text-slate-400">読み込み中...</p>
          } @else if (versions().length === 0) {
            <p class="py-6 text-center text-xs text-slate-400">Ver情報がまだ記録されていません。</p>
          } @else {
            <ol class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              @for (v of versions(); track v.version) {
                <li class="rounded-md border border-slate-200/80 bg-white p-3 shadow-2xs">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="shrink-0 rounded bg-[#2A3A4A] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        {{ v.version }}
                      </span>
                      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" [class]="typeBadgeClass(v.type)">
                        {{ typeLabel(v.type) }}
                      </span>
                      <span class="truncate text-xs font-bold text-slate-900">{{ v.title }}</span>
                    </div>
                    <button
                      type="button"
                      (click)="removeVersion(v)"
                      class="shrink-0 text-[10px] font-bold text-slate-400 hover:text-rose-600"
                    >
                      削除
                    </button>
                  </div>

                  @if (v.description) {
                    <p class="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                      {{ v.description }}
                    </p>
                  }

                  <div class="mt-1.5 text-[10px] text-slate-400">
                    {{ v.released_at | date: 'yyyy/MM/dd HH:mm' }} ・ {{ v.released_by }}
                  </div>
                </li>
              }
            </ol>
          }
        </div>
      </section>
    </div>
  `,
})
export class TestMembersComponent {
  readonly auth = inject(AuthService);
  private readonly store = inject(FirestoreDataService);

  newEmail = '';
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly saving = signal(false);
  readonly refreshing = signal(false);

  // ---- Ver情報 ----
  readonly versions = signal<VersionEntry[]>([]);
  readonly loading = signal(true);
  readonly bumpType = signal<VersionBumpType>('patch');
  versionTitle = '';
  versionDescription = '';
  readonly savingVersion = signal(false);
  readonly versionMessage = signal('');
  readonly versionMessageIsError = signal(false);

  readonly current = computed(() => this.versions()[0] ?? null);

  /** 選択中の種別で次に付与される版数（プレビュー）。 */
  readonly nextVersion = computed(() => {
    const cur = this.current();
    const major = cur?.major ?? 1;
    const minor = cur?.minor ?? 0;
    const patch = cur?.patch ?? 0;
    return this.bumpType() === 'minor'
      ? `VER${major}.${minor + 1}.0`
      : `VER${major}.${minor}.${patch + 1}`;
  });

  constructor() {
    void this.loadVersions();
  }

  typeLabel(type: VersionBumpType): string {
    return type === 'major' ? '大型' : type === 'minor' ? '中型' : '小型';
  }

  typeBadgeClass(type: VersionBumpType): string {
    if (type === 'major') return 'bg-rose-50 text-rose-700 border border-rose-200';
    if (type === 'minor') return 'bg-blue-50 text-blue-700 border border-blue-200';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }

  private async loadVersions(): Promise<void> {
    this.loading.set(true);
    try {
      this.versions.set(await this.store.listVersions());
    } catch (err) {
      console.error('[HERON] Ver情報の読み込みに失敗しました:', err);
      this.notifyVersion('Ver情報の読み込みに失敗しました', true);
    } finally {
      this.loading.set(false);
    }
  }

  async addVersion(): Promise<void> {
    if (!this.versionTitle.trim() || !this.versionDescription.trim()) {
      this.notifyVersion('概要と変更・更新内容の両方を入力してください', true);
      return;
    }

    this.savingVersion.set(true);
    try {
      const entry = await this.store.addVersion({
        type: this.bumpType(),
        title: this.versionTitle,
        description: this.versionDescription,
      });
      this.versionTitle = '';
      this.versionDescription = '';
      await this.loadVersions();
      this.notifyVersion(`${entry.version} として記録しました`, false);
    } catch (err) {
      console.error('[HERON] Ver情報の記録に失敗しました:', err);
      this.notifyVersion('Ver情報の記録に失敗しました。再度お試しください。', true);
    } finally {
      this.savingVersion.set(false);
    }
  }

  async removeVersion(entry: VersionEntry): Promise<void> {
    if (!confirm(`「${entry.version} ${entry.title}」の記録を削除しますか？`)) return;
    try {
      await this.store.deleteVersion(entry);
      await this.loadVersions();
      this.notifyVersion(`${entry.version} の記録を削除しました`, false);
    } catch {
      this.notifyVersion('削除に失敗しました', true);
    }
  }

  private notifyVersion(text: string, isError: boolean): void {
    this.versionMessage.set(text);
    this.versionMessageIsError.set(isError);
  }

  // ---- テストメンバー ----

  async addMember(): Promise<void> {
    if (!this.newEmail.trim() || !this.newEmail.includes('@')) {
      this.message.set('有効なメールアドレスを入力してください');
      this.messageIsError.set(true);
      return;
    }

    const email = this.newEmail.trim().toLowerCase();
    this.saving.set(true);
    try {
      await this.auth.addTestMember(email);
      this.newEmail = '';
      this.message.set(`メールアドレス「${email}」をテストメンバーに登録しました (Firestore 保存済み)`);
      this.messageIsError.set(false);
    } catch (err) {
      this.message.set('Firestore への保存に失敗しました。再度お試しください。');
      this.messageIsError.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  async removeMember(email: string): Promise<void> {
    if (!confirm(`「${email}」の単体テスト環境アクセス許可を解除しますか？`)) return;

    this.saving.set(true);
    try {
      await this.auth.removeTestMember(email);
      this.message.set(`「${email}」のアクセス許可を解除しました (Firestore から削除済み)`);
      this.messageIsError.set(false);
    } catch (err) {
      this.message.set('Firestore からの削除に失敗しました。再度お試しください。');
      this.messageIsError.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  async refreshData(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.auth.refreshTestMembers();
      await this.loadVersions();
      this.message.set('Firestore から最新データを同期しました');
      this.messageIsError.set(false);
    } catch {
      this.message.set('同期に失敗しました');
      this.messageIsError.set(true);
    } finally {
      this.refreshing.set(false);
    }
  }
}
