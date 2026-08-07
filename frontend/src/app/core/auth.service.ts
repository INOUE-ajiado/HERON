import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoginResponse, User } from './models';

const TOKEN_KEY = 'heron.token';
const USER_KEY = 'heron.user';
const TEST_MEMBERS_KEY = 'heron.test_members';

const PRESET_TEST_MEMBERS = [
  'inoue@ajiado.co.jp',
  'admin@heron.app',
  'nakamura@ajiado.co.jp',
  'matsuyama@ajiado.co.jp',
  'inoue.cq.jwl@gmail.com',
  'a_yamada@ajiado.co.jp',
  'shimako@ajiado.co.jp',
];

function getStoredTestMembers(): string[] {
  const raw = localStorage.getItem(TEST_MEMBERS_KEY);
  if (!raw) {
    localStorage.setItem(TEST_MEMBERS_KEY, JSON.stringify(PRESET_TEST_MEMBERS));
    return PRESET_TEST_MEMBERS;
  }
  try {
    const list: string[] = JSON.parse(raw);
    const merged = Array.from(new Set([...PRESET_TEST_MEMBERS, ...list]));
    return merged;
  } catch {
    return PRESET_TEST_MEMBERS;
  }
}

/**
 * 認証状態を保持するサービス (全端末対話型Google認証アクセス制御機能付き)。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(readStoredUser());
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly testMembers = signal<string[]>(getStoredTestMembers());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._token() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  get token(): string | null {
    return this._token();
  }

  /** テストメンバー (ホワイトリスト) の追加 */
  addTestMember(email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const current = this.testMembers();
    if (!current.includes(cleanEmail)) {
      const updated = [...current, cleanEmail];
      localStorage.setItem(TEST_MEMBERS_KEY, JSON.stringify(updated));
      this.testMembers.set(updated);
    }
  }

  /** テストメンバーの削除 */
  removeTestMember(email: string): void {
    const current = this.testMembers();
    const updated = current.filter((m) => m !== email.trim().toLowerCase());
    localStorage.setItem(TEST_MEMBERS_KEY, JSON.stringify(updated));
    this.testMembers.set(updated);
  }

  /** ホワイトリスト検証 (社内ドメイン @ajiado.co.jp 全員自動アクセス許可 ＆ 登録メンバー検証) */
  isAllowedEmail(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return false;

    // アジアド社内ドメイン @ajiado.co.jp は全端末から無条件アクセス自動許可
    if (clean.endsWith('@ajiado.co.jp')) return true;

    // デモ・開発用ID
    if (clean === 'admin' || clean === 'animator1' || clean === 'animator2') return true;

    // 登録済み・プリセットテストメンバーリストとの検証
    const members = this.testMembers();
    return members.some((m) => m.toLowerCase() === clean);
  }

  login(loginId: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBase}/auth/login`, {
        login_id: loginId,
        password,
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this._token.set(res.token);
          this._user.set(res.user);
        }),
      );
  }

  loginWithFirebaseUser(user: User, token: string): void {
    const userEmail = (user.login_id || '').trim().toLowerCase();
    // ホワイトリスト検証
    if (!this.isAllowedEmail(userEmail)) {
      throw new Error(`アクセス権限がありません (ユーザー: ${userEmail})。HERON管理者に「テストメンバー」としての追加を依頼してください。`);
    }

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._token.set(token);
    this._user.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    void this.router.navigate(['/login']);
  }
}

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}
