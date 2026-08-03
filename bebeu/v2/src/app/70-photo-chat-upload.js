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
