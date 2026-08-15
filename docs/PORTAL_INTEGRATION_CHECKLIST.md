# 📋 HERON ポータルサイト統合準備チェックリスト & 設計ガイド

本ドキュメントは、HERONを既存の社内ポータルサイトへ統合（埋め込み・連携）する際に必要な事前準備、技術的決定事項、およびトラブル防止策をまとめたものです。

---

## 1. 技術的決定事項チェックリスト

統合開発に着手する前に、以下の項目についてポータルサイト側の開発チームまたはインフラ担当者と合意を形成してください。

| # | 検討項目 | 選択肢・決定内容 | HERON側の影響・必要な作業 |
|---|---|---|---|
| **1** | **認証方式 (SSO)** | [ ] ポータルのOAuth/OIDC<br>[ ] SAML / Active Directory<br>[ ] 共有JWT / Cookie<br>[ ] APIキー / ヘッダー伝送 | ポータル側のユーザーIDとHERONの `users` テーブルを紐付ける認証ミドルウェア（`backend/internal/portal_auth` 等）を新規追加する。 |
| **2** | **画面表示方式** | [ ] iframe による埋め込み<br>[ ] Angularの共通コンポーネント化<br>[ ] サブパスプロキシ (`/heron/`)<br>[ ] 別ドメイン (`heron.company.com`) | **iframe / サブパス**の場合：`X-Frame-Options` や `Content-Security-Policy` (CSP) ヘッダーの設定を許可するように変更。<br>**サブパス**の場合：Angular側の Base HREF 設定を変更。 |
| **3** | **CORS / オリジン許可** | [ ] ポータルサイトのURLを追加 | `.env` の `CORS_ORIGINS` にポータルサイトのドメイン（例: `https://portal.company.com`）を追加。 |
| **4** | **ユーザー権限マッピング** | [ ] ポータル側の役職/グループで判定<br>[ ] HERON独自のロール（Admin / General）を使用 | ポータルの属性（例: 機材管理者グループ）を HERON の `admin` ロールに変換するマッピングロジックの定義。 |
| **5** | **デプロイ環境** | [ ] 既存Dockerコンテナの活用<br>[ ] 社内Kubernetes / AWS ECS<br>[ ] Firebase Hosting + Firestore | データ保存先を PostgreSQL (Go API) にするか Firestore 直接参照にするかの決定。 |

---

## 2. AIバイブコーディングの事故防止フロー

AI（Cursor, Windsurf, Antigravity等）に統合コードを書かせる際、以下のフローで進めることでトラブルを防げます。

```
[準備] docs/AI_RULES.md と docs/openapi.yaml をAIに認識させる
  │
  ├─▶ [Step 1] 統合用のブランチを作成 (例: git checkout -b feature/portal-integration)
  │
  ├─▶ [Step 2] 既存コード（frontend/src, backend/internal/service）には一切手を加えないよう指示
  │
  ├─▶ [Step 3] 統合用モジュール（例: backend/internal/portal_auth/）を「新規作成」させる
  │
  └─▶ [Step 4] 統合テストを実行し、問題なければ main にマージ
```

---

## 3. 次のアクション
1. ポータルサイト側の仕様（認証ヘッダーの形式やURLパス構成など）を確認する。
2. `docs/openapi.yaml` を参照し、ポータル側から呼び出すAPIエンドポイントを選定する。
3. 準備が整い次第、`feature/portal-integration` ブランチを作成して作業を開始する。
