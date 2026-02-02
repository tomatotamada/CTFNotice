# CTFNotice

CTFtime.org から新しいCTFイベントを検出し、Slackに通知するボットです。

GitHub Actionsで定期実行され、新しいイベントが追加されると自動的にSlackチャンネルに通知します。

## 機能

- CTFtime.org APIから今後のCTFイベントを取得
- 新規イベントを検出してSlackに通知
- 重複通知の防止（通知済みイベントを記録）
- GitHub Actionsによる自動定期実行

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
├── src/
│   ├── index.ts           # メインエントリーポイント
│   ├── config.ts          # 設定管理
│   ├── ctftime.ts         # CTFtime APIクライアント
│   ├── slack.ts           # Slack通知
│   └── storage.ts         # 通知済みイベント管理
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

## ライセンス

ISC
