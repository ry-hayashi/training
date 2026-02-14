# Training Log (トレーニング管理アプリ)

種目ごとのMax重量・直近3回の記録を確認しながら素早くトレーニングを記録できるPWAアプリ。

## 技術スタック

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (ダークテーマ)
- **IndexedDB** (idb) — クライアントサイドのみ、サーバDB不要
- **PWA** (next-pwa) — モバイルホーム画面に追加可能

## セットアップ

```bash
npm install
npm run dev
```

## Renderへのデプロイ

1. GitHubリポジトリにpush
2. Render Dashboard → New Web Service
3. リポジトリを選択
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`

または `render.yaml` がリポジトリにあるので、Blueprint でデプロイ可能。

## ファイル構成

```
src/
├── types/          # データモデル型定義
│   └── models.ts
├── lib/
│   ├── db.ts       # IndexedDBラッパ（CRUD, Export, Import MERGE-ONLY）
│   └── aggregations.ts  # 純関数（Max, 直近3回, 部位別集計）
├── components/
│   ├── BottomNav.tsx
│   ├── BackupWarning.tsx
│   └── DBInitializer.tsx
└── app/
    ├── layout.tsx       # ルートレイアウト
    ├── page.tsx         # 種目一覧（検索・追加）
    ├── exercises/
    │   └── detail/page.tsx  # 種目詳細（Max, 直近3回, ログ入力）
    ├── templates/page.tsx   # テンプレート6枠
    ├── graph/page.tsx       # 部位別ボリュームグラフ
    └── settings/page.tsx    # バックアップ/インポート
```

## 主な機能

- **種目一覧**: 部位別グループ表示、検索、新規追加
- **種目詳細**: 過去Max重量、直近3回ログ、セット入力（リアルタイムVolume計算）
- **テンプレート**: 6枠にメニューをプリセット → 種目へワンタップ遷移
- **グラフ**: 週別・部位別の総ボリューム棒グラフ
- **バックアップ**: JSONエクスポート/MERGE-ONLYインポート、30日警告

## バックアップ仕様

- **Export**: 全テーブルをJSON (schemaVersion + exportedAt + data)
- **Import**: IDベースマージのみ（既存IDはスキップ、新規のみ追加、上書き・削除なし）
- **警告**: 30日間バックアップしていないと画面上部にバナー表示
