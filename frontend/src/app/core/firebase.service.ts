import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private app: FirebaseApp;
  private db: Firestore;
  private auth: Auth;
  private googleProvider: GoogleAuthProvider;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);
    this.googleProvider = new GoogleAuthProvider();
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
