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
