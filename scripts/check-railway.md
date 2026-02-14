# Railway トラブルシューティング

## 現在の状況

- ✅ デプロイは「成功」と表示されている
- ❌ ヘルスチェックで502エラー
- ❌ ログに何も表示されない

## 確認すべきこと

### 1. 環境変数が設定されているか

Railway Dashboard → **Variables** タブで以下を確認：

```
DATABASE_URL
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GEMINI_API_KEY
ENCRYPTION_KEY
NODE_ENV
PORT
```

**すべて設定されていますか？**

### 2. Volumeが設定されているか

Railway Dashboard → **Settings** タブ → **Volumes**

- Mount Path: `/data` が設定されていますか？

### 3. デプロイログの詳細を確認

Railway Dashboard → **Deployments** タブ → 最新のデプロイをクリック

**Build Logs** を確認：
- `prisma generate` が成功しているか
- `tsc` (TypeScript compile) が成功しているか
- エラーメッセージがないか

**Deploy Logs** を確認：
- `Server is running on port 3000` が表示されているか
- `prisma migrate deploy` が成功しているか
- エラーメッセージがないか

### 4. よくある問題

#### 問題A: 環境変数が設定されていない

**症状**: ビルド時に `DATABASE_URL` missing エラー

**解決**:
1. Variables タブで RAW Editor を開く
2. `.env.prod` の内容をペースト
3. Update Variables

#### 問題B: Volumeが設定されていない

**症状**: データベース接続エラー

**解決**:
1. Settings → Volumes → New Volume
2. Mount Path: `/data`
3. Add

#### 問題C: Node.jsバージョンの問題

**症状**: `@line/bot-sdk` が要求するNode.js 20以上

**確認**:
- `railway.json` の設定
- Nixpacksが正しいNode.jsバージョンを使用しているか

#### 問題D: ポートの設定

**症状**: アプリケーションが起動しない

**確認**:
- `PORT=3000` が環境変数に設定されているか
- `src/index.ts` で `process.env.PORT` を使用しているか

## 次のステップ

以下を確認してください：

1. Railway Dashboard の **Variables** タブを開く
2. 環境変数がすべて設定されているか確認
3. **Deployments** タブで最新のログを確認
4. エラーメッセージをコピーして教えてください

---

**Railwayの画面で確認してほしいこと:**

### Variables タブ
- [ ] 環境変数が10個設定されているか
- [ ] DATABASE_URL が `file:/data/prod.db` になっているか

### Settings → Volumes
- [ ] Volume が設定されているか
- [ ] Mount Path が `/data` になっているか

### Deployments タブ
- [ ] 最新のデプロイのステータスは？
- [ ] Build Logs にエラーはないか？
- [ ] Deploy Logs に何か表示されているか？

これらを確認して、結果を教えてください！
