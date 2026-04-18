import { chordToMml } from "./chord-to-mml.ts";

const MMLABC_TO_SMF_ASSET_ROOT = "vendor/mmlabc-to-smf-rust";

export const SMF_EXPORT_FILENAME = "chord-progression.mid";

export interface SmfConverter {
  convertMmlToSmf(mml: string): Promise<Uint8Array>;
}

export type SmfExportResult =
  | {
      ok: true;
      mml: string;
      smfData: Uint8Array;
    }
  | {
      ok: false;
      message: string;
      chordAnalysisMessage?: string;
    };

interface TreeSitterNode {
  type: string;
  startIndex: number;
  endIndex: number;
  childCount: number;
  child(index: number): TreeSitterNode | null;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
  delete?(): void;
}

interface TreeSitterParser {
  parse(source: string): TreeSitterTree;
  setLanguage(language: unknown): void;
}

interface TreeSitterModule {
  Parser: {
    init(options?: unknown): Promise<void>;
    new (): TreeSitterParser;
  };
  Language: {
    load(url: string): Promise<unknown>;
  };
}

interface MmlabcToSmfWasmModule {
  default(input?: string | URL | Request | WebAssembly.Module): Promise<unknown>;
  parse_tree_json_to_smf(parseTreeJson: string, mmlSource: string): Uint8Array;
}

interface InitializedMmlabcToSmf {
  parser: TreeSitterParser;
  wasm: MmlabcToSmfWasmModule;
}

interface ParseTreeJsonNode {
  type: string;
  text: string;
  children?: ParseTreeJsonNode[];
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error && error.message !== ""
    ? error.message
    : String(error);
}

function resolveSmfAssetUrl(path: string): string {
  return new URL(`${MMLABC_TO_SMF_ASSET_ROOT}/${path}`, document.baseURI).href;
}

function treeToJSON(node: TreeSitterNode, source: string): ParseTreeJsonNode {
  const result: ParseTreeJsonNode = {
    type: node.type,
    text: source.substring(node.startIndex, node.endIndex),
  };

  if (node.childCount > 0) {
    result.children = [];
    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index);
      if (child !== null) {
        result.children.push(treeToJSON(child, source));
      }
    }
  }

  return result;
}

export function createMmlabcToSmfConverter(): SmfConverter {
  let initPromise: Promise<InitializedMmlabcToSmf> | null = null;

  async function initialize(): Promise<InitializedMmlabcToSmf> {
    if (initPromise !== null) {
      return initPromise;
    }

    initPromise = (async () => {
      const [treeSitterModule, wasmModule] = await Promise.all([
        import(
          /* @vite-ignore */ resolveSmfAssetUrl("demo/web-tree-sitter.js")
        ) as Promise<TreeSitterModule>,
        import(
          /* @vite-ignore */ resolveSmfAssetUrl(
            "mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm.js"
          )
        ) as Promise<MmlabcToSmfWasmModule>,
      ]);

      const { Parser, Language } = treeSitterModule;
      await Parser.init({
        locateFile: (filename: string) => resolveSmfAssetUrl(`demo/${filename}`),
      });

      const parser = new Parser();
      const language = await Language.load(
        resolveSmfAssetUrl("tree-sitter-mml/tree-sitter-mml.wasm")
      );
      parser.setLanguage(language);

      await wasmModule.default(
        resolveSmfAssetUrl("mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm_bg.wasm")
      );

      return { parser, wasm: wasmModule };
    })().catch((error: unknown) => {
      initPromise = null;
      throw error;
    });

    return initPromise;
  }

  return {
    async convertMmlToSmf(mml: string): Promise<Uint8Array> {
      const { parser, wasm } = await initialize();
      const tree = parser.parse(mml);
      try {
        const parseTreeJson = JSON.stringify(treeToJSON(tree.rootNode, mml));
        return wasm.parse_tree_json_to_smf(parseTreeJson, mml);
      } finally {
        tree.delete?.();
      }
    },
  };
}

export async function convertChordProgressionToSmf(
  input: string,
  converter: SmfConverter
): Promise<SmfExportResult> {
  const trimmedInput = input.trim();
  if (trimmedInput === "") {
    return { ok: false, message: "入力が空です" };
  }

  const mml = chordToMml(trimmedInput);
  if (mml === null) {
    const message = `コードを認識できませんでした: "${trimmedInput}"`;
    return {
      ok: false,
      message,
      chordAnalysisMessage: message,
    };
  }

  try {
    const smfData = await converter.convertMmlToSmf(mml);
    return { ok: true, mml, smfData };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `SMF変換に失敗しました: ${formatUnknownError(error)}`,
    };
  }
}
