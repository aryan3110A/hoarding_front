const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

(async () => {
  try {
    const svgPath = path.resolve(__dirname, "..", "public", "shubham-logo.svg");
    const outPath = path.resolve(__dirname, "..", "public", "shubham-logo.png");

    if (!fs.existsSync(svgPath)) {
      console.error("SVG not found at", svgPath);
      process.exit(2);
    }

    const svgBuffer = fs.readFileSync(svgPath);

    // Render at 2x scale for crispness; adjust width/height as needed
    await sharp(svgBuffer)
      .resize({ width: 800 })
      .png({ quality: 90 })
      .toFile(outPath);

    console.log("Wrote PNG to", outPath);
  } catch (err) {
    console.error("Conversion failed:", err);
    process.exit(1);
  }
})();
