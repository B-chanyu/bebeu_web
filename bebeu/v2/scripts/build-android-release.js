const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android");
const propertiesPath = path.join(androidDir, "keystore.properties");

function parseProperties(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return separator < 0
          ? [line, ""]
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

if (!fs.existsSync(propertiesPath)) {
  console.error("android/keystore.properties 파일이 없습니다.");
  console.error("android/keystore.properties.example을 복사한 뒤 업로드 키 정보를 입력해주세요.");
  process.exit(1);
}

const properties = parseProperties(fs.readFileSync(propertiesPath, "utf8"));
const required = ["storeFile", "storePassword", "keyAlias", "keyPassword"];
const missing = required.filter((key) => !properties[key] || properties[key] === "CHANGE_ME");
if (missing.length) {
  console.error(`keystore.properties에 다음 값을 입력해주세요: ${missing.join(", ")}`);
  process.exit(1);
}

const storeFile = path.resolve(androidDir, properties.storeFile);
if (!fs.existsSync(storeFile)) {
  console.error(`업로드 키 파일을 찾을 수 없습니다: ${storeFile}`);
  process.exit(1);
}

const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const result = spawnSync(gradleCommand, ["bundleRelease", "--no-daemon"], {
  cwd: androidDir,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) process.exit(result.status || 1);

const bundlePath = path.join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");
console.log(`Play Store AAB 생성 완료: ${bundlePath}`);
