(() => {
  const office = { latitude: 35.211931, longitude: 126.836767 };
  let map = null;
  let routeLayers = [];
  let currentMarker = null;
  let workerMarker = null;
  let parentOrigin = null;
  let lastState = null;
  let focusRoute = false;
  let resizeObserver = null;
  let readyAnnounced = false;
  let pendingFocus = null;
  const status = document.querySelector("#status");
  const valid = (point) => point && point.latitude != null && point.longitude != null
    && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))
    && Math.abs(Number(point.latitude)) <= 90 && Math.abs(Number(point.longitude)) <= 180;
  const position = (point) => new kakao.maps.LatLng(Number(point.latitude), Number(point.longitude));
  const notify = (data) => { if (parentOrigin) window.parent.postMessage(data, parentOrigin); };
  const announceReady = () => {
    if (map && parentOrigin && !readyAnnounced) {
      readyAnnounced = true;
      notify({ type: "bebeu-delivery-map-ready" });
    }
  };

  function marker(point, label, className = "") {
    const content = document.createElement("div");
    content.className = `marker ${className}`;
    content.textContent = label;
    content.title = label;
    return new kakao.maps.CustomOverlay({ map, position: position(point), content, xAnchor: 0.5, yAnchor: 0.5, zIndex: 10 });
  }

  function update() {
    if (!map || !lastState) return;
    const data = lastState;
    routeLayers.forEach((layer) => layer.setMap(null));
    routeLayers = [marker(office, "사무실")];
    const bounds = new kakao.maps.LatLngBounds();
    bounds.extend(position(office));
    const route = Array.isArray(data.route) ? data.route.filter(valid) : [];
    if (valid(data.origin) && route.length) { routeLayers.push(marker(data.origin, "출발")); bounds.extend(position(data.origin)); }
    route.forEach((point, index) => {
      if (!point.isStore) routeLayers.push(marker(point, index === data.activeIndex ? `다음 ${index + 1}` : String(index + 1), index === data.activeIndex ? "worker" : ""));
      bounds.extend(position(point));
      const path = (Array.isArray(point.pathFromPrevious) ? point.pathFromPrevious : []).filter(valid).map(position);
      if (path.length > 1) {
        routeLayers.push(new kakao.maps.Polyline({ map, path, strokeColor: "#124f46", strokeWeight: 5, strokeOpacity: 0.9, endArrow: true }));
        path.forEach((p) => bounds.extend(p));
      }
    });
    updatePositions(data);
    if (focusRoute && route.length) map.setBounds(bounds, 42, 24, 42, 24);
    focusRoute = false;
  }

  function updatePositions(data) {
    if (!map) return;
    if (valid(data.current)) {
      if (currentMarker) currentMarker.setPosition(position(data.current));
      else currentMarker = marker(data.current, "현재", "current");
    } else { currentMarker?.setMap(null); currentMarker = null; }
    if (valid(data.worker)) {
      if (workerMarker) workerMarker.setPosition(position(data.worker));
      else workerMarker = marker(data.worker, "배송", "worker");
    } else { workerMarker?.setMap(null); workerMarker = null; }
  }

  window.__BEBEU_KAKAO_MAP_FAILED__ = (message) => {
    status.textContent = message;
    status.hidden = false;
    notify({ type: "bebeu-delivery-map-error", message });
  };
  window.__BEBEU_KAKAO_MAP_READY__ = () => {
    try {
      map = new kakao.maps.Map(document.querySelector("#map"), { center: position(office), level: 5 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.TOPRIGHT);
      status.hidden = true;
      clearTimeout(timer);
      resizeObserver = new ResizeObserver(() => { const center = map.getCenter(); map.relayout(); map.setCenter(center); });
      resizeObserver.observe(document.querySelector("#map"));
      update();
      if (pendingFocus) { map.panTo(position(pendingFocus)); pendingFocus = null; }
      announceReady();
    } catch { window.__BEBEU_KAKAO_MAP_FAILED__("카카오 지도를 표시하지 못했습니다. 등록 도메인을 확인해주세요."); }
  };
  const timer = setTimeout(() => {
    if (!map) window.__BEBEU_KAKAO_MAP_FAILED__("카카오 지도 로딩 시간이 초과되었습니다. 키와 사용 권한을 확인해주세요.");
  }, 15000);
  window.addEventListener("pagehide", () => { clearTimeout(timer); resizeObserver?.disconnect(); });
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const allowed = new Set([window.location.origin, ...(window.__BEBEU_MAP_ALLOWED_ORIGINS__ || [])]);
    if (!allowed.has(event.origin)) return;
    parentOrigin = event.origin;
    const data = event.data;
    if (data?.type === "bebeu-delivery-map-state") {
      lastState = data;
      focusRoute = data.fitRoute === true;
      update();
      announceReady();
    } else if (data?.type === "bebeu-delivery-map-positions") {
      lastState = { ...(lastState || {}), current: data.current, worker: data.worker };
      updatePositions(data);
    } else if (data?.type === "bebeu-delivery-map-focus" && valid(data.point)) {
      if (map) map.panTo(position(data.point));
      else pendingFocus = data.point;
    }
  });
})();
