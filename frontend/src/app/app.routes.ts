import { Routes } from '@angular/router';

import { adminGuard, authGuard, pageAccessGuard } from './core/guards';

/**
 * 画面構成 (基本設計書 PDF ＆ システム仕様書 ＆ ユーザー・ページ権限管理を含む).
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'print/label/:id',
    canActivate: [authGuard, pageAccessGuard('equipments')],
    loadComponent: () =>
      import('./pages/label-print/label-print.component').then(
        (m) => m.LabelPrintComponent,
      ),
  },
  {
    path: 'print/shelf-label/:code',
    canActivate: [authGuard, pageAccessGuard('locations')],
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
        canActivate: [pageAccessGuard('equipments')],
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
        canActivate: [pageAccessGuard('inventory')],
        loadComponent: () =>
          import('./pages/inventory/inventory.component').then(
            (m) => m.InventoryComponent,
          ),
      },
      {
        path: 'locations',
        canActivate: [pageAccessGuard('locations')],
        loadComponent: () =>
          import('./pages/locations/locations.component').then(
            (m) => m.LocationsComponent,
          ),
      },
      {
        path: 'approval',
        canActivate: [pageAccessGuard('approval')],
        loadComponent: () =>
          import('./pages/approval/approval.component').then(
            (m) => m.ApprovalComponent,
          ),
      },
      {
        path: 'work-request',
        canActivate: [pageAccessGuard('work-request')],
        loadComponent: () =>
          import('./pages/work-request/work-request.component').then(
            (m) => m.WorkRequestComponent,
          ),
      },
      {
        path: 'byod',
        canActivate: [pageAccessGuard('byod')],
        loadComponent: () =>
          import('./pages/byod/byod.component').then((m) => m.ByodComponent),
      },
      {
        path: 'licenses',
        canActivate: [pageAccessGuard('licenses')],
        loadComponent: () =>
          import('./pages/licenses/licenses.component').then(
            (m) => m.LicensesComponent,
          ),
      },
      {
        path: 'admin',
        canActivate: [pageAccessGuard('admin')],
        loadComponent: () =>
          import('./pages/admin/admin.component').then(
            (m) => m.AdminComponent,
          ),
      },
      {
        path: 'spec',
        canActivate: [pageAccessGuard('specs')],
        loadComponent: () =>
          import('./pages/spec/specs-layout.component').then(
            (m) => m.SpecsLayoutComponent,
          ),
        children: [
          {
            path: '',
            redirectTo: 'basic',
            pathMatch: 'full',
          },
          {
            path: 'basic',
            loadComponent: () =>
              import('./pages/spec/spec.component').then((m) => m.SpecComponent),
          },
          {
            path: 'system',
            loadComponent: () =>
              import('./pages/system-spec/system-spec.component').then(
                (m) => m.SystemSpecComponent,
              ),
          },
          {
            path: 'approval',
            loadComponent: () =>
              import('./pages/approval-spec/approval-spec.component').then(
                (m) => m.ApprovalSpecComponent,
              ),
          },
          {
            path: 'work-request',
            loadComponent: () =>
              import('./pages/work-request-spec/work-request-spec.component').then(
                (m) => m.WorkRequestSpecComponent,
              ),
          },
          {
            path: 'byod',
            loadComponent: () =>
              import('./pages/byod-spec/byod-spec.component').then(
                (m) => m.ByodSpecComponent,
              ),
          },
          {
            path: 'license',
            loadComponent: () =>
              import('./pages/license-spec/license-spec.component').then(
                (m) => m.LicenseSpecComponent,
              ),
          },
          {
            path: 'admin',
            loadComponent: () =>
              import('./pages/admin-spec/admin-spec.component').then(
                (m) => m.AdminSpecComponent,
              ),
          },
        ],
      },
      // 既存の単体URLからのダイレクト遷移も統合ポータル内へリダイレクト
      {
        path: 'system-spec',
        redirectTo: 'spec/system',
        pathMatch: 'full',
      },
      {
        path: 'approval-spec',
        redirectTo: 'spec/approval',
        pathMatch: 'full',
      },
      {
        path: 'work-request-spec',
        redirectTo: 'spec/work-request',
        pathMatch: 'full',
      },
      {
        path: 'byod-spec',
        redirectTo: 'spec/byod',
        pathMatch: 'full',
      },
      {
        path: 'license-spec',
        redirectTo: 'spec/license',
        pathMatch: 'full',
      },
      {
        path: 'admin-spec',
        redirectTo: 'spec/admin',
        pathMatch: 'full',
      },
      {
        path: 'test-members',
        canActivate: [pageAccessGuard('test-members')],
        loadComponent: () =>
          import('./pages/test-members/test-members.component').then(
            (m) => m.TestMembersComponent,
          ),
      },
      {
        path: 'logs',
        canActivate: [pageAccessGuard('logs')],
        loadComponent: () =>
          import('./pages/logs/logs.component').then((m) => m.LogsComponent),
      },
      {
        path: 'settings',
        canActivate: [pageAccessGuard('settings')],
        loadComponent: () =>
          import('./pages/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'equipments' },
];
