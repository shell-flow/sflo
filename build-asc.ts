import { readdir, stat } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { $ } from "bun";

const AS_DIR = "assembly";
const OUT_DIR = "wasm";

await $`rm -rf ${OUT_DIR} && mkdir -p ${OUT_DIR}`;

async function buildModule(input: string, outputName: string) {
  const outPath = join(OUT_DIR, outputName);
  console.log(`📦 Compilando: ${input} -> ${outPath}.js`);
  
  await $`bun x asc ${input} --target release --bindings esm --outFile ${outPath}.wasm`;
}

const entries = await readdir(AS_DIR, { withFileTypes: true });

for (const entry of entries) {
  const fullPath = join(AS_DIR, entry.name);
  
  if (entry.isDirectory()) {
    const indexPath = join(fullPath, "index.ts");
    try {
      await stat(indexPath);
      await buildModule(indexPath, entry.name);
    } catch {
      console.warn(`⚠️ Pasta ${entry.name} ignorada (sem index.ts)`);
    }
  } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
    const nameWithoutExt = entry.name.replace(/\.ts$/, "");
    if (nameWithoutExt !== "index" || entry.name === "index.ts") {
      await buildModule(fullPath, nameWithoutExt);
    }
  }
}

console.log("✅ Build finalizado!");
