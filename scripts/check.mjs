import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse } from "acorn";
async function list(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? list(directory + "/" + entry.name)
        : [directory + "/" + entry.name],
    ),
  );
  return children.flat();
}
const files = (
  await Promise.all(["src", "server", "shared", "scripts", "tests"].map(list))
)
  .flat()
  .filter((file) => /\.m?js$/.test(file));
for (const filename of files) {
  const result = spawnSync(process.execPath, ["--check", filename], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(1);
  }
}
const original = (await readFile("docs/design/original.html", "utf8")).match(
  /<script[^>]*>([\s\S]*?)<\/script>/,
)[1];
const originalFunctions = parse(original, { ecmaVersion: "latest" })
  .body.filter((node) => node.type === "FunctionDeclaration")
  .map((node) => node.id.name);
const migrated = new Set();
for (const filename of files.filter((file) => file.startsWith("src/"))) {
  const source = await readFile(filename, "utf8");
  for (const node of parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  }).body) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration"
    )
      migrated.add(node.declaration.id.name);
    for (const specifier of node.specifiers || [])
      if (specifier.exported?.name) migrated.add(specifier.exported.name);
  }
}
const missing = originalFunctions.filter((name) => !migrated.has(name));
if (missing.length) {
  console.error("Missing original functions:", missing);
  process.exit(1);
}
console.log(
  "Syntax checks passed for " +
    files.length +
    " files. All " +
    originalFunctions.length +
    " original functions retained.",
);
