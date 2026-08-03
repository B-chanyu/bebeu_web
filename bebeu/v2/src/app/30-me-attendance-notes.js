function stats() {
  const active = state.data.orders.filter((order) => order.status !== "완료" || order.currentStep === "04").length;
  const done = state.data.orders.filter((order) => order.status === "완료").length;
  const photos = state.data.orders.reduce((sum, order) => sum + order.photos.length, 0);
  return `
    <section class="stats-grid">
      <div class="stat-card"><span>진행</span><strong>${active}</strong></div>
      <div class="stat-card"><span>완료</span><strong>${done}</strong></div>
      <div class="stat-card"><span>사진</span><strong>${photos}</strong></div>
    </section>
  `;
}

function workMinutesBetween(start, end) {
  const from = new Date(start);
  const to = new Date(end);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) return 0;
  let minutes = Math.max(0, Math.round((to - from) / 60000));
  const lunchStart = new Date(from);
  lunchStart.setHours(12, 0, 0, 0);
  const lunchEnd = new Date(from);
  lunchEnd.setHours(13, 0, 0, 0);
  const overlapStart = Math.max(from.getTime(), lunchStart.getTime());
  const overlapEnd = Math.min(to.getTime(), lunchEnd.getTime());
  if (overlapEnd > overlapStart) minutes -= Math.round((overlapEnd - overlapStart) / 60000);
  return Math.max(0, minutes);
}

function formatWorkHours(minutes) {
  if (!minutes) return "0";
  return Number((minutes / 60).toFixed(1)).toString();
}

function attendanceSummary(user, now = new Date()) {
  const monthly = new Map();
  const records = (state.data.attendance || [])
    .filter((item) => item.userId === user.id)
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let openIn = null;
  records.forEach((record) => {
    const created = new Date(record.createdAt);
    if (!Number.isFinite(created.getTime())) return;
    if (record.action === "in") {
      openIn = created;
      return;
    }
    if (record.action !== "out" || !openIn) return;
    const day = openIn.getDate();
    if (openIn.getFullYear() === currentYear && openIn.getMonth() === currentMonth) {
      const current = monthly.get(day) || { minutes: 0, estimated: false };
      current.minutes += workMinutesBetween(openIn, created);
      monthly.set(day, current);
    }
    openIn = null;
  });
  if (user.clockedIn && openIn && openIn.getFullYear() === currentYear && openIn.getMonth() === currentMonth) {
    const day = openIn.getDate();
    const current = monthly.get(day) || { minutes: 0, estimated: false };
    current.minutes += workMinutesBetween(openIn, now);
    current.estimated = true;
    monthly.set(day, current);
  }
  let totalMinutes = 0;
  let estimatedMinutes = 0;
  monthly.forEach((item) => {
    totalMinutes += item.minutes;
    if (item.estimated) estimatedMinutes += item.minutes;
  });
  return { days: monthly, totalMinutes, estimatedMinutes };
}

function hourlyWageKey(userId) {
  return `bebeu.hourlyWage.${userId}`;
}

function hourlyWageForUser(userId) {
  const fromServer = Number(state.data?.hourlyWages?.[userId]);
  if (Number.isFinite(fromServer) && fromServer > 0) return fromServer;
  const saved = Number(localStorage.getItem(hourlyWageKey(userId)));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_HOURLY_WAGE;
}

async function setHourlyWageForUser(userId, value) {
  const wage = Math.max(0, Math.round(Number(value) || DEFAULT_HOURLY_WAGE));
  localStorage.setItem(hourlyWageKey(userId), String(wage));
  const result = await api("/api/hourly-wages", {
    method: "POST",
    body: JSON.stringify({ userId, amount: wage }),
  });
  state.data.hourlyWages = { ...(state.data.hourlyWages || {}), [result.userId]: result.amount };
  return wage;
}

async function saveAttendanceDayTime(form) {
  const userId = form.dataset.attendanceTimeForm;
  const user = state.data.users.find((item) => item.id === userId);
  if (!user || !state.attendanceEditDay) return;
  const now = new Date();
  const date = monthDateText(now.getFullYear(), now.getMonth(), state.attendanceEditDay);
  const formData = new FormData(form);
  await api("/api/attendance/day", {
    method: "POST",
    body: JSON.stringify({
      userId,
      date,
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
    }),
  });
  await load();
}

async function deleteAttendanceDayTime(userId) {
  const user = state.data.users.find((item) => item.id === userId);
  if (!user || !state.attendanceEditDay) return;
  const now = new Date();
  const date = monthDateText(now.getFullYear(), now.getMonth(), state.attendanceEditDay);
  await api("/api/attendance/day", {
    method: "DELETE",
    body: JSON.stringify({ userId, date }),
  });
  await load();
}

function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

function payrollMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function payrollSettingForUser(userId, now = new Date()) {
  const monthKey = payrollMonthKey(now);
  const setting = state.data?.payrollSettings?.[`${userId}:${monthKey}`] || {};
  return {
    userId,
    monthKey,
    deliveryCount: Math.max(0, Number(setting.deliveryCount) || 0),
    deliveryPrice: Math.max(0, Number(setting.deliveryPrice) || 0),
    adjustments: Array.isArray(setting.adjustments) ? setting.adjustments : [],
  };
}

function payrollAdjustmentTotal(adjustments = []) {
  return adjustments.reduce((sum, item) => {
    const amount = Math.max(0, Number(item.amount) || 0);
    return sum + (item.type === "minus" ? -amount : amount);
  }, 0);
}

function payrollTotalsForUser(user, now = new Date()) {
  const summary = attendanceSummary(user, now);
  const wage = hourlyWageForUser(user.id);
  const setting = payrollSettingForUser(user.id, now);
  const basePay = (summary.totalMinutes / 60) * wage;
  const deliveryPay = setting.deliveryCount * setting.deliveryPrice;
  const adjustmentPay = payrollAdjustmentTotal(setting.adjustments);
  const totalPay = basePay + deliveryPay + adjustmentPay;
  return { summary, wage, setting, basePay, deliveryPay, adjustmentPay, totalPay };
}

async function savePayrollSettingForUser(userId, now = new Date()) {
  const form = document.querySelector("#payrollSettingForm");
  const deliveryCount = Number(document.querySelector("#payrollDeliveryCount")?.value) || 0;
  const deliveryPrice = Number(document.querySelector("#payrollDeliveryPrice")?.value) || 0;
  const adjustments = Array.from(form?.querySelectorAll("[data-payroll-adjustment-row]") || []).map((row) => ({
    id: row.dataset.adjustmentId || `${Date.now()}-${Math.random()}`,
    title: row.querySelector("[name='adjustmentTitle']")?.value || "",
    type: row.querySelector("[name='adjustmentType']")?.value === "minus" ? "minus" : "plus",
    amount: Number(row.querySelector("[name='adjustmentAmount']")?.value) || 0,
  }));
  const result = await api("/api/payroll-settings", {
    method: "POST",
    body: JSON.stringify({ userId, monthKey: payrollMonthKey(now), deliveryCount, deliveryPrice, adjustments }),
  });
  state.data.payrollSettings = { ...(state.data.payrollSettings || {}), [result.key]: result.setting };
}

function refreshPayrollPreview() {
  const form = document.querySelector("#payrollSettingForm");
  const total = document.querySelector("#payrollTotalAmount");
  const bottomTotal = document.querySelector("#payrollBottomTotalAmount");
  if (!form || !total) return;
  const basePay = Number(form.dataset.basePay) || 0;
  const deliveryCount = Number(document.querySelector("#payrollDeliveryCount")?.value) || 0;
  const deliveryPrice = Number(document.querySelector("#payrollDeliveryPrice")?.value) || 0;
  const adjustments = Array.from(form.querySelectorAll("[data-payroll-adjustment-row]")).map((row) => ({
    type: row.querySelector("[name='adjustmentType']")?.value === "minus" ? "minus" : "plus",
    amount: Number(row.querySelector("[name='adjustmentAmount']")?.value) || 0,
  }));
  const nextTotal = formatMoney(basePay + (deliveryCount * deliveryPrice) + payrollAdjustmentTotal(adjustments));
  total.textContent = nextTotal;
  if (bottomTotal) bottomTotal.textContent = nextTotal;
}

function attendanceDayRows(user, now = new Date()) {
  const summary = attendanceSummary(user, now);
  return Array.from(summary.days.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, info]) => ({
      day,
      minutes: info.minutes,
      estimated: info.estimated,
    }));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function monthDateText(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function timeInputValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function attendanceTimesForDay(user, year, monthIndex, day) {
  const records = (state.data.attendance || [])
    .filter((item) => {
      if (item.userId !== user.id) return false;
      const date = new Date(item.createdAt);
      return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return {
    start: timeInputValue(records.find((item) => item.action === "in")?.createdAt),
    end: timeInputValue(records.slice().reverse().find((item) => item.action === "out")?.createdAt),
  };
}

function renderAttendanceCalendar(user) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const summary = attendanceSummary(user, now);
  const blanks = Array.from({ length: firstWeekday }, (_, index) => `<div class="attendance-day is-empty" aria-hidden="true" data-empty="${index}"></div>`).join("");
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const info = summary.days.get(day);
    const hours = info ? formatWorkHours(info.minutes) : "";
    return `
      <div class="attendance-day ${info ? "worked" : ""} ${info?.estimated ? "is-estimated" : ""}">
        <strong>${day}</strong>
        ${info ? `<span>+${hours}</span>` : ""}
      </div>
    `;
  }).join("");
  return `
    <section class="panel attendance-panel">
      <div class="section-title">
        <h3>${now.getFullYear()}년 ${now.getMonth() + 1}월 근태</h3>
        <span class="chip">총 ${formatWorkHours(summary.totalMinutes)}시간</span>
      </div>
      <div class="attendance-weekdays" aria-hidden="true">
        ${["일", "월", "화", "수", "목", "금", "토"].map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="attendance-calendar">
        ${blanks}${days}
      </div>
      <div class="attendance-summary">
        <strong>총 근무 시간 ${formatWorkHours(summary.totalMinutes)}시간</strong>
        <span>예상 근무 시간 ${formatWorkHours(summary.estimatedMinutes || summary.totalMinutes)}시간</span>
        <small>12:00~13:00 점심시간은 자동 제외됩니다.</small>
      </div>
    </section>
  `;
}

function renderAttendancePayrollPanel(currentUser) {
  if (!isAdminUser(currentUser)) return "";
  const users = state.data.users || [];
  const now = new Date();
  const payrollRows = users.map((user) => ({ user, totals: payrollTotalsForUser(user, now) }));
  const grandTotal = payrollRows.reduce((sum, row) => sum + row.totals.totalPay, 0);
  return `
    <section class="panel attendance-payroll-panel">
      <div class="section-title">
        <h3>직원별 근태 결산</h3>
        <span class="chip">${now.getFullYear()}년 ${now.getMonth() + 1}월</span>
      </div>
      <div class="attendance-payroll-total">
        <span>현재까지 전체 금액</span>
        <strong>${formatMoney(grandTotal)}</strong>
      </div>
      <div class="attendance-payroll-list">
        ${payrollRows.map(({ user, totals }) => {
          return `
            <button class="attendance-payroll-card" type="button" data-payroll-user="${escapeHtml(user.id)}">
              <span>
                <strong>${escapeDisplay(user.name)}</strong>
                <small>${escapeDisplay(user.role)} · ${totals.summary.days.size}일 근무 · 배송 ${totals.setting.deliveryCount}건</small>
              </span>
              <b>${formatWorkHours(totals.summary.totalMinutes)}시간</b>
              <em>${formatMoney(totals.totalPay)}</em>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAttendancePayrollModal() {
  const user = state.data.users.find((item) => item.id === state.attendancePayrollUserId);
  if (!user) return "";
  const now = new Date();
  const { summary, wage, setting, basePay, deliveryPay, adjustmentPay, totalPay } = payrollTotalsForUser(user, now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const selectedDay = Number(state.attendanceEditDay || now.getDate());
  const selectedDateText = monthDateText(now.getFullYear(), now.getMonth(), selectedDay);
  const selectedTimes = attendanceTimesForDay(user, now.getFullYear(), now.getMonth(), selectedDay);
  const timeEditorHtml = `
    <form class="attendance-time-editor" data-attendance-time-form="${escapeHtml(user.id)}">
      <strong>${selectedDateText}</strong>
      <label>시작
        <input name="startTime" type="time" value="${escapeHtml(selectedTimes.start || "09:00")}" required>
      </label>
      <label>끝
        <input name="endTime" type="time" value="${escapeHtml(selectedTimes.end || "18:00")}" required>
      </label>
      <div class="attendance-time-actions">
        <button class="primary-button" type="submit">시간 저장</button>
        <button class="danger-button" type="button" data-delete-attendance-day="${escapeHtml(user.id)}">시간 삭제</button>
      </div>
    </form>
  `;
  return `
    <div class="modal-backdrop attendance-modal" role="dialog" aria-modal="true">
      <section class="modal-card attendance-modal-card">
        <div class="section-title">
          <h3>${escapeDisplay(user.name)} 근태 결산</h3>
          <button class="icon-button" type="button" data-close-payroll-modal aria-label="닫기">×</button>
        </div>
        <label>시급
          <input id="hourlyWageInput" type="number" inputmode="numeric" min="0" step="10" value="${wage}">
        </label>
        <div class="attendance-modal-summary">
          <span>총 ${formatWorkHours(summary.totalMinutes)}시간 · 배송 ${setting.deliveryCount}건</span>
          <strong id="payrollTotalAmount">${formatMoney(totalPay)}</strong>
        </div>
        <div class="attendance-day-list">
          ${Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const info = summary.days.get(day);
            const minutes = info?.minutes || 0;
            return `
              <button class="attendance-day-row ${selectedDay === day ? "is-active" : ""}" type="button" data-edit-attendance-day="${day}" ${selectedDay === day ? "data-selected-attendance-day=\"true\"" : ""}>
                <span>${now.getMonth() + 1}/${day}</span>
                <b>${minutes ? `${formatWorkHours(minutes)}시간${info?.estimated ? " 예상" : ""}` : "미근무"}</b>
                <em>${minutes ? formatMoney((minutes / 60) * wage) : "-"}</em>
              </button>
              ${selectedDay === day ? timeEditorHtml : ""}
            `;
          }).join("")}
        </div>
        ${renderPayrollSettingEditor(user, setting, basePay, deliveryPay, adjustmentPay)}
        <div class="payroll-grand-total">
          <span>총 합계 금액</span>
          <strong id="payrollBottomTotalAmount">${formatMoney(totalPay)}</strong>
        </div>
        <button class="secondary-button" type="button" data-save-hourly-wage="${escapeHtml(user.id)}">저장</button>
      </section>
    </div>
  `;
}

function renderPayrollSettingEditor(user, setting, basePay, deliveryPay, adjustmentPay) {
  return `
    <form class="payroll-setting-form" id="payrollSettingForm" data-base-pay="${Math.round(basePay)}">
      <div class="payroll-breakdown">
        <span>근무 ${formatMoney(basePay)}</span>
        <span>배송 ${formatMoney(deliveryPay)}</span>
        <span>기타 ${formatMoney(adjustmentPay)}</span>
      </div>
      <section class="payroll-delivery-box">
        <div class="section-title"><h3>배송</h3><span class="chip">${formatMoney(deliveryPay)}</span></div>
        <div class="payroll-counter">
          <button type="button" data-payroll-delivery-change="-1">-</button>
          <input id="payrollDeliveryCount" type="number" inputmode="numeric" min="0" step="1" value="${setting.deliveryCount}" aria-label="배송 건수">
          <button type="button" data-payroll-delivery-change="1">+</button>
        </div>
        <label>배송 건당 가격
          <input id="payrollDeliveryPrice" type="number" inputmode="numeric" min="0" step="100" value="${setting.deliveryPrice}">
        </label>
      </section>
      <section class="payroll-extra-box">
        <div class="section-title">
          <h3>기타</h3>
          <button class="secondary-button" type="button" data-add-payroll-adjustment="${escapeHtml(user.id)}">항목 추가</button>
        </div>
        <div class="payroll-adjustment-list">
          ${(setting.adjustments.length ? setting.adjustments : [{ id: "new", title: "", type: "plus", amount: 0 }]).map((item) => `
            <div class="payroll-adjustment-row" data-payroll-adjustment-row data-adjustment-id="${escapeHtml(item.id || "")}">
              <select name="adjustmentType" aria-label="더하기 빼기">
                <option value="plus" ${item.type !== "minus" ? "selected" : ""}>+</option>
                <option value="minus" ${item.type === "minus" ? "selected" : ""}>-</option>
              </select>
              <input name="adjustmentTitle" value="${escapeHtml(item.title || "")}" placeholder="항목 입력">
              <input name="adjustmentAmount" type="number" inputmode="numeric" min="0" step="100" value="${Math.max(0, Number(item.amount) || 0)}" placeholder="금액">
              <button class="icon-button" type="button" data-remove-payroll-adjustment aria-label="삭제">×</button>
            </div>
          `).join("")}
        </div>
      </section>
    </form>
  `;
}

function scrollSelectedAttendanceDay() {
  requestAnimationFrame(() => {
    const row = document.querySelector("[data-selected-attendance-day='true']");
    const card = row?.closest(".attendance-modal-card");
    if (!row || !card) return;
    const header = card.querySelector(".section-title");
    const headerHeight = header?.offsetHeight || 0;
    card.scrollTo({
      top: Math.max(0, row.offsetTop - headerHeight - 8),
      left: 0,
      behavior: "auto",
    });
  });
}

function renderMe() {
  title.textContent = "내 정보";
  const user = activeUser();
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const workedDays = new Set(
    state.data.attendance
      .filter((item) => item.userId === user.id && item.action === "in")
      .map((item) => new Date(item.createdAt).getDate())
  );

  content.innerHTML = `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">오늘의 작업</p>
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.branch)} · ${escapeHtml(user.role)} · ${user.clockedIn ? "출근 중" : "퇴근"}</p>
      </div>
      <button class="${user.clockedIn ? "danger-button" : "primary-button compact"}" data-attendance="${user.clockedIn ? "out" : "in"}">
        ${user.clockedIn ? "퇴근" : "출근"}
      </button>
    </section>
    ${stats()}
    <section class="panel">
      <div class="section-title">
        <h3>${now.getFullYear()}년 ${now.getMonth() + 1}월 근태</h3>
        <span class="chip">이번 달</span>
      </div>
      <div class="calendar">
        ${Array.from({ length: days }, (_, index) => `<div class="day ${workedDays.has(index + 1) ? "worked" : ""}">${index + 1}</div>`).join("")}
      </div>
    </section>
    ${renderAdminMemoPanel(user)}
  `;
}

function renderMeKeep() {
  title.textContent = "내 정보";
  const user = activeUser();
  content.innerHTML = `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">BEBEU WORK</p>
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.branch)} · ${escapeHtml(user.role)} · ${user.clockedIn ? "출근 중" : "퇴근"}</p>
      </div>
      <button class="${user.clockedIn ? "danger-button" : "primary-button compact"}" type="button" data-attendance="${user.clockedIn ? "out" : "in"}">
        ${user.clockedIn ? "퇴근" : "출근"}
      </button>
    </section>
    ${renderAttendanceCalendar(user)}
    ${renderAttendancePayrollPanel(user)}
    ${renderKeepPanel(user)}
    ${renderAdminMemoPanel(user)}
    ${renderAttendancePayrollModal()}
  `;
}

function renderKeepPanel(user) {
  const notes = visibleKeepNotes(user);
  const editing = state.keepEditingId
    ? (state.keepEditingId === "__new" ? null : notes.find((note) => note.id === state.keepEditingId))
    : null;
  const editorType = editing?.type || state.keepEditingType || "text";
  return `
    <section class="panel keep-panel">
      <div class="section-title">
        <h3>메모</h3>
        <span class="chip">${notes.length}개</span>
      </div>
      <div class="keep-actions">
        <button class="secondary-button" type="button" data-new-keep-note="text">메모 작성</button>
        <button class="secondary-button" type="button" data-new-keep-note="checklist">체크리스트</button>
      </div>
      ${state.keepEditingId ? renderKeepEditor(editing, editorType, user) : ""}
      <div class="keep-grid">
        ${notes.length ? notes.map((note) => renderKeepCard(note, user)).join("") : `<p class="helper">아직 등록된 메모가 없습니다.</p>`}
      </div>
    </section>
  `;
}

function visibleKeepNotes(user) {
  return (state.data.keepNotes || [])
    .filter((note) => keepNoteRole(note, user))
    .sort((a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || new Date(b.updatedAt) - new Date(a.updatedAt)
    );
}

function keepNoteRole(note, user = activeUser()) {
  if (!note || !user) return "";
  if (note.ownerId === user.id) return "owner";
  return (note.collaborators || []).find((item) => item.userId === user.id)?.permission || "";
}

function canEditKeepNote(note, user = activeUser()) {
  const role = keepNoteRole(note, user);
  return role === "owner" || role === "edit";
}

function renderKeepCard(note, user) {
  const role = keepNoteRole(note, user);
  const preview = note.type === "checklist"
    ? (note.items || []).slice(0, 4).map((item) => `${item.done ? "?" : "·"} ${item.text}`).join("\n")
    : note.body;
  const shared = (note.collaborators || []).length;
  return `
    <article class="keep-card ${note.pinned ? "is-pinned" : ""}" data-open-keep-note="${escapeHtml(note.id)}">
      <button class="keep-card-button" type="button" data-open-keep-note="${escapeHtml(note.id)}">
        <div class="keep-card-head">
          <strong>${escapeHtml(note.title || "제목 없음")}</strong>
          <span>${note.pinned ? "고정" : role === "owner" ? "내 메모" : "공유"}</span>
        </div>
        <p>${escapeHtml(preview || "내용 없음")}</p>
        <div class="keep-meta">
          <span>${escapeHtml(fmt(note.updatedAt))}</span>
          ${shared ? `<span>공동작업 ${shared}명</span>` : ""}
        </div>
      </button>
    </article>
  `;
}

function renderKeepEditor(note, type, user) {
  const isNew = !note;
  const canEdit = isNew || canEditKeepNote(note, user);
  const isOwner = isNew || note.ownerId === user.id;
  const collaborators = note?.collaborators || [];
  return `
    <form class="keep-editor" id="keepNoteForm" data-keep-id="${escapeHtml(note?.id || "")}" data-keep-type="${escapeHtml(type)}">
      <div class="keep-editor-head">
        <strong>${isNew ? (type === "checklist" ? "새 체크리스트" : "새 메모") : "메모 수정"}</strong>
        <label class="keep-pin-toggle">
          <input type="checkbox" name="pinned" ${note?.pinned ? "checked" : ""} ${canEdit ? "" : "disabled"}>
          <span>고정</span>
        </label>
      </div>
      <input name="title" placeholder="제목" value="${escapeHtml(note?.title || "")}" ${canEdit ? "" : "readonly"}>
      ${type === "checklist" ? renderChecklistEditor(note?.items || [], canEdit) : `<textarea name="body" rows="5" placeholder="메모 작성" ${canEdit ? "" : "readonly"}>${escapeHtml(note?.body || "")}</textarea>`}
      ${isOwner ? renderCollaboratorEditor(collaborators) : `<p class="helper">공유받은 메모입니다. 권한: ${keepNoteRole(note, user) === "edit" ? "수정 가능" : "보기 전용"}</p>`}
      <div class="keep-editor-actions">
        <button class="secondary-button" type="button" data-cancel-keep-note>닫기</button>
        ${!isNew && isOwner ? `<button class="danger-button" type="button" data-delete-keep-note="${escapeHtml(note.id)}">삭제</button>` : ""}
        ${canEdit ? `<button class="primary-button" type="submit">저장</button>` : ""}
      </div>
    </form>
  `;
}

function renderChecklistEditor(items, canEdit) {
  const rows = items.length ? items : [{ id: "", text: "", done: false }];
  return `
    <div class="keep-checklist-editor">
      ${rows.map((item, index) => renderChecklistRow(item, index, canEdit)).join("")}
    </div>
    ${canEdit ? `<button class="secondary-button compact keep-add-item" type="button" data-add-check-item>항목 추가</button>` : ""}
  `;
}

function renderChecklistRow(item, index, canEdit) {
  return `
    <div class="keep-check-row" data-check-row>
      <input type="hidden" name="checkId" value="${escapeHtml(item.id || "")}">
      <input type="checkbox" name="checkDone" ${item.done ? "checked" : ""} ${canEdit ? "" : "disabled"}>
      <input name="checkText" value="${escapeHtml(item.text || "")}" placeholder="할 일" ${canEdit ? "" : "readonly"}>
      <button type="button" data-move-check="-1" ${!canEdit || index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-move-check="1" ${!canEdit ? "disabled" : ""}>↓</button>
      <button type="button" data-remove-check-item ${canEdit ? "" : "disabled"}>×</button>
    </div>
  `;
}

function renderCollaboratorEditor(collaborators) {
  const byUser = new Map((collaborators || []).map((item) => [item.userId, item.permission]));
  return `
    <fieldset class="keep-share-box">
      <legend>공동작업</legend>
      ${state.data.users.filter((member) => member.id !== activeUser().id).map((member) => {
        const permission = byUser.get(member.id) || "";
        return `
          <label class="keep-share-row">
            <input type="checkbox" data-keep-collaborator="${escapeHtml(member.id)}" ${permission ? "checked" : ""}>
            <span>${escapeHtml(member.name)}</span>
            <select data-keep-permission="${escapeHtml(member.id)}">
              <option value="view" ${permission !== "edit" ? "selected" : ""}>보기</option>
              <option value="edit" ${permission === "edit" ? "selected" : ""}>수정</option>
            </select>
          </label>
        `;
      }).join("")}
    </fieldset>
  `;
}

function renderAdminMemoPanel(user) {
  const globalMemo = adminMemoById("admin-global")?.body || "";
  const memberMemo = adminMemoById(adminMemoIdForUser(user.id))?.body || "";
  const legacyMemos = state.data.adminMemos.filter((memo) => memo.id !== "admin-global" && !memo.id.startsWith("admin-user-"));
  if (!isAdminUser(user)) {
    const visibleMemos = [
      globalMemo ? { title: "전체 메모", body: globalMemo } : null,
      memberMemo ? { title: `${user.name} 메모`, body: memberMemo } : null,
      ...legacyMemos,
    ].filter(Boolean);
    return `
      <section class="panel stack">
        <div class="section-title"><h3>관리자 메모</h3></div>
        ${visibleMemos.length ? visibleMemos.map((memo) => `
          <article class="memo-item">
            <strong>${escapeHtml(memo.title)}</strong>
            <p>${escapeHtml(memo.body)}</p>
          </article>
        `).join("") : `<p class="helper">등록된 메모가 없습니다.</p>`}
      </section>
    `;
  }

  return `
    <section class="panel stack admin-memo-panel">
      <div class="section-title"><h3>관리자 메모</h3><span class="chip">수정 가능</span></div>
      <label>전체 메모
        <textarea id="globalAdminMemo" rows="4" placeholder="모든 직원에게 보일 메모">${escapeHtml(globalMemo)}</textarea>
      </label>
      <div class="admin-member-memos">
        ${state.data.users.map((member) => `
          <label>${escapeHtml(member.name)} 메모
            <textarea data-admin-member-memo="${escapeHtml(member.id)}" rows="3" placeholder="${escapeHtml(member.name)}에게만 보일 메모">${escapeHtml(adminMemoById(adminMemoIdForUser(member.id))?.body || "")}</textarea>
          </label>
        `).join("")}
      </div>
      ${legacyMemos.length ? `
        <div class="legacy-admin-memos">
          <strong>기존 메모</strong>
          ${legacyMemos.map((memo) => `<p>${escapeHtml(memo.title)}: ${escapeHtml(memo.body)}</p>`).join("")}
        </div>
      ` : ""}
      <button class="primary-button" type="button" id="saveAdminMemosButton">메모 저장</button>
    </section>
  `;
}
