import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(repoRoot, "node_modules", "tonejs-mml-to-json");
const targetRoot = join(repoRoot, "public", "vendor", "tonejs-mml-to-json");

async function copyDirectory(relativePath) {
  const sourcePath = join(sourceRoot, relativePath);
  const targetPath = join(targetRoot, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(targetPath, { recursive: true, force: true });
  await cp(sourcePath, targetPath, {
    recursive: true,
    force: true,
  });
  console.log(`copied ${relativePath}`);
}

await copyDirectory("dist");
await copyDirectory("pkg");
