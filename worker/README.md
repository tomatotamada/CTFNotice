# CTFNotice Worker (Cloudflare Workers)

Slackコマンドでイベントを登録し、開始前にリマインドする機能を提供します。

## 機能

- `/ctf watch <event_id>` - イベントをウォッチリストに追加
- `/ctf unwatch <event_id>` - イベントをウォッチリストから削除
- `/ctf list` - ウォッチリストを表示
- 24時間前・1時間前に自動リマインド

## セットアップ

### 1. Cloudflareアカウント作成

https://dash.cloudflare.com/sign-up でアカウントを作成

### 2. Wranglerインストール・ログイン

```bash
cd worker
npm install
npx wrangler login
```

### 3. KVネームスペース作成

```bash
npx wrangler kv namespace create WATCHLIST
```

出力されたIDを `wrangler.toml` に設定:

```toml
[[kv_namespaces]]
binding = "WATCHLIST"
id = "出力されたID"
```

### 4. シークレット設定

```bash
# Slack Webhook URL
npx wrangler secret put SLACK_WEBHOOK_URL

# Slack Signing Secret (Slack App設定画面から取得)
npx wrangler secret put SLACK_SIGNING_SECRET
```

### 5. デプロイ

```bash
npm run deploy
```

デプロイ後、表示されるURLをメモ（例: `https://ctfnotice.your-account.workers.dev`）

### 6. Slack App設定

1. https://api.slack.com/apps でアプリを選択（または新規作成）
2. 「Slash Commands」→「Create New Command」
   - Command: `/ctf`
   - Request URL: `https://ctfnotice.your-account.workers.dev/slack`
   - Description: `CTFイベント管理`
3. アプリをワークスペースに再インストール

## 使い方

Slackで以下のコマンドが使えます:

```
/ctf watch 12345
/ctf watch https://ctftime.org/event/12345
/ctf unwatch 12345
/ctf list
/ctf help
```

## リマインドタイミング

- イベント開始24時間前
- イベント開始1時間前

## ローカル開発

```bash
npm run dev
```
