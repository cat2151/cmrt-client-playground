// chord2mml ライブラリのベンダリング済み ESM を呼び出す薄いラッパー。
//
// ✅ cat2151 ライブラリ「常に main 最新版を利用すること」ポリシーについて
// このファイルが参照している ../vendor/chord2mml.mjs は、
//   https://github.com/cat2151/chord2mml
// の main ブランチから生成された「ベンダリング済み（バンドル済み）」ESM です。
//
// 「最新版を常に利用する」ため、../vendor/chord2mml.mjs は
// .github/workflows/sync-vendor.yml により定期的に自動更新されます。
import { chord2mml } from "../vendor/chord2mml.mjs";

export function parseChordViaLibrary(chord: string): string {
  return chord2mml.parse(chord) as string;
}
