# cmrt-client-playground

シンプルなWebアプリ。コード名（例: C, Am, G7）を入力すると MML に変換し、
ローカルで起動中の [cmrt (clap-mml-render-tui)](https://github.com/cat2151/clap-mml-render-tui)
の HTTP API へ POST リクエストを送信します。

## 使い方

1. cmrt.exe を DAW モードで起動する
2. GitHub Pages にデプロイされた index.html を開く（または `bun run dev` でローカル確認）
3. textarea に `C` などのコード名を入力して「MML送信」ボタンを押す
4. ログ欄に POST リクエストの結果が表示される
5. cmrt の track 1 / measure 1 に MML が書き込まれる

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
