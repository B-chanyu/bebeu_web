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
