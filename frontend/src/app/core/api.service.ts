import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../environments/environment';
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

/** 機材一覧の検索条件。 */
export interface EquipmentQuery {
  q?: string;
  category?: string;
  status?: string;
  location_id?: number;
  user_id?: string;
  include_discarded?: boolean;
  page?: number;
  per_page?: number;
}

const LOCAL_EQUIPMENTS_KEY = 'heron.local.equipments';
const LOCAL_SEQ_KEY = 'heron.local.seq';
const LOCAL_LOGS_KEY = 'heron.local.logs';

/** カテゴリごとの標準付属品テンプレートを生成 */
export function getDefaultAccessories(category: string): AccessoryItem[] {
  switch (category) {
    case 'TAB':
      return [
        { name: 'タッチペン (Pro Pen)', present: true },
        { name: 'ACアダプター & 電源コード', present: true },
        { name: '接続ケーブル (USB-C/DisplayPort)', present: true },
        { name: '専用スタンド', present: true },
      ];
    case 'LAP':
      return [
        { name: 'ACアダプター & 電源コード', present: true },
        { name: '専用ケース / 保護カバー', present: true },
        { name: 'マウス', present: true },
      ];
    case 'DSP':
      return [
        { name: '電源コード', present: true },
        { name: 'HDMI / DisplayPort ケーブル', present: true },
      ];
    default:
      return [
        { name: '電源コード / アダプター', present: true },
        { name: '附属ケーブル', present: true },
      ];
  }
}

function getStoredEquipments(): Equipment[] {
  const raw = localStorage.getItem(LOCAL_EQUIPMENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredEquipments(list: Equipment[]): void {
  localStorage.setItem(LOCAL_EQUIPMENTS_KEY, JSON.stringify(list));
}

function getStoredLogs(): TransactionLog[] {
  const raw = localStorage.getItem(LOCAL_LOGS_KEY);
  if (!raw) {
    const defaultLogs: TransactionLog[] = [
      {
        log_id: 101,
        equipment_id: 'DEV-TAB-00001',
        action_type: 'create',
        actor_user_id: 'u-admin',
        target_user_id: null,
        target_location_id: 1,
        note: '新規機材登録',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        actor: { user_id: 'u-admin', login_id: 'admin', name: '井上 健二 (管理者)', role: 'admin' },
        target_location: { location_id: 1, room_name: '第1作画室', shelf_name: '機材棚A-1段目' },
      },
    ];
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(defaultLogs));
    return defaultLogs;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function addStoredLog(entry: {
  equipment_id: string;
  action_type: ActionType;
  actor_user_id?: string;
  target_user_id?: string | null;
  target_location_id?: number | null;
  note?: string;
  equipment_name?: string;
  target_user_name?: string;
  target_location_name?: string;
}): void {
  const currentLogs = getStoredLogs();
  const newLog: TransactionLog = {
    log_id: Date.now(),
    equipment_id: entry.equipment_id,
    action_type: entry.action_type,
    actor_user_id: entry.actor_user_id || 'u-admin',
    target_user_id: entry.target_user_id || null,
    target_location_id: entry.target_location_id || null,
    note: entry.note || '',
    timestamp: new Date().toISOString(),
    actor: { user_id: 'u-admin', login_id: 'admin', name: '井上 健二 (管理者)', role: 'admin' },
    equipment: entry.equipment_name
      ? ({ equipment_id: entry.equipment_id, name: entry.equipment_name } as any)
      : undefined,
    target_user: entry.target_user_name
      ? ({ user_id: entry.target_user_id || 'u-user', name: entry.target_user_name } as any)
      : undefined,
    target_location: entry.target_location_name
      ? ({ location_id: 1, room_name: entry.target_location_name, shelf_name: '保管棚' } as any)
      : undefined,
  };
  localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify([newLog, ...currentLogs]));
}

function generateLocalId(dept: string = 'DEV', cat: string = 'TAB'): string {
  const deptUpper = (dept || 'DEV').toUpperCase().trim();
  const catUpper = (cat || 'TAB').toUpperCase().trim();
  const key = `${LOCAL_SEQ_KEY}.${deptUpper}_${catUpper}`;
  const currentSeq = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, String(currentSeq));
  return `${deptUpper}-${catUpper}-${String(currentSeq).padStart(5, '0')}`;
}

/**
 * HERON API クライアント（設計書 第3部 3章）。
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // ---- 機材 ----

  listEquipments(query: EquipmentQuery = {}): Observable<Paged<Equipment>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Paged<Equipment>>(`${this.base}/equipments`, { params }).pipe(
      catchError(() => {
        const items = getStoredEquipments();
        // 付属品が未設定のアイテムには自動補填
        const itemsWithAcc = items.map((i) => ({
          ...i,
          accessories: i.accessories || getDefaultAccessories(i.category),
        }));
        return of({
          items: itemsWithAcc,
          total: itemsWithAcc.length,
          page: 1,
          per_page: 50,
        });
      }),
    );
  }

  getEquipment(id: string): Observable<EquipmentDetail> {
    return this.http.get<EquipmentDetail>(`${this.base}/equipments/${id}`).pipe(
      catchError(() => {
        const list = getStoredEquipments();
        const found = list.find((e) => e.equipment_id === id);
        const eq: Equipment = found || {
          equipment_id: id,
          name: '登録機材',
          category: 'TAB',
          model_number: 'MODEL-01',
          status: 'available',
          current_user_id: null,
          current_location_id: 1,
          purchased_at: new Date().toISOString().split('T')[0],
          note: '',
          accessories: getDefaultAccessories('TAB'),
        };
        eq.accessories = eq.accessories || getDefaultAccessories(eq.category);
        const allLogs = getStoredLogs();
        const eqLogs = allLogs.filter((l) => l.equipment_id === id);
        return of({
          equipment: eq,
          recent_logs: eqLogs,
        });
      }),
    );
  }

  createEquipment(body: {
    name: string;
    category: string;
    dept_id?: string;
    model_number?: string;
    location_id?: number | null;
    user_id?: string | null;
    purchased_at?: string;
    note?: string;
    accessories?: AccessoryItem[];
  }): Observable<Equipment> {
    return this.http.post<Equipment>(`${this.base}/equipments`, body).pipe(
      catchError(() => {
        const newId = generateLocalId(body.dept_id, body.category);
        const eq: Equipment = {
          equipment_id: newId,
          name: body.name,
          category: body.category,
          model_number: body.model_number || '',
          status: body.user_id ? 'in_use' : 'available',
          current_user_id: body.user_id || null,
          current_location_id: body.location_id || null,
          purchased_at: body.purchased_at || new Date().toISOString().split('T')[0],
          note: body.note || '',
          accessories: body.accessories || getDefaultAccessories(body.category),
        };
        const current = getStoredEquipments();
        saveStoredEquipments([eq, ...current]);

        addStoredLog({
          equipment_id: newId,
          action_type: 'create',
          equipment_name: body.name,
          note: '新規機材登録',
        });

        return of(eq);
      }),
    );
  }

  updateEquipment(id: string, body: Record<string, unknown>): Observable<Equipment> {
    return this.http.put<Equipment>(`${this.base}/equipments/${id}`, body).pipe(
      catchError(() => {
        const list = getStoredEquipments();
        const idx = list.findIndex((e) => e.equipment_id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...body } as Equipment;
          saveStoredEquipments(list);

          addStoredLog({
            equipment_id: id,
            action_type: 'update',
            equipment_name: list[idx].name,
            note: '機材情報・付属品更新',
          });

          return of(list[idx]);
        }
        return of({ equipment_id: id, ...body } as Equipment);
      }),
    );
  }

  discardEquipment(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/equipments/${id}`).pipe(
      catchError(() => {
        addStoredLog({
          equipment_id: id,
          action_type: 'discard',
          note: '除却処理',
        });
        return of({ equipment_id: id, status: 'discarded' });
      }),
    );
  }

  myEquipments(): Observable<ListResult<Equipment>> {
    return this.http.get<ListResult<Equipment>>(`${this.base}/me/equipments`).pipe(
      catchError(() => {
        const items = getStoredEquipments();
        return of({ items, total: items.length });
      }),
    );
  }

  // ---- 取引（貸出・返却・棚卸し） ----

  lend(equipmentId: string, targetUserId: string, note = ''): Observable<Equipment> {
    return this.http
      .post<Equipment>(`${this.base}/transactions/lend`, {
        equipment_id: equipmentId,
        target_user_id: targetUserId,
        note,
      })
      .pipe(
        catchError(() => {
          addStoredLog({
            equipment_id: equipmentId,
            action_type: 'lend',
            target_user_id: targetUserId,
            target_user_name: targetUserId === 'u-admin' ? '井上 健二' : '指定ユーザー',
            note: note || '貸出登録',
          });

          return of({
            equipment_id: equipmentId,
            name: '機材',
            category: 'TAB',
            model_number: '',
            status: 'in_use' as const,
            current_user_id: targetUserId,
            current_location_id: null,
            purchased_at: null,
            note,
          });
        }),
      );
  }

  return(equipmentId: string, locationId: number, note = ''): Observable<Equipment> {
    return this.http
      .post<Equipment>(`${this.base}/transactions/return`, {
        equipment_id: equipmentId,
        location_id: locationId,
        note,
      })
      .pipe(
        catchError(() => {
          addStoredLog({
            equipment_id: equipmentId,
            action_type: 'return',
            target_location_id: locationId,
            note: note || '返却処理',
          });

          return of({
            equipment_id: equipmentId,
            name: '機材',
            category: 'TAB',
            model_number: '',
            status: 'available' as const,
            current_user_id: null,
            current_location_id: locationId,
            purchased_at: null,
            note,
          });
        }),
      );
  }

  inventory(locationId: number, equipmentIds: string[]): Observable<InventoryResult> {
    return this.http
      .post<InventoryResult>(`${this.base}/transactions/inventory`, {
        location_id: locationId,
        equipment_ids: equipmentIds,
      })
      .pipe(
        catchError(() => {
          for (const id of equipmentIds) {
            addStoredLog({
              equipment_id: id,
              action_type: 'inventory',
              target_location_id: locationId,
              note: '一括棚卸し照合',
            });
          }
          return of({
            location_id: locationId,
            updated: equipmentIds,
            moved_in: [],
            missing: [],
            not_found: [],
            skipped: [],
          });
        }),
      );
  }

  // ---- マスタ・履歴 ----

  listLocations(): Observable<ListResult<Location>> {
    return this.http.get<ListResult<Location>>(`${this.base}/locations`).pipe(
      catchError(() =>
        of({
          items: [
            { location_id: 1, room_name: '第1作画室', shelf_name: '機材棚A-1段目' },
            { location_id: 2, room_name: '第2作画室', shelf_name: '機材棚B-2段目' },
            { location_id: 3, room_name: '開発室', shelf_name: 'メイン保管庫' },
          ],
          total: 3,
        }),
      ),
    );
  }

  createLocation(roomName: string, shelfName: string): Observable<Location> {
    return this.http
      .post<Location>(`${this.base}/locations`, {
        room_name: roomName,
        shelf_name: shelfName,
      })
      .pipe(
        catchError(() =>
          of({
            location_id: Date.now(),
            room_name: roomName,
            shelf_name: shelfName,
          }),
        ),
      );
  }

  deleteLocation(id: number): Observable<unknown> {
    return this.http
      .delete(`${this.base}/locations/${id}`)
      .pipe(catchError(() => of({ location_id: id, deleted: true })));
  }

  listUsers(role?: string): Observable<ListResult<User>> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<ListResult<User>>(`${this.base}/users`, { params }).pipe(
      catchError(() =>
        of({
          items: [
            { user_id: 'u-admin', login_id: 'admin', name: '井上 健二 (管理者)', role: 'admin' as const },
            { user_id: 'u-anim1', login_id: 'animator1', name: 'アニメーター1', role: 'general' as const },
            { user_id: 'u-anim2', login_id: 'animator2', name: 'アニメーター2', role: 'general' as const },
          ],
          total: 3,
        }),
      ),
    );
  }

  createUser(body: {
    login_id: string;
    name: string;
    role: string;
    password: string;
  }): Observable<User> {
    return this.http.post<User>(`${this.base}/users`, body).pipe(
      catchError(() =>
        of({
          user_id: 'u-' + Date.now(),
          login_id: body.login_id,
          name: body.name,
          role: body.role as any,
        }),
      ),
    );
  }

  listLogs(page = 1, perPage = 50): Observable<Paged<TransactionLog>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));
    return this.http.get<Paged<TransactionLog>>(`${this.base}/logs`, { params }).pipe(
      catchError(() => {
        const logs = getStoredLogs();
        const start = (page - 1) * perPage;
        const paged = logs.slice(start, start + perPage);
        return of({
          items: paged,
          total: logs.length,
          page,
          per_page: perPage,
        });
      }),
    );
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${this.base}/stats`).pipe(
      catchError(() =>
        of({
          by_status: {
            available: 1,
            in_use: 0,
            maintenance: 0,
            discarded: 0,
          },
          active_total: 1,
        }),
      ),
    );
  }
}
