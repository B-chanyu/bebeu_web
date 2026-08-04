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
  return user?.role === "관리자" || user?.role === "愿由ъ옄";
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
