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
