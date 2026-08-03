const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targetFiles = [
  "server.js",
  "public/app.js",
  "public/index.html",
  "public/sw.js",
  "public/styles.css",
].map((file) => path.join(root, file));

const badCodePointPattern = /[\uFFFD\uF900-\uFAFF\u4E00-\u9FFF]/u;
const knownMojibakePattern = /\uD69E/u; // "횞", often left after an encoding-damaged close icon.

const allowedQuestionPatterns = [
  /\?\?/,
  /\?\./,
  /\?\(/,
  /\?\[/,
  /\?\s*:/,
  /=>/,
  /new RegExp/,
];

function lineHasSuspiciousQuestion(line) {
  if (!/[가-힣]\?|[?][가-힣]/u.test(line)) return false;
  if (allowedQuestionPatterns.some((pattern) => pattern.test(line))) return false;
  if (/confirm\(|\?`|\? "/u.test(line)) return false;
  return true;
}

const failures = [];

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (badCodePointPattern.test(line) || knownMojibakePattern.test(line) || lineHasSuspiciousQuestion(line)) {
      failures.push({
        file: path.relative(root, filePath).replaceAll("\\", "/"),
        line: index + 1,
        text: line.trim().slice(0, 220),
      });
    }
  });
}

if (failures.length) {
  console.error("Text integrity check failed. Possible mojibake was found:");
  failures.slice(0, 80).forEach((item) => {
    console.error(`${item.file}:${item.line}: ${item.text}`);
  });
  if (failures.length > 80) console.error(`...and ${failures.length - 80} more`);
  process.exit(1);
}

console.log("Text integrity check passed.");
