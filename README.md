# cmrt-client-playground

A simple web application. It converts chord names (e.g., C, Am, G7) into MML and sends a POST request to the HTTP API of [cmrt (clap-mml-render-tui)](https://github.com/cat2151/clap-mml-render-tui) running locally.

## Usage

1. Start cmrt.exe in DAW mode.
2. Open index.html deployed on GitHub Pages (or check locally with `bun run dev`).
3. Enter chord names like `C` in the textarea and press the "Send MML" button.
4. The result of the POST request will be displayed in the log area.
5. MML will be written to track 1 / measure 1 of cmrt.

## Development

```sh
bun install
bun run dev     # 開発サーバー起動
bun run build   # ビルド
bun run test    # テスト実行
```

## API

`src/daw-client.ts` is a TypeScript port of the Rust version of daw-client-lib.
SSoT: https://github.com/cat2151/clap-mml-render-tui/blob/main/daw-client-lib/src/lib.rs

| Method | Endpoint | Description |
|---|---|---|
| `getMml(track, measure)` | `GET /mml?track={track}&measure={measure}` | Get MML for the specified track and measure |
| `postMml(track, measure, mml)` | `POST /mml` | Write MML to the specified track and measure |
| `postMixer(track, db)` | `POST /mixer` | Set mixer volume |
| `postPatch(track, patch)` | `POST /patch` | Set patch (instrument sound) |
| `postRandomPatch(track)` | `POST /patch/random` | Randomly set the instrument sound for the specified track |
| `getPatches()` | `GET /patches` | Get a list of available patches |

Default connection target: `http://127.0.0.1:62151`