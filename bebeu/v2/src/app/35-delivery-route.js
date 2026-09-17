const BEBEU_STORE_LOCATION = {
  name: "베베유",
  address: "전남광주 광산구 첨단내촌로57번길 6",
  latitude: 35.220365,
  longitude: 126.847487,
};
let naverMapScriptPromise = null;
let deliveryMapInstance = null;
let deliveryCurrentMarker = null;
let deliveryWorkerMarker = null;
let deliveryWorkerLocationWatchId = null;
let deliveryLocationPollTimer = null;
let deliveryLocationStreamController = null;
let deliveryLocationStreamRetryTimer = null;
let lastDeliveryLocationSaveAt = 0;
let lastDeliveryLocationSent = null;
let deliveryRouteDrag = null;

function deliveryJobs() {
  return Array.isArray(state.data?.deliveryJobs) ? state.data.deliveryJobs : [];
}

function activeDeliveryJobs() {
  return deliveryJobs().filter((job) => job.status !== "배송 완료");
}

function deliveryAddressKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function deliveryJobForRouteItem(item) {
  const directId = String(item?.orderId || "");
  if (directId) return deliveryJobs().find((job) => job.orderId === directId) || null;
  const keys = [item?.address, item?.roadAddress, item?.jibunAddress].map(deliveryAddressKey).filter(Boolean);
  return deliveryJobs().find((job) => keys.includes(deliveryAddressKey(job.address))) || null;
}

function attachDeliveryJobsToRoute(route = []) {
  const available = [...deliveryJobs()];
  return route.map((item) => {
    if (item?.isStore) return item;
    const keys = [item?.address, item?.roadAddress, item?.jibunAddress].map(deliveryAddressKey).filter(Boolean);
    const index = available.findIndex((job) => keys.includes(deliveryAddressKey(job.address)));
    if (index < 0) return item;
    const [job] = available.splice(index, 1);
    return { ...item, orderId: job.orderId };
  });
}

function deliveryOrderPickerCandidates() {
  const activeIds = new Set(activeDeliveryJobs().map((job) => job.orderId));
  const query = String(state.deliveryOrderQuery || "").replace(/\s+/g, "").toLowerCase();
  return (state.data?.orders || [])
    .filter((order) => order.status === "완료" && String(order.address || "").trim() && !activeIds.has(order.id))
    .filter((order) => {
      if (!query) return true;
      return [order.serial, order.customerName, order.phone, order.address]
        .filter(Boolean)
        .some((value) => String(value).replace(/\s+/g, "").toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || 0) - new Date(a.completedAt || a.updatedAt || 0))
    .slice(0, 60);
}

function renderDeliveryOrderPickerContent() {
  const candidates = deliveryOrderPickerCandidates();
  const selected = new Set(state.selectedDeliveryOrderIds);
  return `
    <div class="delivery-order-picker-search">
      <input id="deliveryOrderSearchInput" type="search" value="${escapeHtml(state.deliveryOrderQuery || "")}" placeholder="품번, 고객명, 주소 검색" autocomplete="off">
    </div>
    <div class="delivery-order-picker-list">
      ${candidates.length ? candidates.map((order) => `
        <button class="delivery-order-picker-item ${selected.has(order.id) ? "is-selected" : ""}" type="button" data-delivery-order-select="${escapeHtml(order.id)}">
          <i aria-hidden="true">${selected.has(order.id) ? "✓" : ""}</i>
          <span>
            <strong>${escapeHtml(order.serial || "품번 없음")} ${order.customerName ? `· ${escapeHtml(order.customerName)}` : ""}</strong>
            <small>${escapeHtml(order.address || "주소 없음")}</small>
          </span>
        </button>
      `).join("") : `<p class="helper">추가할 수 있는 완료 항목이 없습니다.</p>`}
    </div>
    <div class="delivery-order-picker-actions">
      <button class="secondary-button" type="button" id="deliveryOrderPickerCloseButton">닫기</button>
      <button class="primary-button" type="button" id="deliveryOrdersAddButton" ${selected.size ? "" : "disabled"}>선택 ${selected.size}건 추가</button>
    </div>
  `;
}

function renderDeliveryOrderPicker() {
  if (!state.deliveryOrderPickerOpen) return "";
  return `<div class="delivery-order-picker" id="deliveryOrderPicker">${renderDeliveryOrderPickerContent()}</div>`;
}

function refreshDeliveryOrderPicker() {
  const picker = document.querySelector("#deliveryOrderPicker");
  if (!picker) return;
  picker.innerHTML = renderDeliveryOrderPickerContent();
  const input = picker.querySelector("#deliveryOrderSearchInput");
  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
}

function renderDeliveryJobs() {
  const jobs = deliveryJobs();
  const ready = jobs.filter((job) => job.status !== "배송 완료");
  const completed = jobs.filter((job) => job.status === "배송 완료").slice(0, 20);
  if (!jobs.length) return `<p class="helper">완료 목록에서 배송할 항목을 추가해 주세요.</p>`;
  const renderJob = (job) => `
    <li class="delivery-job-item ${job.status === "배송 완료" ? "is-completed" : ""}">
      <span class="delivery-job-status">${escapeHtml(job.status)}</span>
      <div>
        <strong>${escapeHtml(job.serial || "품번 없음")} ${job.customerName ? `· ${escapeHtml(job.customerName)}` : ""}</strong>
        <small>${escapeHtml(job.address)}</small>
      </div>
      ${job.status === "배송 완료"
        ? `<time>${escapeHtml(formatDeliveryLocationTime(job.completedAt))}</time>`
        : `<div class="delivery-job-actions">
            <button type="button" data-delivery-job-complete="${escapeHtml(job.orderId)}" ${job.plannedAt ? "" : "disabled"}>배송 완료</button>
            <button type="button" data-delivery-job-remove="${escapeHtml(job.orderId)}" aria-label="배송 목록에서 제거">×</button>
          </div>`}
    </li>
  `;
  return `
    ${ready.length ? `<ul class="delivery-job-list">${ready.map(renderJob).join("")}</ul>` : `<p class="helper">배송 전 항목이 없습니다.</p>`}
    ${completed.length ? `
      <details class="delivery-completed-jobs">
        <summary>배송 완료 ${completed.length}건</summary>
        <ul class="delivery-job-list">${completed.map(renderJob).join("")}</ul>
      </details>
    ` : ""}
  `;
}

function renderDelivery() {
  title.textContent = "배송";
  const addresses = deliveryAddressInputValue();
  const routeItems = state.deliveryRoute.length ? state.deliveryRoute : deliveryAddressLines(addresses).map((address) => ({ address }));
  const deliveryStopCount = routeItems.filter((item) => !item?.isStore).length;
  const routeReady = isDeliveryRouteReady();
  const hasMapKey = Boolean(state.data?.mapSettings?.naverMapsEnabled);
  const savedDeliveryLocation = state.data?.deliveryLocation;
  const deliveryLocationLabel = savedDeliveryLocation && isAdminUser()
    ? `${savedDeliveryLocation.userName || "배송"} 위치: ${formatDeliveryLocationTime(savedDeliveryLocation.updatedAt)}`
    : "";
  content.innerHTML = `
    <section class="panel stack delivery-panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">BEBEU ROUTE</p>
          <h2>배송 동선</h2>
        </div>
        <span class="chip">${deliveryStopCount}곳</span>
      </div>
      ${renderDeliveryMap(hasMapKey)}
      ${deliveryLocationLabel ? `<p class="helper" id="deliveryWorkerLocationLabel">${escapeHtml(deliveryLocationLabel)}</p>` : `<p class="helper" id="deliveryWorkerLocationLabel" hidden></p>`}
      ${hasMapKey ? "" : `<p class="helper">설정에서 네이버 지도 Client ID를 저장하면 실제 지도가 표시됩니다.</p>`}
      <p class="helper delivery-map-status" id="deliveryMapStatus" ${state.deliveryMapMessage ? "" : "hidden"}>${escapeHtml(state.deliveryMapMessage || "")}</p>
      <div class="delivery-action-row">
        <button class="primary-button" type="button" id="deliveryLocateButton">현재 위치로 이동</button>
      </div>
    </section>
    <section class="panel stack delivery-panel">
      <div class="section-title">
        <h3>주소 입력</h3>
        <span class="chip">한 줄에 한 곳</span>
      </div>
      <textarea id="deliveryAddressInput" class="delivery-address-input" rows="8" placeholder="예) 광주 광산구 상무대로 ...">${escapeHtml(addresses)}</textarea>
      <div class="delivery-add-row">
        <button class="secondary-button" type="button" id="deliveryOrderPickerButton">배송 추가</button>
        <span>${activeDeliveryJobs().length}건 배송 전</span>
      </div>
      ${renderDeliveryOrderPicker()}
      <div class="delivery-action-row delivery-route-actions">
        <button class="primary-button" type="button" id="deliveryOptimizeButton">최적 동선 만들기</button>
        ${routeReady ? `<button class="primary-button delivery-copy-button" type="button" id="deliveryCopyButton">복사</button>` : ""}
        <button class="secondary-button" type="button" id="deliveryClearButton">비우기</button>
      </div>
      ${state.deliveryRouteMessage ? `<p class="helper">${escapeHtml(state.deliveryRouteMessage)}</p>` : ""}
    </section>
    <section class="panel stack delivery-panel">
      <div class="section-title">
        <h3>배송 관리</h3>
        <span class="chip">DB 저장</span>
      </div>
      ${renderDeliveryJobs()}
    </section>
    <section class="panel stack delivery-panel">
      <div class="section-title">
        <h3>동선 순서</h3>
        <span class="chip">${routeItems.length ? "준비됨" : "대기"}</span>
      </div>
      ${routeItems.length ? `
        <ol class="delivery-route-list">
          ${state.deliveryRouteOrigin ? `
            <li class="is-origin">
              <span>출발</span>
              <div class="delivery-route-static">
                <strong>현재 위치</strong>
                <small>${escapeHtml(formatDeliveryCoordinates(state.deliveryRouteOrigin))}</small>
              </div>
            </li>
          ` : ""}
          ${routeItems.map((address, index) => {
            const job = deliveryJobForRouteItem(address);
            return `
            <li class="${address?.isStore ? "is-store" : ""} ${job?.status === "배송 완료" ? "is-completed" : ""}" ${address?.isStore ? "" : `data-delivery-route-index="${index}"`}>
              <span>${address?.isStore ? "도착" : index + 1}</span>
              ${address?.isStore ? `<i class="delivery-route-drag-placeholder" aria-hidden="true"></i>` : `<button class="delivery-route-drag-handle" type="button" data-delivery-drag-handle="${index}" aria-label="배송 순서 이동">↕</button>`}
              <div class="delivery-route-entry">
                <button type="button" data-open-delivery-address="${escapeHtml(deliveryRouteAddress(address))}">
                  <strong>${address?.isStore ? "베베유 사무실" : escapeHtml(job?.serial ? `${job.serial} · ${deliveryRouteAddress(address)}` : deliveryRouteAddress(address))}</strong>
                  ${address?.isStore ? `<small>${escapeHtml(deliveryRouteAddress(address))}</small>` : ""}
                  ${deliveryRouteMeta(address) ? `<small>${escapeHtml(deliveryRouteMeta(address))}</small>` : ""}
                </button>
                ${job && !address?.isStore ? `<button class="delivery-route-complete-button" type="button" data-delivery-job-complete="${escapeHtml(job.orderId)}" ${routeReady && job.status !== "배송 완료" ? "" : "disabled"}>${job.status === "배송 완료" ? "배송 완료됨" : "배송 완료"}</button>` : ""}
              </div>
            </li>
          `; }).join("")}
        </ol>
      ` : `<p class="helper">배송지 주소를 입력하면 동선 순서가 표시됩니다.</p>`}
    </section>
    ${isDeliveryOnlyUser() ? `
      <section class="panel stack delivery-logout-panel">
        <button class="danger-button" type="button" id="logoutButton">로그아웃</button>
      </section>
    ` : ""}
  `;
  initializeDeliveryMap();
  requestDeliveryLocationOnce();
  syncDeliveryLocationTracking();
}

function renderDeliveryMap(hasMapKey = false) {
  const location = state.deliveryLocation;
  const locationText = location
    ? `현재 위치: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : `${BEBEU_STORE_LOCATION.address} 기준으로 지도를 표시합니다. 위치 권한을 허용하면 현재 위치로 이동합니다.`;
  return `
    <div class="delivery-map-card ${hasMapKey ? "has-real-map" : ""}">
      <div id="deliveryNaverMap" class="delivery-real-map" aria-label="배송 지도"></div>
      <div class="delivery-map-grid" aria-hidden="true"></div>
      <div class="delivery-map-pin" aria-hidden="true"></div>
      <div class="delivery-map-info">
        <strong>현재 위치</strong>
        <span>${escapeHtml(locationText)}</span>
      </div>
    </div>
  `;
}

function loadNaverMapScript() {
  if (window.naver?.maps) return Promise.resolve();
  if (naverMapScriptPromise) return naverMapScriptPromise;
  const existing = document.querySelector("#naverMapScript");
  if (existing) existing.remove();
  naverMapScriptPromise = new Promise((resolve, reject) => {
    let settled = false;
    const script = document.createElement("script");
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script.dataset.loadState = "ready";
      resolve();
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script.remove();
      naverMapScriptPromise = null;
      reject(new Error(message));
    };
    const timeoutId = window.setTimeout(() => {
      fail("네이버 지도 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }, 15000);
    window.__BEBEU_NAVER_MAP_READY__ = () => {
      if (window.naver?.maps) finish();
      else fail("네이버 지도 API 초기화에 실패했습니다.");
    };
    script.id = "naverMapScript";
    script.dataset.loadState = "loading";
    script.src = serverUrl(`/api/naver-map.js?v=${encodeURIComponent(CUSTOMER_SHARE_CACHE_VERSION)}`);
    script.async = true;
    script.onload = () => {
      if (window.naver?.maps) finish();
    };
    script.onerror = () => fail("네이버 지도 스크립트를 불러오지 못했습니다. 등록된 Web 서비스 URL을 확인해 주세요.");
    document.head.appendChild(script);
  });
  return naverMapScriptPromise;
}

function updateDeliveryMapStatus(message = "") {
  state.deliveryMapMessage = message;
  const status = document.querySelector("#deliveryMapStatus");
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

function initializeDeliveryMap() {
  const container = document.querySelector("#deliveryNaverMap");
  if (!container || !state.data?.mapSettings?.naverMapsEnabled) return;
  loadNaverMapScript().then(() => {
    if (!document.body.contains(container)) return;
    if (!window.naver?.maps) {
      updateDeliveryMapStatus(window.__BEBEU_NAVER_MAP_ERROR__ || "네이버 지도 API가 로드되지 않았습니다. 네이버 클라우드의 Web 서비스 URL 설정을 확인해 주세요.");
      return;
    }
    updateDeliveryMapStatus("");
    const mapCard = container.closest(".delivery-map-card");
    const storePosition = new naver.maps.LatLng(BEBEU_STORE_LOCATION.latitude, BEBEU_STORE_LOCATION.longitude);
    const currentPosition = state.deliveryLocation
      ? new naver.maps.LatLng(state.deliveryLocation.latitude, state.deliveryLocation.longitude)
      : null;
    const savedDeliveryLocation = state.data?.deliveryLocation;
    const workerPosition = savedDeliveryLocation && isAdminUser()
      ? new naver.maps.LatLng(savedDeliveryLocation.latitude, savedDeliveryLocation.longitude)
      : null;
    const map = new naver.maps.Map(container, {
      center: currentPosition || workerPosition || storePosition,
      zoom: currentPosition || workerPosition ? 15 : 14,
      size: new naver.maps.Size(Math.max(container.clientWidth, 320), Math.max(container.clientHeight, 280)),
      draggable: true,
      pinchZoom: true,
      scrollWheel: true,
      disableDoubleTapZoom: false,
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
    });
    deliveryMapInstance = map;
    deliveryCurrentMarker = null;
    deliveryWorkerMarker = null;
    mapCard?.classList.add("is-map-ready");
    const bounds = new naver.maps.LatLngBounds();
    const markers = [];
    let fittedMarkerCount = 0;
    const addMarker = (position, titleText, className = "") => {
      const marker = new naver.maps.Marker({
        position,
        map,
        title: titleText,
        icon: {
          content: `<div class="delivery-naver-marker ${className}">${escapeHtml(titleText.slice(0, 2))}</div>`,
          anchor: new naver.maps.Point(15, 15),
        },
      });
      markers.push(marker);
      bounds.extend(position);
      fittedMarkerCount += 1;
      return marker;
    };
    const routeIncludesStore = state.deliveryRoute.some((item) => item?.isStore);
    if (!routeIncludesStore) addMarker(storePosition, "베베유", "is-store");
    if (currentPosition) {
      deliveryCurrentMarker = addMarker(currentPosition, "현재", "is-current");
      map.setCenter(currentPosition);
    }
    if (workerPosition) {
      deliveryWorkerMarker = addMarker(workerPosition, savedDeliveryLocation.userName || "배송", "is-worker");
    }
    const routePoints = state.deliveryRoute.filter((item) => item && typeof item === "object" && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
    state.deliveryRoute.forEach((item, index) => {
      const routePath = (Array.isArray(item?.pathFromPrevious) ? item.pathFromPrevious : [])
        .filter((point) => Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude)));
      if (routePath.length <= 1) return;
      const linePath = routePath.map((point) => new naver.maps.LatLng(Number(point.latitude), Number(point.longitude)));
      new naver.maps.Polyline({
        map,
        path: linePath,
        strokeColor: "#124f46",
        strokeOpacity: 0.95,
        strokeWeight: 6,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        zIndex: 100,
      });
      linePath.forEach((position) => bounds.extend(position));
    });
    routePoints.forEach((item, index) => {
      addMarker(
        new naver.maps.LatLng(Number(item.latitude), Number(item.longitude)),
        item.isStore ? "도착" : `${index + 1}`,
        item.isStore ? "is-store" : ""
      );
    });
    const addresses = routePoints.length ? [] : currentDeliveryRouteAddresses();
    if (!window.naver.maps.Service?.geocode || !addresses.length) {
      if (fittedMarkerCount > 1) map.fitBounds(bounds);
      window.requestAnimationFrame(() => naver.maps.Event.trigger(map, "resize"));
      return;
    }
    let pending = addresses.length;
    addresses.forEach((address, index) => {
      naver.maps.Service.geocode({ query: address }, (status, response) => {
        pending -= 1;
        if (status === naver.maps.Service.Status.OK) {
          const item = response.v2.addresses?.[0];
          if (item) {
            addMarker(new naver.maps.LatLng(Number(item.y), Number(item.x)), `${index + 1}`);
          }
        }
        if (pending === 0 && fittedMarkerCount > 1) {
          map.fitBounds(bounds);
          window.requestAnimationFrame(() => naver.maps.Event.trigger(map, "resize"));
        }
      });
    });
  }).catch((error) => {
    updateDeliveryMapStatus(error.message || "네이버 지도를 불러오지 못했습니다. 네이버 클라우드의 Web 서비스 URL 설정을 확인해 주세요.");
  });
}

function deliveryAddressInputValue() {
  const liveInput = document.querySelector("#deliveryAddressInput");
  const source = liveInput?.value ?? localStorage.getItem(DELIVERY_ADDRESS_STORAGE_KEY) ?? "";
  const jobs = deliveryJobs();
  const jobAddressKeys = new Set(jobs.map((job) => deliveryAddressKey(job.address)));
  const manualAddresses = deliveryAddressLines(source).filter((address) => !jobAddressKeys.has(deliveryAddressKey(address)));
  const activeAddresses = jobs.filter((job) => job.status !== "배송 완료").map((job) => job.address);
  return [...new Set([...activeAddresses, ...manualAddresses])].join("\n");
}

function deliveryAddressLines(value) {
  return String(value || "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function deliveryAddressTokens(address) {
  return String(address || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function deliverySimilarityScore(a, b) {
  const left = new Set(deliveryAddressTokens(a));
  const right = deliveryAddressTokens(b);
  return right.reduce((score, token) => score + (left.has(token) ? 3 : [...left].some((item) => item.includes(token) || token.includes(item)) ? 1 : 0), 0);
}

function optimizeDeliveryRoute(addresses) {
  const pending = [...addresses];
  const route = [];
  let current = pending.shift() || "";
  if (current) route.push(current);
  while (pending.length) {
    let bestIndex = 0;
    let bestScore = -1;
    pending.forEach((address, index) => {
      const score = deliverySimilarityScore(current, address);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    current = pending.splice(bestIndex, 1)[0];
    route.push(current);
  }
  return route;
}

function deliveryRouteAddress(item) {
  return typeof item === "string" ? item : item?.roadAddress || item?.address || "";
}

function deliveryRouteMeta(item) {
  if (!item || typeof item === "string") return "";
  const minutes = Math.round((Number(item.durationFromPrevious) || 0) / 60000);
  const distanceKm = (Number(item.distanceFromPrevious) || 0) / 1000;
  const routeText = minutes || distanceKm ? `이전 위치에서 약 ${minutes}분 · ${distanceKm.toFixed(1)}km` : "";
  const searchText = item.roadAddress && item.address && item.roadAddress !== item.address ? `검색결과: ${item.roadAddress}` : "";
  return [routeText, searchText].filter(Boolean).join(" / ");
}

function currentDeliveryRouteAddresses() {
  const route = state.deliveryRoute.length ? state.deliveryRoute : deliveryAddressLines(deliveryAddressInputValue());
  return route.map(deliveryRouteAddress).filter(Boolean);
}

function naverMapSearchUrl(address) {
  return `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
}

function naverMapRouteUrl(addresses) {
  const query = addresses.join(" ");
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

function formatDeliveryLocationTime(value) {
  if (!value) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDeliveryCoordinates(location) {
  if (!location) return "위치 정보 없음";
  return `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`;
}

function isDeliveryRouteReady() {
  if (!state.deliveryRoute.length || !state.deliveryRouteOrigin) return false;
  const last = state.deliveryRoute[state.deliveryRoute.length - 1];
  return Boolean(last?.isStore && state.deliveryRoute.every((item) => Number.isFinite(Number(item?.latitude)) && Number.isFinite(Number(item?.longitude))));
}

function requestDeliveryLocationOnce() {
  if (state.deliveryAutoLocateRequested || !navigator.geolocation) return;
  state.deliveryAutoLocateRequested = true;
  requestDeliveryLocation({ silent: true }).catch(() => {});
}

function requestDeliveryLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new Error("현재 위치를 사용할 수 없는 브라우저입니다.");
      if (!options.silent) alert(error.message);
      reject(error);
      return;
    }
    if (!options.silent) setGlobalLoading("현재 위치 확인 중...");
    navigator.geolocation.getCurrentPosition((position) => {
      state.deliveryLocation = deliveryLocationFromPosition(position);
      saveDeliveryLocation(state.deliveryLocation);
      if (!options.silent) setGlobalLoading("");
      if (options.render !== false) render();
      if (!options.silent) showToast("현재 위치를 확인했습니다.");
      resolve(state.deliveryLocation);
    }, (error) => {
      const locationError = new Error(error.message || "현재 위치 권한을 확인해 주세요.");
      if (!options.silent) {
        setGlobalLoading("");
        alert(locationError.message);
      }
      reject(locationError);
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 15000,
    });
  });
}

function deliveryLocationFromPosition(position) {
  return {
    latitude: Number(position.coords.latitude),
    longitude: Number(position.coords.longitude),
    accuracy: Number(position.coords.accuracy) || 0,
    heading: Number.isFinite(Number(position.coords.heading)) ? Number(position.coords.heading) : null,
    speed: Number.isFinite(Number(position.coords.speed)) ? Number(position.coords.speed) : null,
  };
}

async function saveDeliveryLocation(location) {
  if (!isDeliveryOnlyUser() || !location) return;
  try {
    const result = await api("/api/delivery/location", {
      method: "POST",
      body: JSON.stringify(location),
    });
    state.data.deliveryLocation = result.deliveryLocation || state.data.deliveryLocation || null;
  } catch {
    // 위치 저장 실패는 다음 위치 갱신 때 다시 시도합니다.
  }
}

function toggleDeliveryOrderSelection(orderId) {
  const selected = new Set(state.selectedDeliveryOrderIds);
  if (selected.has(orderId)) selected.delete(orderId);
  else selected.add(orderId);
  state.selectedDeliveryOrderIds = [...selected];
  refreshDeliveryOrderPicker();
}

async function addSelectedDeliveryOrders() {
  if (!state.selectedDeliveryOrderIds.length) return;
  try {
    setGlobalLoading("배송 항목 추가 중...");
    const result = await api("/api/delivery/jobs", {
      method: "POST",
      body: JSON.stringify({ orderIds: state.selectedDeliveryOrderIds }),
    });
    state.data.deliveryJobs = result.deliveryJobs || [];
    state.selectedDeliveryOrderIds = [];
    state.deliveryOrderPickerOpen = false;
    state.deliveryOrderQuery = "";
    state.deliveryRoute = [];
    state.deliveryRouteOrigin = null;
    state.deliveryRouteMessage = "배송 항목을 추가했습니다. 최적 동선을 만들어 주세요.";
    localStorage.setItem(DELIVERY_ADDRESS_STORAGE_KEY, deliveryAddressInputValue());
    render();
    showToast(`${result.addedOrderIds?.length || 0}건을 배송 전으로 추가했습니다.`);
  } catch (error) {
    alert(error.message || "배송 항목을 추가하지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
}

async function saveDeliveryRouteJobs(route = []) {
  const orderIds = route
    .filter((item) => !item?.isStore && item?.orderId)
    .map((item) => item.orderId);
  if (!orderIds.length) return;
  const result = await api("/api/delivery/jobs/route", {
    method: "POST",
    body: JSON.stringify({ orderIds }),
  });
  state.data.deliveryJobs = result.deliveryJobs || state.data.deliveryJobs || [];
}

async function completeDeliveryJob(orderId) {
  const job = deliveryJobs().find((item) => item.orderId === orderId);
  if (!job || job.status === "배송 완료") return;
  if (!job.plannedAt) {
    showToast("먼저 최적 동선을 만들어 주세요.");
    return;
  }
  try {
    setGlobalLoading("배송 완료 저장 중...");
    const result = await api(`/api/delivery/jobs/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "배송 완료" }),
    });
    state.data.deliveryJobs = result.deliveryJobs || [];
    localStorage.setItem(DELIVERY_ADDRESS_STORAGE_KEY, deliveryAddressInputValue());
    render();
    showToast("배송 완료로 저장했습니다.");
  } catch (error) {
    alert(error.message || "배송 완료 상태를 저장하지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
}

async function removeDeliveryJob(orderId) {
  const job = deliveryJobs().find((item) => item.orderId === orderId);
  if (!job) return;
  try {
    setGlobalLoading("배송 목록 정리 중...");
    const remainingInput = deliveryAddressLines(deliveryAddressInputValue())
      .filter((address) => deliveryAddressKey(address) !== deliveryAddressKey(job.address))
      .join("\n");
    const result = await api(`/api/delivery/jobs/${encodeURIComponent(orderId)}`, { method: "DELETE" });
    state.data.deliveryJobs = result.deliveryJobs || [];
    const input = document.querySelector("#deliveryAddressInput");
    if (input) input.value = remainingInput;
    localStorage.setItem(DELIVERY_ADDRESS_STORAGE_KEY, remainingInput);
    state.deliveryRoute = state.deliveryRoute.filter((item) => item?.orderId !== orderId);
    state.deliveryRouteOrigin = null;
    state.deliveryRouteMessage = "배송 항목을 제거했습니다. 동선을 다시 만들어 주세요.";
    render();
    showToast("배송 목록에서 제거했습니다.");
  } catch (error) {
    alert(error.message || "배송 항목을 제거하지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
}

async function buildDeliveryRoute() {
  const input = deliveryAddressInputValue();
  const addresses = deliveryAddressLines(input);
  localStorage.setItem(DELIVERY_ADDRESS_STORAGE_KEY, input);
  if (!addresses.length) {
    state.deliveryRoute = [];
    state.deliveryRouteMessage = "주소를 먼저 입력해 주세요.";
    render();
    return;
  }
  try {
    if (!state.deliveryLocation) {
      setGlobalLoading("출발할 현재 위치 확인 중...");
      await requestDeliveryLocation({ silent: true, render: false });
    }
    setGlobalLoading("현위치부터 사무실까지 최적 동선 계산 중...");
    await waitForPaint();
    const result = await api("/api/delivery/route", {
      method: "POST",
      body: JSON.stringify({
        addresses,
        origin: state.deliveryLocation,
      }),
    });
    state.deliveryRoute = attachDeliveryJobsToRoute(result.route || []);
    state.deliveryRouteOrigin = result.origin || state.deliveryLocation;
    await saveDeliveryRouteJobs(state.deliveryRoute);
    const totalMinutes = Math.round((Number(result.totalDuration) || 0) / 60000);
    const totalKm = ((Number(result.totalDistance) || 0) / 1000).toFixed(1);
    const failedText = result.failed?.length
      ? ` 좌표를 찾지 못한 항목 ${result.failed.length}개는 제외했습니다. 도로명만 입력한 경우 건물번호를 함께 입력해 주세요.`
      : "";
    state.deliveryRouteMessage = `배송지를 동네별로 묶고 같은 동네의 가까운 지점을 이어서 계산했습니다. 마지막은 베베유 사무실입니다. 총 약 ${totalMinutes}분 · ${totalKm}km.${failedText}`;
    render();
    showToast("동선을 만들었습니다.");
  } catch (error) {
    state.deliveryRoute = [];
    state.deliveryRouteOrigin = null;
    state.deliveryRouteMessage = error.message || "네이버 경로 계산에 실패했습니다.";
    render();
  } finally {
    setGlobalLoading("");
  }
}

async function clearDeliveryRoute() {
  try {
    setGlobalLoading("배송 목록 비우는 중...");
    const result = await api("/api/delivery/jobs", { method: "DELETE" });
    state.data.deliveryJobs = result.deliveryJobs || [];
    const input = document.querySelector("#deliveryAddressInput");
    if (input) input.value = "";
    localStorage.removeItem(DELIVERY_ADDRESS_STORAGE_KEY);
    state.deliveryRoute = [];
    state.deliveryRouteOrigin = null;
    state.deliveryRouteMessage = "";
    state.selectedDeliveryOrderIds = [];
    state.deliveryOrderPickerOpen = false;
    state.deliveryOrderQuery = "";
    render();
    showToast("배송 목록을 모두 비웠습니다.");
  } catch (error) {
    alert(error.message || "배송 목록을 비우지 못했습니다.");
  } finally {
    setGlobalLoading("");
  }
}

function deliveryDistanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const radius = 6371000;
  const toRad = (value) => Number(value) * Math.PI / 180;
  const dLat = toRad(Number(b.latitude) - Number(a.latitude));
  const dLng = toRad(Number(b.longitude) - Number(a.longitude));
  const lat1 = toRad(Number(a.latitude));
  const lat2 = toRad(Number(b.latitude));
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function updateCurrentDeliveryMarker(location) {
  if (!deliveryMapInstance || !window.naver?.maps || !location) return;
  const position = new naver.maps.LatLng(location.latitude, location.longitude);
  if (deliveryCurrentMarker) {
    deliveryCurrentMarker.setPosition(position);
    return;
  }
  deliveryCurrentMarker = new naver.maps.Marker({
    position,
    map: deliveryMapInstance,
    title: "현재 위치",
    icon: {
      content: `<div class="delivery-naver-marker is-current">현재</div>`,
      anchor: new naver.maps.Point(15, 15),
    },
  });
}

function updateDeliveryWorkerLocation(location) {
  if (!location) return;
  state.data.deliveryLocation = location;
  const label = document.querySelector("#deliveryWorkerLocationLabel");
  if (label && isAdminUser()) {
    label.textContent = `${location.userName || "배송"} 위치: ${formatDeliveryLocationTime(location.updatedAt)}`;
    label.hidden = false;
  }
  if (!isAdminUser() || !deliveryMapInstance || !window.naver?.maps) return;
  const position = new naver.maps.LatLng(Number(location.latitude), Number(location.longitude));
  if (deliveryWorkerMarker) {
    deliveryWorkerMarker.setPosition(position);
    return;
  }
  deliveryWorkerMarker = new naver.maps.Marker({
    position,
    map: deliveryMapInstance,
    title: location.userName || "배송",
    icon: {
      content: `<div class="delivery-naver-marker is-worker">배송</div>`,
      anchor: new naver.maps.Point(15, 15),
    },
  });
  deliveryMapInstance.panTo(position);
}

function stopDeliveryWorkerTracking() {
  if (deliveryWorkerLocationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(deliveryWorkerLocationWatchId);
  }
  deliveryWorkerLocationWatchId = null;
}

function stopDeliveryLocationStream() {
  if (deliveryLocationStreamRetryTimer !== null) window.clearTimeout(deliveryLocationStreamRetryTimer);
  deliveryLocationStreamRetryTimer = null;
  deliveryLocationStreamController?.abort();
  deliveryLocationStreamController = null;
}

function scheduleDeliveryLocationStreamReconnect() {
  if (deliveryLocationStreamRetryTimer !== null || state.tab !== "delivery" || !isAdminUser()) return;
  deliveryLocationStreamRetryTimer = window.setTimeout(() => {
    deliveryLocationStreamRetryTimer = null;
    startDeliveryLocationStream();
  }, 2000);
}

async function startDeliveryLocationStream() {
  if (deliveryLocationStreamController || state.tab !== "delivery" || !isAdminUser()) return;
  const controller = new AbortController();
  deliveryLocationStreamController = controller;
  try {
    const response = await fetch(serverUrl("/api/delivery/location/stream"), {
      headers: state.currentUserId ? { "X-User-Id": state.currentUserId } : {},
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("배송 위치 실시간 연결에 실패했습니다.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!controller.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator && separator.index !== undefined) {
        const eventText = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = eventText
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (data) {
          try {
            const payload = JSON.parse(data);
            if (payload.deliveryLocation) updateDeliveryWorkerLocation(payload.deliveryLocation);
          } catch {}
        }
        separator = buffer.match(/\r?\n\r?\n/);
      }
      if (state.tab !== "delivery" || !isAdminUser()) {
        controller.abort();
        break;
      }
    }
  } catch (error) {
    if (error.name !== "AbortError") scheduleDeliveryLocationStreamReconnect();
  } finally {
    if (deliveryLocationStreamController === controller) deliveryLocationStreamController = null;
    if (!controller.signal.aborted) scheduleDeliveryLocationStreamReconnect();
  }
}

function startDeliveryWorkerTracking() {
  if (deliveryWorkerLocationWatchId !== null || !navigator.geolocation) return;
  deliveryWorkerLocationWatchId = navigator.geolocation.watchPosition((position) => {
    if (state.tab !== "delivery" || !isDeliveryOnlyUser()) {
      stopDeliveryWorkerTracking();
      return;
    }
    const location = deliveryLocationFromPosition(position);
    state.deliveryLocation = location;
    updateCurrentDeliveryMarker(location);
    const now = Date.now();
    const movedMeters = lastDeliveryLocationSent ? deliveryDistanceMeters(lastDeliveryLocationSent, location) : Infinity;
    if (now - lastDeliveryLocationSaveAt >= 1000 && (movedMeters >= 2 || now - lastDeliveryLocationSaveAt >= 8000)) {
      lastDeliveryLocationSaveAt = now;
      lastDeliveryLocationSent = location;
      saveDeliveryLocation(location);
    }
  }, (error) => {
    updateDeliveryMapStatus(error.message || "배송 기사 위치를 확인하지 못했습니다.");
  }, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 2000,
  });
}

async function pollDeliveryWorkerLocation() {
  if (state.tab !== "delivery" || !isAdminUser()) {
    if (deliveryLocationPollTimer !== null) window.clearInterval(deliveryLocationPollTimer);
    deliveryLocationPollTimer = null;
    return;
  }
  try {
    const result = await api("/api/delivery/location");
    updateDeliveryWorkerLocation(result.deliveryLocation || null);
  } catch {
    // 일시적인 조회 실패는 다음 주기에 다시 확인합니다.
  }
}

function syncDeliveryLocationTracking() {
  if (isDeliveryOnlyUser()) {
    stopDeliveryLocationStream();
    if (deliveryLocationPollTimer !== null) window.clearInterval(deliveryLocationPollTimer);
    deliveryLocationPollTimer = null;
    startDeliveryWorkerTracking();
    return;
  }
  stopDeliveryWorkerTracking();
  if (!isAdminUser()) {
    stopDeliveryLocationStream();
    return;
  }
  startDeliveryLocationStream();
  pollDeliveryWorkerLocation();
  if (deliveryLocationPollTimer === null) {
    deliveryLocationPollTimer = window.setInterval(pollDeliveryWorkerLocation, 15000);
  }
}

function deliveryRouteCopyText() {
  return state.deliveryRoute
    .map(deliveryRouteAddress)
    .filter(Boolean)
    .join("\n");
}

async function copyDeliveryRoute() {
  if (!isDeliveryRouteReady()) return;
  const text = deliveryRouteCopyText();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast("배송 동선을 복사했습니다.");
}

async function rebuildDeliveryRouteInOrder(addresses, previousRoute) {
  try {
    setGlobalLoading("변경한 순서로 경로 다시 계산 중...");
    const result = await api("/api/delivery/route", {
      method: "POST",
      body: JSON.stringify({
        addresses,
        origin: state.deliveryRouteOrigin || state.deliveryLocation,
        preserveOrder: true,
      }),
    });
    state.deliveryRoute = attachDeliveryJobsToRoute(result.route || []);
    state.deliveryRouteOrigin = result.origin || state.deliveryRouteOrigin;
    await saveDeliveryRouteJobs(state.deliveryRoute);
    const totalMinutes = Math.round((Number(result.totalDuration) || 0) / 60000);
    const totalKm = ((Number(result.totalDistance) || 0) / 1000).toFixed(1);
    state.deliveryRouteMessage = `변경한 순서로 경로를 다시 계산했습니다. 총 약 ${totalMinutes}분 · ${totalKm}km.`;
    render();
    showToast("배송 순서를 변경했습니다.");
  } catch (error) {
    state.deliveryRoute = previousRoute;
    state.deliveryRouteMessage = error.message || "변경한 순서의 경로를 계산하지 못했습니다.";
    render();
  } finally {
    setGlobalLoading("");
  }
}

function reorderDeliveryRoute(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const previousRoute = [...state.deliveryRoute];
  const stops = state.deliveryRoute.filter((item) => !item?.isStore);
  const store = state.deliveryRoute.find((item) => item?.isStore);
  if (!stops[fromIndex] || !stops[toIndex]) return;
  const [moved] = stops.splice(fromIndex, 1);
  stops.splice(toIndex, 0, moved);
  state.deliveryRoute = store ? [...stops, store] : stops;
  render();
  rebuildDeliveryRouteInOrder(stops.map(deliveryRouteAddress), previousRoute);
}

function handleDeliveryRoutePointerDown(event) {
  const handle = event.target.closest?.("[data-delivery-drag-handle]");
  if (!handle || !isDeliveryRouteReady()) return;
  event.preventDefault();
  const fromIndex = Number(handle.dataset.deliveryDragHandle);
  deliveryRouteDrag = { fromIndex, toIndex: fromIndex, pointerId: event.pointerId, handle };
  handle.setPointerCapture?.(event.pointerId);
  handle.closest("li")?.classList.add("is-dragging");
}

function handleDeliveryRoutePointerMove(event) {
  if (!deliveryRouteDrag || event.pointerId !== deliveryRouteDrag.pointerId) return;
  event.preventDefault();
  document.querySelectorAll(".delivery-route-list li.is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-delivery-route-index]");
  if (!row) return;
  deliveryRouteDrag.toIndex = Number(row.dataset.deliveryRouteIndex);
  row.classList.add("is-drag-target");
}

function handleDeliveryRoutePointerEnd(event) {
  if (!deliveryRouteDrag || event.pointerId !== deliveryRouteDrag.pointerId) return;
  const { fromIndex, handle } = deliveryRouteDrag;
  const toIndex = event.type === "pointercancel" ? fromIndex : deliveryRouteDrag.toIndex;
  handle.releasePointerCapture?.(event.pointerId);
  document.querySelectorAll(".delivery-route-list li.is-dragging, .delivery-route-list li.is-drag-target")
    .forEach((item) => item.classList.remove("is-dragging", "is-drag-target"));
  deliveryRouteDrag = null;
  reorderDeliveryRoute(fromIndex, toIndex);
}
