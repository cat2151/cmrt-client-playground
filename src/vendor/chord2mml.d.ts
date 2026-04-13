declare module "*/vendor/chord2mml.mjs" {
  interface Chord2Mml {
    parse(chord: string): string;
  }
  export const chord2mml: Chord2Mml;
}
