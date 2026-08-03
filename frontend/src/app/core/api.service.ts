import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
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
    return this.http.get<Paged<Equipment>>(`${this.base}/equipments`, { params });
  }

  getEquipment(id: string): Observable<EquipmentDetail> {
    return this.http.get<EquipmentDetail>(`${this.base}/equipments/${id}`);
  }

  createEquipment(body: {
    name: string;
    category: string;
    model_number?: string;
    location_id?: number | null;
    purchased_at?: string;
    note?: string;
  }): Observable<Equipment> {
    return this.http.post<Equipment>(`${this.base}/equipments`, body);
  }

  updateEquipment(id: string, body: Record<string, unknown>): Observable<Equipment> {
    return this.http.put<Equipment>(`${this.base}/equipments/${id}`, body);
  }

  discardEquipment(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/equipments/${id}`);
  }

  myEquipments(): Observable<ListResult<Equipment>> {
    return this.http.get<ListResult<Equipment>>(`${this.base}/me/equipments`);
  }

  // ---- 取引（貸出・返却・棚卸し） ----

  lend(equipmentId: string, targetUserId: string, note = ''): Observable<Equipment> {
    return this.http.post<Equipment>(`${this.base}/transactions/lend`, {
      equipment_id: equipmentId,
      target_user_id: targetUserId,
      note,
    });
  }

  return(equipmentId: string, locationId: number, note = ''): Observable<Equipment> {
    return this.http.post<Equipment>(`${this.base}/transactions/return`, {
      equipment_id: equipmentId,
      location_id: locationId,
      note,
    });
  }

  inventory(locationId: number, equipmentIds: string[]): Observable<InventoryResult> {
    return this.http.post<InventoryResult>(`${this.base}/transactions/inventory`, {
      location_id: locationId,
      equipment_ids: equipmentIds,
    });
  }

  // ---- マスタ・履歴 ----

  listLocations(): Observable<ListResult<Location>> {
    return this.http.get<ListResult<Location>>(`${this.base}/locations`);
  }

  createLocation(roomName: string, shelfName: string): Observable<Location> {
    return this.http.post<Location>(`${this.base}/locations`, {
      room_name: roomName,
      shelf_name: shelfName,
    });
  }

  deleteLocation(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/locations/${id}`);
  }

  listUsers(role?: string): Observable<ListResult<User>> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<ListResult<User>>(`${this.base}/users`, { params });
  }

  createUser(body: {
    login_id: string;
    name: string;
    role: string;
    password: string;
  }): Observable<User> {
    return this.http.post<User>(`${this.base}/users`, body);
  }

  listLogs(page = 1, perPage = 50): Observable<Paged<TransactionLog>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));
    return this.http.get<Paged<TransactionLog>>(`${this.base}/logs`, { params });
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${this.base}/stats`);
  }
}
