# 📋 【AI / エンジニア用】HERON 稟議システム統合・引き継ぎ指示書 (APPROVAL INTEGRATION GUIDE)

本ドキュメントは、**HERONプロジェクトの「稟議システム（デジタル稟議・電子承認ワークフロー）」を社内ポータルサイトや別システムへ移設・埋め込み・統合する際、AIエージェント（Cursor, Windsurf, Antigravity等）および開発エンジニアが遵守すべき専用指示書・技術仕様書**です。

---

## 🤖 1. AIエージェント厳守ルール (AI Agent Rules)

このプロジェクトを読み込むすべてのAIエージェントは、以下の原則をいかなる場合でも必ず遵守してください。

1. **既存UI・コンポーネントデザインの破壊禁止**:
   - `frontend/src/app/pages/approval/approval.component.ts` 内のレイアウト、CSSクラス（Tailwind）、デジタル印鑑デザイン、プログレスステッパー等の外見・スタイルをユーザーの明示的な指示なしに変更してはならない。
2. **4段階承認フローと編集ガードの完全保持**:
   - 「① 申請者提出 (`submitted`)」の時のみ編集可能、「② プロデューサー承認」以降は変更不可（ロック）というビジネスロジックを必ず維持すること。
3. **新規モジュールでの拡張（Adapterパターンの適用）**:
   - 他システムへの統合や認証連携、DB接続を行う際は、既存の `frontend/src/app/core/approval.service.ts` を直接壊さず、新しいアダプタークラスや連携サービス（例: `PortalApprovalService` 等）を作成して接続すること。

> [!IMPORTANT]
> この指示書を読み込んだAIエージェントは、対話の冒頭に **「`[APPROVAL_INTEGRATION 承諾済]`」** と出力し、稟議システムのUI・印影デザイン・データ完全性を最優先に作業を進めてください。

---

## 📐 2. 稟議システムのアーキテクチャ・主要構成ファイル

本稟議システムは、以下の3つの主要ファイルで完結する堅牢な Angular 19 スタンドアロン構成となっています。

| ファイル | パス | 役割・概要 |
|---|---|---|
| **コンポーネント (UI)** | `frontend/src/app/pages/approval/approval.component.ts` | 稟議一覧・プレビュー用紙・承認進捗ステッパー・印影・PDFダイレクト保存・モーダルフォーム |
| **サービス (Logic)** | `frontend/src/app/core/approval.service.ts` | 状態管理 (Signal)、承認進展処理、編集ガード判定、マルチキーLocalStorageマージ保存 |
| **型定義 (Model)** | `frontend/src/app/core/approval.model.ts` | `ApprovalRequest`, `PurchaseItem`, `TimelineStep`, `StampInfo` 等のインターフェース定義 |

---

## 🔄 3. 承認フロー ＆ 編集パーミッション制御仕様

稟議システムは、以下の **4段階順次承認ワークフロー** で運用されます。

```
[① 申請者提出] ──▶ [② プロデューサー承認] ──▶ [③ DXチーム確認] ──▶ [④ 代表承認 (決裁完了)]
 (submitted)        (producer_approved)      (dx_confirmed)      (president_approved)
  ※ 編集可能             ※ 編集不可(ロック)        ※ 編集不可           ※ 編集不可
```

### ステータス別権限表

| ステータスキー | 表示名称 | 申請内容の編集権限 | 押印状況 |
|---|---|---|---|
| `submitted` | ① 申請中 | **可能** (`openEditModal()` 許可) | 提出者印のみ |
| `producer_approved` | ② プロデューサー承認済 | **不可** (編集ボタン非表示/カード不可) | 提出者印 ＋ プロデューサー印 |
| `dx_confirmed` | ③ DXチーム確認済 | **不可** (編集ボタン非表示/カード不可) | 提出者印 ＋ プロデューサー印 ＋ DXチーム印 |
| `president_approved` | ④ 代表承認済 | **不可** (決裁完了) | 4者すべての印鑑が押印完了 |

---

## 💮 4. デジタル認印（承認印）デザイン仕様

社内デザインカタログ (`docs/デジタル印鑑 デザインカタログ.html`) の **「2. 二重丸印（部署名入）」** に完全準拠した電子認印です。

- **枠線スタイル**: 朱色 (`#e60012`) 二重丸枠線 (`border-[2.5px] border-double`)
- **フォント**: 明朝体 (`font-serif`)
- **配置**: 垂直まっすぐ（回転・傾きなし）
- **サイズ**: `46px × 46px` コンパクトサイズ
- **3段レイアウト**:
  - 上段：役職/部署名（`代表` / `DXチーム` / `プロデューサー` / `提出者`）
  - 中段：承認フル年月日（`YYYY/M/D` 形式、例: `2026/3/13`）
  - 下段：承認者苗字（テキストサイズ `8.5px`）

---

## 📄 5. ダイレクトPDF出力 & 画像表示仕様

「PDFをダウンロード」ボタン押下時、ブラウザの印刷ダイアログを挟まず `html2pdf.js` によりA4用紙サイズのPDFがダイレクト生成されます。

### PDF出力時の主な技術仕様
1. **印刷プレビュー不要・1枚完全収容**:
   - `#print-area` のクローンを作成し、`box-shadow: none`, `margin: 0` を適用。
   - 余分な白紙ページ（2枚目）が発生しない完全A4 1枚収容設計。
2. **外部商品画像のCORS白枠化完全防止**:
   - ビックカメラや外部ECサイトの画像URLがCORS制限でブロックされるのを防ぐため、`imageUrlToBase64()` により Base64 Data URL へ事前変換。
   - 直リンク拒否画像に対しては CORSプロキシ（`wsrv.nl` / `corsproxy.io`）を経由して安全に画像データを取得・埋め込み。
3. **商品画像アスペクト比自動フィッティング (`object-contain`)**:
   - 画面表示・PDF出力ともに `object-fit: contain !important` を適用。
   - 縦長・横長どんな商品画像であっても、見切れたり切れたりせず画像枠内に全景がきれいに収まる自動調整。

---

## 💾 6. データ永続化と他システムDBへの結合設計

現状の独立版 HERON では `localStorage` を使用し、すべての過去ストレージキー（`heron_approval_requests_v3`, `v2`, `v1`, `heron_approval_requests`）からデータを自動収集・統合マージする永続化を行っています。

### 他システムへ統合する際の手順 (DB結合時)

他のポータルサイトやバックエンド（PostgreSQL / Firestore / Node.js / Go / Python 等）に統合する場合は、`approval.service.ts` を以下の通りAPI経由に差し替えてください。

```typescript
// ポータル統合用 ApprovalService 差し替えイメージ
@Injectable({ providedIn: 'root' })
export class PortalApprovalService {
  private http = inject(HttpClient);
  readonly requests = signal<ApprovalRequest[]>([]);

  // 1. APIから全稟議リストを取得
  loadRequests() {
    this.http.get<ApprovalRequest[]>('/api/portal/approvals').subscribe(data => {
      this.requests.set(data);
    });
  }

  // 2. 新規申請作成
  createRequest(reqData: any) {
    return this.http.post<ApprovalRequest>('/api/portal/approvals', reqData);
  }

  // 3. 承認ステップの進展 (ステータス変更)
  advanceApproval(id: string, approverName: string) {
    return this.http.put<ApprovalRequest>(`/api/portal/approvals/${id}/advance`, { approverName });
  }
}
```

---

## 📑 7. 他システム統合時の確認チェックリスト (Checklist)

統合作業を行う前に、ポータルサイト開発チームと以下の項目を確認してください。

- [ ] **認証連携**: ポータル側のログインユーザー情報（ユーザー名・所属部署）が `AuthService` またはヘッダー経由で `ApprovalComponent` に正常に引き継がれているか。
- [ ] **画面埋め込み方式**:
  - Angularコンポーネント直接統合の場合 ➔ コンポーネントをそのまますべてインポート。
  - iframe埋め込みの場合 ➔ `X-Frame-Options` および CSP (Content Security Policy) ヘッダーの調整。
- [ ] **PDF出力用スクリプト**: `html2pdf.js` (v0.10.1) がポータルサイト側で安全に読み込めるか。
- [ ] **CORSプロキシ許可**: ビックカメラ等の外部画像を取得する `wsrv.nl` へのアウトバウンド通信がポータル側のネットワーク制限に引っかからないか。

---

## 🚀 8. 統合AIエージェントへのプロンプト指示テンプレート

統合システムを構築するAI（CursorやAntigravity等）に作業を依頼する際は、以下のテキストをプロンプトとして渡してください。

```text
あなたはHERONの「稟議システム」を当ポータルサイトへ統合する専門エンジニアAIです。
作業を開始する前に `docs/APPROVAL_INTEGRATION_GUIDE.md` を熟読し、冒頭で `[APPROVAL_INTEGRATION 承諾済]` と宣言してください。

【厳守事項】
1. docs/APPROVAL_INTEGRATION_GUIDE.md に記載された既存の稟議UI、印影デザイン(二重丸朱色印)、4段階承認フロー、およびPDF出力ロジックを一切破壊しないこと。
2. 「① 申請者提出」以外での稟議内容変更不可ガードを必ず保持すること。
3. 統合に必要なコード追加は既存コードを書き換えず、新しいアダプタークラスやモジュールを作成して拡張すること。
```
