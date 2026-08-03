const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE_FILE = path.join(ROOT, "public", "app.js");
const OUT_DIR = path.join(ROOT, "src", "app");

const CHUNKS = [
  ["00-config-state-dom.js", 1, 211],
  ["10-api-core.js", 212, 899],
  ["20-chat-auth.js", 900, 1455],
  ["30-me-attendance-notes.js", 1456, 2129],
  ["40-orders-list-detail.js", 2130, 3346],
  ["50-settings-share.js", 3347, 3810],
  ["60-events-actions.js", 3811, 5517],
  ["70-photo-chat-upload.js", 5518, 5845],
  ["80-order-parser-forms.js", 5846, 6479],
  ["90-bootstrap-events.js", 6480, Infinity],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const source = fs.readFileSync(SOURCE_FILE, "utf8").replace(/^\uFEFF/, "");
const lines = source.split(/\r?\n/);

for (const [file, start, end] of CHUNKS) {
  const last = Number.isFinite(end) ? end : lines.length;
  const body = lines.slice(start - 1, last).join("\n").replace(/^\uFEFF/, "");
  fs.writeFileSync(path.join(OUT_DIR, file), `${body.replace(/\s+$/u, "")}\n`, "utf8");
}

console.log(`Split ${path.relative(ROOT, SOURCE_FILE)} into ${CHUNKS.length} source files.`);
