const fs = require("fs");
const path = require("path");

const platform = String(process.argv[2] || "").toLowerCase();
const roots = {
  android: path.join(__dirname, "..", "android", "app", "src", "main", "assets", "public", "downloads"),
  ios: path.join(__dirname, "..", "ios", "App", "App", "public", "downloads"),
};

const target = roots[platform];
if (!target) {
  throw new Error("Usage: node scripts/prune-native-downloads.js <android|ios>");
}

fs.rmSync(target, { recursive: true, force: true });
console.log(`Removed native download artifacts from ${platform}.`);
