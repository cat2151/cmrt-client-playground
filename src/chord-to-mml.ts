/**
 * chord-to-mml – コード名をMML文字列に変換する
 *
 * 入力例: "C"   → 出力例: "'ceg'"
 * 入力例: "Am"  → 出力例: "'ace'"
 * 入力例: "G7"  → 出力例: "'gbdf'"
 *
 * MMLの和音表記: シングルクォートで囲まれた複数音符が同時発音
 */

/** 音名 → 半音数 (C=0) */
const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** 半音数 → MML音名 */
const SEMITONE_TO_MML: Record<number, string> = {
  0: "c",
  1: "c+",
  2: "d",
  3: "d+",
  4: "e",
  5: "f",
  6: "f+",
  7: "g",
  8: "g+",
  9: "a",
  10: "a+",
  11: "b",
};

/** 根音の半音数を解析する (例: "C" → 0, "F#" → 6, "Bb" → 10) */
function parseRoot(chord: string): { root: number; rest: string } | null {
  if (chord.length === 0) return null;
  const letter = chord[0].toUpperCase();
  const semitone = NOTE_SEMITONES[letter];
  if (semitone === undefined) return null;
  let offset = 0;
  let pos = 1;
  if (pos < chord.length) {
    if (chord[pos] === "#" || chord[pos] === "+") {
      offset = 1;
      pos++;
    } else if (chord[pos] === "b") {
      offset = -1;
      pos++;
    }
  }
  return { root: ((semitone + offset) + 12) % 12, rest: chord.slice(pos) };
}

/** コード種別から構成音の半音インターバル配列を返す */
function chordIntervals(qualifier: string): number[] | null {
  const q = qualifier.trim();
  if (q === "" || q === "M" || q === "maj") {
    // メジャートライアド
    return [0, 4, 7];
  }
  if (q === "m" || q === "min") {
    // マイナートライアド
    return [0, 3, 7];
  }
  if (q === "7") {
    // ドミナント7th
    return [0, 4, 7, 10];
  }
  if (q === "m7") {
    // マイナー7th
    return [0, 3, 7, 10];
  }
  if (q === "maj7" || q === "M7") {
    // メジャー7th
    return [0, 4, 7, 11];
  }
  if (q === "dim" || q === "°") {
    // ディミニッシュ
    return [0, 3, 6];
  }
  if (q === "aug" || q === "+") {
    // オーギュメント
    return [0, 4, 8];
  }
  if (q === "sus4") {
    return [0, 5, 7];
  }
  if (q === "sus2") {
    return [0, 2, 7];
  }
  return null;
}

/**
 * コード名をMML和音文字列に変換する
 * 変換できない場合は null を返す
 */
export function chordToMml(chord: string): string | null {
  const trimmed = chord.trim();
  if (trimmed === "") return null;

  const parsed = parseRoot(trimmed);
  if (parsed === null) return null;

  const intervals = chordIntervals(parsed.rest);
  if (intervals === null) return null;

  const notes = intervals.map((interval) => {
    const semitone = (parsed.root + interval) % 12;
    return SEMITONE_TO_MML[semitone];
  });

  return `'${notes.join("")}'`;
}
