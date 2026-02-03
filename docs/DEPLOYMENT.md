# Deployment Guide

## Railway Deployment

### 前提条件

- GitHub アカウント
- Railway アカウント
- LINE Developers アカウント
- Google Cloud Console アカウント
- Gemini API キー

### 1. Railway プロジェクトの作成

#### GitHub連携でデプロイ

1. [Railway](https://railway.app/) にアクセス
2. **New Project** をクリック
3. **Deploy from GitHub repo** を選択
4. リポジトリを選択: `post-schedule-from-line`
5. **Deploy Now** をクリック

Railwayは`railway.json`の設定を自動的に読み込みます。

#### Railway CLI でデプロイ（オプション）

```bash
# Railway CLI をインストール
npm i -g @railway/cli

# ログイン
railway login

# プロジェクトを初期化
railway init

# リンク
railway link
```

### 2. 環境変数の設定

Railway ダッシュボードで以下を設定：

#### 必須の環境変数

```bash
# データベース（Volumeマウント後のパス）
DATABASE_URL=file:/data/prod.db

# LINE Messaging API
# 取得先: https://developers.line.biz/console/
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here

# Google OAuth 2.0
# 取得先: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback

# Gemini API
# 取得先: https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key_here

# 暗号化キー（以下のコマンドで生成）
# openssl rand -hex 32
ENCRYPTION_KEY=your_64_char_hex_string_here

# 本番環境フラグ
NODE_ENV=production
```

#### 環境変数の設定手順

1. Railway ダッシュボードでサービスを選択
2. **Variables** タブを開く
3. 各環境変数を追加
4. **Deploy** をクリックして反映

### 3. SQLite の永続化（Volume 設定）

**重要**: Volume を設定しないと、デプロイごとにデータが消えます。

#### Volume 設定手順

1. Railway ダッシュボードでサービスを選択
2. **Settings** タブを開く
3. **Volumes** セクションで **New Volume** をクリック
4. 設定:
   - **Mount Path**: `/data`
   - **Size**: 1GB（初期値で十分）
5. **Add** をクリック
6. サービスが自動的に再起動されます

#### Volume 確認

デプロイ後、ログで以下を確認：

```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "prod.db" at "file:/data/prod.db"
```

### 4. LINE Webhook URL の設定

#### 1. Railway のデプロイ URL を取得

- Railway ダッシュボードの **Settings** > **Domains** で確認
- 例: `https://post-schedule-from-line-production.up.railway.app`

#### 2. LINE Developers Console で設定

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. プロバイダーとチャネルを選択
3. **Messaging API** タブを開く
4. **Webhook URL** を設定:
   ```
   https://your-app.railway.app/webhook
   ```
5. **Verify** をクリックして検証
6. **Use webhook** を **ON** にする

### 5. Google OAuth リダイレクト URI の設定

#### Google Cloud Console で設定

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) にアクセス
2. OAuth 2.0 クライアント ID を選択
3. **承認済みのリダイレクト URI** に追加:
   ```
   https://your-app.railway.app/auth/google/callback
   ```
4. **保存** をクリック

### 6. デプロイの確認

#### ログの確認

Railway ダッシュボードの **Deployments** タブでログを確認：

```
Server is running on port 3000
```

#### ヘルスチェック

```bash
curl https://your-app.railway.app/health
# 期待されるレスポンス: {"status":"ok"}
```

#### データベース接続の確認

```bash
curl https://your-app.railway.app/db-test
# 期待されるレスポンス: {"status":"ok","userCount":0}
```

### 7. 本番環境でのテスト

#### 1. LINE Bot に友だち追加

LINE Developers Console で QR コードを取得して友だち追加

#### 2. 未認証時の動作確認

任意のメッセージを送信 → Google 認証リンクが返信される

#### 3. Google OAuth 認証

1. 認証リンクをタップ
2. Google アカウントでログイン
3. カレンダーへのアクセスを許可
4. 「認証が完了しました」画面が表示される

#### 4. スケジュール抽出のテスト

以下のようなメッセージを送信：

```
明日の15時から会議
```

期待される動作：
- スケジュール情報が抽出される
- 確認メッセージが返信される

### トラブルシューティング

#### デプロイが失敗する

**エラー**: `Build failed`

**確認事項**:
- `package.json` の `build` スクリプトが正しいか
- `prisma/schema.prisma` に構文エラーがないか

**解決策**:
```bash
# ローカルでビルドを確認
npm run build
```

#### データベース接続エラー

**エラー**: `Can't reach database server`

**確認事項**:
- Volume が正しくマウントされているか (`/data`)
- `DATABASE_URL` が `file:/data/prod.db` になっているか

**解決策**:
```bash
# Railway CLI でサービス内部に入る
railway run bash

# マウントポイントを確認
ls -la /data
```

#### LINE Webhook 検証失敗

**エラー**: `The webhook returned an HTTP status code other than 200`

**確認事項**:
- Railway でサービスが正常に起動しているか
- `LINE_CHANNEL_SECRET` が正しく設定されているか
- ヘルスチェックが通るか

**解決策**:
```bash
# ヘルスチェック
curl https://your-app.railway.app/health

# Webhook エンドポイントの確認（LINE から POST される）
curl -X POST https://your-app.railway.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'
```

#### Google OAuth エラー

**エラー**: `redirect_uri_mismatch`

**確認事項**:
- `GOOGLE_REDIRECT_URI` が Railway の URL と一致しているか
- Google Cloud Console で承認済み URI が正しく設定されているか

**解決策**:
1. Railway の正確な URL を確認
2. Google Cloud Console で URI を更新
3. Railway の環境変数を更新

### 継続的デプロイ

#### 自動デプロイ

Railway は GitHub の `main` ブランチへの push を自動検知してデプロイします。

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
# → Railway が自動的にデプロイ開始
```

#### マイグレーション

スキーマ変更時の手順：

1. ローカルでマイグレーション作成:
   ```bash
   npx prisma migrate dev --name add_new_field
   ```

2. コミット & プッシュ:
   ```bash
   git add prisma/migrations/
   git commit -m "feat: add new field to schema"
   git push origin main
   ```

3. Railway が自動的に `prisma migrate deploy` を実行

### 参考リンク

- [Railway Documentation](https://docs.railway.app/)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
