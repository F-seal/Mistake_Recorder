import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "public", "app-icon.svg");
const outputDir = path.join(root, "public", "icons");
const svg = await readFile(sourcePath);

await mkdir(outputDir, { recursive: true });

const outputs = [
  { name: "pwa-192x192.png", size: 192 },
  { name: "pwa-512x512.png", size: 512 },
  { name: "maskable-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const output of outputs) {
  await sharp(svg)
    .resize(output.size, output.size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, output.name));
  console.log(`generated ${output.name}`);
}
