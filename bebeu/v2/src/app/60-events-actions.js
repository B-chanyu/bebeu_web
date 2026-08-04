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
    if (!user) return;
    state.pendingAdminLoginUserId = user.id;
    state.adminLoginError = "";
    render();
    requestAnimationFrame(() => document.querySelector("#adminLoginForm input[name='password']")?.focus());
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
    rememberChatScrollForRender();
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
  if (target.dataset.deleteMember) {
    await deleteMember(target.dataset.deleteMember);
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

async function submitMemberManagement(form) {
  if (!isAdminUser()) return;
  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    role: String(formData.get("role") || "직원"),
    password: String(formData.get("password") || ""),
  };
  if (!payload.name) {
    alert("멤버 이름을 입력해주세요.");
    return;
  }
  if (payload.password && payload.password.length < 4) {
    alert("비밀번호는 4자리 이상으로 입력해주세요.");
    return;
  }
  try {
    setGlobalLoading("멤버 추가 중...");
    await waitForPaint();
    const result = await api("/api/members", { method: "POST", body: JSON.stringify(payload) });
    state.data.users = result.users || state.data.users;
    form.reset();
    render();
    showToast("멤버가 추가되었습니다.");
  } catch (error) {
    alert(error.message || "멤버를 추가하지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
}

async function deleteMember(userId) {
  if (!isAdminUser()) return;
  const member = state.data.users.find((item) => item.id === userId);
  if (!member) return;
  if (!confirm(`${member.name} 멤버를 삭제하시겠습니까?`)) return;
  try {
    setGlobalLoading("멤버 삭제 중...");
    await waitForPaint();
    const result = await api(`/api/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
    state.data.users = result.users || state.data.users;
    render();
    showToast("멤버가 삭제되었습니다.");
  } catch (error) {
    alert(error.message || "멤버를 삭제하지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
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
  rememberChatScrollForRender();
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
      rememberChatScrollForRender();
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
