// scripts/make-stubs.mjs
// Usage: node scripts/make-stubs.mjs src/store/scaleAtoms.ts src/core/audio.ts ...
// For each OLD path (file must already be moved to packages/fretboard/src/<same-rel-path>),
// writes a stub at the old path re-exporting from @fretflow/fretboard.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

for (const oldPath of process.argv.slice(2)) {
  const rel = oldPath.replace(/^src\//, "").replace(/\.(ts|tsx)$/, "");
  const newPathTs = `packages/fretboard/src/${rel}.ts`;
  const newPathTsx = `packages/fretboard/src/${rel}.tsx`;
  const newPath = existsSync(newPathTs) ? newPathTs : newPathTsx;
  if (!existsSync(newPath)) {
    console.error(`SKIP (not found in package): ${oldPath}`);
    process.exitCode = 1;
    continue;
  }
  const source = readFileSync(newPath, "utf-8");
  const hasDefault = /export\s+default\s/.test(source);
  const spec = `@fretflow/fretboard/${rel}`;
  let stub = `// Re-export stub: implementation moved to ${spec}\nexport * from "${spec}";\n`;
  if (hasDefault) stub += `export { default } from "${spec}";\n`;
  writeFileSync(oldPath, stub);
  console.log(`stub: ${oldPath} -> ${spec}`);
}
