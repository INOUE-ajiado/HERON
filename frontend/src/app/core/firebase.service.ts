import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private app: FirebaseApp;
  private db: Firestore;
  private auth: Auth;
  private googleProvider: GoogleAuthProvider;
  /** Firebase Auth のセッション復元完了（Firestore の読み書きはこの後に行う）。 */
  private readonly authRestored: Promise<FirebaseUser | null>;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);
    this.googleProvider = new GoogleAuthProvider();

    this.authRestored = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        () => {
          unsubscribe();
          resolve(null);
        },
      );
    });
  }

  /**
   * セッション復元を待つ。ページ再読み込み直後は認証状態の復元が非同期に行われるため、
   * これを待たずに Firestore へアクセスすると権限エラーになる。
   */
  waitForAuth(): Promise<FirebaseUser | null> {
    return this.authRestored;
  }

  getApp(): FirebaseApp {
    return this.app;
  }

  getDb(): Firestore {
    return this.db;
  }

  getAuth(): Auth {
    return this.auth;
  }

  loginWithGoogle(): Promise<UserCredential> {
    return signInWithPopup(this.auth, this.googleProvider);
  }
}
