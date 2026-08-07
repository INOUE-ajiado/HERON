import { Injectable, inject, signal } from '@angular/core';
import { onAuthStateChanged } from 'firebase/auth';

import { FirebaseService } from './firebase.service';
import { FirestoreDataService } from './firestore-data.service';

export interface DepartmentMaster {
  code: string;
  name: string;
}

export interface CategoryMaster {
  code: string;
  name: string;
}

export interface ShelfMaster {
  code: string;
  room_name: string;
  shelf_name: string;
}

/**
 * 直近に読み込んだ Firestore の内容を端末に控えておくキャッシュ。
 * 初期描画を空にしないためだけに使い、正はつねに Firestore 側。
 */
const CACHE_KEY = 'heron.master.cache.v2';

interface MasterCache {
  departments: DepartmentMaster[];
  categories: CategoryMaster[];
  shelves: ShelfMaster[];
}

function readCache(): MasterCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { departments: [], categories: [], shelves: [] };
    const parsed = JSON.parse(raw) as Partial<MasterCache>;
    return {
      departments: parsed.departments ?? [],
      categories: parsed.categories ?? [],
      shelves: parsed.shelves ?? [],
    };
  } catch {
    return { departments: [], categories: [], shelves: [] };
  }
}

/**
 * 部署・カテゴリ・棚のマスタ管理（Firestore による全端末共有）。
 *
 * 画面側は同期的な signal を読むだけで済むよう、Firestore への書き込みは
 * 内部で非同期に行い、signal は即時更新する（楽観更新）。
 */
@Injectable({ providedIn: 'root' })
export class MasterService {
  private readonly store = inject(FirestoreDataService);
  private readonly firebase = inject(FirebaseService);

  private readonly cache = readCache();

  readonly departments = signal<DepartmentMaster[]>(this.cache.departments);
  readonly categories = signal<CategoryMaster[]>(this.cache.categories);
  readonly shelves = signal<ShelfMaster[]>(this.cache.shelves);
  readonly loaded = signal(false);

  constructor() {
    void this.refresh();

    // 認証が確立した（あるいは別アカウントに切り替わった）時点で読み直す
    onAuthStateChanged(this.firebase.getAuth(), (user) => {
      if (user) void this.refresh();
    });
  }

  /** Firestore から最新のマスタを読み直す。 */
  async refresh(): Promise<void> {
    try {
      const [departments, categories, shelves] = await Promise.all([
        this.store.listDepartments(),
        this.store.listCategories(),
        this.store.listShelves(),
      ]);
      this.departments.set(departments);
      this.categories.set(categories);
      this.shelves.set(shelves);
      this.saveCache();
    } catch (err) {
      console.warn('[HERON] マスタの読み込みに失敗しました:', err);
    } finally {
      this.loaded.set(true);
    }
  }

  addDepartment(dept: DepartmentMaster): void {
    const code = dept.code.toUpperCase().trim();
    if (this.departments().some((d) => d.code === code)) {
      throw new Error(`部署コード「${code}」は既に存在します`);
    }
    const entry: DepartmentMaster = { code, name: dept.name.trim() };
    this.departments.set([...this.departments(), entry]);
    this.saveCache();
    void this.persist(() => this.store.saveDepartment(entry), '部署の保存');
  }

  removeDepartment(code: string): void {
    this.departments.set(this.departments().filter((d) => d.code !== code));
    this.saveCache();
    void this.persist(() => this.store.deleteDepartment(code), '部署の削除');
  }

  addCategory(cat: CategoryMaster): void {
    const code = cat.code.toUpperCase().trim();
    if (this.categories().some((c) => c.code === code)) {
      throw new Error(`カテゴリコード「${code}」は既に存在します`);
    }
    const entry: CategoryMaster = { code, name: cat.name.trim() };
    this.categories.set([...this.categories(), entry]);
    this.saveCache();
    void this.persist(() => this.store.saveCategory(entry), 'カテゴリの保存');
  }

  removeCategory(code: string): void {
    this.categories.set(this.categories().filter((c) => c.code !== code));
    this.saveCache();
    void this.persist(() => this.store.deleteCategory(code), 'カテゴリの削除');
  }

  addShelf(shelf: ShelfMaster): void {
    const code = shelf.code.toUpperCase().trim();
    if (this.shelves().some((s) => s.code === code)) {
      throw new Error(`棚コード「${code}」は既に存在します`);
    }
    const entry: ShelfMaster = {
      code,
      room_name: shelf.room_name.trim(),
      shelf_name: shelf.shelf_name.trim(),
    };
    this.shelves.set([...this.shelves(), entry]);
    this.saveCache();
    void this.persist(() => this.store.saveShelf(entry), '保管場所の保存');
  }

  removeShelf(code: string): void {
    this.shelves.set(this.shelves().filter((s) => s.code !== code));
    this.saveCache();
    void this.persist(() => this.store.deleteShelf(code), '保管場所の削除');
  }

  /** 書き込みに失敗したら Firestore の内容へ戻す（画面と DB の食い違いを残さない）。 */
  private async persist(op: () => Promise<void>, label: string): Promise<void> {
    try {
      await op();
    } catch (err) {
      console.error(`[HERON] ${label}に失敗しました:`, err);
      await this.refresh();
    }
  }

  private saveCache(): void {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          departments: this.departments(),
          categories: this.categories(),
          shelves: this.shelves(),
        }),
      );
    } catch {
      /* 保存できなくても動作に支障はない */
    }
  }
}
