import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * HERON 単体テストサーバー環境「テストメンバー」アクセス許可管理画面。
 */
@Component({
  selector: 'app-test-members',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="flex items-center justify-between pb-3 border-b border-slate-200">
      <div>
        <h1 class="text-lg font-bold text-[#2A3A4A] flex items-center gap-2">
          <span class="inline-block w-1.5 h-4 bg-[#2A3A4A] rounded-full"></span>
          テストメンバー管理 (単体テスト環境アクセス許可)
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">現在公開されているHERON単体テスト環境にGoogle認証でログイン可能なユーザーを管理します</p>
      </div>

      <div class="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded border border-slate-200 shadow-2xs">
        許可メンバー: <span class="text-[#2A3A4A] font-mono text-sm font-extrabold">{{ auth.testMembers().length }}</span> 名
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
        ・未登録のGoogleアカウントからのログインは自動的にアクセスが遮断・拒否されます。
      </p>
    </div>

    <!-- メンバー追加フォーム -->
    <form (ngSubmit)="addMember()" class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs max-w-xl">
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

      <button type="submit" class="heron-btn-primary shrink-0 text-xs font-bold sm:self-end py-2 px-4 whitespace-nowrap">
        <app-icon name="plus" />
        テストメンバーを追加
      </button>
    </form>

    @if (message()) {
      <p class="mt-3 rounded px-3 py-2 text-xs font-semibold max-w-xl"
         [class]="messageIsError() ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'">
        {{ message() }}
      </p>
    }

    <!-- 許可メンバー一覧テーブル -->
    <div class="mt-5 max-w-xl">
      <h2 class="text-xs font-bold text-[#2A3A4A] mb-2 flex items-center gap-1.5">
        アクセス許可済みGoogleアカウント一覧
      </h2>

      <div class="overflow-x-auto rounded-md border border-slate-200/80 bg-white shadow-2xs">
        <table class="w-full min-w-[480px] text-left text-xs">
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
                <td class="py-2.5 px-3.5 font-mono font-bold text-[#2A3A4A]">
                  {{ email }}
                </td>
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
    </div>
  `,
})
export class TestMembersComponent {
  readonly auth = inject(AuthService);

  newEmail = '';
  readonly message = signal('');
  readonly messageIsError = signal(false);

  addMember(): void {
    if (!this.newEmail.trim() || !this.newEmail.includes('@')) {
      this.message.set('有効なメールアドレスを入力してください');
      this.messageIsError.set(true);
      return;
    }

    const email = this.newEmail.trim().toLowerCase();
    this.auth.addTestMember(email);
    this.newEmail = '';
    this.message.set(`メールアドレス「${email}」をテストメンバーに登録・アクセス許可しました！`);
    this.messageIsError.set(false);
  }

  removeMember(email: string): void {
    if (confirm(`「${email}」の単体テスト環境アクセス許可を解除しますか？`)) {
      this.auth.removeTestMember(email);
      this.message.set(`「${email}」のアクセス許可を解除しました`);
      this.messageIsError.set(false);
    }
  }
}
