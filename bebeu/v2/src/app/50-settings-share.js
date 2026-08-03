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
