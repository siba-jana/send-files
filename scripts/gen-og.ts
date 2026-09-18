import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

/**
 * One-shot generator for public/og-image.jpg (1216x640, 32-multiple OG
 * ratio 1.9:1). Run: bun scripts/gen-og.ts — see DEPLOY.md §assets.
 * Note: the model returns JPEG bytes; the extension must stay .jpg.
 */
async function main() {
  const zai = await ZAI.create();
  const response = await zai.images.generations.create({
    prompt:
      "Social media share card for a file transfer web app. Two minimalist white browser windows facing each other on a clean off-white background, glowing rose-red heart between them, small paper documents flying from left browser to right browser along a dotted arc, soft rose-red accent color, subtle radial gradient glow, modern flat vector illustration style, generous whitespace, elegant and professional, large bold modern sans-serif text 'I Love Doc' centered near the bottom, high quality, detailed",
    size: "1216x640",
  });
  const base64 = response.data[0].base64;
  if (!base64) throw new Error("No image data in response");
  fs.writeFileSync(
    "/home/z/my-project/public/og-image.jpg",
    Buffer.from(base64, "base64"),
  );
  console.log("OK: wrote public/og-image.jpg");
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
