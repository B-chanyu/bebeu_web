const ORDER_DEFAULT_DAYS = 5;
const DEFAULT_DATE_RANGE = defaultDateRange();
const VIEW_STATE_KEY = "bebeu.viewState";
const RESTORABLE_VIEW_KEYS = ["tab", "selectedOrderId", "selectedStep", "filter", "listTypeFilter", "toolbarCollapsed", "dateStart", "dateEnd", "doneDateStart", "doneDateEnd", "workDateSort", "doneDateSort", "query"];
const PHOTO_STEP_LIMIT = 9;
const WORKFLOW_STEPS = [
  { code: "01", label: "접수" },
  { code: "02", label: "라벨링" },
  { code: "03", label: "전사진" },
  { code: "04", label: "탈거" },
  { code: "05", label: "세탁" },
  { code: "06", label: "조립" },
  { code: "07", label: "검수" },
  { code: "08", label: "후사진" },
  { code: "09", label: "살균" },
  { code: "10", label: "배송" },
];
const DONE_STATUS_FILTERS = [
  { code: "done-ready", name: "완료", label: "완료" },
  { code: "sms-done", name: "문자완료", label: "문자완료" },
  { code: "export-done", name: "내보내기완료", label: "내보내기완료" },
];
const PHOTO_UPLOAD_BATCH_SIZE = 10;
const PHOTO_UPLOAD_MAX_COUNT = 50;
const CHAT_POLL_INTERVAL_MS = 4000;
const FONT_SCALE_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
const DEFAULT_HOURLY_WAGE = 10320;
const APP_FONTS = [
  { id: "default", label: "기본", family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: "leeseyoon", label: "이서윤체", family: '"LeeSeoyun", "이서윤체", system-ui, sans-serif' },
  { id: "mitmi", label: "밋미체", family: '"MitmiFont", "LeeSeoyun", system-ui, sans-serif' },
  { id: "gangwon", label: "강원교육튼튼체", family: '"GangwonEducationTteontteon", "LeeSeoyun", system-ui, sans-serif' },
  { id: "okdandan", label: "옥단단체", family: '"OkDandan", "LeeSeoyun", system-ui, sans-serif' },
  { id: "memoment", label: "메모먼트꾹꾹체", family: '"MemomentGgukGguk", "LeeSeoyun", system-ui, sans-serif' },
  { id: "paperozi", label: "페이퍼로지", family: '"Paperozi", "LeeSeoyun", system-ui, sans-serif' },
  { id: "gothic", label: "고딕", family: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' },
  { id: "serif", label: "명조", family: '"Noto Serif KR", "Batang", "AppleMyungjo", serif' },
  { id: "rounded", label: "둥근고딕", family: '"NanumSquareRound", "Nanum Gothic", "Apple SD Gothic Neo", sans-serif' },
  { id: "hand", label: "손글씨", family: '"LeeSeoyun", "Nanum Pen Script", "Comic Sans MS", cursive' },
];
const CHAT_ROOMS = [
  { id: "main", label: "채팅" },
];
const CHAT_COMPOSER_STEPS = [
  { code: "01", label: "접수" },
  { code: "03", label: "전사진" },
  { code: "08", label: "후사진" },
];
const LIST_TYPE_FILTERS = [
  { code: "A", label: "A" },
  { code: "B", label: "B" },
  { code: "today", label: "오늘할일" },
];
const appFontSizeRules = [];
let appFontSizesCaptured = false;
let deferredInstallPrompt = null;
const APP_SERVER_KEY = "bebeu.nativeServerUrl";
const CUSTOMER_SHARE_CACHE_VERSION = "300";

const state = {
  tab: "me",
  data: null,
  currentUserId: localStorage.getItem("bebeu.currentUserId") || "",
  selectedOrderId: null,
  selectedStep: "all",
  query: "",
  chatSearchIndex: 0,
  chatRoom: "main",
  chatComposerStepCode: "01",
  filter: "all",
  listTypeFilter: "all",
  urgentStripMode: "urgent",
  toolbarCollapsed: false,
  dateStart: DEFAULT_DATE_RANGE.start,
  dateEnd: DEFAULT_DATE_RANGE.end,
  doneDateStart: DEFAULT_DATE_RANGE.start,
  doneDateEnd: DEFAULT_DATE_RANGE.end,
  workDateSort: "desc",
  doneDateSort: "desc",
  pendingPhotos: [],
  chatPendingMedia: [],
  selectedPhotoIds: [],
  selectedDoneOrderIds: [],
  photoGridColumns: 3,
  smsTemplateSlots: {},
  smsMessageDrafts: {},
  customerShareMemo: "",
  photoSelectionMode: false,
  doneOrderSelectionMode: false,
  expandedPhotoId: null,
  quickListPhotoOrderId: null,
  chatExpandedAttachmentId: null,
  trashExpandedPhotoId: null,
  chatTransferMessageId: null,
  photoPressTimer: null,
  orderPressTimer: null,
  suppressPhotoTap: false,
  suppressDoneOrderTap: false,
  photoDragSelection: null,
  lightboxSwipeStart: null,
  lightboxPointers: new Map(),
  lightboxZoom: { scale: 1, baseScale: 1, startDistance: 0, panX: 0, panY: 0, startPanX: 0, startPanY: 0, lastX: 0, lastY: 0, isPanning: false },
  expandedPhotoReturnTab: null,
  quickPhotoAdvance: false,
  applyingHistory: false,
  allowExit: false,
  savingOrder: false,
  savingPhoto: false,
  loadingMessage: "",
  toastMessage: "",
  toastTimer: null,
  keepEditingId: null,
  keepEditingType: "text",
  attendancePayrollUserId: null,
  attendanceEditDay: null,
  trashSelectedPhotoIds: [],
  trashOpen: false,
  pendingAdminLoginUserId: null,
  adminLoginError: "",
  passwordChangeOpen: false,
  passwordChangeMessage: "",
  orderType: "A",
  activeProductIndex: 0,
  detailProductIndex: 0,
  productSlots: Array.from({ length: 5 }, () => ({ types: [], brand: "", modelName: "", accessories: [], note: "" })),
};

const content = document.querySelector("#content");
const title = document.querySelector("#screenTitle");
const orderDialog = document.querySelector("#orderDialog");
const editOrderDialog = document.querySelector("#editOrderDialog");
const photoDialog = document.querySelector("#photoDialog");
const orderForm = document.querySelector("#orderForm");
const editOrderForm = document.querySelector("#editOrderForm");
const photoForm = document.querySelector("#photoForm");
const orderPasteInput = document.querySelector("#orderPasteInput");
const cameraInput = document.querySelector("#cameraInput");
const galleryInput = document.querySelector("#galleryInput");
const photoMemo = document.querySelector("#photoMemo");
const photoPreview = document.querySelector("#photoPreview");

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function configuredServerBase() {
  if (!isNativeApp()) return window.location.origin;
  return String(localStorage.getItem(APP_SERVER_KEY) || "").trim().replace(/\/$/, "");
}

function normalizeNativeServerBase(value) {
  const normalized = String(value || "").trim().replace(/\/$/, "");
  if (!/^https:\/\//i.test(normalized)) {
    throw new Error("설치형 앱의 서버 주소는 https://로 시작해야 합니다.");
  }
  return normalized;
}

function serverUrl(path = "") {
  if (/^https?:\/\//i.test(path)) return path;
  const base = configuredServerBase();
  if (!base) throw new Error("설정에서 bebeu 서버 주소를 먼저 입력해 주세요.");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function serverAssetUrl(path = "") {
  if (!path) return "";
  try {
    return serverUrl(path);
  } catch {
    return path;
  }
}

function renderNativeServerSetup(message = "") {
  title.textContent = "서버 연결";
  content.innerHTML = `
    <section class="panel stack native-server-setup">
      <div class="section-title">
        <h2>bebeu 서버 연결</h2>
        <span class="chip">최초 1회</span>
      </div>
      <p class="helper">앱이 사용할 HTTPS 서버 주소를 입력해 주세요. 예: https://app.bebeu.co.kr</p>
      ${message ? `<p class="form-error">${escapeHtml(message)}</p>` : ""}
      <label>서버 주소
        <input id="nativeServerUrlInput" type="url" inputmode="url" autocomplete="url" placeholder="https://" value="${escapeHtml(configuredServerBase())}">
      </label>
      <button class="primary-button" type="button" id="saveNativeServerButton">연결하고 시작</button>
    </section>
  `;
}

const BRAND_CATALOG = {
  부가부: ["비", "폭스", "버터플라이", "드래곤플라이", "동키", "기타"],
  리안: ["솔로", "그램", "프라임", "스핀", "기타"],
  잉글레시나: ["앱티카", "트릴로지", "일렉타", "기타"],
  요요: ["요요", "요요2", "요요3", "기타"],
  싸이벡스: ["프리암", "미오스", "제로나", "솔루션", "기타"],
  브라이텍스: ["듀얼픽스", "어드밴스", "오메가", "기타"],
  조이: ["아이스핀", "스핀360", "기타"],
  다이치: ["원픽스", "브이가드", "기타"],
  스토케: ["익스플로리", "비트", "요요", "기타"],
  기타: ["기타"],
};

const PRODUCT_NOTE_OPTIONS = ["선결", "곰팡이", "오염", "토사물", "냄새", "대변", "소변"];
const PRODUCT_ACCESSORY_OPTIONS = {
  카시트: ["신생아시트", "메모리 이너", "캐노피", "의자시트", "차량시트"],
  유모차: ["방풍커버", "이너시트", "방한커버", "레인 커버", "어댑터", "가방"],
};

async function api(path, options = {}) {
  const response = await fetch(serverUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(state.currentUserId ? { "X-User-Id": state.currentUserId } : {}),
    },
    ...options,
  });
  const body = await readResponseBody(response);
  if (!response.ok && body.detail) throw new Error(body.detail);
  if (!response.ok) {
    const error = new Error(body.error || "요청을 처리하지 못했습니다.");
    error.details = body.details || null;
    error.body = body;
    throw error;
  }
  return body;
}

async function uploadPhotos(path, formData) {
  let response;
  try {
    response = await fetch(serverUrl(path), {
      method: "POST",
      headers: {
        ...(state.currentUserId ? { "X-User-Id": state.currentUserId } : {}),
      },
      body: formData,
    });
  } catch (error) {
    throw new Error(`업로드 연결이 끊겼습니다. (${error.message || "Load failed"})`);
  }
  const body = await readResponseBody(response);
  if (!response.ok && body.detail) throw new Error(body.detail);
  if (!response.ok) throw new Error(body.error || "사진 저장에 실패했습니다.");
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadPhotosWithRetry(path, formData, retries = 1) {
  try {
    return await uploadPhotos(path, formData);
  } catch (error) {
    if (retries <= 0) throw error;
    await sleep(800);
    return uploadPhotosWithRetry(path, formData, retries - 1);
  }
}

async function uploadPhotoBatches(order, pendingPhotos, selectedStep, memo, onProgress, advanceAfterUpload = false) {
  let uploadResult = null;
  const total = pendingPhotos.length;
  const productIndex = 1;
  for (let start = 0; start < pendingPhotos.length; start += PHOTO_UPLOAD_BATCH_SIZE) {
    const batch = pendingPhotos.slice(start, start + PHOTO_UPLOAD_BATCH_SIZE);
    const formData = new FormData();
    formData.append("stepCode", selectedStep);
    formData.append("productIndex", productIndex);
    formData.append("memo", memo);
    formData.append("uploadOffset", start);
    if (advanceAfterUpload && start + batch.length >= pendingPhotos.length) formData.append("advance", "1");
    batch.forEach((media) => {
      const uploadFile = media.displayFile || media.file;
      formData.append("files", uploadFile, uploadFile.name || media.originalName);
    });
    onProgress?.(start, total, `사진 업로드 중 (${Math.floor(start / PHOTO_UPLOAD_BATCH_SIZE) + 1}/${Math.ceil(total / PHOTO_UPLOAD_BATCH_SIZE)})`);
    await waitForPaint();
    uploadResult = await uploadPhotosWithRetry(`/api/orders/${order.id}/photo`, formData, 1);
    onProgress?.(Math.min(start + batch.length, total), total, "사진 저장 중");
    await waitForPaint();
  }
  return uploadResult;
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const shortText = text.replace(/\s+/g, " ").trim().slice(0, 300);
    return {
      error: shortText
        ? `서버에서 오류 응답을 보냈습니다. ${shortText}`
        : "서버에서 알 수 없는 오류 응답을 보냈습니다.",
    };
  }
}

async function load() {
  if (isNativeApp() && !configuredServerBase()) {
    renderNativeServerSetup();
    return;
  }
  state.data = await api("/api/bootstrap");
  migrateLocalSmsTemplatesToDb();
  restoreViewState();
  applyUserAppearance();
  const validStepCodes = new Set(state.data.steps.map((step) => step.code));
  if (state.filter !== "all" && !validStepCodes.has(state.filter)) state.filter = "all";
  if (state.selectedStep !== "all" && !validStepCodes.has(state.selectedStep)) state.selectedStep = "all";
  if (state.selectedOrderId && !state.data.orders.some((order) => order.id === state.selectedOrderId)) {
    state.selectedOrderId = null;
  }
  setupAppHistory();
  render();
  consumeLaunchRoute();
}

function migrateLocalSmsTemplatesToDb() {
  if (!state.data) return;
  const dbTemplates = state.data.smsTemplates && typeof state.data.smsTemplates === "object" ? state.data.smsTemplates : {};
  if (Object.keys(dbTemplates).length) return;
  let localTemplates = {};
  try {
    localTemplates = JSON.parse(localStorage.getItem(smsTemplateStorageKey()) || "{}");
  } catch {
    localTemplates = {};
  }
  if (!localTemplates || typeof localTemplates !== "object" || !Object.keys(localTemplates).length) return;
  state.data.smsTemplates = localTemplates;
  api("/api/sms-templates", {
    method: "POST",
    body: JSON.stringify({ templates: localTemplates }),
  }).catch((error) => {
    console.warn("SMS template migration failed", error);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const BROKEN_TEXT_REPLACEMENTS = [
  ["\uf9de\u0080\u003f\u003f", "지역"],
  ["\u8adb\uacd7\ub11a", "배송"],
  ["\u003f\uafa8\uc9ba", "완료"],
  ["\u003f\ub348\ucfb2", "품번"],
  ["\u6e72\uace0\u003f", "기타"],
  ["\uf9de\uafaa\ubefe", "진행"],
  ["\u613f\u0080\u7531\u044a\uc604", "관리자"],
  ["\uf9de\uacf8\uc35d", "직원"],
  ["\u003f\u044a\ucb4a", "사진"],
  ["\u6028\uc889\ucefc", "고객"],
  ["\u4e8c\uc1f1\ub0fc", "주소"],
  ["\u003f\uacd5\uc52b\uf9e3\u003f", "연락처"],
  ["\u003f\ubc40\uc520\u003f\u044b\ube46", "특이사항"],
  ["\u003f\ub300\ub0ab\u003f\ub2ff\ub9b0", "내보내기"],
];

function lineLooksBroken(line) {
  const text = String(line || "");
  if (!text) return false;
  if (/[\uFFFD\uF900-\uFAFF]/.test(text)) return true;
  if (/\?{2,}/.test(text)) return true;
  if (/[가-힣]\s*\?\s*[가-힣:]|\?[가-힣]|[가-힣]\?/.test(text)) return true;
  return false;
}

function cleanDisplayText(value) {
  let text = String(value ?? "");
  BROKEN_TEXT_REPLACEMENTS.forEach(([from, to]) => {
    text = text.split(from).join(to);
  });
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trimEnd())
    .filter((line) => !lineLooksBroken(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeDisplay(value) {
  return escapeHtml(cleanDisplayText(value));
}

function fmt(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function activeUser() {
  return state.data.users.find((user) => user.id === state.currentUserId) || state.data.users[0];
}

function isAdminUser(user = activeUser()) {
  return user?.role === "관리자";
}

function userFontScaleKey(userId = state.currentUserId) {
  return `bebeu.fontScale.${userId || "default"}`;
}

function userFontFamilyKey(userId = state.currentUserId) {
  return `bebeu.fontFamily.${userId || "default"}`;
}

function currentFontScale() {
  const saved = Number(localStorage.getItem(userFontScaleKey()));
  return FONT_SCALE_STEPS.includes(saved) ? saved : 1;
}

function currentFontFamilyId() {
  const saved = localStorage.getItem(userFontFamilyKey()) || "leeseyoon";
  return APP_FONTS.some((font) => font.id === saved) ? saved : "leeseyoon";
}

function currentFontFamily() {
  return APP_FONTS.find((font) => font.id === currentFontFamilyId()) || APP_FONTS[1];
}

function captureAppFontSizeRules() {
  if (appFontSizesCaptured) return;
  const visitRules = (rules) => {
    Array.from(rules || []).forEach((rule) => {
      if (rule.cssRules) {
        try {
          visitRules(rule.cssRules);
        } catch {}
      }
      const fontSize = rule.style?.fontSize || "";
      const match = fontSize.match(/^(\d+(?:\.\d+)?)px$/);
      if (match) appFontSizeRules.push({ style: rule.style, baseSize: Number(match[1]) });
    });
  };
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      visitRules(sheet.cssRules);
    } catch {}
  });
  appFontSizesCaptured = true;
}

function scaleAppFontSizeRules(scale) {
  captureAppFontSizeRules();
  appFontSizeRules.forEach(({ style, baseSize }) => {
    style.fontSize = `${Math.round(baseSize * scale * 100) / 100}px`;
  });
}

function applyUserFontScale() {
  const scale = state.currentUserId ? currentFontScale() : 1;
  document.documentElement.style.setProperty("--font-scale", String(scale));
  scaleAppFontSizeRules(scale);
  return scale;
}

function applyUserFontFamily() {
  const font = currentFontFamily();
  document.documentElement.style.setProperty("--app-font-family", font.family);
  return font;
}

function applyUserAppearance() {
  applyUserFontScale();
  applyUserFontFamily();
}

function changeUserFontScale(direction) {
  const current = currentFontScale();
  const currentIndex = Math.max(0, FONT_SCALE_STEPS.indexOf(current));
  const nextIndex = Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, currentIndex + direction));
  const next = FONT_SCALE_STEPS[nextIndex];
  localStorage.setItem(userFontScaleKey(), String(next));
  applyUserFontScale();
  const value = document.querySelector("#fontScaleValue");
  if (value) value.textContent = `${Math.round(next * 100)}%`;
  document.querySelector("[data-font-size-change='-1']")?.toggleAttribute("disabled", nextIndex === 0);
  document.querySelector("[data-font-size-change='1']")?.toggleAttribute("disabled", nextIndex === FONT_SCALE_STEPS.length - 1);
}

function changeUserFontFamily(fontId) {
  if (!APP_FONTS.some((font) => font.id === fontId)) return;
  localStorage.setItem(userFontFamilyKey(), fontId);
  applyUserFontFamily();
  refreshFontFamilyButtons();
}

function refreshFontFamilyButtons() {
  const current = currentFontFamilyId();
  document.querySelectorAll("[data-font-family]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.fontFamily === current);
  });
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function pushNotificationSupported() {
  return Boolean("serviceWorker" in navigator && "PushManager" in window && "Notification" in window && state.data?.pushSupported && state.data?.pushPublicKey);
}

async function currentPushSubscription() {
  if (!pushNotificationSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function renderPushNotificationSetting() {
  const user = activeUser();
  if (!isAdminUser(user)) return "";
  const supported = pushNotificationSupported();
  return `
    <section class="panel stack push-setting" id="pushSettingPanel">
      <div class="section-title">
        <h3>채팅 알림</h3>
        <span class="chip">관리자 전용</span>
      </div>
      <p class="helper" id="pushSettingStatus">${supported ? "상태 확인 중" : "이 기기 또는 접속 주소에서는 푸시 알림을 사용할 수 없습니다."}</p>
      <button class="secondary-button" type="button" id="togglePushButton" ${supported ? "" : "disabled"}>확인 중</button>
    </section>
  `;
}

async function refreshPushNotificationSetting() {
  const panel = document.querySelector("#pushSettingPanel");
  if (!panel) return;
  const status = panel.querySelector("#pushSettingStatus");
  const button = panel.querySelector("#togglePushButton");
  if (!pushNotificationSupported()) {
    if (status) status.textContent = "HTTPS 접속, 서비스워커, 브라우저 푸시 지원이 필요합니다.";
    if (button) {
      button.textContent = "사용 불가";
      button.disabled = true;
    }
    return;
  }
  const permission = Notification.permission;
  const subscription = await currentPushSubscription();
  if (permission === "denied") {
    if (status) status.textContent = "휴대폰/브라우저에서 알림 권한이 차단되어 있습니다.";
    if (button) {
      button.textContent = "차단됨";
      button.disabled = true;
    }
    return;
  }
  if (status) status.textContent = subscription ? "새 접수 채팅 알림이 켜져 있습니다." : "새 접수 채팅 알림이 꺼져 있습니다.";
  if (button) {
    button.textContent = subscription ? "알림 끄기" : "알림 켜기";
    button.disabled = false;
    button.dataset.pushEnabled = subscription ? "true" : "false";
  }
}

async function enablePushNotifications() {
  if (!pushNotificationSupported()) throw new Error("이 기기에서는 푸시 알림을 사용할 수 없습니다.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았습니다.");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(state.data.pushPublicKey),
    });
  }
  await api("/api/push/subscriptions", {
    method: "POST",
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

async function disablePushNotifications() {
  const subscription = await currentPushSubscription();
  if (subscription) {
    await api("/api/push/subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
}

async function togglePushNotifications() {
  const button = document.querySelector("#togglePushButton");
  if (button) button.disabled = true;
  try {
    const subscription = await currentPushSubscription();
    if (subscription) await disablePushNotifications();
    else await enablePushNotifications();
    await refreshPushNotificationSetting();
  } catch (error) {
    alert(error.message || "알림 설정을 변경하지 못했습니다.");
    await refreshPushNotificationSetting();
  }
}

function adminMemoIdForUser(userId) {
  return `admin-user-${userId}`;
}

function adminMemoById(id) {
  return state.data.adminMemos.find((memo) => memo.id === id) || null;
}

function stepName(code) {
  return state.data.steps.find((step) => step.code === code)?.name
    || WORKFLOW_STEPS.find((step) => step.code === code)?.label
    || "접수";
}

function workflowSteps() {
  const stepMap = new Map((state.data?.steps || []).map((step) => [step.code, step.name]));
  return WORKFLOW_STEPS.map((step) => ({
    code: step.code,
    name: stepMap.get(step.code) || step.label,
  }));
}

function normalizeListTypeFilter(value) {
  const code = String(value || "all");
  return code === "all" || LIST_TYPE_FILTERS.some((filter) => filter.code === code) ? code : "all";
}

function orderStep(order) {
  return order?.currentStep || "01";
}

function replaceOrderInState(order) {
  if (!order || !state.data?.orders) return;
  const index = state.data.orders.findIndex((item) => item.id === order.id);
  if (index >= 0) state.data.orders[index] = order;
  else state.data.orders.unshift(order);
}

function removeOrderFromState(orderId) {
  if (!state.data?.orders) return;
  state.data.orders = state.data.orders.filter((item) => item.id !== orderId);
}

function appHistoryState() {
  return {
    appEntry: true,
    exitReady: true,
    tab: state.tab,
    selectedOrderId: state.selectedOrderId,
    selectedStep: state.selectedStep,
    filter: state.filter,
    listTypeFilter: state.listTypeFilter,
    toolbarCollapsed: state.toolbarCollapsed,
    dateStart: state.dateStart,
    dateEnd: state.dateEnd,
    doneDateStart: state.doneDateStart,
    doneDateEnd: state.doneDateEnd,
    workDateSort: state.workDateSort,
    doneDateSort: state.doneDateSort,
    query: state.query,
  };
}

function restorableViewState() {
  return Object.fromEntries(RESTORABLE_VIEW_KEYS.map((key) => [key, state[key]]));
}

function saveViewState() {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(restorableViewState()));
  } catch {
    // 저장소를 사용할 수 없는 환경에서는 새로고침 복원만 건너뜁니다.
  }
}

function restoreViewState() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_STATE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    state.tab = saved.tab || state.tab;
    state.selectedOrderId = saved.selectedOrderId || null;
    state.selectedStep = saved.selectedStep || "all";
    state.filter = saved.filter || "all";
    state.listTypeFilter = normalizeListTypeFilter(saved.listTypeFilter);
    state.toolbarCollapsed = Boolean(saved.toolbarCollapsed);
    state.dateStart = saved.dateStart || DEFAULT_DATE_RANGE.start;
    state.dateEnd = saved.dateEnd || DEFAULT_DATE_RANGE.end;
    state.doneDateStart = saved.doneDateStart || DEFAULT_DATE_RANGE.start;
    state.doneDateEnd = saved.doneDateEnd || DEFAULT_DATE_RANGE.end;
    state.workDateSort = saved.workDateSort === "asc" ? "asc" : "desc";
    state.doneDateSort = saved.doneDateSort === "asc" ? "asc" : "desc";
    state.query = saved.query || "";
    syncEnteredTabDateEnd();
  } catch {
    localStorage.removeItem(VIEW_STATE_KEY);
  }
}

function sameHistoryState(a = {}, b = {}) {
  return RESTORABLE_VIEW_KEYS.every((key) => (a[key] || "") === (b[key] || ""));
}

function replaceAppHistory() {
  if (!window.history?.replaceState) return;
  saveViewState();
  history.replaceState(appHistoryState(), "", window.location.pathname + window.location.search);
}

function setupAppHistory() {
  if (!window.history?.replaceState || !window.history?.pushState) return;
  if (!history.state?.exitReady) {
    history.replaceState({ exitGuard: true }, "", window.location.pathname + window.location.search);
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    return;
  }
  if (!history.state.appEntry) replaceAppHistory();
}

function pushAppHistory() {
  if (state.applyingHistory || !window.history?.pushState) return;
  const next = appHistoryState();
  saveViewState();
  if (sameHistoryState(history.state, next)) return;
  history.pushState(next, "", window.location.pathname + window.location.search);
}

function applyHistoryState(saved) {
  if (!saved) return;
  state.applyingHistory = true;
  state.tab = saved.tab || "me";
  state.selectedOrderId = saved.selectedOrderId || null;
  state.selectedStep = saved.selectedStep || "all";
  state.filter = saved.filter || "all";
  state.listTypeFilter = normalizeListTypeFilter(saved.listTypeFilter);
  state.toolbarCollapsed = Boolean(saved.toolbarCollapsed);
  state.dateStart = saved.dateStart || DEFAULT_DATE_RANGE.start;
  state.dateEnd = saved.dateEnd || DEFAULT_DATE_RANGE.end;
  state.doneDateStart = saved.doneDateStart || DEFAULT_DATE_RANGE.start;
  state.doneDateEnd = saved.doneDateEnd || DEFAULT_DATE_RANGE.end;
  state.workDateSort = saved.workDateSort === "asc" ? "asc" : "desc";
  state.doneDateSort = saved.doneDateSort === "asc" ? "asc" : "desc";
  state.query = saved.query || "";
  syncEnteredTabDateEnd();
  clearPhotoSelection();
  state.expandedPhotoId = null;
  state.chatExpandedAttachmentId = null;
  state.trashExpandedPhotoId = null;
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  saveViewState();
  render();
  state.applyingHistory = false;
}

function render() {
  if (!state.data) {
    content.innerHTML = `<section class="panel">불러오는 중입니다.</section>`;
    return;
  }

  if (!state.currentUserId || !state.data.users.some((user) => user.id === state.currentUserId)) {
    renderLogin();
    return;
  }

  saveViewState();
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.tab);
  });

  if (state.selectedOrderId) return renderDetail();
  if (state.tab === "me") return renderMeKeep();
  if (state.tab === "chat") return renderChat();
  if (state.tab === "work") return renderWork();
  if (state.tab === "done") return renderDone();
  return renderMore();
}

function setGlobalLoading(message = "") {
  state.loadingMessage = message;
  let overlay = document.querySelector("#globalLoadingOverlay");
  if (!message) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "globalLoadingOverlay";
    overlay.className = "global-loading-overlay";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="global-loading-card">
      <span class="global-loading-spinner" aria-hidden="true"></span>
      <strong>${escapeHtml(message)}</strong>
    </div>
  `;
}

function showToast(message) {
  state.toastMessage = message;
  clearTimeout(state.toastTimer);
  let toast = document.querySelector("#appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  state.toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    state.toastMessage = "";
  }, 2200);
}

function resetPageScroll() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    content.scrollTop = 0;
  });
}

function currentScrollPosition() {
  const stepRow = document.querySelector(".step-row");
  return {
    x: window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
    y: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
    contentTop: content?.scrollTop || 0,
    stepRowLeft: stepRow?.scrollLeft || 0,
  };
}

function restoreScrollPosition(position) {
  if (!position) return;
  const restore = () => {
    window.scrollTo({ top: position.y, left: position.x, behavior: "auto" });
    document.documentElement.scrollTop = position.y;
    document.body.scrollTop = position.y;
    if (content) content.scrollTop = position.contentTop;
    const stepRow = document.querySelector(".step-row");
    if (stepRow) stepRow.scrollLeft = position.stepRowLeft || 0;
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(() => {
      restore();
      setTimeout(restore, 80);
    });
  });
}

function cssEscapeValue(value) {
  return window.CSS?.escape ? CSS.escape(String(value || "")) : String(value || "").replace(/["\\]/g, "\\$&");
}

function openReceiptChatFromNotification() {
  if (!state.data || !state.currentUserId) return;
  state.tab = "chat";
  state.selectedOrderId = null;
  state.chatRoom = "main";
  state.query = "";
  state.chatSearchIndex = 0;
  state.chatExpandedAttachmentId = null;
  state.chatTransferMessageId = null;
  render();
  resetPageScroll();
}

function consumeLaunchRoute() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("open") !== "chat-receipt") return;
  url.searchParams.delete("open");
  history.replaceState(appHistoryState(), "", `${url.pathname}${url.search}${url.hash}`);
  openReceiptChatFromNotification();
}

function renderChat() {
  title.textContent = "채팅";
  const messages = chatMessagesSorted();
  content.innerHTML = `
    <section class="chat-search">
      <div class="chat-search-row">
        <input id="searchInput" value="${escapeHtml(state.query)}" placeholder="대화 내용 찾기" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
        ${renderChatSearchControls()}
      </div>
    </section>
    <section class="chat-feed chat-message-feed" aria-label="채팅 메시지">
      ${messages.length ? messages.map(renderChatMessage).join("") : `<div class="empty-state">아직 채팅이 없습니다.</div>`}
    </section>
    <form id="chatComposer" class="chat-composer">
      <input id="chatPhotoInput" type="file" accept="image/*" multiple hidden>
      <button class="chat-add-button" type="button" id="chatAddPhotoButton" aria-label="사진 추가">+</button>
      <div class="chat-compose-main">
        <div id="chatComposerTarget" class="chat-composer-target">${renderChatComposerTarget()}</div>
        <div id="chatPendingPreview" class="chat-pending-preview">${renderChatPendingPreview()}</div>
        <input id="chatMessageInput" name="body" type="text" autocomplete="off" placeholder="메시지 입력">
      </div>
      <button class="chat-send-button" type="submit">보내기</button>
    </form>
    ${state.chatExpandedAttachmentId ? renderChatExpandedAttachment() : ""}
    ${state.chatTransferMessageId ? renderChatTransferPanel() : ""}
  `;
  if (state.query.trim()) scrollChatSearchMatch();
  else scrollChatToBottom();
}

function chatMessagesSorted() {
  return (state.data.chatMessages || [])
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      || String(a.id || "").localeCompare(String(b.id || "")));
}

function normalizeChatRoomId(value) {
  return "main";
}

function chatMessageSearchText(message) {
  const attachmentText = (message.attachments || []).map((item) => item.originalName || "").join(" ");
  const orderText = (state.data?.orders || [])
    .filter((order) => String(message.body || "").toLowerCase().includes(String(order.serial || "").toLowerCase()))
    .map((order) => [order.serial, order.address, order.productType, order.brand, order.modelName, order.requestMemo].filter(Boolean).join(" "))
    .join(" ");
  return [message.userName, message.body, attachmentText, orderText].filter(Boolean).join(" ").toLowerCase();
}

function looseTextMatches(text, query) {
  const source = String(text || "").toLowerCase();
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  if (source.includes(needle)) return true;
  const compactSource = source.replace(/\s+/g, "");
  const compactNeedle = needle.replace(/\s+/g, "");
  if (compactNeedle && compactSource.includes(compactNeedle)) return true;
  return needle.split(/\s+/).filter(Boolean).some((token) => source.includes(token));
}

function chatSearchMatches() {
  const query = state.query.trim().toLowerCase();
  if (!query) return [];
  return chatMessagesSorted().filter((message) => looseTextMatches(chatMessageSearchText(message), query));
}

function activeChatSearchMessageId() {
  const matches = chatSearchMatches();
  if (!matches.length) return "";
  state.chatSearchIndex = clamp(state.chatSearchIndex, 0, matches.length - 1);
  return matches[state.chatSearchIndex]?.id || "";
}

function renderChatSearchControls() {
  const matches = chatSearchMatches();
  const hasQuery = Boolean(state.query.trim());
  const active = hasQuery && matches.length ? state.chatSearchIndex + 1 : 0;
  return `
    <div class="chat-search-controls">
      <span>${hasQuery ? `${active}/${matches.length}` : ""}</span>
      <button type="button" data-chat-search-nav="previous" ${matches.length ? "" : "disabled"} aria-label="이전 검색 결과">↑</button>
      <button type="button" data-chat-search-nav="next" ${matches.length ? "" : "disabled"} aria-label="다음 검색 결과">↓</button>
    </div>
  `;
}

function renderChatMessage(message) {
  const isMine = message.userId === state.currentUserId;
  const attachments = message.attachments || [];
  const imageAttachments = attachments.filter((attachment) => (attachment.mimeType || "").startsWith("image/"));
  const linkedOrder = chatLinkedOrder(message);
  const activeSearchId = activeChatSearchMessageId();
  const isSearchMatch = Boolean(state.query.trim()) && looseTextMatches(chatMessageSearchText(message), state.query);
  const isActiveSearchMatch = activeSearchId === message.id;
  return `
    <article class="chat-message ${isMine ? "is-mine" : ""} ${isSearchMatch ? "is-search-match" : ""} ${isActiveSearchMatch ? "is-active-search-match" : ""}" data-chat-message-id="${escapeHtml(message.id)}">
      <div class="chat-sender">${escapeHtml(message.userName || "사용자")}</div>
      <div class="chat-message-row">
        <div class="chat-message-bubble">
          ${message.body ? `<p>${highlightChatSearchText(message.body)}</p>` : ""}
          ${attachments.length ? `<div class="chat-attachment-grid ${attachments.length === 1 ? "is-single" : ""}">
            ${attachments.map(renderChatAttachment).join("")}
          </div>` : ""}
          <div class="chat-message-actions">
            ${linkedOrder ? `<button class="chat-open-order-button" type="button" data-chat-open-order="${escapeHtml(linkedOrder.id)}">${escapeHtml(linkedOrder.serial || "품목")} 열기</button>` : ""}
            ${imageAttachments.length ? `<button class="chat-transfer-button" type="button" data-chat-transfer-message="${escapeHtml(message.id)}">품목 단계로 업로드 (${imageAttachments.length})</button>` : ""}
            <button class="chat-delete-button" type="button" data-delete-chat-message="${escapeHtml(message.id)}" aria-label="채팅 삭제">삭제</button>
          </div>
        </div>
        <time>${escapeHtml(fmt(message.createdAt))}</time>
      </div>
    </article>
  `;
}

function highlightChatSearchText(value) {
  const query = state.query.trim();
  const text = String(value || "");
  if (!query) return escapeHtml(text);
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let cursor = 0;
  let html = "";
  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerQuery, cursor);
    if (index < 0) {
      html += escapeHtml(text.slice(cursor));
      break;
    }
    html += escapeHtml(text.slice(cursor, index));
    html += `<mark>${escapeHtml(text.slice(index, index + query.length))}</mark>`;
    cursor = index + query.length;
  }
  return html;
}

function renderChatAttachment(attachment) {
  const src = escapeHtml(serverAssetUrl(attachment.url));
  const alt = escapeHtml(attachment.originalName || "채팅 사진");
  const isVideo = (attachment.mimeType || "").startsWith("video/");
  return `
    <button class="chat-attachment" type="button" data-chat-attachment="${escapeHtml(attachment.id)}" aria-label="${alt}">
      ${isVideo
        ? `<video src="${src}" preload="metadata" muted playsinline></video>`
        : `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" fetchpriority="low">`}
    </button>
  `;
}

function chatTransferMessage() {
  return chatMessagesSorted().find((message) => message.id === state.chatTransferMessageId) || null;
}

function renderChatTransferPanel() {
  const message = chatTransferMessage();
  const transferCount = (message?.attachments || []).filter((attachment) => (attachment.mimeType || "").startsWith("image/")).length;
  if (!message || !transferCount) return "";
  const activeOrders = state.data.orders
    .filter((order) => order.status !== "완료")
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const stepOptions = workflowSteps()
    .filter((step) => Number(step.code) >= 1 && Number(step.code) <= PHOTO_STEP_LIMIT)
    .map((step) => `<option value="${escapeHtml(step.code)}">${escapeHtml(step.code)} ${escapeHtml(step.name)}</option>`)
    .join("");
  return `
    <div class="chat-transfer-panel">
      <form id="chatTransferForm" class="chat-transfer-box">
        <div class="section-title">
          <h3>품목 단계로 업로드</h3>
          <button class="icon-button" type="button" data-close-chat-transfer aria-label="닫기">×</button>
        </div>
        <p class="helper">이 채팅의 사진 ${transferCount}장을 선택한 품목 단계로 한 번에 업로드합니다.</p>
        <label>품번 입력
          <input id="chatTransferSerialInput" type="text" inputmode="text" autocomplete="off" placeholder="예: B188">
        </label>
        <label>품목
          <select name="orderId" required>
            ${activeOrders.map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(chatTransferOrderLabel(order))}</option>`).join("")}
          </select>
        </label>
        <label>단계
          <select name="stepCode" required>${stepOptions}</select>
        </label>
        ${activeOrders.length ? `<button class="primary-button" type="submit">업로드</button>` : `<p class="helper">진행중인 품목이 없습니다.</p>`}
      </form>
    </div>
  `;
}

function chatTransferOrderLabel(order) {
  const titleParts = orderProductTitles(order);
  const titleText = titleParts.length ? titleParts.join(" / ") : orderListTitle(order);
  return [order.serial, titleText].filter(Boolean).join(" - ");
}

function syncChatTransferOrderBySerial(value) {
  const form = document.querySelector("#chatTransferForm");
  const select = form?.elements.orderId;
  if (!select) return;
  const query = String(value || "").trim().toUpperCase();
  if (!query) return;
  const orders = state.data.orders.filter((order) => order.status !== "완료");
  const matched = orders.find((order) => String(order.serial || "").trim().toUpperCase() === query)
    || orders.find((order) => String(order.serial || "").trim().toUpperCase().includes(query));
  if (matched) select.value = matched.id;
}

function activeChatUploadOrders() {
  return (state.data?.orders || [])
    .filter((order) => order.status !== "완료")
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function chatComposerSerialText(value) {
  return findSerial(value) || String(value || "").trim().toUpperCase();
}

function chatComposerMatchedOrder(value) {
  const query = chatComposerSerialText(value);
  if (!query) return null;
  const orders = activeChatUploadOrders();
  return orders.find((order) => String(order.serial || "").trim().toUpperCase() === query)
    || orders.find((order) => String(order.serial || "").trim().toUpperCase().includes(query))
    || null;
}

function chatComposerCompletedOrder(value) {
  const query = chatComposerSerialText(value);
  if (!query) return null;
  const orders = (state.data?.orders || [])
    .filter((order) => order.status === "완료")
    .slice()
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0));
  return orders.find((order) => String(order.serial || "").trim().toUpperCase() === query)
    || orders.find((order) => String(order.serial || "").trim().toUpperCase().includes(query))
    || null;
}

function chatCompletedDateLabel(order) {
  const value = order?.completedAt || order?.updatedAt || order?.createdAt;
  if (!value) return "완료 이력";
  return new Date(value).toLocaleDateString("ko-KR");
}

function renderChatComposerTarget() {
  if (!state.chatPendingMedia.length) return "";
  const inputValue = document.querySelector("#chatMessageInput")?.value || "";
  const order = chatComposerMatchedOrder(inputValue);
  const completedOrder = order ? null : chatComposerCompletedOrder(inputValue);
  const serial = chatComposerSerialText(inputValue);
  const currentStep = CHAT_COMPOSER_STEPS.some((step) => step.code === state.chatComposerStepCode)
    ? state.chatComposerStepCode
    : "01";
  const helperText = order
    ? `${escapeHtml(order.serial)} 선택됨`
    : completedOrder
      ? `${escapeHtml(chatCompletedDateLabel(completedOrder))} 완료 이력 있음 · 접수 시 새 진행건 생성`
      : "진행중 품목과 자동 연결";
  return `
    <div class="chat-target-card">
      <div class="chat-target-head">
        <span>품번: ${escapeHtml(serial || "입력 대기")}</span>
        <small>${helperText}</small>
      </div>
      <div class="chat-step-picks" role="group" aria-label="사진 등록 단계">
        ${CHAT_COMPOSER_STEPS.map((step) => `
          <button type="button" data-chat-composer-step="${escapeHtml(step.code)}" class="${currentStep === step.code ? "is-active" : ""}">
            ${escapeHtml(step.label)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function refreshChatComposerTarget() {
  const target = document.querySelector("#chatComposerTarget");
  if (target) target.innerHTML = renderChatComposerTarget();
}

function chatAttachmentList() {
  return chatMessagesSorted()
    .flatMap((message) => (message.attachments || []).map((attachment) => ({ ...attachment, message })))
    .filter((attachment) => (attachment.mimeType || "").startsWith("image/"));
}

function renderChatExpandedAttachment() {
  const attachments = chatAttachmentList();
  const attachment = attachments.find((item) => item.id === state.chatExpandedAttachmentId);
  if (!attachment) return "";
  const index = attachments.findIndex((item) => item.id === attachment.id);
  const src = escapeHtml(serverAssetUrl(attachment.url));
  return `
    <div class="photo-lightbox" data-expanded-photo-view="${escapeHtml(attachment.id)}" data-chat-expanded="true">
      <button class="photo-lightbox-arrow is-left" type="button" data-photo-navigate="previous" ${index > 0 ? "" : "disabled"} aria-label="이전 사진">‹</button>
      <div class="photo-lightbox-media">
        <img src="${src}" alt="${escapeHtml(attachment.originalName || "채팅 사진")}">
      </div>
      <button class="photo-lightbox-arrow is-right" type="button" data-photo-navigate="next" ${index >= 0 && index < attachments.length - 1 ? "" : "disabled"} aria-label="다음 사진">›</button>
    </div>
  `;
}

function renderChatPendingPreview() {
  if (!state.chatPendingMedia.length) return "";
  return `
    <div class="chat-pending-strip">
      ${state.chatPendingMedia.map((item, index) => `
        <button class="chat-pending-item" type="button" data-remove-chat-pending="${index}" aria-label="선택한 사진 제거">
          ${item.isVideo ? `<video src="${item.previewUrl}" muted playsinline preload="metadata"></video>` : `<img src="${item.previewUrl}" alt="선택한 사진">`}
          <span>×</span>
        </button>
      `).join("")}
    </div>
    <small>${state.chatPendingMedia.length} / ${PHOTO_UPLOAD_MAX_COUNT}</small>
  `;
}

function refreshChatPendingPreview() {
  const preview = document.querySelector("#chatPendingPreview");
  if (preview) preview.innerHTML = renderChatPendingPreview();
  refreshChatComposerTarget();
}

function refreshChatFeed() {
  const feed = document.querySelector(".chat-feed");
  if (!feed) return;
  const messages = chatMessagesSorted();
  feed.innerHTML = messages.length
    ? messages.map(renderChatMessage).join("")
    : `<div class="empty-state">아직 채팅이 없습니다.</div>`;
  refreshChatSearchControls();
  if (state.query.trim()) scrollChatSearchMatch();
  else scrollChatToBottom();
}

function refreshChatSearchControls() {
  const controls = document.querySelector(".chat-search-controls");
  if (controls) controls.outerHTML = renderChatSearchControls();
}

function chatMessagesSignature(messages = state.data?.chatMessages || []) {
  return messages.map((message) => [
    message.id,
    message.room,
    message.createdAt,
    message.body,
    (message.attachments || []).map((attachment) => attachment.id).join(","),
  ].join(":")).join("|");
}

async function pollChatMessages() {
  if (!state.currentUserId || state.tab !== "chat" || state.selectedOrderId || !state.data) return;
  try {
    const before = chatMessagesSignature();
    const result = await api("/api/chat");
    const nextMessages = result.chatMessages || [];
    const after = chatMessagesSignature(nextMessages);
    if (before === after) return;
    state.data.chatMessages = nextMessages;
    if (state.chatExpandedAttachmentId && !chatAttachmentList().some((attachment) => attachment.id === state.chatExpandedAttachmentId)) {
      state.chatExpandedAttachmentId = null;
    }
    if (state.chatTransferMessageId && !chatMessagesSorted().some((message) => message.id === state.chatTransferMessageId)) {
      state.chatTransferMessageId = null;
    }
    refreshChatFeed();
  } catch {
    // 다음 주기에서 다시 확인합니다.
  }
}

function moveChatSearchResult(direction) {
  const matches = chatSearchMatches();
  if (!matches.length) return;
  const offset = direction === "previous" ? -1 : 1;
  state.chatSearchIndex = (state.chatSearchIndex + offset + matches.length) % matches.length;
  refreshChatFeed();
}

function scrollChatSearchMatch() {
  requestAnimationFrame(() => {
    const id = activeChatSearchMessageId();
    if (!id) return;
    const target = Array.from(document.querySelectorAll("[data-chat-message-id]"))
      .find((item) => item.dataset.chatMessageId === id);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    const feed = document.querySelector(".chat-message-feed");
    if (feed) feed.scrollTop = feed.scrollHeight;
  });
}

function scrollToOrderCard(orderId) {
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-order-card-id="${cssEscapeValue(orderId)}"]`);
    card?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function focusOrderInWorkList(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  state.tab = "work";
  state.selectedOrderId = null;
  state.selectedStep = "all";
  state.filter = "all";
  state.listTypeFilter = "all";
  state.query = "";
  state.expandedPhotoId = null;
  clearPhotoSelection();
  const registered = order ? orderRegistrationDateValue(order) : "";
  if (registered && (registered < state.dateStart || registered > state.dateEnd)) {
    state.dateStart = registered;
    state.dateEnd = registered;
  }
  render();
  scrollToOrderCard(orderId);
  replaceAppHistory();
}

function renderLogin() {
  title.textContent = "로그인";
  document.querySelectorAll(".tab-button").forEach((button) => button.classList.remove("is-active"));
  const admins = state.data.users.filter((user) => isAdminUser(user));
  const staffs = state.data.users.filter((user) => !isAdminUser(user));

  content.innerHTML = `
    <section class="login-hero">
      <p class="eyebrow">bebeu Login</p>
      <h2>작업자를 선택해주세요</h2>
      <p>현장에서 누가 작업하는지 구분하기 위한 간단 로그인입니다.</p>
    </section>
    <section class="panel stack">
      <div class="section-title"><h3>관리자</h3><span class="chip">${admins.length}명</span></div>
      ${admins.map(renderLoginUser).join("") || `<p class="helper">관리자 계정이 없습니다.</p>`}
    </section>
    <section class="panel stack">
      <div class="section-title"><h3>직원</h3><span class="chip">${staffs.length}명</span></div>
      ${staffs.map(renderLoginUser).join("") || `<p class="helper">직원 계정이 없습니다.</p>`}
    </section>
  `;
}

function renderLoginUser(user) {
  const needsPassword = isAdminUser(user);
  const selected = state.pendingAdminLoginUserId === user.id;
  return `
    <button class="login-user" type="button" data-login-user="${user.id}">
      <span>
        <strong>${escapeDisplay(user.name)}</strong>
        <small>${escapeDisplay(user.branch || "본점")} · ${escapeDisplay(user.role)}</small>
      </span>
      <em>${needsPassword ? "확인" : "시작"}</em>
    </button>
    ${needsPassword && selected ? `
      <form class="admin-login-form" id="adminLoginForm">
        <input type="hidden" name="userId" value="${escapeHtml(user.id)}">
        <label>관리자 비밀번호
          <input name="password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="비밀번호 입력" required autofocus>
        </label>
        ${state.adminLoginError ? `<p class="form-error">${escapeHtml(state.adminLoginError)}</p>` : ""}
        <button class="primary-button" type="submit">로그인</button>
      </form>
    ` : ""}
  `;
}

function chatLinkedOrder(message) {
  const source = String(message.body || "");
  const serial = findSerial(source);
  if (!serial) return null;
  return (state.data?.orders || []).find((order) => String(order.serial || "").toUpperCase() === serial.toUpperCase()) || null;
}

function loginAsUser(userId) {
  state.currentUserId = userId;
  localStorage.setItem("bebeu.currentUserId", state.currentUserId);
  state.pendingAdminLoginUserId = null;
  state.adminLoginError = "";
  applyUserAppearance();
  state.tab = "me";
  state.selectedOrderId = null;
  replaceAppHistory();
  render();
}

async function submitAdminLogin(form) {
  const formData = new FormData(form);
  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  try {
    await api("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ userId, password }),
    });
    loginAsUser(userId);
  } catch (error) {
    state.pendingAdminLoginUserId = userId;
    state.adminLoginError = error.message || "비밀번호를 확인하지 못했습니다.";
    render();
  }
}

async function submitAdminPasswordChange(form) {
  const formData = new FormData(form);
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (newPassword !== confirmPassword) {
    state.passwordChangeMessage = "새 비밀번호가 서로 다릅니다.";
    render();
    return;
  }
  try {
    await api("/api/auth/admin-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    state.passwordChangeOpen = false;
    state.passwordChangeMessage = "비밀번호가 변경되었습니다.";
    render();
  } catch (error) {
    state.passwordChangeMessage = error.message || "비밀번호를 변경하지 못했습니다.";
    render();
  }
}

async function submitNaverCafeSettings(form) {
  const formData = new FormData(form);
  const payload = {
    enabled: formData.get("enabled") === "on",
    clientId: formData.get("clientId")?.trim() || "",
    clientSecret: formData.get("clientSecret")?.trim() || "",
    clubId: formData.get("clubId")?.trim() || "",
    menuId: formData.get("menuId")?.trim() || "",
    titleTemplate: formData.get("titleTemplate")?.trim() || "",
    contentTemplate: formData.get("contentTemplate")?.trim() || "",
    includePhotos: formData.get("includePhotos") || "all",
    encodingMode: formData.get("encodingMode") || "utf8-percent",
  };
  const result = await api("/api/naver-cafe/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.data.naverCafeSettings = result.naverCafeSettings;
  alert("네이버 카페 설정을 저장했습니다.");
  render();
}

function stats() {
  const active = state.data.orders.filter((order) => order.status !== "완료" || order.currentStep === "04").length;
  const done = state.data.orders.filter((order) => order.status === "완료").length;
  const photos = state.data.orders.reduce((sum, order) => sum + order.photos.length, 0);
  return `
    <section class="stats-grid">
      <div class="stat-card"><span>진행</span><strong>${active}</strong></div>
      <div class="stat-card"><span>완료</span><strong>${done}</strong></div>
      <div class="stat-card"><span>사진</span><strong>${photos}</strong></div>
    </section>
  `;
}

function workMinutesBetween(start, end) {
  const from = new Date(start);
  const to = new Date(end);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) return 0;
  let minutes = Math.max(0, Math.round((to - from) / 60000));
  const lunchStart = new Date(from);
  lunchStart.setHours(12, 0, 0, 0);
  const lunchEnd = new Date(from);
  lunchEnd.setHours(13, 0, 0, 0);
  const overlapStart = Math.max(from.getTime(), lunchStart.getTime());
  const overlapEnd = Math.min(to.getTime(), lunchEnd.getTime());
  if (overlapEnd > overlapStart) minutes -= Math.round((overlapEnd - overlapStart) / 60000);
  return Math.max(0, minutes);
}

function formatWorkHours(minutes) {
  if (!minutes) return "0";
  return Number((minutes / 60).toFixed(1)).toString();
}

function attendanceSummary(user, now = new Date()) {
  const monthly = new Map();
  const records = (state.data.attendance || [])
    .filter((item) => item.userId === user.id)
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let openIn = null;
  records.forEach((record) => {
    const created = new Date(record.createdAt);
    if (!Number.isFinite(created.getTime())) return;
    if (record.action === "in") {
      openIn = created;
      return;
    }
    if (record.action !== "out" || !openIn) return;
    const day = openIn.getDate();
    if (openIn.getFullYear() === currentYear && openIn.getMonth() === currentMonth) {
      const current = monthly.get(day) || { minutes: 0, estimated: false };
      current.minutes += workMinutesBetween(openIn, created);
      monthly.set(day, current);
    }
    openIn = null;
  });
  if (user.clockedIn && openIn && openIn.getFullYear() === currentYear && openIn.getMonth() === currentMonth) {
    const day = openIn.getDate();
    const current = monthly.get(day) || { minutes: 0, estimated: false };
    current.minutes += workMinutesBetween(openIn, now);
    current.estimated = true;
    monthly.set(day, current);
  }
  let totalMinutes = 0;
  let estimatedMinutes = 0;
  monthly.forEach((item) => {
    totalMinutes += item.minutes;
    if (item.estimated) estimatedMinutes += item.minutes;
  });
  return { days: monthly, totalMinutes, estimatedMinutes };
}

function hourlyWageKey(userId) {
  return `bebeu.hourlyWage.${userId}`;
}

function hourlyWageForUser(userId) {
  const fromServer = Number(state.data?.hourlyWages?.[userId]);
  if (Number.isFinite(fromServer) && fromServer > 0) return fromServer;
  const saved = Number(localStorage.getItem(hourlyWageKey(userId)));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_HOURLY_WAGE;
}

async function setHourlyWageForUser(userId, value) {
  const wage = Math.max(0, Math.round(Number(value) || DEFAULT_HOURLY_WAGE));
  localStorage.setItem(hourlyWageKey(userId), String(wage));
  const result = await api("/api/hourly-wages", {
    method: "POST",
    body: JSON.stringify({ userId, amount: wage }),
  });
  state.data.hourlyWages = { ...(state.data.hourlyWages || {}), [result.userId]: result.amount };
  return wage;
}

async function saveAttendanceDayTime(form) {
  const userId = form.dataset.attendanceTimeForm;
  const user = state.data.users.find((item) => item.id === userId);
  if (!user || !state.attendanceEditDay) return;
  const now = new Date();
  const date = monthDateText(now.getFullYear(), now.getMonth(), state.attendanceEditDay);
  const formData = new FormData(form);
  await api("/api/attendance/day", {
    method: "POST",
    body: JSON.stringify({
      userId,
      date,
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
    }),
  });
  await load();
}

async function deleteAttendanceDayTime(userId) {
  const user = state.data.users.find((item) => item.id === userId);
  if (!user || !state.attendanceEditDay) return;
  const now = new Date();
  const date = monthDateText(now.getFullYear(), now.getMonth(), state.attendanceEditDay);
  await api("/api/attendance/day", {
    method: "DELETE",
    body: JSON.stringify({ userId, date }),
  });
  await load();
}

function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

function payrollMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function payrollSettingForUser(userId, now = new Date()) {
  const monthKey = payrollMonthKey(now);
  const setting = state.data?.payrollSettings?.[`${userId}:${monthKey}`] || {};
  return {
    userId,
    monthKey,
    deliveryCount: Math.max(0, Number(setting.deliveryCount) || 0),
    deliveryPrice: Math.max(0, Number(setting.deliveryPrice) || 0),
    adjustments: Array.isArray(setting.adjustments) ? setting.adjustments : [],
  };
}

function payrollAdjustmentTotal(adjustments = []) {
  return adjustments.reduce((sum, item) => {
    const amount = Math.max(0, Number(item.amount) || 0);
    return sum + (item.type === "minus" ? -amount : amount);
  }, 0);
}

function payrollTotalsForUser(user, now = new Date()) {
  const summary = attendanceSummary(user, now);
  const wage = hourlyWageForUser(user.id);
  const setting = payrollSettingForUser(user.id, now);
  const basePay = (summary.totalMinutes / 60) * wage;
  const deliveryPay = setting.deliveryCount * setting.deliveryPrice;
  const adjustmentPay = payrollAdjustmentTotal(setting.adjustments);
  const totalPay = basePay + deliveryPay + adjustmentPay;
  return { summary, wage, setting, basePay, deliveryPay, adjustmentPay, totalPay };
}

async function savePayrollSettingForUser(userId, now = new Date()) {
  const form = document.querySelector("#payrollSettingForm");
  const deliveryCount = Number(document.querySelector("#payrollDeliveryCount")?.value) || 0;
  const deliveryPrice = Number(document.querySelector("#payrollDeliveryPrice")?.value) || 0;
  const adjustments = Array.from(form?.querySelectorAll("[data-payroll-adjustment-row]") || []).map((row) => ({
    id: row.dataset.adjustmentId || `${Date.now()}-${Math.random()}`,
    title: row.querySelector("[name='adjustmentTitle']")?.value || "",
    type: row.querySelector("[name='adjustmentType']")?.value === "minus" ? "minus" : "plus",
    amount: Number(row.querySelector("[name='adjustmentAmount']")?.value) || 0,
  }));
  const result = await api("/api/payroll-settings", {
    method: "POST",
    body: JSON.stringify({ userId, monthKey: payrollMonthKey(now), deliveryCount, deliveryPrice, adjustments }),
  });
  state.data.payrollSettings = { ...(state.data.payrollSettings || {}), [result.key]: result.setting };
}

function refreshPayrollPreview() {
  const form = document.querySelector("#payrollSettingForm");
  const total = document.querySelector("#payrollTotalAmount");
  const bottomTotal = document.querySelector("#payrollBottomTotalAmount");
  if (!form || !total) return;
  const basePay = Number(form.dataset.basePay) || 0;
  const deliveryCount = Number(document.querySelector("#payrollDeliveryCount")?.value) || 0;
  const deliveryPrice = Number(document.querySelector("#payrollDeliveryPrice")?.value) || 0;
  const adjustments = Array.from(form.querySelectorAll("[data-payroll-adjustment-row]")).map((row) => ({
    type: row.querySelector("[name='adjustmentType']")?.value === "minus" ? "minus" : "plus",
    amount: Number(row.querySelector("[name='adjustmentAmount']")?.value) || 0,
  }));
  const nextTotal = formatMoney(basePay + (deliveryCount * deliveryPrice) + payrollAdjustmentTotal(adjustments));
  total.textContent = nextTotal;
  if (bottomTotal) bottomTotal.textContent = nextTotal;
}

function attendanceDayRows(user, now = new Date()) {
  const summary = attendanceSummary(user, now);
  return Array.from(summary.days.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, info]) => ({
      day,
      minutes: info.minutes,
      estimated: info.estimated,
    }));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function monthDateText(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function timeInputValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function attendanceTimesForDay(user, year, monthIndex, day) {
  const records = (state.data.attendance || [])
    .filter((item) => {
      if (item.userId !== user.id) return false;
      const date = new Date(item.createdAt);
      return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return {
    start: timeInputValue(records.find((item) => item.action === "in")?.createdAt),
    end: timeInputValue(records.slice().reverse().find((item) => item.action === "out")?.createdAt),
  };
}

function renderAttendanceCalendar(user) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const summary = attendanceSummary(user, now);
  const blanks = Array.from({ length: firstWeekday }, (_, index) => `<div class="attendance-day is-empty" aria-hidden="true" data-empty="${index}"></div>`).join("");
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const info = summary.days.get(day);
    const hours = info ? formatWorkHours(info.minutes) : "";
    return `
      <div class="attendance-day ${info ? "worked" : ""} ${info?.estimated ? "is-estimated" : ""}">
        <strong>${day}</strong>
        ${info ? `<span>+${hours}</span>` : ""}
      </div>
    `;
  }).join("");
  return `
    <section class="panel attendance-panel">
      <div class="section-title">
        <h3>${now.getFullYear()}년 ${now.getMonth() + 1}월 근태</h3>
        <span class="chip">총 ${formatWorkHours(summary.totalMinutes)}시간</span>
      </div>
      <div class="attendance-weekdays" aria-hidden="true">
        ${["일", "월", "화", "수", "목", "금", "토"].map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="attendance-calendar">
        ${blanks}${days}
      </div>
      <div class="attendance-summary">
        <strong>총 근무 시간 ${formatWorkHours(summary.totalMinutes)}시간</strong>
        <span>예상 근무 시간 ${formatWorkHours(summary.estimatedMinutes || summary.totalMinutes)}시간</span>
        <small>12:00~13:00 점심시간은 자동 제외됩니다.</small>
      </div>
    </section>
  `;
}

function renderAttendancePayrollPanel(currentUser) {
  if (!isAdminUser(currentUser)) return "";
  const users = state.data.users || [];
  const now = new Date();
  const payrollRows = users.map((user) => ({ user, totals: payrollTotalsForUser(user, now) }));
  const grandTotal = payrollRows.reduce((sum, row) => sum + row.totals.totalPay, 0);
  return `
    <section class="panel attendance-payroll-panel">
      <div class="section-title">
        <h3>직원별 근태 결산</h3>
        <span class="chip">${now.getFullYear()}년 ${now.getMonth() + 1}월</span>
      </div>
      <div class="attendance-payroll-total">
        <span>현재까지 전체 금액</span>
        <strong>${formatMoney(grandTotal)}</strong>
      </div>
      <div class="attendance-payroll-list">
        ${payrollRows.map(({ user, totals }) => {
          return `
            <button class="attendance-payroll-card" type="button" data-payroll-user="${escapeHtml(user.id)}">
              <span>
                <strong>${escapeDisplay(user.name)}</strong>
                <small>${escapeDisplay(user.role)} · ${totals.summary.days.size}일 근무 · 배송 ${totals.setting.deliveryCount}건</small>
              </span>
              <b>${formatWorkHours(totals.summary.totalMinutes)}시간</b>
              <em>${formatMoney(totals.totalPay)}</em>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAttendancePayrollModal() {
  const user = state.data.users.find((item) => item.id === state.attendancePayrollUserId);
  if (!user) return "";
  const now = new Date();
  const { summary, wage, setting, basePay, deliveryPay, adjustmentPay, totalPay } = payrollTotalsForUser(user, now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const selectedDay = Number(state.attendanceEditDay || now.getDate());
  const selectedDateText = monthDateText(now.getFullYear(), now.getMonth(), selectedDay);
  const selectedTimes = attendanceTimesForDay(user, now.getFullYear(), now.getMonth(), selectedDay);
  const timeEditorHtml = `
    <form class="attendance-time-editor" data-attendance-time-form="${escapeHtml(user.id)}">
      <strong>${selectedDateText}</strong>
      <label>시작
        <input name="startTime" type="time" value="${escapeHtml(selectedTimes.start || "09:00")}" required>
      </label>
      <label>끝
        <input name="endTime" type="time" value="${escapeHtml(selectedTimes.end || "18:00")}" required>
      </label>
      <div class="attendance-time-actions">
        <button class="primary-button" type="submit">시간 저장</button>
        <button class="danger-button" type="button" data-delete-attendance-day="${escapeHtml(user.id)}">시간 삭제</button>
      </div>
    </form>
  `;
  return `
    <div class="modal-backdrop attendance-modal" role="dialog" aria-modal="true">
      <section class="modal-card attendance-modal-card">
        <div class="section-title">
          <h3>${escapeDisplay(user.name)} 근태 결산</h3>
          <button class="icon-button" type="button" data-close-payroll-modal aria-label="닫기">×</button>
        </div>
        <label>시급
          <input id="hourlyWageInput" type="number" inputmode="numeric" min="0" step="10" value="${wage}">
        </label>
        <div class="attendance-modal-summary">
          <span>총 ${formatWorkHours(summary.totalMinutes)}시간 · 배송 ${setting.deliveryCount}건</span>
          <strong id="payrollTotalAmount">${formatMoney(totalPay)}</strong>
        </div>
        <div class="attendance-day-list">
          ${Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const info = summary.days.get(day);
            const minutes = info?.minutes || 0;
            return `
              <button class="attendance-day-row ${selectedDay === day ? "is-active" : ""}" type="button" data-edit-attendance-day="${day}" ${selectedDay === day ? "data-selected-attendance-day=\"true\"" : ""}>
                <span>${now.getMonth() + 1}/${day}</span>
                <b>${minutes ? `${formatWorkHours(minutes)}시간${info?.estimated ? " 예상" : ""}` : "미근무"}</b>
                <em>${minutes ? formatMoney((minutes / 60) * wage) : "-"}</em>
              </button>
              ${selectedDay === day ? timeEditorHtml : ""}
            `;
          }).join("")}
        </div>
        ${renderPayrollSettingEditor(user, setting, basePay, deliveryPay, adjustmentPay)}
        <div class="payroll-grand-total">
          <span>총 합계 금액</span>
          <strong id="payrollBottomTotalAmount">${formatMoney(totalPay)}</strong>
        </div>
        <button class="secondary-button" type="button" data-save-hourly-wage="${escapeHtml(user.id)}">저장</button>
      </section>
    </div>
  `;
}

function renderPayrollSettingEditor(user, setting, basePay, deliveryPay, adjustmentPay) {
  return `
    <form class="payroll-setting-form" id="payrollSettingForm" data-base-pay="${Math.round(basePay)}">
      <div class="payroll-breakdown">
        <span>근무 ${formatMoney(basePay)}</span>
        <span>배송 ${formatMoney(deliveryPay)}</span>
        <span>기타 ${formatMoney(adjustmentPay)}</span>
      </div>
      <section class="payroll-delivery-box">
        <div class="section-title"><h3>배송</h3><span class="chip">${formatMoney(deliveryPay)}</span></div>
        <div class="payroll-counter">
          <button type="button" data-payroll-delivery-change="-1">-</button>
          <input id="payrollDeliveryCount" type="number" inputmode="numeric" min="0" step="1" value="${setting.deliveryCount}" aria-label="배송 건수">
          <button type="button" data-payroll-delivery-change="1">+</button>
        </div>
        <label>배송 건당 가격
          <input id="payrollDeliveryPrice" type="number" inputmode="numeric" min="0" step="100" value="${setting.deliveryPrice}">
        </label>
      </section>
      <section class="payroll-extra-box">
        <div class="section-title">
          <h3>기타</h3>
          <button class="secondary-button" type="button" data-add-payroll-adjustment="${escapeHtml(user.id)}">항목 추가</button>
        </div>
        <div class="payroll-adjustment-list">
          ${(setting.adjustments.length ? setting.adjustments : [{ id: "new", title: "", type: "plus", amount: 0 }]).map((item) => `
            <div class="payroll-adjustment-row" data-payroll-adjustment-row data-adjustment-id="${escapeHtml(item.id || "")}">
              <select name="adjustmentType" aria-label="더하기 빼기">
                <option value="plus" ${item.type !== "minus" ? "selected" : ""}>+</option>
                <option value="minus" ${item.type === "minus" ? "selected" : ""}>-</option>
              </select>
              <input name="adjustmentTitle" value="${escapeHtml(item.title || "")}" placeholder="항목 입력">
              <input name="adjustmentAmount" type="number" inputmode="numeric" min="0" step="100" value="${Math.max(0, Number(item.amount) || 0)}" placeholder="금액">
              <button class="icon-button" type="button" data-remove-payroll-adjustment aria-label="삭제">×</button>
            </div>
          `).join("")}
        </div>
      </section>
    </form>
  `;
}

function scrollSelectedAttendanceDay() {
  requestAnimationFrame(() => {
    const row = document.querySelector("[data-selected-attendance-day='true']");
    const card = row?.closest(".attendance-modal-card");
    if (!row || !card) return;
    const header = card.querySelector(".section-title");
    const headerHeight = header?.offsetHeight || 0;
    card.scrollTo({
      top: Math.max(0, row.offsetTop - headerHeight - 8),
      left: 0,
      behavior: "auto",
    });
  });
}

function renderMe() {
  title.textContent = "내 정보";
  const user = activeUser();
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const workedDays = new Set(
    state.data.attendance
      .filter((item) => item.userId === user.id && item.action === "in")
      .map((item) => new Date(item.createdAt).getDate())
  );

  content.innerHTML = `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">오늘의 작업</p>
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.branch)} · ${escapeHtml(user.role)} · ${user.clockedIn ? "출근 중" : "퇴근"}</p>
      </div>
      <button class="${user.clockedIn ? "danger-button" : "primary-button compact"}" data-attendance="${user.clockedIn ? "out" : "in"}">
        ${user.clockedIn ? "퇴근" : "출근"}
      </button>
    </section>
    ${stats()}
    <section class="panel">
      <div class="section-title">
        <h3>${now.getFullYear()}년 ${now.getMonth() + 1}월 근태</h3>
        <span class="chip">이번 달</span>
      </div>
      <div class="calendar">
        ${Array.from({ length: days }, (_, index) => `<div class="day ${workedDays.has(index + 1) ? "worked" : ""}">${index + 1}</div>`).join("")}
      </div>
    </section>
    ${renderAdminMemoPanel(user)}
  `;
}

function renderMeKeep() {
  title.textContent = "내 정보";
  const user = activeUser();
  content.innerHTML = `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">BEBEU WORK</p>
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.branch)} · ${escapeHtml(user.role)} · ${user.clockedIn ? "출근 중" : "퇴근"}</p>
      </div>
      <button class="${user.clockedIn ? "danger-button" : "primary-button compact"}" type="button" data-attendance="${user.clockedIn ? "out" : "in"}">
        ${user.clockedIn ? "퇴근" : "출근"}
      </button>
    </section>
    ${renderAttendanceCalendar(user)}
    ${renderAttendancePayrollPanel(user)}
    ${renderKeepPanel(user)}
    ${renderAdminMemoPanel(user)}
    ${renderAttendancePayrollModal()}
  `;
}

function renderKeepPanel(user) {
  const notes = visibleKeepNotes(user);
  const editing = state.keepEditingId
    ? (state.keepEditingId === "__new" ? null : notes.find((note) => note.id === state.keepEditingId))
    : null;
  const editorType = editing?.type || state.keepEditingType || "text";
  return `
    <section class="panel keep-panel">
      <div class="section-title">
        <h3>메모</h3>
        <span class="chip">${notes.length}개</span>
      </div>
      <div class="keep-actions">
        <button class="secondary-button" type="button" data-new-keep-note="text">메모 작성</button>
        <button class="secondary-button" type="button" data-new-keep-note="checklist">체크리스트</button>
      </div>
      ${state.keepEditingId ? renderKeepEditor(editing, editorType, user) : ""}
      <div class="keep-grid">
        ${notes.length ? notes.map((note) => renderKeepCard(note, user)).join("") : `<p class="helper">아직 등록된 메모가 없습니다.</p>`}
      </div>
    </section>
  `;
}

function visibleKeepNotes(user) {
  return (state.data.keepNotes || [])
    .filter((note) => keepNoteRole(note, user))
    .sort((a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || new Date(b.updatedAt) - new Date(a.updatedAt)
    );
}

function keepNoteRole(note, user = activeUser()) {
  if (!note || !user) return "";
  if (note.ownerId === user.id) return "owner";
  return (note.collaborators || []).find((item) => item.userId === user.id)?.permission || "";
}

function canEditKeepNote(note, user = activeUser()) {
  const role = keepNoteRole(note, user);
  return role === "owner" || role === "edit";
}

function renderKeepCard(note, user) {
  const role = keepNoteRole(note, user);
  const preview = note.type === "checklist"
    ? (note.items || []).slice(0, 4).map((item) => `${item.done ? "?" : "·"} ${item.text}`).join("\n")
    : note.body;
  const shared = (note.collaborators || []).length;
  return `
    <article class="keep-card ${note.pinned ? "is-pinned" : ""}" data-open-keep-note="${escapeHtml(note.id)}">
      <button class="keep-card-button" type="button" data-open-keep-note="${escapeHtml(note.id)}">
        <div class="keep-card-head">
          <strong>${escapeHtml(note.title || "제목 없음")}</strong>
          <span>${note.pinned ? "고정" : role === "owner" ? "내 메모" : "공유"}</span>
        </div>
        <p>${escapeHtml(preview || "내용 없음")}</p>
        <div class="keep-meta">
          <span>${escapeHtml(fmt(note.updatedAt))}</span>
          ${shared ? `<span>공동작업 ${shared}명</span>` : ""}
        </div>
      </button>
    </article>
  `;
}

function renderKeepEditor(note, type, user) {
  const isNew = !note;
  const canEdit = isNew || canEditKeepNote(note, user);
  const isOwner = isNew || note.ownerId === user.id;
  const collaborators = note?.collaborators || [];
  return `
    <form class="keep-editor" id="keepNoteForm" data-keep-id="${escapeHtml(note?.id || "")}" data-keep-type="${escapeHtml(type)}">
      <div class="keep-editor-head">
        <strong>${isNew ? (type === "checklist" ? "새 체크리스트" : "새 메모") : "메모 수정"}</strong>
        <label class="keep-pin-toggle">
          <input type="checkbox" name="pinned" ${note?.pinned ? "checked" : ""} ${canEdit ? "" : "disabled"}>
          <span>고정</span>
        </label>
      </div>
      <input name="title" placeholder="제목" value="${escapeHtml(note?.title || "")}" ${canEdit ? "" : "readonly"}>
      ${type === "checklist" ? renderChecklistEditor(note?.items || [], canEdit) : `<textarea name="body" rows="5" placeholder="메모 작성" ${canEdit ? "" : "readonly"}>${escapeHtml(note?.body || "")}</textarea>`}
      ${isOwner ? renderCollaboratorEditor(collaborators) : `<p class="helper">공유받은 메모입니다. 권한: ${keepNoteRole(note, user) === "edit" ? "수정 가능" : "보기 전용"}</p>`}
      <div class="keep-editor-actions">
        <button class="secondary-button" type="button" data-cancel-keep-note>닫기</button>
        ${!isNew && isOwner ? `<button class="danger-button" type="button" data-delete-keep-note="${escapeHtml(note.id)}">삭제</button>` : ""}
        ${canEdit ? `<button class="primary-button" type="submit">저장</button>` : ""}
      </div>
    </form>
  `;
}

function renderChecklistEditor(items, canEdit) {
  const rows = items.length ? items : [{ id: "", text: "", done: false }];
  return `
    <div class="keep-checklist-editor">
      ${rows.map((item, index) => renderChecklistRow(item, index, canEdit)).join("")}
    </div>
    ${canEdit ? `<button class="secondary-button compact keep-add-item" type="button" data-add-check-item>항목 추가</button>` : ""}
  `;
}

function renderChecklistRow(item, index, canEdit) {
  return `
    <div class="keep-check-row" data-check-row>
      <input type="hidden" name="checkId" value="${escapeHtml(item.id || "")}">
      <input type="checkbox" name="checkDone" ${item.done ? "checked" : ""} ${canEdit ? "" : "disabled"}>
      <input name="checkText" value="${escapeHtml(item.text || "")}" placeholder="할 일" ${canEdit ? "" : "readonly"}>
      <button type="button" data-move-check="-1" ${!canEdit || index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-move-check="1" ${!canEdit ? "disabled" : ""}>↓</button>
      <button type="button" data-remove-check-item ${canEdit ? "" : "disabled"}>×</button>
    </div>
  `;
}

function renderCollaboratorEditor(collaborators) {
  const byUser = new Map((collaborators || []).map((item) => [item.userId, item.permission]));
  return `
    <fieldset class="keep-share-box">
      <legend>공동작업</legend>
      ${state.data.users.filter((member) => member.id !== activeUser().id).map((member) => {
        const permission = byUser.get(member.id) || "";
        return `
          <label class="keep-share-row">
            <input type="checkbox" data-keep-collaborator="${escapeHtml(member.id)}" ${permission ? "checked" : ""}>
            <span>${escapeHtml(member.name)}</span>
            <select data-keep-permission="${escapeHtml(member.id)}">
              <option value="view" ${permission !== "edit" ? "selected" : ""}>보기</option>
              <option value="edit" ${permission === "edit" ? "selected" : ""}>수정</option>
            </select>
          </label>
        `;
      }).join("")}
    </fieldset>
  `;
}

function renderAdminMemoPanel(user) {
  const globalMemo = adminMemoById("admin-global")?.body || "";
  const memberMemo = adminMemoById(adminMemoIdForUser(user.id))?.body || "";
  const legacyMemos = state.data.adminMemos.filter((memo) => memo.id !== "admin-global" && !memo.id.startsWith("admin-user-"));
  if (!isAdminUser(user)) {
    const visibleMemos = [
      globalMemo ? { title: "전체 메모", body: globalMemo } : null,
      memberMemo ? { title: `${user.name} 메모`, body: memberMemo } : null,
      ...legacyMemos,
    ].filter(Boolean);
    return `
      <section class="panel stack">
        <div class="section-title"><h3>관리자 메모</h3></div>
        ${visibleMemos.length ? visibleMemos.map((memo) => `
          <article class="memo-item">
            <strong>${escapeHtml(memo.title)}</strong>
            <p>${escapeHtml(memo.body)}</p>
          </article>
        `).join("") : `<p class="helper">등록된 메모가 없습니다.</p>`}
      </section>
    `;
  }

  return `
    <section class="panel stack admin-memo-panel">
      <div class="section-title"><h3>관리자 메모</h3><span class="chip">수정 가능</span></div>
      <label>전체 메모
        <textarea id="globalAdminMemo" rows="4" placeholder="모든 직원에게 보일 메모">${escapeHtml(globalMemo)}</textarea>
      </label>
      <div class="admin-member-memos">
        ${state.data.users.map((member) => `
          <label>${escapeHtml(member.name)} 메모
            <textarea data-admin-member-memo="${escapeHtml(member.id)}" rows="3" placeholder="${escapeHtml(member.name)}에게만 보일 메모">${escapeHtml(adminMemoById(adminMemoIdForUser(member.id))?.body || "")}</textarea>
          </label>
        `).join("")}
      </div>
      ${legacyMemos.length ? `
        <div class="legacy-admin-memos">
          <strong>기존 메모</strong>
          ${legacyMemos.map((memo) => `<p>${escapeHtml(memo.title)}: ${escapeHtml(memo.body)}</p>`).join("")}
        </div>
      ` : ""}
      <button class="primary-button" type="button" id="saveAdminMemosButton">메모 저장</button>
    </section>
  `;
}

function renderOrderSearchInput() {
  return `<input id="searchInput" value="${escapeHtml(state.query)}" placeholder="품번, 전화번호, 주소 검색" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">`;
}

function renderBottomOrderSearch() {
  return `
    <section class="work-bottom-search search-panel" aria-label="진행중 검색">
      ${renderOrderSearchInput()}
    </section>
  `;
}

function renderToolbar(options = {}) {
  const includeSearch = options.includeSearch !== false;
  const visibleSteps = state.tab === "done"
    ? DONE_STATUS_FILTERS
    : workflowSteps();
  const typeFilterRow = `
    <div class="filter-row type-filter-row ${state.toolbarCollapsed ? "is-collapsed" : ""}">
      <button type="button" data-list-type-filter="all" class="${state.listTypeFilter === "all" ? "is-active" : ""}">전체</button>
      ${LIST_TYPE_FILTERS.map((filter) => `<button type="button" data-list-type-filter="${filter.code}" class="${state.listTypeFilter === filter.code ? "is-active" : ""}">${escapeHtml(filter.label)}</button>`).join("")}
      <button class="toolbar-collapse-button" type="button" data-toggle-toolbar aria-expanded="${state.toolbarCollapsed ? "false" : "true"}">
        <span>${state.toolbarCollapsed ? "펼치기" : "접기"}</span>
        <b aria-hidden="true">${state.toolbarCollapsed ? "↓" : "↑"}</b>
      </button>
    </div>
  `;
  const stepButtons = visibleSteps
    .map((step) => `<button type="button" data-filter="${step.code}" class="${state.filter === step.code ? "is-active" : ""}">${escapeHtml(step.label || `${step.code} ${step.name}`)}</button>`)
    .join("");
  const allFilterButton = state.tab === "done"
    ? ""
    : `<button type="button" data-filter="all" class="${state.filter === "all" ? "is-active" : ""}">전체</button>`;
  const dateStartValue = activeDateStart();
  const dateEndValue = activeDateEnd();
  const dateSort = activeDateSort();
  return `
    <section class="search-panel">
      <div class="date-range-row">
        <label>시작날짜<input id="dateStartInput" type="date" value="${escapeHtml(dateStartValue)}"></label>
        <span>~</span>
        <label>끝날짜<input id="dateEndInput" type="date" value="${escapeHtml(dateEndValue)}"></label>
      </div>
      <div class="date-sort-row" role="group" aria-label="날짜 정렬">
        <button type="button" data-date-sort="desc" class="${dateSort === "desc" ? "is-active" : ""}">최신순</button>
        <button type="button" data-date-sort="asc" class="${dateSort === "asc" ? "is-active" : ""}">오래된순</button>
      </div>
      ${includeSearch ? renderOrderSearchInput() : ""}
    </section>
    ${typeFilterRow}
    <div class="filter-row">
      ${allFilterButton}
      ${stepButtons}
    </div>
  `;
}

function activeDateStart() {
  return state.tab === "done" ? state.doneDateStart : state.dateStart;
}

function activeDateEnd() {
  return state.tab === "done" ? state.doneDateEnd : state.dateEnd;
}

function activeDateSort() {
  return state.tab === "done" ? state.doneDateSort : state.workDateSort;
}

function setActiveDateSort(value) {
  const sort = value === "asc" ? "asc" : "desc";
  if (state.tab === "done") state.doneDateSort = sort;
  else state.workDateSort = sort;
}

function setActiveDateRange(part, value) {
  if (state.tab === "done") {
    if (part === "start") state.doneDateStart = value || "";
    if (part === "end") state.doneDateEnd = value || "";
    return;
  }
  if (part === "start") state.dateStart = value || DEFAULT_DATE_RANGE.start;
  if (part === "end") state.dateEnd = value || DEFAULT_DATE_RANGE.end;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return { start: dateInputValue(start), end: dateInputValue(end) };
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayDateInputValue() {
  return dateInputValue(new Date());
}

function syncEnteredTabDateEnd(tab = state.tab) {
  const today = todayDateInputValue();
  if (tab === "work") state.dateEnd = today;
  if (tab === "done") state.doneDateEnd = today;
}

function compactMonthDay(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function parseOrderDatePart(value, startDate = null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  const now = new Date();
  const year = startDate?.getFullYear?.() || now.getFullYear();
  if (digits.length <= 2 && startDate) {
    const month = startDate.getMonth();
    const day = Number(digits);
    const date = new Date(year, month, day);
    if (date < startDate) date.setMonth(date.getMonth() + 1);
    return date;
  }
  if (digits.length >= 4) {
    const month = Number(digits.slice(0, 2)) - 1;
    const day = Number(digits.slice(2, 4));
    const date = new Date(year, month, day);
    if (startDate && date < startDate) date.setFullYear(date.getFullYear() + 1);
    return date;
  }
  return null;
}

function normalizeOrderDateRange(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const [startRaw, endRaw] = raw.split("-").map((item) => item.trim());
  const startDate = parseOrderDatePart(startRaw);
  if (!startDate) return raw;
  const endDate = endRaw ? parseOrderDatePart(endRaw, startDate) : new Date(startDate);
  if (!endRaw) endDate.setDate(endDate.getDate() + ORDER_DEFAULT_DAYS);
  return `${compactMonthDay(startDate)}-${compactMonthDay(endDate)}`;
}

function orderRegistrationDateValue(order) {
  const source = String(order.registrationDate || "");
  const compact = source.replace(/\D/g, "");
  if (compact.length >= 6) {
    return `20${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4, 6)}`;
  }
  if (order.createdAt) return dateInputValue(new Date(order.createdAt));
  return "";
}

function orderListType(order) {
  const rawSerial = String(order.serial || "").trim().toUpperCase();
  const serial = findSerial(rawSerial) || rawSerial;
  if (serial.startsWith("AB")) return "AB";
  if (serial.startsWith("BA")) return "BA";
  if (serial.startsWith("A")) return "A";
  if (serial.startsWith("B")) return "B";
  return "";
}

function doneStatusFilterCode(order) {
  const label = exportStatusLabel(order).replace(/\s+/g, "");
  if (label === "문자전송완료") return "sms-done";
  if (label === "내보내기완료") return "export-done";
  return "done-ready";
}

function normalizeActiveFilterForTab() {
  if (state.tab === "done" && state.filter === "all") {
    state.filter = "done-ready";
    return;
  }
  if (state.filter === "all") return;
  const validCodes = state.tab === "done"
    ? new Set(DONE_STATUS_FILTERS.map((item) => item.code))
    : new Set(workflowSteps().map((item) => item.code));
  if (!validCodes.has(state.filter)) state.filter = state.tab === "done" ? "done-ready" : "all";
}

function currentOrders() {
  const query = state.query.trim().toLowerCase();
  const dateStart = activeDateStart();
  const dateEnd = activeDateEnd();
  const sortDirection = activeDateSort() === "asc" ? 1 : -1;
  return state.data.orders
    .filter((order) => (state.tab === "done" ? order.status === "완료" : order.status !== "완료"))
    .filter((order) => {
      if (state.tab === "done" || state.listTypeFilter === "all") return true;
      if (state.listTypeFilter === "today") return orderTodayTaskChecked(order);
      return orderListType(order) === state.listTypeFilter;
    })
    .filter((order) => {
      if (state.filter === "all") return true;
      return state.tab === "done"
        ? doneStatusFilterCode(order) === state.filter
        : order.currentStep === state.filter;
    })
    .filter((order) => {
      if (!query) return true;
      return [
        order.serial,
        order.phone,
        order.address,
        order.productType,
        order.worker,
        order.customerName,
        order.brand,
        order.modelName,
        order.requestMemo,
        order.shareStatus,
        order.cafeStatus,
      ]
        .filter(Boolean)
        .some((value) => looseTextMatches(value, query));
    })
    .filter((order) => {
      const registered = orderRegistrationDateValue(order);
      if (!registered) return true;
      if (dateStart && registered < dateStart) return false;
      if (dateEnd && registered > dateEnd) return false;
      return true;
    })
    .sort((a, b) => {
      const aDate = orderRegistrationDateValue(a);
      const bDate = orderRegistrationDateValue(b);
      if (!aDate && bDate) return 1;
      if (aDate && !bDate) return -1;
      return sortDirection * aDate.localeCompare(bDate)
        || sortDirection * (new Date(a.createdAt) - new Date(b.createdAt))
        || String(a.serial || "").localeCompare(String(b.serial || ""), "ko", { numeric: true });
    });
}

function orderDateLabel(value) {
  if (!value) return "날짜 미지정";
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function renderOrdersByDate(orders) {
  const groups = new Map();
  orders.forEach((order) => {
    const date = orderRegistrationDateValue(order) || "";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(order);
  });
  return Array.from(groups.entries()).map(([date, items]) => `
    <section class="order-date-group">
      <div class="order-date-heading">
        <strong>${escapeHtml(orderDateLabel(date))}</strong>
        <span>${items.length}건</span>
      </div>
      <div class="order-date-items">${items.map(renderOrderCard).join("")}</div>
    </section>
  `).join("");
}

function renderUrgentStrip(orders) {
  const urgentOrders = urgentOrdersForStrip();
  const todayOrders = todayTaskOrdersForStrip();
  if (!urgentOrders.length && !todayOrders.length) return "";
  const mode = state.urgentStripMode === "today" ? "today" : "urgent";
  const visibleOrders = mode === "today" ? todayOrders : urgentOrders;
  return `
    <section class="urgent-strip-section" aria-label="긴급 항목">
      <div class="urgent-strip-heading">
        <div class="urgent-strip-tabs" role="tablist" aria-label="상단 항목 선택">
          <button type="button" data-urgent-strip-mode="urgent" class="${mode === "urgent" ? "is-active" : ""}" role="tab" aria-selected="${mode === "urgent" ? "true" : "false"}">긴급</button>
          <button type="button" data-urgent-strip-mode="today" class="${mode === "today" ? "is-active" : ""}" role="tab" aria-selected="${mode === "today" ? "true" : "false"}">오늘할일</button>
        </div>
        <span>${visibleOrders.length}건</span>
      </div>
      <div class="urgent-strip-list">
        ${visibleOrders.length ? visibleOrders.map((order) => renderUrgentStripItem(order, mode)).join("") : `<p class="urgent-strip-empty">${mode === "today" ? "오늘할일 항목이 없습니다." : "긴급 항목이 없습니다."}</p>`}
      </div>
    </section>
  `;
}

function urgentOrdersForStrip() {
  return state.data.orders
    .filter((order) => order.status !== "완료" && order.urgent)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
      || String(a.serial || "").localeCompare(String(b.serial || ""), "ko", { numeric: true }));
}

function todayTaskOrdersForStrip() {
  return state.data.orders
    .filter((order) => order.status !== "완료" && orderTodayTaskChecked(order))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
      || String(a.serial || "").localeCompare(String(b.serial || ""), "ko", { numeric: true }));
}

function renderUrgentStripItem(order, mode = "urgent") {
  const photo = representativeOrderPhoto(order);
  const src = photo ? mediaDisplayUrl(photo) : "";
  const isVideo = photo?.mimeType?.startsWith("video/");
  const memoLabel = mode === "today"
    ? orderMemoFieldValue(order, "today") || "오늘할일"
    : orderMemoFieldValue(order, "important") || "사진";
  return `
    <button class="urgent-strip-item ${mode === "today" ? "is-today" : ""}" type="button" data-scroll-order="${escapeHtml(order.id)}">
      <span>${escapeHtml(order.serial || "품번")}</span>
      <b>${escapeHtml(memoLabel)}</b>
      <figure>
        ${photo
          ? (isVideo
            ? `<video src="${serverAssetUrl(photo.url)}" preload="metadata" muted playsinline></video>`
            : `<img src="${src}" alt="${escapeHtml(order.serial || "긴급 사진")}" loading="lazy" decoding="async">`)
          : `<i>사진 없음</i>`}
      </figure>
    </button>
  `;
}

function representativeOrderPhoto(order) {
  return [...(order.photos || [])]
    .filter((photo) => photoProductIndex(photo) === 1)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0)
      || photoUploadedTime(a) - photoUploadedTime(b)
      || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))[0] || null;
}

function renderWork() {
  title.textContent = "진행 중";
  normalizeActiveFilterForTab();
  const orders = currentOrders();
  content.innerHTML = `
    ${renderToolbar({ includeSearch: false })}
    <section class="order-list">
      ${renderUrgentStrip(orders)}
      ${orders.length ? renderOrdersByDate(orders) : `<div class="empty-state">진행 중인 품번이 없습니다.</div>`}
    </section>
    <div class="work-bottom-spacer" aria-hidden="true"></div>
    <button class="fab" type="button" id="addOrderButton" aria-label="작업 추가">+</button>
    ${renderBottomOrderSearch()}
  `;
}

function selectedDoneOrders() {
  if (!state.data?.orders?.length) return [];
  const selected = new Set(state.selectedDoneOrderIds);
  return state.data.orders.filter((order) => selected.has(order.id) && order.status === "완료");
}

function renderDoneOrderSelectionBar() {
  if (state.tab !== "done" || !state.doneOrderSelectionMode) return "";
  const orders = selectedDoneOrders();
  const count = orders.length;
  const hasPickupType = orders.some((order) => ["B", "AB"].includes(orderListType(order)));
  const hasDeliveryType = orders.some((order) => !["B", "AB"].includes(orderListType(order)));
  const beforeLabel = hasPickupType && !hasDeliveryType ? "픽업전" : "배송전";
  return `
    <div class="done-order-selection-bar">
      <div class="done-order-selection-actions">
        <button type="button" data-batch-share-target="auto-before" ${count ? "" : "disabled"}>${beforeLabel}</button>
        <button type="button" data-batch-share-target="customer" ${count ? "" : "disabled"}>링크전송</button>
        ${hasDeliveryType ? `<button type="button" data-batch-share-target="sms-after" ${count ? "" : "disabled"}>배송완료</button>` : ""}
        <button type="button" data-cancel-done-order-selection>취소</button>
      </div>
    </div>
  `;
}

function renderDone() {
  title.textContent = "완료";
  normalizeActiveFilterForTab();
  const orders = currentOrders();
  content.innerHTML = `
    ${renderToolbar()}
    <section class="order-list">
      ${orders.length ? renderOrdersByDate(orders) : `<div class="empty-state">완료된 품번이 없습니다.</div>`}
    </section>
    ${renderDoneOrderSelectionBar()}
  `;
}

function refreshOrderList() {
  const list = document.querySelector(".order-list");
  if (!list) return;
  const orders = currentOrders();
  if (state.tab === "work") {
    list.innerHTML = orders.length
      ? `${renderUrgentStrip(orders)}${renderOrdersByDate(orders)}`
      : `<div class="empty-state">진행 중인 품번이 없습니다.</div>`;
    return;
  }
  list.innerHTML = orders.length
    ? renderOrdersByDate(orders)
    : `<div class="empty-state">완료된 품번이 없습니다.</div>`;
}

function refreshFilterButtons() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === state.filter);
  });
  document.querySelectorAll("[data-list-type-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.listTypeFilter === state.listTypeFilter);
  });
}

function orderListTitle(order) {
  const rawSerial = String(order.serial || "").trim();
  const serial = findSerial(rawSerial) || rawSerial;
  const serialPlace = rawSerial.replace(serial, "").replace(/^[\s/\-]+|[\s/\-]+$/g, "").trim();
  const place = cleanDisplayText(order.requestMemo).match(/^지역\s*:?\s*([^\n]+)/m)?.[1]?.trim() || serialPlace;
  return [place, serial].filter(Boolean).join(" - ");
}

function copiedRawTextFromMemo(order) {
  const memo = cleanDisplayText(order?.requestMemo);
  const serial = findSerial(order?.serial) || String(order?.serial || "").trim();
  const lines = memo.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    const value = colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : line;
    if (!value || !value.includes("/") || (serial && !value.toUpperCase().includes(serial.toUpperCase()))) continue;
    if (findSerial(value)) return value;
  }
  return "";
}

function orderProductTitles(order) {
  const memo = cleanDisplayText(order.requestMemo);
  const fullCopiedText = copiedRawTextFromMemo(order) || memo
    .split(/\r?\n/)
    .map((line) => line.match(/^복사\s*원문\s*:\s*(.+)$/u)?.[1]?.trim())
    .find(Boolean);
  if (fullCopiedText) return splitCopiedProductTitles(fullCopiedText, order);

  const rebuiltTitle = rebuiltCopiedTitle(order);
  if (rebuiltTitle) return splitCopiedProductTitles(rebuiltTitle, order);

  const lines = memo.split(/\r?\n/);
  const productLines = [];
  let readingProducts = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^제품\s*(정보|목록)\s*:/u.test(trimmed)) {
      readingProducts = true;
      continue;
    }
    if (!readingProducts) continue;
    if (!trimmed) break;
    if (/^[^:]{1,20}\s*:/u.test(trimmed)) break;
    productLines.push(trimmed.replace(/^\d+\.\s*/, ""));
  }
  if (productLines.length) return splitCopiedProductTitles(productLines.join(" / "), order);
  const fallback = [order.brand, order.modelName].filter(Boolean).join(" ").trim() || String(order.productType || "").trim();
  return fallback ? [fallback] : [];
}

function rebuiltCopiedTitle(order) {
  const rawSerial = String(order.serial || "").trim();
  const serial = findSerial(rawSerial) || rawSerial;
  const memo = cleanDisplayText(order.requestMemo);
  const region = memo.match(/^지역:\s*([^\n]+)/m)?.[1]?.trim();
  const dateRange = compactCopiedOrderDate(order.registrationDate) || String(order.registrationDate || "").trim();
  const copiedProduct = memo
    .split(/\r?\n/)
    .map((line) => line.match(/^(?:제품\/브랜드|브랜드\/모델)\s*원문\s*:\s*(.+)$/u)?.[1]?.trim())
    .find(Boolean);
  const product = copiedProduct || [order.productType, order.brand, order.modelName].filter(Boolean).join(" ");
  if (String(serial).toUpperCase().startsWith("B")) {
    const contactTail = memo.match(/연락처\s*뒷\s*번호\s*:\s*([^\n]+)/m)?.[1]?.trim();
    return [serial, contactTail, dateRange, product].filter(Boolean).join(" / ");
  }
  return [region, serial, dateRange, order.address, product].filter(Boolean).join(" / ");
}

function splitCopiedProductTitles(text, order = null) {
  return String(text || "")
    .split("/")
    .map((item, index) => normalizeCopiedTitlePart(item, index, order))
    .filter(Boolean);
}

function normalizeCopiedTitlePart(value, index, order) {
  const cleaned = String(value || "").trim().replace(/^\d+\.\s*/, "");
  if (index !== 2) return cleaned;
  return normalizeCopiedTitleDate(cleaned, order);
}

function normalizeCopiedTitleDate(value, order) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return value;
  const orderDate = compactCopiedOrderDate(order?.registrationDate);
  const registrationDigits = String(order?.registrationDate || "").replace(/\D/g, "");
  const registrationYearPrefix = registrationDigits.length >= 6 ? registrationDigits.slice(0, 2) : "";
  if (digits.length <= 2) {
    if (orderDate && digits === registrationYearPrefix) return orderDate;
    const day = digits.padStart(2, "0");
    if (orderDate && orderDate.endsWith(day)) return orderDate;
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}${day}`;
  }
  if (digits.length === 3) return digits.padStart(4, "0");
  return digits.slice(0, 4);
}

function compactCopiedOrderDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(2, 6);
  return digits.length >= 4 ? digits.slice(0, 4) : "";
}

function renderOrderTitleBlock(order) {
  const titleParts = orderProductTitles(order);
  const primaryParts = titleParts.slice(0, 3);
  const extraParts = titleParts.slice(3);
  const fallbackTitle = orderListTitle(order);
  return `
    <div class="order-title-block">
      ${primaryParts.length ? `<div class="order-title-line">
        <span class="order-title-primary">${primaryParts.map((item) => escapeHtml(item)).join(" / ")}</span>
      </div>${extraParts.length ? `<div class="order-title-extra">${extraParts.map((item, index) => `<span>${escapeHtml(item)}${index < extraParts.length - 1 ? " /" : ""}</span>`).join("")}</div>` : ""}` : `<strong>${escapeHtml(fallbackTitle)}</strong>`}
    </div>
  `;
}

function renderPlainOrderTitle(order) {
  const titleParts = orderProductTitles(order);
  return titleParts.length ? titleParts.join(" / ") : orderListTitle(order);
}

function orderListSubtitle(order) {
  const isBOrder = String(order.serial || "").trim().toUpperCase().startsWith("B");
  if (!isBOrder) return order.address || "주소 없음";
  const contactTail = String(order.requestMemo || "").match(/연락처\s*뒷\s*번호\s*:\s*([^\n]+)/)?.[1]?.trim();
  return contactTail ? `연락처 뒷번호 ${contactTail}` : "연락처 뒷번호 없음";
}

function compactRegistrationDate(order) {
  return String(order.registrationDate || "26/06/09").replace(/\D/g, "").slice(0, 6) || "260609";
}

function renderPickupPreview(order) {
  const photo = [...(order.photos || [])]
    .filter((item) => item.stepCode === "01" && photoProductIndex(item) === 1)
    .sort((a, b) => photoUploadedTime(a) - photoUploadedTime(b)
      || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      || String(a.id || "").localeCompare(String(b.id || "")))[0];
  if (!photo) return "";
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video/");
  const src = mediaDisplayUrl(photo);
  return `
    <span class="representative-photo" aria-label="접수 대표 사진">
      ${isVideo ? `<video src="${serverAssetUrl(photo.url)}" preload="metadata" muted playsinline></video>` : `<img src="${src}" alt="접수 대표 사진" loading="lazy" decoding="async" fetchpriority="low">`}
    </span>
  `;
}

function renderRecentPhotoStrip(order, maxCount = 5, includeAddButton = false) {
  const photos = [...(order.photos || [])]
    .filter((photo) => (photo.mimeType || "").startsWith("image/") || (photo.mimeType || "").startsWith("video/"))
    .sort((a, b) => photoUploadedTime(b) - photoUploadedTime(a)
      || (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0)
      || String(b.id || "").localeCompare(String(a.id || "")));
  if (!photos.length && !includeAddButton) return "";
  return `
    <div class="order-recent-photos ${includeAddButton ? "has-add-button" : ""}" aria-label="최근 업로드 사진">
      ${includeAddButton ? `<span class="order-recent-photo-add" role="button" tabindex="0" data-list-photo-add="${escapeHtml(order.id)}" aria-label="사진 빠른 추가">+</span>` : ""}
      <span class="order-recent-photo-track" style="--recent-visible-count:${Math.max(1, Number(maxCount) || 5)}">
        ${photos.map((photo) => {
          const isVideo = (photo.mimeType || "").startsWith("video/");
          const src = mediaDisplayUrl(photo);
          return `<i>${isVideo ? `<video src="${serverAssetUrl(photo.url)}" preload="metadata" muted playsinline></video>` : `<img src="${src}" alt="최근 업로드 사진" loading="lazy" decoding="async">`}</i>`;
        }).join("")}
      </span>
    </div>
  `;
}

function mediaDisplayUrl(photo) {
  return serverAssetUrl(photo.displayUrl || photo.thumbnailUrl || photo.url);
}

function orderIssueTags(order) {
  const text = String(order.requestMemo || "");
  return extractProductNoteTags(text);
}

function orderAccessoryTags(order) {
  const text = [cleanDisplayText(order.requestMemo), order.brand, order.modelName, order.productType].filter(Boolean).join(" ");
  return extractAccessoryTags(text);
}

function orderLegacySpecialMemoValue(order) {
  return cleanDisplayText(order.requestMemo).match(/^특이\s*사항\s*:\s*([^\n]*)/m)?.[1]?.trim() || "";
}

function orderMemoFieldValue(order, field) {
  const text = cleanDisplayText(order.requestMemo);
  const patterns = {
    important: /^중요\s*:\s*([^\n]*)/m,
    today: /^오늘\s*:\s*([^\n]*)/m,
    accessories: /^부속품\s*:\s*([^\n]*)/m,
  };
  const value = text.match(patterns[field])?.[1]?.trim() || "";
  if (value) return value;
  if (field === "important") {
    return [...new Set([orderLegacySpecialMemoValue(order), ...orderIssueTags(order)].filter(Boolean))].join(", ");
  }
  if (field === "accessories") return orderAccessoryTags(order).join(", ");
  return "";
}

function orderTodayTaskChecked(order) {
  return /^오늘\s*할\s*일\s*체크\s*:\s*(1|y|yes|true|on|체크|완료)$/im.test(cleanDisplayText(order.requestMemo));
}

function orderMemoWithoutSpecial(requestMemo) {
  return cleanDisplayText(requestMemo)
    .split(/\r?\n/)
    .filter((line) => !/^특이\s*사항\s*:/u.test(line.trim()))
    .filter((line) => !/^오늘\s*할\s*일\s*체크\s*:/u.test(line.trim()))
    .filter((line) => !/^중요\s*:/u.test(line.trim()))
    .filter((line) => !/^오늘\s*:/u.test(line.trim()))
    .filter((line) => !/^부속품\s*:/u.test(line.trim()))
    .join("\n")
    .trim();
}

function updateOrderImportantMemoText(requestMemo, importantMemo) {
  const memo = String(requestMemo || "").trim();
  const nextImportant = String(importantMemo || "").trim();
  const lines = memo
    ? memo.split(/\r?\n/)
      .filter((line) => !/^중요\s*:/u.test(line.trim()))
      .filter((line) => !/^특이\s*사항\s*:/u.test(line.trim()))
    : [];
  if (nextImportant) lines.push(`중요: ${nextImportant}`);
  return lines.join("\n").trim();
}

function updateOrderTodayTaskText(requestMemo, checked) {
  const memo = String(requestMemo || "").trim();
  const lines = memo
    ? memo.split(/\r?\n/).filter((line) => !/^오늘\s*할\s*일\s*체크\s*:/u.test(line.trim()))
    : [];
  if (checked) lines.push("오늘할일체크: 체크");
  return lines.join("\n").trim();
}

function updateOrderMemoFieldText(requestMemo, field, value) {
  const labels = { important: "중요", today: "오늘", accessories: "부속품" };
  const patterns = {
    important: /^중요\s*:/u,
    today: /^오늘\s*:/u,
    accessories: /^부속품\s*:/u,
  };
  const normalizedField = labels[field] ? field : "important";
  const memo = String(requestMemo || "").trim();
  const nextValue = String(value || "").trim();
  const lines = memo
    ? memo.split(/\r?\n/).filter((line) => !patterns[normalizedField].test(line.trim()))
    : [];
  if (nextValue) lines.push(`${labels[normalizedField]}: ${nextValue}`);
  return lines.join("\n").trim();
}

function orderSpecialNote(order) {
  return orderMemoFieldValue(order, "important");
}

function orderProducts(order) {
  const products = [];
  const lines = String(order.requestMemo || "").split(/\r?\n/);
  let reading = false;

  lines.forEach((line) => {
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

    const raw = match[2].trim();
    const accessories = raw.match(/부속품:\s*(.*?)(?=\s+오염:|$)/u)?.[1]?.split(",").map((item) => item.trim()).filter(Boolean) || [];
    const note = raw.match(/오염:\s*(.*)$/u)?.[1]?.trim() || "";
    const type = raw.includes("카시트") ? "카시트" : raw.includes("유모차") ? "유모차" : "";
    const name = raw
      .replace(/부속품:\s*.*?(?=\s+오염:|$)/u, "")
      .replace(/오염:\s*.*$/u, "")
      .replace(/\b카시트\b|\b유모차\b/gu, "")
      .trim();

    products.push({
      number: Number(match[1]),
      type,
      name: name || raw,
      accessories,
      note,
      raw,
    });
  });

  if (!products.length && (order.productType || order.brand || order.modelName)) {
    products.push({
      number: 1,
      type: order.productType || "",
      name: [order.brand, order.modelName].filter(Boolean).join(" ") || order.productType || "제품 정보 없음",
      accessories: orderAccessoryTags(order),
      note: orderIssueTags(order).join(", "),
      raw: "",
    });
  }

  const productNumbers = new Set(products.map((product) => product.number));
  (order.photos || []).forEach((photo) => {
    const number = photoProductIndex(photo);
    if (!productNumbers.has(number)) {
      productNumbers.add(number);
      products.push({
        number,
        type: "",
        name: "제품 정보",
        accessories: [],
        note: "",
        raw: "",
      });
    }
  });

  products.sort((a, b) => a.number - b.number);
  return products;
}

function renderDetailProductSwitch(order) {
  return "";
}

function photoGridClass() {
  const columns = [1, 2, 3].includes(Number(state.photoGridColumns)) ? Number(state.photoGridColumns) : 3;
  return `photo-grid-cols-${columns}`;
}

function renderPhotoGridControls() {
  const columns = [1, 2, 3].includes(Number(state.photoGridColumns)) ? Number(state.photoGridColumns) : 3;
  return `
    <div class="photo-grid-controls" aria-label="사진 보기 방식">
      ${[1, 2, 3].map((count) => `
        <button type="button" data-photo-grid-columns="${count}" class="${columns === count ? "is-active" : ""}">
          ${count}장씩 보기
        </button>
      `).join("")}
      <button type="button" id="startPhotoDeleteSelectionButton" class="${state.photoSelectionMode ? "is-active" : ""}">선택 삭제</button>
    </div>
  `;
}

function renderPhotoSelectionBar() {
  if (!state.photoSelectionMode) return "";
  const count = state.selectedPhotoIds.length;
  return `
    <div class="photo-selection-bar" role="toolbar" aria-label="사진 선택 작업">
      <span>선택 ${count}장</span>
      <div>
        <button class="danger-button compact" type="button" id="deleteSelectedPhotosButton" ${count ? "" : "disabled"}>삭제</button>
        <button class="secondary-button compact" type="button" id="cancelPhotoSelectionButton">취소</button>
      </div>
    </div>
  `;
}

function renderDetailPhotoSpecialNotice(importantMemo) {
  const memo = String(importantMemo || "").trim();
  if (!memo) return "";
  return `<div class="detail-photo-special-notice"><strong>중요</strong><span>${escapeHtml(memo)}</span></div>`;
}

function renderOrderMemoBars(order, options = {}) {
  const fields = options.fields || ["important", "today", "accessories"];
  const labels = { important: "중요", today: "오늘", accessories: "부속품" };
  return `
    <div class="order-memo-bars ${options.compact ? "is-compact" : ""}">
      ${fields.map((field) => {
        const value = orderMemoFieldValue(order, field);
        return `<span class="order-memo-bar is-${field}" role="button" tabindex="0" data-quick-memo="${escapeHtml(order.id)}" data-memo-field="${escapeHtml(field)}"><i></i>${escapeHtml(labels[field])} : ${escapeHtml(value)}</span>`;
      }).join("")}
    </div>
  `;
}

function renderDetailTaskBars(order) {
  return renderOrderMemoBars(order, { fields: ["important", "today", "accessories"] });
}

function productButtonLabel(product, fallbackIndex = 0) {
  const number = product.number || fallbackIndex + 1;
  const name = [product.name, product.type].find((item) => item && !String(item).startsWith(`${number}`)) || "제품 정보 없음";
  return name;
}

function selectedProductPhotoIndex(order) {
  return 1;
}

function photoProductIndex(photo) {
  return Number(photo.productIndex) || 1;
}

function photoUploadedTime(photo) {
  const time = new Date(photo.uploadedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function productPhotos(order) {
  return (order.photos || [])
    .sort((a, b) => {
      const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinnedDiff) return pinnedDiff;
      if (a.pinned && b.pinned) {
        const pinnedAtDiff = new Date(a.pinnedAt || 0) - new Date(b.pinnedAt || 0);
        if (pinnedAtDiff) return pinnedAtDiff;
      }
      const uploadedDiff = photoUploadedTime(a) - photoUploadedTime(b);
      if (uploadedDiff) return uploadedDiff;
      const sortDiff = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
      if (sortDiff) return sortDiff;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function renderOrderStageActions(order) {
  const currentStep = orderStep(order);
  return `
    <div class="quick-order-actions order-stage-actions" aria-label="상태 변경">
      ${workflowSteps().map((step) => `
        <button type="button" data-quick-step="${escapeHtml(order.id)}" data-step-code="${escapeHtml(step.code)}" class="${currentStep === step.code ? "is-active" : ""}">
          ${escapeHtml(step.name)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderCafePostButton(order) {
  if (state.tab !== "done" || !isAdminUser()) return "";
  const posted = order.cafeStatus === "카페완료";
  const label = posted ? "카페 완료" : "카페 업로드";
  return `<button class="cafe-post-action ${posted ? "is-posted" : ""}" type="button" data-naver-cafe-post="${escapeHtml(order.id)}">${label}</button>`;
}

function renderDoneQuickShareActions(order) {
  if (state.tab !== "done") return "";
  const type = orderListType(order);
  const isPickupType = type === "B" || type === "AB";
  const actions = isPickupType
    ? [
      { target: "sms-pickup", label: "픽업전" },
      { target: "customer", label: "링크전송" },
    ]
    : [
      { target: "sms-before", label: "배송전" },
      { target: "customer", label: "링크전송" },
      { target: "sms-after", label: "배송완료" },
    ];
  return `
    <div class="done-quick-share-actions" aria-label="완료 항목 바로 내보내기">
      ${actions.map((action) => `
        <button type="button" data-quick-share-order="${escapeHtml(order.id)}" data-quick-share-target="${escapeHtml(action.target)}">
          ${escapeHtml(action.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderOrderCard(order) {
  const currentStep = orderStep(order);
  const stepLabel = `${currentStep} ${stepName(currentStep)}`;
  const quickActions = state.tab === "work" ? renderOrderStageActions(order) : "";
  const doneQuickShareActions = renderDoneQuickShareActions(order);
  const doneOrderSelected = state.doneOrderSelectionMode && state.selectedDoneOrderIds.includes(order.id);
  const doneSelectionClass = doneOrderSelected ? "is-done-order-selected" : "";
  const doneSelectionMark = state.tab === "done" && state.doneOrderSelectionMode
    ? `<span class="done-order-select-mark">${doneOrderSelected ? "✓" : ""}</span>`
    : "";
  const finalCompleteButton = state.tab === "done" && doneStatusFilterCode(order) !== "sms-done"
    ? `<button class="quick-complete-action" type="button" data-final-complete="${escapeHtml(order.id)}">최종 완료</button>`
    : "";
  const cafePostButton = renderCafePostButton(order);
  const cardActions = finalCompleteButton || cafePostButton ? `<div class="order-card-actions">${finalCompleteButton}${cafePostButton}</div>` : "";
  if (state.toolbarCollapsed) {
    return `
      <article class="order-card is-list-collapsed ${doneSelectionClass} ${state.tab === "work" || finalCompleteButton || cafePostButton ? "has-quick-actions" : ""} ${cardActions ? "has-card-actions" : ""}" data-order-card-id="${escapeHtml(order.id)}">
        ${doneSelectionMark}
        <button class="order-card-open" type="button" data-order="${order.id}">
          ${renderOrderTitleBlock(order)}
        </button>
        ${doneQuickShareActions}
        ${cardActions}
        ${quickActions}
      </article>
    `;
  }
  return `
    <article class="order-card ${doneSelectionClass} ${state.tab === "work" || finalCompleteButton || cafePostButton ? "has-quick-actions" : ""} ${cardActions ? "has-card-actions" : ""} ${order.urgent ? "is-urgent" : ""}" data-order-card-id="${escapeHtml(order.id)}">
      ${doneSelectionMark}
      <span class="urgent-pin-button ${order.urgent ? "is-active" : ""}" role="button" tabindex="0" data-urgent-order="${order.id}" aria-label="긴급 표시">!</span>
      <span class="today-task-button ${orderTodayTaskChecked(order) ? "is-active" : ""}" role="button" tabindex="0" data-today-task-order="${order.id}" aria-label="오늘할일체크">!</span>
      <button class="order-card-open" type="button" data-order="${order.id}">
        <div class="order-main">
          <div>
            <span class="order-register-date">${escapeHtml(compactRegistrationDate(order))}</span>
            ${renderOrderTitleBlock(order)}
            <p>${escapeHtml(orderListSubtitle(order))}</p>
            ${renderOrderMemoBars(order, { compact: true })}
          </div>
          <span class="order-step-preview">
            <span class="order-preview-actions">
              <span class="status-pill">${stepLabel}</span>
            </span>
            ${renderPickupPreview(order)}
          </span>
        </div>
        ${renderRecentPhotoStrip(order, 5, state.tab === "work")}
      </button>
      ${doneQuickShareActions}
      ${state.tab === "work" ? `<button class="quick-complete-action" type="button" data-quick-complete="${escapeHtml(order.id)}">완료</button>` : ""}
      ${cardActions}
      ${quickActions}
    </article>
  `;
}

function renderDetail() {
  const order = state.data.orders.find((item) => item.id === state.selectedOrderId);
  if (!order) {
    state.selectedOrderId = null;
    return render();
  }
  title.textContent = order.serial;
  order.currentStep = orderStep(order);
  const currentProductPhotos = productPhotos(order);
  const isDone = order.status === "완료";
  const availableSteps = workflowSteps();
  if (state.selectedStep !== "all" && !availableSteps.some((step) => step.code === state.selectedStep)) {
    state.selectedStep = "all";
  }
  const selectedPhotos = state.selectedStep === "all"
    ? currentProductPhotos.filter((photo) => Number(photo.stepCode) <= PHOTO_STEP_LIMIT)
    : currentProductPhotos.filter((photo) => photo.stepCode === state.selectedStep);
  const pinnedSelectedPhotos = selectedPhotos.filter((photo) => photo.pinned);
  const regularSelectedPhotos = selectedPhotos.filter((photo) => !photo.pinned);
  const expandedPhoto = currentProductPhotos.find((photo) => photo.id === state.expandedPhotoId);
  const selectedCount = state.selectedPhotoIds.length;
  const importantMemo = orderMemoFieldValue(order, "important");
  const requestMemo = orderMemoWithoutSpecial(order.requestMemo);
  const stepRows = [`<button type="button" data-step="all" class="${state.selectedStep === "all" ? "is-active" : ""}">전체</button>`, ...availableSteps
    .map((step) => `<button type="button" data-step="${step.code}" class="${state.selectedStep === step.code ? "is-active" : ""}">${step.code} ${step.name}</button>`)
  ].join("");
  const detailPanel = isDone
    ? (state.selectedStep === "all" ? renderCompletedPhotoBoard(order, stepRows) : renderCompletedStatusPanel(order, stepRows))
    : `
    <section class="panel">
      ${renderDetailProductSwitch(order)}
      <div class="step-row">${stepRows}</div>
      <div class="section-title">
        <h3>${state.selectedStep === "all" ? "전체 사진" : `${state.selectedStep} ${stepName(state.selectedStep)}`}</h3>
        <span class="chip">${state.photoSelectionMode ? `선택 ${selectedCount}장` : `사진 ${selectedPhotos.length}장`}</span>
      </div>
      ${renderPhotoGridControls()}
      ${renderDetailPhotoSpecialNotice(importantMemo)}
      ${renderDetailTaskBars(order)}
      <div class="detail-photo-lanes">
        ${pinnedSelectedPhotos.length ? `<div class="photo-strip is-pinned-strip">
          ${pinnedSelectedPhotos.map(renderPhotoCard).join("")}
        </div>` : ""}
        ${regularSelectedPhotos.length || state.selectedStep !== "all" ? `<div class="photo-strip is-regular-strip ${photoGridClass()}">
          ${state.selectedStep === "all" ? "" : `<button class="add-photo-card" type="button" id="openPhotoButton" aria-label="사진 추가"><span>+</span><small>사진 추가</small></button>`}
          ${regularSelectedPhotos.map(renderPhotoCard).join("")}
        </div>` : ""}
      </div>
      ${state.selectedStep === "all" ? "" : `<label>단계 메모
        <textarea id="stepMemo" rows="3">${escapeHtml(order.stepMemos[state.selectedStep] || "")}</textarea>
      </label>`}
      ${renderPhotoSelectionBar()}
      <div class="detail-actions">
        <button class="secondary-button" type="button" id="previousStepButton">이전</button>
        <span class="step-move-label">단계 이동</span>
        <button class="primary-button" type="button" id="nextStepButton">다음</button>
      </div>
    </section>
  `;

  content.innerHTML = `
    <section class="detail-hero">
      <button class="back-button" type="button" id="backToList">목록</button>
      <div class="order-main">
        <div>
          <p class="eyebrow">${escapeDisplay(order.routeType)}</p>
          <h2>${escapeDisplay(order.serial)}</h2>
          <p>${escapeDisplay(order.address || "주소 없음")}</p>
        </div>
        <span class="status-pill light">${order.currentStep} ${stepName(order.currentStep)}</span>
      </div>
      <div class="meta">
        <span class="chip">${escapeDisplay(order.productType || "제품 미입력")}</span>
        <span class="chip">${escapeDisplay(order.brand || "브랜드 없음")}</span>
        <span class="chip">작업자 ${escapeDisplay(order.worker || "-")}</span>
      </div>
      <div class="order-edit-actions">
        <div class="order-edit-action-row is-primary-row">
          <button class="${order.urgent ? "danger-button" : "secondary-button"} compact" type="button" data-urgent-order="${escapeHtml(order.id)}">${order.urgent ? "긴급 끄기" : "긴급 켜기"}</button>
          ${isDone ? "" : `<button class="primary-button compact" type="button" id="detailCompleteButton">완료</button>`}
        </div>
        <div class="order-edit-action-row">
          <button class="secondary-button compact" type="button" id="editOrderButton">정보 수정</button>
          <button class="danger-button compact" type="button" id="deleteOrderButton">항목 삭제</button>
        </div>
      </div>
      ${requestMemo ? `<pre class="request-note">${escapeDisplay(requestMemo)}</pre>` : ""}
    </section>
    ${detailPanel}
    ${isDone ? renderExport(order) : ""}
    <section class="panel stack">
      <div class="section-title"><h3>작업 이력</h3></div>
      ${state.data.logs.filter((log) => log.orderId === order.id).slice(0, 8).map((log) => `
        <article class="memo-item">
          <strong>${escapeHtml(log.action)}</strong>
          <p>${fmt(log.createdAt)} · ${escapeDisplay(log.worker || "-")} ${log.memo ? `· ${escapeDisplay(log.memo)}` : ""}</p>
        </article>
      `).join("") || `<p class="helper">아직 이력이 없습니다.</p>`}
    </section>
    ${expandedPhoto ? renderExpandedPhoto(expandedPhoto, order) : ""}
  `;
}

function renderCompletedPhotoBoard(order, stepRows) {
  const selectedPhotos = productPhotos(order);
  const totalPhotos = selectedPhotos.length;
  const excludedCount = state.selectedPhotoIds.length;
  const importantMemo = orderMemoFieldValue(order, "important");
  return `
    <section class="panel completed-photo-board">
      ${renderDetailProductSwitch(order)}
      <div class="step-row">${stepRows}</div>
      <div class="section-title">
        <h3>완료 사진</h3>
        <span class="chip">${excludedCount ? `공유 제외 ${excludedCount}장` : `전체 ${totalPhotos}장`}</span>
      </div>
      ${renderPhotoGridControls()}
      ${renderDetailPhotoSpecialNotice(importantMemo)}
      ${renderDetailTaskBars(order)}
      <p class="helper">공유에서 제외할 사진을 선택하면 X 표시가 생깁니다. 선택 상태에서는 사진 위로 드래그해서 여러 장을 한 번에 선택하거나 해제할 수 있습니다.</p>
      ${excludedCount ? `<div class="photo-pin-toolbar">
        <button class="secondary-button compact" type="button" id="pinSelectedPhotos">선택 사진 상단 고정</button>
        <button class="secondary-button compact" type="button" id="unpinSelectedPhotos">선택 사진 고정 해제</button>
      </div>` : ""}
      <div class="completed-step-list">
        ${state.data.steps.filter((step) => Number(step.code) <= PHOTO_STEP_LIMIT).map((step) => {
          const photos = selectedPhotos.filter((photo) => photo.stepCode === step.code);
          const pinnedPhotos = photos.filter((photo) => photo.pinned);
          const regularPhotos = photos.filter((photo) => !photo.pinned);
          return `
            <section class="completed-step-section">
              <div class="completed-step-title">
                <strong>${step.code} ${escapeHtml(step.name)}</strong>
                <span>${photos.length}장</span>
              </div>
              <div class="completed-photo-lanes">
                ${pinnedPhotos.length ? `<div class="completed-photo-grid is-pinned-grid">
                  ${pinnedPhotos.map(renderCompletedPhotoCard).join("")}
                </div>` : ""}
                <div class="completed-photo-grid is-regular-grid ${photoGridClass()}">
                  <button class="add-photo-card" type="button" data-add-completed-photo="${step.code}" aria-label="${step.code} ${escapeHtml(step.name)} 사진 추가"><span>+</span><small>사진 추가</small></button>
                  ${regularPhotos.map(renderCompletedPhotoCard).join("")}
                </div>
              </div>
            </section>
          `;
        }).join("")}
      </div>
      ${renderPhotoSelectionBar()}
      <div class="detail-actions">
        <button class="secondary-button" type="button" id="previousStepButton">이전</button>
        <span class="step-move-label">단계 이동</span>
        <button class="primary-button" type="button" id="nextStepButton">다음</button>
      </div>
    </section>
  `;
}

function renderCompletedStatusPanel(order, stepRows) {
  const step = state.data.steps.find((item) => item.code === state.selectedStep);
  return `
    <section class="panel">
      ${renderDetailProductSwitch(order)}
      <div class="step-row">${stepRows}</div>
      <div class="section-title">
        <h3>${escapeHtml(step?.code || state.selectedStep)} ${escapeHtml(step?.name || "")}</h3>
        <span class="chip">${order.currentStep === state.selectedStep ? "현재 상태" : "완료 단계"}</span>
      </div>
      <p class="helper">4~6단계는 사진을 추가하지 않는 상태 관리 단계입니다.</p>
      <div class="detail-actions">
        <button class="secondary-button" type="button" id="previousStepButton">이전</button>
        <span class="step-move-label">단계 이동</span>
        <button class="primary-button" type="button" id="nextStepButton">다음</button>
      </div>
    </section>
  `;
}

function renderCompletedPhotoCard(photo) {
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video/");
  const selected = state.selectedPhotoIds.includes(photo.id);
  const src = mediaDisplayUrl(photo);
  return `
    <article class="completed-photo-card ${selected ? "is-excluded" : ""} ${photo.pinned ? "is-pinned" : ""}" data-photo-card="${photo.id}">
      <button class="completed-photo-delete" type="button" data-delete-photo="${photo.id}" aria-label="사진 삭제">×</button>
      <button class="completed-photo-pin" type="button" data-pin-photo="${photo.id}" data-pinned="${photo.pinned ? "true" : "false"}" aria-label="${photo.pinned ? "사진 고정 해제" : "사진 상단 고정"}">📌</button>
      ${isVideo ? `<video src="${serverAssetUrl(photo.url)}" controls playsinline preload="metadata"></video>` : `<img src="${src}" alt="${escapeHtml(photo.originalName)}" loading="lazy" decoding="async" fetchpriority="low">`}
      <i aria-hidden="true">×</i>
      <span>${escapeHtml(photo.memo || photo.originalName || "")}</span>
    </article>
  `;
}

function renderPhotoCard(photo) {
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video/");
  const selected = state.selectedPhotoIds.includes(photo.id);
  const src = mediaDisplayUrl(photo);
  return `
    <article class="photo-card ${selected ? "is-selected" : ""} ${photo.pinned ? "is-pinned" : ""}" data-photo-card="${photo.id}">
      <button class="photo-delete-button" type="button" data-delete-photo="${photo.id}" aria-label="사진 삭제">×</button>
      <button class="photo-pin-button" type="button" data-pin-photo="${photo.id}" data-pinned="${photo.pinned ? "true" : "false"}" aria-label="${photo.pinned ? "사진 고정 해제" : "사진 상단 고정"}">📌</button>
      <span class="photo-select-mark">${selected ? "?" : ""}</span>
      ${isVideo ? `<video src="${serverAssetUrl(photo.url)}" controls playsinline preload="metadata"></video>` : `<img src="${src}" alt="${escapeHtml(photo.originalName)}" loading="lazy" decoding="async" fetchpriority="low">`}
      <div class="caption">
        <strong>${escapeHtml(photo.stepName)}</strong>
        <p>${escapeHtml(photo.memo || "메모 없음")}</p>
        <span>${fmt(photo.uploadedAt)} · ${escapeHtml(photo.uploadedBy || "-")}</span>
      </div>
    </article>
  `;
}

function expandedPhotoList(order) {
  const photos = productPhotos(order);
  if (order.status === "완료" || state.selectedStep === "all") return photos;
  return photos.filter((photo) => photo.stepCode === state.selectedStep);
}

function renderExpandedPhoto(photo, order) {
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video/");
  const src = mediaDisplayUrl(photo);
  const photos = expandedPhotoList(order);
  const index = photos.findIndex((item) => item.id === photo.id);
  const hasPrevious = index > 0;
  const hasNext = index >= 0 && index < photos.length - 1;
  return `
    <div class="photo-lightbox" data-expanded-photo-view="${photo.id}">
      <button class="photo-lightbox-arrow is-left" type="button" data-photo-navigate="previous" ${hasPrevious ? "" : "disabled"} aria-label="이전 사진">‹</button>
      <div class="photo-lightbox-media">
        ${isVideo ? `<video src="${serverAssetUrl(photo.url)}" controls playsinline autoplay></video>` : `<img src="${src}" alt="${escapeHtml(photo.originalName)}">`}
      </div>
      <button class="photo-lightbox-arrow is-right" type="button" data-photo-navigate="next" ${hasNext ? "" : "disabled"} aria-label="다음 사진">›</button>
    </div>
  `;
}

function renderExport(order) {
  const message = buildShareMessage(order);
  const smsOptions = smsShareOptions(order);
  const excludedCount = state.selectedPhotoIds.length;
  const customerTemplateTarget = "customer-url";
  const customerTemplateSlot = state.smsTemplateSlots[customerTemplateTarget] || 1;
  const customerTemplateMemo = smsTemplateDraft({ target: customerTemplateTarget, message });
  state.customerShareMemo = customerTemplateMemo;

  return `
    <section class="panel export-box">
      <div class="section-title"><h3>내보내기</h3><span class="chip">${escapeHtml(exportStatusLabel(order))}</span></div>
      <p class="helper">고객에게 사진 저장과 확인용 URL을 공유합니다.</p>
      ${smsOptions.map((option) => {
        const selectedSlot = state.smsTemplateSlots[option.target] || 1;
        const message = smsTemplateDraft(option);
        return `
          <section class="sms-message-option">
            <strong>${escapeHtml(option.label)}</strong>
            <div class="sms-template-row" aria-label="${escapeDisplay(option.label)} 저장 문구 선택">
              ${[1, 2, 3, 4, 5].map((slot) => `<button type="button" data-sms-template-slot="${slot}" data-sms-template-target="${option.target}" class="${selectedSlot === slot ? "is-active" : ""}" title="${slot}번 문구">${slot}</button>`).join("")}
            </div>
            <textarea data-sms-message-target="${option.target}" rows="10" maxlength="4000" placeholder="전송할 문구를 입력해주세요.">${escapeDisplay(message)}</textarea>
            <button class="secondary-button" type="button" data-share="${option.target}">${escapeDisplay(option.label)}</button>
          </section>
        `;
      }).join("")}
      <section class="sms-message-option customer-url-message-option">
        <strong>고객 URL에서 보일 메모</strong>
        <div class="sms-template-row" aria-label="고객 URL 저장 문구 선택">
          ${[1, 2, 3, 4, 5].map((slot) => `<button type="button" data-sms-template-slot="${slot}" data-sms-template-target="${customerTemplateTarget}" class="${customerTemplateSlot === slot ? "is-active" : ""}" title="${slot}번 문구">${slot}</button>`).join("")}
        </div>
        <textarea id="customerShareMemo" data-sms-message-target="${customerTemplateTarget}" rows="6" maxlength="2000" placeholder="고객 URL 상단에 표시할 메모를 입력해주세요.">${escapeDisplay(customerTemplateMemo)}</textarea>
      </section>
      <button class="primary-button" type="button" data-share="customer">고객에게 URL 공유${excludedCount ? ` (${excludedCount}장 제외)` : ""}</button>
    </section>
  `;
}

function smsTemplateStorageKey() {
  return `bebeu.smsTemplates.${state.currentUserId || "default"}`;
}

function readSmsTemplates() {
  const dbTemplates = state.data?.smsTemplates;
  if (dbTemplates && typeof dbTemplates === "object" && Object.keys(dbTemplates).length) return dbTemplates;
  try {
    const saved = JSON.parse(localStorage.getItem(smsTemplateStorageKey()) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function smsTemplateValue(target, slot, defaultMessage = "") {
  const templates = readSmsTemplates();
  const targetTemplates = templates[target] && typeof templates[target] === "object" ? templates[target] : {};
  if (Object.prototype.hasOwnProperty.call(targetTemplates, slot)) return String(targetTemplates[slot] || "");
  return Number(slot) === 1 ? defaultMessage : "";
}

function smsTemplateDraft(option) {
  const target = option.target;
  const slot = state.smsTemplateSlots[target] || 1;
  state.smsTemplateSlots[target] = slot;
  if (!Object.prototype.hasOwnProperty.call(state.smsMessageDrafts, target)) {
    state.smsMessageDrafts[target] = smsTemplateValue(target, slot, option.message);
  }
  return state.smsMessageDrafts[target];
}

function selectSmsTemplateSlot(target, slot) {
  const normalizedSlot = Math.min(5, Math.max(1, Number(slot) || 1));
  const order = state.data?.orders?.find((item) => item.id === state.selectedOrderId);
  const option = smsShareOptions(order).find((item) => item.target === target);
  const defaultMessage = target === "customer-url" ? buildShareMessage(order) : option?.message || "";
  state.smsTemplateSlots[target] = normalizedSlot;
  state.smsMessageDrafts[target] = smsTemplateValue(target, normalizedSlot, defaultMessage).slice(0, 4000);
  const textarea = document.querySelector(`[data-sms-message-target="${target}"]`);
  if (textarea) textarea.value = state.smsMessageDrafts[target];
  if (target === "customer-url") state.customerShareMemo = state.smsMessageDrafts[target];
  document.querySelectorAll(`[data-sms-template-target="${target}"]`).forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.smsTemplateSlot) === normalizedSlot);
  });
}

function saveSelectedSmsTemplate(target, message) {
  const slot = state.smsTemplateSlots[target] || 1;
  const templates = readSmsTemplates();
  if (!templates[target] || typeof templates[target] !== "object") templates[target] = {};
  templates[target][slot] = String(message || "").trim().slice(0, 4000);
  if (!state.data) state.data = {};
  state.data.smsTemplates = templates;
  localStorage.setItem(smsTemplateStorageKey(), JSON.stringify(templates));
  api("/api/sms-templates", {
    method: "POST",
    body: JSON.stringify({ templates }),
  }).then((result) => {
    if (result?.smsTemplates && state.data) state.data.smsTemplates = result.smsTemplates;
  }).catch((error) => {
    console.warn("SMS template DB save failed", error);
  });
}

function savedSmsTemplateMessage(target, defaultMessage = "") {
  const saved = smsTemplateValue(target, 1, defaultMessage).trim();
  return saved || defaultMessage;
}

function refreshSharePreviews() {
  return;
}

function publicShareUrl(order, excludedPhotoIds = state.selectedPhotoIds, customerMemo = "") {
  const url = new URL(`/share/${encodeURIComponent(order.id)}`, configuredServerBase());
  url.searchParams.set("v", CUSTOMER_SHARE_CACHE_VERSION);
  const excluded = excludedPhotoIds.filter((id) => order.photos.some((photo) => photo.id === id));
  if (excluded.length) url.searchParams.set("hide", excluded.join(","));
  if (customerMemo.trim()) url.searchParams.set("memo", customerMemo.trim());
  return url.toString();
}

function buildShareMessage(order) {
  return `고객님, 베베유입니다.

작업 사진 확인용 링크를 보내드립니다.
사진 확인 후 문의사항이 있으면 연락 부탁드립니다.`;
}

function smsShareOptions(order) {
  const type = orderListType(order);
  if (type === "B" || type === "AB") {
    return [{ target: "sms-pickup", label: "픽업 가능 문자", message: buildSmsMessage(order, "pickup") }];
  }
  return [
    { target: "sms-before", label: "배송 전 문자", message: buildSmsMessage(order, "before") },
    { target: "sms-after", label: "배송 후 문자", message: buildSmsMessage(order, "after") },
  ];
}

function buildSmsMessage(order, kind = "before") {
  if (kind === "pickup") {
    return `고객님, 베베유입니다.

세탁이 완료되어 픽업 가능합니다.
방문 전 매장으로 연락 부탁드립니다.`;
  }
  if (kind === "after") {
    return `고객님, 베베유입니다.

제품 수령 후 비닐 커버를 벗겨 통풍해 주세요.
이용해 주셔서 감사합니다.`;
  }
  return `고객님, 베베유입니다.

작업 완료 후 순차적으로 배송 예정입니다.
배송 전 연락드리겠습니다.`;
}
function buildShareMessage(order) {
  return `고객님 베베유입니다.

작업 사진 확인용 링크를 보내드립니다.
사진 확인 후 문의사항이 있으시면 연락 부탁드립니다.`;
}

function buildSmsMessage(order, kind = "before") {
  if (kind === "pickup") {
    return `고객님 베베유입니다.

세탁이 완료되어 픽업 가능합니다.
방문 전 매장으로 연락 부탁드립니다.`;
  }
  if (kind === "after") {
    return `고객님 베베유입니다.

제품 수령 후 비닐 커버를 벗기고 통풍해 주세요.
이용해 주셔서 감사합니다.`;
  }
  return `고객님 베베유입니다.

작업 완료 후 순차적으로 배송 예정입니다.
배송 전 연락드리겠습니다.`;
}

function renderFontSizeSetting() {
  const scale = currentFontScale();
  const index = FONT_SCALE_STEPS.indexOf(scale);
  return `
    <section class="panel stack font-size-setting">
      <div class="section-title">
        <h3>글자 크기 설정</h3>
        <span class="chip">사용자별 저장</span>
      </div>
      <div class="font-size-stepper" role="group" aria-label="글자 크기 조절">
        <button type="button" data-font-size-change="-1" aria-label="글자 작게" ${index === 0 ? "disabled" : ""}>-</button>
        <strong id="fontScaleValue" aria-live="polite">${Math.round(scale * 100)}%</strong>
        <button type="button" data-font-size-change="1" aria-label="글자 크게" ${index === FONT_SCALE_STEPS.length - 1 ? "disabled" : ""}>+</button>
      </div>
    </section>
  `;
}

function renderFontFamilySetting() {
  const current = currentFontFamilyId();
  return `
    <section class="panel stack font-family-setting">
      <div class="section-title">
        <h3>폰트 설정</h3>
        <span class="chip">사용자별 저장</span>
      </div>
      <div class="font-family-grid" role="group" aria-label="폰트 선택">
        ${APP_FONTS.map((font) => `
          <button type="button" data-font-family="${escapeHtml(font.id)}" class="${font.id === current ? "is-active" : ""}" style="font-family: ${font.family}">
            ${escapeHtml(font.label)}
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderNaverCafeSetting() {
  if (!isAdminUser()) return "";
  const settings = state.data?.naverCafeSettings || {};
  return `
    <section class="panel stack naver-cafe-panel">
      <div class="section-title">
        <h3>네이버 카페 자동 업로드</h3>
        <span class="chip">${settings.hasAccessToken ? "계정 토큰 저장됨" : "계정 미연동"}</span>
      </div>
      <p class="helper">완료 탭에서 카페 업로드 버튼을 누르면 제품명과 사진이 네이버 카페 양식으로 등록됩니다.</p>
      <form id="naverCafeSettingsForm" class="naver-cafe-form">
        <label class="keep-pin-toggle">
          <input name="enabled" type="checkbox" ${settings.enabled ? "checked" : ""}>
          카페 업로드 기능 사용
        </label>
        <div class="naver-cafe-grid">
          <label>Client ID
            <input name="clientId" type="text" autocomplete="off" value="${escapeHtml(settings.clientId || "")}">
          </label>
          <label>Client Secret
            <input name="clientSecret" type="password" autocomplete="off" placeholder="${settings.hasClientSecret ? "저장된 Secret 유지" : "Client Secret"}">
          </label>
        </div>
        <div class="naver-cafe-grid">
          <label>카페 ID
            <input name="clubId" type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(settings.clubId || "")}" placeholder="clubid">
          </label>
          <label>게시판 ID
            <input name="menuId" type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(settings.menuId || "")}" placeholder="menuid">
          </label>
        </div>
        <a class="primary-button naver-connect-button" href="${escapeHtml(settings.connectPath || "/api/naver-cafe/connect")}">네이버 계정 연결</a>
        <button class="secondary-button" type="button" data-naver-cafe-automation-login>자동화 로그인 열기</button>
        <label>글 제목 형식
          <input name="titleTemplate" type="text" autocomplete="off" value="${escapeHtml(settings.titleTemplate || "광주 {productName} 세탁 베베유")}">
        </label>
        <label>글 본문
          <textarea name="contentTemplate" rows="4">${escapeHtml(settings.contentTemplate || "24시간 오픈 / 광주 무료수거배달 / 매장방문 10% 상시할인")}</textarea>
        </label>
        <label>첨부 사진 기준
          <select name="includePhotos">
            <option value="all" ${(settings.includePhotos || "all") === "all" ? "selected" : ""}>전체 사진</option>
            <option value="completed" ${settings.includePhotos === "completed" ? "selected" : ""}>후사진/살균 사진만</option>
          </select>
        </label>
        <p class="helper">사용 가능 변수: {productName}, {serial}, {customerName}, {phone}, {address}, {productType}, {brand}, {modelName}, {completedDate}</p>
        <button class="primary-button" type="submit">카페 설정 저장</button>
        <div class="naver-test-grid">
          <button class="secondary-button" type="button" data-naver-cafe-test>카페 인코딩 비교 테스트</button>
        </div>
      </form>
    </section>
  `;
}

function exportStatusLabel(order) {
  const status = cleanDisplayText(order?.shareStatus || "");
  if (!status || status === "미공유") return "완료";
  if (/문자|SMS/i.test(status)) return "문자전송완료";
  if (/고객|공유|내보내기|저장매체/.test(status)) return "내보내기완료";
  return status;
}

function renderPasswordChangeForm() {
  if (!isAdminUser() || !state.passwordChangeOpen) return "";
  return `
    <form class="password-change-form" id="adminPasswordForm">
      <label>현재 비밀번호
        <input name="currentPassword" type="password" autocomplete="current-password" required>
      </label>
      <label>새 비밀번호
        <input name="newPassword" type="password" autocomplete="new-password" minlength="4" required>
      </label>
      <label>새 비밀번호 확인
        <input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required>
      </label>
      ${state.passwordChangeMessage ? `<p class="helper">${escapeHtml(state.passwordChangeMessage)}</p>` : ""}
      <button class="primary-button" type="submit">비밀번호 저장</button>
    </form>
  `;
}

function formatTrashDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function trashRetentionText(value) {
  if (!value) return "30일 보관";
  const deletedAt = new Date(value).getTime();
  if (Number.isNaN(deletedAt)) return "30일 보관";
  const expireAt = deletedAt + 30 * 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((expireAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return `${daysLeft}일 남음`;
}

function trashPhotoThumb(photo) {
  return serverAssetUrl(photo.displayUrl || photo.url || "");
}

function trashPhotoList() {
  return Array.isArray(state.data?.trash?.photos) ? state.data.trash.photos : [];
}

function renderTrashExpandedPhoto() {
  const photos = trashPhotoList();
  const photo = photos.find((item) => item.id === state.trashExpandedPhotoId);
  if (!photo) return "";
  const index = photos.findIndex((item) => item.id === photo.id);
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video/");
  const src = serverAssetUrl(photo.displayUrl || photo.url || "");
  const originalSrc = serverAssetUrl(photo.url || photo.displayUrl || "");
  return `
    <div class="photo-lightbox" data-expanded-photo-view="${escapeHtml(photo.id)}" data-trash-expanded-photo="true">
      <button class="photo-lightbox-arrow is-left" type="button" data-photo-navigate="previous" ${index > 0 ? "" : "disabled"} aria-label="이전 사진">‹</button>
      <div class="photo-lightbox-media">
        ${isVideo ? `<video src="${escapeHtml(originalSrc)}" controls playsinline autoplay></video>` : `<img src="${escapeHtml(src)}" alt="${escapeHtml(photo.originalName || "삭제된 사진")}">`}
      </div>
      <button class="photo-lightbox-arrow is-right" type="button" data-photo-navigate="next" ${index >= 0 && index < photos.length - 1 ? "" : "disabled"} aria-label="다음 사진">›</button>
    </div>
  `;
}

function renderTrashSetting() {
  const trash = state.data?.trash || { orders: [], photos: [] };
  const deletedOrders = Array.isArray(trash.orders) ? trash.orders : [];
  const deletedPhotos = Array.isArray(trash.photos) ? trash.photos : [];
  const selected = new Set(state.trashSelectedPhotoIds);
  const totalCount = deletedOrders.length + deletedPhotos.length;
  return `
    <section class="panel stack trash-panel">
      <div class="section-title">
        <h3>휴지통</h3>
        <span class="chip">${totalCount}개</span>
      </div>
      <p class="helper">삭제한 항목과 사진을 여기서 되돌릴 수 있습니다. 삭제된 사진은 30일간 보관된 뒤 자동으로 완전히 삭제됩니다.</p>
      <button class="menu-button trash-open-button" type="button" data-toggle-trash>
        ${state.trashOpen ? "휴지통 닫기" : `휴지통 열기 (${totalCount})`}
      </button>
      ${state.trashOpen ? `
      <div class="trash-section">
        <div class="section-title">
          <h4>삭제된 항목</h4>
          <span class="chip">${deletedOrders.length}개</span>
        </div>
        ${deletedOrders.length ? `
          <div class="trash-order-list">
            ${deletedOrders.map((order) => `
              <article class="trash-order-card">
                <div>
                  <strong>${escapeHtml(order.serial)}</strong>
                  <p>${escapeHtml(renderPlainOrderTitle(order))}</p>
                  <small>${escapeHtml(formatTrashDate(order.deletedAt))}${order.deletedBy ? ` · ${escapeHtml(order.deletedBy)}` : ""}</small>
                </div>
                <div class="trash-photo-mini">
                  ${(order.photos || []).slice(0, 3).map((photo) => `<img src="${escapeHtml(trashPhotoThumb(photo))}" alt="">`).join("")}
                </div>
                <button class="secondary-button compact" type="button" data-restore-order="${escapeHtml(order.id)}">복구</button>
              </article>
            `).join("")}
          </div>
        ` : `<p class="helper">삭제된 항목이 없습니다.</p>`}
      </div>
      <div class="trash-section">
        <div class="section-title">
          <h4>삭제된 사진</h4>
          <span class="chip">${deletedPhotos.length}장</span>
        </div>
        ${deletedPhotos.length ? `
          <div class="trash-action-row">
            <button class="secondary-button compact" type="button" data-trash-select-all>전체 선택</button>
            <button class="secondary-button compact" type="button" data-trash-clear-selection>선택 해제</button>
            <button class="primary-button compact" type="button" data-restore-selected-photos ${selected.size ? "" : "disabled"}>선택 사진 복구 (${selected.size})</button>
            <button class="danger-button compact" type="button" data-delete-selected-trash-photos ${selected.size ? "" : "disabled"}>선택 삭제 (${selected.size})</button>
          </div>
          <div class="trash-photo-grid">
            ${deletedPhotos.map((photo) => `
              <article class="trash-photo-card ${selected.has(photo.id) ? "is-selected" : ""}">
                <button class="trash-photo-preview" type="button" data-trash-photo-open="${escapeHtml(photo.id)}" aria-label="삭제된 사진 크게 보기">
                  <img src="${escapeHtml(trashPhotoThumb(photo))}" alt="">
                </button>
                <button class="trash-photo-select" type="button" data-trash-photo="${escapeHtml(photo.id)}" aria-pressed="${selected.has(photo.id) ? "true" : "false"}">
                  <span>${escapeHtml(photo.serial || "품번 없음")}</span>
                  <small>${escapeHtml(stepName(photo.stepCode))} · ${escapeHtml(formatTrashDate(photo.deletedAt))} · ${escapeHtml(trashRetentionText(photo.deletedAt))}</small>
                </button>
              </article>
            `).join("")}
          </div>
        ` : `<p class="helper">삭제된 사진이 없습니다.</p>`}
      </div>
      ` : ""}
    </section>
  `;
}

function renderMore() {
  title.textContent = "설정";
  const user = activeUser();
  content.innerHTML = `
    ${renderAppInstallSetting()}
    ${renderPushNotificationSetting()}
    ${renderNaverCafeSetting()}
    ${renderTrashSetting()}
    ${renderFontFamilySetting()}
    ${renderFontSizeSetting()}
    <section class="panel stack">
      <div class="section-title"><h2>요청 / 문서 / 설정</h2></div>
      <button class="menu-button" type="button">휴가 요청</button>
      <button class="menu-button" type="button">출퇴근 수정 요청</button>
      <button class="menu-button" type="button">작업 문제 보고</button>
    </section>
    <section class="panel stack">
      <h3>문서함</h3>
      <p class="helper">매뉴얼, 브랜드별 주의사항, 배송 체크리스트를 연결할 수 있습니다.</p>
    </section>
    <section class="panel stack">
      <h3>로그인 정보</h3>
      <p class="helper">현재 사용자: ${escapeHtml(user.name)} · ${escapeHtml(user.role)}</p>
      <div class="settings-action-row">
        <button class="danger-button" type="button" id="logoutButton">로그아웃</button>
        ${isAdminUser(user) ? `<button class="secondary-button" type="button" id="togglePasswordChangeButton">비밀번호 변경</button>` : ""}
      </div>
      ${renderPasswordChangeForm()}
    </section>
    <section class="panel stack">
      <h3>서버 정보</h3>
      <p class="helper">현재 서버: ${escapeHtml(state.data.serverHost || "확인 중")}</p>
      <p class="helper">사진 저장 위치: ${escapeHtml(state.data.photoRoot || "확인 중")}</p>
      ${isNativeApp() ? `
        <label>앱 서버 주소
          <input id="nativeServerUrlInput" type="url" inputmode="url" value="${escapeHtml(configuredServerBase())}">
        </label>
        <button class="secondary-button" type="button" id="saveNativeServerButton">서버 주소 변경</button>
      ` : ""}
    </section>
    ${state.trashExpandedPhotoId ? renderTrashExpandedPhoto() : ""}
  `;
  refreshPushNotificationSetting();
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function renderAppInstallSetting() {
  const installed = isStandaloneApp();
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const secure = window.isSecureContext;
  let message = "휴대폰의 홈 화면에 설치하면 전체 화면으로 빠르게 실행할 수 있습니다.";
  let action = `<button class="primary-button" type="button" id="installAppButton">앱으로 설치</button>`;

  if (installed) {
    message = "이 기기에서 앱으로 실행 중입니다.";
    action = `<span class="app-install-status">설치 완료</span>`;
  } else if (!secure) {
    message = "현재 주소가 보안 연결(HTTPS)이 아니라서 브라우저 설치 기능이 제한될 수 있습니다.";
    action = `<p class="helper">브라우저 메뉴에서 홈 화면에 추가를 선택해 주세요.</p>`;
  } else if (isIos) {
    message = "Safari 하단의 공유 버튼을 누른 뒤 홈 화면에 추가를 선택해 주세요.";
    action = `<p class="helper">iPhone, iPad는 Safari에서 설치할 수 있습니다.</p>`;
  }

  return `
    <section class="panel stack app-install-panel">
      <div class="section-title">
        <h3>bebeu 앱</h3>
        <span class="chip">홈 화면 설치</span>
      </div>
      <p class="helper">${message}</p>
      ${action}
    </section>
  `;
}

async function handleClick(event) {
  const listPhotoAddTarget = event.target.closest("[data-list-photo-add]");
  if (listPhotoAddTarget) {
    event.preventDefault();
    event.stopPropagation();
    openListPhotoStepPicker(listPhotoAddTarget.dataset.listPhotoAdd);
    return;
  }

  const urgentTarget = event.target.closest("[data-urgent-order]");
  if (urgentTarget) {
    event.preventDefault();
    event.stopPropagation();
    await toggleOrderUrgent(urgentTarget.dataset.urgentOrder);
    return;
  }

  const todayTaskTarget = event.target.closest("[data-today-task-order]");
  if (todayTaskTarget) {
    event.preventDefault();
    event.stopPropagation();
    await toggleOrderTodayTask(todayTaskTarget.dataset.todayTaskOrder);
    return;
  }

  const quickMemoTarget = event.target.closest("[data-quick-memo]");
  if (quickMemoTarget) {
    event.preventDefault();
    event.stopPropagation();
    await quickEditMemoField(quickMemoTarget.dataset.quickMemo, quickMemoTarget.dataset.memoField);
    return;
  }

  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.scrollOrder) {
    event.preventDefault();
    event.stopPropagation();
    focusOrderInWorkList(target.dataset.scrollOrder);
    return;
  }

  if (target.dataset.urgentStripMode) {
    state.urgentStripMode = target.dataset.urgentStripMode === "today" ? "today" : "urgent";
    refreshOrderList();
    return;
  }

  if (target.dataset.loginUser) {
    const user = state.data.users.find((item) => item.id === target.dataset.loginUser);
    if (isAdminUser(user)) {
      state.pendingAdminLoginUserId = user.id;
      state.adminLoginError = "";
      render();
      requestAnimationFrame(() => document.querySelector("#adminLoginForm input[name='password']")?.focus());
      return;
    }
    loginAsUser(target.dataset.loginUser);
    return;
  }

  if (target.dataset.tab) {
    state.tab = target.dataset.tab;
    state.selectedOrderId = null;
    state.query = "";
    state.filter = state.tab === "done" ? "done-ready" : "all";
    state.listTypeFilter = "all";
    syncEnteredTabDateEnd();
    clearPhotoSelection();
    clearDoneOrderSelection();
    state.selectedOrderId = null;
    state.expandedPhotoId = null;
    state.chatExpandedAttachmentId = null;
    state.trashExpandedPhotoId = null;
    state.chatTransferMessageId = null;
    pushAppHistory();
    render();
    return;
  }

  if (target.id === "chatAddPhotoButton") {
    document.querySelector("#chatPhotoInput")?.click();
    return;
  }

  if (target.dataset.chatRoom) {
    state.chatRoom = normalizeChatRoomId(target.dataset.chatRoom);
    state.query = "";
    state.chatSearchIndex = 0;
    state.chatExpandedAttachmentId = null;
    state.chatTransferMessageId = null;
    releaseChatPendingMedia();
    render();
    return;
  }

  if (target.dataset.chatAttachment) {
    state.chatExpandedAttachmentId = target.dataset.chatAttachment;
    resetLightboxZoom();
    render();
    return;
  }

  if (target.dataset.chatOpenOrder) {
    const order = state.data.orders.find((item) => item.id === target.dataset.chatOpenOrder);
    if (!order) return;
    state.tab = order.status === "완료" ? "done" : "work";
    state.selectedOrderId = order.id;
    state.selectedStep = "all";
    state.chatExpandedAttachmentId = null;
    state.chatTransferMessageId = null;
    state.expandedPhotoId = null;
    clearPhotoSelection();
    pushAppHistory();
    render();
    resetPageScroll();
    return;
  }

  if (target.dataset.chatTransferMessage) {
    state.chatTransferMessageId = target.dataset.chatTransferMessage;
    render();
    return;
  }

  if (target.dataset.closeChatTransfer !== undefined) {
    state.chatTransferMessageId = null;
    render();
    return;
  }

  if (target.dataset.chatSearchNav) {
    moveChatSearchResult(target.dataset.chatSearchNav);
    return;
  }

  if (target.dataset.chatComposerStep) {
    state.chatComposerStepCode = target.dataset.chatComposerStep;
    refreshChatComposerTarget();
    return;
  }

  if (target.dataset.deleteChatMessage) {
    await deleteChatMessage(target.dataset.deleteChatMessage);
    return;
  }

  if (target.dataset.removeChatPending !== undefined) {
    removeChatPendingMedia(Number(target.dataset.removeChatPending));
    return;
  }

  if (target.dataset.fontSizeChange) {
    changeUserFontScale(Number(target.dataset.fontSizeChange));
    return;
  }

  if (target.dataset.fontFamily) {
    changeUserFontFamily(target.dataset.fontFamily);
    return;
  }

  if (target.dataset.restoreOrder) {
    await restoreTrashOrder(target.dataset.restoreOrder);
    return;
  }

  if (target.hasAttribute("data-toggle-trash")) {
    state.trashOpen = !state.trashOpen;
    if (!state.trashOpen) {
      state.trashSelectedPhotoIds = [];
      state.trashExpandedPhotoId = null;
      resetLightboxZoom();
    }
    render();
    return;
  }

  if (target.dataset.trashPhoto) {
    toggleTrashPhotoSelection(target.dataset.trashPhoto);
    return;
  }

  if (target.dataset.trashPhotoOpen) {
    state.trashExpandedPhotoId = target.dataset.trashPhotoOpen;
    resetLightboxZoom();
    if (window.history?.pushState) history.pushState({ ...appHistoryState(), trashExpandedPhotoId: state.trashExpandedPhotoId }, "", window.location.pathname + window.location.search);
    render();
    return;
  }

  if (target.hasAttribute("data-trash-select-all")) {
    state.trashSelectedPhotoIds = (state.data?.trash?.photos || []).map((photo) => photo.id);
    render();
    return;
  }

  if (target.hasAttribute("data-trash-clear-selection")) {
    state.trashSelectedPhotoIds = [];
    render();
    return;
  }

  if (target.hasAttribute("data-restore-selected-photos")) {
    await restoreSelectedTrashPhotos();
    return;
  }

  if (target.hasAttribute("data-delete-selected-trash-photos")) {
    await deleteSelectedTrashPhotos();
    return;
  }

  if (target.id === "togglePushButton") {
    await togglePushNotifications();
    return;
  }

  if (target.id === "saveNativeServerButton") {
    try {
      const input = document.querySelector("#nativeServerUrlInput");
      const base = normalizeNativeServerBase(input?.value);
      localStorage.setItem(APP_SERVER_KEY, base);
      await load();
    } catch (error) {
      renderNativeServerSetup(error.message || "서버 주소를 저장하지 못했습니다.");
    }
    return;
  }

  if (target.id === "installAppButton") {
    if (!deferredInstallPrompt) {
      alert("브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해 주세요.");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    render();
    return;
  }

  if (target.dataset.smsTemplateSlot) {
    selectSmsTemplateSlot(target.dataset.smsTemplateTarget, target.dataset.smsTemplateSlot);
    return;
  }

  if (target.dataset.closeDialog) {
    document.querySelector(`#${target.dataset.closeDialog}`).close();
    return;
  }

  if (target.dataset.newKeepNote) {
    state.keepEditingId = "__new";
    state.keepEditingType = target.dataset.newKeepNote;
    render();
    return;
  }

  if (target.dataset.openKeepNote) {
    state.keepEditingId = target.dataset.openKeepNote;
    const note = (state.data.keepNotes || []).find((item) => item.id === state.keepEditingId);
    state.keepEditingType = note?.type || "text";
    render();
    return;
  }

  if (target.dataset.cancelKeepNote !== undefined) {
    state.keepEditingId = null;
    render();
    return;
  }

  if (target.dataset.deleteKeepNote) {
    if (!confirm("해당 메모를 삭제하시겠습니까?")) return;
    await deleteKeepNote(target.dataset.deleteKeepNote);
    return;
  }

  if (target.dataset.addCheckItem !== undefined) {
    addChecklistRow();
    return;
  }

  if (target.dataset.removeCheckItem !== undefined) {
    const row = target.closest("[data-check-row]");
    row?.remove();
    return;
  }

  if (target.dataset.moveCheck) {
    moveChecklistRow(target.closest("[data-check-row]"), Number(target.dataset.moveCheck));
    return;
  }

  if (target.dataset.orderType) {
    setOrderType(target.dataset.orderType);
    return;
  }

  if (target.dataset.productIndex) {
    setActiveProductIndex(Number(target.dataset.productIndex));
    return;
  }

  if (target.dataset.detailProductIndex) {
    state.detailProductIndex = Number(target.dataset.detailProductIndex) || 0;
    clearPhotoSelection();
    state.expandedPhotoId = null;
    render();
    return;
  }

  if (target.dataset.attendance) {
    await api("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ action: target.dataset.attendance }),
    });
    await load();
    return;
  }

  if (target.dataset.payrollUser) {
    state.attendancePayrollUserId = target.dataset.payrollUser;
    state.attendanceEditDay = new Date().getDate();
    render();
    return;
  }

  if (target.hasAttribute("data-close-payroll-modal")) {
    state.attendancePayrollUserId = null;
    state.attendanceEditDay = null;
    render();
    return;
  }

  if (target.dataset.editAttendanceDay) {
    state.attendanceEditDay = Number(target.dataset.editAttendanceDay) || null;
    render();
    scrollSelectedAttendanceDay();
    return;
  }

  if (target.dataset.deleteAttendanceDay) {
    const day = state.attendanceEditDay;
    if (!day) return;
    if (!confirm(`${day}일 근태 시간을 삭제할까요?`)) return;
    try {
      await deleteAttendanceDayTime(target.dataset.deleteAttendanceDay);
      render();
      scrollSelectedAttendanceDay();
    } catch (error) {
      alert(error.message || "근태 시간을 삭제하지 못했습니다.");
    }
    return;
  }

  if (target.dataset.payrollDeliveryChange) {
    const input = document.querySelector("#payrollDeliveryCount");
    if (input) input.value = String(Math.max(0, (Number(input.value) || 0) + Number(target.dataset.payrollDeliveryChange)));
    refreshPayrollPreview();
    return;
  }

  if (target.dataset.addPayrollAdjustment) {
    const list = document.querySelector(".payroll-adjustment-list");
    if (list) {
      list.insertAdjacentHTML("beforeend", `
        <div class="payroll-adjustment-row" data-payroll-adjustment-row data-adjustment-id="${Date.now()}">
          <select name="adjustmentType" aria-label="더하기 빼기">
            <option value="plus" selected>+</option>
            <option value="minus">-</option>
          </select>
          <input name="adjustmentTitle" placeholder="항목 입력">
          <input name="adjustmentAmount" type="number" inputmode="numeric" min="0" step="100" value="0" placeholder="금액">
          <button class="icon-button" type="button" data-remove-payroll-adjustment aria-label="삭제">×</button>
        </div>
      `);
    }
    refreshPayrollPreview();
    return;
  }

  if (target.hasAttribute("data-remove-payroll-adjustment")) {
    target.closest("[data-payroll-adjustment-row]")?.remove();
    refreshPayrollPreview();
    return;
  }

  if (target.dataset.saveHourlyWage) {
    const input = document.querySelector("#hourlyWageInput");
    await setHourlyWageForUser(target.dataset.saveHourlyWage, input?.value);
    await savePayrollSettingForUser(target.dataset.saveHourlyWage);
    await load();
    render();
    return;
  }

  if (target.id === "saveAdminMemosButton") {
    await saveAdminMemos();
    return;
  }

  if (target.dataset.chatOrder) {
    resetLightboxZoom();
    state.tab = target.dataset.chatPhoto ? "chat" : "work";
    state.selectedOrderId = target.dataset.chatOrder;
    state.selectedStep = target.dataset.chatStep || "all";
    state.smsTemplateSlots = {};
    state.smsMessageDrafts = {};
    state.customerShareMemo = "";
    state.detailProductIndex = 0;
    clearPhotoSelection();
    state.expandedPhotoId = target.dataset.chatPhoto || null;
    state.expandedPhotoReturnTab = target.dataset.chatPhoto ? "chat" : null;
    pushAppHistory();
    render();
    resetPageScroll();
    return;
  }

  if (target.dataset.cancelDoneOrderSelection !== undefined) {
    clearDoneOrderSelection();
    render();
    return;
  }

  if (target.dataset.batchShareTarget) {
    await batchShareOrders(target.dataset.batchShareTarget);
    return;
  }

  if (target.dataset.order) {
    if (state.tab === "done" && state.doneOrderSelectionMode) {
      toggleDoneOrderSelection(target.dataset.order);
      render();
      return;
    }
    if (state.suppressDoneOrderTap) {
      state.suppressDoneOrderTap = false;
      return;
    }
    resetLightboxZoom();
    state.selectedOrderId = target.dataset.order;
    state.selectedStep = "all";
    state.smsTemplateSlots = {};
    state.smsMessageDrafts = {};
    state.customerShareMemo = "";
    state.detailProductIndex = 0;
    clearPhotoSelection();
    state.expandedPhotoId = null;
    pushAppHistory();
    render();
    resetPageScroll();
    return;
  }

  if (target.dataset.quickShareOrder) {
    event.preventDefault();
    event.stopPropagation();
    const currentDoneFilter = state.filter;
    const order = state.data.orders.find((item) => item.id === target.dataset.quickShareOrder);
    if (!order) return;
    const updated = await shareOrder(order, target.dataset.quickShareTarget, { hiddenPhotoIds: [] });
    if (!updated) return;
    replaceOrderInState(updated);
    state.tab = "done";
    state.filter = currentDoneFilter;
    state.selectedOrderId = null;
    render();
    return;
  }

  if (target.dataset.quickPrevious) {
    await quickMoveOrder(target.dataset.quickPrevious, "previous");
    return;
  }

  if (target.dataset.quickSpecial) {
    await quickEditSpecialMemo(target.dataset.quickSpecial);
    return;
  }

  if (target.dataset.quickComplete) {
    await quickCompleteOrder(target.dataset.quickComplete);
    return;
  }

  if (target.dataset.finalComplete) {
    await finalCompleteOrder(target.dataset.finalComplete);
    return;
  }

  if (target.dataset.quickNext) {
    await quickMoveOrder(target.dataset.quickNext, "next");
    return;
  }

  if (target.dataset.quickStep) {
    await quickSetOrderStep(target.dataset.quickStep, target.dataset.stepCode);
    return;
  }

  if (target.dataset.quickCamera) {
    await quickCameraOrder(target.dataset.quickCamera);
    return;
  }

  if (target.dataset.filter) {
    state.filter = target.dataset.filter;
    refreshFilterButtons();
    refreshOrderList();
    replaceAppHistory();
    return;
  }

  if (target.dataset.listTypeFilter) {
    state.listTypeFilter = normalizeListTypeFilter(target.dataset.listTypeFilter);
    refreshFilterButtons();
    refreshOrderList();
    replaceAppHistory();
    return;
  }

  if (target.dataset.dateSort) {
    setActiveDateSort(target.dataset.dateSort);
    replaceAppHistory();
    render();
    return;
  }

  if (target.dataset.toggleToolbar !== undefined) {
    state.toolbarCollapsed = !state.toolbarCollapsed;
    replaceAppHistory();
    render();
    return;
  }

  if (target.dataset.step) {
    const scrollPosition = currentScrollPosition();
    target.blur();
    state.selectedStep = target.dataset.step;
    clearPhotoSelection();
    state.expandedPhotoId = null;
    pushAppHistory();
    render();
    restoreScrollPosition(scrollPosition);
    return;
  }

  if (target.dataset.photoGridColumns) {
    const columns = Number(target.dataset.photoGridColumns);
    if ([1, 2, 3].includes(columns)) {
      state.photoGridColumns = columns;
      render();
    }
    return;
  }

  if (target.id === "addOrderButton") {
    setOrderType(state.orderType || "A");
    orderDialog.showModal();
  }
  if (target.id === "logoutButton") {
    localStorage.removeItem("bebeu.currentUserId");
    localStorage.removeItem(VIEW_STATE_KEY);
    state.currentUserId = "";
    state.pendingAdminLoginUserId = null;
    state.adminLoginError = "";
    state.passwordChangeOpen = false;
    state.passwordChangeMessage = "";
    applyUserAppearance();
    state.selectedOrderId = null;
    clearPhotoSelection();
    state.expandedPhotoId = null;
    replaceAppHistory();
    render();
    return;
  }
  if (target.id === "togglePasswordChangeButton") {
    state.passwordChangeOpen = !state.passwordChangeOpen;
    state.passwordChangeMessage = "";
    render();
    requestAnimationFrame(() => document.querySelector("#adminPasswordForm input[name='currentPassword']")?.focus());
    return;
  }
  if (target.id === "backToList") {
    state.selectedOrderId = null;
    state.smsTemplateSlots = {};
    state.smsMessageDrafts = {};
    state.customerShareMemo = "";
    clearPhotoSelection();
    state.expandedPhotoId = null;
    pushAppHistory();
    render();
  }
  if (target.id === "openPhotoButton") openPhotoDialog();
  if (target.dataset.addCompletedPhoto) {
    state.selectedStep = target.dataset.addCompletedPhoto;
    openPhotoDialog();
    return;
  }
  if (target.id === "startPhotoDeleteSelectionButton") {
    state.photoSelectionMode = true;
    syncPhotoSelectionModeClass();
    pushAppHistory();
    render();
    return;
  }
  if (target.id === "cancelPhotoSelectionButton") {
    clearPhotoSelection();
    render();
    return;
  }
  if (target.id === "deleteSelectedPhotosButton") {
    await deleteSelectedPhotos();
    return;
  }
  if (target.id === "editOrderButton") openEditOrderDialog();
  if (target.id === "deleteOrderButton") await deleteOrder();
  if (target.id === "detailCompleteButton") await quickCompleteOrder(state.selectedOrderId);
  if (target.dataset.photoNavigate) {
    navigateExpandedPhoto(target.dataset.photoNavigate);
    return;
  }
  if (target.id === "nextStepButton") await nextStep();
  if (target.id === "previousStepButton") await previousStep();
  if (target.dataset.pinPhoto) {
    await pinPhotos([target.dataset.pinPhoto], target.dataset.pinned !== "true");
    return;
  }
  if (target.id === "pinSelectedPhotos") {
    await pinPhotos([...state.selectedPhotoIds], true);
    return;
  }
  if (target.id === "unpinSelectedPhotos") {
    await pinPhotos([...state.selectedPhotoIds], false);
    return;
  }
  if (target.dataset.deletePhoto) await deletePhotos(target.dataset.deletePhoto);
  if (target.dataset.removePendingPhoto) removePendingPhoto(Number(target.dataset.removePendingPhoto));

  if (target.dataset.share) {
    event.preventDefault();
    event.stopPropagation();
    const order = state.data.orders.find((item) => item.id === state.selectedOrderId);
    const updated = await shareOrder(order, target.dataset.share);
    if (!updated) return;
    replaceOrderInState(updated);
    state.tab = "done";
    state.filter = "done-ready";
    state.selectedOrderId = updated.id || order.id;
    state.selectedStep = updated.currentStep || state.selectedStep;
    render();
  }
  if (target.dataset.naverCafePost) {
    await postOrderToNaverCafe(target.dataset.naverCafePost);
    return;
  }
  if (target.dataset.naverCafeTest !== undefined) {
    await testNaverCafePost(target.dataset.naverCafeTest || "");
    return;
  }
  if (target.dataset.naverCafeAutomationLogin !== undefined) {
    await openNaverCafeAutomationLogin();
    return;
  }
}

async function shareOrder(order, target, options = {}) {
  const isCustomerUrl = target === "customer";
  const customerMemo = document.querySelector("#customerShareMemo")?.value?.trim() || "";
  const smsMessage = document.querySelector(`[data-sms-message-target="${target}"]`)?.value?.trim() || "";
  const hiddenPhotoIds = Array.isArray(options.hiddenPhotoIds) ? options.hiddenPhotoIds : state.selectedPhotoIds;
  const customerTemplateMemo = savedSmsTemplateMessage("customer-url", buildShareMessage(order));
  try {
    setGlobalLoading("보내는 중...");
    await waitForPaint();
    let url = "";
    if (isCustomerUrl) {
      const link = await api(`/api/orders/${order.id}/share-link`, {
        method: "POST",
        body: JSON.stringify({ hiddenPhotoIds, customerMemo: customerMemo || customerTemplateMemo }),
      });
      const shareUrl = new URL(link.path, configuredServerBase());
      shareUrl.searchParams.set("v", CUSTOMER_SHARE_CACHE_VERSION);
      url = shareUrl.toString();
    }
    const text = isCustomerUrl
      ? `${customerMemo || customerTemplateMemo}\n${url}`
      : smsMessage || savedSmsTemplateMessage(target, smsShareOptions(order).find((option) => option.target === target)?.message || buildSmsMessage(order));
    await shareDirectly({ text });
    if (isCustomerUrl) {
      if (customerMemo) saveSelectedSmsTemplate("customer-url", customerMemo);
    }
    else saveSelectedSmsTemplate(target, text);
    const result = await api(`/api/orders/${order.id}/share`, {
      method: "POST",
      body: JSON.stringify({ target }),
    });
    showToast("완료되었습니다.");
    return result.order;
  } catch (error) {
    if (error.name !== "AbortError") {
      alert(error.message || "공유 내용을 전달하지 못했습니다.");
    }
    return null;
  } finally {
    setGlobalLoading("");
  }
}

function resolveBatchShareTarget(order, target) {
  if (target !== "auto-before") return target;
  return ["B", "AB"].includes(orderListType(order)) ? "sms-pickup" : "sms-before";
}

function batchShareTextForOrder(order, target, url = "", customerMemo = "") {
  const resolvedTarget = resolveBatchShareTarget(order, target);
  const header = `[${order.serial || "품목"}]`;
  if (resolvedTarget === "customer") {
    return `${header}\n${customerMemo || savedSmsTemplateMessage("customer-url", buildShareMessage(order))}\n${url}`.trim();
  }
  const kind = resolvedTarget === "sms-pickup" ? "pickup" : resolvedTarget === "sms-after" ? "after" : "before";
  return `${header}\n${savedSmsTemplateMessage(resolvedTarget, buildSmsMessage(order, kind))}`.trim();
}

async function batchShareOrders(target) {
  const orders = selectedDoneOrders().filter((order) => {
    if (target !== "sms-after") return true;
    return !["B", "AB"].includes(orderListType(order));
  });
  if (!orders.length) return;
  try {
    setGlobalLoading("보내는 중...");
    await waitForPaint();
    const chunks = [];
    for (const order of orders) {
      const resolvedTarget = resolveBatchShareTarget(order, target);
      const customerMemo = resolvedTarget === "customer" ? savedSmsTemplateMessage("customer-url", buildShareMessage(order)) : "";
      let url = "";
      if (resolvedTarget === "customer") {
        const link = await api(`/api/orders/${order.id}/share-link`, {
          method: "POST",
          body: JSON.stringify({ hiddenPhotoIds: [], customerMemo }),
        });
        const shareUrl = new URL(link.path, configuredServerBase());
        shareUrl.searchParams.set("v", CUSTOMER_SHARE_CACHE_VERSION);
        url = shareUrl.toString();
      }
      chunks.push(batchShareTextForOrder(order, resolvedTarget, url, customerMemo));
    }
    await shareDirectly({ text: chunks.join("\n\n----------\n\n") });
    for (const order of orders) {
      const resolvedTarget = resolveBatchShareTarget(order, target);
      const result = await api(`/api/orders/${order.id}/share`, {
        method: "POST",
        body: JSON.stringify({ target: resolvedTarget }),
      });
      if (result.order) replaceOrderInState(result.order);
    }
    clearDoneOrderSelection();
    showToast("완료되었습니다.");
    render();
  } catch (error) {
    if (error.name !== "AbortError") {
      alert(error.message || "공유 내용을 전달하지 못했습니다.");
    }
  } finally {
    setGlobalLoading("");
  }
}

async function shareDirectly({ text }) {
  if (!navigator.share) {
    throw new Error("이 브라우저에서는 공유 선택창을 열 수 없습니다. 다른 브라우저 또는 홈 화면 앱에서 다시 시도해주세요.");
  }
  await navigator.share({ text });
}

async function postOrderToNaverCafe(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  const posted = order.cafeStatus === "카페완료";
  const message = posted
    ? `${order.serial} 항목은 이미 카페 업로드 완료 상태입니다.\n다시 업로드할까요?`
    : `${order.serial} 항목을 네이버 카페에 업로드할까요?`;
  if (!confirm(message)) return;
  const button = document.querySelector(`[data-naver-cafe-post="${CSS.escape(order.id)}"]`);
  try {
    if (button) button.disabled = true;
    setGlobalLoading("업로드 중...");
    const result = await api(`/api/orders/${order.id}/naver-cafe`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    replaceOrderInState(result.order);
    refreshOrderList();
    showToast("완료되었습니다.");
  } catch (error) {
    showToast("업로드 요청을 보냈습니다.");
    await load();
  } finally {
    setGlobalLoading("");
    if (button) button.disabled = false;
  }
}

async function openNaverCafeAutomationLogin() {
  try {
    setGlobalLoading("브라우저 여는 중...");
    await waitForPaint();
    const result = await api("/api/naver-cafe/automation-login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    showToast("네이버 로그인 브라우저를 열었습니다.");
    alert(result.message || "네이버 로그인 브라우저를 열었습니다. 로그인을 완료한 뒤 다시 업로드해주세요.");
  } catch (error) {
    alert(error.message || "자동화 로그인 브라우저를 열지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
}

async function testNaverCafePost() {
  if (!confirm("네이버 카페에 인코딩 비교 테스트 글을 작성해볼까요?")) return;
  try {
    const result = await api("/api/naver-cafe/test", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const test = result.test || {};
    alert([
      "네이버 카페 테스트 글쓰기 성공",
      test.encodingMode ? `전송 방식: ${test.encodingMode}` : "",
      test.articleUrl ? `URL: ${test.articleUrl}` : "",
      `HTTP: ${test.httpStatus || ""} ${test.httpStatusText || ""}`.trim(),
      `카페/게시판: ${test.clubId || ""} / ${test.menuId || ""}`,
      test.subject ? `제목: ${test.subject}` : "",
    ].filter(Boolean).join("\n"));
  } catch (error) {
    alert(formatNaverCafeUploadError(error));
  }
}

function formatNaverCafeUploadError(error) {
  const details = error?.details;
  if (!details) return error?.message || "네이버 카페 업로드에 실패했습니다.";
  return [
    error.message || "네이버 카페 업로드에 실패했습니다.",
    "",
    "[상세 정보]",
    `HTTP: ${details.httpStatus || ""} ${details.httpStatusText || ""}`.trim(),
    details.naverStatus ? `Naver status: ${details.naverStatus}` : "",
    details.naverCode ? `Naver code: ${details.naverCode}` : "",
    details.naverMessage ? `Naver message: ${details.naverMessage}` : "",
    details.attemptMode ? `시도 방식: ${details.attemptMode}` : "",
    `카페/게시판: ${details.clubId || ""} / ${details.menuId || ""}`,
    details.subject ? `제목: ${details.subject}` : "",
    Number.isFinite(Number(details.subjectLength)) ? `제목 길이: ${details.subjectLength}자` : "",
    Number.isFinite(Number(details.contentLength)) ? `본문 길이: ${details.contentLength}자` : "",
    Number.isFinite(Number(details.attachedPhotoCount)) ? `첨부 사진: ${details.attachedPhotoCount}장 / 전체 ${details.totalPhotoCount || 0}장` : "",
    details.hint ? `확인 필요: ${details.hint}` : "",
    details.raw ? `원문: ${details.raw}` : "",
  ].filter(Boolean).join("\n");
}

function formatNaverCafeUploadError(error) {
  const details = error?.details;
  if (!details) return error?.message || "네이버 카페 업로드에 실패했습니다.";
  return [
    error.message || "네이버 카페 업로드에 실패했습니다.",
    "",
    "[상세 정보]",
    `HTTP: ${details.httpStatus || ""} ${details.httpStatusText || ""}`.trim(),
    details.naverStatus ? `Naver status: ${details.naverStatus}` : "",
    details.naverCode ? `Naver code: ${details.naverCode}` : "",
    details.naverMessage ? `Naver message: ${details.naverMessage}` : "",
    details.attemptMode ? `시도 방식: ${details.attemptMode}` : "",
    `카페/게시판: ${details.clubId || ""} / ${details.menuId || ""}`,
    details.subject ? `제목: ${details.subject}` : "",
    Number.isFinite(Number(details.subjectLength)) ? `제목 길이: ${details.subjectLength}자` : "",
    Number.isFinite(Number(details.contentLength)) ? `본문 길이: ${details.contentLength}자` : "",
    Number.isFinite(Number(details.attachedPhotoCount)) ? `첨부 사진: ${details.attachedPhotoCount}장 / 전체 ${details.totalPhotoCount || 0}장` : "",
    details.hint ? `확인 필요: ${details.hint}` : "",
    details.raw ? `원문: ${details.raw}` : "",
  ].filter(Boolean).join("\n");
}

async function saveAdminMemos() {
  const memberMemos = {};
  document.querySelectorAll("[data-admin-member-memo]").forEach((textarea) => {
    memberMemos[textarea.dataset.adminMemberMemo] = textarea.value;
  });
  await api("/api/admin-memos", {
    method: "POST",
    body: JSON.stringify({
      globalMemo: document.querySelector("#globalAdminMemo")?.value || "",
      memberMemos,
    }),
  });
  await load();
  alert("관리자 메모를 저장했습니다.");
}

function addChecklistRow() {
  const list = document.querySelector(".keep-checklist-editor");
  if (!list) return;
  list.insertAdjacentHTML("beforeend", renderChecklistRow({ id: "", text: "", done: false }, list.children.length, true));
}

function moveChecklistRow(row, direction) {
  if (!row || !direction) return;
  if (direction < 0 && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
  if (direction > 0 && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
}

function collectKeepNotePayload(form) {
  const type = form.dataset.keepType || "text";
  const collaborators = [];
  document.querySelectorAll("[data-keep-collaborator]:checked").forEach((checkbox) => {
    const userId = checkbox.dataset.keepCollaborator;
    const permission = document.querySelector(`[data-keep-permission="${CSS.escape(userId)}"]`)?.value || "view";
    collaborators.push({ userId, permission });
  });
  const items = Array.from(form.querySelectorAll("[data-check-row]")).map((row) => ({
    id: row.querySelector('[name="checkId"]')?.value || "",
    text: row.querySelector('[name="checkText"]')?.value?.trim() || "",
    done: Boolean(row.querySelector('[name="checkDone"]')?.checked),
  })).filter((item) => item.text);
  return {
    type,
    title: form.elements.title?.value?.trim() || "",
    body: type === "checklist" ? "" : form.elements.body?.value?.trim() || "",
    items: type === "checklist" ? items : [],
    pinned: Boolean(form.elements.pinned?.checked),
    collaborators,
  };
}

async function saveKeepNote(form) {
  const id = form.dataset.keepId;
  const payload = collectKeepNotePayload(form);
  const method = id ? "PATCH" : "POST";
  const path = id ? `/api/keep-notes/${id}` : "/api/keep-notes";
  await api(path, { method, body: JSON.stringify(payload) });
  state.keepEditingId = null;
  await load();
}

async function deleteKeepNote(id) {
  await api(`/api/keep-notes/${id}`, { method: "DELETE" });
  state.keepEditingId = null;
  await load();
}

async function toggleOrderUrgent(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  const result = await api(`/api/orders/${orderId}/urgent`, {
    method: "POST",
    body: JSON.stringify({ urgent: !order.urgent }),
  });
  replaceOrderInState(result.order);
  if (state.selectedOrderId === orderId) {
    render();
    return;
  }
  refreshOrderList();
}

async function toggleOrderTodayTask(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  const requestMemo = updateOrderTodayTaskText(order.requestMemo, !orderTodayTaskChecked(order));
  const result = await api(`/api/orders/${order.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      serial: order.serial || "",
      customerName: order.customerName || null,
      phone: order.phone || null,
      address: order.address || null,
      productType: order.productType || null,
      brand: order.brand || null,
      modelName: order.modelName || null,
      requestMemo: requestMemo || null,
    }),
  });
  replaceOrderInState(result.order);
  if (state.selectedOrderId === orderId) {
    render();
    return;
  }
  refreshOrderList();
}

function toggleTrashPhotoSelection(photoId) {
  if (!photoId) return;
  state.trashSelectedPhotoIds = state.trashSelectedPhotoIds.includes(photoId)
    ? state.trashSelectedPhotoIds.filter((id) => id !== photoId)
    : [...state.trashSelectedPhotoIds, photoId];
  render();
}

async function restoreTrashOrder(orderId) {
  if (!orderId) return;
  try {
    const result = await api(`/api/trash/orders/${orderId}/restore`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.order) replaceOrderInState(result.order);
    if (result.trash) state.data.trash = result.trash;
    render();
  } catch (error) {
    alert(error.message || "항목을 복구하지 못했습니다.");
  }
}

async function restoreSelectedTrashPhotos() {
  const photoIds = [...new Set(state.trashSelectedPhotoIds)].filter(Boolean);
  if (!photoIds.length) return;
  try {
    const result = await api("/api/trash/photos/restore", {
      method: "POST",
      body: JSON.stringify({ photoIds }),
    });
    if (Array.isArray(result.orders)) state.data.orders = result.orders;
    if (result.trash) state.data.trash = result.trash;
    state.trashSelectedPhotoIds = [];
    state.trashExpandedPhotoId = null;
    resetLightboxZoom();
    render();
  } catch (error) {
    alert(error.message || "사진을 복구하지 못했습니다.");
  }
}

async function deleteSelectedTrashPhotos() {
  const photoIds = [...new Set(state.trashSelectedPhotoIds)].filter(Boolean);
  if (!photoIds.length) return;
  const ok = confirm(`선택한 사진 ${photoIds.length}장을 완전히 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`);
  if (!ok) return;
  try {
    const result = await api("/api/trash/photos/delete", {
      method: "POST",
      body: JSON.stringify({ photoIds }),
    });
    if (result.trash) state.data.trash = result.trash;
    state.trashSelectedPhotoIds = [];
    state.trashExpandedPhotoId = null;
    resetLightboxZoom();
    render();
  } catch (error) {
    alert(error.message || "사진을 완전히 삭제하지 못했습니다.");
  }
}

function confirmStepMove(direction) {
  return confirm(direction === "previous" ? "이전 단계로 이동하시겠습니까?" : "다음 단계로 이동하시겠습니까?");
}

async function quickMoveOrder(orderId, direction) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  if (!confirmStepMove(direction)) return;
  const endpoint = direction === "previous" ? "previous" : "confirm";
  const body = direction === "previous" ? {} : { stepCode: order.currentStep, memo: order.stepMemos?.[order.currentStep] || "" };
  const result = await api(`/api/orders/${order.id}/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  replaceOrderInState(result.order);
  state.selectedOrderId = null;
  clearPhotoSelection();
  state.expandedPhotoId = null;
  render();
}

async function quickSetOrderStep(orderId, stepCode) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order || !stepCode || order.currentStep === stepCode) return;
  const stepLabel = stepName(stepCode);
  if (!confirm(`${order.serial} 상태를 ${stepLabel}(으)로 변경하시겠습니까?`)) return;
  const result = await api(`/api/orders/${order.id}/step`, {
    method: "POST",
    body: JSON.stringify({ stepCode }),
  });
  replaceOrderInState(result.order);
  state.selectedOrderId = null;
  clearPhotoSelection();
  state.expandedPhotoId = null;
  refreshOrderList();
}

async function quickCompleteOrder(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  if (!confirm(`${order.serial} 항목을 완료로 이동하시겠습니까?`)) return;
  const result = await api(`/api/orders/${order.id}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  replaceOrderInState(result.order);
  state.selectedOrderId = null;
  clearPhotoSelection();
  state.expandedPhotoId = null;
  refreshOrderList();
}

async function finalCompleteOrder(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  if (!confirm(`${order.serial} 항목을 문자전송 완료로 변경할까요?`)) return;
  const result = await api(`/api/orders/${order.id}/share`, {
    method: "POST",
    body: JSON.stringify({ target: "sms-final" }),
  });
  replaceOrderInState(result.order);
  state.selectedOrderId = null;
  state.filter = "sms-done";
  clearPhotoSelection();
  state.expandedPhotoId = null;
  refreshOrderList();
  refreshFilterButtons();
}

async function quickEditSpecialMemo(orderId) {
  await quickEditMemoField(orderId, "important");
}

async function quickEditMemoField(orderId, field) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  const labels = { important: "중요", today: "오늘 할일", accessories: "부속품" };
  const normalizedField = labels[field] ? field : "important";
  const currentMemo = orderMemoFieldValue(order, normalizedField);
  const nextMemo = prompt(`${labels[normalizedField]} 내용을 입력해 주세요.`, currentMemo);
  if (nextMemo === null) return;
  const requestMemo = updateOrderMemoFieldText(order.requestMemo, normalizedField, nextMemo);
  const result = await api(`/api/orders/${order.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      serial: order.serial || "",
      customerName: order.customerName || null,
      phone: order.phone || null,
      address: order.address || null,
      productType: order.productType || null,
      brand: order.brand || null,
      modelName: order.modelName || null,
      requestMemo: requestMemo || null,
    }),
  });
  replaceOrderInState(result.order);
  if (state.selectedOrderId === order.id) {
    render();
    return;
  }
  refreshOrderList();
}

async function quickCameraOrder(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  state.quickListPhotoOrderId = order.id;
  state.selectedStep = order.currentStep;
  state.detailProductIndex = 0;
  state.quickPhotoAdvance = true;
  openPhotoDialog({ quick: true, listQuick: true });
}

async function nextStep() {
  const order = state.data.orders.find((item) => item.id === state.selectedOrderId);
  const wasDoneTab = state.tab === "done";
  const stepToMove = order.currentStep || state.selectedStep;
  if (!confirmStepMove("next")) return;
  const memo = state.selectedStep === stepToMove ? document.querySelector("#stepMemo")?.value || "" : order.stepMemos[stepToMove] || "";
  const result = await api(`/api/orders/${order.id}/confirm`, {
    method: "POST",
    body: JSON.stringify({ stepCode: stepToMove, memo }),
  });
  replaceOrderInState(result.order);
  const updated = result.order;
  if (updated.status === "완료") {
    state.tab = "done";
    state.selectedOrderId = wasDoneTab ? updated.id : null;
    state.selectedStep = updated.currentStep;
    state.filter = "done-ready";
    state.listTypeFilter = "all";
  } else {
    state.selectedOrderId = updated.id;
    state.selectedStep = updated.currentStep;
  }
  clearPhotoSelection();
  state.expandedPhotoId = null;
  pushAppHistory();
  render();
}

async function previousStep() {
  const order = state.data.orders.find((item) => item.id === state.selectedOrderId);
  if (!confirmStepMove("previous")) return;
  const result = await api(`/api/orders/${order.id}/previous`, { method: "POST", body: JSON.stringify({}) });
  replaceOrderInState(result.order);
  const updated = result.order;
  state.tab = updated.status === "완료" ? "done" : "work";
  state.filter = state.tab === "done" ? "done-ready" : "all";
  state.listTypeFilter = "all";
  state.selectedOrderId = updated.id;
  state.selectedStep = updated.currentStep;
  clearPhotoSelection();
  state.expandedPhotoId = null;
  pushAppHistory();
  render();
}

async function deletePhotos(photoId, options = {}) {
  const order = state.data.orders.find((item) => item.id === state.selectedOrderId);
  const photoIds = state.photoSelectionMode && state.selectedPhotoIds.length ? state.selectedPhotoIds : [photoId];
  const message = photoIds.length === 1 ? "해당 사진을 휴지통으로 이동할까요?" : `선택한 사진 ${photoIds.length}장을 휴지통으로 이동할까요?`;
  if (!options.skipConfirm && !confirm(message)) return;

  try {
    const result = await api(`/api/orders/${order.id}/photo-delete`, {
      method: "POST",
      body: JSON.stringify({ photoIds }),
    });
    state.selectedPhotoIds = [];
    state.photoSelectionMode = false;
    syncPhotoSelectionModeClass();
    replaceOrderInState(result.order);
    if (result.trash) state.data.trash = result.trash;
    const updated = result.order;
    state.selectedOrderId = updated?.id || null;
    render();
  } catch (error) {
    alert(error.message || "사진을 휴지통으로 이동하지 못했습니다.");
  }
}

async function deleteSelectedPhotos() {
  if (!state.selectedPhotoIds.length) return;
  if (!confirm("선택된 사진들을 삭제하시겠습니까?\n삭제된 사진은 휴지통으로 이동됩니다.")) return;
  await deletePhotos(state.selectedPhotoIds[0], { skipConfirm: true });
}

async function pinPhotos(photoIds, pinned) {
  const order = selectedOrder();
  if (!order || !photoIds.length) return;
  try {
    const result = await api(`/api/orders/${order.id}/photo-pin`, {
      method: "POST",
      body: JSON.stringify({ photoIds, pinned }),
    });
    replaceOrderInState(result.order);
    clearPhotoSelection();
    state.expandedPhotoId = null;
    render();
  } catch (error) {
    alert(error.message || "사진 고정 상태를 변경하지 못했습니다.");
  }
}

async function setRepresentativePhoto(photoId) {
  const order = selectedOrder();
  if (!order || !photoId) return;
  const otherPinnedPhotoIds = (order.photos || [])
    .filter((photo) => photo.id !== photoId && photo.pinned)
    .map((photo) => photo.id);
  try {
    if (otherPinnedPhotoIds.length) {
      const unpinResult = await api(`/api/orders/${order.id}/photo-pin`, {
        method: "POST",
        body: JSON.stringify({ photoIds: otherPinnedPhotoIds, pinned: false }),
      });
      replaceOrderInState(unpinResult.order);
    }
    const result = await api(`/api/orders/${order.id}/photo-pin`, {
      method: "POST",
      body: JSON.stringify({ photoIds: [photoId], pinned: true }),
    });
    replaceOrderInState(result.order);
    clearPhotoSelection();
    state.expandedPhotoId = null;
    render();
  } catch (error) {
    alert(error.message || "대표 사진을 지정하지 못했습니다.");
  }
}

async function deleteOrder() {
  const order = selectedOrder();
  if (!order) return;
  const ok = confirm(`${order.serial} 항목을 휴지통으로 이동할까요?\n설정의 휴지통에서 다시 복구할 수 있습니다.`);
  if (!ok) return;
  const result = await api(`/api/orders/${order.id}`, { method: "DELETE" });
  if (result.trash) state.data.trash = result.trash;
  state.selectedOrderId = null;
  clearPhotoSelection();
  state.expandedPhotoId = null;
  removeOrderFromState(order.id);
  render();
}

function togglePhotoSelection(photoId) {
  const selected = state.selectedPhotoIds.includes(photoId);
  state.selectedPhotoIds = selected
    ? state.selectedPhotoIds.filter((id) => id !== photoId)
    : [...state.selectedPhotoIds, photoId];
  state.photoSelectionMode = state.photoSelectionMode || state.selectedPhotoIds.length > 0;
  syncPhotoSelectionModeClass();
  render();
}

function setPhotoSelection(photoId, selected) {
  const exists = state.selectedPhotoIds.includes(photoId);
  if (selected && !exists) state.selectedPhotoIds = [...state.selectedPhotoIds, photoId];
  if (!selected && exists) state.selectedPhotoIds = state.selectedPhotoIds.filter((id) => id !== photoId);
  state.photoSelectionMode = state.photoSelectionMode || state.selectedPhotoIds.length > 0;
  syncPhotoSelectionModeClass();
}

function syncPhotoSelectionModeClass() {
  document.body?.classList.toggle("is-photo-selection-mode", Boolean(state.photoSelectionMode));
}

function refreshPhotoSelectionUi() {
  const selected = new Set(state.selectedPhotoIds);
  document.querySelectorAll("[data-photo-card]").forEach((card) => {
    const isSelected = selected.has(card.dataset.photoCard);
    card.classList.toggle("is-selected", isSelected);
    card.classList.toggle("is-excluded", isSelected);
    const mark = card.querySelector(".photo-select-mark");
    if (mark) mark.textContent = isSelected ? "✓" : "";
  });
  const selectionBar = document.querySelector(".photo-selection-bar");
  if (selectionBar) {
    const count = state.selectedPhotoIds.length;
    const countLabel = selectionBar.querySelector("span");
    const deleteButton = selectionBar.querySelector("#deleteSelectedPhotosButton");
    if (countLabel) countLabel.textContent = `선택 ${count}장`;
    if (deleteButton) deleteButton.disabled = count === 0;
  }
}

function clearPhotoSelection() {
  state.selectedPhotoIds = [];
  state.photoSelectionMode = false;
  state.photoDragSelection = null;
  clearTimeout(state.photoPressTimer);
  state.photoPressTimer = null;
  syncPhotoSelectionModeClass();
}

function clearDoneOrderSelection() {
  state.selectedDoneOrderIds = [];
  state.doneOrderSelectionMode = false;
  clearTimeout(state.orderPressTimer);
  state.orderPressTimer = null;
}

function toggleDoneOrderSelection(orderId) {
  if (!orderId) return;
  const selected = state.selectedDoneOrderIds.includes(orderId);
  state.selectedDoneOrderIds = selected
    ? state.selectedDoneOrderIds.filter((id) => id !== orderId)
    : [...state.selectedDoneOrderIds, orderId];
  state.doneOrderSelectionMode = state.selectedDoneOrderIds.length > 0;
}

function selectedOrder() {
  return state.data?.orders.find((item) => item.id === state.selectedOrderId) || null;
}

function isCompletedDetail() {
  return selectedOrder()?.status === "완료";
}

function handleDoneOrderPointerDown(event) {
  if (state.tab !== "done" || state.selectedOrderId) return;
  const card = event.target.closest("[data-order-card-id]");
  if (!card || event.target.closest("button, input, textarea, select, a")) return;
  if (state.doneOrderSelectionMode) return;
  clearTimeout(state.orderPressTimer);
  state.orderPressTimer = setTimeout(() => {
    state.suppressDoneOrderTap = true;
    state.doneOrderSelectionMode = true;
    state.selectedDoneOrderIds = [card.dataset.orderCardId];
    state.orderPressTimer = null;
    if (navigator.vibrate) navigator.vibrate(20);
    render();
  }, 550);
}

function handleDoneOrderPointerEnd() {
  clearTimeout(state.orderPressTimer);
  state.orderPressTimer = null;
}

function handlePhotoPointerDown(event) {
  const card = event.target.closest("[data-photo-card]");
  if (!card || event.target.closest("button")) return;
  if (state.photoSelectionMode) {
    event.preventDefault();
    event.stopPropagation();
    const selected = state.selectedPhotoIds.includes(card.dataset.photoCard);
    card.setPointerCapture?.(event.pointerId);
    state.photoDragSelection = {
      pointerId: event.pointerId,
      selected: !selected,
      touched: new Set([card.dataset.photoCard]),
    };
    state.suppressPhotoTap = true;
    setPhotoSelection(card.dataset.photoCard, !selected);
    refreshPhotoSelectionUi();
    return;
  }
  clearTimeout(state.photoPressTimer);
  state.photoPressTimer = setTimeout(async () => {
    state.suppressPhotoTap = true;
    if (isCompletedDetail()) togglePhotoSelection(card.dataset.photoCard);
    else await setRepresentativePhoto(card.dataset.photoCard);
    state.photoPressTimer = null;
  }, 550);
}

function handlePhotoPointerEnd() {
  clearTimeout(state.photoPressTimer);
  state.photoPressTimer = null;
  state.photoDragSelection = null;
}

function navigateExpandedPhoto(direction) {
  if (state.chatExpandedAttachmentId) return navigateChatExpandedAttachment(direction);
  if (state.trashExpandedPhotoId) return navigateTrashExpandedPhoto(direction);
  const order = selectedOrder();
  if (!order || !state.expandedPhotoId) return false;
  const photos = expandedPhotoList(order);
  const index = photos.findIndex((photo) => photo.id === state.expandedPhotoId);
  if (index < 0) return false;
  const nextIndex = direction === "previous" ? index - 1 : index + 1;
  if (!photos[nextIndex]) return false;
  state.expandedPhotoId = photos[nextIndex].id;
  resetLightboxZoom();
  render();
  return true;
}

function navigateTrashExpandedPhoto(direction) {
  const photos = trashPhotoList();
  const index = photos.findIndex((photo) => photo.id === state.trashExpandedPhotoId);
  if (index < 0) return false;
  const nextIndex = direction === "previous" ? index - 1 : index + 1;
  if (!photos[nextIndex]) return false;
  state.trashExpandedPhotoId = photos[nextIndex].id;
  resetLightboxZoom();
  render();
  return true;
}

function navigateChatExpandedAttachment(direction) {
  const attachments = chatAttachmentList();
  const index = attachments.findIndex((attachment) => attachment.id === state.chatExpandedAttachmentId);
  if (index < 0) return false;
  const nextIndex = direction === "previous" ? index - 1 : index + 1;
  if (!attachments[nextIndex]) return false;
  state.chatExpandedAttachmentId = attachments[nextIndex].id;
  resetLightboxZoom();
  render();
  return true;
}

function handleLightboxPointerDown(event) {
  const lightbox = event.target.closest("[data-expanded-photo-view]");
  if (!lightbox) return;
  state.lightboxPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  state.lightboxSwipeStart = state.lightboxZoom.scale > 1 ? null : { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  if (state.lightboxZoom.scale > 1) {
    state.lightboxZoom.isPanning = true;
    state.lightboxZoom.lastX = event.clientX;
    state.lightboxZoom.lastY = event.clientY;
    state.lightboxZoom.startPanX = state.lightboxZoom.panX || 0;
    state.lightboxZoom.startPanY = state.lightboxZoom.panY || 0;
  }
  lightbox.setPointerCapture?.(event.pointerId);
  if (state.lightboxPointers.size === 2) {
    state.lightboxSwipeStart = null;
    state.lightboxZoom.isPanning = false;
    state.lightboxZoom.startDistance = lightboxPointerDistance();
    state.lightboxZoom.baseScale = state.lightboxZoom.scale || 1;
  }
}

function handleLightboxPointerMove(event) {
  if (!state.lightboxPointers.has(event.pointerId)) return;
  state.lightboxPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.lightboxPointers.size === 1 && state.lightboxZoom.isPanning && state.lightboxZoom.scale > 1) {
    const dx = event.clientX - state.lightboxZoom.lastX;
    const dy = event.clientY - state.lightboxZoom.lastY;
    state.lightboxZoom.panX = (state.lightboxZoom.panX || 0) + dx;
    state.lightboxZoom.panY = (state.lightboxZoom.panY || 0) + dy;
    state.lightboxZoom.lastX = event.clientX;
    state.lightboxZoom.lastY = event.clientY;
    applyLightboxZoom();
    state.suppressPhotoTap = true;
    return;
  }
  if (state.lightboxPointers.size < 2 || !state.lightboxZoom.startDistance) return;
  const nextScale = clamp(
    state.lightboxZoom.baseScale * (lightboxPointerDistance() / state.lightboxZoom.startDistance),
    1,
    4
  );
  state.lightboxZoom.scale = nextScale;
  if (nextScale <= 1.01) {
    state.lightboxZoom.panX = 0;
    state.lightboxZoom.panY = 0;
  }
  applyLightboxZoom();
}

function handleLightboxPointerEnd(event) {
  const wasPinching = state.lightboxPointers.size >= 2;
  const wasPanning = state.lightboxZoom.isPanning;
  state.lightboxPointers.delete(event.pointerId);
  state.lightboxZoom.isPanning = false;
  if (wasPinching) {
    state.lightboxSwipeStart = null;
    state.lightboxZoom.startDistance = 0;
    state.lightboxZoom.baseScale = state.lightboxZoom.scale || 1;
    state.suppressPhotoTap = true;
    return;
  }
  if (wasPanning) {
    state.lightboxSwipeStart = null;
    state.suppressPhotoTap = true;
    return;
  }
  if (!state.lightboxSwipeStart) return;
  if (state.lightboxSwipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - state.lightboxSwipeStart.x;
  const dy = event.clientY - state.lightboxSwipeStart.y;
  state.lightboxSwipeStart = null;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
  navigateExpandedPhoto(dx > 0 ? "previous" : "next");
  state.suppressPhotoTap = true;
}

function cancelLightboxSwipe() {
  state.lightboxSwipeStart = null;
  state.lightboxPointers.clear();
  state.lightboxZoom.startDistance = 0;
  state.lightboxZoom.isPanning = false;
}

function lightboxPointerDistance() {
  const points = Array.from(state.lightboxPointers.values());
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function applyLightboxZoom() {
  const media = document.querySelector(".photo-lightbox-media img, .photo-lightbox-media video");
  if (!media) return;
  const scale = state.lightboxZoom.scale || 1;
  media.style.transform = `translate(${state.lightboxZoom.panX || 0}px, ${state.lightboxZoom.panY || 0}px) scale(${scale})`;
}

function resetLightboxZoom() {
  state.lightboxZoom = { scale: 1, baseScale: 1, startDistance: 0, panX: 0, panY: 0, startPanX: 0, startPanY: 0, lastX: 0, lastY: 0, isPanning: false };
  state.lightboxPointers.clear();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function handlePhotoPointerMove(event) {
  if (!state.photoDragSelection || !state.photoSelectionMode) return;
  if (state.photoDragSelection.pointerId !== undefined && state.photoDragSelection.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const card = element?.closest?.("[data-photo-card]");
  if (!card || state.photoDragSelection.touched.has(card.dataset.photoCard)) return;
  state.photoDragSelection.touched.add(card.dataset.photoCard);
  setPhotoSelection(card.dataset.photoCard, state.photoDragSelection.selected);
  refreshPhotoSelectionUi();
}

function handlePhotoSelectionTouchMove(event) {
  if (!state.photoDragSelection || !state.photoSelectionMode) return;
  event.preventDefault();
}

function handlePhotoTap(event) {
  if (event.target.closest("[data-photo-navigate]")) return;
  if (event.target.closest("[data-expanded-photo-view]")) {
    if (state.suppressPhotoTap) {
      state.suppressPhotoTap = false;
      return;
    }
    if (state.chatExpandedAttachmentId) {
      state.chatExpandedAttachmentId = null;
      resetLightboxZoom();
      render();
      return;
    }
    if (state.trashExpandedPhotoId) {
      state.trashExpandedPhotoId = null;
      resetLightboxZoom();
      render();
      return;
    }
    state.expandedPhotoId = null;
    resetLightboxZoom();
    if (state.expandedPhotoReturnTab === "chat") {
      state.selectedOrderId = null;
      state.selectedStep = "all";
      state.tab = "chat";
      state.expandedPhotoReturnTab = null;
      replaceAppHistory();
      render();
      return;
    }
    state.expandedPhotoReturnTab = null;
    render();
    return;
  }

  const card = event.target.closest("[data-photo-card]");
  if (!card || event.target.closest("button")) return;
  if (state.suppressPhotoTap) {
    state.suppressPhotoTap = false;
    return;
  }
  if (isCompletedDetail()) {
    togglePhotoSelection(card.dataset.photoCard);
    return;
  }
  if (state.photoSelectionMode) {
    togglePhotoSelection(card.dataset.photoCard);
    return;
  }
  state.expandedPhotoId = card.dataset.photoCard;
  state.expandedPhotoReturnTab = null;
  resetLightboxZoom();
  render();
}

function openPhotoDialog(options = {}) {
  if (!options.quick) state.quickPhotoAdvance = false;
  if (!options.listQuick) state.quickListPhotoOrderId = null;
  releasePendingPhotos();
  cameraInput.value = "";
  galleryInput.value = "";
  photoMemo.value = "";
  photoPreview.innerHTML = `<div class="preview-empty">사진 찍기 또는 갤러리를 선택해 주세요.</div>`;
  photoDialog.showModal();
}

function openListPhotoStepPicker(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) return;
  const existing = document.querySelector("#listPhotoStepDialog");
  if (existing) existing.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "listPhotoStepDialog";
  dialog.className = "sheet quick-photo-step-dialog";
  dialog.innerHTML = `
    <div class="sheet-head">
      <div>
        <p class="eyebrow">Photo</p>
        <h2>${escapeHtml(order.serial || "품번")} 사진 추가</h2>
      </div>
      <button class="icon-button" type="button" data-list-photo-step-close aria-label="닫기">×</button>
    </div>
    <div class="quick-photo-step-grid" role="group" aria-label="사진 추가 단계 선택">
      ${workflowSteps().filter((step) => Number(step.code) <= PHOTO_STEP_LIMIT).map((step) => `
        <button type="button" data-list-photo-step="${escapeHtml(step.code)}">
          <span>${escapeHtml(step.code)}</span>
          <strong>${escapeHtml(step.name)}</strong>
        </button>
      `).join("")}
    </div>
  `;
  dialog.addEventListener("click", (event) => {
    const closeTarget = event.target.closest("[data-list-photo-step-close]");
    if (closeTarget) {
      dialog.close();
      return;
    }
    const stepTarget = event.target.closest("[data-list-photo-step]");
    if (!stepTarget) return;
    state.quickListPhotoOrderId = order.id;
    state.selectedStep = stepTarget.dataset.listPhotoStep;
    clearPhotoSelection();
    state.expandedPhotoId = null;
    dialog.close();
    openPhotoDialog({ listQuick: true });
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

function openEditOrderDialog() {
  const order = selectedOrder();
  if (!order || !editOrderForm) return;
  editOrderForm.dataset.orderId = order.id;
  editOrderForm.elements.serial.value = order.serial || "";
  editOrderForm.elements.customerName.value = order.customerName || "";
  editOrderForm.elements.address.value = order.address || "";
  editOrderForm.elements.brand.value = order.brand || "";
  editOrderForm.elements.modelName.value = order.modelName || "";
  editOrderForm.elements.requestMemo.value = orderMemoWithoutSpecial(order.requestMemo);
  if (editOrderForm.elements.specialMemo) editOrderForm.elements.specialMemo.value = orderMemoFieldValue(order, "important");
  const productTypes = new Set(String(order.productType || "").split(",").map((item) => item.trim()).filter(Boolean));
  editOrderForm.querySelectorAll('input[name="productType"]').forEach((input) => {
    input.checked = productTypes.has(input.value);
  });
  editOrderDialog.showModal();
}

function imageBlobToFile(blob, originalName) {
  const base = String(originalName || "photo").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}_display.jpg`, { type: "image/jpeg" });
}

async function createDisplayImageFile(file, maxSize = 1400, quality = 0.72) {
  if (!file.type.startsWith("image/")) return null;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob ? imageBlobToFile(blob, file.name) : null;
}

async function preparePendingMedia(file, sourceLabel) {
  const displayFile = await createDisplayImageFile(file).catch(() => null);
  return {
    file,
    displayFile,
    previewUrl: URL.createObjectURL(displayFile || file),
    originalName: file.name,
    mimeType: file.type,
    isVideo: file.type.startsWith("video/"),
    sourceLabel,
  };
}

function nativeCameraPlugin() {
  return isNativeApp() ? window.Capacitor?.Plugins?.Camera : null;
}

async function nativePhotoFile(photo, index, prefix) {
  const webPath = photo.webPath || (photo.path ? window.Capacitor?.convertFileSrc?.(photo.path) : "");
  if (!webPath) throw new Error("선택한 사진을 읽을 수 없습니다.");
  const response = await fetch(webPath);
  if (!response.ok) throw new Error("선택한 사진 파일을 불러오지 못했습니다.");
  const blob = await response.blob();
  const format = String(photo.format || blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return new File([blob], `${prefix}_${stamp}_${String(index + 1).padStart(2, "0")}.${format}`, {
    type: blob.type || `image/${format === "jpg" ? "jpeg" : format}`,
  });
}

async function pickNativeGalleryPhotos() {
  const camera = nativeCameraPlugin();
  if (!camera?.pickImages) {
    galleryInput.click();
    return;
  }
  const availableCount = Math.max(0, PHOTO_UPLOAD_MAX_COUNT - state.pendingPhotos.length);
  if (!availableCount) {
    alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다.`);
    return;
  }
  try {
    const result = await camera.pickImages({ quality: 100, limit: availableCount });
    const photos = Array.from(result.photos || []).slice(0, availableCount);
    const files = await Promise.all(photos.map((photo, index) => nativePhotoFile(photo, index, "gallery")));
    await handleSelectedFiles(files, "갤러리");
  } catch (error) {
    if (!/cancel/i.test(String(error?.message || error))) throw error;
  }
}

async function takeNativeCameraPhotos() {
  const camera = nativeCameraPlugin();
  if (!camera?.getPhoto) {
    cameraInput.click();
    return;
  }
  const files = [];
  const availableCount = Math.max(0, PHOTO_UPLOAD_MAX_COUNT - state.pendingPhotos.length);
  try {
    while (files.length < availableCount) {
      const photo = await camera.getPhoto({
        quality: 100,
        resultType: "uri",
        source: "CAMERA",
        saveToGallery: false,
        correctOrientation: true,
      });
      files.push(await nativePhotoFile(photo, files.length, "camera"));
      if (state.quickPhotoAdvance || files.length >= availableCount) break;
      if (!confirm(`${files.length}장 촬영했습니다. 계속 촬영할까요?`)) break;
    }
    await handleSelectedFiles(files, "사진 찍기");
  } catch (error) {
    if (!/cancel/i.test(String(error?.message || error))) throw error;
  }
}

async function handleSelectedFiles(selectedFiles, sourceLabel) {
  const availableCount = Math.max(0, PHOTO_UPLOAD_MAX_COUNT - state.pendingPhotos.length);
  const files = selectedFiles.slice(0, availableCount);
  if (!files.length) return;
  if (selectedFiles.length > files.length) {
    alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다. 초과한 사진은 제외했습니다.`);
  }
  if (state.quickPhotoAdvance && sourceLabel === "사진 찍기") {
    const loaded = await Promise.all(files.map((file) => preparePendingMedia(file, sourceLabel)));
    state.pendingPhotos = [...state.pendingPhotos, ...loaded];
    photoDialog.close();
    showUploadProgress(0, state.pendingPhotos.length, "사진 업로드 준비 중");
    await waitForPaint();
    photoForm.requestSubmit();
    return;
  }
  photoPreview.innerHTML = `<div class="preview-empty">사진을 가볍게 준비하는 중입니다.</div>`;
  await waitForPaint();
  const loaded = await Promise.all(files.map((file) => preparePendingMedia(file, sourceLabel)));
  state.pendingPhotos = [...state.pendingPhotos, ...loaded];
  renderPendingPhotos(sourceLabel);
}

async function handlePhotoInput(input, sourceLabel) {
  const selectedFiles = Array.from(input.files || []);
  await handleSelectedFiles(selectedFiles, sourceLabel);
  input.value = "";
}

function renderPendingPhotos(sourceLabel) {
  const count = state.pendingPhotos.length;
  photoPreview.innerHTML = `
    <div class="preview-summary">${escapeDisplay(sourceLabel)} · ${count}개 선택됨</div>
    <div class="preview-grid">
      ${state.pendingPhotos.map((item, index) => `
        <article class="preview-item">
          <button class="preview-delete-button" type="button" data-remove-pending-photo="${index}" aria-label="선택한 사진 제거">×</button>
          ${item.isVideo ? `<video src="${item.previewUrl}" controls playsinline preload="metadata"></video>` : `<img src="${item.previewUrl}" alt="사진 미리보기">`}
          <span>${escapeHtml(item.originalName)}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function removePendingPhoto(index) {
  const [removed] = state.pendingPhotos.splice(index, 1);
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  if (!state.pendingPhotos.length) {
    photoPreview.innerHTML = `<div class="preview-empty">사진 찍기 또는 갤러리를 선택해주세요.</div>`;
    cameraInput.value = "";
    galleryInput.value = "";
    return;
  }
  renderPendingPhotos(state.pendingPhotos[0].sourceLabel || "갤러리");
}

function releasePendingPhotos() {
  state.pendingPhotos.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  state.pendingPhotos = [];
}

function releaseChatPendingMedia() {
  state.chatPendingMedia.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  state.chatPendingMedia = [];
}

async function addChatFiles(selectedFiles) {
  const files = Array.from(selectedFiles || []).filter((file) => /^image\//.test(file.type));
  const availableCount = Math.max(0, PHOTO_UPLOAD_MAX_COUNT - state.chatPendingMedia.length);
  if (!availableCount) {
    alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다.`);
    return;
  }
  const picked = files.slice(0, availableCount);
  if (files.length > availableCount) alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다.`);
  const prepared = await Promise.all(picked.map((file) => preparePendingMedia(file, "채팅")));
  state.chatPendingMedia = [...state.chatPendingMedia, ...prepared];
  refreshChatPendingPreview();
}

function removeChatPendingMedia(index) {
  const [removed] = state.chatPendingMedia.splice(index, 1);
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  refreshChatPendingPreview();
}

async function sendChatMessage(form) {
  const input = form.querySelector("#chatMessageInput");
  const body = String(input?.value || "").trim();
  if (!body && !state.chatPendingMedia.length) {
    alert("메시지나 사진을 입력해 주세요.");
    return;
  }
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    setGlobalLoading("보내는 중...");
    await waitForPaint();
    const formData = new FormData();
    formData.append("body", body);
    formData.append("room", normalizeChatRoomId(state.chatRoom));
    const targetOrder = state.chatPendingMedia.length ? chatComposerMatchedOrder(body) : null;
    const completedOrder = targetOrder || !state.chatPendingMedia.length ? null : chatComposerCompletedOrder(body);
    if (targetOrder) {
      formData.append("targetOrderId", targetOrder.id);
      formData.append("targetStepCode", state.chatComposerStepCode || "01");
    } else if (completedOrder && (state.chatComposerStepCode || "01") === "01") {
      formData.append("targetSerial", completedOrder.serial || chatComposerSerialText(body));
      formData.append("targetStepCode", "01");
    }
    state.chatPendingMedia.forEach((media) => {
      formData.append("files", media.displayFile || media.file, media.originalName || "chat.jpg");
    });
    const result = await uploadPhotos("/api/chat", formData);
    state.data.chatMessages = result.chatMessages || [...(state.data.chatMessages || []), result.message].filter(Boolean);
    if (result.order) replaceOrderInState(result.order);
    releaseChatPendingMedia();
    if (input) input.value = "";
    state.chatComposerStepCode = "01";
    refreshChatPendingPreview();
    refreshChatFeed();
    showToast("완료되었습니다.");
  } catch (error) {
    alert(error.message || "채팅을 보내지 못했습니다.");
  } finally {
    setGlobalLoading("");
    if (submitButton) submitButton.disabled = false;
  }
}

async function sendChatAttachmentToOrder(form) {
  const messageId = state.chatTransferMessageId;
  if (!messageId) return;
  const formData = new FormData(form);
  const orderId = formData.get("orderId");
  const stepCode = formData.get("stepCode");
  if (!orderId || !stepCode) {
    alert("품목과 단계를 선택해 주세요.");
    return;
  }
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    setGlobalLoading("업로드 중...");
    await waitForPaint();
    const result = await api(`/api/chat/messages/${encodeURIComponent(messageId)}/send-to-order`, {
      method: "POST",
      body: JSON.stringify({ orderId, stepCode }),
    });
    if (result.order) replaceOrderInState(result.order);
    state.chatTransferMessageId = null;
    render();
    showToast("완료되었습니다.");
  } catch (error) {
    alert(error.message || "사진을 품목 단계로 업로드하지 못했습니다.");
  } finally {
    setGlobalLoading("");
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteChatMessage(messageId) {
  if (!messageId) return;
  if (!confirm("이 채팅을 삭제하시겠습니까?")) return;
  try {
    const result = await api(`/api/chat/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
    state.data.chatMessages = result.chatMessages || (state.data.chatMessages || []).filter((message) => message.id !== messageId);
    if (state.chatExpandedAttachmentId && !chatAttachmentList().some((attachment) => attachment.id === state.chatExpandedAttachmentId)) {
      state.chatExpandedAttachmentId = null;
    }
    if (state.chatTransferMessageId === messageId) state.chatTransferMessageId = null;
    refreshChatFeed();
  } catch (error) {
    alert(error.message || "채팅을 삭제하지 못했습니다.");
  }
}

function showUploadProgress(done, total, label = "사진 저장 중") {
  let overlay = document.querySelector("#uploadProgressOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "uploadProgressOverlay";
    overlay.className = "upload-progress-overlay";
    document.body.appendChild(overlay);
  }
  const percent = total ? Math.round((done / total) * 100) : 0;
  overlay.innerHTML = `
    <div class="upload-progress-box">
      <div class="upload-spinner"></div>
      <strong>${escapeHtml(label)}</strong>
      <span>${done} / ${total}</span>
      <div class="upload-progress-track"><i style="width: ${percent}%"></i></div>
    </div>
  `;
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function hideUploadProgress() {
  document.querySelector("#uploadProgressOverlay")?.remove();
}

function parseOrderPaste() {
  const raw = orderPasteInput.value.trim();
  if (!raw) {
    alert("붙여넣기 값을 입력해 주세요.");
    return;
  }
  try {
    const type = usesBOrderFormat() ? "B" : "A";
    applyParsedOrder(type === "B" ? parseBOrder(raw) : parseAOrder(raw));
  } catch (error) {
    alert(error.message || "붙여넣기 내용을 인식하지 못했습니다.");
  }
}

function usesBOrderFormat(type = state.orderType) {
  return type === "B" || type === "AB";
}

function cleanPastePart(part) {
  return part.replace(/^[^\p{L}\p{N}#]+/u, "").replace(/\s+/g, " ").trim();
}

function findSerial(value) {
  return String(value || "").match(/\b(?:AB|BA|A|B)\d{2,4}\b/i)?.[0]?.toUpperCase() || "";
}

function serialForOrderType(serial, type = state.orderType) {
  const source = String(serial || "").trim().toUpperCase();
  const number = source.match(/\d{2,4}/)?.[0] || "";
  return number && ["A", "B", "AB", "BA"].includes(type) ? `${type}${number}` : source;
}

function parseAOrder(raw) {
  const parts = raw.split("/").map(cleanPastePart).filter(Boolean);
  const serialIndex = parts.findIndex((part) => findSerial(part));
  if (serialIndex < 0) throw new Error("품번을 찾지 못했습니다.");
  const serial = findSerial(parts[serialIndex]);
  const beforeSerial = parts[serialIndex].replace(serial, "").trim();
  const prefix = [...parts.slice(0, serialIndex), beforeSerial].filter(Boolean).join(" ");
  const rest = parts.slice(serialIndex + 1);
  const dateRange = normalizeOrderDateRange(rest.shift() || "");
  if (isUrgentToken(rest[0])) rest.shift();
  const address = rest.shift() || "";
  const maybeDoor = looksLikeDoorInfo(rest[0]) ? rest.shift() : "";
  const productText = rest.shift() || "";
  const maybeExtra = rest.length > 1 ? rest.shift() : "";
  const customerText = rest.join(" / ");
  const money = parseMoney(customerText || maybeExtra);
  const brandModel = inferBrandModel(productText);
  const products = inferProducts(productText);
  return {
    serial,
    dateRange,
    address,
    doorInfo: maybeDoor,
    productTypes: inferProductTypes(productText),
    brand: products[0]?.brand || brandModel.brand,
    modelName: products[0]?.modelName || brandModel.modelName || productText,
    products,
    customerName: parseCustomerName(customerText),
    price: money.price,
    payment: money.payment,
    requestMemo: [
      raw ? `복사 원문: ${raw}` : "",
      prefix ? `지역: ${prefix}` : "",
      productText ? `제품/브랜드 원문: ${productText}` : "",
      maybeExtra && !parseCustomerName(maybeExtra) ? `추가: ${maybeExtra}` : "",
      customerText ? `고객/비용 원문: ${customerText}` : "",
    ].filter(Boolean).join("\n"),
  };
}

function parseBOrder(raw) {
  const parts = raw.split("/").map(cleanPastePart).filter(Boolean);
  const serialIndex = parts.findIndex((part) => findSerial(part));
  if (serialIndex < 0) throw new Error("품번을 찾지 못했습니다.");
  const serial = findSerial(parts[serialIndex]);
  const beforeSerial = parts[serialIndex].replace(serial, "").trim();
  const prefix = [...parts.slice(0, serialIndex), beforeSerial].filter(Boolean).join(" ");
  const rest = parts.slice(serialIndex + 1);
  const contactTail = rest.shift() || "";
  let dateRange = rest.shift() || "";
  if (/^\d{3,4}(?:-\d{1,4})?$/.test(rest[0] || "") && rest.length > 1) {
    dateRange = [dateRange, rest.shift()].filter(Boolean).join("-");
  }
  dateRange = normalizeOrderDateRange(dateRange);
  const productText = rest.join(" / ");
  const money = parseMoney(productText);
  const dirty = parseContamination(productText);
  const cleanedProduct = productText
    .replace(money.full, "")
    .replace(dirty, "")
    .trim()
    .replace(/[,\s]+$/, "");
  const brandModel = inferBrandModel(cleanedProduct);
  const products = inferProducts(cleanedProduct);
  return {
    serial,
    contactTail,
    dateRange,
    productTypes: inferProductTypes(cleanedProduct),
    brand: products[0]?.brand || brandModel.brand,
    modelName: products[0]?.modelName || brandModel.modelName || cleanedProduct,
    products,
    contamination: dirty,
    price: money.price,
    payment: money.payment,
    requestMemo: [
      raw ? `복사 원문: ${raw}` : "",
      prefix ? `지역: ${prefix}` : "",
      productText ? `브랜드/모델 원문: ${productText}` : "",
    ].filter(Boolean).join("\n"),
  };
}

function applyParsedOrder(parsed) {
  orderForm.elements.serial.value = serialForOrderType(parsed.serial || "");
  orderForm.elements.contactTail.value = parsed.contactTail || "";
  orderForm.elements.dateRange.value = parsed.dateRange || "";
  orderForm.elements.address.value = parsed.address || "";
  orderForm.elements.doorInfo.value = parsed.doorInfo || "";
  setProductTypes(parsed.productTypes || []);
  orderForm.elements.brand.value = parsed.brand || "";
  orderForm.elements.modelName.value = parsed.modelName || "";
  setProductCount(Math.max(1, parsed.products?.length || 1));
  setProductDetails(parsed.products?.length ? parsed.products : [{ brand: parsed.brand || "", modelName: parsed.modelName || "" }]);
  orderForm.elements.customerName.value = parsed.customerName || "";
  orderForm.elements.contamination.value = parsed.contamination || "";
  orderForm.elements.price.value = parsed.price || "";
  orderForm.elements.payment.value = parsed.payment || "";
  orderForm.elements.requestMemo.value = parsed.requestMemo || "";
}

function inferProductTypes(text = "") {
  const source = String(text || "");
  const types = new Set();
  if (/카시트|바구니|이너|신생아|차량시트/u.test(source)) types.add("카시트");
  if (/유모차|프레임|캐노피|방풍|방한|레인|바퀴|스토케|부가부|리안|요요/u.test(source)) types.add("유모차");
  return Array.from(types);
}

function knownBrands() {
  return Object.keys(BRAND_CATALOG).filter((item) => item !== "기타");
}

function inferBrandModel(text = "") {
  const brands = knownBrands();
  const segment = String(text || "")
    .split(",")
    .map((item) => item.trim())
    .find((item) => brands.some((brand) => item.startsWith(brand))) || "";
  if (!segment) return { brand: "", modelName: "" };
  const brand = brands.find((item) => segment.startsWith(item)) || "";
  return { brand, modelName: segment.slice(brand.length).trim() };
}

function inferProducts(text = "") {
  const brands = knownBrands();
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const brand = brands.find((candidate) => item.startsWith(candidate)) || "";
      const product = splitProductNote(brand ? item.slice(brand.length).trim() : item);
      const accessories = extractAccessoryTags(item);
      return { types: inferProductTypes(item), brand, modelName: product.name, accessories, note: product.note };
    })
    .slice(0, 5);
}

function splitProductNote(text = "") {
  const source = String(text || "").trim();
  if (!source) return { name: "", note: "" };
  const notePattern = /(선결|곰팡이|오염|토사물|냄새|대변|소변).*/u;
  const noteMatch = source.match(notePattern);
  if (!noteMatch) return { name: source, note: "" };
  return {
    name: source.slice(0, noteMatch.index).replace(/[,\s]+$/, "").trim(),
    note: cleanProductNote(noteMatch[0]),
  };
}

function cleanProductNote(text = "") {
  return String(text || "")
    .replace(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:만원|만)/gu, "")
    .replace(/선결\s*쿠사|선결쿠사|선결|완결|완납|쿠사/gu, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function productNotePattern(label) {
  if (label === "선결") return /선결|완결|완납|쿠사/u;
  return new RegExp(label, "u");
}

function extractProductNoteTags(text = "") {
  const source = String(text || "");
  return PRODUCT_NOTE_OPTIONS.filter((label) => productNotePattern(label).test(source));
}

function mergeProductNoteTags(text = "") {
  const tags = extractProductNoteTags(text);
  const extra = String(text || "").split(",").map((item) => item.trim()).filter((item) => item && !tags.includes(item));
  return [...tags, ...extra].join(", ");
}

function accessoryPattern(label) {
  return new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "u");
}

function extractAccessoryTags(text = "") {
  const source = String(text || "");
  const options = Object.values(PRODUCT_ACCESSORY_OPTIONS).flat();
  return [...new Set(options.filter((label) => accessoryPattern(label).test(source)))];
}
function parseCustomerName(text = "") {
  return String(text || "").match(/([가-힣]{2,5})\s*(?:님|고객)?/)?.[1] || "";
}

function parseMoney(text = "") {
  const moneyPattern = /(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:만원|만|원)?\s*(?:선결|완결|완납|쿠사)?/gu;
  const candidates = Array.from(String(text || "").matchAll(moneyPattern))
    .map((match) => match[0].trim())
    .filter((value) => /,|\.\d|만|원|선결|완결|완납|쿠사/u.test(value));
  const full = candidates.at(-1) || "";
  const rawPrice = full.match(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s*(?:만원|만|원))?/)?.[0]?.trim() || "";
  const price = normalizePrice(rawPrice);
  const payment = String(text || "").match(/선결\s*쿠사|선결쿠사|선결|완결|완납|쿠사/u)?.[0]?.replace(/\s+/g, "") || "";
  return { full, price, payment };
}

function normalizePrice(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const numberText = raw.match(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/)?.[0] || "";
  if (!numberText) return raw;
  const amount = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return raw;
  const isManUnit = /만/.test(raw) || /\.\d+/.test(numberText);
  const won = isManUnit ? Math.round(amount * 10000) : Math.round(amount);
  return `${won.toLocaleString("ko-KR")}원`;
}

function parseContamination(text = "") {
  return String(text || "").match(/선결|곰팡이|오염|토사물|냄새|대변|소변|긴급|현장확인/u)?.[0] || "";
}

function isUrgentToken(value = "") {
  return /긴급|당일|급/u.test(String(value || ""));
}

function looksLikeDoorInfo(value = "") {
  return /^[#*\d,\-\s>비번누르고확인]+$/u.test(String(value || "")) && /\d/.test(String(value || ""));
}

function setProductTypes(types) {
  const selected = new Set(types);
  orderForm.querySelectorAll('input[name="productType"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function setProductCount(count) {
  state.productCount = Math.min(5, Math.max(1, Number(count) || 1));
  document.querySelectorAll("[data-product-count]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.productCount) === state.productCount);
  });
  renderProductFields(readProductDetails());
}

function renderProductFields(existing = []) {
  const container = document.querySelector("#productFields");
  if (!container) return;
  container.innerHTML = Array.from({ length: state.productCount }, (_, index) => {
    const product = existing[index] || {};
    const brandOptions = brandSelectOptions(product.brand);
    const modelOptions = modelSelectOptions(product.brand, product.modelName);
    const customBrand = !BRAND_CATALOG[product.brand] && product.brand ? product.brand : "";
    const knownModels = BRAND_CATALOG[product.brand] || [];
    const customModel = product.modelName && !knownModels.includes(product.modelName) ? product.modelName : "";
    return `
      <div class="product-item">
        <strong>제품 정보</strong>
        <div class="form-grid">
          <label>브랜드
            <select name="productBrand${index + 1}" data-product-brand="${index}">
              ${brandOptions}
            </select>
          </label>
          <label class="custom-product-field ${customBrand ? "" : "is-hidden"}">브랜드 직접 입력
            <input name="productBrandCustom${index + 1}" placeholder="브랜드" value="${escapeHtml(customBrand)}">
          </label>
          <label>모델명
            <select name="productModel${index + 1}" data-product-model="${index}">
              ${modelOptions}
            </select>
          </label>
          <label class="custom-product-field ${customModel || product.modelName === "기타" ? "" : "is-hidden"}">모델명 직접 입력
            <input name="productModelCustom${index + 1}" placeholder="모델명" value="${escapeHtml(customModel)}">
          </label>
        </div>
      </div>
    `;
  }).join("");
}

function readProductDetails() {
  return Array.from({ length: state.productCount }, (_, index) => ({
    brand: selectedProductBrand(index),
    modelName: selectedProductModel(index),
  }));
}

function brandSelectOptions(selected = "") {
  const current = BRAND_CATALOG[selected] ? selected : selected ? "기타" : "";
  return [
    `<option value="">브랜드 선택</option>`,
    ...Object.keys(BRAND_CATALOG).map((brand) => `<option value="${escapeHtml(brand)}" ${brand === current ? "selected" : ""}>${escapeHtml(brand)}</option>`),
  ].join("");
}

function modelSelectOptions(brand = "", selected = "") {
  const models = BRAND_CATALOG[brand] || ["기타"];
  const current = models.includes(selected) ? selected : selected ? "기타" : "";
  return [
    `<option value="">모델 선택</option>`,
    ...models.map((model) => `<option value="${escapeHtml(model)}" ${model === current ? "selected" : ""}>${escapeHtml(model)}</option>`),
  ].join("");
}

function selectedProductBrand(index) {
  const number = index + 1;
  const brand = orderForm.elements[`productBrand${number}`]?.value || "";
  if (brand === "기타") return orderForm.elements[`productBrandCustom${number}`]?.value?.trim() || "";
  return brand.trim();
}

function selectedProductModel(index) {
  const number = index + 1;
  const model = orderForm.elements[`productModel${number}`]?.value || "";
  if (model === "기타") return orderForm.elements[`productModelCustom${number}`]?.value?.trim() || "";
  return model.trim();
}

function selectedProductNote(index) {
  const number = index + 1;
  const selected = Array.from(orderForm.querySelectorAll(`input[name="productNoteOption${number}"]:checked`)).map((input) => input.value);
  const custom = orderForm.elements[`productNote${number}`]?.value?.trim() || "";
  const customItems = custom.split(",").map((item) => item.trim()).filter((item) => item && !selected.includes(item));
  return [...selected, ...customItems].join(", ");
}

function selectedProductAccessories(index) {
  const number = index + 1;
  return Array.from(orderForm.querySelectorAll(`input[name="productAccessoryOption${number}"]:checked`)).map((input) => input.value);
}

function customProductNoteText(note = "") {
  const tags = new Set(extractProductNoteTags(note));
  return String(note || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && !tags.has(item))
    .join(", ");
}

function refreshProductModelSelect(index) {
  const number = index + 1;
  const brandSelect = orderForm.elements[`productBrand${number}`];
  const modelSelect = orderForm.elements[`productModel${number}`];
  if (!brandSelect || !modelSelect) return;
  modelSelect.innerHTML = modelSelectOptions(brandSelect.value, "");
  toggleCustomProductFields(index);
}

function toggleCustomProductFields(index) {
  const number = index + 1;
  const brandSelect = orderForm.elements[`productBrand${number}`];
  const modelSelect = orderForm.elements[`productModel${number}`];
  const brandCustom = orderForm.elements[`productBrandCustom${number}`]?.closest(".custom-product-field");
  const modelCustom = orderForm.elements[`productModelCustom${number}`]?.closest(".custom-product-field");
  brandCustom?.classList.toggle("is-hidden", brandSelect?.value !== "기타");
  modelCustom?.classList.toggle("is-hidden", modelSelect?.value !== "기타");
}

function setProductDetails(products) {
  renderProductFields(products);
  const first = products[0] || {};
  orderForm.elements.brand.value = first.brand || "";
  orderForm.elements.modelName.value = first.modelName || "";
}

function getProductTypes() {
  return Array.from(orderForm.querySelectorAll('input[name="productType"]:checked')).map((input) => input.value);
}

function buildOrderMemo(baseMemo, doorInfo, dateRange) {
  const products = readProductDetails().filter((item) => item.brand || item.modelName);
  return [
    products.length ? `제품 정보:\n${products.map((item) => [item.brand, item.modelName].filter(Boolean).join(" ")).join("\n")}` : "",
    usesBOrderFormat() && fieldValue("contactTail") ? `연락처 뒷번호: ${fieldValue("contactTail")}` : "",
    doorInfo ? `현관 및 비밀번호: ${doorInfo}` : "",
    dateRange ? `${state.orderType === "B" || state.orderType === "AB" ? "접수날짜" : "시작일자 / 종료일자"}: ${dateRange}` : "",
    usesBOrderFormat() && fieldValue("contamination") ? `오염: ${fieldValue("contamination")}` : "",
    fieldValue("price") ? `비용: ${fieldValue("price")}` : "",
    usesBOrderFormat() && fieldValue("payment") ? `결제 여부: ${fieldValue("payment")}` : "",
    baseMemo || "",
  ].filter(Boolean).join("\n");
}

function emptyProductSlot() {
  return { types: [], brand: "", modelName: "", accessories: [], note: "" };
}

function normalizeProductSlot(product = {}) {
  const split = splitProductNote(product.modelName || "");
  const text = [product.brand, product.modelName].filter(Boolean).join(" ");
  const types = (Array.isArray(product.types) ? product.types.filter(Boolean) : inferProductTypes(text)).slice(0, 1);
  const allowedAccessories = types[0] ? PRODUCT_ACCESSORY_OPTIONS[types[0]] || [] : Object.values(PRODUCT_ACCESSORY_OPTIONS).flat();
  const accessories = (Array.isArray(product.accessories) ? product.accessories.filter(Boolean) : extractAccessoryTags(text))
    .filter((item) => allowedAccessories.includes(item));
  return {
    types,
    brand: product.brand || "",
    modelName: product.note ? product.modelName || "" : split.name,
    accessories,
    note: mergeProductNoteTags(product.note || split.note),
  };
}

function setProductTypes(types) {
  state.productSlots[0] = {
    ...normalizeProductSlot(state.productSlots[0]),
    types: Array.isArray(types) ? types.filter(Boolean).slice(0, 1) : [],
  };
  if (state.activeProductIndex === 0) setActiveProductTypes(types);
}

function setActiveProductTypes(types) {
  const selected = new Set(types || []);
  orderForm.querySelectorAll('input[name="activeProductType"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function getActiveProductTypes() {
  return Array.from(orderForm.querySelectorAll('input[name="activeProductType"]:checked')).map((input) => input.value);
}

function saveActiveProductSlot() {
  const container = document.querySelector("#productFields");
  if (!container || !container.children.length) return;
  const index = state.activeProductIndex;
  state.productSlots[index] = {
    types: getActiveProductTypes(),
    brand: selectedProductBrand(index),
    modelName: selectedProductModel(index),
    accessories: selectedProductAccessories(index),
    note: selectedProductNote(index),
  };
}

function setProductCount(count) {
  setActiveProductIndex(Math.min(4, Math.max(0, Number(count) - 1 || 0)));
}

function setActiveProductIndex(index) {
  saveActiveProductSlot();
  state.activeProductIndex = Math.min(4, Math.max(0, Number(index) || 0));
  refreshProductIndexButtons();
  renderProductFields();
}

function hasProductSlotData(product = {}) {
  const normalized = normalizeProductSlot(product);
  return Boolean(normalized.types.length || normalized.brand || normalized.modelName || normalized.accessories.length || normalized.note);
}

function refreshProductIndexButtons() {
  document.querySelectorAll("[data-product-index]").forEach((button) => {
    const index = Number(button.dataset.productIndex);
    button.classList.toggle("is-active", index === state.activeProductIndex);
    button.classList.toggle("is-filled", hasProductSlotData(state.productSlots[index]));
  });
}

function renderProductFields() {
  const container = document.querySelector("#productFields");
  if (!container) return;
  const index = state.activeProductIndex;
  const product = normalizeProductSlot(state.productSlots[index]);
  setActiveProductTypes(product.types);
  const brandOptions = brandSelectOptions(product.brand);
  const modelOptions = modelSelectOptions(product.brand, product.modelName);
  const customBrand = !BRAND_CATALOG[product.brand] && product.brand ? product.brand : "";
  const knownModels = BRAND_CATALOG[product.brand] || [];
  const customModel = product.modelName && !knownModels.includes(product.modelName) ? product.modelName : "";
  const selectedNotes = new Set(extractProductNoteTags(product.note));
  const customNote = customProductNoteText(product.note);
  const selectedAccessories = new Set(product.accessories || []);
  const accessoryOptions = PRODUCT_ACCESSORY_OPTIONS[product.types[0]] || [];
  container.innerHTML = `
    <div class="product-item">
      <strong>품목 정보</strong>
      <fieldset class="choice-group product-kind-group">
        <legend>품목 종류</legend>
        <label><input type="radio" name="activeProductType" value="카시트" ${product.types[0] === "카시트" ? "checked" : ""}><span>카시트</span></label>
        <label><input type="radio" name="activeProductType" value="유모차" ${product.types[0] === "유모차" ? "checked" : ""}><span>유모차</span></label>
      </fieldset>
      <fieldset class="choice-group product-accessory-group">
        <legend>부속품</legend>
        ${accessoryOptions.length ? accessoryOptions.map((accessory) => `
          <label><input type="checkbox" name="productAccessoryOption${index + 1}" value="${escapeHtml(accessory)}" ${selectedAccessories.has(accessory) ? "checked" : ""}><span>${escapeHtml(accessory)}</span></label>
        `).join("") : `<p class="choice-empty">품목 종류를 선택하면 부속품이 표시됩니다.</p>`}
      </fieldset>
      <div class="form-grid">
        <label>브랜드
          <select name="productBrand${index + 1}" data-product-brand="${index}">
            ${brandOptions}
          </select>
        </label>
        <label class="custom-product-field ${customBrand ? "" : "is-hidden"}">브랜드 직접 입력
          <input name="productBrandCustom${index + 1}" placeholder="브랜드" value="${escapeHtml(customBrand)}">
        </label>
        <label>모델명
          <select name="productModel${index + 1}" data-product-model="${index}">
            ${modelOptions}
          </select>
        </label>
        <label class="custom-product-field ${customModel || product.modelName === "기타" ? "" : "is-hidden"}">모델명 직접 입력
          <input name="productModelCustom${index + 1}" placeholder="모델명" value="${escapeHtml(customModel)}">
        </label>
      </div>
      <fieldset class="choice-group product-note-group">
        <legend>중요</legend>
        ${PRODUCT_NOTE_OPTIONS.map((note) => `
          <label><input type="checkbox" name="productNoteOption${index + 1}" value="${escapeHtml(note)}" ${selectedNotes.has(note) ? "checked" : ""}><span>${escapeHtml(note)}</span></label>
        `).join("")}
      </fieldset>
      <label>기타 사항
        <input name="productNote${index + 1}" placeholder="기타 중요 내용 직접 입력" value="${escapeHtml(customNote)}">
      </label>
    </div>
  `;
  refreshProductIndexButtons();
}

function readProductDetails() {
  saveActiveProductSlot();
  return state.productSlots.map((product) => normalizeProductSlot(product));
}

function setProductDetails(products = []) {
  const firstSlotTypes = normalizeProductSlot(state.productSlots[0]).types;
  state.productSlots = Array.from({ length: 5 }, (_, index) => {
    const normalized = normalizeProductSlot(products[index] || emptyProductSlot());
    if (index === 0 && !normalized.types.length && firstSlotTypes.length) normalized.types = firstSlotTypes;
    return normalized;
  });
  state.activeProductIndex = 0;
  refreshProductIndexButtons();
  renderProductFields();
  const first = state.productSlots.find((item) => item.brand || item.modelName) || {};
  orderForm.elements.brand.value = first.brand || "";
  orderForm.elements.modelName.value = first.modelName || "";
}

function getProductTypes() {
  return Array.from(new Set(readProductDetails().flatMap((item) => item.types || [])));
}

function buildOrderMemo(baseMemo, doorInfo, dateRange) {
  const products = readProductDetails().filter((item) => item.types.length || item.brand || item.modelName || item.accessories.length || item.note);
  const importantMemo = fieldValue("specialMemo");
  const allAccessories = [...new Set(products.flatMap((item) => item.accessories || []))];
  const productNotes = [...new Set(products.flatMap((item) => extractProductNoteTags(item.note || "")))];
  const importantParts = [...new Set([importantMemo, ...productNotes, usesBOrderFormat() && fieldValue("contamination") ? fieldValue("contamination") : ""].filter(Boolean))];
  return [
    products.length ? `품목 정보:\n${products.map((item) => {
      const parts = [item.types.join("/"), item.brand, item.modelName].filter(Boolean);
      if (item.accessories.length) parts.push(`부속품: ${item.accessories.join(", ")}`);
      if (item.note) parts.push(`요청: ${item.note}`);
      return parts.join(" ");
    }).join("\n")}` : "",
    allAccessories.length ? `부속품: ${allAccessories.join(", ")}` : "",
    importantParts.length ? `중요: ${importantParts.join(", ")}` : "",
    usesBOrderFormat() && fieldValue("contactTail") ? `연락처 뒷번호: ${fieldValue("contactTail")}` : "",
    doorInfo ? `공동현관/비밀번호: ${doorInfo}` : "",
    dateRange ? `${state.orderType === "B" || state.orderType === "AB" ? "접수일자" : "시작일자 / 완료일자"}: ${dateRange}` : "",
    usesBOrderFormat() && fieldValue("contamination") ? `오염: ${fieldValue("contamination")}` : "",
    fieldValue("price") ? `비용: ${fieldValue("price")}` : "",
    usesBOrderFormat() && fieldValue("payment") ? `결제 여부: ${fieldValue("payment")}` : "",
    baseMemo || "",
  ].filter(Boolean).join("\n");
}

function fieldValue(name) {
  return orderForm.elements[name]?.value?.trim() || "";
}

function setOrderType(type) {
  state.orderType = type;
  document.querySelectorAll("[data-order-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.orderType === type);
  });
  updateOrderTypeFields();
}

function updateOrderTypeFields() {
  const visibleByType = {
    A: ["serial", "dateRange", "address", "productDetails", "customerName", "price"],
    B: ["serial", "contactTail", "dateRange", "productDetails", "contamination", "price", "payment"],
    AB: ["serial", "contactTail", "dateRange", "productDetails", "contamination", "price", "payment"],
    BA: ["serial", "dateRange", "address", "productDetails", "customerName", "price"],
  };
  const visible = new Set(visibleByType[state.orderType] || visibleByType.A);
  document.querySelectorAll("[data-order-field]").forEach((field) => {
    field.hidden = !visible.has(field.dataset.orderField);
  });
  setFieldLabel("dateRange", "접수일자");
  setFieldLabel("productType", "품목 종류");
}

function setFieldLabel(name, text) {
  const field = document.querySelector(`[data-order-field="${name}"]`);
  if (!field) return;
  if (field.tagName === "FIELDSET") {
    const legend = field.querySelector("legend");
    if (legend) legend.textContent = text;
    return;
  }
  const textNode = Array.from(field.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = text;
}

document.querySelector("#takePhotoButton").addEventListener("click", () => {
  takeNativeCameraPhotos().catch((error) => alert(error.message || "카메라를 열지 못했습니다."));
});
document.querySelector("#pickPhotoButton").addEventListener("click", () => {
  pickNativeGalleryPhotos().catch((error) => alert(error.message || "갤러리를 열지 못했습니다."));
});
document.querySelector("#parseOrderPasteButton").addEventListener("click", parseOrderPaste);
setOrderType("A");
renderProductFields();
cameraInput.addEventListener("change", () => handlePhotoInput(cameraInput, "사진 촬영"));
galleryInput.addEventListener("change", () => handlePhotoInput(galleryInput, "갤러리"));

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.savingOrder) return;
  state.savingOrder = true;
  const submitButton = orderForm.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    const form = new FormData(orderForm);
    const payload = Object.fromEntries(form.entries());
    const usesBFormat = state.orderType === "B" || state.orderType === "AB";
    const doorInfo = usesBFormat ? "" : form.get("doorInfo")?.trim() || "";
    const dateRange = normalizeOrderDateRange(form.get("dateRange")?.trim() || "");
    if (orderForm.elements.dateRange) orderForm.elements.dateRange.value = dateRange;
    const products = readProductDetails();
    const firstProduct = products.find((item) => item.brand || item.modelName) || {};
    payload.serial = serialForOrderType(payload.serial);
    payload.phone = null;
    payload.productType = getProductTypes().join(", ");
    payload.brand = firstProduct.brand || payload.brand || null;
    payload.modelName = firstProduct.modelName || payload.modelName || null;
    payload.requestMemo = buildOrderMemo(form.get("requestMemo")?.trim() || "", doorInfo, dateRange);
    payload.customerName = usesBFormat ? null : fieldValue("customerName") || null;
    payload.address = usesBFormat ? null : payload.address || null;
    delete payload.doorInfo;
    delete payload.dateRange;
    delete payload.contactTail;
    delete payload.contamination;
    delete payload.price;
    delete payload.payment;
    delete payload.activeProductType;
    delete payload.specialMemo;
    Object.keys(payload).forEach((key) => {
      if (/^product(?:Brand|Model|Note|Accessory)/.test(key)) delete payload[key];
    });
    state.tab = "work";
    syncEnteredTabDateEnd();
    orderDialog.close();
    showUploadProgress(0, 1, "작업 저장 중");
    await waitForPaint();
    const created = await api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
    showUploadProgress(1, 1, "작업 저장 완료");
    await waitForPaint();
    orderForm.reset();
    setProductDetails([]);
    orderPasteInput.value = "";
    replaceOrderInState(created.order);
    state.selectedOrderId = created.order.id;
    state.selectedStep = orderStep(created.order);
    clearPhotoSelection();
    state.expandedPhotoId = null;
    pushAppHistory();
    render();
    showToast("완료되었습니다.");
  } catch (error) {
    alert(error.message || "작업 저장에 실패했습니다.");
  } finally {
    hideUploadProgress();
    state.savingOrder = false;
    if (submitButton) submitButton.disabled = false;
  }
});

editOrderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const orderId = editOrderForm.dataset.orderId;
  if (!orderId) return;
  const form = new FormData(editOrderForm);
  const productType = Array.from(editOrderForm.querySelectorAll('input[name="productType"]:checked')).map((input) => input.value).join(", ");
  const payload = {
    serial: form.get("serial")?.trim() || "",
    customerName: form.get("customerName")?.trim() || null,
    phone: null,
    address: form.get("address")?.trim() || null,
    productType: productType || null,
    brand: form.get("brand")?.trim() || null,
    modelName: form.get("modelName")?.trim() || null,
    requestMemo: updateOrderImportantMemoText(form.get("requestMemo")?.trim() || "", form.get("specialMemo")?.trim() || "") || null,
  };
  const submitButton = editOrderForm.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    setGlobalLoading("저장 중...");
    await waitForPaint();
    const result = await api(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify(payload) });
    editOrderDialog.close();
    replaceOrderInState(result.order);
    state.selectedOrderId = orderId;
    render();
    showToast("완료되었습니다.");
  } catch (error) {
    alert(error.message || "정보 수정에 실패했습니다.");
  } finally {
    setGlobalLoading("");
    if (submitButton) submitButton.disabled = false;
  }
});

photoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.savingPhoto) return;
  if (!state.pendingPhotos.length) {
    alert("사진 또는 동영상을 먼저 선택해 주세요.");
    return;
  }
  if (state.pendingPhotos.length > PHOTO_UPLOAD_MAX_COUNT) {
    alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다.`);
    return;
  }
  const quickListOrderId = state.quickListPhotoOrderId;
  const order = state.data.orders.find((item) => item.id === (quickListOrderId || state.selectedOrderId));
  if (!order) {
    state.quickListPhotoOrderId = null;
    releasePendingPhotos();
    photoPreview.innerHTML = `<div class="preview-empty">사진 찍기 또는 갤러리를 선택해 주세요.</div>`;
    if (photoDialog.open) photoDialog.close();
    alert("사진을 업로드할 품목을 찾지 못했습니다. 새로고침 후 다시 시도해주세요.");
    return;
  }
  state.savingPhoto = true;
  const submitButton = photoForm.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  const selectedStep = state.selectedStep;
  const memo = photoMemo.value;
  const pendingPhotos = [...state.pendingPhotos];
  const shouldAdvance = state.quickPhotoAdvance;
  const shouldMoveNext = shouldAdvance && confirmStepMove("next");
  state.quickPhotoAdvance = false;
  if (photoDialog.open) photoDialog.close();
  try {
    const total = pendingPhotos.length;
    showUploadProgress(0, total, "사진 업로드 준비 중");
    await waitForPaint();

    showUploadProgress(0, total, "사진 업로드 중");
    await waitForPaint();
    const uploadResult = await uploadPhotoBatches(order, pendingPhotos, selectedStep, memo, showUploadProgress, shouldMoveNext);
    showUploadProgress(total, total, "사진 저장 완료");
    await waitForPaint();

    releasePendingPhotos();
    photoMemo.value = "";
    replaceOrderInState(uploadResult.order);
    const updated = uploadResult.order;
    if (quickListOrderId) {
      state.selectedOrderId = null;
      state.selectedStep = selectedStep;
    } else if (shouldAdvance) {
      state.selectedOrderId = null;
      state.selectedStep = shouldMoveNext ? updated?.currentStep || selectedStep : selectedStep;
    } else {
      state.selectedOrderId = order.id;
      state.selectedStep = selectedStep;
    }
    render();
    showToast("완료되었습니다.");
  } catch (error) {
    state.quickPhotoAdvance = false;
    alert(error.message || "사진 저장에 실패했습니다.");
  } finally {
    state.quickListPhotoOrderId = null;
    hideUploadProgress();
    state.savingPhoto = false;
    if (submitButton) submitButton.disabled = false;
  }
});

content.addEventListener("submit", async (event) => {
  if (event.target.id === "adminLoginForm") {
    event.preventDefault();
    await submitAdminLogin(event.target);
    return;
  }
  if (event.target.id === "adminPasswordForm") {
    event.preventDefault();
    await submitAdminPasswordChange(event.target);
    return;
  }
  if (event.target.id === "naverCafeSettingsForm") {
    event.preventDefault();
    await submitNaverCafeSettings(event.target);
    return;
  }
  if (event.target.id === "chatComposer") {
    event.preventDefault();
    await sendChatMessage(event.target);
    return;
  }
  if (event.target.id === "chatTransferForm") {
    event.preventDefault();
    await sendChatAttachmentToOrder(event.target);
    return;
  }
  if (event.target.dataset.attendanceTimeForm) {
    event.preventDefault();
    try {
      await saveAttendanceDayTime(event.target);
      render();
    } catch (error) {
      alert(error.message || "근태 시간을 저장하지 못했습니다.");
    }
    return;
  }
  if (event.target.id !== "keepNoteForm") return;
  event.preventDefault();
  try {
    await saveKeepNote(event.target);
  } catch (error) {
    alert(error.message || "메모 저장에 실패했습니다.");
  }
});

content.addEventListener("input", (event) => {
  if (event.target.id === "searchInput") {
    state.query = event.target.value;
    if (state.tab === "chat") {
      state.chatSearchIndex = 0;
      refreshChatFeed();
    }
    else refreshOrderList();
  }
  if (event.target.id === "chatTransferSerialInput") {
    syncChatTransferOrderBySerial(event.target.value);
  }
  if (event.target.id === "chatMessageInput") {
    refreshChatComposerTarget();
  }
  if (event.target.dataset.smsMessageTarget) {
    state.smsMessageDrafts[event.target.dataset.smsMessageTarget] = event.target.value.slice(0, 4000);
  }
  if (event.target.id === "customerShareMemo") {
    state.customerShareMemo = event.target.value.slice(0, 2000);
    refreshSharePreviews();
  }
  if (event.target.closest("#payrollSettingForm")) {
    refreshPayrollPreview();
  }
});

content.addEventListener("change", (event) => {
  if (event.target.closest("#payrollSettingForm")) {
    refreshPayrollPreview();
  }
  if (event.target.id === "chatPhotoInput") {
    addChatFiles(event.target.files).catch((error) => alert(error.message || "사진을 불러오지 못했습니다."));
    event.target.value = "";
    return;
  }
  if (event.target.id === "dateStartInput") {
    setActiveDateRange("start", event.target.value);
    refreshOrderList();
    replaceAppHistory();
  }
  if (event.target.id === "dateEndInput") {
    setActiveDateRange("end", event.target.value);
    refreshOrderList();
    replaceAppHistory();
  }
});

orderForm.addEventListener("change", (event) => {
  if (event.target.name === "activeProductType") {
    saveActiveProductSlot();
    renderProductFields();
  }
  if (event.target.dataset.productBrand !== undefined) {
    refreshProductModelSelect(Number(event.target.dataset.productBrand));
  }
  if (event.target.dataset.productModel !== undefined) {
    toggleCustomProductFields(Number(event.target.dataset.productModel));
  }
  if (event.target.closest?.("#productFields")) {
    saveActiveProductSlot();
    refreshProductIndexButtons();
  }
});

orderForm.addEventListener("input", (event) => {
  if (!event.target.closest?.("#productFields")) return;
  saveActiveProductSlot();
  refreshProductIndexButtons();
});

document.addEventListener("click", handleClick);
document.addEventListener("dblclick", (event) => {
  event.preventDefault();
}, { passive: false });
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (state.tab === "more") render();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (state.tab === "more") render();
});
document.addEventListener("keydown", async (event) => {
  const listPhotoAddTarget = event.target.closest?.("[data-list-photo-add]");
  const urgentTarget = event.target.closest?.("[data-urgent-order]");
  const todayTaskTarget = event.target.closest?.("[data-today-task-order]");
  const quickMemoTarget = event.target.closest?.("[data-quick-memo]");
  if (!["Enter", " "].includes(event.key)) return;
  if (listPhotoAddTarget) {
    event.preventDefault();
    openListPhotoStepPicker(listPhotoAddTarget.dataset.listPhotoAdd);
    return;
  }
  if (urgentTarget) {
    event.preventDefault();
    await toggleOrderUrgent(urgentTarget.dataset.urgentOrder);
    return;
  }
  if (todayTaskTarget) {
    event.preventDefault();
    await toggleOrderTodayTask(todayTaskTarget.dataset.todayTaskOrder);
    return;
  }
  if (quickMemoTarget) {
    event.preventDefault();
    await quickEditMemoField(quickMemoTarget.dataset.quickMemo, quickMemoTarget.dataset.memoField);
  }
});
document.addEventListener("pointerdown", handleDoneOrderPointerDown);
document.addEventListener("pointerup", handleDoneOrderPointerEnd);
document.addEventListener("pointercancel", handleDoneOrderPointerEnd);
document.addEventListener("pointerdown", handlePhotoPointerDown, { passive: false });
document.addEventListener("pointerdown", handleLightboxPointerDown);
document.addEventListener("pointermove", handlePhotoPointerMove, { passive: false });
document.addEventListener("pointermove", handleLightboxPointerMove);
document.addEventListener("touchmove", handlePhotoSelectionTouchMove, { passive: false });
document.addEventListener("pointerup", handlePhotoPointerEnd);
document.addEventListener("pointerup", handleLightboxPointerEnd);
document.addEventListener("pointercancel", handlePhotoPointerEnd);
document.addEventListener("pointercancel", cancelLightboxSwipe);
document.addEventListener("click", handlePhotoTap);
document.querySelector("#refreshButton").addEventListener("click", async () => {
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
    if (reg) {
      await reg.update().catch(() => null);
    }
  }
  window.location.reload();
});

window.addEventListener("popstate", (event) => {
  if (state.chatExpandedAttachmentId) {
    state.chatExpandedAttachmentId = null;
    resetLightboxZoom();
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    render();
    return;
  }
  if (state.trashExpandedPhotoId) {
    state.trashExpandedPhotoId = null;
    resetLightboxZoom();
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    render();
    return;
  }
  if (state.expandedPhotoId) {
    state.expandedPhotoId = null;
    state.expandedPhotoReturnTab = null;
    resetLightboxZoom();
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    render();
    return;
  }
  if (state.photoSelectionMode) {
    clearPhotoSelection();
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    render();
    return;
  }
  if (state.doneOrderSelectionMode) {
    clearDoneOrderSelection();
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    render();
    return;
  }
  if (event.state?.exitGuard) {
    if (state.allowExit) return;
    if (confirm("종료하시겠습니까?")) {
      state.allowExit = true;
      history.back();
      return;
    }
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
    return;
  }
  if (event.state) {
    applyHistoryState(event.state);
    return;
  }
  if (state.selectedOrderId) {
    state.selectedOrderId = null;
    clearPhotoSelection();
    state.expandedPhotoId = null;
    replaceAppHistory();
    render();
    return;
  }
  if (!confirm("종료하시겠습니까?")) {
    history.pushState(appHistoryState(), "", window.location.pathname + window.location.search);
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "open-chat-receipt") openReceiptChatFromNotification();
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      });
    });
  }).catch(() => {});
}

setInterval(pollChatMessages, CHAT_POLL_INTERVAL_MS);

load().catch((error) => {
  content.innerHTML = `<section class="panel">${escapeHtml(error.message)}</section>`;
});

