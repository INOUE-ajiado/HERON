/**
 * 本番／Docker 実行時の設定。
 *
 * nginx が /api を backend コンテナへリバースプロキシするため、
 * フロントからは同一オリジンの相対パスで到達できる。
 */
export const environment = {
  production: true,
  apiBase: '/api',
};
