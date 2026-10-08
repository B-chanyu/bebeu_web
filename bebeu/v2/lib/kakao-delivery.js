function validPoint(point) {
  return point && point.latitude != null && point.longitude != null
    && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))
    && Math.abs(Number(point.latitude)) <= 90 && Math.abs(Number(point.longitude)) <= 180;
}

function coordinateKey(point) {
  return `${Number(point.longitude).toFixed(7)},${Number(point.latitude).toFixed(7)}`;
}

function distanceMeters(a, b) {
  const rad = (n) => Number(n) * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function mapLimited(items, limit, action) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await action(items[index], index);
    }
  }));
  return results;
}

function regionForPoint(point) {
  const tokens = String(point.jibunAddress || point.roadAddress || point.address || "").split(/\s+/);
  const city = point.region1 || tokens.find((token) => /(?:광역시|특별시|특별자치시|도)$/.test(token)) || "광주광역시";
  const district = point.region2 || tokens.find((token) => /[가-힣]+(?:구|군)$/.test(token)) || "지역 미확인";
  const neighborhood = point.region3 || tokens.find((token) => /^[가-힣][가-힣0-9·.]+(?:동|읍|면|리)$/.test(token))
    || `위치 ${coordinateKey(point)}`;
  return { district: `${city} ${district}`, neighborhood: `${city} ${district} ${neighborhood}` };
}

function groupedStops(points) {
  const districts = new Map();
  for (const point of points) {
    const region = regionForPoint(point);
    point.district = region.district;
    point.neighborhood = region.neighborhood;
    if (!districts.has(region.district)) districts.set(region.district, new Map());
    const neighborhoods = districts.get(region.district);
    if (!neighborhoods.has(region.neighborhood)) neighborhoods.set(region.neighborhood, []);
    neighborhoods.get(region.neighborhood).push(point);
  }
  return [...districts.values()].map((groups) => [...groups.values()]);
}

// Directed Held-Karp: includes entry and exit costs, so one-way streets are respected.
function bestNeighborhoodPath(points, entryCost, exitCost, cost) {
  if (points.length > 9) {
    let best = null;
    let bestCost = Infinity;
    for (const first of points) {
      const pending = points.filter((point) => point !== first);
      const path = [first];
      let current = first;
      while (pending.length) {
        let index = 0;
        for (let i = 1; i < pending.length; i++) {
          if (cost(current, pending[i]) < cost(current, pending[index])) index = i;
        }
        current = pending.splice(index, 1)[0];
        path.push(current);
      }
      const score = (route) => entryCost(route[0]) + exitCost(route.at(-1))
        + route.slice(1).reduce((sum, point, i) => sum + cost(route[i], point), 0);
      let scoreValue = score(path);
      for (let pass = 0; pass < 3; pass++) {
        let improved = false;
        for (let from = 0; from < path.length; from++) {
          for (let to = 0; to < path.length; to++) {
            if (from === to) continue;
            const trial = [...path];
            trial.splice(to, 0, trial.splice(from, 1)[0]);
            const value = score(trial);
            if (value < scoreValue) { path.splice(0, path.length, ...trial); scoreValue = value; improved = true; }
          }
        }
        if (!improved) break;
      }
      if (scoreValue < bestCost) { best = path; bestCost = scoreValue; }
    }
    return best;
  }
  const size = 1 << points.length;
  const dp = Array.from({ length: size }, () => new Float64Array(points.length).fill(Infinity));
  const previous = Array.from({ length: size }, () => new Int16Array(points.length).fill(-1));
  points.forEach((point, i) => { dp[1 << i][i] = entryCost(point); });
  for (let mask = 1; mask < size; mask++) {
    for (let end = 0; end < points.length; end++) {
      if (!Number.isFinite(dp[mask][end])) continue;
      for (let next = 0; next < points.length; next++) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        const candidate = dp[mask][end] + cost(points[end], points[next]);
        if (candidate < dp[nextMask][next]) { dp[nextMask][next] = candidate; previous[nextMask][next] = end; }
      }
    }
  }
  const full = size - 1;
  let end = 0;
  for (let i = 1; i < points.length; i++) {
    if (dp[full][i] + exitCost(points[i]) < dp[full][end] + exitCost(points[end])) end = i;
  }
  if (!Number.isFinite(dp[full][end] + exitCost(points[end]))) return null;
  const result = [];
  let mask = full;
  while (end >= 0) {
    result.unshift(points[end]);
    const next = previous[mask][end];
    mask ^= 1 << end;
    end = next;
  }
  return result;
}

function orderStops(points, store, cost) {
  const districts = groupedStops(points);
  const ordered = [];
  let current = null;
  while (districts.length) {
    let districtIndex = 0;
    if (!current) {
      // Finish outlying areas first and return toward the office; first leg is not the priority.
      const averageDistance = (groups) => groups.flat().reduce((sum, p) => sum + distanceMeters(p, store), 0) / groups.flat().length;
      districts.forEach((groups, i) => {
        if (averageDistance(groups) > averageDistance(districts[districtIndex])) districtIndex = i;
      });
    } else {
      const entry = (groups) => Math.min(...groups.flat().map((point) => cost(current, point)));
      districts.forEach((groups, i) => { if (entry(groups) < entry(districts[districtIndex])) districtIndex = i; });
    }
    const neighborhoods = districts.splice(districtIndex, 1)[0];
    while (neighborhoods.length) {
      let index = 0;
      neighborhoods.forEach((group, i) => {
        const score = current ? Math.min(...group.map((point) => cost(current, point)))
          : -Math.max(...group.map((point) => distanceMeters(point, store)));
        const best = current ? Math.min(...neighborhoods[index].map((point) => cost(current, point)))
          : -Math.max(...neighborhoods[index].map((point) => distanceMeters(point, store)));
        if (score < best) index = i;
      });
      const group = neighborhoods.splice(index, 1)[0];
      const nextStops = neighborhoods.length ? neighborhoods.flat() : districts.flat(2);
      const exit = (point) => Math.min(...(nextStops.length ? nextStops : [store]).map((next) => cost(point, next)));
      const path = bestNeighborhoodPath(group, (point) => current ? cost(current, point) : 0, exit, cost);
      if (!path) throw new Error("배송지 사이에 이동 가능한 차량 경로가 없습니다.");
      ordered.push(...path);
      current = path.at(-1);
    }
  }
  return ordered;
}

function createKakaoDeliveryRouter({ restApiKey, directionsApiKey = restApiKey, store, searchCandidates,
  hasExplicitRegion, isGwangjuAddress, fetchImpl = fetch, createError = (status, message) => Object.assign(new Error(message), { status }) }) {
  async function request(url, key, options = {}) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, headers: { Authorization: `KakaoAK ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
    } catch { throw createError(502, "카카오 지도 서버 연결이 지연되었습니다. 잠시 후 다시 시도해주세요."); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "카카오 API 인증 또는 사용 권한을 확인해주세요. 서버의 REST API 키와 지도/길찾기 사용 설정이 필요합니다."
        : response.status === 429 ? "카카오 API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
          : "카카오 주소 검색 또는 경로 요청에 실패했습니다.";
      throw createError(response.status, message);
    }
    return payload;
  }

  async function resolveAddress(address, knownAddresses) {
    const defaultRegion = !hasExplicitRegion(address);
    for (const candidate of searchCandidates(address, knownAddresses).slice(0, 12)) {
      const accept = (item) => validPoint({ latitude: item.y, longitude: item.x })
        && (!defaultRegion || isGwangjuAddress(`${item.address_name || ""} ${item.road_address_name || ""} ${item.address?.address_name || ""}`));
      const data = await request(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(candidate)}`, restApiKey);
      let item = data.documents?.find(accept);
      let placeName = "";
      if (!item) {
        const places = await request(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(candidate)}&x=${store.longitude}&y=${store.latitude}&sort=accuracy&size=5`, restApiKey);
        item = places.documents?.find(accept);
        placeName = item?.place_name || "";
      }
      if (!item) continue;
      const longitude = Number(item.x), latitude = Number(item.y);
      let region = item.address || {};
      if (!region.region_3depth_name) {
        const response = await request(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${longitude}&y=${latitude}`, restApiKey);
        region = response.documents?.find((entry) => entry.region_type === "B") || response.documents?.[0] || region;
      }
      return { address, searchedText: candidate, placeName, longitude, latitude,
        roadAddress: item.road_address?.address_name || item.road_address_name || item.address_name,
        jibunAddress: item.address?.address_name || item.address_name || "",
        region1: region.region_1depth_name || "", region2: region.region_2depth_name || "", region3: region.region_3depth_name || "" };
    }
    return null;
  }

  function routeSummary(route) {
    if (route?.result_code !== 0 || !Number.isFinite(Number(route.summary?.duration)) || !Number.isFinite(Number(route.summary?.distance))) return null;
    return { duration: Number(route.summary.duration) * 1000, distance: Number(route.summary.distance) };
  }

  async function driving(start, goal, summaryOnly = false) {
    if (coordinateKey(start) === coordinateKey(goal)) return { duration: 0, distance: 0, path: [start, goal], guide: [] };
    const query = new URLSearchParams({ origin: coordinateKey(start), destination: coordinateKey(goal), priority: "TIME", summary: String(summaryOnly), alternatives: "false" });
    const payload = await request(`https://apis-navi.kakaomobility.com/v1/directions?${query}`, directionsApiKey);
    const route = payload.routes?.[0];
    const summary = routeSummary(route);
    if (!summary) throw createError(422, "배송지 사이에 차량 경로를 찾지 못했습니다. 검색된 주소를 확인해주세요.");
    const path = [];
    for (const section of route.sections || []) {
      for (const road of section.roads || []) {
        for (let i = 0; i + 1 < (road.vertexes || []).length; i += 2) {
          const point = { longitude: Number(road.vertexes[i]), latitude: Number(road.vertexes[i + 1]) };
          if (validPoint(point)) path.push(point);
        }
      }
    }
    if (!summaryOnly && path.length < 2) throw createError(502, "카카오 주행 경로 데이터가 비어 있습니다. 다시 시도해주세요.");
    const guide = (route.sections || []).flatMap((section) => (section.guides || []).map((item) => ({
      latitude: Number(item.y), longitude: Number(item.x), type: item.type, instructions: item.guidance || item.name,
      distance: Number(item.distance) || 0, duration: (Number(item.duration) || 0) * 1000,
    })));
    return { ...summary, path, guide };
  }

  async function build({ addresses = [], origin = null, preserveOrder = false, knownAddresses = [] }) {
    if (!restApiKey || !directionsApiKey) throw createError(400, "서버에 카카오 REST API 키를 등록해주세요.");
    if (origin && !validPoint(origin)) throw createError(400, "출발 위치 좌표가 올바르지 않습니다.");
    if (!addresses.length || addresses.length > 25) throw createError(400, "배송지는 1~25곳까지 입력해주세요.");
    const start = { ...(origin || store), address: origin && !origin.isStore ? "현재 위치" : "베베유 사무실", isOrigin: true, isStore: false };
    const results = await mapLimited(addresses, 3, (address) => resolveAddress(address, knownAddresses));
    const failed = addresses.filter((address, index) => !results[index]);
    // Never silently omit an unrecognized delivery destination.
    if (failed.length) throw createError(422, `배송 위치를 찾지 못했습니다: ${failed.join(" / ")}. 주소를 수정한 뒤 다시 계산해주세요.`);
    const points = results;
    let stops = points;
    if (!preserveOrder) {
      const nodes = [...new Map([...points, store].map((point) => [coordinateKey(point), point])).values()];
      const matrix = new Map();
      await mapLimited(nodes, 3, async (from) => {
        const nearby = nodes.filter((to) => coordinateKey(to) !== coordinateKey(from) && distanceMeters(from, to) <= 9000);
        const values = new Map([[coordinateKey(from), { duration: 0, distance: 0 }]]);
        if (nearby.length) {
          const payload = await request("https://apis-navi.kakaomobility.com/v1/destinations/directions", directionsApiKey, {
            method: "POST", body: JSON.stringify({ origin: { x: from.longitude, y: from.latitude }, destinations: nearby.map((to, i) => ({ x: to.longitude, y: to.latitude, key: String(i) })), radius: 10000, priority: "TIME" }),
          });
          for (const route of payload.routes || []) {
            const target = nearby[Number(route.key)];
            const summary = routeSummary(route);
            if (target && summary) values.set(coordinateKey(target), summary);
          }
        }
        for (const to of nodes) {
          if (!values.has(coordinateKey(to))) {
            try { values.set(coordinateKey(to), await driving(from, to, true)); }
            catch (error) {
              if (error.status !== 422) throw error;
              values.set(coordinateKey(to), { duration: Infinity, distance: Infinity });
            }
          }
        }
        matrix.set(coordinateKey(from), values);
      });
      const cost = (from, to) => matrix.get(coordinateKey(from))?.get(coordinateKey(to))?.duration ?? Infinity;
      stops = orderStops(points, store, cost);
    }
    const destinations = [...stops, { ...store, isStore: true }];
    const route = await mapLimited(destinations, 3, async (next, i) => {
      const summary = await driving(i === 0 ? start : destinations[i - 1], next);
      return { ...next, durationFromPrevious: summary.duration, distanceFromPrevious: summary.distance, pathFromPrevious: summary.path, guideFromPrevious: summary.guide };
    });
    return { provider: "kakao", algorithm: "district-neighborhood-driving-time", origin: start, route, failed: [],
      totalDuration: route.reduce((sum, p) => sum + p.durationFromPrevious, 0), totalDistance: route.reduce((sum, p) => sum + p.distanceFromPrevious, 0) };
  }
  return { build };
}

module.exports = { createKakaoDeliveryRouter, bestNeighborhoodPath, orderStops, regionForPoint };
