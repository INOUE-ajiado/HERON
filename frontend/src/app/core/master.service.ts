import { Injectable, signal } from '@angular/core';

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

const DEFAULT_DEPARTMENTS: DepartmentMaster[] = [
  { code: 'DEV', name: '開発部' },
  { code: 'ANIM', name: '制作部' },
  { code: 'SALES', name: '営業部' },
  { code: 'HQ', name: '管理部・本社' },
];

const DEFAULT_CATEGORIES: CategoryMaster[] = [
  { code: 'PC', name: 'パソコン' },
  { code: 'DSP', name: 'ディスプレイ' },
  { code: 'TAB', name: 'ペンタブ・液タブ' },
  { code: 'CAM', name: 'カメラ' },
];

const DEFAULT_SHELVES: ShelfMaster[] = [
  { code: 'SHELF-A1', room_name: '第1作画室', shelf_name: '機材棚A-1段目' },
  { code: 'SHELF-B2', room_name: '第2作画室', shelf_name: '機材棚B-2段目' },
  { code: 'SHELF-DEV01', room_name: '開発室', shelf_name: 'メイン保管庫' },
];

const DEPT_KEY = 'heron.master.departments';
const CAT_KEY = 'heron.master.categories';
const SHELF_KEY = 'heron.master.shelves';

@Injectable({ providedIn: 'root' })
export class MasterService {
  readonly departments = signal<DepartmentMaster[]>(this.loadDepartments());
  readonly categories = signal<CategoryMaster[]>(this.loadCategories());
  readonly shelves = signal<ShelfMaster[]>(this.loadShelves());

  addDepartment(dept: DepartmentMaster): void {
    const codeUpper = dept.code.toUpperCase().trim();
    const current = this.departments();
    if (current.some((d) => d.code === codeUpper)) {
      throw new Error(`部署コード「${codeUpper}」は既に存在します`);
    }
    const updated = [...current, { code: codeUpper, name: dept.name.trim() }];
    this.saveDepartments(updated);
  }

  removeDepartment(code: string): void {
    const updated = this.departments().filter((d) => d.code !== code);
    this.saveDepartments(updated);
  }

  addCategory(cat: CategoryMaster): void {
    const codeUpper = cat.code.toUpperCase().trim();
    const current = this.categories();
    if (current.some((c) => c.code === codeUpper)) {
      throw new Error(`カテゴリコード「${codeUpper}」は既に存在します`);
    }
    const updated = [...current, { code: codeUpper, name: cat.name.trim() }];
    this.saveCategories(updated);
  }

  removeCategory(code: string): void {
    const updated = this.categories().filter((c) => c.code !== code);
    this.saveCategories(updated);
  }

  addShelf(shelf: ShelfMaster): void {
    const codeUpper = shelf.code.toUpperCase().trim();
    const current = this.shelves();
    if (current.some((s) => s.code === codeUpper)) {
      throw new Error(`棚コード「${codeUpper}」は既に存在します`);
    }
    const updated = [
      ...current,
      { code: codeUpper, room_name: shelf.room_name.trim(), shelf_name: shelf.shelf_name.trim() },
    ];
    this.saveShelves(updated);
  }

  removeShelf(code: string): void {
    const updated = this.shelves().filter((s) => s.code !== code);
    this.saveShelves(updated);
  }

  private loadDepartments(): DepartmentMaster[] {
    const raw = localStorage.getItem(DEPT_KEY);
    if (!raw) return DEFAULT_DEPARTMENTS;
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_DEPARTMENTS;
    }
  }

  private saveDepartments(list: DepartmentMaster[]): void {
    localStorage.setItem(DEPT_KEY, JSON.stringify(list));
    this.departments.set(list);
  }

  private loadCategories(): CategoryMaster[] {
    const raw = localStorage.getItem(CAT_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_CATEGORIES;
    }
  }

  private saveCategories(list: CategoryMaster[]): void {
    localStorage.setItem(CAT_KEY, JSON.stringify(list));
    this.categories.set(list);
  }

  private loadShelves(): ShelfMaster[] {
    const raw = localStorage.getItem(SHELF_KEY);
    if (!raw) return DEFAULT_SHELVES;
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_SHELVES;
    }
  }

  private saveShelves(list: ShelfMaster[]): void {
    localStorage.setItem(SHELF_KEY, JSON.stringify(list));
    this.shelves.set(list);
  }
}
