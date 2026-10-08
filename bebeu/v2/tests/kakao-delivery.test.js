const test = require("node:test");
const assert = require("node:assert/strict");
const { createKakaoDeliveryRouter, bestNeighborhoodPath, orderStops, regionForPoint } = require("../lib/kakao-delivery");

test("neighborhood ordering accounts for entry, exit and asymmetric driving time", () => {
  const points = ["A", "B", "C"];
  const costs = { AB: 1, AC: 4, BA: 50, BC: 1, CA: 1, CB: 50 };
  const result = bestNeighborhoodPath(points, () => 0, (p) => p === "A" ? 0 : 100, (a, b) => costs[a + b]);
  assert.deepEqual(result, ["B", "C", "A"]);
});

test("resolved administrative region wins over apartment unit text", () => {
  const point = { region1: "광주", region2: "광산구", region3: "수완동", jibunAddress: "광주 광산구 다른동 101동" };
  assert.equal(regionForPoint(point).neighborhood, "광주 광산구 수완동");
});

test("districts and neighborhoods remain contiguous and every stop appears exactly once", () => {
  const point = (id, region2, region3, latitude) => ({ id, region1: "광주", region2, region3, latitude, longitude: 126.85 });
  const points = [point(1, "광산구", "수완동", 35.19), point(2, "서구", "치평동", 35.15), point(3, "광산구", "수완동", 35.195), point(4, "광산구", "장덕동", 35.20), point(5, "서구", "농성동", 35.16)];
  const route = orderStops(points, { latitude: 35.22, longitude: 126.85 }, (a, b) => Math.abs(a.latitude - b.latitude) * 1000 + 1);
  assert.deepEqual(route.map((p) => p.id).sort(), [1, 2, 3, 4, 5]);
  for (const key of ["district", "neighborhood"]) {
    const closed = new Set();
    let previous;
    for (const p of route) {
      if (p[key] !== previous) { assert.ok(!closed.has(p[key])); if (previous) closed.add(previous); previous = p[key]; }
    }
  }
});

function fixture(fetchImpl) {
  return createKakaoDeliveryRouter({ restApiKey: "test-only", store: { address: "office", latitude: 35.22, longitude: 126.85 },
    searchCandidates: (address) => [address], hasExplicitRegion: () => false, isGwangjuAddress: (address) => address.includes("광주"), fetchImpl });
}

const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

test("unresolved destinations fail instead of disappearing from the route", async () => {
  const router = fixture(async () => response({ documents: [] }));
  await assert.rejects(router.build({ addresses: ["missing"] }), /missing/);
});

test("preserved route order uses office origin and converts Kakao seconds to milliseconds", async () => {
  const router = fixture(async (url) => {
    if (url.includes("search/address")) return response({ documents: [{ x: "126.86", y: "35.20", address_name: "광주 광산구 수완동", address: { region_1depth_name: "광주", region_2depth_name: "광산구", region_3depth_name: "수완동" } }] });
    return response({ routes: [{ result_code: 0, summary: { duration: 60, distance: 1000 }, sections: [{ roads: [{ vertexes: [126.85, 35.22, 126.86, 35.20] }], guides: [] }] }] });
  });
  const result = await router.build({ addresses: ["address"], preserveOrder: true });
  assert.equal(result.origin.address, "베베유 사무실");
  assert.equal(result.route.length, 2);
  assert.equal(result.route.at(-1).isStore, true);
  assert.equal(result.totalDuration, 120000);
  assert.equal(result.route[0].pathFromPrevious.length, 2);
});

test("authentication failure is not replaced with straight-line routing", async () => {
  const router = fixture(async () => response({}, 403));
  await assert.rejects(router.build({ addresses: ["address"] }), /인증/);
});
