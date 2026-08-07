import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/guards';

/**
 * 画面構成 (テストメンバー管理機能追加).
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
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
        redirectTo: 'equipments',
        pathMatch: 'full',
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
        redirectTo: 'equipments',
        pathMatch: 'full',
      },
      {
        path: 'equipments/:id',
        redirectTo: 'equipments',
        pathMatch: 'full',
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
        path: 'test-members',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/test-members/test-members.component').then(
            (m) => m.TestMembersComponent,
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
  { path: '**', redirectTo: 'equipments' },
];
