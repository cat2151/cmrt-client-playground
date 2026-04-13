/**
 * コード進行テキストをMMLに変換する
 *
 * chord2mml ライブラリを利用。自前実装はしない。
 * SSoT: https://github.com/cat2151/chord2mml
 *
 * 入力例: "C"   → 出力例: "'ceg'"
 * 入力例: "Am"  → 出力例: "'ace'"
 * 入力例: "G7"  → 出力例: "'gbdf'"
 */

import { parseChordViaLibrary } from "./loaders/chord2mml.ts";

function replaceHyphenToDot(s: string): string {
  return s.replace(/-/g, "・");
}

function replaceMinorRomanNumerals(s: string): string {
  return s
    .replace(/\bvii(?![a-zA-Z])/g, "VIIm")
    .replace(/\biii(?![a-zA-Z])/g, "IIIm")
    .replace(/\bvi(?![a-zA-Z])/g, "VIm")
    .replace(/\biv(?![a-zA-Z])/g, "IVm")
    .replace(/\bii(?![a-zA-Z])/g, "IIm")
    .replace(/\bv(?![a-zA-Z])/g, "Vm")
    .replace(/\bi(?![a-zA-Z])/g, "Im");
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permute(rest)) result.push([arr[i], ...p]);
  }
  return result;
}

function getAllCombinations<T>(funcs: T[]): T[][] {
  const results: T[][] = [];
  const n = funcs.length;
  for (let i = 0; i < 1 << n; i++) {
    const seq: T[] = [];
    for (let j = 0; j < n; j++) {
      if (i & (1 << j)) seq.push(funcs[j]);
    }
    if (seq.length === 0) {
      // no-op sequence: identity function placeholder
      results.push([] as T[]);
    } else {
      results.push(...permute(seq));
    }
  }
  return results;
}

/**
 * コード名をMML文字列に変換する（chord2mml ライブラリを利用）
 * 変換できない場合は null を返す
 */
export function chordToMml(chord: string): string | null {
  const trimmed = chord.trim();
  if (trimmed === "") return null;

  // コード記法の方言を正規化して chord2mml が解析できる形式を試す:
  //   - ハイフン (-) を中点 (・) に変換（例: Am-7 → Am・7）
  //   - 小文字ローマ数字マイナー表記を大文字+m に統一（例: vi → VIm）
  const transforms: Array<(s: string) => string> = [
    replaceHyphenToDot,
    replaceMinorRomanNumerals,
  ];
  const tried = new Set<string>();
  for (const seq of getAllCombinations(transforms)) {
    let candidate = trimmed;
    for (const fn of seq) candidate = fn(candidate);
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      return parseChordViaLibrary(candidate);
    } catch (_e) {
      // 次の候補を試す
    }
  }
  return null;
}
