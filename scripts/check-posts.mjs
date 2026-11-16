#!/usr/bin/env node
/* Fails the build if any post names something that must not leave the
   building. The sync script applies the same list to notes it imports;
   this covers posts written or expanded by hand. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = path.join(ROOT, "src/content/posts");
const INTERNAL = [/\bmvue\w*/i, /\bcalfus\b/i];

let failures = 0;
for (const file of fs.readdirSync(POSTS)) {
  if (!file.endsWith(".md")) continue;
  const lines = fs.readFileSync(path.join(POSTS, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const re of INTERNAL) {
      const hit = re.exec(line);
      if (hit) {
        failures += 1;
        console.error(`${file}:${i + 1}: mentions "${hit[0]}"`);
      }
    }
  });
}
if (failures) {
  console.error(`\n${failures} internal name${failures === 1 ? "" : "s"} found; remove before publishing`);
  process.exit(1);
}
console.log("posts: no internal names");
