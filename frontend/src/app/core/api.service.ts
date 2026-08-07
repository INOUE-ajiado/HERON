import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { FirestoreDataService } from './firestore-data.service';
import {
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

/**
 * HERON データアクセス（設計書 第3部 3章）。
 *
 * `environment.useFirestore` が true のときは Cloud Firestore を直接読み書きし、
 * テストメンバー全員が同じデータを共有する（Firebase Hosting には Go API がないため）。
 * false のときは Go API を呼び、通信に失敗した場合のみ Firestore にフォールバックする。
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(FirestoreDataService);
  private readonly base = environment.apiBase;

  /** Firestore 優先モードなら Firestore、そうでなければ API → Firestore フォールバック。 */
  private route<T>(apiCall: () => Observable<T>, storeCall: () => Promise<T>): Observable<T> {
    if (environment.useFirestore) return from(storeCall());
    return apiCall().pipe(
      catchError((err) => {
        console.warn('[HERON] API 呼び出しに失敗したため Firestore を使用します:', err?.status);
        return from(storeCall());
      }),
    );
  }

  // ---- 機材 ----

  listEquipments(query: EquipmentQuery = {}): Observable<Paged<Equipment>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.route(
      () => this.http.get<Paged<Equipment>>(`${this.base}/equipments`, { params }),
      () => this.store.listEquipments(query),
    );
  }

  getEquipment(id: string): Observable<EquipmentDetail> {
    return this.route(
      () => this.http.get<EquipmentDetail>(`${this.base}/equipments/${id}`),
      () => this.store.getEquipment(id),
    );
  }

  createEquipment(body: {
    name: string;
    category: string;
    dept_id?: string;
    model_number?: string;
    location_id?: number | string | null;
    user_id?: string | null;
    purchased_at?: string;
    note?: string;
    accessories?: AccessoryItem[];
  }): Observable<Equipment> {
    return this.route(
      () => this.http.post<Equipment>(`${this.base}/equipments`, body),
      () => this.store.createEquipment(body),
    );
  }

  updateEquipment(id: string, body: Record<string, unknown>): Observable<Equipment> {
    return this.route(
      () => this.http.put<Equipment>(`${this.base}/equipments/${id}`, body),
      () => this.store.updateEquipment(id, body),
    );
  }

  discardEquipment(id: string): Observable<unknown> {
    return this.route(
      () => this.http.delete(`${this.base}/equipments/${id}`),
      () => this.store.discardEquipment(id),
    );
  }

  myEquipments(): Observable<ListResult<Equipment>> {
    return this.route(
      () => this.http.get<ListResult<Equipment>>(`${this.base}/me/equipments`),
      () => this.store.myEquipments(),
    );
  }

  // ---- 取引（貸出・返却・棚卸し） ----

  lend(equipmentId: string, targetUserId: string, note = ''): Observable<Equipment> {
    return this.route(
      () =>
        this.http.post<Equipment>(`${this.base}/transactions/lend`, {
          equipment_id: equipmentId,
          target_user_id: targetUserId,
          note,
        }),
      () => this.store.lend(equipmentId, targetUserId, note),
    );
  }

  return(equipmentId: string, locationId: number, note = ''): Observable<Equipment> {
    return this.route(
      () =>
        this.http.post<Equipment>(`${this.base}/transactions/return`, {
          equipment_id: equipmentId,
          location_id: locationId,
          note,
        }),
      () => this.store.returnEquipment(equipmentId, locationId, note),
    );
  }

  inventory(locationId: number, equipmentIds: string[]): Observable<InventoryResult> {
    return this.route(
      () =>
        this.http.post<InventoryResult>(`${this.base}/transactions/inventory`, {
          location_id: locationId,
          equipment_ids: equipmentIds,
        }),
      () => this.store.inventory(locationId, equipmentIds),
    );
  }

  // ---- マスタ・履歴 ----

  listLocations(): Observable<ListResult<Location>> {
    return this.route(
      () => this.http.get<ListResult<Location>>(`${this.base}/locations`),
      () => this.store.listLocations(),
    );
  }

  createLocation(roomName: string, shelfName: string): Observable<Location> {
    return this.route(
      () =>
        this.http.post<Location>(`${this.base}/locations`, {
          room_name: roomName,
          shelf_name: shelfName,
        }),
      () => this.store.createLocation(roomName, shelfName),
    );
  }

  deleteLocation(id: number): Observable<unknown> {
    return this.route(
      () => this.http.delete(`${this.base}/locations/${id}`),
      async () => {
        await this.store.deleteLocation(id);
        return { location_id: id, deleted: true };
      },
    );
  }

  listUsers(role?: string): Observable<ListResult<User>> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.route(
      () => this.http.get<ListResult<User>>(`${this.base}/users`, { params }),
      () => this.store.listUsers(role),
    );
  }

  createUser(body: {
    login_id: string;
    name: string;
    role: string;
    password: string;
  }): Observable<User> {
    return this.route(
      () => this.http.post<User>(`${this.base}/users`, body),
      () => this.store.createUser(body),
    );
  }

  listLogs(page = 1, perPage = 50): Observable<Paged<TransactionLog>> {
    const params = new HttpParams().set('page', String(page)).set('per_page', String(perPage));
    return this.route(
      () => this.http.get<Paged<TransactionLog>>(`${this.base}/logs`, { params }),
      () => this.store.listLogs(page, perPage),
    );
  }

  stats(): Observable<Stats> {
    return this.route(
      () => this.http.get<Stats>(`${this.base}/stats`),
      () => this.store.stats(),
    );
  }
}
