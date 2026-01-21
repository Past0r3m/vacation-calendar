/* Urlaubs-Kalender – Offline / localStorage
   - Monatsansicht
   - Einträge als Datumsbereich (start/end)
   - Typen: vacation/sick/work/homeoffice/other
   - Wochenenden zählen optional
   - Dark Mode (auto + toggle)
   - Export/Import JSON
   - Export ICS
*/

const STORAGE_KEY = "vacationCalendar.entries.v1";
const SETTINGS_KEY = "vacationCalendar.settings.v1";
const TIME_TRACKER_URL = "https://past0r3m.github.io/SimpleTimeTracker/";

const TYPE_LABEL = {
  vacation: "Urlaub",
  sick: "Krank",
  work: "Arbeit",
  homeoffice: "Homeoffice",
  other: "Sonstiges"
};

const TYPE_ORDER = ["vacation", "sick", "work", "homeoffice", "other"];
const THEME_ORDER = ["auto", "light", "dark"];

const els = {
  monthTitle: document.getElementById("monthTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  weekdayRow: document.getElementById("weekdayRow"),

  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnToday: document.getElementById("btnToday"),
  btnAdd: document.getElementById("btnAdd"),

  // Menu
  btnMenu: document.getElementById("btnMenu"),
  menu: document.getElementById("menu"),
  menuBackdrop: document.getElementById("menuBackdrop"),
  btnTheme: document.getElementById("btnTheme"),

  toggleCountWeekends: document.getElementById("toggleCountWeekends"),
  toggleHighlightWeekends: document.getElementById("toggleHighlightWeekends"),

  summaryRange: document.getElementById("summaryRange"),
  sumVacation: document.getElementById("sumVacation"),
  sumSick: document.getElementById("sumSick"),
  sumWork: document.getElementById("sumWork"),
  sumHO: document.getElementById("sumHO"),
  sumOther: document.getElementById("sumOther"),

  filterYear: document.getElementById("filterYear"),
  filterType: document.getElementById("filterType"),

  entryList: document.getElementById("entryList"),

  btnExportJSON: document.getElementById("btnExportJSON"),
  btnImportJSON: document.getElementById("btnImportJSON"),
  importFile: document.getElementById("importFile"),
  btnExportICS: document.getElementById("btnExportICS"),

  modal: document.getElementById("modal"),
  modalForm: document.getElementById("modalForm"),
  modalTitle: document.getElementById("modalTitle"),
  entryId: document.getElementById("entryId"),
  type: document.getElementById("type"),
  title: document.getElementById("title"),
  start: document.getElementById("start"),
  end: document.getElementById("end"),
  note: document.getElementById("note"),
  btnDelete: document.getElementById("btnDelete"),
  btnCancel: document.getElementById("btnCancel"),
  btnSave: document.getElementById("btnSave"),

  workLinkWrap: document.getElementById("workLinkWrap"),
  workLink: document.getElementById("workLink"),
};

let state = {
  viewDate: startOfMonth(new Date()),
  entries: [],
  settings: {
    countWeekends: false,
    highlightWeekends: true,
    theme: "auto"
  }
};

init();

function init(){
  state.entries = loadEntries();
  state.settings = loadSettings();

  els.toggleCountWeekends.checked = !!state.settings.countWeekends;
  els.toggleHighlightWeekends.checked = !!state.settings.highlightWeekends;

  if (els.workLink) els.workLink.href = TIME_TRACKER_URL;

  applyTheme(state.settings.theme);
  updateThemeButtonLabel();

  renderWeekdays();
  wireEvents();
  syncYearFilterOptions();
  renderAll();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

function wireEvents(){
  els.btnPrev.addEventListener("click", () => { state.viewDate = addMonths(state.viewDate, -1); renderAll(); });
  els.btnNext.addEventListener("click", () => { state.viewDate = addMonths(state.viewDate, 1); renderAll(); });
  els.btnToday.addEventListener("click", () => { state.viewDate = startOfMonth(new Date()); renderAll(); });

  els.btnAdd.addEventListener("click", () => openModalForCreate());

  // Menu open/close (NO overlay blocking when hidden)
  if (els.btnMenu && els.menu && els.menuBackdrop) {
    els.btnMenu.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    els.menuBackdrop.addEventListener("click", closeMenu);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    // Prevent clicking inside menu from closing via bubbling
    els.menu.addEventListener("click", (e) => e.stopPropagation());
  }

  // Theme in menu
  if (els.btnTheme) {
    els.btnTheme.addEventListener("click", () => {
      const current = state.settings.theme || "auto";
      const idx = THEME_ORDER.indexOf(current);
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      state.settings.theme = next;
      saveSettings();
      applyTheme(next);
      updateThemeButtonLabel();
      closeMenu();
    });
  }

  els.toggleCountWeekends.addEventListener("change", () => {
    state.settings.countWeekends = els.toggleCountWeekends.checked;
    saveSettings();
    renderAll();
  });

  els.toggleHighlightWeekends.addEventListener("change", () => {
    state.settings.highlightWeekends = els.toggleHighlightWeekends.checked;
    saveSettings();
    renderAll();
  });

  els.filterYear.addEventListener("change", renderAll);
  els.filterType.addEventListener("change", renderAll);

  els.btnExportJSON.addEventListener("click", exportJSON);
  els.btnImportJSON.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importJSON);

  els.btnExportICS.addEventListener("click", exportICS);

  els.modalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveFromModal();
  });

  els.btnDelete.addEventListener("click", () => {
    const id = els.entryId.value;
    if (!id) return;
    deleteEntry(id);
    els.modal.close();
    renderAll();
  });

  els.btnCancel.addEventListener("click", () => els.modal.close());

  if (els.type) {
    els.type.addEventListener("change", () => syncWorkLinkVisibility(els.type.value));
  }
}

/* ============ MENU ============ */

function isMenuOpen(){
  return els.menu && !els.menu.hasAttribute("hidden");
}

function openMenu(){
  if (!els.menu || !els.menuBackdrop || !els.btnMenu) return;
  els.menu.removeAttribute("hidden");
  els.menuBackdrop.removeAttribute("hidden");
  els.btnMenu.setAttribute("aria-expanded", "true");
}

function closeMenu(){
  if (!els.menu || !els.menuBackdrop || !els.btnMenu) return;
  els.menu.setAttribute("hidden", "");
  els.menuBackdrop.setAttribute("hidden", "");
  els.btnMenu.setAttribute("aria-expanded", "false");
}

function toggleMenu(){
  if (isMenuOpen()) closeMenu();
  else openMenu();
}

/* ============ THEME ============ */

function applyTheme(mode){
  const root = document.documentElement;
  const m = mode || "auto";

  if (m === "auto") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = m;
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    if (m === "dark") meta.setAttribute("content", "#0b0c0f");
    else meta.setAttribute("content", "#ffffff");
  }
}

function updateThemeButtonLabel(){
  if (!els.btnTheme) return;
  const m = state.settings.theme || "auto";
  els.btnTheme.textContent =
    (m === "auto") ? "Theme: Auto" :
    (m === "light") ? "Theme: Hell" :
    "Theme: Dunkel";
}

/* ============ UI ============ */

function syncWorkLinkVisibility(type){
  if (!els.workLinkWrap) return;
  els.workLinkWrap.style.display = (type === "work") ? "flex" : "none";
}

function renderWeekdays(){
  const labels = ["Mo","Di","Mi","Do","Fr","Sa","So"];
  els.weekdayRow.innerHTML = labels.map(l => `<div>${l}</div>`).join("");
}

function renderAll(){
  renderMonthTitle();
  renderCalendar();
  syncYearFilterOptions();
  renderListAndSummary();
}

function renderMonthTitle(){
  const dt = state.viewDate;
  const month = dt.toLocaleString("de-DE", { month: "long" });
  const year = dt.getFullYear();
  els.monthTitle.textContent = `${capitalize(month)} ${year}`;
}

function renderCalendar(){
  const view = state.viewDate;
  const first = startOfMonth(view);
  const last = endOfMonth(view);

  const gridStart = startOfWeekMonday(first);
  const gridEnd = endOfWeekSunday(last);

  const days = [];
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
    days.push(new Date(d));
  }

  const entriesByDay = mapEntriesToDays(state.entries);

  els.calendarGrid.innerHTML = "";
  for (const day of days) {
    const iso = toISODate(day);
    const inMonth = day.getMonth() === view.getMonth();
    const dow = day.getDay();
    const isWeekend = (dow === 0 || dow === 6);

    const dayEntries = entriesByDay.get(iso) || [];
    const badges = summarizeBadges(dayEntries);

    const div = document.createElement("div");
    div.className = "day";
    if (!inMonth) div.classList.add("muted");
    if (state.settings.highlightWeekends && isWeekend) div.classList.add("weekend");

    div.innerHTML = `
      <div class="day-top">
        <div class="day-num">${day.getDate()}</div>
        <div class="badges">${badges}</div>
      </div>
      <div class="day-body"></div>
    `;

    div.addEventListener("click", () => {
      if (dayEntries.length === 1) openModalForEdit(dayEntries[0].id);
      else openModalForCreate(iso);
    });

    els.calendarGrid.appendChild(div);
  }
}

function summarizeBadges(dayEntries){
  if (!dayEntries.length) return "";
  const seen = new Set(dayEntries.map(e => e.type));
  return Array.from(seen)
    .sort((a,b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b))
    .map(t => `<span class="badge ${t}" title="${TYPE_LABEL[t] || t}"></span>`)
    .join("");
}

function renderListAndSummary(){
  const year = parseInt(els.filterYear.value || `${state.viewDate.getFullYear()}`, 10);
  const typeFilter = els.filterType.value || "all";

  const filtered = state.entries
    .filter(e => yearFromISO(e.start) === year || yearFromISO(e.end) === year || rangeTouchesYear(e.start, e.end, year))
    .filter(e => typeFilter === "all" ? true : e.type === typeFilter)
    .sort((a,b) => a.start.localeCompare(b.start));

  els.entryList.innerHTML = "";
  for (const e of filtered) {
    const days = countDaysInRange(e.start, e.end, state.settings.countWeekends);
    const title = (e.title || TYPE_LABEL[e.type] || e.type);
    const meta = `${formatRange(e.start, e.end)} · ${days} Tag${days===1?"":"e"}`;
    const note = e.note ? `\n${escapeHtml(e.note)}` : "";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <span>${escapeHtml(title)}</span>
        <span class="tag ${e.type}">${TYPE_LABEL[e.type] || e.type}</span>
      </div>
      <div class="item-meta">
        ${escapeHtml(meta)}
        ${note ? "<br/>" + note.replace(/\n/g,"<br/>") : ""}
      </div>
    `;
    item.addEventListener("click", () => openModalForEdit(e.id));
    els.entryList.appendChild(item);
  }

  const byType = { vacation:0, sick:0, work:0, homeoffice:0, other:0 };
  for (const e of state.entries) {
    const daysByType = daysByTypeForYear(e, year, state.settings.countWeekends);
    for (const t of Object.keys(byType)) byType[t] += daysByType[t] || 0;
  }

  els.summaryRange.textContent = `Jahr ${year}`;
  els.sumVacation.textContent = `${byType.vacation}`;
  els.sumSick.textContent = `${byType.sick}`;
  els.sumWork.textContent = `${byType.work}`;
  els.sumHO.textContent = `${byType.homeoffice}`;
  els.sumOther.textContent = `${byType.other}`;
}

function syncYearFilterOptions(){
  const years = new Set();
  const nowY = new Date().getFullYear();
  years.add(nowY);

  for (const e of state.entries) {
    years.add(yearFromISO(e.start));
    years.add(yearFromISO(e.end));
  }
  years.add(nowY - 1);
  years.add(nowY + 1);

  const sorted = Array.from(years).sort((a,b)=>a-b);
  const current = els.filterYear.value || `${state.viewDate.getFullYear()}`;

  els.filterYear.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join("");
  if (sorted.includes(parseInt(current,10))) els.filterYear.value = current;
  else els.filterYear.value = `${state.viewDate.getFullYear()}`;
}

function openModalForCreate(prefillISO){
  els.modalTitle.textContent = "Neuer Eintrag";
  els.entryId.value = "";
  els.type.value = "vacation";
  els.title.value = "";
  els.note.value = "";

  const todayISO = toISODate(new Date());
  const d = prefillISO || todayISO;

  els.start.value = d;
  els.end.value = d;

  syncWorkLinkVisibility(els.type.value);

  els.btnDelete.style.display = "none";
  els.modal.showModal();
}

function openModalForEdit(id){
  const e = state.entries.find(x => x.id === id);
  if (!e) return;

  els.modalTitle.textContent = "Eintrag bearbeiten";
  els.entryId.value = e.id;
  els.type.value = e.type;
  els.title.value = e.title || "";
  els.start.value = e.start;
  els.end.value = e.end;
  els.note.value = e.note || "";

  syncWorkLinkVisibility(els.type.value);

  els.btnDelete.style.display = "inline-flex";
  els.modal.showModal();
}

function saveFromModal(){
  const id = (els.entryId.value || "").trim();
  const type = els.type.value;
  const title = els.title.value.trim();
  const start = els.start.value;
  const end = els.end.value;
  const note = els.note.value.trim();

  if (!start || !end) return;

  const norm = normalizeRange(start, end);

  const payload = {
    id: id || cryptoId(),
    type: TYPE_LABEL[type] ? type : "other",
    title: title || "",
    start: norm.start,
    end: norm.end,
    note: note || "",
    createdAt: id ? undefined : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (id) state.entries = state.entries.map(x => x.id === id ? { ...x, ...payload } : x);
  else state.entries.push(payload);

  saveEntries();
  els.modal.close();
  renderAll();
}

function deleteEntry(id){
  if (!id) return;
  state.entries = state.entries.filter(e => e.id !== id);
  saveEntries();
}

/* ---------------------------
   Data mapping and counting
---------------------------- */

function mapEntriesToDays(entries){
  const map = new Map();
  for (const e of entries) {
    const range = listDaysInRange(e.start, e.end);
    for (const iso of range) {
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push(e);
    }
  }
  return map;
}

function countDaysInRange(startISO, endISO, countWeekends){
  const days = listDaysInRange(startISO, endISO);
  if (countWeekends) return days.length;
  return days.filter(iso => !isWeekendISO(iso)).length;
}

function daysByTypeForYear(entry, year, countWeekends){
  const out = { vacation:0, sick:0, work:0, homeoffice:0, other:0 };
  const allDays = listDaysInRange(entry.start, entry.end);

  for (const iso of allDays) {
    if (yearFromISO(iso) !== year) continue;
    if (!countWeekends && isWeekendISO(iso)) continue;
    out[entry.type] = (out[entry.type] || 0) + 1;
  }
  return out;
}

function rangeTouchesYear(startISO, endISO, year){
  const ys = yearFromISO(startISO);
  const ye = yearFromISO(endISO);
  return (ys <= year && ye >= year);
}

/* ---------------------------
   Export / Import
---------------------------- */

function exportJSON(){
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    entries: state.entries
  };
  downloadFile(
    `urlaub-kalender_${new Date().toISOString().slice(0,10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

async function importJSON(){
  const file = els.importFile.files && els.importFile.files[0];
  if (!file) return;

  try{
    const text = await file.text();
    const parsed = JSON.parse(text);

    const importedEntries = Array.isArray(parsed.entries) ? parsed.entries : (Array.isArray(parsed) ? parsed : []);
    const cleaned = importedEntries
      .filter(x => x && x.start && x.end && x.type)
      .map(x => ({
        id: x.id || cryptoId(),
        type: TYPE_LABEL[x.type] ? x.type : "other",
        title: (x.title || "").toString().slice(0,60),
        start: normalizeISODate(x.start),
        end: normalizeISODate(x.end),
        note: (x.note || "").toString(),
        createdAt: x.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

    const map = new Map(state.entries.map(e => [e.id, e]));
    for (const e of cleaned) map.set(e.id, e);
    state.entries = Array.from(map.values());

    if (parsed.settings && typeof parsed.settings === "object") {
      state.settings = {
        countWeekends: !!parsed.settings.countWeekends,
        highlightWeekends: parsed.settings.highlightWeekends !== false,
        theme: normalizeTheme(parsed.settings.theme)
      };
      els.toggleCountWeekends.checked = state.settings.countWeekends;
      els.toggleHighlightWeekends.checked = state.settings.highlightWeekends;

      applyTheme(state.settings.theme);
      updateThemeButtonLabel();

      saveSettings();
    }

    saveEntries();
    renderAll();
  }catch{
    alert("Import fehlgeschlagen: Datei ist kein gültiges JSON oder Format passt nicht.");
  }finally{
    els.importFile.value = "";
  }
}

function exportICS(){
  const year = parseInt(els.filterYear.value || `${state.viewDate.getFullYear()}`, 10);
  const typeFilter = els.filterType.value || "all";

  const entries = state.entries
    .filter(e => rangeTouchesYear(e.start, e.end, year))
    .filter(e => typeFilter === "all" ? true : e.type === typeFilter)
    .sort((a,b) => a.start.localeCompare(b.start));

  const dtstamp = toICSDateTime(new Date());
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Private Vacation Calendar//DE");
  lines.push("CALSCALE:GREGORIAN");

  for (const e of entries) {
    const start = isoToICSDate(e.start);
    const endExclusive = isoToICSDate(addDays(parseISO(e.end), 1));

    const summaryBase = e.title?.trim() ? e.title.trim() : (TYPE_LABEL[e.type] || e.type);
    const summary = `${TYPE_LABEL[e.type] || e.type}: ${summaryBase}`.slice(0, 80);

    const uid = `${e.id}@vacation-calendar.local`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeICSText(uid)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${endExclusive}`);
    lines.push(`SUMMARY:${escapeICSText(summary)}`);
    if (e.note && e.note.trim()) lines.push(`DESCRIPTION:${escapeICSText(e.note.trim())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  downloadFile(`urlaub-kalender_${year}.ics`, lines.join("\r\n"), "text/calendar");
}

/* ---------------------------
   Storage
---------------------------- */

function loadEntries(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(x => x && x.id && x.type && x.start && x.end)
      .map(x => ({
        id: x.id,
        type: TYPE_LABEL[x.type] ? x.type : "other",
        title: (x.title || "").toString(),
        start: normalizeISODate(x.start),
        end: normalizeISODate(x.end),
        note: (x.note || "").toString(),
        createdAt: x.createdAt || "",
        updatedAt: x.updatedAt || ""
      }));
  }catch{
    return [];
  }
}

function saveEntries(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { countWeekends:false, highlightWeekends:true, theme:"auto" };
    const s = JSON.parse(raw);
    return {
      countWeekends: !!s.countWeekends,
      highlightWeekends: s.highlightWeekends !== false,
      theme: normalizeTheme(s.theme)
    };
  }catch{
    return { countWeekends:false, highlightWeekends:true, theme:"auto" };
  }
}

function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function normalizeTheme(v){
  const x = (v || "auto").toString().toLowerCase();
  return THEME_ORDER.includes(x) ? x : "auto";
}

/* ---------------------------
   Date helpers
---------------------------- */

function parseISO(iso){
  const [y,m,d] = iso.split("-").map(n => parseInt(n,10));
  return new Date(y, (m-1), d);
}

function toISODate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function normalizeISODate(v){
  if (v instanceof Date) return toISODate(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return toISODate(new Date());
  return toISODate(dt);
}

function normalizeRange(startISO, endISO){
  const a = normalizeISODate(startISO);
  const b = normalizeISODate(endISO);
  return (a <= b) ? { start:a, end:b } : { start:b, end:a };
}

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }

function addDays(d, n){
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d, n){
  return new Date(d.getFullYear(), d.getMonth()+n, 1);
}

function startOfWeekMonday(d){
  const x = new Date(d);
  const dow = x.getDay();
  const offset = (dow === 0) ? -6 : (1 - dow);
  return addDays(x, offset);
}

function endOfWeekSunday(d){
  const x = new Date(d);
  const dow = x.getDay();
  const offset = (dow === 0) ? 0 : (7 - dow);
  return addDays(x, offset);
}

function listDaysInRange(startISO, endISO){
  const a = parseISO(normalizeISODate(startISO));
  const b = parseISO(normalizeISODate(endISO));
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;

  const days = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    days.push(toISODate(d));
  }
  return days;
}

function isWeekendISO(iso){
  const d = parseISO(iso);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function yearFromISO(iso){
  return parseInt(normalizeISODate(iso).slice(0,4), 10);
}

function formatRange(startISO, endISO){
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  const fmt = (d) => d.toLocaleDateString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric" });
  if (startISO === endISO) return fmt(a);
  return `${fmt(a)} – ${fmt(b)}`;
}

/* ---------------------------
   ICS helpers
---------------------------- */

function isoToICSDate(isoOrDate){
  const iso = (isoOrDate instanceof Date) ? toISODate(isoOrDate) : normalizeISODate(isoOrDate);
  return iso.replaceAll("-", "");
}

function toICSDateTime(d){
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,"0");
  const dd = String(d.getUTCDate()).padStart(2,"0");
  const hh = String(d.getUTCHours()).padStart(2,"0");
  const mi = String(d.getUTCMinutes()).padStart(2,"0");
  const ss = String(d.getUTCSeconds()).padStart(2,"0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeICSText(s){
  return String(s)
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

/* ---------------------------
   Misc
---------------------------- */

function cryptoId(){
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function downloadFile(filename, content, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function capitalize(s){
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
