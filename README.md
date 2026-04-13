# cmrt-client-playground

シンプルなWebアプリ。コード名（例: C, Am, G7）を入力すると MML に変換し、
ローカルで起動中の [cmrt (clap-mml-render-tui)](https://github.com/cat2151/clap-mml-render-tui)
の HTTP API へ POST リクエストを送信します。

## 使い方

1. cmrt.exe を DAW モードで起動する
2. GitHub Pages にデプロイされた index.html を開く（または `bun run dev` でローカル確認）
3. textarea に `C` などのコード名を入力し、必要に応じて対象 track / meas を指定して「MML送信」ボタンを押す
4. ログ欄に POST リクエストの結果が表示される（`v11` など POST 不要な MML トークンを削除した場合も表示）
5. 指定した track / measure に MML が書き込まれる。track / meas の値は local storage に保存され、次回表示時に復帰される

## 開発

```sh
bun install
bun run dev     # 開発サーバー起動
bun run build   # ビルド
bun run test    # テスト実行
```

## API

`src/daw-client.ts` は Rust 版 daw-client-lib の TypeScript ポートです。
SSoT: https://github.com/cat2151/clap-mml-render-tui/blob/main/daw-client-lib/src/lib.rs

| メソッド | エンドポイント | 説明 |
|---|---|---|
| `postMml(track, measure, mml)` | `POST /mml` | MML を指定トラック・小節に書き込む |
| `postMixer(track, db)` | `POST /mixer` | ミキサーのボリュームを設定する |
| `postPatch(track, patch)` | `POST /patch` | パッチ（音色）を設定する |
| `getPatches()` | `GET /patches` | 利用可能なパッチ一覧を取得する |

デフォルト接続先: `http://127.0.0.1:62151`

## コード → MML 変換例

| コード入力 | 生成 MML |
|---|---|
| C | `'ceg'` |
| Am | `'ace'` |
| G7 | `'gbdf'` |

## GitHub Pages

`main` ブランチへの push 時に `.github/workflows/deploy.yml` が自動でビルド・デプロイします。
