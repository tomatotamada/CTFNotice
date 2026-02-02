# CTFNotice

CTFtime.org から新しいCTFイベントを検出し、Slackに通知するボットです。

## 2つのモード

### 1. 新着通知 (GitHub Actions)
GitHub Actionsで定期実行され、新しいイベントが追加されると自動的にSlackに通知します。

### 2. リマインダー (Cloudflare Workers)
Slackコマンドでイベントを登録し、開始24時間前・1時間前にリマインドします。

## 機能

**新着通知:**
- CTFtime.org APIから今後のCTFイベントを取得
- 新規イベントを検出してSlackに通知
- 重複通知の防止（通知済みイベントを記録）
- GitHub Actionsによる自動定期実行

**リマインダー:**
- `/ctf add <日時> <タイトル>` - カスタムイベントを手動登録
- `/ctf watch <event_id>` - CTFtimeイベントをウォッチリストに追加
- `/ctf unwatch <event_id>` - ウォッチリストから削除
- `/ctf list` - ウォッチリストを表示
- 開始24時間前・1時間前に自動リマインド

## セットアップ

### 1. リポジトリをフォーク/クローン

```bash
git clone https://github.com/tomatotamada/CTFNotice.git
cd CTFNotice
npm install
```

### 2. Slack Webhook URLを取得

1. [Slack API](https://api.slack.com/apps) にアクセス
2. 「Create New App」→「From scratch」を選択
3. アプリ名と通知先のワークスペースを選択
4. 「Incoming Webhooks」を有効化
5. 「Add New Webhook to Workspace」で通知先チャンネルを選択
6. 生成されたWebhook URLをコピー

### 3. GitHub Secretsを設定

1. リポジトリの Settings → Secrets and variables → Actions
2. 「New repository secret」をクリック
3. Name: `SLACK_WEBHOOK_URL`
4. Secret: 取得したWebhook URL
5. 「Add secret」をクリック

### 4. 完了

GitHub Actionsが毎時0分(UTC)に自動実行されます。

## 手動実行

リポジトリの Actions → Check CTF Events → Run workflow から手動実行できます。

## ローカルでのテスト

```bash
# .envファイルを作成
cp .env.example .env

# Webhook URLを設定
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# 実行
npm run check
```

## 設定

### 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|------------|------|
| `SLACK_WEBHOOK_URL` | Yes | - | Slack Incoming Webhook URL |
| `DAYS_AHEAD` | No | 30 | 何日先までのイベントを取得するか |

### 実行スケジュール

`.github/workflows/check-ctf.yml` の `cron` を編集:

```yaml
schedule:
  # 毎時0分 (デフォルト)
  - cron: '0 * * * *'

  # 6時間ごと
  # - cron: '0 */6 * * *'

  # 1日1回 (UTC 0:00 = JST 9:00)
  # - cron: '0 0 * * *'
```

## プロジェクト構成

```
CTFNotice/
├── .github/
│   └── workflows/
│       └── check-ctf.yml  # GitHub Actions ワークフロー
├── src/                   # 新着通知 (GitHub Actions用)
│   ├── index.ts           # メインエントリーポイント
│   ├── config.ts          # 設定管理
│   ├── ctftime.ts         # CTFtime APIクライアント
│   ├── slack.ts           # Slack通知
│   └── storage.ts         # 通知済みイベント管理
├── worker/                # リマインダー (Cloudflare Workers用)
│   ├── src/
│   │   └── index.ts       # Workerメイン
│   ├── wrangler.toml      # Cloudflare設定
│   └── README.md          # Workerセットアップガイド
├── .env.example           # 環境変数テンプレート
├── package.json
└── tsconfig.json
```

## 通知例

Slackに以下のような通知が送信されます:

```
🚩 新しいCTFイベント (2件)
────────────────────────
DEF CON CTF Qualifier 2025
📅 2025/05/10 09:00 〜 2025/05/12 09:00
⏱️ 2日 0時間
🏷️ Jeopardy | Weight: 100.00
👥 DEF CON
🔗 公式サイト
────────────────────────
...
```

## リマインダーのセットアップ

リマインダー機能を使う場合は [worker/README.md](./worker/README.md) を参照してください。

### リマインダーコマンド詳細

#### `/ctf add` - カスタムイベントの手動登録
CTFtimeに載っていないローカルCTF・社内CTF・その他のコンテストを登録できます。

**使用方法:**
```
/ctf add <開始日時> <タイトル>
```

**日時形式:**
- ISO 8601: `/ctf add 2026-03-15T10:00 My Event`
- 簡略形式: `/ctf add "2026-03-15 10:00" Company CTF`

日時にタイムゾーンがない場合は JST (Asia/Tokyo) として扱われます。

**例:**
```
/ctf add 2026-03-15T10:00 Local CTF Competition
/ctf add "2026-03-20 14:00" Company Internal CTF
```

#### `/ctf watch` - CTFtimeイベントの登録
CTFtime.orgのイベントをウォッチリストに追加します。

**使用方法:**
```
/ctf watch <event_id or url>
```

**例:**
```
/ctf watch 12345
/ctf watch https://ctftime.org/event/12345
```

#### `/ctf list` - ウォッチリストの表示
登録済みのイベントを表示します。カスタムイベントには 🔖 バッジが付きます。

**表示例:**
```
📋 ウォッチリスト (3件)

1. 🟢 SECCON 2026 Finals
   📅 2026/03/20 10:00 (72時間後)

2. 🟢 🔖 Company Internal CTF
   📅 2026/03/15 10:00 (24時間後)

3. 🟡 🔖 Local CTF Meetup
   📅 2026/03/10 14:00 (2時間後)
```

#### `/ctf unwatch` - イベントの削除
ウォッチリストからイベントを削除します。

**使用方法:**
```
/ctf unwatch <event_id>
```

### リマインダー通知

登録したイベントについて以下のタイミングで自動通知が送信されます：
- 📢 開始24時間前
- 🚨 開始1時間前

カスタムイベント（🔖）にも同じリマインダーが適用されます。

## ライセンス

ISC
