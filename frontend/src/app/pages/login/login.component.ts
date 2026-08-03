import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-heron-navy px-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <h1 class="text-4xl font-bold tracking-[0.3em] text-white">HERON</h1>
          <p class="mt-2 text-xs tracking-wide text-heron-4">社内機材管理システム</p>
        </div>

        <form (ngSubmit)="submit()" class="heron-card space-y-4 p-6">
          <div>
            <label class="heron-label" for="loginId">ログインID</label>
            <input
              id="loginId"
              name="loginId"
              class="heron-input"
              [(ngModel)]="loginId"
              autocomplete="username"
              autocapitalize="none"
              required
            />
          </div>

          <div>
            <label class="heron-label" for="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              class="heron-input"
              [(ngModel)]="password"
              autocomplete="current-password"
              required
            />
          </div>

          @if (error()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {{ error() }}
            </p>
          }

          <button type="submit" class="heron-btn-primary w-full" [disabled]="loading()">
            {{ loading() ? 'ログイン中...' : 'ログイン' }}
          </button>
        </form>

        <p class="mt-6 text-center text-[11px] leading-relaxed text-heron-4">
          初期アカウント（SEED_DEMO 有効時）<br />
          管理者: admin / heron-admin<br />
          一般: animator1 / heron-user
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loginId = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  submit(): void {
    if (!this.loginId || !this.password) {
      this.error.set('ログインIDとパスワードを入力してください');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.loginId, this.password).subscribe({
      next: () => {
        const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/';
        void this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.error ?? 'ログインに失敗しました。時間をおいて再度お試しください。',
        );
      },
    });
  }
}
