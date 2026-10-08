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

const uploadReadyImages = new WeakSet();

async function readyUploadFile(media) {
  if (media.filePromise) await media.filePromise;
  if (media.fileError) throw media.fileError;
  const file = media.displayFile || media.file;
  if (!file) throw new Error("사진을 준비하지 못했습니다. 다시 선택해 주세요.");
  return file;
}

async function receiveDroppedPhotos(files, x, y) {
  if (!state.data || !files.length) return;
  if (photoDialog.open) {
    await handleSelectedFiles(files, "드래그 추가");
    return;
  }
  if (document.querySelector("dialog[open]")) return;
  if (state.tab === "chat") {
    await addChatFiles(files);
    return;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const card = document.elementFromPoint(x, y)?.closest("[data-order-card-id]");
  if (card && ["work", "done"].includes(state.tab)) {
    openListPhotoStepPicker(card.dataset.orderCardId, files);
  }
}

document.addEventListener("dragover", (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
document.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files || []).filter((file) => /^image\//.test(file.type));
  if (!files.length) return;
  event.preventDefault();
  receiveDroppedPhotos(files, event.clientX, event.clientY).catch((error) => alert(error.message));
});
window.addEventListener("bebeuPhotoDrop", async (event) => {
  try {
    // Capacitor triggerJSEvent puts data on the Event itself, not detail.
    const payload = event.detail && typeof event.detail === "object" ? event.detail : event;
    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    if (!photos.length) return;
    const x = Number(payload.x);
    const y = Number(payload.y);
    const files = await Promise.all(photos.map((photo, index) => nativePhotoFile(photo, index, "drop")));
    await receiveDroppedPhotos(files, x, y);
  } catch (error) {
    alert(error.message || "드래그한 사진을 읽지 못했습니다.");
  }
});
window.addEventListener("bebeuPhotoDropError", () => {
  alert("드래그한 사진을 읽지 못했습니다. 갤러리에서 다시 선택해 주세요.");
});

async function prepareMediaFiles(files, sourceLabel) {
  const results = new Array(files.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2, files.length) }, async () => {
    while (next < files.length) {
      const index = next++;
      results[index] = await preparePendingMedia(files[index], sourceLabel);
    }
  }));
  return results;
}

function imageBlobToFile(blob, originalName) {
  const base = String(originalName || "photo").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}_display.jpg`, { type: "image/jpeg" });
}

async function createDisplayImageFile(file, maxSize = 1400, quality = 0.72) {
  if (!file.type.startsWith("image/")) return null;
  if (uploadReadyImages.has(file)) return file;
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
    type: blob.type.startsWith("image/") ? blob.type : `image/${format === "jpg" ? "jpeg" : format}`,
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
    const result = await camera.pickImages({ quality: 72, width: 1400, height: 1400, limit: availableCount });
    const photos = Array.from(result.photos || []).slice(0, availableCount);
    const selected = photos.map((photo, index) => ({
      file: null,
      displayFile: null,
      previewUrl: photo.webPath || window.Capacitor.convertFileSrc(photo.path),
      originalName: `gallery_${Date.now()}_${index + 1}.jpg`,
      mimeType: "image/jpeg",
      isVideo: false,
      sourceLabel: "갤러리",
      nativePreview: true,
    }));
    state.pendingPhotos.push(...selected);
    renderPendingPhotos("갤러리");
    let nextPhoto = 0;
    const jobs = new Array(photos.length);
    const resolvers = selected.map((media, index) => {
      media.filePromise = new Promise((resolve) => { jobs[index] = resolve; });
      return jobs[index];
    });
    Promise.all(Array.from({ length: Math.min(2, photos.length) }, async () => {
      while (nextPhoto < photos.length) {
        const index = nextPhoto++;
        try {
          const file = await nativePhotoFile(photos[index], index, "gallery");
          uploadReadyImages.add(file);
          selected[index].file = file;
          selected[index].displayFile = file;
        } catch (error) {
          selected[index].fileError = error;
        } finally {
          resolvers[index]();
        }
      }
    })).catch(() => {});
  } catch (error) {
    if (!/cancel/i.test(String(error?.message || error))) throw error;
  }
}

function capturedPhotoFile(video, index) {
  return new Promise((resolve, reject) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      reject(new Error("카메라 화면을 준비하고 있습니다. 잠시 후 다시 촬영해 주세요."));
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("촬영한 사진을 저장하지 못했습니다."));
        return;
      }
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
      const file = new File([blob], `camera_${stamp}_${String(index + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" });
      uploadReadyImages.add(file);
      resolve(file);
    }, "image/jpeg", 0.72);
  });
}

async function requestContinuousCameraStream(facingMode = "environment") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 기기에서는 앱 내부 연속 촬영을 지원하지 않습니다.");
  }
  const camera = nativeCameraPlugin();
  if (camera?.requestPermissions) {
    const permission = await camera.requestPermissions({ permissions: ["camera"] });
    if (permission?.camera === "denied") throw new Error("카메라 권한을 허용해 주세요.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  } catch (error) {
    if (/permission|denied|notallowed/i.test(String(error?.name || error?.message || error))) {
      throw new Error("카메라 권한을 허용해 주세요.");
    }
    throw new Error("카메라를 시작하지 못했습니다.");
  }
}

function openContinuousCamera(availableCount) {
  return new Promise((resolve, reject) => {
    const dialog = document.createElement("dialog");
    dialog.className = "continuous-camera-dialog";
    dialog.innerHTML = `
      <section class="continuous-camera-shell">
        <header class="continuous-camera-head">
          <button class="camera-icon-button" type="button" data-camera-command="cancel" aria-label="촬영 취소">×</button>
          <strong data-camera-title>사진 촬영</strong>
          <span class="camera-count" data-camera-count>0 / ${availableCount}</span>
        </header>
        <section class="continuous-camera-live" data-camera-live>
          <video autoplay muted playsinline aria-label="카메라 화면"></video>
          <div class="camera-flash" aria-hidden="true"></div>
        </section>
        <section class="continuous-camera-review" data-camera-review hidden>
          <div class="camera-review-head">
            <div>
              <strong>촬영한 사진 확인</strong>
              <p>사진을 눌러 포함 여부를 선택하고, 휴지통으로 삭제할 수 있습니다.</p>
            </div>
            <button class="camera-text-button" type="button" data-camera-command="select-all">전체 선택</button>
          </div>
          <div class="camera-review-grid" data-camera-review-grid></div>
        </section>
        <div class="continuous-camera-strip" data-camera-strip aria-label="촬영한 사진"></div>
        <footer class="continuous-camera-controls" data-camera-live-controls>
          <span class="camera-control-spacer"></span>
          <button class="camera-shutter" type="button" data-camera-command="capture" aria-label="사진 촬영"><span></span></button>
          <button class="camera-next-button" type="button" data-camera-command="next" disabled>다음</button>
        </footer>
        <footer class="camera-review-controls" data-camera-review-controls hidden>
          <button class="secondary-button" type="button" data-camera-command="retake">더 찍기</button>
          <button class="primary-button" type="button" data-camera-command="complete">완료</button>
        </footer>
      </section>
    `;

    const video = dialog.querySelector("video");
    const live = dialog.querySelector("[data-camera-live]");
    const review = dialog.querySelector("[data-camera-review]");
    const strip = dialog.querySelector("[data-camera-strip]");
    const reviewGrid = dialog.querySelector("[data-camera-review-grid]");
    const liveControls = dialog.querySelector("[data-camera-live-controls]");
    const reviewControls = dialog.querySelector("[data-camera-review-controls]");
    const title = dialog.querySelector("[data-camera-title]");
    const count = dialog.querySelector("[data-camera-count]");
    const nextButton = dialog.querySelector('[data-camera-command="next"]');
    const completeButton = dialog.querySelector('[data-camera-command="complete"]');
    const items = [];
    let stream = null;
    let closed = false;

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      video.srcObject = null;
    };
    const releaseItems = () => items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    const finish = (files) => {
      if (closed) return;
      closed = true;
      stopStream();
      releaseItems();
      dialog.close();
      dialog.remove();
      resolve(files);
    };
    const fail = (error) => {
      if (closed) return;
      closed = true;
      stopStream();
      releaseItems();
      dialog.close();
      dialog.remove();
      reject(error);
    };
    const selectedFiles = () => items.filter((item) => item.selected && item.file).map((item) => item.file);
    const renderStrip = () => {
      strip.innerHTML = items.map((item, index) => `
        ${item.url
          ? `<img src="${item.url}" alt="촬영한 사진 ${index + 1}">`
          : `<span class="camera-capture-pending" aria-label="사진 ${index + 1} 저장 중">저장 중</span>`}
      `).join("");
      strip.hidden = !items.length || review.hidden === false;
      count.textContent = `${items.length} / ${availableCount}`;
      nextButton.disabled = !items.length || items.some((item) => item.pending);
    };
    const renderReview = () => {
      reviewGrid.innerHTML = items.map((item, index) => `
        <article class="camera-review-item${item.selected ? " is-selected" : ""}" data-camera-photo="${index}">
          <button class="camera-review-toggle" type="button" data-camera-command="toggle" data-camera-index="${index}" aria-label="사진 ${index + 1} ${item.selected ? "선택 해제" : "선택"}">
            <img src="${item.url}" alt="촬영한 사진 ${index + 1}">
            <span>${item.selected ? "✓" : ""}</span>
          </button>
          <button class="camera-review-delete" type="button" data-camera-command="delete" data-camera-index="${index}" aria-label="사진 ${index + 1} 삭제">⌫</button>
        </article>
      `).join("");
      const selectedCount = selectedFiles().length;
      count.textContent = `${selectedCount}장 선택`;
      completeButton.disabled = selectedCount === 0;
    };
    const startStream = async () => {
      stopStream();
      stream = await requestContinuousCameraStream();
      video.srcObject = stream;
      await video.play();
    };
    const showLive = async () => {
      review.hidden = true;
      reviewControls.hidden = true;
      live.hidden = false;
      liveControls.hidden = false;
      title.textContent = "사진 촬영";
      renderStrip();
      await startStream();
    };
    const showReview = () => {
      stopStream();
      live.hidden = true;
      liveControls.hidden = true;
      strip.hidden = true;
      review.hidden = false;
      reviewControls.hidden = false;
      title.textContent = "사진 확인";
      renderReview();
    };

    const captureImmediately = async () => {
      if (closed || review.hidden === false || items.length >= availableCount) return;
      const index = items.length;
      const filePromise = capturedPhotoFile(video, index);
      const item = { file: null, url: "", selected: true, pending: true };
      items.push(item);

      const flash = dialog.querySelector(".camera-flash");
      flash.classList.remove("is-active");
      void flash.offsetWidth;
      flash.classList.add("is-active");
      renderStrip();
      strip.scrollLeft = strip.scrollWidth;

      const file = await filePromise;
      if (closed) return;
      item.file = file;
      item.url = URL.createObjectURL(file);
      item.pending = false;
      renderStrip();
      strip.scrollLeft = strip.scrollWidth;
      if (items.length >= availableCount && !items.some((entry) => entry.pending) && review.hidden) {
        showReview();
      }
    };

    dialog.addEventListener("pointerdown", (event) => {
      const button = event.target.closest('[data-camera-command="capture"]');
      if (!button || button.disabled) return;
      event.preventDefault();
      captureImmediately().catch(fail);
    });

    dialog.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-camera-command]");
      if (!button || button.disabled) return;
      const command = button.dataset.cameraCommand;
      try {
        if (command === "cancel") {
          finish([]);
        } else if (command === "capture") {
          if (event.detail === 0) await captureImmediately();
        } else if (command === "next") {
          showReview();
        } else if (command === "retake") {
          await showLive();
        } else if (command === "toggle") {
          const item = items[Number(button.dataset.cameraIndex)];
          if (item) item.selected = !item.selected;
          renderReview();
        } else if (command === "delete") {
          const index = Number(button.dataset.cameraIndex);
          const [removed] = items.splice(index, 1);
          if (removed) URL.revokeObjectURL(removed.url);
          if (!items.length) await showLive();
          else renderReview();
        } else if (command === "select-all") {
          const shouldSelect = items.some((item) => !item.selected);
          items.forEach((item) => { item.selected = shouldSelect; });
          renderReview();
        } else if (command === "complete") {
          finish(selectedFiles());
        }
      } catch (error) {
        fail(error);
      }
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish([]);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    startStream().catch(fail);
  });
}

async function takeNativeCameraPhotos() {
  const availableCount = Math.max(0, PHOTO_UPLOAD_MAX_COUNT - state.pendingPhotos.length);
  if (!availableCount) {
    alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다.`);
    return;
  }
  const files = await openContinuousCamera(availableCount);
  if (files.length) await handleSelectedFiles(files, "사진 찍기");
}

async function handleWebCameraInput() {
  const selectedFiles = Array.from(cameraInput.files || []);
  cameraInput.value = "";
  if (!selectedFiles.length) return;

  await handleSelectedFiles(selectedFiles, "사진 찍기");
}

async function handleSelectedFiles(selectedFiles, sourceLabel) {
  const availableCount = Math.max(0, PHOTO_UPLOAD_MAX_COUNT - state.pendingPhotos.length);
  const files = selectedFiles.slice(0, availableCount);
  if (!files.length) return;
  if (selectedFiles.length > files.length) {
    alert(`사진은 한 번에 최대 ${PHOTO_UPLOAD_MAX_COUNT}장까지 올릴 수 있습니다. 초과한 사진은 제외했습니다.`);
  }
  photoPreview.innerHTML = `<div class="preview-empty">사진을 가볍게 준비하는 중입니다.</div>`;
  await waitForPaint();
  const loaded = await prepareMediaFiles(files, sourceLabel);
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
          ${item.isVideo ? `<video src="${item.previewUrl}" controls playsinline preload="metadata"></video>` : `<img src="${item.previewUrl}" alt="사진 미리보기" loading="lazy" decoding="async">`}
          <span>${escapeHtml(item.originalName)}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function removePendingPhoto(index) {
  const [removed] = state.pendingPhotos.splice(index, 1);
  if (removed?.previewUrl && !removed.nativePreview) URL.revokeObjectURL(removed.previewUrl);
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
    if (item.previewUrl && !item.nativePreview) URL.revokeObjectURL(item.previewUrl);
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
  const prepared = await prepareMediaFiles(picked, "채팅");
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
