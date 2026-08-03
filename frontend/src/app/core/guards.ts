import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

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
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/']);
};
