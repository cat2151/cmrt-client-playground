import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = join(repoRoot, "public", "vendor", "mmlabc-to-smf-rust");
const sourceBase = "https://cat2151.github.io/mmlabc-to-smf-rust";

const assets = [
  {
    source: "mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm.js",
    target: "mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm.js",
  },
  {
    source: "mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm_bg.wasm",
    target: "mmlabc-to-smf-wasm/pkg/mmlabc_to_smf_wasm_bg.wasm",
  },
  {
    source: "tree-sitter-mml/tree-sitter-mml.wasm",
    target: "tree-sitter-mml/tree-sitter-mml.wasm",
  },
  {
    source: "demo/web-tree-sitter.js",
    target: "demo/web-tree-sitter.js",
  },
  {
    source: "demo/web-tree-sitter.wasm",
    target: "demo/web-tree-sitter.wasm",
  },
];

async function fileExists(path) {
  try {
    const stats = await stat(path);
    return stats.isFile() && stats.size > 0;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function allAssetsExist() {
  for (const asset of assets) {
    if (!(await fileExists(join(assetRoot, asset.target)))) {
      return false;
    }
  }
  return true;
}

async function fetchAsset(asset) {
  const sourceUrl = `${sourceBase}/${asset.source}`;
  const targetPath = join(assetRoot, asset.target);
  const response = await fetch(sourceUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${sourceUrl}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);
  console.log(`fetched ${asset.target} (${bytes.byteLength} bytes)`);
}

if (process.argv.includes("--if-missing") && (await allAssetsExist())) {
  console.log("mmlabc-to-smf-rust browser assets already exist");
} else {
  for (const asset of assets) {
    await fetchAsset(asset);
  }
}
