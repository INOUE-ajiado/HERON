/**
 * 本番／Docker 実行時の設定。
 *
 * nginx が /api を backend コンテナへリバースプロキシするため、
 * フロントからは同一オリジンの相対パスで到達できる。
 */
export const environment = {
  production: true,
  apiBase: '/api',
  /** Firebase Hosting 上には Go API が無いため、Firestore を正のデータストアとして使う。 */
  useFirestore: true,
  firebase: {
    apiKey: "AIzaSyAAM5TeESJ_iJf9CepgFqU2cQeT5lpe0V0",
    authDomain: "heron-dcd38.firebaseapp.com",
    projectId: "heron-dcd38",
    storageBucket: "heron-dcd38.firebasestorage.app",
    messagingSenderId: "353698447013",
    appId: "1:353698447013:web:dec3923124aa47bff2d74c"
  }
};
