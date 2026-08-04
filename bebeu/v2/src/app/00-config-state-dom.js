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
const CUSTOMER_SHARE_CACHE_VERSION = "305";

const state = {
  tab: "me",
  data: null,
  currentUserId: localStorage.getItem("bebeu.currentUserId") || "",
  selectedOrderId: null,
  selectedStep: "all",
  query: "",
  chatSearchIndex: 0,
  preserveChatScrollOnRender: false,
  preservedChatScrollTop: 0,
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
