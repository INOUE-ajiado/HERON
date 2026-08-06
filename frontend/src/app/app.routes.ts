import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/guards';

/**
 * 画面構成。
 *
 * 貸出・返却・棚卸し・マスタ管理・履歴は管理者限定（設計書 第1部 2章）。
 * 一般ユーザーはダッシュボード（自身の貸出中一覧）と機材検索のみ利用できる。
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    /*
     * ラベル印刷用の隠しルート（設計書 第3部 4章）。
     * 共通シェルの外に置き、印刷時に余計な UI が乗らないようにする。
     */
    path: 'print/label/:id',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/label-print/label-print.component').then(
        (m) => m.LabelPrintComponent,
      ),
  },
  {
    path: 'print/shelf-label/:code',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/shelf-label-print/shelf-label-print.component').then(
        (m) => m.ShelfLabelPrintComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'equipments',
        loadComponent: () =>
          import('./pages/equipment-list/equipment-list.component').then(
            (m) => m.EquipmentListComponent,
          ),
      },
      {
        path: 'equipments/new',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/equipment-form/equipment-form.component').then(
            (m) => m.EquipmentFormComponent,
          ),
      },
      {
        path: 'equipments/:id',
        loadComponent: () =>
          import('./pages/equipment-detail/equipment-detail.component').then(
            (m) => m.EquipmentDetailComponent,
          ),
      },
      {
        path: 'scan',
        redirectTo: 'equipments',
        pathMatch: 'full',
      },
      {
        path: 'inventory',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/inventory/inventory.component').then(
            (m) => m.InventoryComponent,
          ),
      },
      {
        path: 'locations',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/locations/locations.component').then(
            (m) => m.LocationsComponent,
          ),
      },
      {
        path: 'logs',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/logs/logs.component').then((m) => m.LogsComponent),
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
