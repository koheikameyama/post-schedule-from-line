# LINE Schedule Bot - 設計ドキュメント

**作成日**: 2026-02-03
**バージョン**: 1.1

## 概要

LINEのメッセージング APIを使って、テキストや画像からスケジュール情報を自動抽出し、Googleカレンダーに登録するツール。

### 主な機能

- テキスト/画像メッセージからスケジュール情報を自動抽出
- 複数スケジュールの一括抽出とカルーセル表示
- 複数カレンダーからの選択機能
- Google Calendar への自動登録

---

## システムアーキテクチャ

### 全体フロー

```
ユーザー（LINE）
    ↓
LINE Messaging API
    ↓
Webhookサーバー（Express + TypeScript）
    ↓
LINE User IDでユーザー認証状態をチェック
    ↓
├─ 未認証
│   ↓
│   どんなメッセージでも「まずGoogle認証してください」と返信
│   認証URLを送信
│
└─ 認証済み
    ↓
    Gemini 1.5 Flash API（スケジュール抽出）
    ↓
    ├─ スケジュールなし → 「見つかりませんでした」と返信
    └─ スケジュールあり
        ↓
        カルーセルで確認画面表示（カレンダー選択付き）
        ↓
        ユーザーが「登録」or「スキップ」を選択
        ↓
        Google Calendar API（イベント登録）
        ↓
        結果をLINEで通知
```

### 技術スタック

| 領域 | 技術 |
|------|------|
| Backend | TypeScript + Express |
| Database | SQLite + Prisma（将来PostgreSQL移行可能） |
| AI | Gemini 1.5 Flash API |
| Calendar | Google Calendar API（OAuth 2.0） |
| Messaging | LINE Messaging API |
| Deploy | Railway |

---

## データベース設計

### テーブル構成（Prisma Schema）

#### 1. User テーブル

ユーザーの認証情報を管理

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | String (UUID) | プライマリキー |
| lineUserId | String (unique) | LINE User ID |
| googleAccessToken | String | OAuth 2.0アクセストークン（暗号化） |
| googleRefreshToken | String | リフレッシュトークン（暗号化） |
| googleTokenExpiry | DateTime | トークン有効期限 |
| googleCalendars | Json | カレンダー一覧のキャッシュ |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

#### 2. PendingSchedule テーブル

確認待ちスケジュールを管理

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | String (UUID) | プライマリキー |
| userId | String | User ID（外部キー） |
| lineMessageId | String | LINE メッセージID（重複防止） |
| title | String | スケジュールタイトル |
| description | String? | 詳細 |
| startDateTime | DateTime | 開始日時 |
| endDateTime | DateTime? | 終了日時 |
| calendarId | String? | 選択されたカレンダーID |
| status | Enum | pending / registered / skipped |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

#### 3. ScheduleHistory テーブル（オプション）

登録/スキップの履歴を記録

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | String (UUID) | プライマリキー |
| userId | String | User ID（外部キー） |
| scheduleId | String | PendingSchedule ID（外部キー） |
| action | Enum | registered / skipped |
| calendarId | String? | 登録先カレンダーID |
| googleEventId | String? | Googleイベントのレスポンス |
| createdAt | DateTime | 作成日時 |

---

## APIエンドポイント設計

### 1. `POST /webhook`

LINE Messaging APIからのイベントを受信

**処理内容：**
- LINE署名検証（セキュリティ）
- LINE User IDでDBからユーザー情報を取得
- **未認証ユーザーの場合：**
  - **どんなメッセージを送っても、Google OAuth認証リンクを返信**
  - メッセージ内容は無視（スケジュール抽出しない）
  - 「このBotを使うには、まずGoogle認証が必要です」と案内
  - 認証URLを含むメッセージを返信
- **認証済みユーザーの場合：**
  - メッセージイベント → スケジュール抽出処理へ
  - ポストバックイベント → カレンダー登録/スキップ処理へ

### 2. `GET /auth/google`

Google OAuth 2.0認証開始

**クエリパラメータ：**
- `userId`: LINE User ID

**処理内容：**
- Googleの認証画面にリダイレクト
- stateパラメータでLINE User IDを保持

### 3. `GET /auth/google/callback`

OAuth認証完了

**処理内容：**
- 認証コードを受け取る
- アクセス/リフレッシュトークンを取得
- カレンダー一覧を取得してキャッシュ
- DBに保存
- 完了画面を表示

### 4. 内部API（Postbackアクションから呼ばれる）

**4-1. カレンダー一覧取得**
- ユーザーのカレンダー一覧をLINE Flex Messageで表示

**4-2. スケジュール登録**
- 選択されたカレンダーにイベント作成
- PendingScheduleのstatusを `registered` に更新

**4-3. スケジュールスキップ**
- PendingScheduleのstatusを `skipped` に更新

---

## Gemini APIによるスケジュール抽出

### プロンプト設計

```
以下のメッセージ/画像からスケジュール情報を抽出してください。
複数のスケジュールがある場合はすべて抽出してください。

抽出するフォーマット（JSON）：
{
  "schedules": [
    {
      "title": "会議",
      "description": "営業チームとの打ち合わせ",
      "startDateTime": "2026-02-04T15:00:00+09:00",
      "endDateTime": "2026-02-04T16:00:00+09:00"
    }
  ]
}

注意事項：
- 日時が曖昧な場合は推測して補完してください（「明日」→ 具体的な日付）
- 終了時刻がない場合は開始時刻の1時間後を設定
- スケジュール情報が全く含まれていない場合は、空の配列を返してください
- 現在時刻: {現在時刻}

メッセージ: {ユーザーメッセージ}
```

### 処理フロー

1. **テキストメッセージ**: テキストをGeminiに送信
2. **画像メッセージ**: 画像をbase64エンコードしてGeminiに送信（マルチモーダル）
3. **レスポンスをパース**: JSON形式のスケジュール配列を処理
4. **空の配列**: 「スケジュール情報が見つかりませんでした」と返信
5. **1件以上**: PendingScheduleに保存 → カルーセル表示

---

## LINE UI設計

### カルーセル構成

抽出されたスケジュールごとに、Flex Messageのカルーセルで表示

**各カードの構成：**

```
┌─────────────────────┐
│ 📅 会議              │  ← タイトル
├─────────────────────┤
│ 開始: 2026/02/04 15:00 │
│ 終了: 2026/02/04 16:00 │
│ 詳細: 営業チームとの  │
│       打ち合わせ      │
├─────────────────────┤
│ [カレンダーを選択]   │  ← ボタン（緑）
│ [スキップ]           │  ← ボタン（グレー）
└─────────────────────┘
```

### カレンダー選択フロー

1. **「カレンダーを選択」ボタン押下**
2. **カレンダー一覧を表示（Flex Message）**
   - 各カレンダー名 + 色
   - 選択ボタン（Postback: `scheduleId` + `calendarId`）
3. **カレンダー選択**
4. **Google Calendar APIでイベント作成**
5. **「〇〇カレンダーに登録しました」と返信**

### Postback データ形式

```json
{
  "type": "postback",
  "data": "action=show_calendars&scheduleId=xxx"
}
```

```json
{
  "type": "postback",
  "data": "action=register&scheduleId=xxx&calendarId=yyy"
}
```

```json
{
  "type": "postback",
  "data": "action=skip&scheduleId=xxx"
}
```

---

## Google Calendar API統合

### 1. カレンダー一覧取得

```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
```

- OAuth認証後に一度取得してDBにキャッシュ
- 表示名、カレンダーID、色などを保存

### 2. イベント作成

```
POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
```

**リクエストボディ例：**
```json
{
  "summary": "会議",
  "description": "営業チームとの打ち合わせ",
  "start": {
    "dateTime": "2026-02-04T15:00:00+09:00",
    "timeZone": "Asia/Tokyo"
  },
  "end": {
    "dateTime": "2026-02-04T16:00:00+09:00",
    "timeZone": "Asia/Tokyo"
  }
}
```

### 3. トークンリフレッシュ

- アクセストークンの有効期限切れ時、リフレッシュトークンで自動更新
- 更新後のトークンをDBに保存

---

## エラーハンドリング

### 1. 認証エラー（トークン無効）

**エラー内容：**
- アクセストークン/リフレッシュトークンが無効

**対応：**
- 「Google認証の有効期限が切れました。再度認証してください」と返信
- 認証リンクを再送

### 2. API エラー

**エラー内容：**
- Gemini API失敗
- Google Calendar API失敗

**対応：**
- 「エラーが発生しました。しばらく待ってから再度お試しください」と返信
- エラー詳細をログに記録

### 3. LINE Webhook検証失敗

**エラー内容：**
- 署名が一致しない（不正なリクエスト）

**対応：**
- 403 Forbiddenを返して処理しない

### 4. レート制限

**エラー内容：**
- Gemini/Google Calendar APIのレート制限到達

**対応：**
- エクスポネンシャルバックオフでリトライ
- 一定回数失敗したら、ユーザーにエラーを返す

---

## セキュリティ対策

### 1. 環境変数の管理

すべての秘密情報は環境変数で管理：

```
DATABASE_URL=file:./dev.db  # 本番ではVolume使用
LINE_CHANNEL_SECRET=xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
GEMINI_API_KEY=xxx
ENCRYPTION_KEY=xxx  # openssl rand -hex 32で生成
NODE_ENV=production
```

- `.env`ファイルは`.gitignore`に追加
- Railwayの環境変数設定を使用

### 2. トークンの暗号化

- Googleアクセス/リフレッシュトークンは暗号化してDB保存
- `crypto`モジュールでAES-256-GCM暗号化
- 暗号化キーは環境変数 `ENCRYPTION_KEY` で管理

### 3. LINE Webhook署名検証

- すべてのWebhookリクエストで署名を検証
- LINE Channel Secretを使ってHMAC-SHA256で署名確認
- 検証失敗時は403を返す

### 4. CORS設定

- OAuth callbackエンドポイント以外は外部アクセス不要
- 必要最小限のCORS設定

---

## デプロイ設定（Railway）

### 1. 必要な環境変数

上記「セキュリティ対策」セクション参照

### 2. SQLiteの永続化

- SQLiteファイルをVolume Mountで永続化
- `/data/dev.db` に保存
- `DATABASE_URL=file:/data/dev.db`

### 3. 起動コマンド

**package.json:**
```json
{
  "scripts": {
    "start": "prisma migrate deploy && node dist/index.js",
    "build": "prisma generate && tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts"
  }
}
```

---

## 開発フェーズ

### Phase 1: MVP（最小限の動作確認）

**必須機能：**
1. Express + TypeScript環境構築
2. Prisma + SQLiteセットアップ
3. LINE Webhook受信（署名検証）
4. Google OAuth 2.0認証フロー
5. Gemini APIでテキストからスケジュール抽出（1件のみ）
6. シンプルな確認メッセージ → Google Calendar登録
7. Railway デプロイ

**この時点でできること：**
- テキストメッセージ1件からスケジュール抽出
- シンプルな確認メッセージで登録

### Phase 2: 本格機能追加

**追加機能：**
1. 複数スケジュール対応 + カルーセルUI
2. カレンダー選択機能
3. 画像解析対応（Geminiマルチモーダル）
4. エラーハンドリング強化
5. トークン暗号化

### Phase 3: 改善と最適化

**追加機能：**
1. ScheduleHistory記録
2. リトライ処理とレート制限対応
3. ユーザー設定機能（デフォルトカレンダー等）
4. 統計・分析機能

---

## 参考リンク

- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Railway Documentation](https://docs.railway.app/)

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-03 | 1.0 | 初版作成 |
| 2026-02-03 | 1.1 | 未認証ユーザーの処理を明確化（全メッセージで認証リンクを返す） |
