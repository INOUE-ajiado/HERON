import { Injectable, computed, inject, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

/**
 * HERON 内のアクセス制御対象ページ識別子
 */
export type AppPageKey =
  | 'approval'
  | 'work-request'
  | 'byod'
  | 'equipments'
  | 'licenses'
  | 'inventory'
  | 'locations'
  | 'settings'
  | 'logs'
  | 'admin'
  | 'test-members'
  | 'specs';

/**
 * ユーザーの権限レベル（ロール）
 * - admin: システム管理者 (全ページ・ユーザー権限管理フルアクセス)
 * - asset_manager: 機材・アカウント管理者 (申請系 ＋ 機材台帳・ライセンス管理・棚卸し等)
 * - approver: 承認者・部門デスク (申請系・決裁 ＋ 必要に応じた台帳閲覧)
 * - general: 一般ユーザー (稟議申請・業務申請・BYOD申請のみアクセス可。機材・アカウント系は非表示/遮断)
 */
export type AccessRole = 'admin' | 'asset_manager' | 'approver' | 'general';

/**
 * ユーザー個別のページ権限オーバーライド値
 * - inherit: ロール（権限レベル）の標準設定に従う
 * - allow: ロールに関わらずこのユーザーに特別許可する
 * - deny: ロールに関わらずこのユーザーのアクセスを遮断する
 */
export type PageOverrideState = 'inherit' | 'allow' | 'deny';

export interface AppPageDefinition {
  key: AppPageKey;
  label: string;
  path: string;
  group: 'workflow' | 'asset_admin' | 'system_admin';
  groupLabel: string;
  description: string;
  recommendedAdminOnly: boolean;
}

export interface ManagedUser {
  email: string;
  name: string;
  department: string;
  title: string;
  role: AccessRole;
  status: 'active' | 'suspended';
  custom_permissions: Partial<Record<AppPageKey, PageOverrideState>>;
  note: string;
  updated_at: string;
}

export type RolePermissionMatrix = Record<AccessRole, Record<AppPageKey, boolean>>;

export interface DomainAccessPolicy {
  allowAjiadoDomain: boolean;
  defaultDomainRole: AccessRole;
  requireExplicitRegistration: boolean;
  updated_at: string;
}

export const ACCESS_ROLE_META: Record<
  AccessRole,
  { label: string; shortLabel: string; level: number; description: string; badgeClass: string }
> = {
  admin: {
    label: 'システム管理者 (Lv.4)',
    shortLabel: 'システム管理者',
    level: 4,
    description:
      '全ページへのフルアクセス権限。管理ページでのユーザー追加・権限レベル変更・機材・ライセンス管理すべてを実行可能。',
    badgeClass: 'bg-[#2A3A4A] text-[#90CFD6] border-[#2A3A4A]',
  },
  asset_manager: {
    label: '機材・アカウント管理者 (Lv.3)',
    shortLabel: '機材・アカウント管理',
    level: 3,
    description:
      '申請系ページに加え、機材台帳・貸出返却・ソフトウェアライセンス＆シリアル管理・棚卸し・保管場所マスタを操作可能。',
    badgeClass: 'bg-blue-700 text-white border-blue-700',
  },
  approver: {
    label: '決裁・承認者 / デスク (Lv.2)',
    shortLabel: '承認者・デスク',
    level: 2,
    description:
      '稟議書・業務申請・BYOD申請の起案および承認決裁が可能。デフォルトでは機材・アカウント編集画面は制限。',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  general: {
    label: '一般ユーザー / スタッフ (Lv.1)',
    shortLabel: '一般ユーザー',
    level: 1,
    description:
      '稟議申請・業務申請・BYOD申請のみ利用可能。機材台帳やライセンス・アカウント管理ページは開けません。',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

export const APP_PAGE_DEFINITIONS: AppPageDefinition[] = [
  // 1. 申請・ワークフロー系（全ユーザー利用可能）
  {
    key: 'approval',
    label: '稟議申請',
    path: '/approval',
    group: 'workflow',
    groupLabel: '申請・ワークフロー系（全ユーザー基本開放）',
    description: '物品購入・外注契約・予算稟議書の起案・閲覧・承認ワークフロー',
    recommendedAdminOnly: false,
  },
  {
    key: 'work-request',
    label: '業務申請',
    path: '/work-request',
    group: 'workflow',
    groupLabel: '申請・ワークフロー系（全ユーザー基本開放）',
    description: '休日出勤・深夜残業・打刻修正・各種社内届出の申請',
    recommendedAdminOnly: false,
  },
  {
    key: 'byod',
    label: 'BYOD申請',
    path: '/byod',
    group: 'workflow',
    groupLabel: '申請・ワークフロー系（全ユーザー基本開放）',
    description: '私物PC・液タブ等の業務利用申請およびセキュリティチェック',
    recommendedAdminOnly: false,
  },

  // 2. 機材・アカウント管理系（原則：管理者のみ開放）
  {
    key: 'equipments',
    label: '機材台帳・検索',
    path: '/equipments',
    group: 'asset_admin',
    groupLabel: '機材・アカウント管理系（原則：管理者限定）',
    description: '社内機材台帳の検索・新規登録・貸出・返却・QRラベル発行',
    recommendedAdminOnly: true,
  },
  {
    key: 'licenses',
    label: 'ライセンス・アカウント管理',
    path: '/licenses',
    group: 'asset_admin',
    groupLabel: '機材・アカウント管理系（原則：管理者限定）',
    description: 'Microsoft Office・クリスタ・Photoshop等のシリアル・利用者紐付け・案内メール送信',
    recommendedAdminOnly: true,
  },
  {
    key: 'inventory',
    label: '棚卸し管理',
    path: '/inventory',
    group: 'asset_admin',
    groupLabel: '機材・アカウント管理系（原則：管理者限定）',
    description: '保管場所・棚ごとのQR/バーコード一括スキャン棚卸しと差異照合',
    recommendedAdminOnly: true,
  },
  {
    key: 'locations',
    label: '保管場所マスタ',
    path: '/locations',
    group: 'asset_admin',
    groupLabel: '機材・アカウント管理系（原則：管理者限定）',
    description: '社内フロア・保管部屋・棚コードの登録と棚ラベル印刷',
    recommendedAdminOnly: true,
  },
  {
    key: 'settings',
    label: 'マスタ設定',
    path: '/settings',
    group: 'asset_admin',
    groupLabel: '機材・アカウント管理系（原則：管理者限定）',
    description: '部署マスタ・機材カテゴリ・プレフィックス等の基本定義管理',
    recommendedAdminOnly: true,
  },
  {
    key: 'logs',
    label: '入出庫・操作履歴',
    path: '/logs',
    group: 'asset_admin',
    groupLabel: '機材・アカウント管理系（原則：管理者限定）',
    description: '機材の貸出・返却・新規登録・除却の監査ログ一覧',
    recommendedAdminOnly: true,
  },

  // 3. システム管理・設計仕様書系
  {
    key: 'admin',
    label: '管理ページ (ユーザー・権限)',
    path: '/admin',
    group: 'system_admin',
    groupLabel: 'システム管理・設計仕様書系',
    description: 'アプリ利用可能ユーザーの管理・ロール別および個人別アクセス可能ページの設定',
    recommendedAdminOnly: true,
  },
  {
    key: 'test-members',
    label: 'テスト設定・Ver管理',
    path: '/test-members',
    group: 'system_admin',
    groupLabel: 'システム管理・設計仕様書系',
    description: '単体テスト環境ホワイトリスト同期およびリリース版数（Ver情報）記録',
    recommendedAdminOnly: true,
  },
  {
    key: 'specs',
    label: '各種設計書・仕様書',
    path: '/spec',
    group: 'system_admin',
    groupLabel: 'システム管理・設計仕様書系',
    description: '基本設計書PDF・システム仕様書・稟議/業務/BYOD/ライセンス/管理ページ仕様書の閲覧',
    recommendedAdminOnly: false,
  },
];

const LEGACY_USERS_STORAGE_KEYS = ['heron_managed_users_v1', 'heron_managed_users_v2'];
const USERS_STORAGE_KEY = 'heron_managed_users_v3';
const MATRIX_STORAGE_KEY = 'heron_role_matrix_v1';
const POLICY_STORAGE_KEY = 'heron_domain_policy_v1';

const FIRESTORE_USERS_COL = 'managed_users';
const FIRESTORE_SYSTEM_COL = 'system';
const FIRESTORE_POLICY_DOC = 'access_control_config';

const LEGACY_SAMPLE_USER_EMAILS = new Set([
  'inoue.cq.jwl@gmail.com',
  'nakamura@ajiado.co.jp',
  'matsuyama@ajiado.co.jp',
  'a_yamada@ajiado.co.jp',
  'shimako@ajiado.co.jp',
  'sakurai@ajiado.co.jp',
]);

@Injectable({
  providedIn: 'root',
})
export class AccessControlService {
  private readonly auth = inject(AuthService);
  private readonly firebase = inject(FirebaseService);

  readonly managedUsers = signal<ManagedUser[]>([]);
  readonly roleMatrix = signal<RolePermissionMatrix>(this.getDefaultMatrix());
  readonly domainPolicy = signal<DomainAccessPolicy>(this.getDefaultPolicy());
  readonly syncing = signal<boolean>(false);

  /**
   * 管理者が画面上で「一般ユーザー」や「機材管理者」の見え方を即座にテストできるプレビューロール
   * null の場合は実際のログインユーザーの権限で判定
   */
  readonly previewRole = signal<AccessRole | null>(null);

  /** 現在ログイン中のユーザーの ManagedUser レコード（未登録の場合はドメインポリシーから生成） */
  readonly currentManagedUser = computed<ManagedUser | null>(() => {
    const u = this.auth.user();
    if (!u) return null;
    const email = (u.login_id || '').trim().toLowerCase();
    const found = this.managedUsers().find((m) => m.email.toLowerCase() === email);
    if (found) return found;

    // 管理者デモID ('admin') またはシステムオーナーは常に admin
    const isBuiltInAdmin =
      email === 'admin' ||
      email === 'inoue@ajiado.co.jp' ||
      email === 'admin@heron.app' ||
      email === 'inoue.cq.jwl@gmail.com';

    const policy = this.domainPolicy();
    const isAjiado = email.endsWith('@ajiado.co.jp');
    const isAllowedUnlisted =
      isBuiltInAdmin ||
      (!policy.requireExplicitRegistration && (isAjiado ? policy.allowAjiadoDomain : true));

    return {
      email: email || u.user_id,
      name: u.name || 'ログインユーザー',
      department: '未設定',
      title: isBuiltInAdmin ? 'システム管理者' : 'スタッフ',
      role: isBuiltInAdmin ? 'admin' : policy.defaultDomainRole,
      status: isAllowedUnlisted ? 'active' : 'suspended',
      custom_permissions: {},
      note: '自動認識ユーザー',
      updated_at: this.nowStr(),
    };
  });

  /** 実効ロール（プレビューモード中はプレビューロールを優先） */
  readonly effectiveRole = computed<AccessRole>(() => {
    const sim = this.previewRole();
    if (sim) return sim;
    return this.currentManagedUser()?.role ?? 'general';
  });

  /** 機材・アカウント管理者以上の編集操作権限を持つか（プレビューモード連動） */
  readonly canManageAssets = computed<boolean>(() => {
    const role = this.effectiveRole();
    return role === 'admin' || role === 'asset_manager';
  });

  /** 本来の権限がシステム管理者かどうか（プレビュー中も管理ページへ戻れるようにするため） */
  readonly isActualAdmin = computed<boolean>(() => {
    const cur = this.currentManagedUser();
    if (!cur || cur.status === 'suspended') return false;
    if (cur.custom_permissions['admin'] === 'allow') return true;
    return cur.role === 'admin';
  });

  constructor() {
    this.loadFromStorage();
    void this.syncFromFirestore();
  }

  private nowStr(): string {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }

  /**
   * 推奨デフォルトのロール別ページ権限マトリクス
   * - 稟議申請・業務申請・BYOD申請は全ユーザー（一般含む）が利用可能
   * - 機材台帳・ライセンス管理・棚卸し・保管場所・マスタ・履歴は管理者（admin / asset_manager）のみ利用可能
   */
  getDefaultMatrix(): RolePermissionMatrix {
    return {
      admin: {
        approval: true,
        'work-request': true,
        byod: true,
        equipments: true,
        licenses: true,
        inventory: true,
        locations: true,
        settings: true,
        logs: true,
        admin: true,
        'test-members': true,
        specs: true,
      },
      asset_manager: {
        approval: true,
        'work-request': true,
        byod: true,
        equipments: true,
        licenses: true,
        inventory: true,
        locations: true,
        settings: true,
        logs: true,
        admin: false,
        'test-members': false,
        specs: true,
      },
      approver: {
        approval: true,
        'work-request': true,
        byod: true,
        equipments: false,
        licenses: false,
        inventory: false,
        locations: false,
        settings: false,
        logs: false,
        admin: false,
        'test-members': false,
        specs: true,
      },
      general: {
        approval: true,
        'work-request': true,
        byod: true,
        equipments: false,
        licenses: false,
        inventory: false,
        locations: false,
        settings: false,
        logs: false,
        admin: false,
        'test-members': false,
        specs: false,
      },
    };
  }

  getDefaultPolicy(): DomainAccessPolicy {
    return {
      allowAjiadoDomain: true,
      defaultDomainRole: 'general',
      requireExplicitRegistration: false,
      updated_at: '2026/10/21 14:00',
    };
  }

  private loadFromStorage(): void {
    try {
      for (const k of LEGACY_USERS_STORAGE_KEYS) {
        localStorage.removeItem(k);
      }
      const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.managedUsers.set(parsed);
        } else {
          const initial = this.createInitialUsers();
          this.managedUsers.set(initial);
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
        }
      } else {
        const initial = this.createInitialUsers();
        this.managedUsers.set(initial);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      }

      const rawMatrix = localStorage.getItem(MATRIX_STORAGE_KEY);
      if (rawMatrix) {
        this.roleMatrix.set({ ...this.getDefaultMatrix(), ...JSON.parse(rawMatrix) });
      }

      const rawPolicy = localStorage.getItem(POLICY_STORAGE_KEY);
      if (rawPolicy) {
        this.domainPolicy.set({ ...this.getDefaultPolicy(), ...JSON.parse(rawPolicy) });
      }
    } catch (e) {
      console.error('[HERON] Failed to load access control settings from storage:', e);
      this.managedUsers.set(this.createInitialUsers());
    }
  }

  private saveUsersToStorage(users: ManagedUser[]): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error(e);
    }
    this.managedUsers.set([...users]);
  }

  private saveConfigToStorage(matrix: RolePermissionMatrix, policy: DomainAccessPolicy): void {
    try {
      localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrix));
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
    } catch (e) {
      console.error(e);
    }
    this.roleMatrix.set(JSON.parse(JSON.stringify(matrix)));
    this.domainPolicy.set({ ...policy });
  }

  /**
   * Firestore との双方向同期
   */
  async syncFromFirestore(): Promise<void> {
    this.syncing.set(true);
    try {
      const fbUser = await this.firebase.waitForAuth();
      if (!fbUser) return;

      const db = this.firebase.getDb();

      // 1. ポリシー＆マトリクス設定の同期
      const configRef = doc(db, FIRESTORE_SYSTEM_COL, FIRESTORE_POLICY_DOC);
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const data = configSnap.data() as {
          roleMatrix?: RolePermissionMatrix;
          domainPolicy?: DomainAccessPolicy;
        };
        if (data.roleMatrix && data.domainPolicy) {
          this.saveConfigToStorage(data.roleMatrix, data.domainPolicy);
        }
      } else {
        await setDoc(configRef, {
          roleMatrix: this.roleMatrix(),
          domainPolicy: this.domainPolicy(),
        });
      }

      // 2. ユーザー一覧の同期 (system/access_users_list ドキュメントおよび managed_users コレクションへ同期)
      const usersDocRef = doc(db, FIRESTORE_SYSTEM_COL, 'access_users_list');
      const usersDocSnap = await getDoc(usersDocRef);
      if (usersDocSnap.exists()) {
        const data = usersDocSnap.data() as {
          users?: ManagedUser[];
          cleaned_sample_users_v2?: boolean;
          owner_name_v3?: boolean;
        };
        if (Array.isArray(data.users) && data.users.length > 0) {
          if (!data.cleaned_sample_users_v2 || !data.owner_name_v3) {
            // 旧バージョンのサンプルユーザーデータを一括パージし、システムオーナー氏名を『井上 賢治』に統一
            const cleaned = data.users
              .filter((u) => !LEGACY_SAMPLE_USER_EMAILS.has(u.email.toLowerCase()))
              .map((u) =>
                u.email.toLowerCase() === 'inoue@ajiado.co.jp'
                  ? { ...u, name: '井上 賢治' }
                  : u
              );
            const finalUsers =
              cleaned.length > 0 ? cleaned : this.createInitialUsers();
            this.saveUsersToStorage(finalUsers);
            await this.persistUsersToFirestore(finalUsers);
            for (const sampleEmail of LEGACY_SAMPLE_USER_EMAILS) {
              const sRef = doc(db, FIRESTORE_USERS_COL, sampleEmail);
              await deleteDoc(sRef).catch(() => undefined);
            }
          } else {
            this.saveUsersToStorage(data.users);
          }
        }
      } else {
        const initialUsers = this.managedUsers();
        await this.persistUsersToFirestore(initialUsers);
      }
    } catch (err) {
      console.warn('[HERON] アクセス権限設定の Firestore 同期をスキップしました (ローカルを使用):', err);
    } finally {
      this.syncing.set(false);
    }
  }

  private async persistUsersToFirestore(users: ManagedUser[]): Promise<void> {
    try {
      const db = this.firebase.getDb();
      const usersDocRef = doc(db, FIRESTORE_SYSTEM_COL, 'access_users_list');
      await setDoc(usersDocRef, {
        users: JSON.parse(JSON.stringify(users)),
        cleaned_sample_users_v2: true,
        owner_name_v3: true,
        updated_at: this.nowStr(),
      });
      for (const u of users) {
        const uRef = doc(db, FIRESTORE_USERS_COL, u.email.toLowerCase());
        await setDoc(uRef, JSON.parse(JSON.stringify(u))).catch(() => undefined);
      }
    } catch (err) {
      console.warn('[HERON] ユーザー権限データの Firestore 保存に失敗:', err);
    }
  }

  private async persistConfigToFirestore(
    matrix: RolePermissionMatrix,
    policy: DomainAccessPolicy
  ): Promise<void> {
    try {
      const db = this.firebase.getDb();
      const configRef = doc(db, FIRESTORE_SYSTEM_COL, FIRESTORE_POLICY_DOC);
      await setDoc(configRef, {
        roleMatrix: JSON.parse(JSON.stringify(matrix)),
        domainPolicy: JSON.parse(JSON.stringify(policy)),
      });
    } catch (err) {
      console.warn('[HERON] 権限マトリクスの Firestore 保存に失敗:', err);
    }
  }

  /**
   * 指定されたユーザーが対象ページへアクセス可能かを判定
   */
  canUserAccessPage(user: ManagedUser, pageKey: AppPageKey): boolean {
    if (user.status === 'suspended') return false;

    const override = user.custom_permissions?.[pageKey];
    if (override === 'allow') return true;
    if (override === 'deny') return false;

    const matrix = this.roleMatrix();
    const rolePerms = matrix[user.role] ?? matrix.general;
    return Boolean(rolePerms[pageKey]);
  }

  /**
   * 現在ログイン中のユーザー（またはプレビューモード）で対象ページを開けるか判定
   */
  canAccessPage(pageKey: AppPageKey): boolean {
    const simRole = this.previewRole();
    if (simRole) {
      // プレビューモード中でも、管理ページ (/admin) と仕様書は元の管理者が操作できるよう常に許可
      if (pageKey === 'admin' && this.isActualAdmin()) {
        return true;
      }
      const matrix = this.roleMatrix();
      return Boolean(matrix[simRole]?.[pageKey]);
    }

    const cur = this.currentManagedUser();
    if (!cur) return false;
    return this.canUserAccessPage(cur, pageKey);
  }

  /**
   * 現在のユーザーがアクセス可能な最初のデフォルト遷移先パスを返す
   * （一般ユーザーが '/' や '/equipments' にアクセスした際、自動的に '/approval' 等へ誘導する）
   * どのページにもアクセス権限がない（利用停止状態など）場合は '/login' を返し無限リダイレクトを防止する
   */
  getDefaultLandingRoute(): string {
    const priorityOrder: { key: AppPageKey; path: string }[] = [
      { key: 'equipments', path: '/equipments' },
      { key: 'approval', path: '/approval' },
      { key: 'work-request', path: '/work-request' },
      { key: 'byod', path: '/byod' },
      { key: 'licenses', path: '/licenses' },
      { key: 'inventory', path: '/inventory' },
      { key: 'locations', path: '/locations' },
      { key: 'settings', path: '/settings' },
      { key: 'logs', path: '/logs' },
      { key: 'specs', path: '/spec' },
      { key: 'admin', path: '/admin' },
      { key: 'test-members', path: '/test-members' },
    ];
    for (const item of priorityOrder) {
      if (this.canAccessPage(item.key)) {
        return item.path;
      }
    }
    return '/login';
  }

  // --- ユーザー操作 API ---

  async upsertManagedUser(user: Omit<ManagedUser, 'updated_at'>): Promise<ManagedUser> {
    const cleanEmail = user.email.trim().toLowerCase();
    const updatedUser: ManagedUser = {
      ...user,
      email: cleanEmail,
      updated_at: this.nowStr(),
    };

    const list = [...this.managedUsers()];
    const idx = list.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      list[idx] = updatedUser;
    } else {
      list.unshift(updatedUser);
    }

    this.saveUsersToStorage(list);
    await this.persistUsersToFirestore(list);

    // アクティブユーザーであれば AuthService の test_members ホワイトリストにも自動同期
    if (updatedUser.status === 'active') {
      void this.auth.addTestMember(cleanEmail).catch(() => undefined);
    } else {
      void this.auth.removeTestMember(cleanEmail).catch(() => undefined);
    }

    return updatedUser;
  }

  async updateUserRole(email: string, role: AccessRole): Promise<void> {
    const target = this.managedUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!target) return;
    await this.upsertManagedUser({
      ...target,
      role,
    });
  }

  async toggleUserStatus(email: string): Promise<void> {
    const target = this.managedUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!target) return;
    const nextStatus = target.status === 'active' ? 'suspended' : 'active';
    await this.upsertManagedUser({
      ...target,
      status: nextStatus,
    });
  }

  async deleteManagedUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const list = this.managedUsers().filter(
      (u) => u.email.toLowerCase() !== cleanEmail
    );
    this.saveUsersToStorage(list);
    await this.persistUsersToFirestore(list);
    try {
      const db = this.firebase.getDb();
      await deleteDoc(doc(db, FIRESTORE_USERS_COL, cleanEmail));
    } catch {
      // ignore
    }
    void this.auth.removeTestMember(cleanEmail).catch(() => undefined);
  }

  // --- ロール別マトリクス・ドメインポリシー操作 API ---

  async toggleRolePagePermission(role: AccessRole, pageKey: AppPageKey): Promise<void> {
    // システム管理者の管理ページアクセスだけはロックアウト防止のため常時 true
    if (role === 'admin' && pageKey === 'admin') return;

    const current = JSON.parse(JSON.stringify(this.roleMatrix())) as RolePermissionMatrix;
    current[role][pageKey] = !current[role][pageKey];
    this.saveConfigToStorage(current, this.domainPolicy());
    await this.persistConfigToFirestore(current, this.domainPolicy());
  }

  async resetMatrixToDefault(): Promise<void> {
    const def = this.getDefaultMatrix();
    this.saveConfigToStorage(def, this.domainPolicy());
    await this.persistConfigToFirestore(def, this.domainPolicy());
  }

  async updateDomainPolicy(patch: Partial<DomainAccessPolicy>): Promise<void> {
    const next: DomainAccessPolicy = {
      ...this.domainPolicy(),
      ...patch,
      updated_at: this.nowStr(),
    };
    this.saveConfigToStorage(this.roleMatrix(), next);
    await this.persistConfigToFirestore(this.roleMatrix(), next);
  }

  private createInitialUsers(): ManagedUser[] {
    return [
      {
        email: 'inoue@ajiado.co.jp',
        name: '井上 賢治',
        department: 'クリエイティブ開発課 / 情報システム',
        title: 'システム最高管理者 (システムオーナー)',
        role: 'admin',
        status: 'active',
        custom_permissions: {},
        note: '全システム・機材・アカウント台帳・権限設定の統括管理者',
        updated_at: '2026/10/29 19:05',
      },
    ];
  }
}
