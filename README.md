# HERON — 社内機材管理システム

アニメーションスタジオ向けの機材（液タブ・モニター・PC・カメラ等）管理システム。
機材ごとに固有IDとQRコード付きラベルを発行し、スマートフォンやPCのブラウザから
貸出・返却・棚卸し・検索を行う。

設計は `HERON_System_Design-v2.pdf`（要件定義 兼 基本設計書 v2.0）に基づく。

| 項目 | 採用技術 |
| --- | --- |
| フロントエンド | Angular 20 (standalone) / Tailwind CSS / @zxing/browser |
| バックエンド | Go 1.25 / Gin / GORM |
| データベース | PostgreSQL 16（Docker） / SQLite（ローカル開発） |
| ラベルプリンタ | NIIMBOT M2（`window.print()` 経由） |

> **実行環境について**
> 設計書では macOS を前提としているが、本実装は **Windows 11 で開発・動作確認済み**。
> Docker Desktop・Go・Node.js のいずれもクロスプラットフォームで動作するため、
> macOS でも同じ手順で動く。差異があるのは NIIMBOT のドライバ導入手順のみ
> （[ラベル印刷](#ラベル印刷niimbot-m2) を参照）。

---

## クイックスタート

### A. Docker で一括起動（推奨）

Docker Desktop を起動したうえで、リポジトリのルートで実行する。

```powershell
copy .env.example .env    # 必要に応じて値を編集
docker compose up -d --build
```

| URL | 内容 |
| --- | --- |
| http://localhost:8081 | フロントエンド（Web UI） |
| http://localhost:8080/api | REST API |
| localhost:55432 | PostgreSQL（DBクライアント用） |

PostgreSQL のホスト側ポートは、既存の PostgreSQL と衝突しないよう既定で **55432**
に割り当てている（`.env` の `DB_HOST_PORT` で変更可能）。
backend はコンテナ間ネットワークで `db:5432` に直接つなぐため、この公開は無くても動く。

停止・初期化：

```powershell
docker compose down       # 停止（DBのデータは残る）
docker compose down -v    # 停止 + DBのデータも削除
```

### B. Docker を使わずローカル実行

Docker Desktop が動いていない環境でも、SQLite にフォールバックして起動できる。
ターミナルを2つ開いて、それぞれで実行する。

```powershell
# ターミナル1: API サーバ（既定で SQLite、backend/heron.db が作られる）
cd backend
go run ./cmd/server
```

```powershell
# ターミナル2: フロントエンド開発サーバ
cd frontend
npm install     # 初回のみ
npm start       # http://localhost:4200
```

`npm start` は `proxy.conf.json` により `/api` を `localhost:8080` へ転送するため、
CORS の設定なしにそのまま動く。

### 初期アカウント

`SEED_DEMO=true`（既定）のとき、初回起動時にデモ用のユーザーと機材が投入される。

| ロール | ログインID | パスワード |
| --- | --- | --- |
| 管理者 (Admin) | `admin` | `heron-admin` |
| 一般 (General) | `animator1` | `heron-user` |
| 一般 (General) | `animator2` | `heron-user` |
| 一般 (General) | `producer1` | `heron-user` |

**本番運用では `SEED_DEMO=false` を設定し、`JWT_SECRET` を必ず変更すること。**

---

## スマートフォンからの利用

QRスキャンはブラウザのカメラ API を使うため、**HTTPS または localhost でのみ動作する**
（ブラウザのセキュリティ制約）。スマホ実機で試す場合は次のいずれかを選ぶ。

1. **PC のブラウザで動作確認**（localhost 扱いになるためカメラが使える）
2. **社内に HTTPS で公開する** — リバースプロキシ（Caddy / nginx + Let's Encrypt 等）を前段に置く
3. **一時的にトンネルを使う** — `cloudflared tunnel --url http://localhost:8081` などで HTTPS URL を得る

いずれの方法も使えない場合でも、各スキャン画面には**機材IDの手入力欄**があるため
貸出・返却・棚卸しの操作自体は行える。

---

## 主な機能

### 権限（設計書 第1部 2章）

| 権限 | できること |
| --- | --- |
| 管理者 (Admin) | 機材の登録・編集・除却、ラベル発行・印刷、スキャンによる貸出・返却・棚卸し、マスタ管理、全履歴閲覧 |
| 一般 (General) | 自身の貸出中機材の確認、機材検索（ステータスと所在の閲覧のみ） |

一般ユーザーは貸出・返却のシステム操作を行えない。画面はナビゲーションから隠され、
API 側でも 403 を返す（二重で担保）。

### 機材IDの採番（設計書 3.1）

```
HRN-[カテゴリ(2〜3文字)]-[連番4桁]      例: HRN-TAB-0108
```

カテゴリごとにシステムが自動採番する。同時登録による連番の衝突を防ぐため、
`category_sequences` テーブルの該当行をトランザクション内でロックして払い出す。

部署名や使用者名は変動するため物理ラベルには印字せず、DB上のメタデータとして扱う。

### ステータス（設計書 3.2）

| 値 | 表示 | 意味 |
| --- | --- | --- |
| `available` | 保管中 | ロケーションに保管され、即時貸出可能 |
| `in_use` | 利用中 | 特定ユーザーに貸出中 |
| `maintenance` | 修理・メンテナンス中 | 一時的に使用不可 |
| `discarded` | 廃棄・除却 | 履歴保持のためデータ上は残す（論理削除） |

### スキャン機能（設計書 3.3）

- **単一スキャン（`/scan`）** — QRを読むと機材情報がポップアップし、その場で貸出先を選んで貸出、
  または返却先の棚を選んで返却を1タップで完了する。
- **連続スキャン / 棚卸しモード（`/inventory`）** — 対象の部屋・棚を選んでカメラを起動し、
  次々にQRを読み込む。確定時に一括送信し、対象機材の所在をその棚に上書きして
  「保管中」にし、棚卸しログを記録する。

  棚卸し結果では、**その棚にあるはずなのに読み取られなかった機材（＝紛失候補）** も
  併せて返す。設計書に明記はないが棚卸しの主目的であるため実装した。
  未発見機材の所在情報は書き換えない。

QRの内容は機材ID文字列そのものだが、`https://.../HRN-TAB-0108` のようなURL形式も
受け付ける（フロント・バックエンドの両方で同じ正規化を行う）。

---

## ラベル印刷（NIIMBOT M2）

`/print/label/{equipment_id}` の隠しルートで、30mm × 15mm・余白ゼロの
描画領域を `@page` / `@media print` で厳密に定義している。
QRコードは TypeScript 側で Base64 の data URL として生成する。

### Windows での手順

1. NIIMBOT M2 を Bluetooth または USB で PC とペアリングする
2. Windows の「設定 → Bluetoothとデバイス → プリンターとスキャナー」に
   プリンタとして現れることを確認する
3. 機材詳細画面の「🖨️ ラベル印刷」から印刷ビューを開く
4. 「印刷する」を押し、プリンタ一覧から NIIMBOT M2 を選択
5. **用紙サイズ 30mm × 15mm・余白なし・倍率100%（等倍）** に設定
6. ブラウザの「ヘッダーとフッター」を必ずオフにする

macOS の場合は 2. を「システム設定 → プリンタとスキャナ」に読み替える。

> ### ⚠️ 事前検証が必要な項目
> NIIMBOT M2 は本来 Bluetooth 経由の専用プロトコルで動作する機種であり、
> **OS の汎用プリンタドライバとして認識される保証がない**。
> 認識されない場合、`window.print()` 経由の印刷は成立しない。
>
> 実機で確認し、認識されなかった場合の代替案：
> - 印刷ビューを画像として保存し、NIIMBOT 純正アプリから読み込んで印刷する
>   （印刷ビューはそのまま画像化できるレイアウトになっている）
> - Web Bluetooth API で NIIMBOT のプロトコルを直接叩く（実装コストは大きい）
> - 汎用のラベルプリンタ（Brother QL シリーズ等）へ機種を変更する
>
> この点は開発初期に実機検証しておくことを強く推奨する。

---

## API 仕様

すべて `Authorization: Bearer <token>` が必要（`/api/auth/login` と `/healthz` を除く）。

### 認証

| メソッド | パス | 権限 | 内容 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | — | ログイン。JWT を発行 |
| GET | `/api/auth/me` | 全員 | 自身の情報 |

### 機材

| メソッド | パス | 権限 | 内容 |
| --- | --- | --- | --- |
| GET | `/api/equipments` | 全員 | 一覧・検索（`q` `category` `status` `location_id` `user_id` `page` `per_page`） |
| GET | `/api/equipments/{id}` | 全員 | 詳細 + 直近の履歴 |
| POST | `/api/equipments` | 管理者 | 新規登録・ID採番 |
| PUT | `/api/equipments/{id}` | 管理者 | 属性・ステータス更新 |
| DELETE | `/api/equipments/{id}` | 管理者 | 除却（論理削除） |
| GET | `/api/me/equipments` | 全員 | 自身が借用中の機材 |

### 取引

| メソッド | パス | 権限 | 内容 |
| --- | --- | --- | --- |
| POST | `/api/transactions/lend` | 管理者 | 貸出（`equipment_id`, `target_user_id`） |
| POST | `/api/transactions/return` | 管理者 | 返却（`equipment_id`, `location_id`） |
| POST | `/api/transactions/inventory` | 管理者 | 一括棚卸し（`location_id`, `equipment_ids[]`） |

### マスタ・履歴

| メソッド | パス | 権限 | 内容 |
| --- | --- | --- | --- |
| GET | `/api/locations` | 全員 | 保管場所一覧 |
| POST / PUT / DELETE | `/api/locations[/{id}]` | 管理者 | 保管場所の管理 |
| GET | `/api/users` | 全員 | ユーザー一覧（貸出先選択用。パスワードハッシュは返さない） |
| POST | `/api/users` | 管理者 | ユーザー登録 |
| GET | `/api/logs` | 管理者 | 全利用者の操作履歴 |
| GET | `/api/stats` | 管理者 | ステータス別集計 |

### 主なエラー応答

| ステータス | 状況 |
| --- | --- |
| 400 | 入力形式の不正（機材IDの形式、日付形式 等） |
| 401 | 未認証・トークン期限切れ |
| 403 | 一般ユーザーが管理者専用APIを呼んだ |
| 404 | 機材・ユーザー・保管場所が存在しない |
| 409 | 業務ルール違反（二重貸出、貸出中でない機材の返却、重複する棚 等） |

---

## 環境変数

| 変数 | 既定値 | 内容 |
| --- | --- | --- |
| `PORT` | `8080` | API の待ち受けポート |
| `DB_DRIVER` | `sqlite` | `postgres` または `sqlite` |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL 接続先 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `heron` / `heron_password` / `heron` | PostgreSQL 認証情報 |
| `SQLITE_PATH` | `heron.db` | SQLite のファイルパス |
| `JWT_SECRET` | `heron-dev-secret-change-me` | **本番では必ず変更** |
| `JWT_TTL_HOURS` | `12` | トークンの有効期間 |
| `CORS_ORIGINS` | `http://localhost:4200,http://localhost:8081` | 許可するオリジン（カンマ区切り） |
| `SEED_DEMO` | `true` | デモデータの投入可否 |
| `DB_HOST_PORT` | `55432` | compose が PostgreSQL をホストに公開するポート |

### 外部キーについて

GORM の `AutoMigrate` による外部キー自動生成は無効化し、`internal/db/db.go` の
`foreignKeys` に定義した6本を明示的に張っている。

`TransactionLog` と `Equipment` がともに `EquipmentID` フィールドを持つため、
GORM が両者の関連を belongs-to ではなく has-one と誤推論し、
`equipments` 側に誤った制約を生成してしまうのを避けるため。
制約の追加は冪等で、SQLite では（ALTER TABLE 非対応かつ既定で外部キーを
強制しないため）スキップされる。

---

## ディレクトリ構成

```
HERON/
├─ backend/                      Go API サーバ
│  ├─ cmd/server/main.go          エントリポイント（graceful shutdown 込み）
│  └─ internal/
│     ├─ auth/                    JWT 発行・検証、ロール認可ミドルウェア
│     ├─ config/                  環境変数の読み込み
│     ├─ db/                      接続・マイグレーション・初期データ
│     ├─ handlers/                REST API ハンドラ
│     ├─ models/                  GORM モデル（設計書 2章に対応）
│     ├─ router/                  ルーティング定義
│     └─ service/                 採番・貸出・返却・棚卸しの業務ロジック
├─ frontend/                     Angular アプリ
│  └─ src/app/
│     ├─ core/                    API クライアント、認証、スキャナ、ガード
│     ├─ layout/                  共通シェル（サイドバー / 下部タブ）
│     ├─ pages/                   各画面
│     └─ shared/                  共通コンポーネント
├─ docker-compose.yml            db + backend + frontend
└─ HERON_System_Design-v2.pdf    要件定義 兼 基本設計書
```

---

## テスト

```powershell
cd backend
go test ./...
```

業務ロジック（`internal/service`）に対して以下を検証している。

- カテゴリ別の連番採番、カテゴリ形式の検証、既存データとの採番同期
- 機材IDの正規化（URL形式・大小文字・空白・不正文字列）
- 貸出／返却の状態遷移、二重貸出・非貸出中返却の拒否
- メンテナンス中・廃棄済み機材の貸出拒否
- 棚卸しの反映・移動検出・**未発見（紛失候補）検出**・未登録ID・重複読み取り

フロントエンドのビルド検証：

```powershell
cd frontend
npm run build
```

---

## 設計書からの変更点・追加事項

設計書に記述がない箇所は以下の前提で実装した。運用方針に合わせて変更可能。

| 項目 | 対応 | 理由 |
| --- | --- | --- |
| 認証方式 | ログインID + パスワード（bcrypt）+ JWT。`users` に `login_id` / `password_hash` を追加 | 設計書にロール定義はあるが認証方式の記述がなく、権限制御を実装できないため |
| `equipments` の属性 | `name` / `model_number` / `purchased_at` / `note` を追加 | 設計書の5カラムだけでは一般ユーザーの「機材検索」が機材IDでしか行えないため |
| 連番の採番方式 | `category_sequences` テーブル + 行ロック | アプリ側で `MAX+1` すると同時登録時に採番が衝突するため |
| 棚卸しの結果 | 未スキャン機材を `missing` として返す | 棚卸しの主目的である紛失検知が、スキャン結果の反映だけでは達成できないため |
| 機材の削除 | 物理削除ではなくステータスを `discarded` に変更 | 設計書 3.2 の「履歴を保持するためにデータ上残している状態」に従うため |
| DBドライバ | PostgreSQL に加えて SQLite を選択可能に | Docker を起動していないローカル環境でも `go run` だけで動かせるようにするため |
| カラーパレットの運用 | テキストは `#2A3A4A`〜`#465463` に限定 | `#D3D8DE` 背景に `#7F8994` 以降の淡色を載せると WCAG AA を満たさないため |

### 今後の課題

- **NIIMBOT M2 の実機検証**（前述。最優先）
- パスワード変更・リセット機能（現状は管理者によるユーザー作成時のみ設定可能）
- 一般ユーザーからの「貸出申請」フロー（現状は管理者の操作のみ）
- 棚卸し結果の CSV エクスポート
- 監査ログの保持期間ポリシーとアーカイブ
