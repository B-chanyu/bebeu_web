const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { execFileSync } = require("child_process");
const { createHash, randomUUID } = require("crypto");
const iconv = require("iconv-lite");

let sharp = null;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

let mysql2 = null;
try {
  mysql2 = require("mysql2/promise");
} catch {
  mysql2 = null;
}

let webPush = null;
try {
  webPush = require("web-push");
} catch {
  webPush = null;
}
let playwrightChromium = null;
try {
  ({ chromium: playwrightChromium } = require("playwright"));
} catch {
  playwrightChromium = null;
}

const PORT = Number(process.env.PORT || 3000);
const APP_ROOT = path.basename(path.dirname(__dirname)).toLowerCase() === "bebeu" && /^v\d+$/i.test(path.basename(__dirname))
  ? path.dirname(path.dirname(__dirname))
  : __dirname;
const PHOTO_ROOT = process.env.PHOTO_ROOT || path.join(APP_ROOT, "bebeu_image");
const CHAT_PHOTO_ROOT = path.join(PHOTO_ROOT, "bebeu_chat");
const PUBLIC_DIR = path.join(__dirname, "public");
const LOG_DIR = process.env.LOG_DIR || path.join(APP_ROOT, "logs");
const VAPID_FILE = path.join(APP_ROOT, "push-vapid.json");
const PHOTO_STEP_LIMIT = 9;
const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = process.env.MYSQL_PORT || "3306";
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "bebeu";
const MYSQL_EXE = process.env.MYSQL_EXE || findMysqlExe();
const DEFAULT_MEMBER_PASSWORD = process.env.DEFAULT_MEMBER_PASSWORD || "0701";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_MEMBER_PASSWORD;
const NAVER_CAFE_API_BASE = "https://openapi.naver.com/v1/cafe";
const NAVER_AUTH_BASE = "https://nid.naver.com/oauth2.0";
const NAVER_DEFAULT_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_DEFAULT_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const NAVER_DEFAULT_CAFE_CLUB_ID = process.env.NAVER_CAFE_CLUB_ID || "";
const NAVER_DEFAULT_CAFE_MENU_ID = process.env.NAVER_CAFE_MENU_ID || "";
const NAVER_CAFE_MAX_ATTACHMENTS = Math.max(1, Number(process.env.NAVER_CAFE_MAX_ATTACHMENTS || 20));
const NAVER_CAFE_RETRY_ATTACHMENTS = Math.max(1, Number(process.env.NAVER_CAFE_RETRY_ATTACHMENTS || 5));
const NAVER_CAFE_IMAGE_MAX_WIDTH = Math.max(800, Number(process.env.NAVER_CAFE_IMAGE_MAX_WIDTH || 1600));
const NAVER_CAFE_AUTOMATION_PROFILE = process.env.NAVER_CAFE_AUTOMATION_PROFILE || path.join(APP_ROOT, "naver-cafe-browser");
const NAVER_CAFE_AUTOMATION_HEADLESS = /^(1|true|yes)$/i.test(String(process.env.NAVER_CAFE_AUTOMATION_HEADLESS || ""));
const NAVER_CAFE_ENCODING_MODES = new Set(["utf8-percent", "url-utf8", "url-cp949", "url-cp949-raw", "multipart-utf8", "multipart-cp949"]);
const BEBEU_STORE_ADDRESS = "전남광주 광산구 첨단내촌로57번길 6 1층";
const BEBEU_NAVER_MAP_URL = "https://map.naver.com/p/search/%EC%A0%84%EB%82%A8%EA%B4%91%EC%A3%BC%20%EA%B4%91%EC%82%B0%EA%B5%AC%20%EC%B2%A8%EB%8B%A8%EB%82%B4%EC%B4%8C%EB%A1%9C57%EB%B2%88%EA%B8%B8%206%201%EC%B8%B5";
const BEBEU_NAVER_PLACE_URL = "https://map.naver.com/p/entry/place/2065853195?c=15.00,0,0,0,dh&placePath=%2Fhome%3Ffrom%3Dmap%26fromPanelNum%3D1%26additionalHeight%3D76%26timestamp%3D202607160120%26locale%3Dko%26svcName%3Dmap_pcv5";
const BEBEU_NAVER_PLACE_QUERY = "베베유 전남광주 광산구 첨단내촌로57번길 6";
const UPLOAD_LIMIT_BYTES = Number(process.env.UPLOAD_LIMIT_MB || 600) * 1024 * 1024;
const APP_ALLOWED_ORIGINS = new Set(
  String(process.env.APP_ALLOWED_ORIGINS || "https://localhost,capacitor://localhost")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
let vapidKeys = null;
let mariaDbColumnsReady = false;
let mariaDbColumnsPromise = null;
let serverLogsTableReady = false;
let serverLogPersisting = false;
let dbCache = null;
const photoPathCache = new Map();
const mysqlPools = new Map();
let naverCafeAutomationContext = null;

class AppError extends Error {
  constructor(status, message, cause = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.cause = cause;
  }
}

function logInfo(message, details = "") {
  writeLog("INFO", message, details);
}

function logWarning(message, details = "") {
  writeLog("WARNING", message, details);
}

function logError(message, error, details = "") {
  const line = formatLogLine("ERROR", message, details);
  console.error(line);
  writeLogLine(line);
  writeDbLog("ERROR", message, details, line);
  if (error?.stack) {
    console.error(error.stack);
    writeLogLine(error.stack);
    writeDbLog("ERROR", `${message} stack`, error.stack, formatLogLine("ERROR", `${message} stack`, error.stack));
  } else if (error) {
    console.error(error);
    const value = formatLogValue(error);
    writeLogLine(value);
    writeDbLog("ERROR", `${message} detail`, value, formatLogLine("ERROR", `${message} detail`, value));
  }
}

function writeLog(level, message, details = "") {
  const line = formatLogLine(level, message, details);
  if (level === "ERROR") console.error(line);
  else console.log(line);
  writeLogLine(line);
  writeDbLog(level, message, details, line);
}

function formatLogLine(level, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  return `[${level}] [${logDateTime()}] ${message}${suffix}`;
}

function logDateName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function logDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}-${mm}-${ss}`;
}

function formatLogValue(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function writeLogLine(line) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const filePath = path.join(LOG_DIR, `bebeu-${logDateName()}.log`);
    fs.appendFileSync(filePath, `${line}\n`, "utf8");
  } catch (error) {
    console.error(formatLogLine("ERROR", "Log file write failed", error.message || error));
  }
}

function writeDbLog(level, message, details = "", line = "") {
  if (serverLogPersisting) return;
  setTimeout(() => {
    persistDbLog(level, message, details, line).catch((error) => {
      console.error(formatLogLine("ERROR", "DB log write failed", error.message || error));
    });
  }, 0);
}

async function persistDbLog(level, message, details = "", line = "") {
  if ((!mysql2 && !MYSQL_EXE) || serverLogPersisting) return;
  serverLogPersisting = true;
  try {
    await ensureServerLogsTableQuiet();
    const id = randomUUID();
    const createdAt = sqlDate(new Date().toISOString());
    const statement = `INSERT INTO server_logs (server_logs_idx,server_logs_level,server_logs_message,server_logs_details,server_logs_line,server_logs_created_at) VALUES (${sql(id)},${sql(level)},${sql(message)},${sql(details)},${sql(line)},${createdAt})`;
    await execLogSqlQuiet(statement);
  } finally {
    serverLogPersisting = false;
  }
}

async function ensureServerLogsTableQuiet() {
  if (serverLogsTableReady) return;
  await execLogSqlQuiet(`CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE} DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`, null);
  await execLogSqlQuiet(`
    CREATE TABLE IF NOT EXISTS server_logs (
      server_logs_idx VARCHAR(64) NOT NULL,
      server_logs_level VARCHAR(20) NOT NULL,
      server_logs_message VARCHAR(500) NOT NULL,
      server_logs_details LONGTEXT NULL,
      server_logs_line LONGTEXT NOT NULL,
      server_logs_created_at DATETIME NOT NULL,
      PRIMARY KEY (server_logs_idx),
      KEY idx_server_logs_created_at (server_logs_created_at),
      KEY idx_server_logs_level_created_at (server_logs_level, server_logs_created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  serverLogsTableReady = true;
}

async function execLogSqlQuiet(statement, database = MYSQL_DATABASE) {
  const pool = mysqlPool(database);
  if (pool) {
    await pool.query(statement);
    return;
  }
  execFileSync(MYSQL_EXE, mysqlArgs(database), {
    encoding: "utf8",
    input: statement,
    maxBuffer: 5 * 1024 * 1024,
  });
}

function errorRequestId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + randomUUID().slice(0, 8);
}

function publicErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || error?.errno || "");
  if (error instanceof AppError) return message;
  if (code === "LIMIT_FILE_SIZE" || code === "ERR_UPLOAD_TOO_LARGE" || /too large|payload too large|request entity too large/i.test(message)) {
    return "업로드 용량이 너무 큽니다. 사진을 나누어 올리거나 일부 동영상/원본 사진을 줄여주세요.";
  }
  if (code === "ENOSPC") return "저장 공간이 부족해서 사진을 저장하지 못했습니다.";
  if (code === "EACCES" || code === "EPERM") return "사진 저장 폴더 권한 문제로 저장하지 못했습니다.";
  if (code === "ER_NET_PACKET_TOO_LARGE" || /max_allowed_packet|packet.*large/i.test(message)) {
    return "DB가 한 번에 받을 수 있는 용량을 초과했습니다. 사진을 나누어 올리거나 DB 설정을 조정해야 합니다.";
  }
  if (code === "ENAMETOOLONG") return "서버 명령 길이 제한을 초과했습니다. DB 직접 연결 설치가 필요합니다.";
  if (/MariaDB|mysql/i.test(message)) return `DB 저장 중 오류가 발생했습니다. ${message}`;
  return message || "서버 오류가 발생했습니다.";
}

function isClientAbortError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || error?.errno || "");
  return code === "ECONNRESET" || code === "ERR_STREAM_PREMATURE_CLOSE" || /aborted|premature close|socket hang up/i.test(message);
}

function sendErrorJson(req, res, error, context = "") {
  if (isClientAbortError(error) || req.aborted || res.destroyed) {
    const size = req.headers["content-length"] ? `contentLength=${req.headers["content-length"]}` : "";
    logWarning("Request aborted by client", [req.method, req.url, context, size].filter(Boolean).join(" "));
    if (!res.destroyed && !res.headersSent) {
      try {
        res.writeHead(499);
        res.end();
      } catch {}
    }
    return;
  }
  const requestId = errorRequestId();
  const status = error instanceof AppError ? error.status : 500;
  const detail = publicErrorMessage(error);
  const size = req.headers["content-length"] ? `contentLength=${req.headers["content-length"]}` : "";
  logError(`Request failed id=${requestId}`, error, [req.method, req.url, context, size].filter(Boolean).join(" "));
  if (!res.headersSent) {
    sendJson(res, status, {
      error: detail,
      requestId,
      detail: `오류번호 ${requestId}: ${detail}`,
    });
  }
}

function applyAppCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (!APP_ALLOWED_ORIGINS.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-User-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

function invalidateDbCache() {
  dbCache = null;
  photoPathCache.clear();
}

function ensureVapidKeys() {
  if (vapidKeys) return vapidKeys;
  if (!webPush) return null;
  try {
    if (fs.existsSync(VAPID_FILE)) {
      vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
    }
  } catch (error) {
    logWarning("VAPID key read failed", error.message || error);
  }
  if (!vapidKeys?.publicKey || !vapidKeys?.privateKey) {
    vapidKeys = webPush.generateVAPIDKeys();
    try {
      fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), "utf8");
    } catch (error) {
      logWarning("VAPID key save failed", error.message || error);
    }
  }
  webPush.setVapidDetails("mailto:admin@bebeu.local", vapidKeys.publicKey, vapidKeys.privateKey);
  return vapidKeys;
}

function pushEndpointId(endpoint) {
  return createHash("sha256").update(String(endpoint || "")).digest("hex");
}

const steps = [
  { code: "01", name: "접수" },
  { code: "02", name: "라벨링" },
  { code: "03", name: "전사진" },
  { code: "04", name: "탈거" },
  { code: "05", name: "세탁" },
  { code: "06", name: "조립" },
  { code: "07", name: "검수" },
  { code: "08", name: "후사진" },
  { code: "09", name: "살균" },
  { code: "10", name: "배송" },
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
};

function ensureStorage() {
  if (!mysql2 && !MYSQL_EXE) {
    throw new Error("MariaDB 클라이언트(mysql.exe)를 찾을 수 없습니다. MYSQL_EXE 환경변수를 설정해주세요.");
  }
  fs.mkdirSync(PHOTO_ROOT, { recursive: true });
}

function createSeedDb() {
  const now = new Date().toISOString();
  return {
    users: [
      { id: "admin-sunmi", name: "선미", role: "관리자", branch: "본점", clockedIn: true, clockInAt: now },
      { id: "admin-taeyu", name: "태유", role: "관리자", branch: "본점", clockedIn: false, clockInAt: null },
      { id: "staff-seunghyeok", name: "승혁", role: "직원", branch: "본점", clockedIn: false, clockInAt: null },
      { id: "staff-yunju", name: "윤주", role: "직원", branch: "본점", clockedIn: false, clockInAt: null },
      { id: "staff-danbi", name: "단비", role: "직원", branch: "본점", clockedIn: false, clockInAt: null },
      { id: "staff-chanyu", name: "찬유", role: "직원", branch: "본점", clockedIn: false, clockInAt: null },
    ],
    activeUserId: "admin-sunmi",
    adminMemos: defaultMemos(),
    attendance: [],
    requests: [],
    orders: [],
    logs: [],
    chatMessages: [],
    appSettings: {},
  };
}

function defaultNaverCafeSettings() {
  return {
    enabled: true,
    clientId: NAVER_DEFAULT_CLIENT_ID,
    clientSecret: NAVER_DEFAULT_CLIENT_SECRET,
    clubId: NAVER_DEFAULT_CAFE_CLUB_ID,
    menuId: NAVER_DEFAULT_CAFE_MENU_ID,
    accessToken: "",
    refreshToken: "",
    tokenExpiresAt: null,
    oauthState: "",
    titleTemplate: "광주 {productName} 세탁 베베유",
    contentTemplate: "24시간 오픈 / 광주 무료수거배달 / 매장방문 10% 상시할인",
    includePhotos: "all",
    encodingMode: "utf8-percent",
  };
}

const NAVER_CAFE_FOOTER_TEXT = `❤️‍ 베베유 케어 과정 / 철저한 위생 관리

세탁 전 오염도 체크 / 전체분해 / 저자극 아기세제 개별세탁 /

프레임 고압세척 및 스팀 / 자연 제습 원적외선 건조 /

건조 후 프레임 틀 디테일링 및 실링

UV살균 / 소독수 / 피톤치드 / 마지막 점검 후 배송


❤️‍ 올바른 케어 방식을 참고해주세요 :)


* 폼이 두꺼운 아기 용품 특성상 겉면만 세탁하는것이 아닌

깊게 스며든 오염물까지 고압수를 통해 확실하게 케어합니다.

표면 도포 방식은 세탁이 불가한 소파나 매트리스 위주 케어입니다 겉면의 오염물만 제거하는것은 추후 악취의 원인이 될 수 있습니다.


* 청결한 공간에서 케어를 진행합니다


* 5~6일 동안 보관 및 세탁 건조되는 공간의 위생상태는 정말 중요합니다


* 천연 세제와 검증받은 저자극 아기세제를 사용합니다.


* 24시간 오픈 매장으로 언제든 자유롭게 방문 및 픽업 가능합니다


* 보여주기 형식의 전체과정 사진 촬영보다 믿고 맡길수 있는

장소를 직접 보여드리고 오픈된 공간에서 청결하게 진행합니다


* 다른 세탁물과 섞히지 않도록 아기용품만을 전문적으로 취급합니다 ( 카페트,신발,의류 x )


* 패브릭 소재 수축이나 원단 변형 프레임 틀 변형 등을 예방하기 위하여 직접적인 스팀이 아닌 도포형 스팀을 진행합니다


❤️‍ 베베유의 약속 !!

1. 전 직원 비흡연 작업자 운영

아기용품을 직접 손으로 다루는 만큼

기본적인 위생 기준을 지킵니다

2. 저자극 아기 전용 세제 사용

단순 “천연”이 아닌 안전성 검증된 세제만 사용합니다

3. 전체 분해 후 손세탁 진행

4. 고압수 세척으로 깊은 오염 제거

5. 자연 제습 + 전용 건조실 이중 건조

6. 검증된 UV 살균 장비 사용

7. 1차 UV + 2차 소독수 + 3차 피톤치드 마감

8. 카시트 내부 구조 (폼) 저수분 관리

9. 곰팡이 · 소변 · 토사물 등 추가금 없음

10. 전용 포장지 개별 포장 후 출고

11. 무료 수거 & 무료 배송 서비스

12. 방문 접수 시 10% 할인

13. 다량 접수 시 추가 할인 적용

14. 24시간 무인 접수 가능

15. 전,후 리포트 사진 제공

16. 유모차 · 카시트 전문 시설 운영

보관 / 세탁 / 건조 / 포장 공간 완전 분리


< 예약 및 문의 010.5796.6553 >


#광주유모차수거세탁

#광주카시트수거세탁

#광주유모차세탁

#광주유아차세탁

#광주카시트세탁

#광주카시트세척

#광주아기용품전문세탁

#광주아기용품수거세탁

#첨단유모차세탁

#수완지구유모차세탁

#광산구유모차세탁

#첨단카시트세탁

#수완지구카시트세탁

#광산구카시트세탁

#깨끄태유

#베베유


https://link.inpock.co.kr/ggtyclean2`;

const NAVER_CAFE_PHOTO_GROUPS = [
  { title: "세탁 전", codes: ["01", "02", "03"] },
  { title: "탈거", codes: ["04"] },
  { title: "세탁 후", codes: ["05", "06", "07", "08", "09"] },
];

function defaultMemos() {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      title: "배송 전 검수",
      body: "배송 단계로 넘기기 전에 조립 상태와 누락 부품 메모를 확인해주세요.",
      createdAt: now,
    },
    {
      id: randomUUID(),
      title: "사진 기준",
      body: "오염 부위와 완료 상태는 가능한 같은 각도로 남겨주세요.",
      createdAt: now,
    },
  ];
}

function makeOrder(input) {
  const now = input.createdAt || new Date().toISOString();
  return {
    id: randomUUID(),
    serial: input.serial,
    registrationDate: input.registrationDate || todayRegistrationDate(),
    routeType: getRouteType(input.serial),
    customerName: input.customerName || null,
    phone: input.phone || null,
    address: input.address || null,
    productType: input.productType || null,
    brand: input.brand || null,
    modelName: input.modelName || null,
    requestMemo: input.requestMemo || null,
    worker: input.worker || "김베베",
    currentStep: input.currentStep || "01",
    status: input.status || "진행중",
    urgent: Boolean(input.urgent),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    shareStatus: "미공유",
    stepMemos: createEmptyStepMemos(),
    photos: [],
  };
}

function todayRegistrationDate() {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}/${value.month}/${value.day}`;
}

function getRouteType(serial) {
  return serial && String(serial).toUpperCase().startsWith("A") ? "배달" : "현장 픽업";
}

function createEmptyStepMemos() {
  return Object.fromEntries(steps.map((step) => [step.code, ""]));
}

async function readDb() {
  ensureStorage();
  if (dbCache) {
    await autoCloseOvernightAttendance(dbCache);
    return dbCache;
  }
  const db = normalizeDb(await readMariaDb());
  await autoCloseOvernightAttendance(db);
  primePhotoPathCache(db);
  dbCache = db;
  return dbCache;
}

async function writeDb(db) {
  ensureStorage();
  await writeMariaDb(normalizeDb(db));
}

function findMysqlExe() {
  const candidates = [
    process.env.MYSQL_EXE,
    "C:\\Program Files\\MariaDB 12.3\\bin\\mysql.exe",
    "C:\\Program Files\\MariaDB 11.4\\bin\\mysql.exe",
    "C:\\Program Files\\MariaDB 10.11\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function mysqlArgs(database = MYSQL_DATABASE) {
  const args = [
    "--protocol=TCP",
    "--skip-ssl",
    "--default-character-set=utf8mb4",
    "-h",
    MYSQL_HOST,
    "-P",
    MYSQL_PORT,
    "-u",
    MYSQL_USER,
    `--password=${MYSQL_PASSWORD}`,
  ];
  if (database) args.push("-D", database);
  return args;
}

function mysqlPoolKey(database = MYSQL_DATABASE) {
  return database || "__server__";
}

function mysqlPool(database = MYSQL_DATABASE) {
  if (!mysql2) return null;
  const key = mysqlPoolKey(database);
  if (!mysqlPools.has(key)) {
    mysqlPools.set(key, mysql2.createPool({
      host: MYSQL_HOST,
      port: Number(MYSQL_PORT),
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: database || undefined,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      rowsAsArray: true,
      dateStrings: true,
    }));
  }
  return mysqlPools.get(key);
}

async function mysqlExec(sql, database = MYSQL_DATABASE) {
  try {
    const pool = mysqlPool(database);
    if (pool) {
      const [result] = await pool.query(sql);
      invalidateDbCache();
      return result;
    }
    const result = execFileSync(MYSQL_EXE, mysqlArgs(database), {
      encoding: "utf8",
      input: sql,
      maxBuffer: 20 * 1024 * 1024,
    });
    invalidateDbCache();
    return result;
  } catch (error) {
    logError("MariaDB exec failed", error, sqlSnippet(sql));
    throw error;
  }
}

async function mysqlQuery(sql) {
  let output = "";
  try {
    const pool = mysqlPool(MYSQL_DATABASE);
    if (pool) {
      const [rows] = await pool.query(sql);
      return rows.map((row) => row.map((value) => value === null || value === undefined ? null : String(value)));
    }
    output = execFileSync(MYSQL_EXE, [...mysqlArgs(), "--batch", "--raw", "--skip-column-names", "-e", sql], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }).trimEnd();
  } catch (error) {
    logError("MariaDB query failed", error, sqlSnippet(sql));
    throw error;
  }
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => line.split("\t").map(fromSqlValue));
}

function sqlSnippet(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function sql(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function sqlDate(value) {
  if (!value) return "NULL";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NULL";
  const pad = (number) => String(number).padStart(2, "0");
  return sql(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`);
}

function fromSqlValue(value) {
  return value === "\\N" || value === "NULL" ? null : value;
}

function sqlBase64(column) {
  return `IF(${column} IS NULL,'\\\\N',REPLACE(REPLACE(TO_BASE64(${column}),'\\n',''),'\\r',''))`;
}

function fromSqlBase64(value) {
  if (!value || value === "\\N" || value === "NULL") return null;
  return Buffer.from(value, "base64").toString("utf8");
}

function passwordHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function passwordMatches(storedHash, input, role = "") {
  const value = String(input || "");
  if (!storedHash) return value === (isAdminRoleValue(role) ? DEFAULT_ADMIN_PASSWORD : DEFAULT_MEMBER_PASSWORD);
  return storedHash === passwordHash(value);
}

const ADMIN_ROLE_LABEL = "관리자";
const STAFF_ROLE_LABEL = "직원";
const LEGACY_ADMIN_ROLE_LABEL = "愿由ъ옄";

function isAdminRoleValue(role) {
  return role === ADMIN_ROLE_LABEL || role === LEGACY_ADMIN_ROLE_LABEL;
}

function parseJsonField(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function naverCafeSettingsForClient(settings = {}) {
  const merged = { ...defaultNaverCafeSettings(), ...(settings || {}) };
  return {
    enabled: Boolean(merged.enabled),
    clientId: merged.clientId || "",
    hasClientSecret: Boolean(merged.clientSecret),
    clubId: merged.clubId || "",
    menuId: merged.menuId || "",
    titleTemplate: merged.titleTemplate || defaultNaverCafeSettings().titleTemplate,
    contentTemplate: merged.contentTemplate || defaultNaverCafeSettings().contentTemplate,
    includePhotos: merged.includePhotos || "all",
    encodingMode: merged.encodingMode === "utf8-percent" ? "utf8-percent" : defaultNaverCafeSettings().encodingMode,
    hasAccessToken: Boolean(merged.accessToken),
    hasRefreshToken: Boolean(merged.refreshToken),
    tokenExpiresAt: toIso(merged.tokenExpiresAt),
    accessTokenPreview: merged.accessToken ? `${String(merged.accessToken).slice(0, 5)}...저장됨` : "",
    connectPath: "/api/naver-cafe/connect",
    automationLoginPath: "/api/naver-cafe/automation-login",
  };
}

function photoCacheKey(orderId, filename) {
  return `${orderId}/${filename}`;
}

function rememberPhotoPath(orderId, filePath, originalName = "") {
  if (!orderId || !filePath) return;
  photoPathCache.set(photoCacheKey(orderId, path.basename(filePath)), { filePath, originalName });
}

function primePhotoPathCache(db) {
  photoPathCache.clear();
  if (!db || !Array.isArray(db.orders)) return;
  (db.orders || []).forEach((order) => {
    (order.photos || []).forEach((photo) => {
      rememberPhotoPath(order.id, photo.filePath, photo.originalName);
      rememberPhotoPath(order.id, photo.displayFilePath, photo.originalName);
    });
  });
}

async function ensureMariaDbColumns() {
  if (mariaDbColumnsReady) return;
  if (!mariaDbColumnsPromise) {
    mariaDbColumnsPromise = ensureMariaDbColumnsOnce().finally(() => {
      mariaDbColumnsPromise = null;
    });
  }
  return mariaDbColumnsPromise;
}

async function ensureMariaDbColumnsOnce() {
  try {
    const hasUserPasswordColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'users' AND COLUMN_NAME = 'users_password_hash'`
    ))[0]?.[0] === "1";
    if (!hasUserPasswordColumn) {
      await mysqlExec(`ALTER TABLE users ADD COLUMN users_password_hash VARCHAR(128) NULL AFTER users_role`);
    }
    const hasUserActiveColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'users' AND COLUMN_NAME = 'users_is_active'`
    ))[0]?.[0] === "1";
    if (!hasUserActiveColumn) {
      await mysqlExec(`ALTER TABLE users ADD COLUMN users_is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER users_password_hash`);
    }
    const hasRegistrationDateColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'orders_registration_date'`
    ))[0]?.[0] === "1";
    if (!hasRegistrationDateColumn) {
      await mysqlExec(`ALTER TABLE orders ADD COLUMN orders_registration_date VARCHAR(8) NOT NULL DEFAULT '26/06/09' AFTER orders_serial`);
    }
    const hasUrgentColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'orders_is_urgent'`
    ))[0]?.[0] === "1";
    if (!hasUrgentColumn) {
      await mysqlExec(`ALTER TABLE orders ADD COLUMN orders_is_urgent TINYINT(1) NOT NULL DEFAULT 0 AFTER orders_share_status`);
    }
    const hasOrderDeletedAtColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'orders_deleted_at'`
    ))[0]?.[0] === "1";
    if (!hasOrderDeletedAtColumn) {
      await mysqlExec(`ALTER TABLE orders ADD COLUMN orders_deleted_at DATETIME NULL AFTER orders_completed_at`);
    }
    const hasOrderDeletedByColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'orders_deleted_by'`
    ))[0]?.[0] === "1";
    if (!hasOrderDeletedByColumn) {
      await mysqlExec(`ALTER TABLE orders ADD COLUMN orders_deleted_by VARCHAR(80) NULL AFTER orders_deleted_at`);
    }
    const hasUniqueSerialIndex = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND INDEX_NAME = 'uk_orders_serial'`
    ))[0]?.[0] === "1";
    if (hasUniqueSerialIndex) {
      await mysqlExec(`ALTER TABLE orders DROP INDEX uk_orders_serial`);
    }
    const hasSerialIndex = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_serial'`
    ))[0]?.[0] === "1";
    if (!hasSerialIndex) {
      await mysqlExec(`CREATE INDEX IF NOT EXISTS idx_orders_serial ON orders (orders_serial)`);
    }
    const hasPhotoProductIndexColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_product_index'`
    ))[0]?.[0] === "1";
    if (!hasPhotoProductIndexColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_product_index TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER photos_order_idx`);
    }
    const hasPhotoSortOrderColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_sort_order'`
    ))[0]?.[0] === "1";
    if (!hasPhotoSortOrderColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_sort_order INT NOT NULL DEFAULT 0 AFTER photos_product_index`);
    }
    const hasPhotoPinnedColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_is_pinned'`
    ))[0]?.[0] === "1";
    if (!hasPhotoPinnedColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER photos_sort_order`);
    }
    const hasPhotoPinnedAtColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_pinned_at'`
    ))[0]?.[0] === "1";
    if (!hasPhotoPinnedAtColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_pinned_at DATETIME NULL AFTER photos_is_pinned`);
    }
    const hasPhotoSortIndex = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND INDEX_NAME = 'idx_photos_order_step_sort'`
    ))[0]?.[0] === "1";
    if (!hasPhotoSortIndex) {
      await mysqlExec(`CREATE INDEX IF NOT EXISTS idx_photos_order_step_sort ON photos (photos_order_idx, photos_step_code, photos_product_index, photos_sort_order)`);
    }
    const hasPhotoPinIndex = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND INDEX_NAME = 'idx_photos_order_pin_sort'`
    ))[0]?.[0] === "1";
    if (!hasPhotoPinIndex) {
      await mysqlExec(`CREATE INDEX IF NOT EXISTS idx_photos_order_pin_sort ON photos (photos_order_idx, photos_product_index, photos_is_pinned, photos_pinned_at, photos_sort_order)`);
    }
    const hasPhotoDisplayFileColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_display_file_path'`
    ))[0]?.[0] === "1";
    if (!hasPhotoDisplayFileColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_display_file_path VARCHAR(500) NULL AFTER photos_url`);
    }
    const hasPhotoDisplayUrlColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_display_url'`
    ))[0]?.[0] === "1";
    if (!hasPhotoDisplayUrlColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_display_url VARCHAR(500) NULL AFTER photos_display_file_path`);
    }
    const hasPhotoDeletedAtColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_deleted_at'`
    ))[0]?.[0] === "1";
    if (!hasPhotoDeletedAtColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_deleted_at DATETIME NULL AFTER photos_is_deleted`);
    }
    const hasPhotoDeletedByColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'photos' AND COLUMN_NAME = 'photos_deleted_by'`
    ))[0]?.[0] === "1";
    if (!hasPhotoDeletedByColumn) {
      await mysqlExec(`ALTER TABLE photos ADD COLUMN photos_deleted_by VARCHAR(80) NULL AFTER photos_deleted_at`);
    }
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS keep_notes (
        keep_notes_idx VARCHAR(64) NOT NULL,
        keep_notes_owner_user_idx VARCHAR(64) NOT NULL,
        keep_notes_owner_name VARCHAR(80) NOT NULL,
        keep_notes_type VARCHAR(20) NOT NULL DEFAULT 'text',
        keep_notes_title VARCHAR(255) NULL,
        keep_notes_body TEXT NULL,
        keep_notes_items_json LONGTEXT NULL,
        keep_notes_collaborators_json LONGTEXT NULL,
        keep_notes_is_pinned TINYINT(1) NOT NULL DEFAULT 0,
        keep_notes_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        keep_notes_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        keep_notes_deleted_at DATETIME NULL,
        PRIMARY KEY (keep_notes_idx),
        KEY idx_keep_notes_owner_updated (keep_notes_owner_user_idx, keep_notes_updated_at),
        KEY idx_keep_notes_pinned_updated (keep_notes_is_pinned, keep_notes_updated_at)
      )
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS server_logs (
        server_logs_idx VARCHAR(64) NOT NULL,
        server_logs_level VARCHAR(20) NOT NULL,
        server_logs_message VARCHAR(500) NOT NULL,
        server_logs_details LONGTEXT NULL,
        server_logs_line LONGTEXT NOT NULL,
        server_logs_created_at DATETIME NOT NULL,
        PRIMARY KEY (server_logs_idx),
        KEY idx_server_logs_created_at (server_logs_created_at),
        KEY idx_server_logs_level_created_at (server_logs_level, server_logs_created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS share_links (
        share_links_idx VARCHAR(16) NOT NULL,
        share_links_order_idx VARCHAR(64) NOT NULL,
        share_links_hidden_photo_ids LONGTEXT NULL,
        share_links_customer_memo TEXT NULL,
        share_links_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        share_links_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (share_links_idx),
        UNIQUE KEY uk_share_links_order_idx (share_links_order_idx),
        KEY idx_share_links_updated_at (share_links_updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        chat_messages_idx VARCHAR(64) NOT NULL,
        chat_messages_room VARCHAR(30) NOT NULL DEFAULT 'photo',
        chat_messages_user_idx VARCHAR(64) NULL,
        chat_messages_user_name VARCHAR(80) NULL,
        chat_messages_body TEXT NULL,
        chat_messages_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_messages_idx),
        KEY idx_chat_messages_created_at (chat_messages_created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const hasChatRoomColumn = (await mysqlQuery(
      `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'chat_messages' AND COLUMN_NAME = 'chat_messages_room'`
    ))[0]?.[0] === "1";
    if (!hasChatRoomColumn) {
      await mysqlExec(`ALTER TABLE chat_messages ADD COLUMN chat_messages_room VARCHAR(30) NOT NULL DEFAULT 'photo' AFTER chat_messages_idx`);
    }
    const orderCafeColumns = [
      ["orders_naver_cafe_status", "VARCHAR(40) NOT NULL DEFAULT '대기' AFTER orders_share_status"],
      ["orders_naver_cafe_url", "VARCHAR(500) NULL AFTER orders_naver_cafe_status"],
      ["orders_naver_cafe_posted_at", "DATETIME NULL AFTER orders_naver_cafe_url"],
      ["orders_naver_cafe_error", "TEXT NULL AFTER orders_naver_cafe_posted_at"],
    ];
    for (const [columnName, columnDefinition] of orderCafeColumns) {
      const exists = (await mysqlQuery(
        `SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ${sql(MYSQL_DATABASE)} AND TABLE_NAME = 'orders' AND COLUMN_NAME = ${sql(columnName)}`
      ))[0]?.[0] === "1";
      if (!exists) await mysqlExec(`ALTER TABLE orders ADD COLUMN ${columnName} ${columnDefinition}`);
    }
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS chat_attachments (
        chat_attachments_idx VARCHAR(64) NOT NULL,
        chat_attachments_message_idx VARCHAR(64) NOT NULL,
        chat_attachments_file_path VARCHAR(500) NOT NULL,
        chat_attachments_url VARCHAR(500) NOT NULL,
        chat_attachments_original_file_name VARCHAR(255) NULL,
        chat_attachments_mime_type VARCHAR(120) NULL,
        chat_attachments_sort_order INT NOT NULL DEFAULT 0,
        chat_attachments_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_attachments_idx),
        KEY idx_chat_attachments_message_sort (chat_attachments_message_idx, chat_attachments_sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        app_settings_key VARCHAR(120) NOT NULL,
        app_settings_value LONGTEXT NULL,
        app_settings_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (app_settings_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        push_subscriptions_idx VARCHAR(80) NOT NULL,
        push_subscriptions_user_idx VARCHAR(64) NOT NULL,
        push_subscriptions_endpoint LONGTEXT NOT NULL,
        push_subscriptions_subscription_json LONGTEXT NOT NULL,
        push_subscriptions_enabled TINYINT(1) NOT NULL DEFAULT 1,
        push_subscriptions_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        push_subscriptions_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (push_subscriptions_idx),
        KEY idx_push_subscriptions_user_enabled (push_subscriptions_user_idx, push_subscriptions_enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS hourly_wages (
        hourly_wages_user_idx VARCHAR(64) NOT NULL,
        hourly_wages_amount INT NOT NULL DEFAULT 10320,
        hourly_wages_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (hourly_wages_user_idx)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await mysqlExec(`
      CREATE TABLE IF NOT EXISTS payroll_settings (
        payroll_settings_idx VARCHAR(128) NOT NULL,
        payroll_settings_user_idx VARCHAR(64) NOT NULL,
        payroll_settings_month_key VARCHAR(7) NOT NULL,
        payroll_settings_delivery_count INT NOT NULL DEFAULT 0,
        payroll_settings_delivery_price INT NOT NULL DEFAULT 0,
        payroll_settings_adjustments_json LONGTEXT NULL,
        payroll_settings_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (payroll_settings_idx),
        UNIQUE KEY uk_payroll_settings_user_month (payroll_settings_user_idx, payroll_settings_month_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    serverLogsTableReady = true;
    mariaDbColumnsReady = true;
  } catch (error) {
    logError("MariaDB auto migration failed", error);
    // 구버전 DB 자동 보정에 실패하면 이후 MariaDB 조회에서 명확히 오류를 냅니다.
  }
}

async function readMariaDb() {
  try {
    await mysqlExec(`CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE} DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`, null);
    await ensureMariaDbColumns();
    await cleanupExpiredChatMessages();
    await cleanupExpiredTrashPhotos();
    const users = (await mysqlQuery("SELECT users_idx,users_name,users_role,COALESCE((SELECT branches_name FROM branches WHERE branches.branches_idx = users.users_branch_idx),'본점'),users_clocked_in,users_clock_in_at FROM users WHERE COALESCE(users_is_active,1)=1 ORDER BY users_created_at,users_idx"))
      .map(([id, name, role, branch, clockedIn, clockInAt]) => ({
        id,
        name,
        role,
        branch,
        clockedIn: clockedIn === "1",
        clockInAt: clockInAt ? new Date(clockInAt).toISOString() : null,
      }));

    const adminMemos = (await mysqlQuery(`SELECT admin_memos_idx,${sqlBase64("admin_memos_title")},${sqlBase64("admin_memos_body")},admin_memos_created_at FROM admin_memos ORDER BY admin_memos_created_at DESC`))
      .map(([id, title, body, createdAt]) => ({ id, title: fromSqlBase64(title), body: fromSqlBase64(body), createdAt: toIso(createdAt) }));

    const orders = (await mysqlQuery(`SELECT orders_idx,orders_serial,orders_registration_date,orders_route_type,orders_customer_name,orders_customer_phone,orders_customer_address,orders_product_type,orders_brand,orders_model_name,${sqlBase64("orders_request_memo")},orders_worker,orders_current_step,orders_status,orders_share_status,orders_naver_cafe_status,orders_naver_cafe_url,orders_naver_cafe_posted_at,orders_naver_cafe_error,orders_is_urgent,orders_created_at,orders_updated_at,orders_completed_at FROM orders WHERE orders_deleted_at IS NULL ORDER BY orders_created_at DESC`))
      .map(([id, serial, registrationDate, routeType, customerName, phone, address, productType, brand, modelName, requestMemo, worker, currentStep, status, shareStatus, cafeStatus, cafeUrl, cafePostedAt, cafeError, urgent, createdAt, updatedAt, completedAt]) => ({
        id,
        serial,
        registrationDate,
        routeType,
        customerName,
        phone,
        address,
        productType,
        brand,
        modelName,
        requestMemo: fromSqlBase64(requestMemo),
        worker,
        currentStep,
        status,
        shareStatus,
        cafeStatus,
        cafeUrl,
        cafePostedAt: toIso(cafePostedAt),
        cafeError,
        urgent: urgent === "1",
        createdAt: toIso(createdAt),
        updatedAt: toIso(updatedAt),
        completedAt: toIso(completedAt),
        stepMemos: createEmptyStepMemos(),
        photos: [],
      }));

    const orderById = new Map(orders.map((order) => [order.id, order]));
    (await mysqlQuery(`SELECT order_step_memos_order_idx,order_step_memos_step_code,${sqlBase64("order_step_memos_memo")} FROM order_step_memos`)).forEach(([orderId, stepCode, memo]) => {
      if (orderById.has(orderId)) orderById.get(orderId).stepMemos[stepCode] = fromSqlBase64(memo) || "";
    });

    (await mysqlQuery(`SELECT photos_idx,photos_order_idx,photos_product_index,photos_sort_order,photos_is_pinned,photos_pinned_at,photos_step_code,photos_step_name,photos_file_path,photos_url,photos_display_file_path,photos_display_url,photos_original_file_name,photos_mime_type,${sqlBase64("photos_memo")},photos_uploaded_by,photos_uploaded_at FROM photos WHERE photos_is_deleted = 0 ORDER BY photos_is_pinned DESC,photos_pinned_at,photos_sort_order,photos_uploaded_at,photos_idx`))
      .forEach(([id, orderId, productIndex, sortOrder, pinned, pinnedAt, stepCode, stepName, filePath, url, displayFilePath, displayUrl, originalName, mimeType, memo, uploadedBy, uploadedAt]) => {
        if (!orderById.has(orderId)) return;
        orderById.get(orderId).photos.push({
          id,
          orderId,
          productIndex: Number(productIndex) || 1,
          sortOrder: Number(sortOrder) || 0,
          pinned: pinned === "1",
          pinnedAt: toIso(pinnedAt),
          stepCode,
          stepName,
          filePath,
          url,
          displayFilePath,
          displayUrl,
          originalName,
          mimeType,
          memo: fromSqlBase64(memo),
          uploadedBy,
          uploadedAt: toIso(uploadedAt),
        });
      });

    const logs = (await mysqlQuery(`SELECT work_logs_idx,work_logs_order_idx,work_logs_serial,work_logs_action_type,${sqlBase64("work_logs_memo")},work_logs_worker,work_logs_created_at FROM work_logs ORDER BY work_logs_created_at DESC LIMIT 1000`))
      .map(([id, orderId, serial, action, memo, worker, createdAt]) => ({ id, orderId, serial, action, memo: fromSqlBase64(memo), worker, createdAt: toIso(createdAt) }));

    const attendance = (await mysqlQuery("SELECT attendance_idx,attendance_user_idx,attendance_user_name,attendance_action_type,attendance_created_at FROM attendance ORDER BY attendance_created_at DESC"))
      .map(([id, userId, userName, action, createdAt]) => ({ id, userId, userName, action, createdAt: toIso(createdAt) }));

    const hourlyWages = Object.fromEntries((await mysqlQuery("SELECT hourly_wages_user_idx,hourly_wages_amount FROM hourly_wages"))
      .map(([userId, amount]) => [userId, Number(amount) || 10320]));

    const payrollSettings = Object.fromEntries((await mysqlQuery(`SELECT payroll_settings_user_idx,payroll_settings_month_key,payroll_settings_delivery_count,payroll_settings_delivery_price,${sqlBase64("payroll_settings_adjustments_json")} FROM payroll_settings`))
      .map(([userId, monthKey, deliveryCount, deliveryPrice, adjustments]) => [`${userId}:${monthKey}`, {
        userId,
        monthKey,
        deliveryCount: Math.max(0, Number(deliveryCount) || 0),
        deliveryPrice: Math.max(0, Number(deliveryPrice) || 0),
        adjustments: parseJsonField(fromSqlBase64(adjustments), []),
      }]));

    const appSettings = Object.fromEntries((await mysqlQuery("SELECT app_settings_key,app_settings_value FROM app_settings"))
      .map(([key, value]) => [key, parseJsonField(value, value)]));

    const keepNotes = (await mysqlQuery(`SELECT keep_notes_idx,keep_notes_owner_user_idx,keep_notes_owner_name,keep_notes_type,${sqlBase64("keep_notes_title")},${sqlBase64("keep_notes_body")},${sqlBase64("keep_notes_items_json")},${sqlBase64("keep_notes_collaborators_json")},keep_notes_is_pinned,keep_notes_created_at,keep_notes_updated_at FROM keep_notes WHERE keep_notes_deleted_at IS NULL ORDER BY keep_notes_is_pinned DESC, keep_notes_updated_at DESC`))
      .map(([id, ownerId, ownerName, type, title, body, items, collaborators, pinned, createdAt, updatedAt]) => ({
        id,
        ownerId,
        ownerName,
        type: type === "checklist" ? "checklist" : "text",
        title: fromSqlBase64(title) || "",
        body: fromSqlBase64(body) || "",
        items: parseJsonField(fromSqlBase64(items), []),
        collaborators: parseJsonField(fromSqlBase64(collaborators), []),
        pinned: pinned === "1",
        createdAt: toIso(createdAt),
        updatedAt: toIso(updatedAt),
      }));

    const chatMessages = (await mysqlQuery(`SELECT chat_messages_idx,chat_messages_room,chat_messages_user_idx,chat_messages_user_name,${sqlBase64("chat_messages_body")},chat_messages_created_at FROM chat_messages ORDER BY chat_messages_created_at ASC, chat_messages_idx ASC LIMIT 1000`))
      .map(([id, room, userId, userName, body, createdAt]) => ({
        id,
        room: normalizeChatRoom(room),
        userId,
        userName,
        body: fromSqlBase64(body) || "",
        attachments: [],
        createdAt: toIso(createdAt),
      }));
    const chatById = new Map(chatMessages.map((message) => [message.id, message]));
    (await mysqlQuery(`SELECT chat_attachments_idx,chat_attachments_message_idx,chat_attachments_file_path,chat_attachments_url,chat_attachments_original_file_name,chat_attachments_mime_type,chat_attachments_sort_order,chat_attachments_created_at FROM chat_attachments ORDER BY chat_attachments_message_idx,chat_attachments_sort_order,chat_attachments_created_at`))
      .forEach(([id, messageId, filePath, url, originalName, mimeType, sortOrder, createdAt]) => {
        const message = chatById.get(messageId);
        if (!message) return;
        message.attachments.push({
          id,
          messageId,
          filePath,
          url,
          originalName,
          mimeType,
          sortOrder: Number(sortOrder) || 0,
          createdAt: toIso(createdAt),
        });
      });

    const db = normalizeDb({ users, activeUserId: users[0]?.id || "user-1", adminMemos, attendance, hourlyWages, payrollSettings, appSettings, requests: [], orders, logs, keepNotes, chatMessages });
    if (!db.users.length) {
      const seed = createSeedDb();
      await writeMariaDb(seed);
      return seed;
    }
    return db;
  } catch (error) {
    throw new Error(`MariaDB read failed: ${error.message}`);
  }
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function cleanupExpiredChatMessages() {
  const expired = await mysqlQuery(`SELECT chat_attachments_file_path FROM chat_attachments WHERE chat_attachments_message_idx IN (SELECT chat_messages_idx FROM chat_messages WHERE chat_messages_created_at < DATE_SUB(NOW(), INTERVAL 1 MONTH))`);
  expired.forEach(([filePath]) => {
    const resolved = resolvePhotoPath(filePath);
    if (!resolved || !isInsideChatPhotoRoot(resolved) || !fs.existsSync(resolved)) return;
    try {
      fs.unlinkSync(resolved);
    } catch (error) {
      logWarning("Expired chat photo delete failed", error.message || error);
    }
  });
  await mysqlExec(`DELETE FROM chat_attachments WHERE chat_attachments_message_idx IN (SELECT chat_messages_idx FROM chat_messages WHERE chat_messages_created_at < DATE_SUB(NOW(), INTERVAL 1 MONTH))`);
  await mysqlExec(`DELETE FROM chat_messages WHERE chat_messages_created_at < DATE_SUB(NOW(), INTERVAL 1 MONTH)`);
}

async function cleanupExpiredTrashPhotos() {
  const expired = await mysqlQuery(`SELECT photos_idx FROM photos WHERE photos_is_deleted = 1 AND photos_deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
  await purgeTrashPhotos(expired.map(([photoId]) => photoId), "Expired trash photo delete failed");
}

async function purgeTrashPhotos(photoIds, warningLabel = "Trash photo delete failed") {
  const uniqueIds = [...new Set((photoIds || []).filter(Boolean))];
  if (!uniqueIds.length) return [];
  const rows = await mysqlQuery(`SELECT photos_idx,photos_file_path,photos_display_file_path FROM photos WHERE photos_is_deleted = 1 AND photos_idx IN (${uniqueIds.map(sql).join(",")})`);
  const deletedIds = rows.map(([photoId]) => photoId);
  rows.forEach(([, filePath, displayFilePath]) => {
    [filePath, displayFilePath].filter(Boolean).forEach((targetPath) => {
      const resolved = resolvePhotoPath(targetPath);
      if (!resolved || !isInsidePhotoRoot(resolved) || !fs.existsSync(resolved)) return;
      try {
        fs.unlinkSync(resolved);
      } catch (error) {
        logWarning(warningLabel, error.message || error);
      }
    });
  });
  if (deletedIds.length) {
    await mysqlExec(`DELETE FROM photos WHERE photos_idx IN (${deletedIds.map(sql).join(",")})`);
  }
  return deletedIds;
}

async function writeMariaDb(db) {
  const statements = [
    "SET FOREIGN_KEY_CHECKS = 0",
    "START TRANSACTION",
    "DELETE FROM staff_requests",
    "DELETE FROM admin_memos",
    "DELETE FROM attendance",
    "DELETE FROM work_logs",
    "DELETE FROM photos",
    "DELETE FROM order_step_memos",
    "DELETE FROM orders",
    "DELETE FROM users",
    "DELETE FROM branches",
    "INSERT INTO branches (branches_idx,branches_name) VALUES ('branch-1','본점')",
  ];

  db.users.forEach((user) => {
    statements.push(`INSERT INTO users (users_idx,users_branch_idx,users_name,users_role,users_password_hash,users_clocked_in,users_clock_in_at) VALUES (${sql(user.id)},'branch-1',${sql(user.name)},${sql(user.role)},${sql(user.passwordHash)},${user.clockedIn ? 1 : 0},${sqlDate(user.clockInAt)})`);
  });

  db.adminMemos.forEach((memo) => {
    statements.push(`INSERT INTO admin_memos (admin_memos_idx,admin_memos_title,admin_memos_body,admin_memos_created_at) VALUES (${sql(memo.id)},${sql(memo.title)},${sql(memo.body)},${sqlDate(memo.createdAt)})`);
  });

  db.orders.forEach((order) => {
    statements.push(`INSERT INTO orders (orders_idx,orders_branch_idx,orders_serial,orders_registration_date,orders_route_type,orders_customer_name,orders_customer_phone,orders_customer_address,orders_product_type,orders_brand,orders_model_name,orders_request_memo,orders_worker,orders_current_step,orders_status,orders_share_status,orders_naver_cafe_status,orders_naver_cafe_url,orders_naver_cafe_posted_at,orders_naver_cafe_error,orders_is_urgent,orders_created_at,orders_updated_at,orders_completed_at) VALUES (${sql(order.id)},'branch-1',${sql(order.serial)},${sql(order.registrationDate)},${sql(order.routeType)},${sql(order.customerName)},${sql(order.phone)},${sql(order.address)},${sql(order.productType)},${sql(order.brand)},${sql(order.modelName)},${sql(order.requestMemo)},${sql(order.worker)},${sql(order.currentStep)},${sql(order.status)},${sql(order.shareStatus)},${sql(order.cafeStatus || "대기")},${sql(order.cafeUrl || "")},${sqlDate(order.cafePostedAt)},${sql(order.cafeError || "")},${order.urgent ? 1 : 0},${sqlDate(order.createdAt)},${sqlDate(order.updatedAt)},${sqlDate(order.completedAt)})`);
    Object.entries(order.stepMemos || {}).forEach(([stepCode, memo]) => {
      statements.push(`INSERT INTO order_step_memos (order_step_memos_idx,order_step_memos_order_idx,order_step_memos_step_code,order_step_memos_memo,order_step_memos_updated_at) VALUES (${sql(`${order.id}-${stepCode}`)},${sql(order.id)},${sql(stepCode)},${sql(memo)},NOW())`);
    });
    (order.photos || []).forEach((photo) => {
      statements.push(`INSERT INTO photos (photos_idx,photos_order_idx,photos_product_index,photos_sort_order,photos_is_pinned,photos_pinned_at,photos_step_code,photos_step_name,photos_file_path,photos_url,photos_display_file_path,photos_display_url,photos_original_file_name,photos_mime_type,photos_memo,photos_uploaded_by,photos_uploaded_at,photos_is_deleted) VALUES (${sql(photo.id)},${sql(order.id)},${Number(photo.productIndex) || 1},${normalizePhotoSortOrder(photo.sortOrder)},${photo.pinned ? 1 : 0},${sqlDate(photo.pinnedAt)},${sql(photo.stepCode)},${sql(photo.stepName)},${sql(photo.filePath)},${sql(photo.url)},${sql(photo.displayFilePath)},${sql(photo.displayUrl)},${sql(photo.originalName)},${sql(photo.mimeType)},${sql(photo.memo)},${sql(photo.uploadedBy)},${sqlDate(photo.uploadedAt)},0)`);
    });
  });

  db.logs.forEach((log) => {
    if (!db.orders.some((order) => order.id === log.orderId)) return;
    statements.push(`INSERT INTO work_logs (work_logs_idx,work_logs_order_idx,work_logs_serial,work_logs_action_type,work_logs_memo,work_logs_worker,work_logs_created_at) VALUES (${sql(log.id)},${sql(log.orderId)},${sql(log.serial)},${sql(log.action)},${sql(log.memo)},${sql(log.worker)},${sqlDate(log.createdAt)})`);
  });

  db.attendance.forEach((item) => {
    if (!db.users.some((user) => user.id === item.userId)) return;
    statements.push(`INSERT INTO attendance (attendance_idx,attendance_user_idx,attendance_user_name,attendance_action_type,attendance_created_at) VALUES (${sql(item.id)},${sql(item.userId)},${sql(item.userName)},${sql(item.action)},${sqlDate(item.createdAt)})`);
  });

  statements.push("COMMIT", "SET FOREIGN_KEY_CHECKS = 1");
  await mysqlExec(`${statements.join(";\n")};`);
}

function looksBroken(value) {
  return !value || /[\?\uFFFD]|\u8E30|\u8ADB|\u6E90|\uF9DE|\u6028|\uC496|\uAFA9|\uB301|\uC88A|\uBEA3/.test(String(value));
}

function normalizeDb(db) {
  db = db && typeof db === "object" ? db : {};
  db.users = Array.isArray(db.users) ? db.users : [];
  db.orders = Array.isArray(db.orders) ? db.orders : [];
  db.orders = db.orders.filter((order) => order && order.id && order.serial);
  db.logs = Array.isArray(db.logs) ? db.logs : [];
  db.adminMemos = Array.isArray(db.adminMemos) ? db.adminMemos : [];
  db.attendance = Array.isArray(db.attendance) ? db.attendance : [];
  db.hourlyWages = db.hourlyWages && typeof db.hourlyWages === "object" ? db.hourlyWages : {};
  db.payrollSettings = db.payrollSettings && typeof db.payrollSettings === "object" ? db.payrollSettings : {};
  db.appSettings = db.appSettings && typeof db.appSettings === "object" ? db.appSettings : {};
  db.requests = Array.isArray(db.requests) ? db.requests : [];
  db.keepNotes = Array.isArray(db.keepNotes) ? db.keepNotes : [];
  db.chatMessages = Array.isArray(db.chatMessages) ? db.chatMessages : [];

  if (!db.users.length) {
    db.users = [
      { id: "user-1", name: "김베베", role: "관리자", branch: "본점", clockedIn: false, clockInAt: null },
    ];
    db.activeUserId = "user-1";
  }

  db.users.forEach((user, index) => {
    if (looksBroken(user.name)) user.name = index === 0 ? "김베베" : "이유모";
    if (looksBroken(user.role)) user.role = index === 0 ? "관리자" : "직원";
    if (looksBroken(user.branch)) user.branch = "본점";
  });

  if (!db.adminMemos.length || db.adminMemos.some((memo) => looksBroken(memo.title) || looksBroken(memo.body))) {
    db.adminMemos = defaultMemos();
  }

  const now = new Date().toISOString();
  db.adminMemos.forEach((memo) => {
    memo.createdAt = toIso(memo.createdAt) || now;
  });

  db.orders.forEach((order) => {
    order.routeType = getRouteType(order.serial);
    order.registrationDate = order.registrationDate || "26/06/09";
    order.currentStep = getStep(order.currentStep).code;
    const rawStatus = String(order.status || "");
    const rawCompletedAt = toIso(order.completedAt);
    const isCompletedOrder = rawStatus === "\uC644\uB8CC";
    order.status = isCompletedOrder ? "\uC644\uB8CC" : stepStatus(order.currentStep);
    order.urgent = Boolean(order.urgent);
    order.createdAt = toIso(order.createdAt) || toIso(order.updatedAt) || now;
    order.updatedAt = toIso(order.updatedAt) || order.createdAt;
    order.completedAt = rawCompletedAt;
    order.cafeStatus = order.cafeStatus || "대기";
    order.cafeUrl = order.cafeUrl || "";
    order.cafePostedAt = toIso(order.cafePostedAt);
    order.cafeError = order.cafeError || "";
    order.worker = looksBroken(order.worker) ? "김베베" : order.worker;
    order.shareStatus = looksBroken(order.shareStatus) ? "미공유" : order.shareStatus;
    order.stepMemos = { ...createEmptyStepMemos(), ...(order.stepMemos || {}) };
    order.photos = Array.isArray(order.photos) ? order.photos : [];
    order.photos.forEach((photo) => {
      photo.productIndex = normalizeProductIndex(photo.productIndex);
      photo.sortOrder = normalizePhotoSortOrder(photo.sortOrder);
      photo.pinned = Boolean(photo.pinned);
      photo.pinnedAt = toIso(photo.pinnedAt);
      photo.displayUrl = photo.displayUrl || photo.url;
      photo.stepName = getStep(photo.stepCode).name;
      photo.uploadedBy = looksBroken(photo.uploadedBy) ? order.worker : photo.uploadedBy;
      photo.uploadedAt = toIso(photo.uploadedAt) || now;
    });
  });

  db.logs.forEach((log) => {
    log.createdAt = toIso(log.createdAt) || now;
  });

  db.attendance.forEach((item) => {
    item.createdAt = toIso(item.createdAt) || now;
  });

  db.keepNotes.forEach((note) => {
    note.type = note.type === "checklist" ? "checklist" : "text";
    note.title = note.title || "";
    note.body = note.body || "";
    note.items = Array.isArray(note.items) ? note.items : [];
    note.collaborators = Array.isArray(note.collaborators) ? note.collaborators : [];
    note.pinned = Boolean(note.pinned);
    note.createdAt = toIso(note.createdAt) || now;
    note.updatedAt = toIso(note.updatedAt) || note.createdAt;
  });

  db.chatMessages.forEach((message) => {
    message.room = normalizeChatRoom(message.room);
    message.body = String(message.body || "");
    message.userName = looksBroken(message.userName) ? "" : message.userName;
    message.createdAt = toIso(message.createdAt) || now;
    message.attachments = Array.isArray(message.attachments) ? message.attachments : [];
    message.attachments.forEach((attachment, index) => {
      attachment.sortOrder = normalizePhotoSortOrder(attachment.sortOrder ?? index);
      attachment.createdAt = toIso(attachment.createdAt) || message.createdAt;
    });
  });

  return db;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function requestBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${String(proto).split(",")[0]}://${String(host).split(",")[0]}`;
}

function naverRedirectUri(req) {
  return `${requestBaseUrl(req)}/api/naver-cafe/callback`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) {
        reject(new Error("파일 용량이 너무 큽니다."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("요청 형식이 올바르지 않습니다."));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req, limit = UPLOAD_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const declaredSize = Number(req.headers["content-length"] || 0);
    if (declaredSize > limit) {
      const limitMb = Math.round(limit / 1024 / 1024);
      const error = new AppError(413, `업로드 용량이 너무 큽니다. 한 번에 약 ${limitMb}MB까지만 저장할 수 있습니다.`);
      error.code = "ERR_UPLOAD_TOO_LARGE";
      finishReject(error);
      req.destroy();
      return;
    }
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        finishReject(new Error("파일 용량이 너무 큽니다."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finishResolve(Buffer.concat(chunks)));
    req.on("aborted", () => {
      const error = new Error("aborted");
      error.code = "ECONNRESET";
      finishReject(error);
    });
    req.on("close", () => {
      if (!settled && req.aborted) {
        const error = new Error("aborted");
        error.code = "ECONNRESET";
        finishReject(error);
      }
    });
    req.on("error", finishReject);
  });
}

async function readMultipartForm(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw new Error("파일 업로드 형식이 올바르지 않습니다.");
  return parseMultipartBuffer(await readRawBody(req), boundary);
}

function parseMultipartBuffer(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const result = { fields: {}, files: [] };
  let cursor = 0;

  while (cursor < buffer.length) {
    const boundaryStart = buffer.indexOf(delimiter, cursor);
    if (boundaryStart < 0) break;

    let partStart = boundaryStart + delimiter.length;
    if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) break;
    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2;

    const headerEnd = buffer.indexOf(headerSeparator, partStart);
    if (headerEnd < 0) break;

    const nextBoundary = buffer.indexOf(delimiter, headerEnd + headerSeparator.length);
    if (nextBoundary < 0) break;

    const headers = buffer.slice(partStart, headerEnd).toString("utf8");
    let contentEnd = nextBoundary;
    if (buffer[contentEnd - 2] === 13 && buffer[contentEnd - 1] === 10) contentEnd -= 2;

    const disposition = headers.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    const contentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";
    const content = buffer.slice(headerEnd + headerSeparator.length, contentEnd);

    if (name && filename !== undefined) {
      if (filename) result.files.push({ fieldName: name, originalName: filename, mimeType: contentType, buffer: content });
    } else if (name) {
      result.fields[name] = content.toString("utf8");
    }

    cursor = nextBoundary;
  }

  return result;
}

function monthFolder(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getStep(code) {
  return steps.find((step) => step.code === code) || steps[0];
}

function nextStep(code) {
  const index = steps.findIndex((step) => step.code === code);
  return steps[index + 1] || null;
}

function previousStep(code) {
  const index = steps.findIndex((step) => step.code === code);
  return steps[index - 1] || null;
}

function stepStatus(code) {
  return "\uC9C4\uD589\uC911";
}

function isPhotoStep(code) {
  return Number(code || "0") > 0 && Number(code || "0") <= PHOTO_STEP_LIMIT;
}

function safeName(name) {
  return String(name || "photo").replace(/[\\/:*?"<>|]/g, "_");
}

function normalizeOrderSerial(value) {
  const source = String(value || "").trim();
  return source.match(/\b(?:AB|BA|A|B)\d{2,4}\b/i)?.[0]?.toUpperCase() || source;
}

function serialPlacePrefix(value, serial) {
  return String(value || "")
    .replace(serial, "")
    .replace(/^[\s/\-]+|[\s/\-]+$/g, "")
    .trim();
}

function requestMemoWithSerialPlace(requestMemo, rawSerial, serial) {
  const memo = String(requestMemo || "").trim();
  if (/^지역:\s*[^\n]+/m.test(memo)) return memo || null;
  const place = serialPlacePrefix(rawSerial, serial);
  return [place ? `지역: ${place}` : "", memo].filter(Boolean).join("\n") || null;
}

function normalizeProductIndex(value) {
  return Math.min(99, Math.max(1, Number(value) || 1));
}

function normalizePhotoSortOrder(value) {
  return Math.max(0, Number(value) || 0);
}

function normalizeChatRoom(value) {
  return "main";
}

function parseChatOrderText(rawText) {
  const raw = String(rawText || "").trim();
  const serial = raw.match(/\b(?:AB|BA|A|B)\d{2,4}\b/i)?.[0]?.toUpperCase() || "";
  if (!serial) return null;
  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const serialIndex = parts.findIndex((part) => part.toUpperCase().includes(serial));
  if (serialIndex < 0) return null;
  const isB = serial.startsWith("B");
  const datePart = parts[serialIndex + (isB ? 2 : 1)] || "";
  const productStart = Math.max(0, serialIndex + (isB ? 3 : 3));
  const productText = parts.slice(productStart).join(" / ");
  const contactTail = isB ? parts[serialIndex + 1] || "" : "";
  const region = !isB && serialIndex > 0 ? parts[0] : "";
  const address = !isB ? parts[serialIndex + 2] || "" : "";
  const requestMemo = [
    `복사 원문: ${raw}`,
    region ? `지역: ${region}` : "",
    contactTail ? `연락처 뒷 번호: ${contactTail}` : "",
    productText ? `제품/브랜드 원문: ${productText}` : "",
  ].filter(Boolean).join("\n");
  return {
    serial,
    registrationDate: normalizeChatOrderDate(datePart),
    customerName: null,
    phone: contactTail || null,
    address: address || null,
    productType: inferChatProductType(productText),
    brand: null,
    modelName: productText || null,
    requestMemo,
  };
}

function normalizeChatOrderDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  if (digits.length >= 6) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 6)}`;
  if (digits.length === 4) return `${yy}/${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  if (digits.length <= 2 && digits) return `${yy}/${mm}/${digits.padStart(2, "0")}`;
  return todayRegistrationDate();
}

function inferChatProductType(value = "") {
  const text = String(value || "");
  if (/카시트|카시트|car\s*seat/i.test(text)) return "카시트";
  if (/유모차|stroller/i.test(text)) return "유모차";
  return null;
}

function parseChatPhotoStepUpload(rawText) {
  const text = String(rawText || "").trim();
  const serial = text.match(/\b(?:AB|BA|A|B)\d{2,4}\b/i)?.[0]?.toUpperCase() || "";
  if (!serial) return null;
  if (/(\uC811\uC218|\uC785\uACE0)/u.test(text)) return { serial, stepCode: "01" };
  if (/\uB77C\uBCA8/u.test(text)) return { serial, stepCode: "02" };
  if (/(\uC804\s*\uC0AC\uC9C4|\uC804\uC0AC\uC9C4|\uC138\uD0C1\s*\uC804)/u.test(text)) return { serial, stepCode: "03" };
  if (/\uD0C8\uAC70/u.test(text)) return { serial, stepCode: "04" };
  if (/(\uD6C4\s*\uC0AC\uC9C4|\uD6C4\uC0AC\uC9C4|\uC138\uD0C1\s*\uD6C4)/u.test(text)) return { serial, stepCode: "08" };
  if (/(\uC0B4\uADE0|\uC0B4\uC18C\uD53C\uD3EC|\uC18C\uB3C5)/u.test(text)) return { serial, stepCode: "09" };
  if (/(\uC870\uB9BD|\uD504\uB808\uC784)/u.test(text)) return { serial, stepCode: "06" };
  if (/\uAC80\uC218/u.test(text)) return { serial, stepCode: "07" };
  if (/\uC138\uD0C1/u.test(text)) return { serial, stepCode: "05" };
  if (/\uBC30\uC1A1/u.test(text)) return { serial, stepCode: "10" };
  return null;
}

async function saveDataUrlPhoto(order, stepCode, dataUrl, originalName, uploadedBy, productIndex = 1, sortOrder = 0) {
  const match = /^data:((?:image|video)\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("파일 데이터가 올바르지 않습니다.");

  const mime = match[1];
  const isImage = /^image\//.test(mime);
  const ext = isImage ? ".jpg" : getMediaExtension(mime, originalName);
  const now = new Date();
  const folder = path.join(PHOTO_ROOT, "bebeu", monthFolder(now), order.serial, stepCode);
  fs.mkdirSync(folder, { recursive: true });

  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const originalBase = path.basename(originalName || "photo", path.extname(originalName || ""));
  const filename = `${order.serial}_${stepCode}_${stamp}_${randomUUID()}_${safeName(originalBase)}${ext}`;
  const filePath = path.join(folder, filename);
  const inputBuffer = Buffer.from(match[2], "base64");
  const storedBuffer = isImage ? await resizeImageBuffer(inputBuffer) : inputBuffer;
  fs.writeFileSync(filePath, storedBuffer);
  const url = `/photos/${encodeURIComponent(order.id)}/${encodeURIComponent(filename)}`;

  return {
    id: randomUUID(),
    orderId: order.id,
    productIndex: normalizeProductIndex(productIndex),
    sortOrder: normalizePhotoSortOrder(sortOrder),
    pinned: false,
    pinnedAt: null,
    stepCode,
    stepName: getStep(stepCode).name,
    filePath,
    url,
    displayFilePath: isImage ? filePath : null,
    displayUrl: isImage ? url : null,
    originalName: originalName || filename,
    mimeType: isImage ? "image/jpeg" : mime,
    uploadedBy: uploadedBy || order.worker,
    uploadedAt: now.toISOString(),
  };
}

async function saveUploadedPhoto(order, stepCode, file, uploadedBy, productIndex = 1, displayFile = null, sortOrder = 0) {
  const mime = file.mimeType || "application/octet-stream";
  if (!/^(image|video)\//.test(mime)) throw new Error("사진 또는 동영상 파일만 저장할 수 있습니다.");

  const isImage = /^image\//.test(mime);
  const ext = isImage ? ".jpg" : getMediaExtension(mime, file.originalName);
  const now = new Date();
  const folder = path.join(PHOTO_ROOT, "bebeu", monthFolder(now), order.serial, stepCode);
  fs.mkdirSync(folder, { recursive: true });

  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const originalBase = path.basename(file.originalName || "photo", path.extname(file.originalName || ""));
  const filename = `${order.serial}_${stepCode}_${stamp}_${randomUUID()}_${safeName(originalBase)}${ext}`;
  const filePath = path.join(folder, filename);
  const storedBuffer = isImage
    ? (displayFile && /^image\//.test(displayFile.mimeType || "") ? displayFile.buffer : await resizeImageBuffer(file.buffer))
    : file.buffer;
  fs.writeFileSync(filePath, storedBuffer);
  const url = `/photos/${encodeURIComponent(order.id)}/${encodeURIComponent(filename)}`;

  return {
    id: randomUUID(),
    orderId: order.id,
    productIndex: normalizeProductIndex(productIndex),
    sortOrder: normalizePhotoSortOrder(sortOrder),
    pinned: false,
    pinnedAt: null,
    stepCode,
    stepName: getStep(stepCode).name,
    filePath,
    url,
    displayFilePath: isImage ? filePath : null,
    displayUrl: isImage ? url : null,
    originalName: file.originalName || filename,
    mimeType: isImage ? "image/jpeg" : mime,
    uploadedBy: uploadedBy || order.worker,
    uploadedAt: now.toISOString(),
  };
}

async function saveUploadedChatAttachment(file, messageId, sortOrder = 0) {
  const mime = file.mimeType || "application/octet-stream";
  if (!/^image\//.test(mime)) throw new Error("사진 파일만 저장할 수 있습니다.");

  const ext = ".jpg";
  const now = new Date();
  const folder = path.join(CHAT_PHOTO_ROOT, monthFolder(now));
  fs.mkdirSync(folder, { recursive: true });

  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const originalBase = path.basename(file.originalName || "photo", path.extname(file.originalName || ""));
  const filename = `chat_${stamp}_${randomUUID()}_${safeName(originalBase)}${ext}`;
  const filePath = path.join(folder, filename);
  const storedBuffer = await resizeImageBuffer(file.buffer);
  fs.writeFileSync(filePath, storedBuffer);

  return {
    id: randomUUID(),
    messageId,
    filePath,
    url: `/chat-photos/${encodeURIComponent(monthFolder(now))}/${encodeURIComponent(filename)}`,
    originalName: file.originalName || filename,
    mimeType: "image/jpeg",
    sortOrder: normalizePhotoSortOrder(sortOrder),
    createdAt: now.toISOString(),
  };
}

function displayPhotoFilename(order, stepCode, originalName = "photo") {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const originalBase = path.basename(originalName || "photo", path.extname(originalName || ""));
  return `${order.serial}_${stepCode}_${stamp}_${randomUUID()}_${safeName(originalBase)}_display.jpg`;
}

function getMediaExtension(mime, originalName = "") {
  const ext = path.extname(originalName).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".m4v", ".webm"].includes(ext)) return ext;
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("quicktime")) return ".mov";
  if (mime.includes("webm")) return ".webm";
  return ".jpg";
}

function addLog(db, order, action, memo = "") {
  db.logs.unshift({
    id: randomUUID(),
    orderId: order.id,
    serial: order.serial,
    action,
    memo,
    worker: order.worker,
    createdAt: new Date().toISOString(),
  });
}

async function insertPhotoRows(photos) {
  if (!photos.length) return;
  const statements = photos.map((photo) => `INSERT INTO photos (photos_idx,photos_order_idx,photos_product_index,photos_sort_order,photos_is_pinned,photos_pinned_at,photos_step_code,photos_step_name,photos_file_path,photos_url,photos_display_file_path,photos_display_url,photos_original_file_name,photos_mime_type,photos_memo,photos_uploaded_by,photos_uploaded_at,photos_is_deleted) VALUES (${sql(photo.id)},${sql(photo.orderId)},${Number(photo.productIndex) || 1},${normalizePhotoSortOrder(photo.sortOrder)},${photo.pinned ? 1 : 0},${sqlDate(photo.pinnedAt)},${sql(photo.stepCode)},${sql(photo.stepName)},${sql(photo.filePath)},${sql(photo.url)},${sql(photo.displayFilePath)},${sql(photo.displayUrl)},${sql(photo.originalName)},${sql(photo.mimeType)},${sql(photo.memo)},${sql(photo.uploadedBy)},${sqlDate(photo.uploadedAt)},0)`);
  await mysqlExec(["START TRANSACTION", ...statements, "COMMIT"].join(";\n"));
}

async function insertChatMessageRow(message) {
  const messageStatement = `INSERT INTO chat_messages (chat_messages_idx,chat_messages_room,chat_messages_user_idx,chat_messages_user_name,chat_messages_body,chat_messages_created_at) VALUES (${sql(message.id)},${sql(normalizeChatRoom(message.room))},${sql(message.userId)},${sql(message.userName)},${sql(message.body)},${sqlDate(message.createdAt)})`;
  const attachmentStatements = (message.attachments || []).map((attachment) => `INSERT INTO chat_attachments (chat_attachments_idx,chat_attachments_message_idx,chat_attachments_file_path,chat_attachments_url,chat_attachments_original_file_name,chat_attachments_mime_type,chat_attachments_sort_order,chat_attachments_created_at) VALUES (${sql(attachment.id)},${sql(message.id)},${sql(attachment.filePath)},${sql(attachment.url)},${sql(attachment.originalName)},${sql(attachment.mimeType)},${normalizePhotoSortOrder(attachment.sortOrder)},${sqlDate(attachment.createdAt)})`);
  await mysqlExec(["START TRANSACTION", messageStatement, ...attachmentStatements, "COMMIT"].join(";\n"));
}

async function readChatAttachmentById(attachmentId) {
  const rows = await mysqlQuery(`SELECT chat_attachments_idx,chat_attachments_message_idx,chat_attachments_file_path,chat_attachments_url,chat_attachments_original_file_name,chat_attachments_mime_type,chat_attachments_sort_order,chat_attachments_created_at FROM chat_attachments WHERE chat_attachments_idx=${sql(attachmentId)} LIMIT 1`);
  if (!rows.length) return null;
  const [id, messageId, filePath, url, originalName, mimeType, sortOrder, createdAt] = rows[0];
  return {
    id,
    messageId,
    filePath,
    url,
    originalName,
    mimeType,
    sortOrder: Number(sortOrder) || 0,
    createdAt: toIso(createdAt),
  };
}

async function readChatAttachmentsByMessageId(messageId) {
  const rows = await mysqlQuery(`SELECT chat_attachments_idx,chat_attachments_message_idx,chat_attachments_file_path,chat_attachments_url,chat_attachments_original_file_name,chat_attachments_mime_type,chat_attachments_sort_order,chat_attachments_created_at FROM chat_attachments WHERE chat_attachments_message_idx=${sql(messageId)} ORDER BY chat_attachments_sort_order,chat_attachments_created_at`);
  return rows.map(([id, rowMessageId, filePath, url, originalName, mimeType, sortOrder, createdAt]) => ({
    id,
    messageId: rowMessageId,
    filePath,
    url,
    originalName,
    mimeType,
    sortOrder: Number(sortOrder) || 0,
    createdAt: toIso(createdAt),
  }));
}

async function deleteChatMessageRow(messageId) {
  const attachments = await readChatAttachmentsByMessageId(messageId);
  attachments.forEach((attachment) => {
    const filePath = resolvePhotoPath(attachment.filePath);
    if (!filePath || !isInsideChatPhotoRoot(filePath) || !fs.existsSync(filePath)) return;
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      logWarning("Chat photo delete failed", error.message || error);
    }
  });
  await mysqlExec([
    "START TRANSACTION",
    `DELETE FROM chat_attachments WHERE chat_attachments_message_idx=${sql(messageId)}`,
    `DELETE FROM chat_messages WHERE chat_messages_idx=${sql(messageId)}`,
    "COMMIT",
  ].join(";\n"));
}

async function upsertPushSubscription(user, subscription) {
  const endpoint = String(subscription?.endpoint || "");
  if (!endpoint) throw new AppError(400, "알림 구독 정보가 올바르지 않습니다.");
  const id = pushEndpointId(endpoint);
  await mysqlExec(`INSERT INTO push_subscriptions (push_subscriptions_idx,push_subscriptions_user_idx,push_subscriptions_endpoint,push_subscriptions_subscription_json,push_subscriptions_enabled,push_subscriptions_created_at,push_subscriptions_updated_at) VALUES (${sql(id)},${sql(user.id)},${sql(endpoint)},${sql(JSON.stringify(subscription))},1,NOW(),NOW()) ON DUPLICATE KEY UPDATE push_subscriptions_user_idx=VALUES(push_subscriptions_user_idx), push_subscriptions_endpoint=VALUES(push_subscriptions_endpoint), push_subscriptions_subscription_json=VALUES(push_subscriptions_subscription_json), push_subscriptions_enabled=1, push_subscriptions_updated_at=NOW()`);
  return id;
}

async function disablePushSubscription(endpoint) {
  const id = pushEndpointId(endpoint);
  await mysqlExec(`UPDATE push_subscriptions SET push_subscriptions_enabled=0, push_subscriptions_updated_at=NOW() WHERE push_subscriptions_idx=${sql(id)}`);
}

async function readEnabledAdminPushSubscriptions(exceptUserId = "") {
  const rows = await mysqlQuery(`SELECT push_subscriptions_idx,push_subscriptions_user_idx,push_subscriptions_subscription_json FROM push_subscriptions INNER JOIN users ON users.users_idx = push_subscriptions.push_subscriptions_user_idx WHERE push_subscriptions_enabled=1 AND users.users_role=${sql("관리자")} ${exceptUserId ? `AND push_subscriptions_user_idx<>${sql(exceptUserId)}` : ""}`);
  return rows.map(([id, userId, subscriptionJson]) => {
    try {
      return { id, userId, subscription: JSON.parse(subscriptionJson) };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function notifyAdminsOfReceiptChat(message) {
  if (!webPush || !ensureVapidKeys()) return;
  const targets = await readEnabledAdminPushSubscriptions(message.userId);
  if (!targets.length) return;
  const payload = JSON.stringify({
    title: "BEBEU WORK",
    body: "새 메시지가 있습니다.",
    url: "/?open=chat-receipt",
    tag: "bebeu-chat-receipt",
  });
  await Promise.all(targets.map(async (target) => {
    try {
      await webPush.sendNotification(target.subscription, payload);
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status);
      if (statusCode === 404 || statusCode === 410) {
        await disablePushSubscription(target.subscription?.endpoint);
        return;
      }
      logWarning("Push notification failed", error.message || error);
    }
  }));
}

function queueChatAutoProcessing(room, body, message, user, options = {}) {
  if (!message?.attachments?.length) return;
  setImmediate(() => {
    processChatAutoProcessing(room, body, message, user, options).catch((error) => {
      logError("Chat auto processing failed", error, `room=${room} message=${message.id}`);
    });
  });
}

function sameOrderSerial(order, serial) {
  return String(order?.serial || "").trim().toUpperCase() === String(serial || "").trim().toUpperCase();
}

function latestCompletedOrderForSerial(orders, serial) {
  return (orders || [])
    .filter((order) => sameOrderSerial(order, serial) && order.status === "\uC644\uB8CC")
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0))[0] || null;
}

async function reopenCompletedOrderForSerial(serial, workerName = "") {
  const normalizedSerial = normalizeOrderSerial(serial);
  if (!normalizedSerial) return null;
  const db = await readDb();
  const completed = latestCompletedOrderForSerial(db.orders, normalizedSerial);
  if (!completed) return null;
  const order = makeOrder({
    serial: completed.serial,
    registrationDate: todayRegistrationDate(),
    customerName: completed.customerName || null,
    phone: completed.phone || null,
    address: completed.address || null,
    productType: completed.productType || null,
    brand: completed.brand || null,
    modelName: completed.modelName || null,
    requestMemo: completed.requestMemo || null,
    worker: workerName || completed.worker,
    currentStep: "01",
    status: stepStatus("01"),
  });
  await insertOrderRow(order);
  await insertLogRow({
    id: randomUUID(),
    orderId: order.id,
    serial: order.serial,
    action: "\uC7AC\uC811\uC218",
    memo: `${completed.registrationDate || ""} \uC644\uB8CC \uC774\uB825\uC5D0\uC11C \uC0C8 \uC811\uC218\uAC74 \uC0DD\uC131`.trim(),
    worker: workerName || completed.worker || "",
    createdAt: new Date().toISOString(),
  });
  return order;
}

async function processChatAutoProcessing(room, body, message, user, options = {}) {
  const attachments = (message.attachments || []).filter((attachment) => (attachment.mimeType || "").startsWith("image/"));
  if (!attachments.length) return;
  if ((options.targetOrderId || options.targetSerial) && isPhotoStep(options.targetStepCode)) {
    let order = options.targetOrderId ? await readOrderById(options.targetOrderId) : null;
    if (!order && options.targetSerial && options.targetStepCode === "01") {
      order = await reopenCompletedOrderForSerial(options.targetSerial, user.name);
    }
    if (!order || order.status === "\uC644\uB8CC") return;
    const photos = [];
    for (const [index, attachment] of attachments.entries()) {
      const sourcePath = resolvePhotoPath(attachment.filePath);
      if (!sourcePath || !isInsideChatPhotoRoot(sourcePath) || !fs.existsSync(sourcePath)) continue;
      const photo = await saveUploadedPhoto(order, options.targetStepCode, {
        originalName: attachment.originalName || "chat-photo.jpg",
        mimeType: attachment.mimeType || "image/jpeg",
        buffer: fs.readFileSync(sourcePath),
      }, user.name, 1, null, (order.photos?.length || 0) + index);
      photo.memo = "\uCC44\uD305 \uD558\uB2E8 \uC9C0\uC815\uC73C\uB85C \uC5C5\uB85C\uB4DC";
      photos.push(photo);
    }
    if (!photos.length) return;
    await insertPhotoRows(photos);
    const previousStepCode = order.currentStep;
    order.photos.push(...photos);
    order.currentStep = options.targetStepCode;
    order.status = stepStatus(options.targetStepCode);
    if (order.status !== "\uC644\uB8CC") order.completedAt = null;
    order.updatedAt = new Date().toISOString();
    await updateOrderStateRow(order);
    await insertLogRow({
      id: randomUUID(),
      orderId: order.id,
      serial: order.serial,
      action: "\uCC44\uD305 \uD558\uB2E8 \uC9C0\uC815 \uC5C5\uB85C\uB4DC",
      memo: `${options.targetStepCode} ${getStep(options.targetStepCode).name} ${photos.length}장${previousStepCode !== options.targetStepCode ? " / \uB2E8\uACC4 \uC790\uB3D9 \uC218\uC815" : ""}`,
      worker: user.name,
      createdAt: new Date().toISOString(),
    });
    return await readOrderById(order.id) || order;
  }
  const parsed = parseChatOrderText(body);
  if (parsed) {
    const order = makeOrder({ ...parsed, worker: user.name, currentStep: "01" });
    const photos = [];
    for (const [index, attachment] of attachments.entries()) {
      const sourcePath = resolvePhotoPath(attachment.filePath);
      if (!sourcePath || !isInsideChatPhotoRoot(sourcePath) || !fs.existsSync(sourcePath)) continue;
      const photo = await saveUploadedPhoto(order, "01", {
        originalName: attachment.originalName || "chat-photo.jpg",
        mimeType: attachment.mimeType || "image/jpeg",
        buffer: fs.readFileSync(sourcePath),
      }, user.name, 1, null, index);
      photo.memo = "\uC218\uAC70 \uBC0F \uC785\uACE0 \uCC44\uD305 \uC790\uB3D9\uB4F1\uB85D";
      photos.push(photo);
    }
    if (!photos.length) return;
    await insertOrderRow(order);
    await insertPhotoRows(photos);
    await insertLogRow({
      id: randomUUID(),
      orderId: order.id,
      serial: order.serial,
      action: "\uCC44\uD305 \uC790\uB3D9 \uD56D\uBAA9 \uCD94\uAC00",
      memo: `${photos.length}장`,
      worker: user.name,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  const target = parseChatPhotoStepUpload(body);
  if (target) {
    const dbForOrders = await readDb();
    let order = dbForOrders.orders.find((item) => (
      String(item.serial || "").trim().toUpperCase() === target.serial
      && item.status !== "\uC644\uB8CC"
    ));
    if (!order && target.stepCode === "01") {
      order = await reopenCompletedOrderForSerial(target.serial, user.name);
    }
    if (!order) return;
    const photos = [];
    for (const [index, attachment] of attachments.entries()) {
      const sourcePath = resolvePhotoPath(attachment.filePath);
      if (!sourcePath || !isInsideChatPhotoRoot(sourcePath) || !fs.existsSync(sourcePath)) continue;
      const photo = await saveUploadedPhoto(order, target.stepCode, {
        originalName: attachment.originalName || "chat-photo.jpg",
        mimeType: attachment.mimeType || "image/jpeg",
        buffer: fs.readFileSync(sourcePath),
      }, user.name, 1, null, (order.photos?.length || 0) + index);
      photo.memo = "\uC0AC\uC9C4 \uBC29 \uC790\uB3D9 \uC5C5\uB85C\uB4DC";
      photos.push(photo);
    }
    if (!photos.length) return;
    await insertPhotoRows(photos);
    const previousStepCode = order.currentStep;
    order.photos.push(...photos);
    order.currentStep = target.stepCode;
    order.status = stepStatus(target.stepCode);
    if (order.status !== "\uC644\uB8CC") order.completedAt = null;
    order.updatedAt = new Date().toISOString();
    await updateOrderStateRow(order);
    await insertLogRow({
      id: randomUUID(),
      orderId: order.id,
      serial: order.serial,
      action: "\uC0AC\uC9C4 \uBC29 \uC790\uB3D9 \uC5C5\uB85C\uB4DC",
      memo: `${target.stepCode} ${getStep(target.stepCode).name} ${photos.length}장${previousStepCode !== target.stepCode ? " / \uB2E8\uACC4 \uC790\uB3D9 \uC218\uC815" : ""}`,
      worker: user.name,
      createdAt: new Date().toISOString(),
    });
  }
}

async function upsertStepMemo(orderId, stepCode, memo) {
  await mysqlExec(`INSERT INTO order_step_memos (order_step_memos_idx,order_step_memos_order_idx,order_step_memos_step_code,order_step_memos_memo,order_step_memos_updated_at) VALUES (${sql(`${orderId}-${stepCode}`)},${sql(orderId)},${sql(stepCode)},${sql(memo)},NOW()) ON DUPLICATE KEY UPDATE order_step_memos_memo = VALUES(order_step_memos_memo), order_step_memos_updated_at = NOW()`);
}

async function updateOrderTouched(order) {
  await mysqlExec(`UPDATE orders SET orders_worker=${sql(order.worker)}, orders_updated_at=${sqlDate(order.updatedAt)} WHERE orders_idx=${sql(order.id)}`);
}

async function insertLogRow(log) {
  await mysqlExec(`INSERT INTO work_logs (work_logs_idx,work_logs_order_idx,work_logs_serial,work_logs_action_type,work_logs_memo,work_logs_worker,work_logs_created_at) VALUES (${sql(log.id)},${sql(log.orderId)},${sql(log.serial)},${sql(log.action)},${sql(log.memo)},${sql(log.worker)},${sqlDate(log.createdAt)})`);
}

async function insertOrderRow(order) {
  await mysqlExec(`INSERT INTO orders (orders_idx,orders_branch_idx,orders_serial,orders_registration_date,orders_route_type,orders_customer_name,orders_customer_phone,orders_customer_address,orders_product_type,orders_brand,orders_model_name,orders_request_memo,orders_worker,orders_current_step,orders_status,orders_share_status,orders_naver_cafe_status,orders_naver_cafe_url,orders_naver_cafe_posted_at,orders_naver_cafe_error,orders_is_urgent,orders_created_at,orders_updated_at,orders_completed_at) VALUES (${sql(order.id)},'branch-1',${sql(order.serial)},${sql(order.registrationDate)},${sql(order.routeType)},${sql(order.customerName)},${sql(order.phone)},${sql(order.address)},${sql(order.productType)},${sql(order.brand)},${sql(order.modelName)},${sql(order.requestMemo)},${sql(order.worker)},${sql(order.currentStep)},${sql(order.status)},${sql(order.shareStatus)},${sql(order.cafeStatus || "대기")},${sql(order.cafeUrl || "")},${sqlDate(order.cafePostedAt)},${sql(order.cafeError || "")},${order.urgent ? 1 : 0},${sqlDate(order.createdAt)},${sqlDate(order.updatedAt)},${sqlDate(order.completedAt)})`);
}

async function updateOrderRow(order) {
  await mysqlExec(`UPDATE orders SET orders_serial=${sql(order.serial)},orders_registration_date=${sql(order.registrationDate)},orders_route_type=${sql(order.routeType)},orders_customer_name=${sql(order.customerName)},orders_customer_phone=${sql(order.phone)},orders_customer_address=${sql(order.address)},orders_product_type=${sql(order.productType)},orders_brand=${sql(order.brand)},orders_model_name=${sql(order.modelName)},orders_request_memo=${sql(order.requestMemo)},orders_worker=${sql(order.worker)},orders_current_step=${sql(order.currentStep)},orders_status=${sql(order.status)},orders_share_status=${sql(order.shareStatus)},orders_naver_cafe_status=${sql(order.cafeStatus || "대기")},orders_naver_cafe_url=${sql(order.cafeUrl || "")},orders_naver_cafe_posted_at=${sqlDate(order.cafePostedAt)},orders_naver_cafe_error=${sql(order.cafeError || "")},orders_is_urgent=${order.urgent ? 1 : 0},orders_updated_at=${sqlDate(order.updatedAt)},orders_completed_at=${sqlDate(order.completedAt)} WHERE orders_idx=${sql(order.id)}`);
}

async function updateOrderStateRow(order) {
  await mysqlExec(`UPDATE orders SET orders_worker=${sql(order.worker)},orders_current_step=${sql(order.currentStep)},orders_status=${sql(order.status)},orders_share_status=${sql(order.shareStatus)},orders_naver_cafe_status=${sql(order.cafeStatus || "대기")},orders_naver_cafe_url=${sql(order.cafeUrl || "")},orders_naver_cafe_posted_at=${sqlDate(order.cafePostedAt)},orders_naver_cafe_error=${sql(order.cafeError || "")},orders_is_urgent=${order.urgent ? 1 : 0},orders_updated_at=${sqlDate(order.updatedAt)},orders_completed_at=${sqlDate(order.completedAt)} WHERE orders_idx=${sql(order.id)}`);
}

async function moveOrderToTrash(orderId, deletedBy = "") {
  await mysqlExec(`UPDATE orders SET orders_deleted_at=NOW(), orders_deleted_by=${sql(deletedBy)}, orders_updated_at=NOW() WHERE orders_idx=${sql(orderId)}`);
}

async function restoreOrderFromTrash(orderId) {
  await mysqlExec(`UPDATE orders SET orders_deleted_at=NULL, orders_deleted_by=NULL, orders_updated_at=NOW() WHERE orders_idx=${sql(orderId)}`);
}

async function markPhotosDeleted(photoIds, deletedBy = "") {
  if (!photoIds.length) return;
  await mysqlExec(`UPDATE photos SET photos_is_deleted=1, photos_deleted_at=NOW(), photos_deleted_by=${sql(deletedBy)} WHERE photos_idx IN (${photoIds.map(sql).join(",")})`);
}

async function restorePhotosFromTrash(photoIds) {
  if (!photoIds.length) return;
  await mysqlExec(`UPDATE photos SET photos_is_deleted=0, photos_deleted_at=NULL, photos_deleted_by=NULL WHERE photos_idx IN (${photoIds.map(sql).join(",")})`);
}

async function updatePhotoPinRows(photoIds, pinned) {
  if (!photoIds.length) return;
  const statements = photoIds.map((photoId, index) => pinned
    ? `UPDATE photos SET photos_is_pinned=1, photos_pinned_at=DATE_ADD(NOW(), INTERVAL ${index} SECOND) WHERE photos_idx=${sql(photoId)}`
    : `UPDATE photos SET photos_is_pinned=0, photos_pinned_at=NULL WHERE photos_idx=${sql(photoId)}`);
  await mysqlExec(["START TRANSACTION", ...statements, "COMMIT"].join(";\n"));
}

async function upsertAdminMemoRow(memo) {
  await mysqlExec(`INSERT INTO admin_memos (admin_memos_idx,admin_memos_title,admin_memos_body,admin_memos_created_at) VALUES (${sql(memo.id)},${sql(memo.title)},${sql(memo.body)},${sqlDate(memo.createdAt)}) ON DUPLICATE KEY UPDATE admin_memos_title=VALUES(admin_memos_title), admin_memos_body=VALUES(admin_memos_body)`);
}

async function insertAttendanceRow(item) {
  await mysqlExec(`INSERT INTO attendance (attendance_idx,attendance_user_idx,attendance_user_name,attendance_action_type,attendance_created_at) VALUES (${sql(item.id)},${sql(item.userId)},${sql(item.userName)},${sql(item.action)},${sqlDate(item.createdAt)})`);
}

async function replaceAttendanceDayRows(user, dateText, startTime, endTime) {
  const dateMatch = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const startMatch = String(startTime || "").match(/^(\d{2}):(\d{2})$/);
  const endMatch = String(endTime || "").match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !startMatch || !endMatch) throw new AppError(400, "날짜와 시간을 다시 확인해주세요.");
  const [, year, month, day] = dateMatch.map(String);
  const start = new Date(Number(year), Number(month) - 1, Number(day), Number(startMatch[1]), Number(startMatch[2]), 0, 0);
  const end = new Date(Number(year), Number(month) - 1, Number(day), Number(endMatch[1]), Number(endMatch[2]), 0, 0);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new AppError(400, "퇴근 시간은 출근 시간보다 늦어야 합니다.");
  }
  const startOfDay = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  const endOfDay = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  const inRow = { id: randomUUID(), userId: user.id, userName: user.name, action: "in", createdAt: start.toISOString() };
  const outRow = { id: randomUUID(), userId: user.id, userName: user.name, action: "out", createdAt: end.toISOString() };
  await mysqlExec([
    "START TRANSACTION",
    `DELETE FROM attendance WHERE attendance_user_idx=${sql(user.id)} AND attendance_created_at BETWEEN ${sqlDate(startOfDay)} AND ${sqlDate(endOfDay)}`,
    `INSERT INTO attendance (attendance_idx,attendance_user_idx,attendance_user_name,attendance_action_type,attendance_created_at) VALUES (${sql(inRow.id)},${sql(inRow.userId)},${sql(inRow.userName)},'in',${sqlDate(inRow.createdAt)})`,
    `INSERT INTO attendance (attendance_idx,attendance_user_idx,attendance_user_name,attendance_action_type,attendance_created_at) VALUES (${sql(outRow.id)},${sql(outRow.userId)},${sql(outRow.userName)},'out',${sqlDate(outRow.createdAt)})`,
    "COMMIT",
  ].join(";\n"));
}

async function deleteAttendanceDayRows(user, dateText) {
  const dateMatch = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) throw new AppError(400, "날짜를 다시 확인해주세요.");
  const [, year, month, day] = dateMatch.map(String);
  const startOfDay = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  const endOfDay = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  await mysqlExec(`DELETE FROM attendance WHERE attendance_user_idx=${sql(user.id)} AND attendance_created_at BETWEEN ${sqlDate(startOfDay)} AND ${sqlDate(endOfDay)}`);
}

async function updateUserClockRow(user) {
  await mysqlExec(`UPDATE users SET users_clocked_in=${user.clockedIn ? 1 : 0}, users_clock_in_at=${sqlDate(user.clockInAt)} WHERE users_idx=${sql(user.id)}`);
}

async function readUserPasswordHash(userId) {
  const rows = await mysqlQuery(`SELECT users_password_hash FROM users WHERE users_idx=${sql(userId)} LIMIT 1`);
  return rows[0]?.[0] || null;
}

async function updateUserPasswordHash(userId, hash) {
  await mysqlExec(`UPDATE users SET users_password_hash=${sql(hash)} WHERE users_idx=${sql(userId)}`);
}

async function upsertHourlyWageRow(userId, amount) {
  await mysqlExec(`INSERT INTO hourly_wages (hourly_wages_user_idx,hourly_wages_amount,hourly_wages_updated_at) VALUES (${sql(userId)},${Number(amount) || 10320},NOW()) ON DUPLICATE KEY UPDATE hourly_wages_amount=VALUES(hourly_wages_amount), hourly_wages_updated_at=NOW()`);
}

async function upsertPayrollSettingRow(setting) {
  const idx = `${setting.userId}:${setting.monthKey}`;
  await mysqlExec(`INSERT INTO payroll_settings (payroll_settings_idx,payroll_settings_user_idx,payroll_settings_month_key,payroll_settings_delivery_count,payroll_settings_delivery_price,payroll_settings_adjustments_json,payroll_settings_updated_at) VALUES (${sql(idx)},${sql(setting.userId)},${sql(setting.monthKey)},${Math.max(0, Number(setting.deliveryCount) || 0)},${Math.max(0, Number(setting.deliveryPrice) || 0)},${sql(JSON.stringify(setting.adjustments || []))},NOW()) ON DUPLICATE KEY UPDATE payroll_settings_delivery_count=VALUES(payroll_settings_delivery_count), payroll_settings_delivery_price=VALUES(payroll_settings_delivery_price), payroll_settings_adjustments_json=VALUES(payroll_settings_adjustments_json), payroll_settings_updated_at=NOW()`);
}

async function upsertAppSetting(key, value) {
  await mysqlExec(`INSERT INTO app_settings (app_settings_key,app_settings_value,app_settings_updated_at) VALUES (${sql(key)},${sql(JSON.stringify(value || {}))},NOW()) ON DUPLICATE KEY UPDATE app_settings_value=VALUES(app_settings_value), app_settings_updated_at=NOW()`);
}

function normalizeSmsTemplates(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const [target, slots] of Object.entries(source)) {
    if (!target || typeof slots !== "object" || Array.isArray(slots)) continue;
    const cleanSlots = {};
    for (let slot = 1; slot <= 5; slot += 1) {
      if (!Object.prototype.hasOwnProperty.call(slots, slot)) continue;
      cleanSlots[String(slot)] = String(slots[slot] || "").trim().slice(0, 4000);
    }
    if (Object.keys(cleanSlots).length) result[String(target).slice(0, 80)] = cleanSlots;
  }
  return result;
}

function normalizeNaverCafeSettings(body = {}, previous = {}) {
  const defaults = defaultNaverCafeSettings();
  const merged = { ...defaults, ...(previous || {}) };
  const accessToken = String(body.accessToken || "").trim();
  const refreshToken = String(body.refreshToken || "").trim();
  const clientSecret = String(body.clientSecret || "").trim();
  return {
    enabled: Boolean(body.enabled),
    clientId: String(body.clientId || "").trim() || merged.clientId || defaults.clientId,
    clientSecret: clientSecret || merged.clientSecret || defaults.clientSecret,
    clubId: String(body.clubId || "").trim() || defaults.clubId,
    menuId: String(body.menuId || "").trim() || defaults.menuId,
    accessToken: accessToken || merged.accessToken || "",
    refreshToken: refreshToken || merged.refreshToken || "",
    tokenExpiresAt: merged.tokenExpiresAt || null,
    oauthState: merged.oauthState || "",
    titleTemplate: String(body.titleTemplate || "").trim() || defaults.titleTemplate,
    contentTemplate: String(body.contentTemplate || "").trim() || defaults.contentTemplate,
    includePhotos: ["all", "completed"].includes(body.includePhotos) ? body.includePhotos : "all",
    encodingMode: body.encodingMode === "utf8-percent" ? "utf8-percent" : defaults.encodingMode,
  };
}

function endOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function isBeforeLocalToday(value, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

async function autoCloseOvernightAttendance(db) {
  const updates = [];
  for (const user of db.users || []) {
    if (!user.clockedIn || !user.clockInAt || !isBeforeLocalToday(user.clockInAt)) continue;
    const closedAt = endOfLocalDay(user.clockInAt).toISOString();
    const attendance = {
      id: randomUUID(),
      userId: user.id,
      userName: user.name,
      action: "out",
      createdAt: closedAt,
    };
    db.attendance.unshift(attendance);
    user.clockedIn = false;
    user.clockInAt = null;
    updates.push(insertAttendanceRow(attendance).then(() => updateUserClockRow(user)));
  }
  if (updates.length) {
    await Promise.all(updates);
  }
}

async function readUsersOnly() {
  return (await mysqlQuery("SELECT users_idx,users_name,users_role,COALESCE((SELECT branches_name FROM branches WHERE branches.branches_idx = users.users_branch_idx),'본점'),users_clocked_in,users_clock_in_at FROM users WHERE COALESCE(users_is_active,1)=1 ORDER BY users_created_at,users_idx"))
    .map(([id, name, role, branch, clockedIn, clockInAt]) => ({
      id,
      name,
      role,
      branch,
      clockedIn: clockedIn === "1",
      clockInAt: clockInAt ? new Date(clockInAt).toISOString() : null,
    }));
}

function getRequestAdmin(req, users) {
  const userId = req.headers["x-user-id"];
  if (!userId) return null;
  const user = users.find((item) => item.id === userId);
  return user && isAdminRoleValue(user.role) ? user : null;
}

function normalizeMemberRole(value) {
  return isAdminRoleValue(value) || value === "admin" ? ADMIN_ROLE_LABEL : STAFF_ROLE_LABEL;
}

function normalizeMemberName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

async function insertMemberRow(member) {
  await mysqlExec(`INSERT INTO users (users_idx,users_branch_idx,users_name,users_role,users_password_hash,users_is_active,users_clocked_in,users_clock_in_at) VALUES (${sql(member.id)},'branch-1',${sql(member.name)},${sql(member.role)},${sql(member.passwordHash)},1,0,NULL)`);
}

async function deactivateMemberRow(userId) {
  await mysqlExec(`UPDATE users SET users_is_active=0, users_clocked_in=0, users_clock_in_at=NULL WHERE users_idx=${sql(userId)}`);
}

function mapOrderRow(row) {
  const [id, serial, registrationDate, routeType, customerName, phone, address, productType, brand, modelName, requestMemo, worker, currentStep, status, shareStatus, cafeStatus, cafeUrl, cafePostedAt, cafeError, urgent, createdAt, updatedAt, completedAt] = row;
  return {
    id,
    serial,
    registrationDate,
    routeType,
    customerName,
    phone,
    address,
    productType,
    brand,
    modelName,
    requestMemo: fromSqlBase64(requestMemo),
    worker,
    currentStep,
    status,
    shareStatus,
    cafeStatus,
    cafeUrl,
    cafePostedAt: toIso(cafePostedAt),
    cafeError,
    urgent: urgent === "1",
    createdAt: toIso(createdAt),
    updatedAt: toIso(updatedAt),
    completedAt: toIso(completedAt),
    stepMemos: createEmptyStepMemos(),
    photos: [],
  };
}

async function readOrderById(orderId) {
  const rows = await mysqlQuery(`SELECT orders_idx,orders_serial,orders_registration_date,orders_route_type,orders_customer_name,orders_customer_phone,orders_customer_address,orders_product_type,orders_brand,orders_model_name,${sqlBase64("orders_request_memo")},orders_worker,orders_current_step,orders_status,orders_share_status,orders_naver_cafe_status,orders_naver_cafe_url,orders_naver_cafe_posted_at,orders_naver_cafe_error,orders_is_urgent,orders_created_at,orders_updated_at,orders_completed_at FROM orders WHERE orders_idx=${sql(orderId)} AND orders_deleted_at IS NULL LIMIT 1`);
  if (!rows.length) return null;
  const order = mapOrderRow(rows[0]);
  (await mysqlQuery(`SELECT order_step_memos_step_code,${sqlBase64("order_step_memos_memo")} FROM order_step_memos WHERE order_step_memos_order_idx=${sql(order.id)}`)).forEach(([stepCode, memo]) => {
    order.stepMemos[stepCode] = fromSqlBase64(memo) || "";
  });
  (await mysqlQuery(`SELECT photos_idx,photos_order_idx,photos_product_index,photos_sort_order,photos_is_pinned,photos_pinned_at,photos_step_code,photos_step_name,photos_file_path,photos_url,photos_display_file_path,photos_display_url,photos_original_file_name,photos_mime_type,${sqlBase64("photos_memo")},photos_uploaded_by,photos_uploaded_at FROM photos WHERE photos_is_deleted = 0 AND photos_order_idx=${sql(order.id)} ORDER BY photos_is_pinned DESC,photos_pinned_at,photos_sort_order,photos_uploaded_at,photos_idx`))
    .forEach(([id, photoOrderId, productIndex, sortOrder, pinned, pinnedAt, stepCode, stepName, filePath, url, displayFilePath, displayUrl, originalName, mimeType, memo, uploadedBy, uploadedAt]) => {
      order.photos.push({
        id,
        orderId: photoOrderId,
        productIndex: Number(productIndex) || 1,
        sortOrder: Number(sortOrder) || 0,
        pinned: pinned === "1",
        pinnedAt: toIso(pinnedAt),
        stepCode,
        stepName,
        filePath,
        url,
        displayFilePath,
        displayUrl,
        originalName,
        mimeType,
        memo: fromSqlBase64(memo),
        uploadedBy,
        uploadedAt: toIso(uploadedAt),
      });
    });
  return order;
}

function mapTrashPhotoRow(row) {
  const [id, orderId, serial, productIndex, sortOrder, pinned, pinnedAt, stepCode, stepName, filePath, url, displayFilePath, displayUrl, originalName, mimeType, memo, uploadedBy, uploadedAt, deletedAt, deletedBy] = row;
  return {
    id,
    orderId,
    serial,
    productIndex: Number(productIndex) || 1,
    sortOrder: Number(sortOrder) || 0,
    pinned: pinned === "1",
    pinnedAt: toIso(pinnedAt),
    stepCode,
    stepName,
    filePath,
    url,
    displayFilePath,
    displayUrl,
    originalName,
    mimeType,
    memo: fromSqlBase64(memo),
    uploadedBy,
    uploadedAt: toIso(uploadedAt),
    deletedAt: toIso(deletedAt),
    deletedBy,
  };
}

async function readTrashSummary() {
  await ensureMariaDbColumns();
  const deletedOrders = (await mysqlQuery(`SELECT orders_idx,orders_serial,orders_registration_date,orders_route_type,orders_customer_name,orders_customer_phone,orders_customer_address,orders_product_type,orders_brand,orders_model_name,${sqlBase64("orders_request_memo")},orders_worker,orders_current_step,orders_status,orders_share_status,orders_is_urgent,orders_created_at,orders_updated_at,orders_completed_at,orders_deleted_at,orders_deleted_by FROM orders WHERE orders_deleted_at IS NOT NULL ORDER BY orders_deleted_at DESC LIMIT 200`))
    .map((row) => {
      const order = mapOrderRow(row.slice(0, 19));
      order.deletedAt = toIso(row[19]);
      order.deletedBy = row[20] || "";
      order.photos = [];
      return order;
    });
  const deletedOrderById = new Map(deletedOrders.map((order) => [order.id, order]));
  if (deletedOrders.length) {
    const orderIds = deletedOrders.map((order) => sql(order.id)).join(",");
    (await mysqlQuery(`SELECT photos_idx,photos_order_idx,photos_product_index,photos_sort_order,photos_is_pinned,photos_pinned_at,photos_step_code,photos_step_name,photos_file_path,photos_url,photos_display_file_path,photos_display_url,photos_original_file_name,photos_mime_type,${sqlBase64("photos_memo")},photos_uploaded_by,photos_uploaded_at FROM photos WHERE photos_order_idx IN (${orderIds}) AND photos_is_deleted = 0 ORDER BY photos_is_pinned DESC,photos_pinned_at,photos_sort_order,photos_uploaded_at,photos_idx`))
      .forEach(([id, orderId, productIndex, sortOrder, pinned, pinnedAt, stepCode, stepName, filePath, url, displayFilePath, displayUrl, originalName, mimeType, memo, uploadedBy, uploadedAt]) => {
        const order = deletedOrderById.get(orderId);
        if (!order || order.photos.length >= 6) return;
        order.photos.push({
          id,
          orderId,
          productIndex: Number(productIndex) || 1,
          sortOrder: Number(sortOrder) || 0,
          pinned: pinned === "1",
          pinnedAt: toIso(pinnedAt),
          stepCode,
          stepName,
          filePath,
          url,
          displayFilePath,
          displayUrl,
          originalName,
          mimeType,
          memo: fromSqlBase64(memo),
          uploadedBy,
          uploadedAt: toIso(uploadedAt),
        });
      });
  }
  const deletedPhotos = (await mysqlQuery(`SELECT p.photos_idx,p.photos_order_idx,o.orders_serial,p.photos_product_index,p.photos_sort_order,p.photos_is_pinned,p.photos_pinned_at,p.photos_step_code,p.photos_step_name,p.photos_file_path,p.photos_url,p.photos_display_file_path,p.photos_display_url,p.photos_original_file_name,p.photos_mime_type,${sqlBase64("p.photos_memo")},p.photos_uploaded_by,p.photos_uploaded_at,p.photos_deleted_at,p.photos_deleted_by FROM photos p LEFT JOIN orders o ON o.orders_idx=p.photos_order_idx WHERE p.photos_is_deleted = 1 ORDER BY p.photos_deleted_at DESC,p.photos_uploaded_at DESC LIMIT 300`))
    .map(mapTrashPhotoRow);
  return { orders: deletedOrders, photos: deletedPhotos };
}

async function readPhotoByOrderAndFilename(orderId, filename) {
  const cached = photoPathCache.get(photoCacheKey(orderId, filename));
  if (cached) return cached;
  const rows = await mysqlQuery(`SELECT photos_file_path,photos_display_file_path,photos_original_file_name FROM photos WHERE photos_is_deleted = 0 AND photos_order_idx=${sql(orderId)} AND (photos_file_path LIKE ${sql(`%${filename}`)} OR photos_display_file_path LIKE ${sql(`%${filename}`)}) LIMIT 1`);
  if (!rows.length) return null;
  const [filePath, displayFilePath, originalName] = rows[0];
  const useDisplay = displayFilePath && path.basename(displayFilePath) === filename;
  const photo = {
    filePath: useDisplay ? displayFilePath : filePath,
    originalName,
  };
  rememberPhotoPath(orderId, photo.filePath, originalName);
  return photo;
}

async function resizeImageWithSharp(sourcePath, targetPath, maxSize = 1400, quality = 72) {
  if (!sharp) throw new Error("sharp is not installed");
  await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality,
      mozjpeg: true,
    })
    .toFile(targetPath);
}

async function resizeImageBuffer(buffer, maxSize = 1400, quality = 72) {
  if (!sharp) throw new Error("이미지 가공 기능을 사용할 수 없습니다.");
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality,
      mozjpeg: true,
    })
    .toBuffer();
}

async function updatePhotoDisplayPath(photoId, displayFilePath, displayUrl) {
  await mysqlExec(`UPDATE photos SET photos_display_file_path=${sql(displayFilePath)}, photos_display_url=${sql(displayUrl)} WHERE photos_idx=${sql(photoId)}`);
}

async function upsertShortShareLink(orderId, hiddenPhotoIds = [], customerMemo = "") {
  await ensureMariaDbColumns();
  const existing = await mysqlQuery(`SELECT share_links_idx FROM share_links WHERE share_links_order_idx=${sql(orderId)} LIMIT 1`);
  const token = existing[0]?.[0] || randomUUID().replace(/-/g, "").slice(0, 10);
  const hiddenJson = JSON.stringify(hiddenPhotoIds);
  await mysqlExec(`INSERT INTO share_links (share_links_idx,share_links_order_idx,share_links_hidden_photo_ids,share_links_customer_memo,share_links_created_at,share_links_updated_at) VALUES (${sql(token)},${sql(orderId)},${sql(hiddenJson)},${sql(customerMemo)},NOW(),NOW()) ON DUPLICATE KEY UPDATE share_links_hidden_photo_ids=VALUES(share_links_hidden_photo_ids),share_links_customer_memo=VALUES(share_links_customer_memo),share_links_updated_at=NOW()`);
  return token;
}

async function readShortShareLink(token) {
  await ensureMariaDbColumns();
  const rows = await mysqlQuery(`SELECT share_links_order_idx,${sqlBase64("share_links_hidden_photo_ids")},${sqlBase64("share_links_customer_memo")} FROM share_links WHERE share_links_idx=${sql(token)} LIMIT 1`);
  if (!rows.length) return null;
  const [orderId, hiddenPhotoIds, customerMemo] = rows[0];
  return {
    orderId,
    hiddenPhotoIds: parseJsonField(fromSqlBase64(hiddenPhotoIds), []),
    customerMemo: fromSqlBase64(customerMemo) || "",
  };
}

async function readShortShareLinkByOrderId(orderId) {
  await ensureMariaDbColumns();
  const rows = await mysqlQuery(`SELECT share_links_idx,${sqlBase64("share_links_hidden_photo_ids")},${sqlBase64("share_links_customer_memo")} FROM share_links WHERE share_links_order_idx=${sql(orderId)} LIMIT 1`);
  if (!rows.length) return null;
  const [token, hiddenPhotoIds, customerMemo] = rows[0];
  return {
    token,
    orderId,
    hiddenPhotoIds: parseJsonField(fromSqlBase64(hiddenPhotoIds), []),
    customerMemo: fromSqlBase64(customerMemo) || "",
  };
}

async function generateDisplayImagesForPhotos(order, photos) {
  if (!sharp) return;
  for (const photo of photos) {
    if (photo.displayFilePath || !(photo.mimeType || "").startsWith("image/")) continue;
    const sourcePath = resolvePhotoPath(photo.filePath);
    if (!sourcePath || !fs.existsSync(sourcePath)) continue;
    const displayFolder = path.join(path.dirname(sourcePath), "_display");
    fs.mkdirSync(displayFolder, { recursive: true });
    const displayFilename = displayPhotoFilename(order, photo.stepCode, photo.originalName || path.basename(sourcePath));
    const displayFilePath = path.join(displayFolder, displayFilename);
    try {
      await resizeImageWithSharp(sourcePath, displayFilePath);
      const displayUrl = `/photos/${encodeURIComponent(order.id)}/${encodeURIComponent(displayFilename)}`;
      await updatePhotoDisplayPath(photo.id, displayFilePath, displayUrl);
      photo.displayFilePath = displayFilePath;
      photo.displayUrl = displayUrl;
      rememberPhotoPath(order.id, displayFilePath, photo.originalName);
      logInfo("Display image generated", `order=${order.serial || order.id} photoId=${photo.id}`);
    } catch (error) {
      logError("Display image generation failed", error, sourcePath);
      if (fs.existsSync(displayFilePath)) {
        try {
          fs.unlinkSync(displayFilePath);
        } catch {}
      }
    }
  }
}

function queueDisplayImageGeneration(order, photos) {
  if (!sharp || !photos.some((photo) => !photo.displayFilePath && (photo.mimeType || "").startsWith("image/"))) return;
  setImmediate(() => {
    generateDisplayImagesForPhotos(order, photos).catch((error) => {
      logError("Display image background job failed", error, `order=${order.serial || order.id}`);
    });
  });
}

async function migrateExistingDisplayImages() {
  let converted = 0;
  let skipped = 0;
  if (!sharp) {
    logInfo("Display image migration skipped", "sharp is not installed. Run npm install first.");
    return;
  }
  try {
    const db = await readDb();
    for (const order of db.orders) {
      for (const photo of order.photos || []) {
        if (photo.displayFilePath || !(photo.mimeType || "").startsWith("image/")) continue;
        const sourcePath = resolvePhotoPath(photo.filePath);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          skipped += 1;
          continue;
        }
        const folder = path.dirname(sourcePath);
        const displayFolder = path.join(folder, "_display");
        fs.mkdirSync(displayFolder, { recursive: true });
        const displayFilename = displayPhotoFilename(order, photo.stepCode, photo.originalName || path.basename(sourcePath));
        const displayFilePath = path.join(displayFolder, displayFilename);
        try {
          await resizeImageWithSharp(sourcePath, displayFilePath);
          const displayUrl = `/photos/${encodeURIComponent(order.id)}/${encodeURIComponent(displayFilename)}`;
          await updatePhotoDisplayPath(photo.id, displayFilePath, displayUrl);
          converted += 1;
        } catch (error) {
          skipped += 1;
          logError("Display image conversion failed", error, sourcePath);
          if (fs.existsSync(displayFilePath)) {
            try {
              fs.unlinkSync(displayFilePath);
            } catch {}
          }
        }
      }
    }
  } catch (error) {
    logError("Display image migration skipped", error);
    return;
  }
  if (converted || skipped) logInfo("Display image migration finished", `converted=${converted} skipped=${skipped}`);
}

function getRequestUser(req, db) {
  const userId = req.headers["x-user-id"];
  return db.users.find((item) => item.id === userId) || db.users[0];
}

function upsertAdminMemo(db, id, title, body) {
  const now = new Date().toISOString();
  const memo = db.adminMemos.find((item) => item.id === id);
  if (memo) {
    memo.title = title;
    memo.body = body || "";
    return memo;
  }
  const created = { id, title, body: body || "", createdAt: now };
  db.adminMemos.unshift(created);
  return created;
}

function keepNoteRole(note, user) {
  if (!note || !user) return "";
  if (note.ownerId === user.id) return "owner";
  return note.collaborators.find((item) => item.userId === user.id)?.permission || "";
}

function canViewKeepNote(note, user) {
  return Boolean(keepNoteRole(note, user));
}

function canEditKeepNote(note, user) {
  const role = keepNoteRole(note, user);
  return role === "owner" || role === "edit";
}

function cafeDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

function cafeProductName(order) {
  const parts = [order.brand, order.modelName, order.productType]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" ").trim()
    || order.productType
    || order.serial
    || "작업 사진";
}

function cleanCafeProductPart(value, maxLength = 18) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\/|+]/g, " ")
    .replace(/\b\d{3,4}\b/g, " ")
    .replace(/\b\d+\s*만원\b/g, " ")
    .replace(/(?:님|선결|후결|입금|연락처|뒷번호|주소|휴대|휴대용|작업자).*/g, " ")
    .replace(/[^\p{Script=Hangul}A-Za-z0-9\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

function naverCafeTitleProductName(order) {
  const productType = cleanCafeProductPart(order.productType, 10);
  const brand = cleanCafeProductPart(order.brand, 14);
  const rawModel = cleanCafeProductPart(order.modelName, 18);
  const model = rawModel && rawModel !== brand && rawModel !== productType ? rawModel : "";
  const parts = [brand, model, productType].filter(Boolean);
  if (parts.length) return [...new Set(parts)].join(" ");
  return cleanCafeProductPart(order.serial, 10) || "아기용품";
}

function orderTemplateValue(order, template) {
  return String(template || "")
    .replaceAll("{serial}", order.serial || "")
    .replaceAll("{productName}", cafeProductName(order))
    .replaceAll("{customerName}", order.customerName || "")
    .replaceAll("{phone}", order.phone || "")
    .replaceAll("{address}", order.address || "")
    .replaceAll("{productType}", order.productType || "")
    .replaceAll("{brand}", order.brand || "")
    .replaceAll("{modelName}", order.modelName || "")
    .replaceAll("{completedDate}", cafeDateLabel(order.completedAt || order.updatedAt || order.createdAt));
}

function naverCafePhotoList(order, settings, hiddenPhotoIds = []) {
  const hidden = new Set(hiddenPhotoIds || []);
  const photos = (order.photos || [])
    .filter((photo) => (photo.mimeType || "").startsWith("image/"))
    .filter((photo) => !hidden.has(photo.id))
    .slice()
    .sort(compareCustomerPhotoOrder);
  return photos
    .map((photo) => ({ ...photo, localPath: resolvePhotoPath(photo.displayFilePath || photo.filePath) }))
    .filter((photo) => photo.localPath && fs.existsSync(photo.localPath));
}

function naverCafeGroupedPhotos(photos) {
  const used = new Set();
  const groups = NAVER_CAFE_PHOTO_GROUPS
    .map((group) => {
      const items = photos.filter((photo) => {
        const matched = group.codes.includes(String(photo.stepCode || "").padStart(2, "0"));
        if (matched) used.add(photo.id);
        return matched;
      });
      return { ...group, photos: items };
    })
    .filter((group) => group.photos.length);
  const others = photos.filter((photo) => !used.has(photo.id));
  if (others.length) groups.push({ title: "기타", codes: [], photos: others });
  return groups;
}

function naverCafePublicPhotoUrl(photo, baseUrl) {
  const raw = String(photo?.displayUrl || photo?.url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!baseUrl) return raw;
  try {
    return new URL(raw, `${baseUrl.replace(/\/+$/, "")}/`).href;
  } catch {
    return raw;
  }
}

function naverCafeHtmlText(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br>");
}

function naverCafePlainTextFromHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function naverCafePhotoTable(photos, baseUrl) {
  const rows = [];
  for (let index = 0; index < photos.length; index += 2) {
    const rowPhotos = photos.slice(index, index + 2);
    const cells = rowPhotos.map((photo) => {
      const imageUrl = naverCafePublicPhotoUrl(photo, baseUrl);
      if (!imageUrl) return "";
      return `<td width="50%" style="width:50%;padding:4px;vertical-align:top;"><img src="${escapeHtml(imageUrl)}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0;" alt="작업사진"></td>`;
    });
    if (cells.length === 1) cells.push(`<td width="50%" style="width:50%;padding:4px;"></td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 30px 0;"><tbody>${rows.join("")}</tbody></table>`;
}

function naverCafePhotoSections(photos, baseUrl) {
  return NAVER_CAFE_PHOTO_GROUPS
    .map((group) => {
      const groupPhotos = photos.filter((photo) => group.codes.includes(String(photo.stepCode || "").padStart(2, "0")));
      const table = groupPhotos.length
        ? naverCafePhotoTable(groupPhotos, baseUrl)
        : `<p style="margin:0 0 30px 0;color:#888;">사진 없음</p>`;
      return `<p style="margin:0 0 22px 0;font-weight:700;">${escapeHtml(group.title)}</p>${table}`;
    })
    .join("");
}

function selectNaverCafeUploadPhotos(photos, maxCount = NAVER_CAFE_MAX_ATTACHMENTS) {
  if (photos.length <= maxCount) return photos;
  const groups = naverCafeGroupedPhotos(photos).filter((group) => group.photos.length);
  if (!groups.length) return photos.slice(0, maxCount);
  const selected = [];
  const selectedIds = new Set();
  let cursor = 0;
  while (selected.length < maxCount) {
    let added = false;
    for (const group of groups) {
      const photo = group.photos[cursor];
      if (photo && !selectedIds.has(photo.id)) {
        selected.push(photo);
        selectedIds.add(photo.id);
        added = true;
        if (selected.length >= maxCount) break;
      }
    }
    if (!added) break;
    cursor += 1;
  }
  return selected.sort(compareCustomerPhotoOrder);
}

function buildNaverCafeContent(order, settings, photos, shareUrl, uploadPhotoCount = photos.length, baseUrl = "") {
  const defaultIntro = defaultNaverCafeSettings().contentTemplate;
  const template = String(settings.contentTemplate || "").trim();
  const intro = orderTemplateValue(order, !template || template === "{productName}" ? defaultIntro : template).trim() || defaultIntro;
  const photoSections = naverCafePhotoSections(photos, baseUrl);
  return [
    `<p style="margin:0 0 34px 0;">${naverCafeHtmlText(intro)}</p>`,
    `<p style="margin:0 0 58px 0;"><a href="${escapeHtml(BEBEU_NAVER_PLACE_URL)}">네이버 플레이스 (${escapeHtml(BEBEU_STORE_ADDRESS)})</a></p>`,
    `<p style="margin:0 0 36px 0;">고객님에게 제공하는 세탁 전,후,살균 링크입니다 😊🙏${shareUrl ? `<br><a href="${escapeHtml(shareUrl)}">${escapeHtml(shareUrl)}</a>` : ""}</p>`,
    photoSections,
    `<p style="margin:34px 0 0 0;">${naverCafeHtmlText(NAVER_CAFE_FOOTER_TEXT)}</p>`,
  ].filter((value) => String(value || "").trim()).join("\n");
}

function buildCompactNaverCafeContent(order, settings, photos, shareUrl, uploadPhotoCount = photos.length) {
  const defaultIntro = defaultNaverCafeSettings().contentTemplate;
  const template = String(settings.contentTemplate || "").trim();
  const intro = orderTemplateValue(order, !template || template === "{productName}" ? defaultIntro : template).trim() || defaultIntro;
  return [
    intro,
    "",
    `${BEBEU_STORE_ADDRESS}`,
    `네이버 플레이스: ${BEBEU_NAVER_PLACE_URL}`,
    "",
    "고객님에게 제공하는 세탁 전,후,살균 링크입니다.",
    shareUrl || "",
    "",
    `카페에는 선택된 대표 사진 ${uploadPhotoCount}장을 첨부했습니다. 전체 사진 ${photos.length}장은 위 링크에서 확인해주세요.`,
    "",
    "< 예약 및 문의 010.5796.6553 >",
    "https://link.inpock.co.kr/ggtyclean2",
  ].filter((value) => String(value || "").trim()).join("\n");
}

function cleanNaverCafeText(value, options = {}) {
  const maxLength = Number(options.maxLength) || 0;
  const singleLine = Boolean(options.singleLine);
  let text = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200B-\u200D\uFE0F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ");
  if (singleLine) text = text.replace(/[\r\n/|+]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (maxLength && text.length > maxLength) text = `${text.slice(0, maxLength - 1).trim()}…`;
  return text;
}

function safeNaverCafeSubject(order, settings) {
  const productName = cleanNaverCafeText(naverCafeTitleProductName(order), { singleLine: true, maxLength: 42 }) || cleanNaverCafeText(order.serial || "아기용품", { singleLine: true, maxLength: 12 });
  return cleanNaverCafeText(`광주 ${productName} 세탁 베베유`, { singleLine: true, maxLength: 60 });
}

function cleanNaverCafeContent(content, maxLength = 4000) {
  return cleanNaverCafeText(content, { maxLength });
}

function buildLinkOnlyNaverCafeContent(order, shareUrl) {
  return cleanNaverCafeContent([
    "24시간 오픈 / 광주 무료수거배달 / 매장방문 10% 상시할인",
    "",
    BEBEU_STORE_ADDRESS,
    `네이버 플레이스: ${BEBEU_NAVER_PLACE_URL}`,
    "",
    "고객님에게 제공하는 세탁 전,후,살균 링크입니다.",
    shareUrl || "",
    "",
    "전체 작업사진은 위 링크에서 확인해주세요.",
    "",
    "예약 및 문의 010.5796.6553",
    "https://link.inpock.co.kr/ggtyclean2",
  ].filter(Boolean).join("\n"), 1000);
}

async function naverCafeAttachment(photo, order, index) {
  const source = fs.readFileSync(photo.localPath);
  if (sharp && (photo.mimeType || "").startsWith("image/")) {
    try {
      const buffer = await sharp(source, { failOn: "none" })
        .rotate()
        .resize({ width: NAVER_CAFE_IMAGE_MAX_WIDTH, height: NAVER_CAFE_IMAGE_MAX_WIDTH, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      return {
        buffer,
        type: "image/jpeg",
        filename: safeName(`${order.serial}_${String(index + 1).padStart(2, "0")}.jpg`),
      };
    } catch (error) {
      logWarning("Naver Cafe image resize skipped", JSON.stringify({
        orderId: order.id,
        serial: order.serial,
        photoId: photo.id,
        message: error.message,
      }));
    }
  }
  const type = photo.mimeType || "image/jpeg";
  const filename = safeName(photo.originalName || `${order.serial}_${String(index + 1).padStart(2, "0")}.jpg`);
  return { buffer: source, type, filename };
}

function cp949Buffer(value) {
  return iconv.encode(String(value || ""), "cp949");
}

function formUrlEncodeCp949(fields) {
  return Buffer.from(Object.entries(fields).map(([key, value]) => {
    const encoded = Array.from(cp949Buffer(value)).map((byte) => {
      const char = String.fromCharCode(byte);
      if (/^[A-Za-z0-9_.~-]$/.test(char)) return char;
      if (byte === 0x20) return "+";
      return `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }).join("");
    return `${encodeURIComponent(key)}=${encoded}`;
  }).join("&"), "ascii");
}

function formRawCp949(fields) {
  const chunks = [];
  Object.entries(fields).forEach(([key, value], index) => {
    if (index) chunks.push(Buffer.from("&", "ascii"));
    chunks.push(Buffer.from(`${encodeURIComponent(key)}=`, "ascii"));
    chunks.push(cp949Buffer(value));
  });
  return Buffer.concat(chunks);
}

function naverCafeUtf8PercentText(value) {
  return encodeURIComponent(String(value || ""));
}

function multipartAscii(value) {
  return Buffer.from(value, "ascii");
}

async function buildNaverCafeMultipartBody(subject, content, photos, order, textEncoding = "cp949") {
  const boundary = `----bebeu-naver-${randomUUID().replaceAll("-", "")}`;
  const chunks = [];
  const isCp949 = textEncoding === "cp949";
  const appendTextPart = (name, value) => {
    chunks.push(multipartAscii(`--${boundary}\r\n`));
    chunks.push(multipartAscii(`Content-Disposition: form-data; name="${name}"\r\n`));
    chunks.push(multipartAscii(`Content-Type: text/plain; charset=${isCp949 ? "EUC-KR" : "UTF-8"}\r\n\r\n`));
    chunks.push(isCp949 ? cp949Buffer(value) : Buffer.from(String(value || ""), "utf8"));
    chunks.push(multipartAscii("\r\n"));
  };
  appendTextPart("subject", subject);
  appendTextPart("content", content);
  for (let index = 0; index < photos.length; index += 1) {
    const attachment = await naverCafeAttachment(photos[index], order, index);
    const extension = attachment.type.includes("png") ? "png" : attachment.type.includes("webp") ? "webp" : "jpg";
    const filename = `${safeName(order?.serial || "bebeu")}_${String(index + 1).padStart(2, "0")}.${extension}`;
    chunks.push(multipartAscii(`--${boundary}\r\n`));
    chunks.push(multipartAscii(`Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`));
    chunks.push(multipartAscii(`Content-Type: ${attachment.type || "image/jpeg"}\r\n\r\n`));
    chunks.push(attachment.buffer);
    chunks.push(multipartAscii("\r\n"));
  }
  chunks.push(multipartAscii(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(chunks) };
}

async function sendNaverCafeArticle(settings, subject, content, photos, order) {
  const mode = settings.encodingMode === "utf8-percent" ? "utf8-percent" : defaultNaverCafeSettings().encodingMode;
  if (mode === "utf8-percent") {
    subject = naverCafeUtf8PercentText(subject);
    content = naverCafeUtf8PercentText(content);
  }
  if (!photos.length && mode === "url-utf8") {
    const body = new URLSearchParams({ subject, content });
    const response = await fetch(`${NAVER_CAFE_API_BASE}/${encodeURIComponent(settings.clubId)}/menu/${encodeURIComponent(settings.menuId)}/articles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    return { response, text, payload };
  }
  if (!photos.length && (mode === "url-cp949" || mode === "utf8-percent")) {
    const body = formUrlEncodeCp949({ subject, content });
    const response = await fetch(`${NAVER_CAFE_API_BASE}/${encodeURIComponent(settings.clubId)}/menu/${encodeURIComponent(settings.menuId)}/articles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=EUC-KR",
        "Content-Length": String(body.length),
      },
      body,
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    return { response, text, payload };
  }
  if (!photos.length && mode === "url-cp949-raw") {
    const body = formRawCp949({ subject, content });
    const response = await fetch(`${NAVER_CAFE_API_BASE}/${encodeURIComponent(settings.clubId)}/menu/${encodeURIComponent(settings.menuId)}/articles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=EUC-KR",
        "Content-Length": String(body.length),
      },
      body,
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    return { response, text, payload };
  }
  const multipartEncoding = mode === "multipart-utf8" ? "utf8" : "cp949";
  const { boundary, body } = await buildNaverCafeMultipartBody(subject, content, photos, order, multipartEncoding);
  const response = await fetch(`${NAVER_CAFE_API_BASE}/${encodeURIComponent(settings.clubId)}/menu/${encodeURIComponent(settings.menuId)}/articles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}; charset=${multipartEncoding === "cp949" ? "EUC-KR" : "UTF-8"}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { response, text, payload };
}

function isNaverCafeRetryableFailure(response, payload) {
  const code = String(payload?.message?.error?.code || payload?.errorCode || "");
  const message = String(payload?.message?.error?.msg || payload?.errorMessage || payload?.message || payload?.raw || "");
  return [403, 500, 502, 503, 504].includes(response.status) && (code === "999" || /Bad Gateway|오류가 발생|temporar|gateway|upstream/i.test(message));
}

function naverEncodingProbeLines(sample) {
  const utf8AsCp949 = iconv.decode(Buffer.from(sample, "utf8"), "cp949");
  const cp949AsUtf8 = iconv.encode(sample, "cp949").toString("utf8");
  const cp949AsLatin1 = iconv.encode(sample, "cp949").toString("latin1");
  const utf8Percent = encodeURIComponent(sample);
  const cp949Percent = Array.from(cp949Buffer(sample)).map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  return [
    "[A 원문] " + sample,
    "[B UTF8을 CP949로 읽은 형태] " + utf8AsCp949,
    "[C CP949를 UTF8로 읽은 형태] " + cp949AsUtf8,
    "[D CP949 Latin1 원문 바이트] " + cp949AsLatin1,
    "[E UTF8 퍼센트] " + utf8Percent,
    "[F CP949 퍼센트] " + cp949Percent,
  ];
}

async function testNaverCafePost(settings, mode = "") {
  settings = await refreshNaverAccessTokenIfNeeded(settings);
  const encodingMode = NAVER_CAFE_ENCODING_MODES.has(mode) ? mode : settings.encodingMode;
  settings = { ...settings, encodingMode };
  const required = [
    ["accessToken", "네이버 접근 토큰"],
    ["clubId", "카페 ID"],
    ["menuId", "게시판 ID"],
  ].filter(([key]) => !String(settings[key] || "").trim());
  if (required.length) {
    throw new AppError(400, `${required.map(([, label]) => label).join(", ")} 설정이 필요합니다.`);
  }
  const timestamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const sample = "베베유 네이버 카페 API 글쓰기 테스트";
  const subject = `BEBEU encoding test ${Date.now()}`;
  const content = [
    "아래 줄 중 한글이 정상으로 보이는 줄의 알파벳을 알려주세요.",
    `현재 전송방식: ${encodingMode}`,
    `작성시간: ${timestamp}`,
    "",
    ...naverEncodingProbeLines(sample),
  ].join("\n");
  const result = await sendNaverCafeArticle(settings, subject, content, [], null);
  const details = {
    httpStatus: result.response.status,
    httpStatusText: result.response.statusText,
    clubId: settings.clubId,
    menuId: settings.menuId,
    subject,
    content,
    encodingMode,
    response: result.payload,
    raw: String(result.text || "").slice(0, 2000),
    articleUrl: findNaverCafeArticleUrl(result.payload),
  };
  logInfo("Naver Cafe test post result", JSON.stringify(details));
  if (!result.response.ok) {
    const error = new AppError(result.response.status, "네이버 카페 테스트 글쓰기에 실패했습니다.");
    error.details = {
      ...details,
      naverStatus: result.payload?.message?.status || "",
      naverCode: result.payload?.message?.error?.code || result.payload?.errorCode || "",
      naverMessage: result.payload?.message?.error?.msg || result.payload?.errorMessage || result.payload?.message || "",
      hint: "사진 없이 제목과 본문만 보내는 최소 테스트도 실패했습니다. 토큰 권한, 카페 ID, 게시판 ID, 게시판 API 글쓰기 허용 여부를 확인해야 합니다.",
    };
    throw error;
  }
  return details;
}

function naverCafeErrorDetails({ order, settings, response, payload, text, subject, attempt, photos }) {
  const naverMessage = payload?.message || null;
  const naverError = naverMessage?.error || null;
  return {
    httpStatus: response.status,
    httpStatusText: response.statusText,
    naverStatus: naverMessage?.status || "",
    naverCode: naverError?.code || payload?.errorCode || "",
    naverMessage: naverError?.msg || payload?.errorMessage || payload?.message || "",
    attemptMode: attempt.mode,
    clubId: settings.clubId,
    menuId: settings.menuId,
    subject,
    subjectLength: subject.length,
    contentLength: attempt.content.length,
    totalPhotoCount: photos.length,
    attachedPhotoCount: attempt.photos.length,
    attachmentLimit: NAVER_CAFE_MAX_ATTACHMENTS,
    raw: String(text || "").slice(0, 2000),
    hint: response.status === 403 && String(naverError?.code || "") === "999"
      ? "네이버가 게시글 등록 처리 중 내부 오류를 반환했습니다. 제목/본문/사진을 줄인 링크 전용 요청도 실패하면 카페 ID, 게시판 ID, 게시판 종류, 네이버 API 글쓰기 허용 여부를 확인해야 합니다."
      : "",
  };
}

function formatNaverCafeErrorMessage(details) {
  return [
    "네이버 카페 업로드 실패",
    `HTTP: ${details.httpStatus} ${details.httpStatusText || ""}`.trim(),
    details.naverStatus ? `Naver status: ${details.naverStatus}` : "",
    details.naverCode ? `Naver code: ${details.naverCode}` : "",
    details.naverMessage ? `Naver message: ${details.naverMessage}` : "",
    `시도 방식: ${details.attemptMode}`,
    `카페/게시판: ${details.clubId} / ${details.menuId}`,
    `제목(${details.subjectLength}자): ${details.subject}`,
    `본문 길이: ${details.contentLength}자`,
    `사진: 전체 ${details.totalPhotoCount}장 / 첨부 ${details.attachedPhotoCount}장`,
    details.hint ? `확인 필요: ${details.hint}` : "",
  ].filter(Boolean).join("\n");
}

function buildNaverCafeSubject(order, settings) {
  const defaultTitle = defaultNaverCafeSettings().titleTemplate;
  const template = String(settings.titleTemplate || "").trim();
  return orderTemplateValue(order, !template || template === "{productName}" ? defaultTitle : template).trim()
    || `${order.serial} 작업 완료 사진`;
}

function findNaverCafeArticleUrl(result) {
  const candidates = [
    result?.message?.result?.url,
    result?.message?.result?.articleUrl,
    result?.message?.result?.articleurl,
    result?.result?.url,
    result?.result?.articleUrl,
    result?.url,
  ];
  return candidates.find(Boolean) || "";
}

function naverCafeWriteUrl(settings) {
  const clubId = encodeURIComponent(settings.clubId);
  const menuId = encodeURIComponent(settings.menuId);
  return `https://cafe.naver.com/ca-fe/cafes/${clubId}/menus/${menuId}/articles/write`;
}

function requireNaverCafeAutomation() {
  if (!playwrightChromium) {
    throw new AppError(500, "Playwright가 설치되어 있지 않습니다. 운영 서버의 v2 폴더에서 npm install 후 다시 실행해주세요.");
  }
}

async function getNaverCafeAutomationContext() {
  requireNaverCafeAutomation();
  if (naverCafeAutomationContext) {
    try {
      if (naverCafeAutomationContext.pages) return naverCafeAutomationContext;
    } catch {
      naverCafeAutomationContext = null;
    }
  }
  await fsp.mkdir(NAVER_CAFE_AUTOMATION_PROFILE, { recursive: true });
  naverCafeAutomationContext = await playwrightChromium.launchPersistentContext(NAVER_CAFE_AUTOMATION_PROFILE, {
    headless: NAVER_CAFE_AUTOMATION_HEADLESS,
    viewport: { width: 1365, height: 900 },
    acceptDownloads: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  naverCafeAutomationContext.on("close", () => {
    naverCafeAutomationContext = null;
  });
  return naverCafeAutomationContext;
}

async function openNaverCafeAutomationLogin(settings) {
  const context = await getNaverCafeAutomationContext();
  const page = await context.newPage();
  await page.goto("https://nid.naver.com/nidlogin.login", { waitUntil: "domcontentloaded", timeout: 60000 });
  return {
    loginUrl: page.url(),
    profilePath: NAVER_CAFE_AUTOMATION_PROFILE,
    writeUrl: naverCafeWriteUrl(settings),
  };
}

async function firstVisibleLocator(root, selectors, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    for (const selector of selectors) {
      const locator = root.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const item = locator.nth(index);
        if (await item.isVisible().catch(() => false)) return item;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function fillNaverCafeTitle(page, subject) {
  const title = await firstVisibleLocator(page, [
    'textarea[placeholder*="제목"]',
    'input[placeholder*="제목"]',
    'textarea[name="subject"]',
    'input[name="subject"]',
    '[contenteditable="true"][aria-label*="제목"]',
    '[contenteditable="true"][placeholder*="제목"]',
  ]);
  if (!title) throw new AppError(500, "네이버 카페 제목 입력칸을 찾지 못했습니다.");
  await title.click();
  await title.fill(subject).catch(async () => {
    await title.evaluate((element, value) => {
      element.focus?.();
      if ("value" in element) {
        element.value = value;
      } else {
        element.textContent = value;
      }
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, subject);
  });
  await title.evaluate((element) => element.blur?.()).catch(() => {});
}

async function findNaverCafeEditor(page) {
  const selectors = [
    '[data-a11y-title*="본문"] [contenteditable="true"]',
    '[aria-label*="본문"]',
    '[aria-placeholder*="내용"]',
    '[aria-placeholder*="본문"]',
    '[placeholder*="내용"]',
    '[placeholder*="본문"]',
    '[contenteditable="true"][role="textbox"]',
    '.se-component-content [contenteditable="true"]',
    '.se-section-text [contenteditable="true"]',
    '.se-module-text [contenteditable="true"]',
    '.se-text-paragraph',
    '.se_editable',
    '.se2_inputarea',
    'iframe',
    'body[contenteditable="true"]',
    '[contenteditable="true"]',
  ];
  const started = Date.now();
  while (Date.now() - started < 20000) {
    const roots = [page, ...page.frames()];
    for (const root of roots) {
      for (const selector of selectors) {
        const locator = root.locator(selector);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const item = locator.nth(index);
          if (selector === "iframe") continue;
          const visible = await item.isVisible().catch(() => false);
          if (!visible) continue;
          const isTitleLike = await item.evaluate((element) => {
            const text = [
              element.getAttribute("placeholder"),
              element.getAttribute("aria-label"),
              element.getAttribute("aria-placeholder"),
              element.getAttribute("name"),
              element.getAttribute("title"),
              element.getAttribute("data-placeholder"),
              element.closest("[data-a11y-title]")?.getAttribute("data-a11y-title"),
            ].filter(Boolean).join(" ");
            const classes = [
              element.className,
              element.closest("[class]")?.className,
              element.parentElement?.className,
            ].filter(Boolean).join(" ");
            return /제목|subject|title/i.test(text) || /title|subject/i.test(classes);
          }).catch(() => false);
          if (isTitleLike) continue;
          const box = await item.boundingBox().catch(() => null);
          if (!box || box.width < 80 || box.height < 12) continue;
          return item;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function writeNaverCafeClipboard(page, html, plainText) {
  return page.evaluate(async ({ html, plain }) => {
    if (!navigator.clipboard || !window.ClipboardItem) return false;
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return true;
  }, { html, plain: plainText }).catch(() => false);
}

async function naverCafeEditorContains(page, sampleText) {
  const needle = String(sampleText || "").slice(0, 18);
  if (!needle) return true;
  const roots = [page, ...page.frames()];
  for (const root of roots) {
    const found = await root.evaluate((needleValue) => {
      const isTitleLike = (element) => {
        const text = [
          element.getAttribute("placeholder"),
          element.getAttribute("aria-label"),
          element.getAttribute("aria-placeholder"),
          element.getAttribute("name"),
          element.getAttribute("title"),
          element.getAttribute("data-placeholder"),
          element.closest("[data-a11y-title]")?.getAttribute("data-a11y-title"),
        ].filter(Boolean).join(" ");
        const classes = [
          element.className,
          element.closest("[class]")?.className,
          element.parentElement?.className,
        ].filter(Boolean).join(" ");
        return /제목|subject|title/i.test(text) || /title|subject/i.test(classes);
      };
      const candidates = [
        ...document.querySelectorAll('[contenteditable="true"], textarea, body[contenteditable="true"], .se2_inputarea, .se_editable, .se-text-paragraph'),
      ];
      return candidates.some((element) => {
        if (element !== document.body && isTitleLike(element)) return false;
        const rect = element.getBoundingClientRect();
        if (element !== document.body && (rect.width < 80 || rect.height < 10)) return false;
        const text = element.value || element.innerText || element.textContent || "";
        return text.includes(needleValue);
      });
    }, needle).catch(() => false);
    if (found) return true;
  }
  return false;
}

async function clickLikelyNaverCafeBody(page) {
  const clicked = await page.evaluate(() => {
    const isTitleLike = (element) => {
      const meta = [
        element.getAttribute("placeholder"),
        element.getAttribute("aria-label"),
        element.getAttribute("aria-placeholder"),
        element.getAttribute("name"),
        element.getAttribute("title"),
        element.getAttribute("data-placeholder"),
        element.closest("[data-a11y-title]")?.getAttribute("data-a11y-title"),
      ].filter(Boolean).join(" ");
      const classes = [
        element.className,
        element.closest("[class]")?.className,
        element.parentElement?.className,
      ].filter(Boolean).join(" ");
      return /제목|subject|title/i.test(meta) || /title|subject/i.test(classes);
    };
    const candidates = [...document.querySelectorAll('[contenteditable="true"], textarea, .se_editable, .se2_inputarea, .se-text-paragraph')]
      .map((element) => {
        const meta = [
          element.getAttribute("placeholder"),
          element.getAttribute("aria-label"),
          element.getAttribute("aria-placeholder"),
          element.getAttribute("name"),
          element.getAttribute("title"),
          element.getAttribute("data-placeholder"),
          element.closest("[data-a11y-title]")?.getAttribute("data-a11y-title"),
        ].filter(Boolean).join(" ");
        const classes = [
          element.className,
          element.closest("[class]")?.className,
          element.parentElement?.className,
        ].filter(Boolean).join(" ");
        const rect = element.getBoundingClientRect();
        const bodyScore = /본문|내용|입력|editor|editable|se-|text/i.test(`${meta} ${classes}`) ? 1000000 : 0;
        return { element, rect, meta, score: bodyScore + (rect.width * rect.height) };
      })
      .filter((item) => !isTitleLike(item.element))
      .filter((item) => item.rect.width > 180 && item.rect.height > 20)
      .filter((item) => item.rect.top > 180)
      .sort((a, b) => b.score - a.score);
    const target = candidates[0]?.element;
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.focus();
    target.click();
    return true;
  }).catch(() => false);
  if (clicked) return true;
  const viewport = page.viewportSize() || { width: 1365, height: 900 };
  await page.mouse.click(Math.round(viewport.width * 0.5), Math.round(viewport.height * 0.58));
  return true;
}

async function insertNaverCafeEditorHtml(page, html) {
  const plainText = naverCafePlainTextFromHtml(html);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://cafe.naver.com" }).catch(() => {});
  const clipboardReady = await writeNaverCafeClipboard(page, html, plainText);
  const editor = await findNaverCafeEditor(page);
  if (editor && clipboardReady) {
    await editor.scrollIntoViewIfNeeded().catch(() => {});
    await editor.click({ position: { x: 12, y: 12 } }).catch(async () => editor.click());
    await page.keyboard.press("Control+V");
    await page.waitForTimeout(1800);
    if (await naverCafeEditorContains(page, "고객님에게 제공하는")) return;
  }
  if (clipboardReady) {
    await clickLikelyNaverCafeBody(page);
    await page.keyboard.press("Control+V");
    await page.waitForTimeout(1800);
    if (await naverCafeEditorContains(page, "고객님에게 제공하는")) return;
  }
  if (editor) {
    await editor.scrollIntoViewIfNeeded().catch(() => {});
    await editor.click({ position: { x: 12, y: 12 } }).catch(async () => editor.click());
    const ok = await editor.evaluate((element, { value, plain }) => {
      element.focus();
      const doc = element.ownerDocument || document;
      const win = doc.defaultView || window;
      const selection = win.getSelection?.();
      if (element.isContentEditable && selection && doc.createRange) {
        const range = doc.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      let pasteHandled = false;
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/html", value);
        clipboardData.setData("text/plain", plain);
        const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });
        pasteHandled = !element.dispatchEvent(pasteEvent);
      } catch {}
      if (pasteHandled) return true;
      if (doc.execCommand && doc.execCommand("insertHTML", false, value)) return true;
      if (element.isContentEditable) {
        element.innerHTML = value;
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML", data: value }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      const editableChild = element.querySelector?.('[contenteditable="true"], .se_editable, .se2_inputarea, .se-text-paragraph');
      if (editableChild) {
        editableChild.focus?.();
        if (editableChild.isContentEditable) {
          editableChild.innerHTML = value;
        } else {
          editableChild.textContent = plain;
        }
        editableChild.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML", data: value }));
        editableChild.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { value: html, plain: plainText }).catch(() => false);
    if (ok) {
      await page.waitForTimeout(1200);
      if (await naverCafeEditorContains(page, "고객님에게 제공하는")) return;
    }
  }
  const injected = await page.evaluate(({ value, plain }) => {
    const isTitleLike = (element) => {
      const text = [
        element.getAttribute("placeholder"),
        element.getAttribute("aria-label"),
        element.getAttribute("aria-placeholder"),
        element.getAttribute("name"),
        element.getAttribute("title"),
        element.getAttribute("data-placeholder"),
        element.closest("[data-a11y-title]")?.getAttribute("data-a11y-title"),
      ].filter(Boolean).join(" ");
      const classes = [
        element.className,
        element.closest("[class]")?.className,
        element.parentElement?.className,
      ].filter(Boolean).join(" ");
      return /제목|subject|title/i.test(text) || /title|subject/i.test(classes);
    };
    const candidates = [
      ...document.querySelectorAll('[contenteditable="true"], textarea, .se2_inputarea, .se_editable, .se-text-paragraph'),
    ];
    const target = candidates.find((element) => {
      if (isTitleLike(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 80 && rect.height > 10;
    });
    if (!target) return false;
    target.focus();
    const selection = window.getSelection?.();
    if (target.isContentEditable && selection && document.createRange) {
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    let pasteHandled = false;
    try {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/html", value);
      clipboardData.setData("text/plain", plain);
      const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });
      pasteHandled = !target.dispatchEvent(pasteEvent);
    } catch {}
    if (pasteHandled) return true;
    if (document.execCommand && document.execCommand("insertHTML", false, value)) return true;
    if (target.isContentEditable) {
      target.innerHTML = value;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML", data: value }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    target.value = value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { value: html, plain: plainText }).catch(() => false);
  if (injected) {
    await page.waitForTimeout(1200);
    if (await naverCafeEditorContains(page, "고객님에게 제공하는")) return;
  }
  for (const frame of page.frames()) {
    const ok = await frame.evaluate(({ value, plain }) => {
      const isTitleLike = (element) => {
        const text = [
          element.getAttribute("placeholder"),
          element.getAttribute("aria-label"),
          element.getAttribute("aria-placeholder"),
          element.getAttribute("name"),
          element.getAttribute("title"),
          element.getAttribute("data-placeholder"),
          element.closest("[data-a11y-title]")?.getAttribute("data-a11y-title"),
        ].filter(Boolean).join(" ");
        const classes = [
          element.className,
          element.closest("[class]")?.className,
          element.parentElement?.className,
        ].filter(Boolean).join(" ");
        return /제목|subject|title/i.test(text) || /title|subject/i.test(classes);
      };
      const candidates = [
        ...document.querySelectorAll('[contenteditable="true"], textarea, body[contenteditable="true"], .se2_inputarea, .se_editable, .se-text-paragraph'),
      ];
      const target = candidates.find((element) => {
        if (element !== document.body && isTitleLike(element)) return false;
        const rect = element.getBoundingClientRect();
        return element === document.body || (rect.width > 80 && rect.height > 10);
      });
      if (!target) return false;
      target.focus();
      const selection = window.getSelection?.();
      if ((target.isContentEditable || target === document.body) && selection && document.createRange) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      let pasteHandled = false;
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/html", value);
        clipboardData.setData("text/plain", plain);
        const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });
        pasteHandled = !target.dispatchEvent(pasteEvent);
      } catch {}
      if (pasteHandled) return true;
      if (document.execCommand && document.execCommand("insertHTML", false, value)) return true;
      if (target.isContentEditable || target === document.body) {
        target.innerHTML = value;
        target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML", data: value }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      target.value = value;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { value: html, plain: plainText }).catch(() => false);
    if (ok) {
      await page.waitForTimeout(1200);
      if (await naverCafeEditorContains(page, "고객님에게 제공하는")) return;
    }
  }
  throw new AppError(500, "네이버 카페 본문에 내용이 들어가지 않았습니다. 네이버 창에서 본문 입력 위치를 확인해주세요.");
}

async function insertNaverCafePlaceMap(page) {
  try {
    const mapOpened = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll("button,a,[role='button'],[class*='button'],[class*='Button']")];
      const target = candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || "").replace(/\s+/g, "");
        const visible = rect.width > 10 && rect.height > 10 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
        return visible && /^(지도|장소)$|지도첨부|장소첨부/.test(text);
      });
      if (!target) return false;
      target.scrollIntoView({ block: "center", inline: "center" });
      target.click();
      return true;
    }).catch(() => false);
    if (!mapOpened) {
      logWarning("Naver Cafe place map insert skipped: map toolbar button not found");
      return false;
    }

    await page.waitForTimeout(1500);
    const queryTyped = await page.evaluate((query) => {
      const inputs = [...document.querySelectorAll("input,textarea,[contenteditable='true']")];
      const target = inputs.find((element) => {
        const rect = element.getBoundingClientRect();
        const meta = [
          element.getAttribute("placeholder"),
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.getAttribute("name"),
        ].filter(Boolean).join(" ");
        const visible = rect.width > 80 && rect.height > 16 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
        return visible && /검색|장소|지도|지역|위치|search|keyword|query/i.test(meta);
      }) || inputs.find((element) => {
        const rect = element.getBoundingClientRect();
        const visible = rect.width > 160 && rect.height > 20 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
        return visible;
      });
      if (!target) return false;
      target.focus();
      if ("value" in target) {
        target.value = query;
      } else {
        target.textContent = query;
      }
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: query }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, BEBEU_NAVER_PLACE_QUERY).catch(() => false);
    if (!queryTyped) {
      logWarning("Naver Cafe place map insert skipped: search input not found");
      return false;
    }

    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const candidates = [...document.querySelectorAll("button,a,[role='button'],li,div")];
      const target = candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ");
        const visible = rect.width > 30 && rect.height > 16 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
        return visible && /베베유/.test(text) && /첨단내촌로|광산구|전남광주|광주/.test(text);
      }) || candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ");
        const visible = rect.width > 30 && rect.height > 16 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
        return visible && /베베유/.test(text);
      });
      if (!target) return false;
      target.scrollIntoView({ block: "center", inline: "center" });
      target.click();
      return true;
    }).catch(() => false);
    await page.waitForTimeout(1200);

    const confirmed = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll("button,a,[role='button'],[class*='button'],[class*='Button']")];
      const target = candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || "").replace(/\s+/g, "");
        const visible = rect.width > 10 && rect.height > 10 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
        return visible && /^(확인|등록|추가|선택|삽입|적용)$|지도넣기|첨부/.test(text) && !/취소|닫기|삭제/.test(text);
      });
      if (!target) return false;
      target.scrollIntoView({ block: "center", inline: "center" });
      target.click();
      return true;
    }).catch(() => false);
    if (!confirmed) {
      logWarning("Naver Cafe place map insert uncertain: confirm button not found");
      return false;
    }
    await page.waitForTimeout(1800);
    return true;
  } catch (error) {
    logWarning("Naver Cafe place map insert failed", JSON.stringify({ message: error.message }));
    return false;
  }
}

async function clickNaverCafePublish(page) {
  const forbidden = /임시|저장|취소|닫기|미리|예약|수정|삭제|스티커|사진|동영상|파일|지도|투표|링크|글감|이모티콘/;
  const publishText = /^(등록|발행|게시|올리기)$/;
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const candidates = await page.evaluate(({ forbiddenSource, publishTextSource }) => {
      const forbidden = new RegExp(forbiddenSource);
      const publishText = new RegExp(publishTextSource);
      return [...document.querySelectorAll("button,a,[role='button'],[class*='button'],[class*='Button']")]
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, "");
          const aria = (element.getAttribute("aria-label") || "").replace(/\s+/g, "");
          const name = `${text} ${aria}`.trim();
          const disabled = element.disabled || element.getAttribute("aria-disabled") === "true";
          const visible = rect.width > 10 && rect.height > 10 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
          let score = 0;
          if (publishText.test(text) || publishText.test(aria)) score += 1000;
          else score -= 5000;
          if (rect.top < 140 || rect.bottom > window.innerHeight - 180) score += 80;
          if (rect.left > window.innerWidth * 0.55) score += 40;
          if (/primary|confirm|submit|save|등록|발행/i.test(element.className || "")) score += 30;
          if (forbidden.test(name)) score -= 5000;
          if (disabled || !visible || !name) score -= 5000;
          return { index, text, aria, name, score, top: rect.top, left: rect.left, width: rect.width, height: rect.height };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }, {
      forbiddenSource: forbidden.source,
      publishTextSource: publishText.source,
    }).catch(() => []);
    if (candidates.length) {
      logInfo("Naver Cafe publish button candidates", JSON.stringify(candidates));
      for (const candidate of candidates) {
        const clicked = await page.evaluate((targetIndex) => {
          const elements = [...document.querySelectorAll("button,a,[role='button'],[class*='button'],[class*='Button']")];
          const element = elements[targetIndex];
          if (!element) return false;
          element.scrollIntoView({ block: "center", inline: "center" });
          element.click();
          return true;
        }, candidate.index).catch(() => false);
        if (!clicked) continue;
        await page.waitForTimeout(2200);
        if (!/articles\/write|ArticleWrite/i.test(page.url())) return true;
        const confirmClicked = await page.evaluate(() => {
          const elements = [...document.querySelectorAll("button,a,[role='button'],[class*='button'],[class*='Button']")];
          const target = elements.find((element) => {
            const rect = element.getBoundingClientRect();
            const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, "");
            const visible = rect.width > 10 && rect.height > 10 && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
            return visible && /^(확인|등록|발행)$/.test(text) && !/임시|저장|취소|닫기/.test(text);
          });
          if (!target) return false;
          target.click();
          return true;
        }).catch(() => false);
        if (confirmClicked) {
          await page.waitForTimeout(2200);
          if (!/articles\/write|ArticleWrite/i.test(page.url())) return true;
        }
        logWarning("Naver Cafe publish candidate did not submit", JSON.stringify(candidate));
      }
    }
    await page.waitForTimeout(300);
  }
  logWarning("Naver Cafe publish button not found; keeping browser open for manual confirmation");
  return false;
}

async function postOrderToNaverCafeByAutomation(order, settings, subject, html, photoCount) {
  const context = await getNaverCafeAutomationContext();
  const page = await context.newPage();
  let shouldClosePage = false;
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  try {
    const writeUrl = naverCafeWriteUrl(settings);
    await page.goto(writeUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    if (/nid\.naver\.com|login/i.test(page.url())) {
      throw new AppError(401, "네이버 로그인이 필요합니다. 설정에서 자동화 로그인 열기를 눌러 로그인 후 다시 시도해주세요.");
    }
    await fillNaverCafeTitle(page, subject);
    await insertNaverCafeEditorHtml(page, html);
    await fillNaverCafeTitle(page, subject);
    const placeMapInserted = await insertNaverCafePlaceMap(page);
    await page.waitForTimeout(1000);
    const publishClicked = await clickNaverCafePublish(page);
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const currentUrl = page.url();
    const articleUrl = /articles\/\d+/i.test(currentUrl) ? currentUrl : "";
    if (publishClicked && !articleUrl && /articles\/write|ArticleWrite/i.test(currentUrl)) {
      logWarning("Naver Cafe publish status uncertain; suppressing user-facing error", JSON.stringify({
        orderId: order.id,
        serial: order.serial,
        currentUrl,
      }));
    }
    shouldClosePage = Boolean(publishClicked && !/articles\/write|ArticleWrite/i.test(currentUrl));
    return {
      subject,
      content: html,
      photoCount,
      totalPhotoCount: photoCount,
      attemptMode: publishClicked ? "automation" : "automation-open",
      url: articleUrl || currentUrl,
      response: { automation: true, publishClicked, placeMapInserted },
    };
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError(500, error.message || "네이버 카페 자동 업로드에 실패했습니다.", error);
    appError.details = {
      reason: "automation_error",
      currentUrl: page.url(),
      profilePath: NAVER_CAFE_AUTOMATION_PROFILE,
      subject,
      totalPhotoCount: photoCount,
      message: appError.message,
    };
    throw appError;
  } finally {
    if (shouldClosePage) await page.close().catch(() => {});
  }
}

async function requestNaverToken(params) {
  const url = `${NAVER_AUTH_BASE}/token?${params.toString()}`;
  const response = await fetch(url, { method: "GET" });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok || payload.error) {
    throw new AppError(response.status || 400, payload.error_description || payload.error || payload.raw || "네이버 토큰 발급에 실패했습니다.");
  }
  return payload;
}

async function refreshNaverAccessTokenIfNeeded(settings) {
  const expiresAt = new Date(settings.tokenExpiresAt || 0).getTime();
  if (settings.accessToken && expiresAt && expiresAt - Date.now() > 5 * 60 * 1000) return settings;
  if (!settings.refreshToken) return settings;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    refresh_token: settings.refreshToken,
  });
  const token = await requestNaverToken(params);
  const next = {
    ...settings,
    accessToken: token.access_token || settings.accessToken,
    refreshToken: token.refresh_token || settings.refreshToken,
    tokenExpiresAt: new Date(Date.now() + (Number(token.expires_in) || 3600) * 1000).toISOString(),
  };
  await upsertAppSetting("naverCafe", next);
  return next;
}

async function postOrderToNaverCafe(order, settings, options = {}) {
  if (!settings.enabled) throw new AppError(400, "설정에서 네이버 카페 업로드 기능을 먼저 켜주세요.");
  const required = [
    ["clubId", "카페 ID"],
    ["menuId", "게시판 ID"],
  ].filter(([key]) => !String(settings[key] || "").trim());
  if (required.length) {
    throw new AppError(400, `${required.map(([, label]) => label).join(", ")} 설정이 필요합니다.`);
  }
  if (order.status !== "완료") throw new AppError(400, "완료된 항목만 네이버 카페에 업로드할 수 있습니다.");

  let shareLink = await readShortShareLinkByOrderId(order.id);
  if (!shareLink) {
    const token = await upsertShortShareLink(order.id, [], "");
    shareLink = { token, orderId: order.id, hiddenPhotoIds: [], customerMemo: "" };
  }
  const baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
  const shareUrl = baseUrl && shareLink?.token ? `${baseUrl}/s/${encodeURIComponent(shareLink.token)}` : "";
  const subject = safeNaverCafeSubject(order, settings);
  const photos = naverCafePhotoList(order, settings, shareLink?.hiddenPhotoIds || []);
  const content = buildNaverCafeContent(order, settings, photos, shareUrl, photos.length, baseUrl);
  try {
    return await postOrderToNaverCafeByAutomation(order, settings, subject, content, photos.length);
  } catch (error) {
    logWarning("Naver Cafe automation failed", JSON.stringify({
      orderId: order.id,
      serial: order.serial,
      clubId: settings.clubId,
      menuId: settings.menuId,
      subject,
      totalPhotoCount: photos.length,
      details: error.details || null,
      message: error.message || String(error),
    }));
    throw error;
  }
}

function normalizeKeepNotePayload(body, owner, existing = null) {
  const type = body.type === "checklist" ? "checklist" : "text";
  const title = String(body.title || "").trim();
  const bodyText = String(body.body || "").trim();
  const items = Array.isArray(body.items)
    ? body.items.map((item) => ({
      id: item.id || randomUUID(),
      text: String(item.text || "").trim(),
      done: Boolean(item.done),
    })).filter((item) => item.text)
    : [];
  const collaborators = Array.isArray(body.collaborators)
    ? body.collaborators
      .map((item) => ({ userId: item.userId, permission: item.permission === "edit" ? "edit" : "view" }))
      .filter((item) => item.userId && item.userId !== owner.id)
    : existing?.collaborators || [];
  if (!title && !bodyText && !items.length) return null;
  return {
    type,
    title,
    body: type === "checklist" ? "" : bodyText,
    items: type === "checklist" ? items : [],
    collaborators,
    pinned: Boolean(body.pinned),
  };
}

async function insertKeepNote(note) {
  await mysqlExec(`INSERT INTO keep_notes (keep_notes_idx,keep_notes_owner_user_idx,keep_notes_owner_name,keep_notes_type,keep_notes_title,keep_notes_body,keep_notes_items_json,keep_notes_collaborators_json,keep_notes_is_pinned,keep_notes_created_at,keep_notes_updated_at) VALUES (${sql(note.id)},${sql(note.ownerId)},${sql(note.ownerName)},${sql(note.type)},${sql(note.title)},${sql(note.body)},${sql(JSON.stringify(note.items || []))},${sql(JSON.stringify(note.collaborators || []))},${note.pinned ? 1 : 0},${sqlDate(note.createdAt)},${sqlDate(note.updatedAt)})`);
}

async function updateKeepNoteRow(note) {
  await mysqlExec(`UPDATE keep_notes SET keep_notes_type=${sql(note.type)},keep_notes_title=${sql(note.title)},keep_notes_body=${sql(note.body)},keep_notes_items_json=${sql(JSON.stringify(note.items || []))},keep_notes_collaborators_json=${sql(JSON.stringify(note.collaborators || []))},keep_notes_is_pinned=${note.pinned ? 1 : 0},keep_notes_updated_at=${sqlDate(note.updatedAt)} WHERE keep_notes_idx=${sql(note.id)}`);
}

async function deleteKeepNoteRow(noteId) {
  await mysqlExec(`UPDATE keep_notes SET keep_notes_deleted_at=NOW() WHERE keep_notes_idx=${sql(noteId)}`);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "bebeu", time: new Date().toISOString() });
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const db = await readDb();
    const user = getRequestUser(req, db);
    const keepNotes = db.keepNotes.filter((note) => canViewKeepNote(note, user));
    const keys = ensureVapidKeys();
    const trash = await readTrashSummary();
    const { appSettings, ...clientDb } = db;
    return sendJson(res, 200, { steps, photoRoot: PHOTO_ROOT, serverHost: req.headers.host, pushPublicKey: keys?.publicKey || "", pushSupported: Boolean(webPush && keys?.publicKey), ...clientDb, naverCafeSettings: naverCafeSettingsForClient(appSettings.naverCafe), smsTemplates: normalizeSmsTemplates(appSettings.smsTemplates || {}), keepNotes, trash });
  }

  if (req.method === "GET" && pathname === "/api/trash") {
    return sendJson(res, 200, { trash: await readTrashSummary() });
  }

  const trashOrderRestoreMatch = pathname.match(/^\/api\/trash\/orders\/([^/]+)\/restore$/);
  if (req.method === "POST" && trashOrderRestoreMatch) {
    await restoreOrderFromTrash(trashOrderRestoreMatch[1]);
    invalidateDbCache();
    const order = await readOrderById(trashOrderRestoreMatch[1]);
    return sendJson(res, 200, { order, trash: await readTrashSummary() });
  }

  if (req.method === "POST" && pathname === "/api/trash/photos/restore") {
    const body = await readBody(req);
    const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter(Boolean) : [body.photoId].filter(Boolean);
    if (!photoIds.length) return sendJson(res, 400, { error: "복구할 사진을 선택해 주세요." });
    await restorePhotosFromTrash(photoIds);
    invalidateDbCache();
    const db = await readDb();
    return sendJson(res, 200, { orders: db.orders, trash: await readTrashSummary(), restoredPhotoIds: photoIds });
  }

  if (req.method === "POST" && pathname === "/api/trash/photos/delete") {
    const body = await readBody(req);
    const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter(Boolean) : [body.photoId].filter(Boolean);
    if (!photoIds.length) return sendJson(res, 400, { error: "완전히 삭제할 사진을 선택해 주세요." });
    const deletedPhotoIds = await purgeTrashPhotos(photoIds, "Selected trash photo delete failed");
    invalidateDbCache();
    return sendJson(res, 200, { trash: await readTrashSummary(), deletedPhotoIds });
  }

  if (req.method === "GET" && pathname === "/api/chat") {
    const db = await readDb();
    return sendJson(res, 200, { chatMessages: db.chatMessages });
  }

  if (req.method === "POST" && pathname === "/api/sms-templates") {
    const body = await readBody(req);
    const templates = normalizeSmsTemplates(body.templates || body || {});
    await upsertAppSetting("smsTemplates", templates);
    invalidateDbCache();
    return sendJson(res, 200, { smsTemplates: templates });
  }

  if (req.method === "GET" && pathname === "/api/naver-cafe/connect") {
    const db = await readDb();
    const settings = { ...defaultNaverCafeSettings(), ...(db.appSettings.naverCafe || {}) };
    if (!settings.clientId || !settings.clientSecret) {
      return sendHtml(res, 400, "<h1>네이버 앱 정보가 필요합니다.</h1><p>Client ID / Client Secret을 먼저 저장해 주세요.</p>");
    }
    settings.oauthState = randomUUID();
    settings.accessToken = "";
    settings.refreshToken = "";
    settings.tokenExpiresAt = null;
    db.appSettings.naverCafe = settings;
    await upsertAppSetting("naverCafe", settings);
    invalidateDbCache();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: settings.clientId,
      redirect_uri: naverRedirectUri(req),
      state: settings.oauthState,
      auth_type: "reprompt",
    });
    res.writeHead(302, { Location: `${NAVER_AUTH_BASE}/authorize?${params.toString()}` });
    return res.end();
  }

  if (req.method === "POST" && pathname === "/api/naver-cafe/automation-login") {
    const db = await readDb();
    const settings = { ...defaultNaverCafeSettings(), ...(db.appSettings.naverCafe || {}) };
    try {
      const result = await openNaverCafeAutomationLogin(settings);
      return sendJson(res, 200, {
        message: "네이버 로그인 브라우저를 열었습니다. 브라우저에서 로그인을 완료한 뒤 다시 업로드해주세요.",
        ...result,
      });
    } catch (error) {
      return sendJson(res, error.status || 500, {
        error: error.message || "네이버 자동화 로그인 브라우저를 열지 못했습니다.",
        details: error.details || null,
      });
    }
  }

  if (req.method === "GET" && pathname === "/api/naver-cafe/callback") {
    const url = new URL(req.url, requestBaseUrl(req));
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const error = url.searchParams.get("error") || "";
    if (error) return sendHtml(res, 400, `<h1>네이버 연결 실패</h1><p>${escapeHtml(error)}</p>`);
    const db = await readDb();
    const settings = { ...defaultNaverCafeSettings(), ...(db.appSettings.naverCafe || {}) };
    if (!code || !state || state !== settings.oauthState) {
      return sendHtml(res, 400, "<h1>네이버 연결 실패</h1><p>연결 정보가 맞지 않습니다. 앱 설정에서 다시 연결해 주세요.</p>");
    }
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      code,
      state,
      redirect_uri: naverRedirectUri(req),
    });
    try {
      const token = await requestNaverToken(params);
      const next = {
        ...settings,
        enabled: true,
        accessToken: token.access_token || "",
        refreshToken: token.refresh_token || settings.refreshToken || "",
        tokenExpiresAt: new Date(Date.now() + (Number(token.expires_in) || 3600) * 1000).toISOString(),
        oauthState: "",
      };
      await upsertAppSetting("naverCafe", next);
      invalidateDbCache();
      return sendHtml(res, 200, `
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <body style="font-family:system-ui,sans-serif;padding:28px;line-height:1.6">
          <h1>네이버 카페 연결 완료</h1>
          <p>이제 베베유 앱의 완료 탭에서 카페 업로드를 사용할 수 있습니다.</p>
          <p><a href="/" style="color:#124f46;font-weight:800">앱으로 돌아가기</a></p>
        </body>
      `);
    } catch (tokenError) {
      return sendHtml(res, tokenError.status || 500, `<h1>네이버 토큰 발급 실패</h1><p>${escapeHtml(tokenError.message || tokenError)}</p>`);
    }
  }

  if (req.method === "POST" && pathname === "/api/naver-cafe/settings") {
    const body = await readBody(req);
    const db = await readDb();
    const settings = normalizeNaverCafeSettings(body, db.appSettings.naverCafe || {});
    db.appSettings.naverCafe = settings;
    await upsertAppSetting("naverCafe", settings);
    invalidateDbCache();
    return sendJson(res, 200, { naverCafeSettings: naverCafeSettingsForClient(settings) });
  }

  if (req.method === "POST" && pathname === "/api/naver-cafe/test") {
    const body = await readBody(req);
    const db = await readDb();
    const settings = { ...defaultNaverCafeSettings(), ...(db.appSettings.naverCafe || {}) };
    try {
      const test = await testNaverCafePost(settings, body.mode || "");
      return sendJson(res, 200, { ok: true, test });
    } catch (error) {
      logWarning("Naver Cafe test post failed", JSON.stringify({
        status: error.status || 500,
        message: error.message,
        details: error.details || null,
      }));
      return sendJson(res, error.status || 500, {
        error: error.message || "네이버 카페 테스트 글쓰기에 실패했습니다.",
        details: error.details || null,
      });
    }
  }

  if (req.method === "POST" && (pathname === "/api/auth/login" || pathname === "/api/auth/admin-login")) {
    const body = await readBody(req);
    const db = { users: await readUsersOnly() };
    const user = db.users.find((item) => item.id === body.userId);
    if (!user) return sendJson(res, 403, { error: "계정을 선택해주세요." });
    if (pathname === "/api/auth/admin-login" && !isAdminRoleValue(user.role)) return sendJson(res, 403, { error: "관리자 계정을 선택해주세요." });
    const storedHash = await readUserPasswordHash(user.id);
    if (!passwordMatches(storedHash, body.password, user.role)) return sendJson(res, 401, { error: "비밀번호가 맞지 않습니다." });
    return sendJson(res, 200, { user });
  }

  if (req.method === "POST" && (pathname === "/api/auth/password" || pathname === "/api/auth/admin-password")) {
    const db = { users: await readUsersOnly() };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 403, { error: "로그인이 필요합니다." });
    const body = await readBody(req);
    const nextPassword = String(body.newPassword || "");
    if (nextPassword.length < 4) return sendJson(res, 400, { error: "새 비밀번호는 4자리 이상으로 입력해주세요." });
    const storedHash = await readUserPasswordHash(user.id);
    if (!passwordMatches(storedHash, body.currentPassword, user.role)) return sendJson(res, 401, { error: "현재 비밀번호가 맞지 않습니다." });
    await updateUserPasswordHash(user.id, passwordHash(nextPassword));
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/members") {
    const users = await readUsersOnly();
    const admin = getRequestAdmin(req, users);
    if (!admin) return sendJson(res, 403, { error: "관리자만 멤버를 추가할 수 있습니다." });
    const body = await readBody(req);
    const name = normalizeMemberName(body.name);
    if (!name) return sendJson(res, 400, { error: "멤버 이름을 입력해주세요." });
    const role = normalizeMemberRole(body.role);
    const password = String(body.password || "");
    if (password && password.length < 4) return sendJson(res, 400, { error: "비밀번호는 4자리 이상으로 입력해주세요." });
    const member = {
      id: randomUUID(),
      name,
      role,
      branch: "본점",
      passwordHash: passwordHash(password || DEFAULT_MEMBER_PASSWORD),
      clockedIn: false,
      clockInAt: null,
    };
    await insertMemberRow(member);
    return sendJson(res, 201, { users: await readUsersOnly() });
  }

  const memberMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
  if (memberMatch && req.method === "DELETE") {
    const users = await readUsersOnly();
    const admin = getRequestAdmin(req, users);
    if (!admin) return sendJson(res, 403, { error: "관리자만 멤버를 삭제할 수 있습니다." });
    const memberId = decodeURIComponent(memberMatch[1]);
    const member = users.find((item) => item.id === memberId);
    if (!member) return sendJson(res, 404, { error: "멤버를 찾을 수 없습니다." });
    if (member.id === admin.id) return sendJson(res, 400, { error: "현재 로그인한 관리자 계정은 삭제할 수 없습니다." });
    if (isAdminRoleValue(member.role) && users.filter((item) => isAdminRoleValue(item.role)).length <= 1) {
      return sendJson(res, 400, { error: "마지막 관리자 계정은 삭제할 수 없습니다." });
    }
    await deactivateMemberRow(member.id);
    return sendJson(res, 200, { users: await readUsersOnly() });
  }

  if (req.method === "GET" && pathname === "/api/push/public-key") {
    const keys = ensureVapidKeys();
    return sendJson(res, 200, { publicKey: keys?.publicKey || "", supported: Boolean(webPush && keys?.publicKey) });
  }

  if (req.method === "POST" && pathname === "/api/push/subscriptions") {
    const db = { users: await readUsersOnly() };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });
    if (user.role !== "관리자") return sendJson(res, 403, { error: "관리자만 채팅 알림을 켤 수 있습니다." });
    const body = await readBody(req);
    await upsertPushSubscription(user, body.subscription);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "DELETE" && pathname === "/api/push/subscriptions") {
    const db = { users: await readUsersOnly() };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });
    const body = await readBody(req);
    if (body.endpoint) await disablePushSubscription(body.endpoint);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/keep-notes") {
    const db = { users: await readUsersOnly() };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });
    const body = await readBody(req);
    const payload = normalizeKeepNotePayload(body, user);
    if (!payload) return sendJson(res, 400, { error: "내용이 비어 있는 메모는 저장하지 않습니다." });
    const now = new Date().toISOString();
    const note = {
      id: randomUUID(),
      ownerId: user.id,
      ownerName: user.name,
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    await insertKeepNote(note);
    return sendJson(res, 201, { note });
  }

  const keepNoteMatch = pathname.match(/^\/api\/keep-notes\/([^/]+)$/);
  if (keepNoteMatch) {
    const db = await readDb();
    const user = getRequestUser(req, db);
    const note = db.keepNotes.find((item) => item.id === keepNoteMatch[1]);
    if (!note || !canViewKeepNote(note, user)) return sendJson(res, 404, { error: "메모를 찾을 수 없습니다." });

    if (req.method === "PATCH") {
      if (!canEditKeepNote(note, user)) return sendJson(res, 403, { error: "이 메모를 수정할 권한이 없습니다." });
      const body = await readBody(req);
      if (note.ownerId !== user.id) body.collaborators = note.collaborators;
      const payload = normalizeKeepNotePayload(body, { id: note.ownerId }, note);
      if (!payload) return sendJson(res, 400, { error: "내용이 비어 있는 메모는 저장하지 않습니다." });
      Object.assign(note, payload, { updatedAt: new Date().toISOString() });
      await updateKeepNoteRow(note);
      return sendJson(res, 200, { note });
    }

    if (req.method === "DELETE") {
      if (note.ownerId !== user.id) return sendJson(res, 403, { error: "메모 소유자만 삭제할 수 있습니다." });
      await deleteKeepNoteRow(note.id);
      return sendJson(res, 200, { deletedNoteId: note.id });
    }
  }

  if (req.method === "POST" && pathname === "/api/attendance") {
    const body = await readBody(req);
    const db = { users: await readUsersOnly(), attendance: [] };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });

    const now = new Date().toISOString();
    user.clockedIn = body.action === "in";
    user.clockInAt = user.clockedIn ? now : null;
    const attendance = { id: randomUUID(), userId: user.id, userName: user.name, action: body.action, createdAt: now };
    db.attendance.unshift(attendance);
    await updateUserClockRow(user);
    await insertAttendanceRow(attendance);
    return sendJson(res, 200, { user, attendance: db.attendance });
  }

  if (req.method === "POST" && pathname === "/api/hourly-wages") {
    const db = await readDb();
    const user = getRequestUser(req, db);
    if (!user || user.role !== "관리자") return sendJson(res, 403, { error: "관리자만 시급을 수정할 수 있습니다." });
    const body = await readBody(req);
    const target = db.users.find((item) => item.id === body.userId);
    if (!target) return sendJson(res, 404, { error: "직원을 찾을 수 없습니다." });
    const amount = Math.max(0, Math.round(Number(body.amount) || 10320));
    await upsertHourlyWageRow(target.id, amount);
    invalidateDbCache();
    return sendJson(res, 200, { userId: target.id, amount });
  }

  if (req.method === "POST" && pathname === "/api/payroll-settings") {
    const db = await readDb();
    const user = getRequestUser(req, db);
    if (!user || !isAdminRoleValue(user.role)) return sendJson(res, 403, { error: "관리자만 결산 설정을 수정할 수 있습니다." });
    const body = await readBody(req);
    const target = db.users.find((item) => item.id === body.userId);
    if (!target) return sendJson(res, 404, { error: "직원을 찾을 수 없습니다." });
    const monthKey = String(body.monthKey || "").match(/^\d{4}-\d{2}$/) ? body.monthKey : "";
    if (!monthKey) return sendJson(res, 400, { error: "결산 월을 확인해주세요." });
    const adjustments = Array.isArray(body.adjustments) ? body.adjustments.map((item) => ({
      id: String(item.id || randomUUID()),
      title: String(item.title || "").trim().slice(0, 80),
      type: item.type === "minus" ? "minus" : "plus",
      amount: Math.max(0, Math.round(Number(item.amount) || 0)),
    })).filter((item) => item.title || item.amount) : [];
    const setting = {
      userId: target.id,
      monthKey,
      deliveryCount: Math.max(0, Math.round(Number(body.deliveryCount) || 0)),
      deliveryPrice: Math.max(0, Math.round(Number(body.deliveryPrice) || 0)),
      adjustments,
    };
    await upsertPayrollSettingRow(setting);
    invalidateDbCache();
    return sendJson(res, 200, { key: `${target.id}:${monthKey}`, setting });
  }

  if ((req.method === "POST" || req.method === "DELETE") && pathname === "/api/attendance/day") {
    const db = await readDb();
    const user = getRequestUser(req, db);
    if (!user || user.role !== "관리자") return sendJson(res, 403, { error: "관리자만 근태 시간을 수정할 수 있습니다." });
    const body = await readBody(req);
    const target = db.users.find((item) => item.id === body.userId);
    if (!target) return sendJson(res, 404, { error: "직원을 찾을 수 없습니다." });
    if (req.method === "DELETE") await deleteAttendanceDayRows(target, body.date);
    else await replaceAttendanceDayRows(target, body.date, body.startTime, body.endTime);
    invalidateDbCache();
    const freshDb = await readDb();
    return sendJson(res, 200, { attendance: freshDb.attendance });
  }

  if (req.method === "POST" && pathname === "/api/admin-memos") {
    const db = await readDb();
    const user = getRequestUser(req, db);
    if (!user || user.role !== "관리자") return sendJson(res, 403, { error: "관리자만 메모를 수정할 수 있습니다." });
    const body = await readBody(req);
    upsertAdminMemo(db, "admin-global", "전체 메모", body.globalMemo || "");
    Object.entries(body.memberMemos || {}).forEach(([userId, memoBody]) => {
      const member = db.users.find((item) => item.id === userId);
      if (!member) return;
      upsertAdminMemo(db, `admin-user-${member.id}`, `${member.name} 메모`, memoBody || "");
    });
    await Promise.all(db.adminMemos.map(upsertAdminMemoRow));
    return sendJson(res, 200, { adminMemos: db.adminMemos });
  }

  if (req.method === "POST" && pathname === "/api/chat") {
    const db = { users: await readUsersOnly() };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });
    const form = await readMultipartForm(req);
    const room = normalizeChatRoom(form.fields.room);
    const body = String(form.fields.body || "").trim().slice(0, 4000);
    const targetOrderId = String(form.fields.targetOrderId || "").trim();
    const targetSerial = normalizeOrderSerial(String(form.fields.targetSerial || "").trim());
    const targetStepCode = String(form.fields.targetStepCode || "").trim();
    const files = form.files.filter((file) => file.fieldName === "files").slice(0, 50);
    if (!body && !files.length) return sendJson(res, 400, { error: "메시지나 사진을 입력해주세요." });
    if (form.files.filter((file) => file.fieldName === "files").length > 50) {
      return sendJson(res, 400, { error: "사진은 한 번에 최대 50장까지 올릴 수 있습니다." });
    }
    const now = new Date().toISOString();
    const message = {
      id: randomUUID(),
      room,
      userId: user.id,
      userName: user.name,
      body,
      attachments: [],
      createdAt: now,
    };
    message.attachments = await Promise.all(files.map((file, index) => saveUploadedChatAttachment(file, message.id, index)));
    await insertChatMessageRow(message);
    const shouldUploadToTarget = Boolean((targetOrderId || targetSerial) && isPhotoStep(targetStepCode));
    const updatedOrder = shouldUploadToTarget
      ? await processChatAutoProcessing(room, body, message, user, { targetOrderId, targetSerial, targetStepCode })
      : null;
    if (!shouldUploadToTarget) queueChatAutoProcessing(room, body, message, user, { targetOrderId, targetSerial, targetStepCode });
    if (room === "main") {
      setImmediate(() => {
        notifyAdminsOfReceiptChat(message).catch((error) => logError("Receipt chat push failed", error, `message=${message.id}`));
      });
    }
    const freshDb = await readDb();
    return sendJson(res, 201, { message, chatMessages: freshDb.chatMessages, order: updatedOrder });
  }

  const chatMessageMatch = pathname.match(/^\/api\/chat\/messages\/([^/]+)$/);
  if (req.method === "DELETE" && chatMessageMatch) {
    const db = await readDb();
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });
    const message = db.chatMessages.find((item) => item.id === chatMessageMatch[1]);
    if (!message) return sendJson(res, 404, { error: "채팅을 찾을 수 없습니다." });
    await deleteChatMessageRow(message.id);
    const freshDb = await readDb();
    return sendJson(res, 200, { deletedMessageId: message.id, chatMessages: freshDb.chatMessages });
  }

  const chatMessageTransferMatch = pathname.match(/^\/api\/chat\/messages\/([^/]+)\/send-to-order$/);
  if (req.method === "POST" && chatMessageTransferMatch) {
    const db = { users: await readUsersOnly(), logs: [] };
    const user = getRequestUser(req, db);
    if (!user) return sendJson(res, 404, { error: "사용자를 찾을 수 없습니다." });
    const body = await readBody(req);
    const order = await readOrderById(body.orderId);
    if (!order) return sendJson(res, 404, { error: "품목을 찾을 수 없습니다." });
    if (order.status === "완료") return sendJson(res, 400, { error: "진행중인 품목만 선택할 수 있습니다." });
    if (!isPhotoStep(body.stepCode)) return sendJson(res, 400, { error: "사진을 올릴 단계를 선택해주세요." });
    const attachments = (await readChatAttachmentsByMessageId(chatMessageTransferMatch[1]))
      .filter((attachment) => (attachment.mimeType || "").startsWith("image/"));
    if (!attachments.length) {
      return sendJson(res, 404, { error: "채팅 사진을 찾을 수 없습니다." });
    }
    const photos = [];
    for (const [index, attachment] of attachments.entries()) {
      const sourcePath = resolvePhotoPath(attachment.filePath);
      if (!sourcePath || !isInsideChatPhotoRoot(sourcePath) || !fs.existsSync(sourcePath)) continue;
      const photo = await saveUploadedPhoto(order, body.stepCode, {
        originalName: attachment.originalName || "chat-photo.jpg",
        mimeType: attachment.mimeType || "image/jpeg",
        buffer: fs.readFileSync(sourcePath),
      }, user.name, 1, null, (order.photos?.length || 0) + index);
      photo.memo = "채팅에서 이동";
      photos.push(photo);
    }
    if (!photos.length) return sendJson(res, 404, { error: "업로드할 채팅 사진을 찾을 수 없습니다." });
    await insertPhotoRows(photos);
    order.photos.push(...photos);
    const previousStepCode = order.currentStep;
    order.currentStep = body.stepCode;
    order.status = stepStatus(body.stepCode);
    if (order.status !== "완료") order.completedAt = null;
    order.updatedAt = new Date().toISOString();
    addLog(db, order, "채팅 사진 업로드", `${body.stepCode} ${getStep(body.stepCode).name} ${photos.length}장`);
    if (previousStepCode !== body.stepCode) {
      addLog(db, order, "단계 자동 수정", `${getStep(previousStepCode).name} → ${getStep(body.stepCode).name}`);
    }
    await updateOrderStateRow(order);
    await Promise.all(db.logs.slice(0, previousStepCode !== body.stepCode ? 2 : 1).map(insertLogRow));
    const updatedOrder = await readOrderById(order.id);
    return sendJson(res, 200, { order: updatedOrder || order, photos });
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    const body = await readBody(req);
    if (!body.serial) return sendJson(res, 400, { error: "품번은 필요합니다." });
    const rawSerial = body.serial.trim();
    const normalizedSerial = normalizeOrderSerial(rawSerial);
    const normalizedRequestMemo = requestMemoWithSerialPlace(body.requestMemo, rawSerial, normalizedSerial);
    const db = { users: await readUsersOnly(), logs: [] };
    const user = getRequestUser(req, db);
    const order = makeOrder({
      serial: normalizedSerial,
      customerName: body.customerName || null,
      phone: body.phone || null,
      address: body.address || null,
      productType: body.productType || null,
      brand: body.brand || null,
      modelName: body.modelName || null,
      requestMemo: normalizedRequestMemo,
      worker: user?.name || "작업자",
    });
    addLog(db, order, "주문 추가", normalizedRequestMemo || "");
    await insertOrderRow(order);
    await insertLogRow(db.logs[0]);
    return sendJson(res, 201, { order });
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)(?:\/([^/]+))?$/);
  if (orderMatch) {
    const db = { users: await readUsersOnly(), logs: [] };
    const order = await readOrderById(orderMatch[1]);
    if (!order) return sendJson(res, 404, { error: "품번을 찾을 수 없습니다." });

    if (req.method === "DELETE" && !orderMatch[2]) {
      const user = getRequestUser(req, db);
      await moveOrderToTrash(order.id, user?.name || "");
      invalidateDbCache();
      return sendJson(res, 200, { deletedOrderId: order.id, trash: await readTrashSummary() });
    }

    if (req.method === "PATCH" && !orderMatch[2]) {
      const body = await readBody(req);
      const rawSerial = body.serial?.trim();
      const nextSerial = normalizeOrderSerial(rawSerial);
      if (!nextSerial) return sendJson(res, 400, { error: "품번은 필요합니다." });
      const duplicated = false;
      if (duplicated) return sendJson(res, 409, { error: "이미 등록된 품번입니다." });
      Object.assign(order, {
        serial: nextSerial,
        routeType: getRouteType(nextSerial),
        customerName: body.customerName ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        productType: body.productType ?? null,
        brand: body.brand ?? null,
        modelName: body.modelName ?? null,
        requestMemo: requestMemoWithSerialPlace(body.requestMemo, rawSerial, nextSerial),
        updatedAt: new Date().toISOString(),
      });
      addLog(db, order, "정보 수정");
      await updateOrderRow(order);
      await insertLogRow(db.logs[0]);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "urgent") {
      const body = await readBody(req);
      order.urgent = typeof body.urgent === "boolean" ? body.urgent : !order.urgent;
      order.updatedAt = new Date().toISOString();
      await updateOrderStateRow(order);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "complete") {
      const user = getRequestUser(req, db);
      order.worker = user?.name || order.worker;
      order.currentStep = "10";
      order.status = "\uC644\uB8CC";
      order.shareStatus = order.shareStatus && order.shareStatus !== "\uBBF8\uACF5\uC720" ? order.shareStatus : "\uC644\uB8CC";
      order.completedAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();
      addLog(db, order, "\uC644\uB8CC", "\uC9C4\uD589\uC911\uC5D0\uC11C \uC644\uB8CC\uB85C \uC774\uB3D9");
      await updateOrderStateRow(order);
      await insertLogRow(db.logs[0]);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "step") {
      const user = getRequestUser(req, db);
      const body = await readBody(req);
      const targetStep = steps.find((step) => step.code === String(body.stepCode || "").trim());
      if (!targetStep) return sendJson(res, 400, { error: "단계를 선택해 주세요." });
      const before = getStep(order.currentStep).name;
      order.worker = user?.name || order.worker;
      order.currentStep = targetStep.code;
      order.status = stepStatus(targetStep.code);
      order.completedAt = null;
      order.updatedAt = new Date().toISOString();
      addLog(db, order, "단계 변경", `${before} → ${targetStep.name}`);
      await updateOrderStateRow(order);
      await insertLogRow(db.logs[0]);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "photo") {
      const user = getRequestUser(req, db);
      order.worker = user?.name || order.worker;
      const uploadContext = `order=${order.serial || order.id} orderId=${order.id} contentLength=${req.headers["content-length"] || 0}`;
      logInfo("Photo upload started", uploadContext);

      if ((req.headers["content-type"] || "").startsWith("multipart/form-data")) {
        const form = await readMultipartForm(req);
        const stepCode = form.fields.stepCode || order.currentStep;
        if (!isPhotoStep(stepCode)) return sendJson(res, 400, { error: "사진은 01~09 단계에만 추가할 수 있습니다." });
        const productIndex = 1;
        const uploadOffset = normalizePhotoSortOrder(form.fields.uploadOffset);
        const memo = form.fields.memo || "";
        const advanceAfterUpload = form.fields.advance === "1";
        const originalFiles = form.files.filter((file) => file.fieldName === "files");
        logInfo("Photo upload parsed", `${uploadContext} step=${stepCode} product=${productIndex} files=${originalFiles.length} parts=${form.files.length}`);
        if (!originalFiles.length) return sendJson(res, 400, { error: "저장할 사진 또는 동영상을 선택해주세요." });

        const photos = await Promise.all(originalFiles.map(async (file, index) => {
          const displayFile = form.files.find((item) => item.fieldName === `displayFile${index}`) || null;
          const photo = await saveUploadedPhoto(order, stepCode, file, user?.name, productIndex, displayFile, uploadOffset + index);
          photo.memo = memo;
          return photo;
        }));
        order.photos.push(...photos);
        order.stepMemos[stepCode] = memo || order.stepMemos[stepCode] || "";
        order.updatedAt = new Date().toISOString();
        addLog(db, order, `${getStep(stepCode).name} 사진 추가`, `${photos.length}장 ${memo || ""}`.trim());
        const logsToInsert = [db.logs[0]];
        let advanced = false;
        if (advanceAfterUpload && order.currentStep === stepCode) {
          const next = nextStep(stepCode);
          if (next) {
            order.currentStep = next.code;
            order.status = stepStatus(next.code);
            if (order.status === "완료" && !order.completedAt) order.completedAt = new Date().toISOString();
            addLog(db, order, `${getStep(stepCode).name} 다음`, `${next.name} 단계로 이동`);
            logsToInsert.push(db.logs[0]);
            advanced = true;
          }
        }
        await insertPhotoRows(photos);
        if (memo) await upsertStepMemo(order.id, stepCode, memo);
        if (advanced) await updateOrderStateRow(order);
        else await updateOrderTouched(order);
        for (const log of logsToInsert) await insertLogRow(log);
        logInfo("Photo upload saved", `${uploadContext} step=${stepCode} product=${productIndex} files=${photos.length} advanced=${advanced}`);
        return sendJson(res, 201, { order, photos });
      }

      const body = await readBody(req);
      const stepCode = body.stepCode || order.currentStep;
      if (!isPhotoStep(stepCode)) return sendJson(res, 400, { error: "사진은 01~09 단계에만 추가할 수 있습니다." });
      const productIndex = 1;
      const photo = await saveDataUrlPhoto(order, stepCode, body.dataUrl, body.originalName, user?.name, productIndex);
      photo.memo = body.memo || "";
      order.photos.push(photo);
      order.stepMemos[stepCode] = body.memo || order.stepMemos[stepCode] || "";
      order.updatedAt = new Date().toISOString();
      addLog(db, order, `${getStep(stepCode).name} 사진 추가`, body.memo || "");
      await insertPhotoRows([photo]);
      if (body.memo) await upsertStepMemo(order.id, stepCode, body.memo);
      await updateOrderTouched(order);
      await insertLogRow(db.logs[0]);
      logInfo("Photo upload saved", `${uploadContext} step=${stepCode} product=${productIndex} files=1`);
      return sendJson(res, 201, { order, photo });
    }

    if (req.method === "POST" && orderMatch[2] === "photo-pin") {
      const body = await readBody(req);
      const user = getRequestUser(req, db);
      const requestedIds = Array.isArray(body.photoIds) ? body.photoIds : [body.photoId].filter(Boolean);
      const photoIds = requestedIds.filter((photoId) => order.photos.some((photo) => photo.id === photoId));
      if (!photoIds.length) return sendJson(res, 400, { error: "고정할 사진을 선택해주세요." });
      const pinned = body.pinned !== false;
      await updatePhotoPinRows(photoIds, pinned);
      order.worker = user?.name || order.worker;
      addLog(db, order, pinned ? "사진 상단 고정" : "사진 고정 해제", `${photoIds.length}장`);
      await insertLogRow(db.logs[0]);
      const updatedOrder = await readOrderById(order.id);
      return sendJson(res, 200, { order: updatedOrder, pinnedPhotoIds: photoIds, pinned });
    }

    if ((req.method === "DELETE" && orderMatch[2] === "photo") || (req.method === "POST" && orderMatch[2] === "photo-delete")) {
      const body = await readBody(req);
      const user = getRequestUser(req, db);
      const photoIds = Array.isArray(body.photoIds) ? body.photoIds : [body.photoId].filter(Boolean);
      if (!photoIds.length) return sendJson(res, 400, { error: "삭제할 사진을 선택해주세요." });

      const deleteSet = new Set(photoIds);
      const deleting = order.photos.filter((photo) => deleteSet.has(photo.id));
      if (!deleting.length) return sendJson(res, 404, { error: "삭제할 사진을 찾을 수 없습니다." });

      order.photos = order.photos.filter((photo) => !deleteSet.has(photo.id));
      order.worker = user?.name || order.worker;
      order.updatedAt = new Date().toISOString();
      addLog(db, order, "사진 삭제", `${deleting.length}장 삭제`);
      await markPhotosDeleted(deleting.map((photo) => photo.id), user?.name || "");
      await updateOrderTouched(order);
      await insertLogRow(db.logs[0]);
      invalidateDbCache();
      return sendJson(res, 200, { order, deletedPhotoIds: deleting.map((photo) => photo.id), trash: await readTrashSummary() });
    }

    if (req.method === "POST" && orderMatch[2] === "confirm") {
      const body = await readBody(req);
      const user = getRequestUser(req, db);
      order.worker = user?.name || order.worker;
      const stepCode = order.currentStep || body.stepCode;
      if (typeof body.memo === "string") order.stepMemos[stepCode] = body.memo;
      const next = nextStep(stepCode);
      if (next) {
        order.currentStep = next.code;
        order.status = stepStatus(next.code);
        addLog(db, order, `${getStep(stepCode).name} 다음`, `${next.name} 단계로 이동`);
      } else {
        order.status = "완료";
        order.completedAt = new Date().toISOString();
        addLog(db, order, "완료", "완료 단계 유지");
      }
      if (order.status === "완료" && !order.completedAt) order.completedAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();
      if (typeof body.memo === "string") await upsertStepMemo(order.id, stepCode, body.memo);
      await updateOrderStateRow(order);
      await insertLogRow(db.logs[0]);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "previous") {
      const user = getRequestUser(req, db);
      order.worker = user?.name || order.worker;
      const prev = previousStep(order.currentStep);
      if (prev) {
        const before = getStep(order.currentStep).name;
        order.currentStep = prev.code;
        order.status = stepStatus(prev.code);
        if (order.status !== "완료") order.completedAt = null;
        order.updatedAt = new Date().toISOString();
        addLog(db, order, "이전 단계 이동", `${before}에서 ${prev.name}로 이동`);
      }
      await updateOrderStateRow(order);
      if (db.logs[0]?.orderId === order.id) await insertLogRow(db.logs[0]);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "naver-cafe") {
      const fullDb = await readDb();
      const user = getRequestUser(req, fullDb) || getRequestUser(req, db);
      const settings = { ...defaultNaverCafeSettings(), ...(fullDb.appSettings?.naverCafe || {}) };
      try {
        const result = await postOrderToNaverCafe(order, settings, { baseUrl: requestBaseUrl(req) });
        order.worker = user?.name || order.worker;
        order.cafeStatus = "카페완료";
        order.cafeUrl = result.url || "";
        order.cafePostedAt = new Date().toISOString();
        order.cafeError = "";
        order.updatedAt = new Date().toISOString();
        addLog(db, order, "네이버 카페 업로드", `${result.photoCount}장${result.attemptMode === "link-only-retry" ? " · 링크 전용" : ""}${result.url ? ` · ${result.url}` : ""}`);
        await updateOrderStateRow(order);
        await insertLogRow(db.logs[0]);
        invalidateDbCache();
        const updatedOrder = await readOrderById(order.id);
        return sendJson(res, 200, { order: updatedOrder || order, cafe: result });
      } catch (error) {
        order.cafeStatus = "카페실패";
        order.cafeError = error.message || "네이버 카페 업로드 실패";
        order.updatedAt = new Date().toISOString();
        await updateOrderStateRow(order);
        invalidateDbCache();
        return sendJson(res, error.status || 500, { error: order.cafeError, order, details: error.details || null });
      }
    }

    if (req.method === "POST" && orderMatch[2] === "share") {
      const body = await readBody(req);
      const user = getRequestUser(req, db);
      order.worker = user?.name || order.worker;
      if (String(body.target || "").startsWith("sms")) {
        order.currentStep = "10";
        order.status = "\uC644\uB8CC";
        order.shareStatus = "\uBB38\uC790\uC804\uC1A1\uC644\uB8CC";
        if (!order.completedAt) order.completedAt = new Date().toISOString();
      } else if (body.target === "customer") {
        order.currentStep = "10";
        order.status = "\uC644\uB8CC";
        order.shareStatus = "\uB0B4\uBCF4\uB0B4\uAE30\uC644\uB8CC";
        if (!order.completedAt) order.completedAt = new Date().toISOString();
      } else {
        order.shareStatus = "\uB0B4\uBCF4\uB0B4\uAE30\uC644\uB8CC";
      }
      order.updatedAt = new Date().toISOString();
      addLog(db, order, "\uB0B4\uBCF4\uB0B4\uAE30", order.shareStatus);
      await updateOrderStateRow(order);
      await insertLogRow(db.logs[0]);
      return sendJson(res, 200, { order });
    }

    if (req.method === "POST" && orderMatch[2] === "share-link") {
      const body = await readBody(req);
      const validPhotoIds = new Set((order.photos || []).map((photo) => photo.id));
      const hiddenPhotoIds = Array.isArray(body.hiddenPhotoIds)
        ? body.hiddenPhotoIds.filter((id) => validPhotoIds.has(id))
        : [];
      const customerMemo = String(body.customerMemo || "").trim().slice(0, 2000);
      const token = await upsertShortShareLink(order.id, hiddenPhotoIds, customerMemo);
      return sendJson(res, 200, { token, path: `/s/${token}` });
    }
  }

  return sendJson(res, 404, { error: "API를 찾을 수 없습니다." });
}

async function serveSharePage(req, res, url) {
  const shortToken = url.pathname.startsWith("/s/") ? decodeURIComponent(url.pathname.replace(/^\/s\//, "")) : "";
  const shortLink = shortToken ? await readShortShareLink(shortToken) : null;
  const orderId = shortLink?.orderId || decodeURIComponent(url.pathname.replace(/^\/share\//, ""));
  const db = await readDb();
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><meta charset=\"utf-8\"><title>사진 링크 없음</title><p>사진 링크를 찾을 수 없습니다.</p>");
    return;
  }

  const hiddenPhotoIds = new Set(shortLink ? shortLink.hiddenPhotoIds || [] : String(url.searchParams.get("hide") || "").split(",").filter(Boolean));
  const customerMemo = String(shortLink ? shortLink.customerMemo : url.searchParams.get("memo") || "").trim().slice(0, 2000);
  const allPhotos = (order.photos || [])
    .filter((photo) => !hiddenPhotoIds.has(photo.id) && isPhotoStep(photo.stepCode))
    .sort(compareCustomerPhotoOrder);
  const downloadGroups = {
    all: allPhotos.map((photo, index) => sharedDownloadItem(photo, order, index)),
  };
  const downloadData = JSON.stringify(downloadGroups).replace(/</g, "\\u003c");
  const photoSections = renderSharedProductSections(allPhotos);

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.end(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>작업사진</title>
    <style>
      :root { --green:#124f46; --ink:#17211f; --muted:#6a7773; --line:#dce7e3; --bg:#f5f8f7; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
      header { position:relative; padding:24px 18px 18px; background:#fff; border-bottom:1px solid var(--line); }
      main { width:min(920px,100%); margin:0 auto; padding:16px; }
      .eyebrow { margin:0 0 8px; color:var(--green); font-size:13px; font-weight:900; letter-spacing:.04em; }
      h1 { margin:0 0 8px; font-size:28px; }
      .meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
      .chip { padding:7px 10px; border-radius:999px; color:var(--green); background:#e7f2ef; font-size:13px; font-weight:800; }
      .customer-message { margin:14px 0 0; padding:13px 14px; border-left:4px solid var(--green); border-radius:8px; color:var(--ink); background:#eef7f4; font-size:15px; font-weight:700; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
      .review-links { position:absolute; top:16px; right:16px; display:flex; gap:7px; }
      .review-link { display:inline-grid; grid-template-columns:auto auto; align-items:center; gap:5px; min-height:34px; padding:0 10px; border-radius:999px; color:#fff; font-size:12px; font-weight:900; text-decoration:none; box-shadow:0 6px 18px rgba(0,0,0,.08); }
      .review-link.naver { background:#03c75a; }
      .review-link.daangn { background:#ff6f0f; }
      .review-link b { display:grid; place-items:center; width:18px; height:18px; border-radius:50%; background:rgba(255,255,255,.22); font-size:11px; line-height:1; }
      .download-hero { display:none; margin-top:18px; grid-template-columns:1fr; gap:8px; }
      .download-hero.has-selection { grid-template-columns:1fr 1fr; }
      .download-button { display:grid; place-items:center; width:100%; min-height:48px; border:0; border-radius:12px; color:#fff; background:var(--green); font-size:16px; font-weight:900; text-decoration:none; cursor:pointer; }
      .download-button.secondary { display:none; color:var(--green); background:#e7f2ef; }
      .download-button.cancel { display:none; grid-column:1 / -1; color:#9b3a2f; background:#f8e7e2; }
      .download-hero.has-selection .download-button.secondary { display:grid; }
      .download-hero.has-selection .download-button.cancel { display:grid; }
      .download-help { grid-column:1 / -1; }
      .download-help { margin:0; color:var(--muted); font-size:12px; line-height:1.45; }
      .product-switch { display:flex; gap:9px; overflow-x:auto; padding:0 16px 13px; background:#fff; border-bottom:1px solid var(--line); scrollbar-width:none; }
      .product-switch::-webkit-scrollbar { display:none; }
      .product-switch button { flex:0 0 auto; max-width:min(260px,76vw); min-height:42px; border:1px solid #b7d8cf; border-radius:999px; padding:0 14px; color:#1f5a50; background:#f4fbf8; box-shadow:0 4px 12px rgba(18,79,70,.06); font-size:13px; font-weight:900; }
      .product-switch button.is-active { color:#fff; background:var(--green); border-color:var(--green); box-shadow:0 8px 18px rgba(18,79,70,.18); }
      .product-switch button span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .product-section { display:none; }
      .product-section.is-active { display:block; }
      .product-title { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 0 12px; }
      .product-title strong { font-size:18px; }
      .product-title span { color:var(--muted); font-size:13px; font-weight:800; }
      .customer-step-section { margin-top:18px; }
      .customer-step-section:first-of-type { margin-top:0; }
      .customer-step-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 9px; padding:0 2px; }
      .customer-step-title strong { color:var(--green); font-size:16px; }
      .customer-step-title span { color:var(--muted); font-size:12px; font-weight:800; }
      .gallery { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; }
      figure { position:relative; margin:0; overflow:hidden; border:1px solid var(--line); border-radius:10px; background:#fff; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:pan-y; }
      figure * { -webkit-touch-callout:default; }
      figure.is-selected { border-color:var(--green); box-shadow:0 0 0 2px rgba(18,79,70,.22); }
      figure i { position:absolute; top:6px; right:6px; z-index:2; display:grid; place-items:center; width:24px; height:24px; border-radius:50%; color:#fff; background:rgba(18,79,70,.86); font-style:normal; font-weight:900; opacity:0; pointer-events:none; }
      figure.is-selected i { opacity:1; }
      img, video { display:block; width:100%; aspect-ratio:1/1; object-fit:cover; background:#edf3f1; }
      .gallery img, .gallery video { pointer-events:auto; }
      .customer-lightbox { position:fixed; inset:0; z-index:100; display:grid; place-items:center; padding:18px; background:rgba(8,13,12,.92); }
      .customer-lightbox[hidden] { display:none; }
      .customer-lightbox-media { display:grid; place-items:center; width:100%; height:100%; touch-action:none; }
      .customer-lightbox-media img, .customer-lightbox-media video { width:auto; height:auto; max-width:100%; max-height:100%; aspect-ratio:auto; object-fit:contain; border-radius:10px; background:#111; -webkit-touch-callout:default; }
      .customer-lightbox-close { position:absolute; top:18px; right:18px; z-index:102; width:46px; height:46px; border:0; border-radius:50%; color:#fff; background:rgba(255,255,255,.18); font-size:28px; cursor:pointer; }
      .customer-lightbox-arrow { position:absolute; top:50%; z-index:102; width:44px; height:68px; border:0; border-radius:999px; color:#fff; background:rgba(255,255,255,.18); font-size:42px; line-height:1; transform:translateY(-50%); cursor:pointer; }
      .customer-lightbox-arrow.is-left { left:10px; }
      .customer-lightbox-arrow.is-right { right:10px; }
      .customer-lightbox-arrow:disabled { opacity:.2; }
      .empty { padding:36px 16px; text-align:center; color:var(--muted); background:#fff; border:1px solid var(--line); border-radius:14px; }
      footer { padding:24px 16px 36px; color:var(--muted); text-align:center; font-size:12px; }
      @media (max-width:520px) { main { padding:10px; } .gallery { gap:5px; } .review-links { position:static; margin-bottom:14px; justify-content:flex-end; } }
    </style>
  </head>
  <body>
    <header>
      <nav class="review-links" aria-label="후기 남기기">
        <a class="review-link naver" href="https://naver.me/xzHLcO5j" target="_blank" rel="noopener"><b>N</b><span>네이버</span></a>
        <a class="review-link daangn" href="https://www.daangn.com/kr/local-profile/5y89j1rspzrb" target="_blank" rel="noopener"><b>ㄷ</b><span>당근</span></a>
      </nav>
      <p class="eyebrow">bebeu PHOTO</p>
      <h1>작업사진</h1>
      ${customerMemo ? `<div class="customer-message">${escapeHtml(customerMemo)}</div>` : ""}
      <div class="meta">
        <span class="chip">사진 ${allPhotos.length}장</span>
        ${order.completedAt ? `<span class="chip">완료 ${escapeHtml(new Date(order.completedAt).toLocaleDateString("ko-KR"))}</span>` : ""}
      </div>
      <!-- 이미지 선택 및 다운로드 기능 임시 비활성화
      <div class="download-hero">
        <button class="download-button" type="button" data-download-all>전체 사진 다운로드</button>
        <button class="download-button secondary" type="button" data-download-selected>선택 사진 다운로드</button>
        <button class="download-button cancel" type="button" data-selection-cancel>취소</button>
        <p class="download-help">여러 장 다운로드 허용 안내가 뜨면 허용을 눌러주세요.</p>
      </div>
      -->
    </header>
    ${""}
    <main>${photoSections || `<div class="empty">아직 공유할 사진이 없습니다.</div>`}</main>
    <div class="customer-lightbox" data-customer-lightbox hidden>
      <button class="customer-lightbox-close" type="button" data-lightbox-close aria-label="사진 닫기">×</button>
      <button class="customer-lightbox-arrow is-left" type="button" data-lightbox-previous aria-label="이전 사진">‹</button>
      <div class="customer-lightbox-media" data-lightbox-media></div>
      <button class="customer-lightbox-arrow is-right" type="button" data-lightbox-next aria-label="다음 사진">›</button>
    </div>
    <footer>사진은 bebeu 작업 확인용으로 제공됩니다.</footer>
    <script>
      const downloadGroups = ${downloadData};
      const downloadSelectionEnabled = false;
      const selectedIndexes = new Set();
      const downloadHero = document.querySelector(".download-hero");
      let selectionMode = false;
      let selectionHistoryActive = false;
      let selectionDragActive = false;
      function selectedFiles() {
        return Array.from(selectedIndexes).sort((a, b) => a - b).map((index) => downloadGroups.all[index]).filter(Boolean);
      }
      function updateSelectionUi() {
        downloadHero?.classList.toggle("has-selection", selectionMode || selectedIndexes.size > 0);
        const button = document.querySelector("[data-download-selected]");
        if (button) button.textContent = selectedIndexes.size ? "선택 사진 다운로드 (" + selectedIndexes.size + "장)" : "선택 사진 다운로드";
      }
      function enterSelectionMode() {
        if (!downloadSelectionEnabled) return;
        if (selectionMode) return;
        selectionMode = true;
        document.body.classList.add("is-selection-mode");
        if (!selectionHistoryActive) {
          history.pushState({ photoSelection: true }, "");
          selectionHistoryActive = true;
        }
      }
      function clearSelectionMode({ fromPop = false } = {}) {
        selectionMode = false;
        selectionDragActive = false;
        selectedIndexes.clear();
        photoFigures.forEach((figure) => figure.classList.remove("is-selected"));
        document.body.classList.remove("is-selection-mode");
        updateSelectionUi();
        if (selectionHistoryActive) {
          selectionHistoryActive = false;
          if (!fromPop) history.back();
        }
      }
      function setFigureSelected(figure, selected = true) {
        const index = Number(figure?.dataset?.photoIndex);
        if (!Number.isFinite(index)) return;
        if (selected) selectedIndexes.add(index);
        else selectedIndexes.delete(index);
        figure.classList.toggle("is-selected", selectedIndexes.has(index));
        updateSelectionUi();
      }
      function selectFigureAtPoint(x, y) {
        const element = document.elementFromPoint(x, y);
        const figure = element?.closest?.("[data-photo-index]");
        if (figure) setFigureSelected(figure, true);
      }
      function downloadFiles(files) {
        if (!downloadSelectionEnabled) return;
        if (!files.length) {
          alert("다운로드할 사진이 없습니다.");
          return;
        }
        files.forEach((file) => {
          const link = document.createElement("a");
          link.href = file.url;
          link.download = file.name;
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();
        });
      }
      function downloadSelectedFiles() {
        if (!downloadSelectionEnabled) return;
        const files = selectedFiles();
        if (!files.length) {
          alert("다운로드할 사진을 선택해주세요.");
          return;
        }
        downloadFiles(files);
      }
      const photoFigures = Array.from(document.querySelectorAll("[data-photo-index]"));
      const lightbox = document.querySelector("[data-customer-lightbox]");
      const lightboxMedia = document.querySelector("[data-lightbox-media]");
      let lightboxPosition = -1;
      let lightboxTouchStartX = 0;
      let lightboxTouchStartY = 0;
      let lightboxTouchActive = false;
      function toggleFigureSelection(figure) {
        const index = Number(figure.dataset.photoIndex);
        if (selectedIndexes.has(index)) selectedIndexes.delete(index);
        else selectedIndexes.add(index);
        figure.classList.toggle("is-selected", selectedIndexes.has(index));
        updateSelectionUi();
        navigator.vibrate?.(35);
      }
      function showLightbox(position) {
        if (!photoFigures.length || !lightbox || !lightboxMedia) return;
        lightboxPosition = Math.max(0, Math.min(photoFigures.length - 1, position));
        const figure = photoFigures[lightboxPosition];
        const media = document.createElement(figure.dataset.mediaType === "video" ? "video" : "img");
        media.src = figure.dataset.displayUrl;
        if (media.tagName === "VIDEO") {
          media.controls = true;
          media.playsInline = true;
          media.autoplay = true;
        } else {
          media.alt = "작업 사진 크게 보기";
        }
        lightboxMedia.replaceChildren(media);
        lightbox.hidden = false;
        document.body.style.overflow = "hidden";
        document.querySelector("[data-lightbox-previous]").disabled = lightboxPosition === 0;
        document.querySelector("[data-lightbox-next]").disabled = lightboxPosition === photoFigures.length - 1;
      }
      function moveLightbox(delta) {
        if (lightbox?.hidden) return;
        const nextPosition = lightboxPosition + delta;
        if (nextPosition < 0 || nextPosition >= photoFigures.length) return;
        showLightbox(nextPosition);
      }
      function closeLightbox() {
        if (!lightbox) return;
        lightbox.hidden = true;
        lightboxMedia?.replaceChildren();
        document.body.style.overflow = "";
        lightboxPosition = -1;
      }
      photoFigures.forEach((figure, position) => {
        let pressTimer = null;
        let longPressed = false;
        let dragMoved = false;
        let startX = 0;
        let startY = 0;
        figure.querySelectorAll("img, video").forEach((media) => {
          media.draggable = true;
        });
        const cancelPress = () => {
          if (pressTimer) clearTimeout(pressTimer);
          pressTimer = null;
        };
        figure.addEventListener("pointerdown", (event) => {
          if (event.button !== undefined && event.button !== 0) return;
          longPressed = false;
          dragMoved = false;
          startX = event.clientX;
          startY = event.clientY;
          cancelPress();
          if (downloadSelectionEnabled && selectionMode) {
            selectionDragActive = true;
            return;
          }
          if (downloadSelectionEnabled) {
            pressTimer = setTimeout(() => {
              longPressed = true;
              selectionDragActive = true;
              enterSelectionMode();
              setFigureSelected(figure, true);
              navigator.vibrate?.(35);
              pressTimer = null;
            }, 420);
          }
        });
        figure.addEventListener("pointermove", (event) => {
          const movedX = Math.abs(event.clientX - startX);
          const movedY = Math.abs(event.clientY - startY);
          if (selectionDragActive) {
            dragMoved = dragMoved || movedX > 8 || movedY > 8;
            selectFigureAtPoint(event.clientX, event.clientY);
            event.preventDefault();
            return;
          }
          if (movedX > 16 || movedY > 16) cancelPress();
        });
        figure.addEventListener("pointerup", () => {
          cancelPress();
          selectionDragActive = false;
        });
        figure.addEventListener("pointercancel", () => {
          cancelPress();
          selectionDragActive = false;
        });
        figure.addEventListener("pointerleave", cancelPress);
        figure.addEventListener("click", (event) => {
          event.preventDefault();
          if (longPressed || dragMoved) {
            longPressed = false;
            dragMoved = false;
            return;
          }
          if (downloadSelectionEnabled && selectionMode) {
            toggleFigureSelection(figure);
            return;
          }
          showLightbox(position);
        });
      });
      document.addEventListener("pointermove", (event) => {
        if (!downloadSelectionEnabled) return;
        if (!selectionDragActive) return;
        selectFigureAtPoint(event.clientX, event.clientY);
        event.preventDefault();
      }, { passive: false });
      document.addEventListener("pointerup", () => {
        if (!downloadSelectionEnabled) return;
        selectionDragActive = false;
      });
      document.querySelector("[data-selection-cancel]")?.addEventListener("click", () => {
        if (!downloadSelectionEnabled) return;
        clearSelectionMode();
      });
      window.addEventListener("popstate", () => {
        if (!downloadSelectionEnabled) return;
        if (selectionMode) clearSelectionMode({ fromPop: true });
      });
      document.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
      document.querySelector("[data-lightbox-previous]")?.addEventListener("click", () => moveLightbox(-1));
      document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => moveLightbox(1));
      lightbox?.addEventListener("click", (event) => {
        if (event.target === lightbox) closeLightbox();
      });
      lightboxMedia?.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        lightboxTouchActive = true;
        lightboxTouchStartX = event.clientX;
        lightboxTouchStartY = event.clientY;
      });
      lightboxMedia?.addEventListener("pointerup", (event) => {
        if (!lightboxTouchActive) return;
        lightboxTouchActive = false;
        const diffX = event.clientX - lightboxTouchStartX;
        const diffY = event.clientY - lightboxTouchStartY;
        if (Math.abs(diffX) < 45 || Math.abs(diffX) < Math.abs(diffY) * 1.2) return;
        moveLightbox(diffX > 0 ? -1 : 1);
      });
      lightboxMedia?.addEventListener("pointercancel", () => {
        lightboxTouchActive = false;
      });
      document.addEventListener("keydown", (event) => {
        if (downloadSelectionEnabled && selectionMode && event.key === "Escape") {
          clearSelectionMode();
          return;
        }
        if (lightbox?.hidden) return;
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowLeft") moveLightbox(-1);
        if (event.key === "ArrowRight") moveLightbox(1);
      });
      if (downloadSelectionEnabled) {
        document.querySelector("[data-download-all]")?.addEventListener("click", () => downloadFiles(downloadGroups.all));
        document.querySelector("[data-download-selected]")?.addEventListener("click", downloadSelectedFiles);
      }
      document.querySelectorAll("[data-product-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          document.querySelectorAll("[data-product-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
          document.querySelectorAll("[data-product-section]").forEach((section) => {
            section.classList.toggle("is-active", section.dataset.productSection === button.dataset.productTab);
          });
        });
      });
    </script>
  </body>
</html>`);
}

function sharedDownloadItem(photo, order, index) {
  const name = sharedDownloadName(photo, order, index);
  const downloadUrl = photo.displayUrl || photo.url;
  return {
    id: photo.id,
    url: `${downloadUrl}?download=1&name=${encodeURIComponent(name)}`,
    name,
  };
}

function compareCustomerPhotoOrder(a, b) {
  const uploadedAt = String(a.uploadedAt || "").localeCompare(String(b.uploadedAt || ""));
  if (uploadedAt) return uploadedAt;
  const sortOrder = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  if (sortOrder) return sortOrder;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function sharedProductGroups(order, photos) {
  return photos.length ? [{
    productIndex: 1,
    title: [order.productType, order.brand, order.modelName].filter(Boolean).join(" ") || "작업 사진",
    photos,
  }] : [];
}

function parseOrderProducts(order) {
  const products = [];
  let reading = false;
  String(order.requestMemo || "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^제품\s*목록\s*:/u.test(trimmed)) {
      reading = true;
      return;
    }
    if (!reading) return;
    const match = trimmed.match(/^(\d+)\.\s*(.+)$/u);
    if (!match) {
      reading = false;
      return;
    }
    const productIndex = normalizeProductIndex(match[1]);
    const title = match[2]
      .replace(/부속품:\s*.*?(?=\s+오염:|$)/u, "")
      .replace(/오염:\s*.*$/u, "")
      .trim();
    products.push({ productIndex, title: title || "제품 정보" });
  });

  if (!products.length && (order.productType || order.brand || order.modelName)) {
    products.push({
      productIndex: 1,
      title: [order.productType, order.brand, order.modelName].filter(Boolean).join(" ") || "제품 정보",
    });
  }

  return products;
}

function sharedProductButtonTitle(title) {
  return String(title || "제품 정보 없음")
    .replace(/^(카시트|유모차)\s+/u, "")
    .trim() || "제품 정보 없음";
}

function renderSharedProductSections(allPhotos) {
  return `
    <section class="product-section is-active" data-product-section="0">
      ${allPhotos.length ? `<section class="gallery">${allPhotos.map((photo, index) => renderSharedPhoto(photo, index)).join("")}</section>` : `<div class="empty">공유할 사진이 없습니다.</div>`}
    </section>
  `;
}

function sharedDownloadName(photo, order, index) {
  const ext = path.extname(photo.originalName || photo.filePath || "") || getMediaExtension(photo.mimeType || "image/jpeg", "");
  const step = getStep(photo.stepCode);
  return `${safeName(order.serial)}_${step.code}_${safeName(sharedStepName(step))}_${String(index + 1).padStart(2, "0")}${ext}`;
}

function sharedStepName(step) {
  if (step?.code === "06") return "살균 · 소독 · 피톤치드 · 포장";
  return step?.name || "";
}

async function serveShareZip(req, res, url) {
  const match = url.pathname.match(/^\/share\/([^/]+)\/download\.zip$/);
  const orderId = decodeURIComponent(match?.[1] || "");
  const db = await readDb();
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("사진 링크를 찾을 수 없습니다.");
    return;
  }

  const stepCode = url.searchParams.get("step");
  const selectedIds = new Set((url.searchParams.get("ids") || "").split(",").map((item) => item.trim()).filter(Boolean));
  const selectedPhotos = (order.photos || [])
    .filter((photo) => isPhotoStep(photo.stepCode)
      && (!stepCode || photo.stepCode === stepCode)
      && (!selectedIds.size || selectedIds.has(photo.id)))
    .sort(compareCustomerPhotoOrder);
  const entries = selectedPhotos
    .map((photo, index) => {
      const filePath = resolvePhotoPath(photo.displayFilePath || photo.filePath);
      if (!filePath || !fs.existsSync(filePath)) return null;
      return {
        name: sharedDownloadName(photo, order, index),
        data: fs.readFileSync(filePath),
      };
    })
    .filter(Boolean);

  if (!entries.length) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("다운로드할 사진이 없습니다.");
    return;
  }

  const step = stepCode ? getStep(stepCode) : null;
  const zipName = step
    ? `${safeName(order.serial)}_${step.code}_${safeName(sharedStepName(step))}.zip`
    : `${safeName(order.serial)}_전체사진.zip`;
  const zip = createZip(entries);

  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": contentDisposition(zipName),
    "Content-Length": zip.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.end(zip);
}

function contentDisposition(filename) {
  const fallback = safeName(filename).replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function renderSharedPhoto(photo, index) {
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video/");
  const originalUrl = escapeHtml(photo.url);
  const displayUrl = escapeHtml(photo.displayUrl || photo.thumbnailUrl || photo.url);
  const media = isVideo
    ? `<video src="${originalUrl}" controls playsinline preload="metadata"></video>`
    : `<img src="${displayUrl}" alt="${escapeHtml(photo.originalName || "작업 사진")}" loading="lazy" decoding="async" fetchpriority="low">`;
  return `
    <figure data-photo-index="${index}" data-display-url="${displayUrl}" data-media-type="${isVideo ? "video" : "image"}">
      ${media}
      <i aria-hidden="true">✓</i>
    </figure>
  `;
}

async function servePhoto(req, res, pathname) {
  const photoUrl = new URL(req.url, `http://${req.headers.host}`);
  const shouldDownload = photoUrl.searchParams.has("download");
  const parts = pathname.split("/");
  const orderId = decodeURIComponent(parts[2] || "");
  const filename = decodeURIComponent(parts[3] || "");
  const photo = await readPhotoByOrderAndFilename(orderId, filename);
  const filePath = photo ? resolvePhotoPath(photo.filePath) : null;
  if (!photo || !filePath || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": shouldDownload ? "no-store" : "public, max-age=604800, immutable",
  };
  if (shouldDownload) {
    headers["Content-Disposition"] = contentDisposition(photoUrl.searchParams.get("name") || photo.originalName || path.basename(filePath));
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function serveChatPhoto(req, res, pathname) {
  const parts = pathname.split("/");
  const month = decodeURIComponent(parts[2] || "");
  const filename = decodeURIComponent(parts[3] || "");
  const filePath = path.normalize(path.join(CHAT_PHOTO_ROOT, month, filename));
  const relative = path.relative(CHAT_PHOTO_ROOT, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "public, max-age=604800, immutable",
  });
  fs.createReadStream(filePath).pipe(res);
}

function resolvePhotoPath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
}

function isInsidePhotoRoot(filePath) {
  const relative = path.relative(PHOTO_ROOT, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isInsideChatPhotoRoot(filePath) {
  const relative = path.relative(CHAT_PHOTO_ROOT, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const noCache = ["/", "/sw.js", "/app.js", "/styles.css", "/index.html"].includes(pathname);
  const cacheControl = noCache
    ? "no-cache, no-store, must-revalidate"
    : "public, max-age=86400";
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": cacheControl,
  });
  fs.createReadStream(filePath).pipe(res);
}

ensureStorage();

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", reason);
});

const server = http.createServer(async (req, res) => {
  try {
    applyAppCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    if (/^\/share\/[^/]+\/download\.zip$/.test(url.pathname)) return await serveShareZip(req, res, url);
    if (url.pathname.startsWith("/share/")) return await serveSharePage(req, res, url);
    if (url.pathname.startsWith("/s/")) return await serveSharePage(req, res, url);
    if (url.pathname.startsWith("/photos/")) return await servePhoto(req, res, url.pathname);
    if (url.pathname.startsWith("/chat-photos/")) return serveChatPhoto(req, res, url.pathname);
    return serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    sendErrorJson(req, res, error);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  logInfo(`bebeu PWA is running at http://localhost:${PORT}`);
  logInfo(`Photo root: ${PHOTO_ROOT}`);
  logInfo(`Log root: ${LOG_DIR}`);
  logInfo(`DB mode: ${mysql2 ? "direct MariaDB pool" : "mysql.exe fallback"}`);
});
