# Next Steps - Railway Deployment

## 現在の状況

✅ ソースコード実装完了
✅ Pre-commit hook設定
✅ GitHub Actions CI設定
✅ Railwayプロジェクト作成
⚠️ Railway環境変数設定（要確認）
⚠️ Railwayデプロイ（要確認）

---

## 次に行うこと

### 1. Railway環境変数の設定確認

Railway Dashboard → プロジェクト選択 → **Variables** タブで以下が設定されているか確認：

```
DATABASE_URL=file:/data/prod.db
LINE_CHANNEL_SECRET=<your-line-channel-secret>
LINE_CHANNEL_ACCESS_TOKEN=<your-line-channel-access-token>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=https://<your-app>.railway.app/auth/google/callback
GEMINI_API_KEY=<your-gemini-api-key>
ENCRYPTION_KEY=<your-encryption-key>
NODE_ENV=production
PORT=3000
```

**設定されていない場合:**
- **RAW Editor** をクリック
- 上記をペースト
- **Update Variables** をクリック

### 2. Volume設定の確認

Railway Dashboard → **Settings** タブ → **Volumes**

**Volume が設定されていない場合:**
1. **New Volume** をクリック
2. **Mount Path**: `/data`
3. **Add** をクリック

### 3. デプロイの確認

Railway Dashboard → **Deployments** タブ

**ログで確認すべき内容:**
- ✅ ビルド成功
- ✅ `Server is running on port 3000`
- ❌ エラーが出ている場合 → ログをコピーして確認

### 4. デプロイURLの取得

Railway Dashboard → **Settings** タブ → **Domains**

表示されるURL（例: `https://post-schedule-from-line-production.up.railway.app`）をコピー

### 5. LINE Webhook URLの設定

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. チャネルを選択
3. **Messaging API** タブ
4. **Webhook URL** に設定:
   ```
   https://your-app.railway.app/webhook
   ```
   （`your-app`をRailwayのURLに置き換え）
5. **Verify** をクリック
6. **Use webhook** を **ON** にする

### 6. Google OAuth Redirect URIの更新

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) にアクセス
2. OAuth 2.0 クライアントIDを選択
3. **承認済みのリダイレクト URI** に追加:
   ```
   https://your-app.railway.app/auth/google/callback
   ```
4. **保存**

5. Railway環境変数を更新:
   ```
   GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
   ```

### 7. 本番環境テスト

1. **LINEでBotに友だち追加**
2. **任意のメッセージを送信** → Google認証リンクが返信される
3. **認証リンクをタップ** → Google OAuth完了
4. **スケジュールメッセージを送信**:
   ```
   明日の15時から会議
   ```
5. **確認メッセージが返ってくるか確認**

---

## トラブルシューティング

### デプロイが失敗している

**症状**: Railwayのログに `DATABASE_URL` missing エラー

**解決**: 環境変数が設定されていない → 手順1を実施

### Webhook検証失敗

**症状**: LINE Webhook URL検証で「200以外のステータス」

**解決**:
1. Railwayのデプロイが成功しているか確認
2. ヘルスチェックを確認:
   ```bash
   curl https://your-app.railway.app/health
   ```
3. `LINE_CHANNEL_SECRET` が正しいか確認

### Google OAuth エラー

**症状**: `redirect_uri_mismatch`

**解決**:
1. RailwayのURLが正しいか確認
2. Google Cloud Consoleで承認済みURIを更新
3. Railway環境変数 `GOOGLE_REDIRECT_URI` を更新

---

## 現在の進捗状況

あなたはどこまで進みましたか？

- [ ] Railway環境変数設定
- [ ] Railwayデプロイ成功
- [ ] LINE Webhook URL設定
- [ ] Google OAuth URI更新
- [ ] 本番環境テスト

次に進む準備ができたら教えてください！
