/* Urlaubs-Kalender – Offline / localStorage
   FINAL app.js
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

  // Hamburger
  btnMenu: document.getElementById("btnMenu"),
  menu: document.getElementById("menu"),
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
  workLink: document.getElementById("workLink")
};

let state = {
  viewDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  entries: [],
  settings: {
    countWeekends: false,
    highlightWeekends: true,
    theme: "auto"
  }
};

/* ================= INIT ================= */

init();

function init(){
  state.entries = loadEntries();
  state.settings = loadSettings();

  els.toggleCountWeekends.checked = state.settings.countWeekends;
  els.toggleHighlightWeekends.checked = state.settings.highlightWeekends;

  if (els.workLink) els.workLink.href = TIME_TRACKER_URL;

  applyTheme(state.settings.theme);
  updateThemeButton();

  renderWeekdays();
  wireEvents();
  syncYearFilter();
  renderAll();
}

/* ================= EVENTS ================= */

function wireEvents(){
  els.btnPrev.onclick = () => changeMonth(-1);
  els.btnNext.onclick = () => changeMonth(1);
  els.btnToday.onclick = () => goToday();
  els.btnAdd.onclick = () => openModalCreate();

  // Hamburger
  if (els.btnMenu && els.menu) {
    els.btnMenu.onclick = (e) => {
      e.stopPropagation();
      toggleMenu();
    };

    document.addEventListener("click", () => closeMenu());
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeMenu();
    });
  }

  els.btnTheme.onclick = () => {
    cycleTheme();
    closeMenu();
  };

  els.toggleCountWeekends.onchange = () => {
    state.settings.countWeekends = els.toggleCountWeekends.checked;
    saveSettings();
    renderAll();
  };

  els.toggleHighlightWeekends.onchange = () => {
    state.settings.highlightWeekends = els.toggleHighlightWeekends.checked;
    saveSettings();
    renderAll();
  };

  els.filterYear.onchange = renderAll;
  els.filterType.onchange = renderAll;

  els.btnExportJSON.onclick = exportJSON;
  els.btnImportJSON.onclick = () => els.importFile.click();
  els.importFile.onchange = importJSON;
  els.btnExportICS.onclick = exportICS;

  els.modalForm.onsubmit = e => {
    e.preventDefault();
    saveFromModal();
  };

  els.btnDelete.onclick = () => {
    deleteEntry(els.entryId.value);
    els.modal.close();
    renderAll();
  };

  els.btnCancel.onclick = () => els.modal.close();

  els.type.onchange = () => {
    els.workLinkWrap.style.display = els.type.value === "work" ? "flex" : "none";
  };
}

/* ================= MENU ================= */

function toggleMenu(){
  const open = !els.menu.hasAttribute("hidden");
  if (open) closeMenu();
  else openMenu();
}

function openMenu(){
  els.menu.removeAttribute("hidden");
  els.btnMenu.setAttribute("aria-expanded", "true");
}

function closeMenu(){
  els.menu.setAttribute("hidden", "");
  els.btnMenu.setAttribute("aria-expanded", "false");
}

/* ================= THEME ================= */

function cycleTheme(){
  const i = THEME_ORDER.indexOf(state.settings.theme);
  state.settings.theme = THEME_ORDER[(i + 1) % THEME_ORDER.length];
  saveSettings();
  applyTheme(state.settings.theme);
  updateThemeButton();
}

function applyTheme(mode){
  const root = document.documentElement;
  if (mode === "auto") delete root.dataset.theme;
  else root.dataset.theme = mode;
}

function updateThemeButton(){
  els.btnTheme.textContent =
    state.settings.theme === "auto" ? "Theme: Auto" :
    state.settings.theme === "light" ? "Theme: Hell" :
    "Theme: Dunkel";
}

/* ================= CORE ================= */

function changeMonth(delta){
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + delta, 1);
  renderAll();
}

function goToday(){
  state.viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  renderAll();
}

/* ================= RENDER ================= */

function renderAll(){
  renderMonthTitle();
  renderCalendar();
  syncYearFilter();
  renderListAndSummary();
}

function renderMonthTitle(){
  els.monthTitle.textContent =
    state.viewDate.toLocaleDateString("de-DE", { month:"long", year:"numeric" });
}

function renderWeekdays(){
  els.weekdayRow.innerHTML = ["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=>`<div>${d}</div>`).join("");
}

/* ================= STORAGE HELPERS ================= */

function loadEntries(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveEntries(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function loadSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || state.settings; }
  catch { return state.settings; }
}

function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

/* ================= UTILS ================= */

function syncYearFilter(){
  const years = new Set([new Date().getFullYear()]);
  state.entries.forEach(e => {
    years.add(+e.start.slice(0,4));
    years.add(+e.end.slice(0,4));
  });
  els.filterYear.innerHTML = [...years].sort().map(y=>`<option>${y}</option>`).join("");
}

function cryptoId(){
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
