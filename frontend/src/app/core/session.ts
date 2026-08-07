/**
 * ログインセッション（トークン・ユーザー）の localStorage 保管。
 *
 * AuthService と FirestoreDataService の両方から参照するため、
 * 循環インポートを避ける目的で独立モジュールに切り出している。
 */
import { User } from './models';

export const TOKEN_KEY = 'heron.token';
export const USER_KEY = 'heron.user';

/** 現在ログイン中のユーザー（未ログインなら null）。 */
export function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function writeStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
