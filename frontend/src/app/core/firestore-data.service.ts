/**
 * HERON の永続化レイヤ（Cloud Firestore）。
 *
 * Firebase Hosting 上には Go API が存在しないため、機材・操作ログ・保管場所・
 * ユーザー・マスタといった「本来 DB に置くべきデータ」をすべて Firestore の
 * コレクションで保持し、テストメンバー全員が同じデータを共有できるようにする。
 *
 * コレクション構成:
 *   equipments/{equipment_id}    機材
 *   logs/{autoId}                操作ログ（貸出・返却・棚卸し・登録・更新・除却）
 *   locations/{location_id}      保管場所
 *   users/{user_id}              利用者
 *   departments/{code}           部署マスタ
 *   categories/{code}            カテゴリマスタ
 *   shelves/{code}               棚マスタ
 *   counters/{name}              採番カウンタ
 *   system/{doc}                 初期化フラグ等
 *   test_members/{email}         アクセス許可リスト（既存）
 */
import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import {
  ActionType,
  AccessoryItem,
  Equipment,
  EquipmentDetail,
  InventoryResult,
  ListResult,
  Location,
  Paged,
  Stats,
  TransactionLog,
  User,
} from './models';
import { readStoredUser } from './session';

export const COL = {
  equipments: 'equipments',
  logs: 'logs',
  locations: 'locations',
  users: 'users',
  departments: 'departments',
  categories: 'categories',
  shelves: 'shelves',
  counters: 'counters',
  system: 'system',
  versions: 'versions',
} as const;

/** バージョンの繰り上がり種別（大型はほぼ発生しないため通常は使わない） */
export type VersionBumpType = 'major' | 'minor' | 'patch';

/** リリース履歴の 1 件 */
export interface VersionEntry {
  /** 表示用の版数（例: VER1.6.0） */
  version: string;
  major: number;
  minor: number;
  patch: number;
  type: VersionBumpType;
  /** 変更の概要（1 行） */
  title: string;
  /** 具体的な変更・更新内容 */
  description: string;
  released_at: string;
  released_by: string;
  released_by_id?: string;
}

/** 部署マスタ */
export interface DepartmentDoc {
  code: string;
  name: string;
}

/** カテゴリマスタ */
export interface CategoryDoc {
  code: string;
  name: string;
}

/** 棚マスタ */
export interface ShelfDoc {
  code: string;
  room_name: string;
  shelf_name: string;
}

/** 機材登録の入力 */
export interface CreateEquipmentInput {
  name: string;
  category: string;
  dept_id?: string;
  model_number?: string;
  serial_number?: string;
  location_id?: number | string | null;
  user_id?: string | null;
  purchased_at?: string;
  note?: string;
  accessories?: AccessoryItem[];
}

const SEED_LOCATIONS: Location[] = [
  { location_id: 1, room_name: '第1作画室', shelf_name: '機材棚A-1段目' },
  { location_id: 2, room_name: '第2作画室', shelf_name: '機材棚B-2段目' },
  { location_id: 3, room_name: '開発室', shelf_name: 'メイン保管庫' },
];

const SEED_USERS: User[] = [
  { user_id: 'u-admin', login_id: 'inoue@ajiado.co.jp', name: '井上 賢治', role: 'admin' },
];

const SEED_DEPARTMENTS: DepartmentDoc[] = [
  { code: 'DEV', name: '開発部' },
  { code: 'ANIM', name: '制作部' },
  { code: 'SALES', name: '営業部' },
  { code: 'HQ', name: '管理部・本社' },
];

const SEED_CATEGORIES: CategoryDoc[] = [
  { code: 'PC', name: 'パソコン' },
  { code: 'DSP', name: 'ディスプレイ' },
  { code: 'TAB', name: 'ペンタブ・液タブ' },
  { code: 'CAM', name: 'カメラ' },
];

const SEED_SHELVES: ShelfDoc[] = [
  { code: 'SHELF-A1', room_name: '第1作画室', shelf_name: '機材棚A-1段目' },
  { code: 'SHELF-B2', room_name: '第2作画室', shelf_name: '機材棚B-2段目' },
  { code: 'SHELF-DEV01', room_name: '開発室', shelf_name: 'メイン保管庫' },
];

/**
 * これまでのリリース履歴（履歴コレクションが空のときだけ投入する初期データ）。
 * 中型 = 機能・ページの追加、小型 = それ以外の細かい更新。
 */
const SEED_VERSIONS: VersionEntry[] = [
  {
    version: 'VER1.0.0',
    major: 1,
    minor: 0,
    patch: 0,
    type: 'major',
    title: 'HERON 初期リリース',
    description:
      '社内機材管理システムの初期実装。機材台帳（登録・編集・検索）、貸出／返却、棚卸し、QRコードラベル印刷、ログイン認証、保管場所・部署・カテゴリのマスタ管理を実装。',
    released_at: '2026-08-03T00:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.1.0',
    major: 1,
    minor: 1,
    patch: 0,
    type: 'minor',
    title: 'UI/UX 全面刷新と機材台帳のドロワー統合',
    description:
      'HERON Navy (#2A3A4A) テーマ、Outfit フォント、favicon を適用したフラットデザインに刷新。機材の詳細・新規登録・編集を右スライドのドロワー1画面に統合し、ダッシュボードを廃止して統計指標を機材台帳へ集約。',
    released_at: '2026-08-06T00:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.2.0',
    major: 1,
    minor: 2,
    patch: 0,
    type: 'minor',
    title: '付属品チェックリストとカメラQRスキャン',
    description:
      '小物に個別シールを貼らずに管理できる付属品チェックリスト（完備／欠品の判定、付属品の自由な追加・削除）を追加。あわせて機材ID・棚コードの入力欄すべてにカメラでQRを読み取るボタンを設置。',
    released_at: '2026-08-07T01:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.3.0',
    major: 1,
    minor: 3,
    patch: 0,
    type: 'minor',
    title: 'テストメンバー管理ページの追加',
    description:
      '単体テスト環境へアクセスできる Google アカウントのホワイトリスト管理ページを追加。未登録アカウントからのログインを遮断する仕組みとサイドバー導線を実装。',
    released_at: '2026-08-07T02:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.4.0',
    major: 1,
    minor: 4,
    patch: 0,
    type: 'minor',
    title: 'モバイル専用ビューの追加',
    description:
      'スマートフォン向けに、カード表示・ボトムシート型ドロワー・FAB を備えた専用ビューを追加。PC表示は従来のまま100%維持。',
    released_at: '2026-08-07T03:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.5.0',
    major: 1,
    minor: 5,
    patch: 0,
    type: 'minor',
    title: '仕様書PDF閲覧ページと Google 1タップログイン',
    description:
      'サイドバーから仕様書PDFを閲覧できるページを追加。あわせてログイン画面を Google 認証のみの1タップ方式に整理。',
    released_at: '2026-08-07T04:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.5.1',
    major: 1,
    minor: 5,
    patch: 1,
    type: 'patch',
    title: '社内ドメインの自動アクセス許可',
    description:
      '@ajiado.co.jp のアカウントを無条件で許可するよう修正し、プリセットのテストメンバーを同期。特定メンバーがログインできない問題を解消。',
    released_at: '2026-08-07T05:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.6.0',
    major: 1,
    minor: 6,
    patch: 0,
    type: 'minor',
    title: 'テストメンバーの全端末同期（Firestore 化）',
    description:
      'テストメンバーの保存先を端末ごとの localStorage から Firebase Firestore へ移行。どの端末から追加・削除しても全員に即時反映されるようになった。',
    released_at: '2026-08-07T06:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.7.0',
    major: 1,
    minor: 7,
    patch: 0,
    type: 'minor',
    title: '機材・操作ログ・マスタの Firestore 移行',
    description:
      '機材、操作ログ、保管場所、利用者、各種マスタの保存先を Firestore に移行し、テストメンバー全員で同じデータを共有できるようにした。機材IDの採番をトランザクション化して重複を防止。旧 localStorage のデータは初回ログイン時に自動移行。あわせて、新規登録時に選んだ保管場所が保存されない不具合、除却してもステータスが変わらない不具合、存在しない機材IDのスキャンでダミー画面が開く不具合を修正。',
    released_at: '2026-08-07T07:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.7.1',
    major: 1,
    minor: 7,
    patch: 1,
    type: 'patch',
    title: '操作履歴の操作者を実際の作業者で記録',
    description:
      '操作者を端末に保存された古いログイン情報から取得していたため、すべての操作が別人の名前で記録される問題を修正。実際に Google 認証しているアカウントを操作者として記録し、認証セッションが無い端末は再ログインを求めるようにした。',
    released_at: '2026-08-07T08:00:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.7.2',
    major: 1,
    minor: 7,
    patch: 2,
    type: 'patch',
    title: 'Hosting のキャッシュ設定を修正',
    description:
      'index.html が1時間キャッシュされ、更新後も古い画面が表示され続ける問題を修正。HTML は毎回取得し直し、ハッシュ付きの静的ファイルのみ長期キャッシュする設定に変更。',
    released_at: '2026-08-07T08:30:00.000Z',
    released_by: '井上 賢治',
  },
  {
    version: 'VER1.8.0',
    major: 1,
    minor: 8,
    patch: 0,
    type: 'minor',
    title: 'テスト設定ページとバージョン管理の追加',
    description:
      'サイドバーの「テストメンバー」を「テスト設定」に名称変更。アクセス許可済みアカウント一覧の右に Ver情報 欄を新設し、リリースごとの版数と変更内容を Firestore に記録・共有できるようにした。中型アップデート（機能・ページの追加）で中央、小型アップデート（その他の更新）で右端の数字が繰り上がる。',
    released_at: '2026-08-07T09:00:00.000Z',
    released_by: '井上 賢治',
  },
];

/** 端末ローカル（旧 localStorage 版）データの移行済みフラグ */
const MIGRATION_FLAG = 'heron.firestore.migrated.v1';
const LEGACY_EQUIPMENTS_KEY = 'heron.local.equipments';
const LEGACY_LOGS_KEY = 'heron.local.logs';
const LEGACY_DEPT_KEY = 'heron.master.departments';
const LEGACY_CAT_KEY = 'heron.master.categories';
const LEGACY_SHELF_KEY = 'heron.master.shelves';

/** Firestore は undefined を受け付けないため取り除く。 */
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** 未ログイン状態での初期化スキップを表す（次回呼び出しでやり直す）。 */
class NotAuthenticatedError extends Error {
  constructor() {
    super('Firebase 認証が未確立のため Firestore 初期化を保留しました');
  }
}

function readLegacy<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class FirestoreDataService {
  private readonly firebase = inject(FirebaseService);
  private readonly db = this.firebase.getDb();

  /** 初期化（シード投入・ローカルデータ移行）は 1 度だけ実行する。 */
  private readyPromise: Promise<void> | null = null;

  // ---------------------------------------------------------------- 初期化

  ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.initialize().catch((err) => {
        // 未ログイン時などで失敗した場合は記憶せず、次の呼び出しでやり直す。
        this.readyPromise = null;
        if (!(err instanceof NotAuthenticatedError)) {
          console.warn('[HERON] Firestore 初期化に失敗しました:', err);
        }
      });
    }
    return this.readyPromise;
  }

  private async initialize(): Promise<void> {
    // 認証が確立する前に読み書きすると Firestore ルールで拒否される
    await this.firebase.waitForAuth();
    if (!this.firebase.getAuth().currentUser) throw new NotAuthenticatedError();
    await this.seedDefaults();
    await this.migrateLegacyLocalData();
    await this.purgeSampleEquipments();
  }

  /**
   * 既存のサンプル機材データを Firestore および localStorage から一括削除し、
   * 機材ID採番カウンタをリセットする（初回のみ実行、以降の新規登録機材は保持）。
   */
  private async purgeSampleEquipments(): Promise<void> {
    try {
      localStorage.removeItem(LEGACY_EQUIPMENTS_KEY);
    } catch {
      // ignore
    }

    const purgeFlagRef = doc(this.db, COL.system, 'purged_sample_equipments_v1');
    const purgeFlagSnap = await getDoc(purgeFlagRef);
    if (purgeFlagSnap.exists()) return;

    const eqSnap = await getDocs(collection(this.db, COL.equipments));
    await Promise.all(eqSnap.docs.map((d) => deleteDoc(d.ref).catch(() => undefined)));

    // 機材ID採番カウンタ（DEPT_CAT）も 0 にリセットして次回登録が 00001 から始まるようにする
    const counterSnap = await getDocs(collection(this.db, COL.counters));
    await Promise.all(
      counterSnap.docs
        .filter((d) => d.id !== 'locations')
        .map((d) => deleteDoc(d.ref).catch(() => undefined)),
    );

    await setDoc(purgeFlagRef, {
      purged_at: new Date().toISOString(),
      deleted_count: eqSnap.size,
    });
  }

  /** マスタ・保管場所・ユーザーの初期データを投入（ドキュメント ID 固定なので冪等）。 */
  private async seedDefaults(): Promise<void> {
    const flagRef = doc(this.db, COL.system, 'bootstrap');
    const flagSnap = await getDoc(flagRef);
    if (flagSnap.exists()) return;

    await Promise.all([
      ...SEED_LOCATIONS.map((l) =>
        setDoc(doc(this.db, COL.locations, String(l.location_id)), l, { merge: true }),
      ),
      ...SEED_USERS.map((u) => setDoc(doc(this.db, COL.users, u.user_id), u, { merge: true })),
      ...SEED_DEPARTMENTS.map((d) =>
        setDoc(doc(this.db, COL.departments, d.code), d, { merge: true }),
      ),
      ...SEED_CATEGORIES.map((c) =>
        setDoc(doc(this.db, COL.categories, c.code), c, { merge: true }),
      ),
      ...SEED_SHELVES.map((s) => setDoc(doc(this.db, COL.shelves, s.code), s, { merge: true })),
      setDoc(doc(this.db, COL.counters, 'locations'), { seq: SEED_LOCATIONS.length }, { merge: true }),
    ]);

    await setDoc(flagRef, { seeded_at: new Date().toISOString(), version: 1 });
  }

  /**
   * 旧バージョン（localStorage 保存）で登録したログ・マスタを Firestore へ移行する。
   * （サンプル機材の再混入を防ぐため、localStorage からの機材自動移行は無効化）
   */
  private async migrateLegacyLocalData(): Promise<void> {
    try {
      localStorage.removeItem(LEGACY_EQUIPMENTS_KEY);
    } catch {
      // ignore
    }
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const logs = readLegacy<TransactionLog>(LEGACY_LOGS_KEY);
    const departments = readLegacy<DepartmentDoc>(LEGACY_DEPT_KEY);
    const categories = readLegacy<CategoryDoc>(LEGACY_CAT_KEY);
    const shelves = readLegacy<ShelfDoc>(LEGACY_SHELF_KEY);

    // 1 件失敗しても残りは移行できるよう、個別に握りつぶす。
    const attempt = async (label: string, op: () => Promise<unknown>): Promise<void> => {
      try {
        await op();
      } catch (err) {
        console.warn(`[HERON] ${label} の移行に失敗しました:`, err);
      }
    };

    const actor = this.currentActor();
    for (const log of logs) {
      if (!log?.equipment_id) continue;
      const stamp = log.log_id || Date.parse(log.timestamp ?? '') || 0;
      const id = `legacy-${stamp}-${log.equipment_id}`;
      const payload = { ...log } as unknown as Record<string, unknown>;

      // 旧版は操作者をデモ用の管理者アカウントで固定していた。実際に操作したのは
      // この端末の利用者なので、その人に付け替える（判別不能なら不明として残す）。
      if (!payload['actor_user_id'] || payload['actor_user_id'] === 'u-admin') {
        delete payload['actor'];
        payload['actor_user_id'] = actor?.user_id ?? 'unknown';
        payload['actor_name'] = actor?.name ?? '不明なユーザー (旧データ)';
        payload['actor_login_id'] = actor?.login_id ?? '';
        payload['actor_reassigned_on_migration'] = true;
      }

      // logs は追記のみ許可のため、既存ドキュメントには書き込まない
      await attempt(`操作ログ ${id}`, async () => {
        const ref = doc(this.db, COL.logs, id);
        if ((await getDoc(ref)).exists()) return;
        await setDoc(ref, clean(payload));
      });
    }

    for (const d of departments) {
      await attempt(`部署 ${d.code}`, () =>
        setDoc(doc(this.db, COL.departments, d.code), d, { merge: true }),
      );
    }
    for (const c of categories) {
      await attempt(`カテゴリ ${c.code}`, () =>
        setDoc(doc(this.db, COL.categories, c.code), c, { merge: true }),
      );
    }
    for (const s of shelves) {
      await attempt(`保管場所 ${s.code}`, () =>
        setDoc(doc(this.db, COL.shelves, s.code), s, { merge: true }),
      );
    }

    localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  }

  // ---------------------------------------------------------------- 採番

  /** counters/{key} をインクリメントして次の連番を返す。 */
  private async nextSequence(key: string): Promise<number> {
    const ref = doc(this.db, COL.counters, key);
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const next = ((snap.exists() ? (snap.data()['seq'] as number) : 0) || 0) + 1;
      tx.set(ref, { seq: next }, { merge: true });
      return next;
    });
  }

  /** カウンタを指定値まで引き上げる（移行時の追随用）。 */
  private async raiseCounter(key: string, value: number): Promise<void> {
    const ref = doc(this.db, COL.counters, key);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.exists() ? (snap.data()['seq'] as number) : 0) || 0;
      if (value > current) tx.set(ref, { seq: value }, { merge: true });
    });
  }

  /**
   * システムオーナー（inoue@ajiado.co.jp / admin）および旧表記（井上 健二 / 井上 (システムオーナー)）を
   * 正式氏名『井上 賢治』に正規化する。
   */
  private normalizeUserName(loginId?: string | null, rawName?: string | null): string {
    const email = (loginId || '').trim().toLowerCase();
    const name = (rawName || '').trim();
    if (
      email === 'inoue@ajiado.co.jp' ||
      email === 'admin' ||
      email === 'admin@heron.app' ||
      name === '井上 (システムオーナー)' ||
      name === '井上' ||
      name.startsWith('井上 健二')
    ) {
      return '井上 賢治';
    }
    return name || email || '不明なユーザー';
  }

  private normalizeUser(u: User): User {
    return {
      ...u,
      name: this.normalizeUserName(u.login_id, u.name),
    };
  }

  // ---------------------------------------------------------------- 参照系

  private async loadUserMap(): Promise<Map<string, User>> {
    const snap = await getDocs(collection(this.db, COL.users));
    return new Map(
      snap.docs
        .filter((d) => d.id !== 'u-anim1' && d.id !== 'u-anim2')
        .map((d) => [d.id, this.normalizeUser(d.data() as User)]),
    );
  }

  private async loadLocationMap(): Promise<Map<number, Location>> {
    const snap = await getDocs(collection(this.db, COL.locations));
    return new Map(snap.docs.map((d) => [Number(d.id), d.data() as Location]));
  }

  private async loadShelfMap(): Promise<Map<string, ShelfDoc>> {
    const snap = await getDocs(collection(this.db, COL.shelves));
    return new Map(snap.docs.map((d) => [d.id, d.data() as ShelfDoc]));
  }

  /**
   * 画面の保管場所プルダウンは棚コード（文字列）を返すため、
   * 数値の location_id と棚コードを切り分けて保存する。
   */
  private splitLocation(value: number | string | null | undefined): {
    current_location_id: number | null;
    shelf_code: string | null;
  } {
    if (value == null || value === '') return { current_location_id: null, shelf_code: null };
    if (typeof value === 'number') return { current_location_id: value, shelf_code: null };
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && String(asNumber) === String(value).trim()) {
      return { current_location_id: asNumber, shelf_code: null };
    }
    return { current_location_id: null, shelf_code: String(value).toUpperCase().trim() };
  }

  private enrich(
    eq: Equipment,
    users: Map<string, User>,
    locations: Map<number, Location>,
    shelves: Map<string, ShelfDoc>,
  ): Equipment {
    let current_location: Location | null = null;
    if (eq.current_location_id != null) {
      current_location = locations.get(Number(eq.current_location_id)) ?? null;
    }
    if (!current_location && eq.shelf_code) {
      const shelf = shelves.get(eq.shelf_code);
      if (shelf) {
        current_location = {
          location_id: 0,
          room_name: shelf.room_name,
          shelf_name: `${shelf.code} (${shelf.shelf_name})`,
        };
      }
    }

    return {
      ...eq,
      current_user: eq.current_user_id ? (users.get(eq.current_user_id) ?? null) : null,
      current_location,
    };
  }

  // ---------------------------------------------------------------- 機材

  async listEquipments(
    q: {
      q?: string;
      category?: string;
      status?: string;
      location_id?: number;
      user_id?: string;
      include_discarded?: boolean;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<Paged<Equipment>> {
    await this.ready();
    const [snap, users, locations, shelves] = await Promise.all([
      getDocs(collection(this.db, COL.equipments)),
      this.loadUserMap(),
      this.loadLocationMap(),
      this.loadShelfMap(),
    ]);

    let items = snap.docs.map((d) => this.enrich(d.data() as Equipment, users, locations, shelves));

    if (!q.include_discarded) items = items.filter((e) => e.status !== 'discarded');
    if (q.category) items = items.filter((e) => e.category === q.category);
    if (q.status) items = items.filter((e) => e.status === q.status);
    if (q.location_id != null) {
      items = items.filter((e) => Number(e.current_location_id) === Number(q.location_id));
    }
    if (q.user_id) items = items.filter((e) => e.current_user_id === q.user_id);
    if (q.q) {
      const needle = q.q.trim().toLowerCase();
      items = items.filter((e) =>
        [
          e.equipment_id,
          e.name,
          e.model_number ?? '',
          e.serial_number ?? '',
          e.note ?? '',
          e.current_user?.name ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }

    items.sort((a, b) => a.equipment_id.localeCompare(b.equipment_id));

    const total = items.length;
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 1000;
    const start = (page - 1) * perPage;

    return { items: items.slice(start, start + perPage), total, page, per_page: perPage };
  }

  async getEquipment(id: string): Promise<EquipmentDetail> {
    await this.ready();
    let targetData: Equipment | null = null;
    let resolvedId = id;

    const snap = await getDoc(doc(this.db, COL.equipments, id));
    if (snap.exists()) {
      targetData = snap.data() as Equipment;
    } else {
      // 機材IDで見つからない場合、シリアル番号 (S/N) での一致も照合
      const allSnap = await getDocs(collection(this.db, COL.equipments));
      const needle = id.trim().toUpperCase();
      for (const d of allSnap.docs) {
        const eq = d.data() as Equipment;
        if (
          eq.equipment_id?.toUpperCase() === needle ||
          (eq.serial_number && eq.serial_number.trim().toUpperCase() === needle)
        ) {
          targetData = eq;
          resolvedId = eq.equipment_id;
          break;
        }
      }
    }

    if (!targetData) {
      throw { status: 404, error: { error: `機材ID または シリアル番号「${id}」は登録されていません` } };
    }
    const [users, locations, shelves] = await Promise.all([
      this.loadUserMap(),
      this.loadLocationMap(),
      this.loadShelfMap(),
    ]);
    const equipment = this.enrich(targetData, users, locations, shelves);
    const recent_logs = await this.logsForEquipment(resolvedId, users, locations);
    return { equipment, recent_logs };
  }

  async createEquipment(body: CreateEquipmentInput): Promise<Equipment> {
    await this.ready();
    const dept = (body.dept_id || 'DEV').toUpperCase().trim();
    const cat = (body.category || 'TAB').toUpperCase().trim();
    const seq = await this.nextSequence(`${dept}_${cat}`);
    const equipmentId = `${dept}-${cat}-${String(seq).padStart(5, '0')}`;
    const place = this.splitLocation(body.location_id);
    const now = new Date().toISOString();
    const serialNumber = (body.serial_number || '').trim();

    const equipment: Equipment = {
      equipment_id: equipmentId,
      name: body.name,
      category: body.category,
      model_number: body.model_number || '',
      serial_number: serialNumber,
      status: body.user_id ? 'in_use' : 'available',
      current_user_id: body.user_id || null,
      current_location_id: place.current_location_id,
      shelf_code: place.shelf_code,
      purchased_at: body.purchased_at || new Date().toISOString().split('T')[0],
      note: body.note || '',
      accessories: body.accessories ?? [],
    };

    await setDoc(
      doc(this.db, COL.equipments, equipmentId),
      clean({ ...equipment, dept_id: dept, created_at: now, updated_at: now }),
    );
    await this.writeLog({
      equipment_id: equipmentId,
      action_type: 'create',
      note: serialNumber ? `新規機材登録 (S/N: ${serialNumber})` : '新規機材登録',
      equipment_name: equipment.name,
      target_location_id: place.current_location_id,
    });

    return equipment;
  }

  async updateEquipment(id: string, body: Record<string, unknown>): Promise<Equipment> {
    await this.ready();
    const ref = doc(this.db, COL.equipments, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw { status: 404, error: { error: `機材ID「${id}」は登録されていません` } };
    }

    const input = { ...body };
    // 画面からは棚コード（文字列）が current_location_id として届くことがある
    if ('current_location_id' in input) {
      const place = this.splitLocation(input['current_location_id'] as number | string | null);
      input['current_location_id'] = place.current_location_id;
      input['shelf_code'] = place.shelf_code;
    }

    const patch = clean({ ...input, updated_at: new Date().toISOString() });
    await updateDoc(ref, patch);

    const merged = { ...(snap.data() as Equipment), ...patch } as Equipment;
    await this.writeLog({
      equipment_id: id,
      action_type: 'update',
      note: '機材情報・付属品更新',
      equipment_name: merged.name,
    });
    return merged;
  }

  async discardEquipment(id: string): Promise<Equipment> {
    await this.ready();
    const ref = doc(this.db, COL.equipments, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw { status: 404, error: { error: `機材ID「${id}」は登録されていません` } };
    }
    await updateDoc(ref, {
      status: 'discarded',
      current_user_id: null,
      updated_at: new Date().toISOString(),
    });
    const merged = { ...(snap.data() as Equipment), status: 'discarded' as const };
    await this.writeLog({
      equipment_id: id,
      action_type: 'discard',
      note: '除却処理',
      equipment_name: merged.name,
    });
    return merged;
  }

  async myEquipments(): Promise<ListResult<Equipment>> {
    const me = readStoredUser();
    const res = await this.listEquipments(me ? { user_id: me.user_id } : {});
    return { items: res.items, total: res.total };
  }

  // ---------------------------------------------------------------- 貸出・返却・棚卸し

  async lend(
    equipmentId: string,
    targetUserId: string,
    note = '',
    locationOrShelf?: number | string | null,
  ): Promise<Equipment> {
    await this.ready();
    const ref = doc(this.db, COL.equipments, equipmentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw { status: 404, error: { error: `機材ID「${equipmentId}」は登録されていません` } };
    }
    const current = snap.data() as Equipment;
    if (current.status === 'in_use') {
      throw { status: 409, error: { error: 'この機材はすでに貸出中です' } };
    }
    if (current.status === 'discarded') {
      throw { status: 409, error: { error: 'この機材は除却済みのため貸出できません' } };
    }

    const place =
      locationOrShelf !== undefined
        ? this.splitLocation(locationOrShelf)
        : {
            current_location_id: current.current_location_id ?? null,
            shelf_code: current.shelf_code ?? null,
          };

    await updateDoc(ref, {
      status: 'in_use',
      current_user_id: targetUserId,
      current_location_id: place.current_location_id,
      shelf_code: place.shelf_code,
      updated_at: new Date().toISOString(),
    });

    const users = await this.loadUserMap();
    await this.writeLog({
      equipment_id: equipmentId,
      action_type: 'lend',
      target_user_id: targetUserId,
      target_user_name: users.get(targetUserId)?.name,
      target_location_id: place.current_location_id,
      equipment_name: current.name,
      note: note || (place.shelf_code ? `貸出登録 (棚: ${place.shelf_code})` : '貸出登録'),
    });

    return {
      ...current,
      status: 'in_use',
      current_user_id: targetUserId,
      current_location_id: place.current_location_id,
      shelf_code: place.shelf_code,
    };
  }

  async returnEquipment(
    equipmentId: string,
    locationOrShelf: number | string,
    note = '',
  ): Promise<Equipment> {
    await this.ready();
    const ref = doc(this.db, COL.equipments, equipmentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw { status: 404, error: { error: `機材ID「${equipmentId}」は登録されていません` } };
    }
    const current = snap.data() as Equipment;
    const place = this.splitLocation(locationOrShelf);

    await updateDoc(ref, {
      status: 'available',
      current_user_id: null,
      current_location_id: place.current_location_id,
      shelf_code: place.shelf_code,
      updated_at: new Date().toISOString(),
    });

    await this.writeLog({
      equipment_id: equipmentId,
      action_type: 'return',
      target_location_id: place.current_location_id,
      equipment_name: current.name,
      note: note || (place.shelf_code ? `返却処理 (返却棚: ${place.shelf_code})` : '返却処理'),
    });

    return {
      ...current,
      status: 'available',
      current_user_id: null,
      current_location_id: place.current_location_id,
      shelf_code: place.shelf_code,
    };
  }

  async inventory(
    locationOrShelf: number | string,
    equipmentIds: string[],
  ): Promise<InventoryResult> {
    await this.ready();
    const all = await getDocs(collection(this.db, COL.equipments));
    const byId = new Map(all.docs.map((d) => [d.id, d.data() as Equipment]));
    const place = this.splitLocation(locationOrShelf);

    const isSamePlace = (eq: Equipment): boolean => {
      if (place.shelf_code) {
        return (eq.shelf_code ?? '').toUpperCase() === place.shelf_code.toUpperCase();
      }
      if (place.current_location_id != null) {
        return Number(eq.current_location_id) === Number(place.current_location_id);
      }
      return false;
    };

    const updated: string[] = [];
    const movedIn: string[] = [];
    const notFound: string[] = [];
    const skipped: string[] = [];

    for (const id of equipmentIds) {
      const eq = byId.get(id);
      if (!eq) {
        notFound.push(id);
        continue;
      }
      if (eq.status === 'discarded') {
        skipped.push(id);
        continue;
      }
      const wasHere = isSamePlace(eq);
      await updateDoc(doc(this.db, COL.equipments, id), {
        current_location_id: place.current_location_id,
        shelf_code: place.shelf_code,
        status: 'available',
        current_user_id: null,
        updated_at: new Date().toISOString(),
      });
      await this.writeLog({
        equipment_id: id,
        action_type: 'inventory',
        target_location_id: place.current_location_id,
        equipment_name: eq.name,
        note: wasHere
          ? `棚卸し照合${place.shelf_code ? ` (棚: ${place.shelf_code})` : ''}`
          : `棚卸しにより所在更新${place.shelf_code ? ` (棚: ${place.shelf_code})` : ''}`,
      });
      updated.push(id);
      if (!wasHere) movedIn.push(id);
    }

    // この棚にあるはずなのに読み取られなかった機材
    const scanned = new Set(equipmentIds);
    const missing = [...byId.values()]
      .filter((e) => isSamePlace(e) && e.status !== 'discarded' && !scanned.has(e.equipment_id))
      .map((e) => e.equipment_id);

    return {
      location_id: locationOrShelf,
      updated,
      moved_in: movedIn,
      missing,
      not_found: notFound,
      skipped,
    };
  }

  // ---------------------------------------------------------------- 操作ログ

  /**
   * 操作者を特定する。
   *
   * localStorage の保存値は前回ログイン時のスナップショットで、古いセッションが
   * 残っている端末では別人（デモ用の管理者アカウント等）のままになりうる。
   * そのため実際に Google 認証されているアカウントを最優先で採用する。
   */
  private currentActor(): User | null {
    const fbUser = this.firebase.getAuth().currentUser;
    const stored = readStoredUser();

    if (fbUser) {
      // 認証済みアカウントと保存値が一致するときだけ、保存されている表示名を使う
      const sameUser = stored?.user_id === fbUser.uid;
      const loginId = (fbUser.email ?? stored?.login_id ?? '').toLowerCase();
      const rawName = fbUser.displayName ?? (sameUser ? stored!.name : (fbUser.email ?? '不明なユーザー'));
      return {
        user_id: fbUser.uid,
        login_id: loginId,
        name: this.normalizeUserName(loginId, rawName),
        role: sameUser ? stored!.role : 'admin',
      };
    }

    return stored ? this.normalizeUser(stored) : null;
  }

  /** ログを 1 件追記する（表示用に操作者・機材名などを非正規化して保存）。 */
  private async writeLog(entry: {
    equipment_id: string;
    action_type: ActionType;
    target_user_id?: string | null;
    target_user_name?: string;
    target_location_id?: number | null;
    equipment_name?: string;
    note?: string;
  }): Promise<void> {
    const me = this.currentActor();
    const now = new Date();
    const logId = now.getTime();
    const docId = `${now.toISOString()}_${entry.equipment_id}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const payload = clean({
      log_id: logId,
      equipment_id: entry.equipment_id,
      action_type: entry.action_type,
      actor_user_id: me?.user_id ?? 'unknown',
      actor_name: me?.name ?? '不明なユーザー',
      actor_login_id: me?.login_id ?? '',
      target_user_id: entry.target_user_id ?? null,
      target_user_name: entry.target_user_name ?? null,
      target_location_id: entry.target_location_id ?? null,
      equipment_name: entry.equipment_name ?? null,
      note: entry.note ?? '',
      timestamp: now.toISOString(),
    });

    await setDoc(doc(this.db, COL.logs, docId), payload);
  }

  /** Firestore ドキュメント → 画面表示用の TransactionLog */
  private toLog(
    id: string,
    data: Record<string, any>,
    users: Map<string, User>,
    locations: Map<number, Location>,
  ): TransactionLog {
    const rawActor: User = data['actor'] ??
      users.get(data['actor_user_id']) ?? {
        user_id: data['actor_user_id'] ?? 'unknown',
        login_id: data['actor_login_id'] ?? '',
        name: data['actor_name'] ?? data['actor_user_id'] ?? '不明なユーザー',
        role: 'general',
      };
    const actor = this.normalizeUser(rawActor);

    const targetUser = data['target_user_id']
      ? this.normalizeUser(
          users.get(data['target_user_id']) ??
            ({
              user_id: data['target_user_id'],
              login_id: '',
              name: data['target_user_name'] ?? data['target_user_id'],
              role: 'general',
            } as User),
        )
      : undefined;

    const targetLocation =
      data['target_location_id'] != null
        ? locations.get(Number(data['target_location_id']))
        : undefined;

    return {
      id,
      log_id: Number(data['log_id']) || Date.parse(data['timestamp'] ?? '') || 0,
      equipment_id: data['equipment_id'],
      action_type: data['action_type'],
      actor_user_id: data['actor_user_id'] ?? 'unknown',
      target_user_id: data['target_user_id'] ?? null,
      target_location_id: data['target_location_id'] ?? null,
      note: data['note'] ?? '',
      timestamp: data['timestamp'] ?? new Date(0).toISOString(),
      actor,
      target_user: targetUser,
      target_location: targetLocation,
      equipment: data['equipment_name']
        ? ({ equipment_id: data['equipment_id'], name: data['equipment_name'] } as Equipment)
        : (data['equipment'] ?? undefined),
    };
  }

  private async logsForEquipment(
    equipmentId: string,
    users: Map<string, User>,
    locations: Map<number, Location>,
  ): Promise<TransactionLog[]> {
    // equipment_id での絞り込みのみ（複合インデックス不要）。並び替えはクライアント側。
    const snap = await getDocs(
      query(collection(this.db, COL.logs), where('equipment_id', '==', equipmentId)),
    );
    return snap.docs
      .map((d) => this.toLog(d.id, d.data(), users, locations))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 20);
  }

  async listLogs(page = 1, perPage = 50): Promise<Paged<TransactionLog>> {
    await this.ready();
    const logsCol = collection(this.db, COL.logs);
    const [countSnap, snap, users, locations] = await Promise.all([
      getCountFromServer(logsCol),
      getDocs(query(logsCol, orderBy('timestamp', 'desc'), limit(page * perPage))),
      this.loadUserMap(),
      this.loadLocationMap(),
    ]);

    const all = snap.docs.map((d) => this.toLog(d.id, d.data(), users, locations));
    const start = (page - 1) * perPage;
    return {
      items: all.slice(start, start + perPage),
      total: countSnap.data().count,
      page,
      per_page: perPage,
    };
  }

  // ---------------------------------------------------------------- 保管場所

  async listLocations(): Promise<ListResult<Location>> {
    await this.ready();
    const snap = await getDocs(collection(this.db, COL.locations));
    const items = snap.docs
      .map((d) => d.data() as Location)
      .sort((a, b) => a.location_id - b.location_id);
    return { items, total: items.length };
  }

  async createLocation(roomName: string, shelfName: string): Promise<Location> {
    await this.ready();
    const id = await this.nextSequence('locations');
    const location: Location = { location_id: id, room_name: roomName, shelf_name: shelfName };
    await setDoc(doc(this.db, COL.locations, String(id)), location);
    return location;
  }

  async deleteLocation(id: number): Promise<void> {
    await this.ready();
    await deleteDoc(doc(this.db, COL.locations, String(id)));
  }

  // ---------------------------------------------------------------- ユーザー

  async listUsers(role?: string): Promise<ListResult<User>> {
    await this.ready();
    const snap = await getDocs(collection(this.db, COL.users));
    let items = snap.docs
      .filter((d) => d.id !== 'u-anim1' && d.id !== 'u-anim2')
      .map((d) => this.normalizeUser(d.data() as User));
    // 同一メールアドレスや u-admin の重複がある場合は実アカウントを優先し重複排除
    const byNameOrEmail = new Map<string, User>();
    for (const u of items) {
      const key = (u.login_id || u.name).toLowerCase();
      if (!byNameOrEmail.has(key) || u.user_id !== 'u-admin') {
        byNameOrEmail.set(key, u);
      }
    }
    items = [...byNameOrEmail.values()];
    if (role) items = items.filter((u) => u.role === role);
    items.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return { items, total: items.length };
  }

  async createUser(body: { login_id: string; name: string; role: string }): Promise<User> {
    await this.ready();
    const user: User = {
      user_id: `u-${Date.now()}`,
      login_id: body.login_id,
      name: this.normalizeUserName(body.login_id, body.name),
      role: (body.role as User['role']) ?? 'general',
    };
    await setDoc(doc(this.db, COL.users, user.user_id), user);
    return user;
  }

  /**
   * ログインしたユーザーを users コレクションへ登録・更新する。
   * これにより貸出先の選択肢に実在のテストメンバーが並ぶ。
   */
  async upsertUser(user: User): Promise<void> {
    const normalized = this.normalizeUser(user);
    await setDoc(
      doc(this.db, COL.users, normalized.user_id),
      clean({ ...normalized, last_login_at: new Date().toISOString() }),
      { merge: true },
    );
  }

  // ---------------------------------------------------------------- マスタ

  async listDepartments(): Promise<DepartmentDoc[]> {
    await this.ready();
    const snap = await getDocs(collection(this.db, COL.departments));
    return snap.docs.map((d) => d.data() as DepartmentDoc).sort((a, b) => a.code.localeCompare(b.code));
  }

  async saveDepartment(dept: DepartmentDoc): Promise<void> {
    await setDoc(doc(this.db, COL.departments, dept.code), dept);
  }

  async deleteDepartment(code: string): Promise<void> {
    await deleteDoc(doc(this.db, COL.departments, code));
  }

  async listCategories(): Promise<CategoryDoc[]> {
    await this.ready();
    const snap = await getDocs(collection(this.db, COL.categories));
    return snap.docs.map((d) => d.data() as CategoryDoc).sort((a, b) => a.code.localeCompare(b.code));
  }

  async saveCategory(cat: CategoryDoc): Promise<void> {
    await setDoc(doc(this.db, COL.categories, cat.code), cat);
  }

  async deleteCategory(code: string): Promise<void> {
    await deleteDoc(doc(this.db, COL.categories, code));
  }

  async listShelves(): Promise<ShelfDoc[]> {
    await this.ready();
    const snap = await getDocs(collection(this.db, COL.shelves));
    return snap.docs.map((d) => d.data() as ShelfDoc).sort((a, b) => a.code.localeCompare(b.code));
  }

  async saveShelf(shelf: ShelfDoc): Promise<void> {
    await setDoc(doc(this.db, COL.shelves, shelf.code), shelf);
  }

  async deleteShelf(code: string): Promise<void> {
    await deleteDoc(doc(this.db, COL.shelves, code));
  }

  // ---------------------------------------------------------------- バージョン履歴

  /** 版数から並び替え可能なドキュメント ID を作る（例: 01.008.000）。 */
  private versionDocId(major: number, minor: number, patch: number): string {
    return [
      String(major).padStart(2, '0'),
      String(minor).padStart(3, '0'),
      String(patch).padStart(3, '0'),
    ].join('.');
  }

  private sortVersions(items: VersionEntry[]): VersionEntry[] {
    return items.sort(
      (a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch,
    );
  }

  async listVersions(): Promise<VersionEntry[]> {
    await this.ready();
    await this.ensureVersionHistory();
    const snap = await getDocs(collection(this.db, COL.versions));
    return this.sortVersions(snap.docs.map((d) => d.data() as VersionEntry));
  }

  /** 現在の版（履歴が空なら null）。 */
  async currentVersion(): Promise<VersionEntry | null> {
    const all = await this.listVersions();
    return all[0] ?? null;
  }

  /**
   * 新しい版を記録する。
   * 中型（minor）は機能・ページの追加、小型（patch）はそれ以外の細かい更新。
   */
  async addVersion(input: {
    type: VersionBumpType;
    title: string;
    description: string;
  }): Promise<VersionEntry> {
    await this.ready();
    const latest = await this.currentVersion();
    const base = latest ?? { major: 1, minor: 0, patch: 0 };

    let major = base.major;
    let minor = base.minor;
    let patch = base.patch;
    if (input.type === 'major') {
      major += 1;
      minor = 0;
      patch = 0;
    } else if (input.type === 'minor') {
      minor += 1;
      patch = 0;
    } else {
      patch += 1;
    }

    // 同時操作で版数が衝突した場合は空いている番号まで進める
    let docId = this.versionDocId(major, minor, patch);
    while ((await getDoc(doc(this.db, COL.versions, docId))).exists()) {
      if (input.type === 'major') major += 1;
      else if (input.type === 'minor') minor += 1;
      else patch += 1;
      docId = this.versionDocId(major, minor, patch);
    }

    const actor = this.currentActor();
    const entry: VersionEntry = {
      version: `VER${major}.${minor}.${patch}`,
      major,
      minor,
      patch,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      released_at: new Date().toISOString(),
      released_by: actor?.name ?? '不明なユーザー',
      released_by_id: actor?.user_id ?? 'unknown',
    };

    await setDoc(doc(this.db, COL.versions, docId), clean({ ...entry }));
    return entry;
  }

  async deleteVersion(entry: VersionEntry): Promise<void> {
    await this.ready();
    await deleteDoc(
      doc(this.db, COL.versions, this.versionDocId(entry.major, entry.minor, entry.patch)),
    );
  }

  /** 履歴が空のときだけ、これまでのリリース内容を投入する。 */
  private async ensureVersionHistory(): Promise<void> {
    const snap = await getDocs(query(collection(this.db, COL.versions), limit(1)));
    if (!snap.empty) return;

    for (const seed of SEED_VERSIONS) {
      const docId = this.versionDocId(seed.major, seed.minor, seed.patch);
      await setDoc(doc(this.db, COL.versions, docId), clean({ ...seed }), { merge: true });
    }
  }

  // ---------------------------------------------------------------- 統計

  async stats(): Promise<Stats> {
    await this.ready();
    const snap = await getDocs(collection(this.db, COL.equipments));
    const by_status: Stats['by_status'] = {
      available: 0,
      in_use: 0,
      maintenance: 0,
      discarded: 0,
    };
    for (const d of snap.docs) {
      const s = (d.data() as Equipment).status;
      if (s in by_status) by_status[s] += 1;
    }
    return {
      by_status,
      active_total: by_status.available + by_status.in_use + by_status.maintenance,
    };
  }
}
