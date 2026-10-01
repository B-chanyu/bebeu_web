const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const keyDirectory = "D:\\bebeu-keys";
const keyPath = path.join(keyDirectory, "bebeu-upload.jks");
const propertiesPath = path.join(root, "android", "keystore.properties");
const secretDirectory = path.resolve(root, "..", "..", "release-secrets");
const backupPath = path.join(secretDirectory, "BEBEU-android-upload-key.txt");
const keytool = "D:\\Android\\jdk-21.0.12.1+1\\bin\\keytool.exe";

for (const target of [keyPath, propertiesPath, backupPath]) {
  if (fs.existsSync(target)) {
    console.error(`기존 파일이 있어 업로드 키를 덮어쓰지 않습니다: ${target}`);
    process.exit(1);
  }
}

if (!fs.existsSync(keytool)) {
  console.error(`keytool을 찾을 수 없습니다: ${keytool}`);
  process.exit(1);
}

fs.mkdirSync(keyDirectory, { recursive: true });
fs.mkdirSync(secretDirectory, { recursive: true });

const password = crypto.randomBytes(24).toString("hex");
const alias = "bebeu-upload";
const result = spawnSync(keytool, [
  "-genkeypair",
  "-v",
  "-keystore", keyPath,
  "-storetype", "PKCS12",
  "-storepass", password,
  "-alias", alias,
  "-keyalg", "RSA",
  "-keysize", "2048",
  "-validity", "10000",
  "-keypass", password,
  "-dname", "CN=BEBEU WORK, OU=BEBEU, O=BEBEU, L=Gwangju, ST=Gwangju, C=KR",
], { encoding: "utf8" });

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "업로드 키 생성에 실패했습니다.");
  process.exit(result.status || 1);
}

fs.writeFileSync(propertiesPath, [
  "storeFile=D:/bebeu-keys/bebeu-upload.jks",
  `storePassword=${password}`,
  `keyAlias=${alias}`,
  `keyPassword=${password}`,
  "",
].join("\n"), "utf8");

fs.writeFileSync(backupPath, [
  "BEBEU WORK Android 업로드 키 백업",
  "",
  `키 파일: ${keyPath}`,
  `별칭: ${alias}`,
  `키 저장소 비밀번호: ${password}`,
  `키 비밀번호: ${password}`,
  "",
  "이 파일과 키 파일을 서로 다른 안전한 저장 장치에 백업하세요.",
  "Git, 이메일, 메신저 또는 공개 클라우드에 올리지 마세요.",
  "",
].join("\n"), "utf8");

console.log(`업로드 키 생성 완료: ${keyPath}`);
console.log(`서명 설정 생성 완료: ${propertiesPath}`);
console.log(`비밀번호 백업 파일 생성 완료: ${backupPath}`);
