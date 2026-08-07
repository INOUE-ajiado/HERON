import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

import { environment } from '../../environments/environment';
import { FirebaseService } from './firebase.service';
import { LoginResponse, User } from './models';

const TOKEN_KEY = 'heron.token';
const USER_KEY = 'heron.user';

/** コードレベルでのプリセットメンバー (初回 Firestore マイグレーション用) */
const PRESET_TEST_MEMBERS = [
  'inoue@ajiado.co.jp',
  'admin@heron.app',
  'nakamura@ajiado.co.jp',
  'matsuyama@ajiado.co.jp',
  'inoue.cq.jwl@gmail.com',
  'a_yamada@ajiado.co.jp',
  'shimako@ajiado.co.jp',
];

/**
 * 認証状態を保持するサービス (Firestore ベース全端末同期型 Google 認証アクセス制御)。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly firebase = inject(FirebaseService);

  private readonly _user = signal<User | null>(readStoredUser());
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly testMembers = signal<string[]>([]);
  readonly testMembersLoaded = signal(false);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._token() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  get token(): string | null {
    return this._token();
  }

  constructor() {
    // Firestore からテストメンバーを非同期読み込み
    this.loadTestMembersFromFirestore();
  }

  /** Firestore からテストメンバーリストを読み込み */
  private async loadTestMembersFromFirestore(): Promise<void> {
    try {
      const db = this.firebase.getDb();
      const colRef = collection(db, 'test_members');
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
        // 初回起動: プリセットメンバーを Firestore へマイグレーション
        await this.migratePresetToFirestore();
        this.testMembers.set([...PRESET_TEST_MEMBERS]);
      } else {
        const emails = snapshot.docs.map((d) => d.id);
        this.testMembers.set(emails);
      }
      this.testMembersLoaded.set(true);
    } catch (err) {
      // Firestore 読み込み失敗時はプリセットをフォールバック使用
      console.warn('Firestore テストメンバー読み込み失敗、プリセットを使用:', err);
      this.testMembers.set([...PRESET_TEST_MEMBERS]);
      this.testMembersLoaded.set(true);
    }
  }

  /** プリセットメンバーを Firestore へ初回マイグレーション */
  private async migratePresetToFirestore(): Promise<void> {
    const db = this.firebase.getDb();
    for (const email of PRESET_TEST_MEMBERS) {
      const docRef = doc(db, 'test_members', email);
      await setDoc(docRef, { email, addedAt: new Date().toISOString() });
    }
  }

  /** テストメンバー (ホワイトリスト) の追加 → Firestore に永続保存 */
  async addTestMember(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    const current = this.testMembers();
    if (current.includes(cleanEmail)) return;

    try {
      const db = this.firebase.getDb();
      const docRef = doc(db, 'test_members', cleanEmail);
      await setDoc(docRef, { email: cleanEmail, addedAt: new Date().toISOString() });

      this.testMembers.set([...current, cleanEmail]);
    } catch (err) {
      console.error('Firestore テストメンバー追加失敗:', err);
      throw err;
    }
  }

  /** テストメンバーの削除 → Firestore から永久削除 */
  async removeTestMember(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const db = this.firebase.getDb();
      const docRef = doc(db, 'test_members', cleanEmail);
      await deleteDoc(docRef);

      const current = this.testMembers();
      this.testMembers.set(current.filter((m) => m !== cleanEmail));
    } catch (err) {
      console.error('Firestore テストメンバー削除失敗:', err);
      throw err;
    }
  }

  /** Firestore データを強制リフレッシュ */
  async refreshTestMembers(): Promise<void> {
    await this.loadTestMembersFromFirestore();
  }

  /** ホワイトリスト検証 (社内ドメイン @ajiado.co.jp 全員自動アクセス許可 ＆ Firestore 登録メンバー検証) */
  isAllowedEmail(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return false;

    // アジアド社内ドメイン @ajiado.co.jp は全端末から無条件アクセス自動許可
    if (clean.endsWith('@ajiado.co.jp')) return true;

    // デモ・開発用ID
    if (clean === 'admin' || clean === 'animator1' || clean === 'animator2') return true;

    // Firestore 登録済みテストメンバーリストとの検証
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
