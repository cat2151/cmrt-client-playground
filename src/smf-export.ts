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

function isNodeRuntime(): boolean {
  const runtimeProcess = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return runtimeProcess?.versions?.node !== undefined;
}

function getNodeCwd(): string {
  const runtimeProcess = (globalThis as { process?: { cwd(): string } }).process;
  if (runtimeProcess === undefined) {
    throw new Error("Node.js process is unavailable");
  }
  return runtimeProcess.cwd();
}

function toFileDirectoryHref(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/").replace(/^\/*([A-Za-z]:)/, "/$1");
  return new URL(`file://${normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`}`).href;
}

function getSmfAssetBaseUri(): string {
  const runtimeDocument = (globalThis as { document?: { baseURI?: string } }).document;
  if (runtimeDocument?.baseURI !== undefined) {
    return runtimeDocument.baseURI;
  }
  if (isNodeRuntime()) {
    return toFileDirectoryHref(`${getNodeCwd()}\\public\\`);
  }
  throw new Error("SMF asset base URI could not be resolved");
}

function resolveSmfAssetUrl(path: string): URL {
  return new URL(`${MMLABC_TO_SMF_ASSET_ROOT}/${path}`, getSmfAssetBaseUri());
}

function resolveSmfAssetHref(path: string): string {
  return resolveSmfAssetUrl(path).href;
}

function resolveSmfAssetFilePath(path: string): string {
  const { pathname } = resolveSmfAssetUrl(path);
  const decodedPath = decodeURIComponent(pathname);
  if (/^\/[A-Za-z]:\//.test(decodedPath)) {
    return decodedPath.slice(1).replace(/\//g, "\\");
  }
  return decodedPath;
}

async function readNodeBinaryAsset(path: string): Promise<Uint8Array> {
  const moduleSpecifier = "node:fs/promises";
  const { readFile } = (await import(
    /* @vite-ignore */ moduleSpecifier
  )) as { readFile(path: string): Promise<Uint8Array> };
  return new Uint8Array(await readFile(resolveSmfAssetFilePath(path)));
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
          /* @vite-ignore */ resolveSmfAssetHref("demo/web-tree-sitter.js")
        ) as Promise<TreeSitterModule>,
        import(
          /* @vite-ignore */ resolveSmfAssetHref(
            "mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm.js"
          )
        ) as Promise<MmlabcToSmfWasmModule>,
      ]);

      const { Parser, Language } = treeSitterModule;
      await Parser.init({
        locateFile: (filename: string) => resolveSmfAssetHref(`demo/${filename}`),
      });

      const parser = new Parser();
      const language = await Language.load(
        isNodeRuntime()
          ? resolveSmfAssetFilePath("tree-sitter-mml/tree-sitter-mml.wasm")
          : resolveSmfAssetHref("tree-sitter-mml/tree-sitter-mml.wasm")
      );
      parser.setLanguage(language);

      await wasmModule.default(
        isNodeRuntime()
          ? await readNodeBinaryAsset("mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm_bg.wasm")
          : resolveSmfAssetHref("mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm_bg.wasm")
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
