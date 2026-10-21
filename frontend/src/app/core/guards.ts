import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AccessControlService, AppPageKey } from './access-control.service';
import { AuthService } from './auth.service';

/** 未ログインならログイン画面へ誘導する。 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};

/**
 * 管理者限定画面のガード（設計書 第1部 2章）。
 *
 * 一般ユーザーは貸出・返却・棚卸し・マスタ管理の画面に入れない。
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const access = inject(AccessControlService);
  const router = inject(Router);
  if (access.isActualAdmin()) return true;
  const fallback = access.getDefaultLandingRoute();
  if (fallback === '/login') {
    auth.logout();
    return false;
  }
  return router.createUrlTree([fallback]);
};

/**
 * ページ単位の詳細アクセス権限ガード。
 * 管理ページ (/admin) で設定されたロール別マトリクスおよび個人別オーバーライドに基づき、
 * 許可されていないページへのアクセスを遮断して利用可能な最初のページ（稟議申請など）へ誘導する。
 */
export function pageAccessGuard(pageKey: AppPageKey): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const access = inject(AccessControlService);
    const router = inject(Router);
    if (access.canAccessPage(pageKey)) {
      return true;
    }
    const fallback = access.getDefaultLandingRoute();
    if (fallback === '/login') {
      auth.logout();
      return false;
    }
    return router.createUrlTree([fallback]);
  };
}
