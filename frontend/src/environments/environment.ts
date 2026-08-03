/**
 * 開発時の設定。
 *
 * `ng serve` は proxy.conf.json 経由で /api を localhost:8080 の Go API へ転送する。
 * スマートフォン実機からアクセスする場合は apiBase を PC の LAN IP に書き換える
 * （例: 'http://192.168.1.20:8080/api'）。
 */
export const environment = {
  production: false,
  apiBase: '/api',
};
