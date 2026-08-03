function parseOrderPaste() {
  const raw = orderPasteInput.value.trim();
  if (!raw) {
    alert("붙여넣기 값을 입력해 주세요.");
    return;
  }
  try {
    const type = usesBOrderFormat() ? "B" : "A";
    applyParsedOrder(type === "B" ? parseBOrder(raw) : parseAOrder(raw));
  } catch (error) {
    alert(error.message || "붙여넣기 내용을 인식하지 못했습니다.");
  }
}

function usesBOrderFormat(type = state.orderType) {
  return type === "B" || type === "AB";
}

function cleanPastePart(part) {
  return part.replace(/^[^\p{L}\p{N}#]+/u, "").replace(/\s+/g, " ").trim();
}

function findSerial(value) {
  return String(value || "").match(/\b(?:AB|BA|A|B)\d{2,4}\b/i)?.[0]?.toUpperCase() || "";
}

function serialForOrderType(serial, type = state.orderType) {
  const source = String(serial || "").trim().toUpperCase();
  const number = source.match(/\d{2,4}/)?.[0] || "";
  return number && ["A", "B", "AB", "BA"].includes(type) ? `${type}${number}` : source;
}

function parseAOrder(raw) {
  const parts = raw.split("/").map(cleanPastePart).filter(Boolean);
  const serialIndex = parts.findIndex((part) => findSerial(part));
  if (serialIndex < 0) throw new Error("품번을 찾지 못했습니다.");
  const serial = findSerial(parts[serialIndex]);
  const beforeSerial = parts[serialIndex].replace(serial, "").trim();
  const prefix = [...parts.slice(0, serialIndex), beforeSerial].filter(Boolean).join(" ");
  const rest = parts.slice(serialIndex + 1);
  const dateRange = normalizeOrderDateRange(rest.shift() || "");
  if (isUrgentToken(rest[0])) rest.shift();
  const address = rest.shift() || "";
  const maybeDoor = looksLikeDoorInfo(rest[0]) ? rest.shift() : "";
  const productText = rest.shift() || "";
  const maybeExtra = rest.length > 1 ? rest.shift() : "";
  const customerText = rest.join(" / ");
  const money = parseMoney(customerText || maybeExtra);
  const brandModel = inferBrandModel(productText);
  const products = inferProducts(productText);
  return {
    serial,
    dateRange,
    address,
    doorInfo: maybeDoor,
    productTypes: inferProductTypes(productText),
    brand: products[0]?.brand || brandModel.brand,
    modelName: products[0]?.modelName || brandModel.modelName || productText,
    products,
    customerName: parseCustomerName(customerText),
    price: money.price,
    payment: money.payment,
    requestMemo: [
      raw ? `복사 원문: ${raw}` : "",
      prefix ? `지역: ${prefix}` : "",
      productText ? `제품/브랜드 원문: ${productText}` : "",
      maybeExtra && !parseCustomerName(maybeExtra) ? `추가: ${maybeExtra}` : "",
      customerText ? `고객/비용 원문: ${customerText}` : "",
    ].filter(Boolean).join("\n"),
  };
}

function parseBOrder(raw) {
  const parts = raw.split("/").map(cleanPastePart).filter(Boolean);
  const serialIndex = parts.findIndex((part) => findSerial(part));
  if (serialIndex < 0) throw new Error("품번을 찾지 못했습니다.");
  const serial = findSerial(parts[serialIndex]);
  const beforeSerial = parts[serialIndex].replace(serial, "").trim();
  const prefix = [...parts.slice(0, serialIndex), beforeSerial].filter(Boolean).join(" ");
  const rest = parts.slice(serialIndex + 1);
  const contactTail = rest.shift() || "";
  let dateRange = rest.shift() || "";
  if (/^\d{3,4}(?:-\d{1,4})?$/.test(rest[0] || "") && rest.length > 1) {
    dateRange = [dateRange, rest.shift()].filter(Boolean).join("-");
  }
  dateRange = normalizeOrderDateRange(dateRange);
  const productText = rest.join(" / ");
  const money = parseMoney(productText);
  const dirty = parseContamination(productText);
  const cleanedProduct = productText
    .replace(money.full, "")
    .replace(dirty, "")
    .trim()
    .replace(/[,\s]+$/, "");
  const brandModel = inferBrandModel(cleanedProduct);
  const products = inferProducts(cleanedProduct);
  return {
    serial,
    contactTail,
    dateRange,
    productTypes: inferProductTypes(cleanedProduct),
    brand: products[0]?.brand || brandModel.brand,
    modelName: products[0]?.modelName || brandModel.modelName || cleanedProduct,
    products,
    contamination: dirty,
    price: money.price,
    payment: money.payment,
    requestMemo: [
      raw ? `복사 원문: ${raw}` : "",
      prefix ? `지역: ${prefix}` : "",
      productText ? `브랜드/모델 원문: ${productText}` : "",
    ].filter(Boolean).join("\n"),
  };
}

function applyParsedOrder(parsed) {
  orderForm.elements.serial.value = serialForOrderType(parsed.serial || "");
  orderForm.elements.contactTail.value = parsed.contactTail || "";
  orderForm.elements.dateRange.value = parsed.dateRange || "";
  orderForm.elements.address.value = parsed.address || "";
  orderForm.elements.doorInfo.value = parsed.doorInfo || "";
  setProductTypes(parsed.productTypes || []);
  orderForm.elements.brand.value = parsed.brand || "";
  orderForm.elements.modelName.value = parsed.modelName || "";
  setProductCount(Math.max(1, parsed.products?.length || 1));
  setProductDetails(parsed.products?.length ? parsed.products : [{ brand: parsed.brand || "", modelName: parsed.modelName || "" }]);
  orderForm.elements.customerName.value = parsed.customerName || "";
  orderForm.elements.contamination.value = parsed.contamination || "";
  orderForm.elements.price.value = parsed.price || "";
  orderForm.elements.payment.value = parsed.payment || "";
  orderForm.elements.requestMemo.value = parsed.requestMemo || "";
}

function inferProductTypes(text = "") {
  const source = String(text || "");
  const types = new Set();
  if (/카시트|바구니|이너|신생아|차량시트/u.test(source)) types.add("카시트");
  if (/유모차|프레임|캐노피|방풍|방한|레인|바퀴|스토케|부가부|리안|요요/u.test(source)) types.add("유모차");
  return Array.from(types);
}

function knownBrands() {
  return Object.keys(BRAND_CATALOG).filter((item) => item !== "기타");
}

function inferBrandModel(text = "") {
  const brands = knownBrands();
  const segment = String(text || "")
    .split(",")
    .map((item) => item.trim())
    .find((item) => brands.some((brand) => item.startsWith(brand))) || "";
  if (!segment) return { brand: "", modelName: "" };
  const brand = brands.find((item) => segment.startsWith(item)) || "";
  return { brand, modelName: segment.slice(brand.length).trim() };
}

function inferProducts(text = "") {
  const brands = knownBrands();
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const brand = brands.find((candidate) => item.startsWith(candidate)) || "";
      const product = splitProductNote(brand ? item.slice(brand.length).trim() : item);
      const accessories = extractAccessoryTags(item);
      return { types: inferProductTypes(item), brand, modelName: product.name, accessories, note: product.note };
    })
    .slice(0, 5);
}

function splitProductNote(text = "") {
  const source = String(text || "").trim();
  if (!source) return { name: "", note: "" };
  const notePattern = /(선결|곰팡이|오염|토사물|냄새|대변|소변).*/u;
  const noteMatch = source.match(notePattern);
  if (!noteMatch) return { name: source, note: "" };
  return {
    name: source.slice(0, noteMatch.index).replace(/[,\s]+$/, "").trim(),
    note: cleanProductNote(noteMatch[0]),
  };
}

function cleanProductNote(text = "") {
  return String(text || "")
    .replace(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:만원|만)/gu, "")
    .replace(/선결\s*쿠사|선결쿠사|선결|완결|완납|쿠사/gu, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function productNotePattern(label) {
  if (label === "선결") return /선결|완결|완납|쿠사/u;
  return new RegExp(label, "u");
}

function extractProductNoteTags(text = "") {
  const source = String(text || "");
  return PRODUCT_NOTE_OPTIONS.filter((label) => productNotePattern(label).test(source));
}

function mergeProductNoteTags(text = "") {
  const tags = extractProductNoteTags(text);
  const extra = String(text || "").split(",").map((item) => item.trim()).filter((item) => item && !tags.includes(item));
  return [...tags, ...extra].join(", ");
}

function accessoryPattern(label) {
  return new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "u");
}

function extractAccessoryTags(text = "") {
  const source = String(text || "");
  const options = Object.values(PRODUCT_ACCESSORY_OPTIONS).flat();
  return [...new Set(options.filter((label) => accessoryPattern(label).test(source)))];
}
function parseCustomerName(text = "") {
  return String(text || "").match(/([가-힣]{2,5})\s*(?:님|고객)?/)?.[1] || "";
}

function parseMoney(text = "") {
  const moneyPattern = /(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:만원|만|원)?\s*(?:선결|완결|완납|쿠사)?/gu;
  const candidates = Array.from(String(text || "").matchAll(moneyPattern))
    .map((match) => match[0].trim())
    .filter((value) => /,|\.\d|만|원|선결|완결|완납|쿠사/u.test(value));
  const full = candidates.at(-1) || "";
  const rawPrice = full.match(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s*(?:만원|만|원))?/)?.[0]?.trim() || "";
  const price = normalizePrice(rawPrice);
  const payment = String(text || "").match(/선결\s*쿠사|선결쿠사|선결|완결|완납|쿠사/u)?.[0]?.replace(/\s+/g, "") || "";
  return { full, price, payment };
}

function normalizePrice(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const numberText = raw.match(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/)?.[0] || "";
  if (!numberText) return raw;
  const amount = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return raw;
  const isManUnit = /만/.test(raw) || /\.\d+/.test(numberText);
  const won = isManUnit ? Math.round(amount * 10000) : Math.round(amount);
  return `${won.toLocaleString("ko-KR")}원`;
}

function parseContamination(text = "") {
  return String(text || "").match(/선결|곰팡이|오염|토사물|냄새|대변|소변|긴급|현장확인/u)?.[0] || "";
}

function isUrgentToken(value = "") {
  return /긴급|당일|급/u.test(String(value || ""));
}

function looksLikeDoorInfo(value = "") {
  return /^[#*\d,\-\s>비번누르고확인]+$/u.test(String(value || "")) && /\d/.test(String(value || ""));
}

function setProductTypes(types) {
  const selected = new Set(types);
  orderForm.querySelectorAll('input[name="productType"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function setProductCount(count) {
  state.productCount = Math.min(5, Math.max(1, Number(count) || 1));
  document.querySelectorAll("[data-product-count]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.productCount) === state.productCount);
  });
  renderProductFields(readProductDetails());
}

function renderProductFields(existing = []) {
  const container = document.querySelector("#productFields");
  if (!container) return;
  container.innerHTML = Array.from({ length: state.productCount }, (_, index) => {
    const product = existing[index] || {};
    const brandOptions = brandSelectOptions(product.brand);
    const modelOptions = modelSelectOptions(product.brand, product.modelName);
    const customBrand = !BRAND_CATALOG[product.brand] && product.brand ? product.brand : "";
    const knownModels = BRAND_CATALOG[product.brand] || [];
    const customModel = product.modelName && !knownModels.includes(product.modelName) ? product.modelName : "";
    return `
      <div class="product-item">
        <strong>제품 정보</strong>
        <div class="form-grid">
          <label>브랜드
            <select name="productBrand${index + 1}" data-product-brand="${index}">
              ${brandOptions}
            </select>
          </label>
          <label class="custom-product-field ${customBrand ? "" : "is-hidden"}">브랜드 직접 입력
            <input name="productBrandCustom${index + 1}" placeholder="브랜드" value="${escapeHtml(customBrand)}">
          </label>
          <label>모델명
            <select name="productModel${index + 1}" data-product-model="${index}">
              ${modelOptions}
            </select>
          </label>
          <label class="custom-product-field ${customModel || product.modelName === "기타" ? "" : "is-hidden"}">모델명 직접 입력
            <input name="productModelCustom${index + 1}" placeholder="모델명" value="${escapeHtml(customModel)}">
          </label>
        </div>
      </div>
    `;
  }).join("");
}

function readProductDetails() {
  return Array.from({ length: state.productCount }, (_, index) => ({
    brand: selectedProductBrand(index),
    modelName: selectedProductModel(index),
  }));
}

function brandSelectOptions(selected = "") {
  const current = BRAND_CATALOG[selected] ? selected : selected ? "기타" : "";
  return [
    `<option value="">브랜드 선택</option>`,
    ...Object.keys(BRAND_CATALOG).map((brand) => `<option value="${escapeHtml(brand)}" ${brand === current ? "selected" : ""}>${escapeHtml(brand)}</option>`),
  ].join("");
}

function modelSelectOptions(brand = "", selected = "") {
  const models = BRAND_CATALOG[brand] || ["기타"];
  const current = models.includes(selected) ? selected : selected ? "기타" : "";
  return [
    `<option value="">모델 선택</option>`,
    ...models.map((model) => `<option value="${escapeHtml(model)}" ${model === current ? "selected" : ""}>${escapeHtml(model)}</option>`),
  ].join("");
}

function selectedProductBrand(index) {
  const number = index + 1;
  const brand = orderForm.elements[`productBrand${number}`]?.value || "";
  if (brand === "기타") return orderForm.elements[`productBrandCustom${number}`]?.value?.trim() || "";
  return brand.trim();
}

function selectedProductModel(index) {
  const number = index + 1;
  const model = orderForm.elements[`productModel${number}`]?.value || "";
  if (model === "기타") return orderForm.elements[`productModelCustom${number}`]?.value?.trim() || "";
  return model.trim();
}

function selectedProductNote(index) {
  const number = index + 1;
  const selected = Array.from(orderForm.querySelectorAll(`input[name="productNoteOption${number}"]:checked`)).map((input) => input.value);
  const custom = orderForm.elements[`productNote${number}`]?.value?.trim() || "";
  const customItems = custom.split(",").map((item) => item.trim()).filter((item) => item && !selected.includes(item));
  return [...selected, ...customItems].join(", ");
}

function selectedProductAccessories(index) {
  const number = index + 1;
  return Array.from(orderForm.querySelectorAll(`input[name="productAccessoryOption${number}"]:checked`)).map((input) => input.value);
}

function customProductNoteText(note = "") {
  const tags = new Set(extractProductNoteTags(note));
  return String(note || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && !tags.has(item))
    .join(", ");
}

function refreshProductModelSelect(index) {
  const number = index + 1;
  const brandSelect = orderForm.elements[`productBrand${number}`];
  const modelSelect = orderForm.elements[`productModel${number}`];
  if (!brandSelect || !modelSelect) return;
  modelSelect.innerHTML = modelSelectOptions(brandSelect.value, "");
  toggleCustomProductFields(index);
}

function toggleCustomProductFields(index) {
  const number = index + 1;
  const brandSelect = orderForm.elements[`productBrand${number}`];
  const modelSelect = orderForm.elements[`productModel${number}`];
  const brandCustom = orderForm.elements[`productBrandCustom${number}`]?.closest(".custom-product-field");
  const modelCustom = orderForm.elements[`productModelCustom${number}`]?.closest(".custom-product-field");
  brandCustom?.classList.toggle("is-hidden", brandSelect?.value !== "기타");
  modelCustom?.classList.toggle("is-hidden", modelSelect?.value !== "기타");
}

function setProductDetails(products) {
  renderProductFields(products);
  const first = products[0] || {};
  orderForm.elements.brand.value = first.brand || "";
  orderForm.elements.modelName.value = first.modelName || "";
}

function getProductTypes() {
  return Array.from(orderForm.querySelectorAll('input[name="productType"]:checked')).map((input) => input.value);
}

function buildOrderMemo(baseMemo, doorInfo, dateRange) {
  const products = readProductDetails().filter((item) => item.brand || item.modelName);
  return [
    products.length ? `제품 정보:\n${products.map((item) => [item.brand, item.modelName].filter(Boolean).join(" ")).join("\n")}` : "",
    usesBOrderFormat() && fieldValue("contactTail") ? `연락처 뒷번호: ${fieldValue("contactTail")}` : "",
    doorInfo ? `현관 및 비밀번호: ${doorInfo}` : "",
    dateRange ? `${state.orderType === "B" || state.orderType === "AB" ? "접수날짜" : "시작일자 / 종료일자"}: ${dateRange}` : "",
    usesBOrderFormat() && fieldValue("contamination") ? `오염: ${fieldValue("contamination")}` : "",
    fieldValue("price") ? `비용: ${fieldValue("price")}` : "",
    usesBOrderFormat() && fieldValue("payment") ? `결제 여부: ${fieldValue("payment")}` : "",
    baseMemo || "",
  ].filter(Boolean).join("\n");
}

function emptyProductSlot() {
  return { types: [], brand: "", modelName: "", accessories: [], note: "" };
}

function normalizeProductSlot(product = {}) {
  const split = splitProductNote(product.modelName || "");
  const text = [product.brand, product.modelName].filter(Boolean).join(" ");
  const types = (Array.isArray(product.types) ? product.types.filter(Boolean) : inferProductTypes(text)).slice(0, 1);
  const allowedAccessories = types[0] ? PRODUCT_ACCESSORY_OPTIONS[types[0]] || [] : Object.values(PRODUCT_ACCESSORY_OPTIONS).flat();
  const accessories = (Array.isArray(product.accessories) ? product.accessories.filter(Boolean) : extractAccessoryTags(text))
    .filter((item) => allowedAccessories.includes(item));
  return {
    types,
    brand: product.brand || "",
    modelName: product.note ? product.modelName || "" : split.name,
    accessories,
    note: mergeProductNoteTags(product.note || split.note),
  };
}

function setProductTypes(types) {
  state.productSlots[0] = {
    ...normalizeProductSlot(state.productSlots[0]),
    types: Array.isArray(types) ? types.filter(Boolean).slice(0, 1) : [],
  };
  if (state.activeProductIndex === 0) setActiveProductTypes(types);
}

function setActiveProductTypes(types) {
  const selected = new Set(types || []);
  orderForm.querySelectorAll('input[name="activeProductType"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function getActiveProductTypes() {
  return Array.from(orderForm.querySelectorAll('input[name="activeProductType"]:checked')).map((input) => input.value);
}

function saveActiveProductSlot() {
  const container = document.querySelector("#productFields");
  if (!container || !container.children.length) return;
  const index = state.activeProductIndex;
  state.productSlots[index] = {
    types: getActiveProductTypes(),
    brand: selectedProductBrand(index),
    modelName: selectedProductModel(index),
    accessories: selectedProductAccessories(index),
    note: selectedProductNote(index),
  };
}

function setProductCount(count) {
  setActiveProductIndex(Math.min(4, Math.max(0, Number(count) - 1 || 0)));
}

function setActiveProductIndex(index) {
  saveActiveProductSlot();
  state.activeProductIndex = Math.min(4, Math.max(0, Number(index) || 0));
  refreshProductIndexButtons();
  renderProductFields();
}

function hasProductSlotData(product = {}) {
  const normalized = normalizeProductSlot(product);
  return Boolean(normalized.types.length || normalized.brand || normalized.modelName || normalized.accessories.length || normalized.note);
}

function refreshProductIndexButtons() {
  document.querySelectorAll("[data-product-index]").forEach((button) => {
    const index = Number(button.dataset.productIndex);
    button.classList.toggle("is-active", index === state.activeProductIndex);
    button.classList.toggle("is-filled", hasProductSlotData(state.productSlots[index]));
  });
}

function renderProductFields() {
  const container = document.querySelector("#productFields");
  if (!container) return;
  const index = state.activeProductIndex;
  const product = normalizeProductSlot(state.productSlots[index]);
  setActiveProductTypes(product.types);
  const brandOptions = brandSelectOptions(product.brand);
  const modelOptions = modelSelectOptions(product.brand, product.modelName);
  const customBrand = !BRAND_CATALOG[product.brand] && product.brand ? product.brand : "";
  const knownModels = BRAND_CATALOG[product.brand] || [];
  const customModel = product.modelName && !knownModels.includes(product.modelName) ? product.modelName : "";
  const selectedNotes = new Set(extractProductNoteTags(product.note));
  const customNote = customProductNoteText(product.note);
  const selectedAccessories = new Set(product.accessories || []);
  const accessoryOptions = PRODUCT_ACCESSORY_OPTIONS[product.types[0]] || [];
  container.innerHTML = `
    <div class="product-item">
      <strong>품목 정보</strong>
      <fieldset class="choice-group product-kind-group">
        <legend>품목 종류</legend>
        <label><input type="radio" name="activeProductType" value="카시트" ${product.types[0] === "카시트" ? "checked" : ""}><span>카시트</span></label>
        <label><input type="radio" name="activeProductType" value="유모차" ${product.types[0] === "유모차" ? "checked" : ""}><span>유모차</span></label>
      </fieldset>
      <fieldset class="choice-group product-accessory-group">
        <legend>부속품</legend>
        ${accessoryOptions.length ? accessoryOptions.map((accessory) => `
          <label><input type="checkbox" name="productAccessoryOption${index + 1}" value="${escapeHtml(accessory)}" ${selectedAccessories.has(accessory) ? "checked" : ""}><span>${escapeHtml(accessory)}</span></label>
        `).join("") : `<p class="choice-empty">품목 종류를 선택하면 부속품이 표시됩니다.</p>`}
      </fieldset>
      <div class="form-grid">
        <label>브랜드
          <select name="productBrand${index + 1}" data-product-brand="${index}">
            ${brandOptions}
          </select>
        </label>
        <label class="custom-product-field ${customBrand ? "" : "is-hidden"}">브랜드 직접 입력
          <input name="productBrandCustom${index + 1}" placeholder="브랜드" value="${escapeHtml(customBrand)}">
        </label>
        <label>모델명
          <select name="productModel${index + 1}" data-product-model="${index}">
            ${modelOptions}
          </select>
        </label>
        <label class="custom-product-field ${customModel || product.modelName === "기타" ? "" : "is-hidden"}">모델명 직접 입력
          <input name="productModelCustom${index + 1}" placeholder="모델명" value="${escapeHtml(customModel)}">
        </label>
      </div>
      <fieldset class="choice-group product-note-group">
        <legend>중요</legend>
        ${PRODUCT_NOTE_OPTIONS.map((note) => `
          <label><input type="checkbox" name="productNoteOption${index + 1}" value="${escapeHtml(note)}" ${selectedNotes.has(note) ? "checked" : ""}><span>${escapeHtml(note)}</span></label>
        `).join("")}
      </fieldset>
      <label>기타 사항
        <input name="productNote${index + 1}" placeholder="기타 중요 내용 직접 입력" value="${escapeHtml(customNote)}">
      </label>
    </div>
  `;
  refreshProductIndexButtons();
}

function readProductDetails() {
  saveActiveProductSlot();
  return state.productSlots.map((product) => normalizeProductSlot(product));
}

function setProductDetails(products = []) {
  const firstSlotTypes = normalizeProductSlot(state.productSlots[0]).types;
  state.productSlots = Array.from({ length: 5 }, (_, index) => {
    const normalized = normalizeProductSlot(products[index] || emptyProductSlot());
    if (index === 0 && !normalized.types.length && firstSlotTypes.length) normalized.types = firstSlotTypes;
    return normalized;
  });
  state.activeProductIndex = 0;
  refreshProductIndexButtons();
  renderProductFields();
  const first = state.productSlots.find((item) => item.brand || item.modelName) || {};
  orderForm.elements.brand.value = first.brand || "";
  orderForm.elements.modelName.value = first.modelName || "";
}

function getProductTypes() {
  return Array.from(new Set(readProductDetails().flatMap((item) => item.types || [])));
}

function buildOrderMemo(baseMemo, doorInfo, dateRange) {
  const products = readProductDetails().filter((item) => item.types.length || item.brand || item.modelName || item.accessories.length || item.note);
  const importantMemo = fieldValue("specialMemo");
  const allAccessories = [...new Set(products.flatMap((item) => item.accessories || []))];
  const productNotes = [...new Set(products.flatMap((item) => extractProductNoteTags(item.note || "")))];
  const importantParts = [...new Set([importantMemo, ...productNotes, usesBOrderFormat() && fieldValue("contamination") ? fieldValue("contamination") : ""].filter(Boolean))];
  return [
    products.length ? `품목 정보:\n${products.map((item) => {
      const parts = [item.types.join("/"), item.brand, item.modelName].filter(Boolean);
      if (item.accessories.length) parts.push(`부속품: ${item.accessories.join(", ")}`);
      if (item.note) parts.push(`요청: ${item.note}`);
      return parts.join(" ");
    }).join("\n")}` : "",
    allAccessories.length ? `부속품: ${allAccessories.join(", ")}` : "",
    importantParts.length ? `중요: ${importantParts.join(", ")}` : "",
    usesBOrderFormat() && fieldValue("contactTail") ? `연락처 뒷번호: ${fieldValue("contactTail")}` : "",
    doorInfo ? `공동현관/비밀번호: ${doorInfo}` : "",
    dateRange ? `${state.orderType === "B" || state.orderType === "AB" ? "접수일자" : "시작일자 / 완료일자"}: ${dateRange}` : "",
    usesBOrderFormat() && fieldValue("contamination") ? `오염: ${fieldValue("contamination")}` : "",
    fieldValue("price") ? `비용: ${fieldValue("price")}` : "",
    usesBOrderFormat() && fieldValue("payment") ? `결제 여부: ${fieldValue("payment")}` : "",
    baseMemo || "",
  ].filter(Boolean).join("\n");
}

function fieldValue(name) {
  return orderForm.elements[name]?.value?.trim() || "";
}

function setOrderType(type) {
  state.orderType = type;
  document.querySelectorAll("[data-order-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.orderType === type);
  });
  updateOrderTypeFields();
}

function updateOrderTypeFields() {
  const visibleByType = {
    A: ["serial", "dateRange", "address", "productDetails", "customerName", "price"],
    B: ["serial", "contactTail", "dateRange", "productDetails", "contamination", "price", "payment"],
    AB: ["serial", "contactTail", "dateRange", "productDetails", "contamination", "price", "payment"],
    BA: ["serial", "dateRange", "address", "productDetails", "customerName", "price"],
  };
  const visible = new Set(visibleByType[state.orderType] || visibleByType.A);
  document.querySelectorAll("[data-order-field]").forEach((field) => {
    field.hidden = !visible.has(field.dataset.orderField);
  });
  setFieldLabel("dateRange", "접수일자");
  setFieldLabel("productType", "품목 종류");
}

function setFieldLabel(name, text) {
  const field = document.querySelector(`[data-order-field="${name}"]`);
  if (!field) return;
  if (field.tagName === "FIELDSET") {
    const legend = field.querySelector("legend");
    if (legend) legend.textContent = text;
    return;
  }
  const textNode = Array.from(field.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = text;
