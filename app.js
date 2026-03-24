/**
 * Book Shelf — local-first reading tracker
 */

const STORAGE_KEY = "book_shelf_data_v1";
const THEME_KEY = "book_shelf_theme";
const LAST_EXPORT_AT_KEY = "book_shelf_last_export_at";
const EXPORT_REMINDER_DISMISSED_AT_KEY = "book_shelf_export_reminder_dismissed_at";
const EXPORT_REMINDER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

const SHELVES = [
  { id: "wishlist", label: "To read" },
  { id: "in_progress", label: "In progress" },
  { id: "read", label: "Read" },
  { id: "dnf", label: "Did not finish" },
];

const SORT_OPTIONS = [
  { id: "title_asc", label: "Title (A–Z)" },
  { id: "author_asc", label: "Author (A–Z)" },
  { id: "added_desc", label: "Recently added" },
  { id: "read_desc", label: "Recently read" },
  { id: "rating_desc", label: "Rating (best first)" },
];

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

function normalizeSeriesName(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeGoalsFromStorage(rawGoals) {
  if (Array.isArray(rawGoals)) {
    return rawGoals
      .filter(
        (g) =>
          g &&
          ["week", "month", "year"].includes(g.period) &&
          (parseInt(g.target, 10) || 0) >= 1
      )
      .map((g) => ({
        id: g.id || uuid(),
        period: g.period,
        target: Math.max(1, parseInt(g.target, 10) || 1),
        excludeAudiobooks: !!g.excludeAudiobooks,
        currentPeriodKey: g.currentPeriodKey || null,
      }));
  }
  if (rawGoals && typeof rawGoals === "object") {
    const migrated = [];
    for (const period of ["week", "month", "year"]) {
      const t = rawGoals[period]?.target;
      if (t != null && parseInt(t, 10) > 0) {
        migrated.push({
          id: uuid(),
          period,
          target: Math.max(1, parseInt(t, 10) || 1),
          excludeAudiobooks: false,
          currentPeriodKey: null,
        });
      }
    }
    return migrated;
  }
  return [];
}

function normalizeBook(b) {
  if (!b || typeof b !== "object") return b;
  let shelf = b.shelf;
  if (shelf === "owned") shelf = "wishlist";
  let rating = b.rating ?? null;
  // Migrate legacy emoji ratings into the current text scale.
  if (rating === "frown") rating = "not_good";
  else if (rating === "meh") rating = "okay";
  else if (rating === "smile") rating = b.favorite ? "great" : "good";
  return {
    ...b,
    shelf,
    rating,
    ownership: b.ownership === "borrowed" ? "borrowed" : "owned",
  };
}

function normalizeWantItem(w) {
  if (!w || typeof w !== "object") return null;
  const tags = Array.isArray(w.tags) ? w.tags.map((t) => String(t).trim()).filter(Boolean) : parseTags(w.tags);
  return {
    id: w.id || uuid(),
    title: String(w.title || "").trim(),
    author: String(w.author || "").trim(),
    notes: String(w.notes || "").trim(),
    tags,
    recommendedBy: String(w.recommendedBy || "").trim(),
    createdAt: w.createdAt || new Date().toISOString(),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const gh = Array.isArray(data.goalsHistory)
        ? data.goalsHistory.filter((h) => h && h.period && h.periodKey)
        : [];
      const hiddenTags = Array.isArray(data.hiddenTagSuggestions)
        ? [...new Set(data.hiddenTagSuggestions.map((x) => String(x).toLowerCase().trim()).filter(Boolean))]
        : [];
      const wantList = Array.isArray(data.wantList)
        ? data.wantList.map(normalizeWantItem).filter(Boolean)
        : [];
      const hiddenSeriesIds = Array.isArray(data.hiddenSeriesIds)
        ? [...new Set(data.hiddenSeriesIds.map((x) => String(x).trim()).filter(Boolean))]
        : [];
      return {
        books: Array.isArray(data.books) ? data.books.map(normalizeBook) : [],
        series: Array.isArray(data.series) ? data.series : [],
        goals: normalizeGoalsFromStorage(data.goals),
        goalsHistory: gh,
        hiddenTagSuggestions: hiddenTags,
        wantList,
        hiddenSeriesIds,
      };
    }
  } catch (_) {}
  return { books: [], series: [], goals: [], goalsHistory: [], hiddenTagSuggestions: [], wantList: [], hiddenSeriesIds: [] };
}

function loadStateFromObject(data) {
  const gh = Array.isArray(data?.goalsHistory)
    ? data.goalsHistory.filter((h) => h && h.period && h.periodKey)
    : [];
  const hiddenTags = Array.isArray(data?.hiddenTagSuggestions)
    ? [...new Set(data.hiddenTagSuggestions.map((x) => String(x).toLowerCase().trim()).filter(Boolean))]
    : [];
  const wantList = Array.isArray(data?.wantList)
    ? data.wantList.map(normalizeWantItem).filter(Boolean)
    : [];
  const hiddenSeriesIds = Array.isArray(data?.hiddenSeriesIds)
    ? [...new Set(data.hiddenSeriesIds.map((x) => String(x).trim()).filter(Boolean))]
    : [];
  return {
    books: Array.isArray(data?.books) ? data.books.map(normalizeBook) : [],
    series: Array.isArray(data?.series) ? data.series : [],
    goals: normalizeGoalsFromStorage(data?.goals),
    goalsHistory: gh,
    hiddenTagSuggestions: hiddenTags,
    wantList,
    hiddenSeriesIds,
  };
}

function saveState(state) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      books: state.books,
      series: state.series,
      goals: state.goals,
      goalsHistory: state.goalsHistory || [],
      hiddenTagSuggestions: state.hiddenTagSuggestions || [],
      wantList: state.wantList || [],
      hiddenSeriesIds: state.hiddenSeriesIds || [],
    })
  );
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekMonday(d) {
  const s = startOfWeekMonday(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

function readDateInPeriod(readAt, period) {
  if (!readAt) return false;
  const t = new Date(readAt);
  if (Number.isNaN(t.getTime())) return false;
  const now = new Date();
  if (period === "year") return t.getFullYear() === now.getFullYear();
  if (period === "month")
    return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
  if (period === "week") {
    const sw = startOfWeekMonday(now);
    const ew = endOfWeekMonday(now);
    return t >= sw && t < ew;
  }
  return false;
}

function countReadBooksInPeriod(books, period, excludeAudiobooks) {
  return books.filter((b) => {
    if (b.shelf !== "read" || !readDateInPeriod(b.readAt, period)) return false;
    if (excludeAudiobooks && b.type === "audiobook") return false;
    return true;
  }).length;
}

function goalPeriodHeading(period) {
  if (period === "week") return "This week";
  if (period === "month") return "This month";
  if (period === "year") return "This year";
  return period;
}

function localYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalYMD(s) {
  if (!s || typeof s !== "string") return new Date(NaN);
  const parts = s.split("-").map(Number);
  if (parts.length < 3) return new Date(NaN);
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function getCurrentPeriodKey(period, refDate) {
  const d = new Date(refDate);
  if (period === "week") return localYMD(startOfWeekMonday(d));
  if (period === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (period === "year") return String(d.getFullYear());
  return "";
}

function getPeriodWindow(period, periodKey) {
  if (period === "week") {
    const start = parseLocalYMD(periodKey);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  if (period === "month") {
    const [y, m] = periodKey.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    return { start, end };
  }
  if (period === "year") {
    const y = parseInt(periodKey, 10);
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    return { start, end };
  }
  return { start: new Date(0), end: new Date(0) };
}

function readAtInWindow(readAt, start, end) {
  if (!readAt) return false;
  const t = new Date(readAt);
  if (Number.isNaN(t.getTime())) return false;
  return t >= start && t < end;
}

function countReadBooksInPeriodWindow(books, period, periodKey, excludeAudiobooks) {
  const { start, end } = getPeriodWindow(period, periodKey);
  if (Number.isNaN(start.getTime())) return 0;
  return books.filter((b) => {
    if (b.shelf !== "read") return false;
    if (!readAtInWindow(b.readAt, start, end)) return false;
    if (excludeAudiobooks && b.type === "audiobook") return false;
    return true;
  }).length;
}

function formatHistoryPeriodLabel(period, periodKey) {
  if (period === "week") {
    const start = parseLocalYMD(periodKey);
    if (Number.isNaN(start.getTime())) return periodKey;
    return `Week of ${start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (period === "month") {
    const [y, m] = periodKey.split("-").map(Number);
    if (!y || !m) return periodKey;
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (period === "year") return periodKey;
  return periodKey;
}

function archiveGoalPeriodEntry(state, goal, periodKey, reason) {
  if (!state.goalsHistory) state.goalsHistory = [];
  if (!periodKey) return;
  const finishedCount = countReadBooksInPeriodWindow(state.books, goal.period, periodKey, goal.excludeAudiobooks);
  state.goalsHistory.unshift({
    id: uuid(),
    sourceGoalId: goal.id,
    period: goal.period,
    periodKey,
    target: goal.target,
    excludeAudiobooks: !!goal.excludeAudiobooks,
    finishedCount,
    archivedAt: new Date().toISOString(),
    reason,
  });
}

function syncGoalPeriods(state) {
  if (!state.goalsHistory) state.goalsHistory = [];
  const now = new Date();
  let changed = false;
  for (const g of state.goals) {
    const keyNow = getCurrentPeriodKey(g.period, now);
    if (!g.currentPeriodKey) {
      g.currentPeriodKey = keyNow;
      changed = true;
      continue;
    }
    if (g.currentPeriodKey === keyNow) continue;
    archiveGoalPeriodEntry(state, g, g.currentPeriodKey, "period_rollover");
    g.currentPeriodKey = keyNow;
    changed = true;
  }
  return changed;
}

function readAtToDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return localYMD(d);
}

function dateInputToLocalNoonISO(ymd) {
  if (!ymd || typeof ymd !== "string") return null;
  const parts = ymd.split("-").map(Number);
  if (parts.length < 3 || !parts[0]) return null;
  const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  return dt.toISOString();
}

function ownershipLabel(o) {
  return o === "borrowed" ? "Borrowed" : "Owned";
}

function collectTagsFromBooks(books, wantList) {
  const map = new Map();
  for (const b of books || []) {
    for (const raw of b.tags || []) {
      const t = (raw || "").trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (!map.has(k)) map.set(k, t);
    }
  }
  for (const w of wantList || []) {
    for (const raw of w.tags || []) {
      const t = (raw || "").trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (!map.has(k)) map.set(k, t);
    }
  }
  return map;
}

function getLastTagPrefix(value) {
  const parts = (value || "").split(",");
  return parts[parts.length - 1].trim();
}

function applyTagToInput(value, tagDisplay) {
  const parts = (value || "").split(",").map((s) => s.trim());
  if (parts.length === 1 && !parts[0]) {
    return `${tagDisplay}, `;
  }
  parts[parts.length - 1] = tagDisplay;
  return `${parts.join(", ")}, `;
}

function getMatchingTagSuggestions(state, partial) {
  const p = (partial || "").trim().toLowerCase();
  const hidden = new Set(state.hiddenTagSuggestions || []);
  const fromBooks = collectTagsFromBooks(state.books, state.wantList);
  const out = [];
  for (const [k, display] of fromBooks) {
    if (hidden.has(k)) continue;
    if (!p || k.startsWith(p) || display.toLowerCase().includes(p)) {
      out.push(display);
    }
  }
  out.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return out.slice(0, 14);
}

function findOrCreateSeries(seriesList, name, opts) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const key = normalizeSeriesName(trimmed);
  let s = seriesList.find((x) => normalizeSeriesName(x.name) === key);
  if (!s) {
    s = {
      id: uuid(),
      name: trimmed,
      expectedTotal: opts.expectedTotal != null ? opts.expectedTotal : null,
      publishingIncomplete: !!opts.publishingIncomplete,
    };
    seriesList.push(s);
    return s;
  }
  if (opts.expectedTotal != null && opts.expectedTotal > 0) {
    if (s.expectedTotal == null || opts.expectedTotal > s.expectedTotal) s.expectedTotal = opts.expectedTotal;
  }
  if (opts.publishingIncomplete) s.publishingIncomplete = true;
  s.name = trimmed;
  return s;
}

function booksInSeries(state, seriesId) {
  return state.books.filter((b) => b.seriesId === seriesId);
}

function seriesProgress(state, seriesId) {
  const meta = state.series.find((s) => s.id === seriesId);
  const volumes = booksInSeries(state, seriesId);
  const readCount = volumes.filter((b) => b.shelf === "read").length;
  const nums = volumes.map((b) => b.volumeInSeries).filter((n) => typeof n === "number" && n > 0);
  const maxVol = nums.length ? Math.max(...nums) : 0;
  let total = meta?.expectedTotal;
  if (total == null || total < 1) total = Math.max(maxVol, volumes.length);
  if (meta?.expectedTotal != null && meta.expectedTotal > total) total = meta.expectedTotal;
  return { readCount, total, meta, volumes, maxVol };
}

function cleanupEmptySeries(state) {
  const used = new Set(state.books.map((b) => b.seriesId).filter(Boolean));
  state.series = state.series.filter((s) => used.has(s.id));
}

function ratingRank(r) {
  if (r === "great") return 5;
  if (r === "good") return 4;
  if (r === "okay") return 3;
  if (r === "not_good") return 2;
  if (r === "terrible") return 1;
  return 0;
}

function sortBooks(list, sortId) {
  const out = [...list];
  switch (sortId) {
    case "author_asc":
      out.sort((a, b) => (a.author || "").localeCompare(b.author || "", undefined, { sensitivity: "base" }));
      break;
    case "added_desc":
      out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case "read_desc":
      out.sort((a, b) => new Date(b.readAt || 0) - new Date(a.readAt || 0));
      break;
    case "rating_desc":
      out.sort((a, b) => ratingRank(b.rating) - ratingRank(a.rating));
      break;
    case "title_asc":
    default:
      out.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
  }
  return out;
}

function filterBooks(books, { shelfTab, q, type, favoritesOnly, ownership }) {
  let list = books;
  if (shelfTab !== "all") list = list.filter((b) => b.shelf === shelfTab);
  if (type) list = list.filter((b) => b.type === type);
  if (ownership === "owned") list = list.filter((b) => b.ownership !== "borrowed");
  if (ownership === "borrowed") list = list.filter((b) => b.ownership === "borrowed");
  if (favoritesOnly) list = list.filter((b) => b.favorite);
  if (q) {
    const n = q.trim().toLowerCase();
    list = list.filter((b) => {
      const tags = (b.tags || []).join(" ").toLowerCase();
      return (
        (b.title || "").toLowerCase().includes(n) ||
        (b.author || "").toLowerCase().includes(n) ||
        tags.includes(n)
      );
    });
  }
  return list;
}

function typeLabel(t) {
  if (t === "ebook") return "E-book";
  if (t === "audiobook") return "Audiobook";
  return "Physical";
}

function shelfLabel(id) {
  return SHELVES.find((s) => s.id === id)?.label || id;
}

function amazonSearchUrl(title, author, mode) {
  const t = String(title || "").trim();
  const a = String(author || "").trim();
  const suffix = mode === "audiobook" ? " audiobook" : " book";
  const query = `${t}${a ? ` ${a}` : ""}${suffix}`.trim();
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

// --- DOM ---
const els = {
  shelfTabs: document.querySelector(".shelf-tabs"),
  bookList: document.getElementById("book-list"),
  listEmpty: document.getElementById("list-empty"),
  search: document.getElementById("search-books"),
  sort: document.getElementById("sort-books"),
  filterType: document.getElementById("filter-type"),
  filterOwnership: document.getElementById("filter-ownership"),
  filterFavorites: document.getElementById("filter-favorites"),
  btnAdd: document.getElementById("btn-add-book"),
  btnSettingsToggle: document.getElementById("btn-settings-toggle"),
  settingsMenu: document.getElementById("settings-menu"),
  btnExportData: document.getElementById("btn-export-data"),
  btnImportData: document.getElementById("btn-import-data"),
  inputImportData: document.getElementById("input-import-data"),
  exportReminder: document.getElementById("export-reminder"),
  btnExportReminder: document.getElementById("btn-export-reminder"),
  btnDismissExportReminder: document.getElementById("btn-dismiss-export-reminder"),
  goalsEmpty: document.getElementById("goals-empty"),
  goalsListWrap: document.getElementById("goals-list-wrap"),
  goalsList: document.getElementById("goals-list"),
  btnGoalFirst: document.getElementById("btn-goal-first"),
  btnGoalAnother: document.getElementById("btn-goal-another"),
  modalGoalOverlay: document.getElementById("modal-goal-overlay"),
  modalGoalTitle: document.getElementById("modal-goal-title"),
  modalGoalClose: document.getElementById("modal-goal-close"),
  formGoal: document.getElementById("form-goal"),
  btnGoalCancel: document.getElementById("btn-goal-cancel"),
  goalEditId: document.getElementById("goal-edit-id"),
  goalExcludeAudiobook: document.getElementById("goal-exclude-audiobook"),
  goalTarget: document.getElementById("goal-target"),
  modalSeriesRemoveOverlay: document.getElementById("modal-series-remove-overlay"),
  modalSeriesRemoveClose: document.getElementById("modal-series-remove-close"),
  seriesRemoveMessage: document.getElementById("series-remove-message"),
  btnSeriesRemoveCancel: document.getElementById("btn-series-remove-cancel"),
  btnSeriesRemoveConfirm: document.getElementById("btn-series-remove-confirm"),
  goalsHistoryList: document.getElementById("goals-history-list"),
  goalsHistoryEmpty: document.getElementById("goals-history-empty"),
  wantListItems: document.getElementById("want-list-items"),
  wantListEmpty: document.getElementById("want-list-empty"),
  btnWantAdd: document.getElementById("btn-want-add"),
  modalWantOverlay: document.getElementById("modal-want-overlay"),
  modalWantClose: document.getElementById("modal-want-close"),
  formWant: document.getElementById("form-want"),
  btnWantCancel: document.getElementById("btn-want-cancel"),
  btnWantDelete: document.getElementById("btn-want-delete"),
  wantItemId: document.getElementById("want-item-id"),
  wantTitle: document.getElementById("want-title"),
  wantAuthor: document.getElementById("want-author"),
  wantNotes: document.getElementById("want-notes"),
  wantTags: document.getElementById("want-tags"),
  wantTagsSuggestions: document.getElementById("want-tags-suggestions"),
  wantRecommended: document.getElementById("want-recommended"),
  seriesList: document.getElementById("series-list"),
  seriesEmpty: document.getElementById("series-empty"),
  settingTheme: document.getElementById("setting-theme"),
  modalBookOverlay: document.getElementById("modal-book-overlay"),
  modalBook: document.getElementById("modal-book"),
  modalBookTitle: document.getElementById("modal-book-title"),
  modalBookClose: document.getElementById("modal-book-close"),
  formBook: document.getElementById("form-book"),
  btnCancelBook: document.getElementById("btn-cancel-book"),
  btnDeleteBook: document.getElementById("btn-delete-book"),
  btnEditRating: document.getElementById("btn-edit-rating"),
  bookId: document.getElementById("book-id"),
  bookTitle: document.getElementById("book-title"),
  bookAuthor: document.getElementById("book-author"),
  bookType: document.getElementById("book-type"),
  bookShelf: document.getElementById("book-shelf"),
  bookOwnership: document.getElementById("book-ownership"),
  bookFinishedWrap: document.getElementById("book-finished-wrap"),
  bookFinishedDate: document.getElementById("book-finished-date"),
  bookDateUnknown: document.getElementById("book-date-unknown"),
  bookTags: document.getElementById("book-tags"),
  bookTagsSuggestions: document.getElementById("book-tags-suggestions"),
  bookRecommended: document.getElementById("book-recommended"),
  bookIsSeries: document.getElementById("book-is-series"),
  seriesFields: document.getElementById("series-fields"),
  bookSeriesName: document.getElementById("book-series-name"),
  seriesNameOptions: document.getElementById("series-name-options"),
  bookSeriesVol: document.getElementById("book-series-vol"),
  bookSeriesTotal: document.getElementById("book-series-total"),
  bookSeriesIncomplete: document.getElementById("book-series-incomplete"),
  modalRateOverlay: document.getElementById("modal-rate-overlay"),
  modalRateClose: document.getElementById("modal-rate-close"),
  rateBookLabel: document.getElementById("rate-book-label"),
  rateFinishedDate: document.getElementById("rate-finished-date"),
  rateDateUnknown: document.getElementById("rate-date-unknown"),
  rateFavorite: document.getElementById("rate-favorite"),
  btnRateSave: document.getElementById("btn-rate-save"),
  btnRateSkip: document.getElementById("btn-rate-skip"),
  btnScrollTop: document.getElementById("btn-scroll-top"),
  linkWantList: document.getElementById("link-want-list"),
  linkGoals: document.getElementById("link-goals"),
  linkSeries: document.getElementById("link-series"),
};

let state = loadState();
if (!state.goalsHistory) state.goalsHistory = [];
if (!state.hiddenTagSuggestions) state.hiddenTagSuggestions = [];
if (!state.wantList) state.wantList = [];
if (!state.hiddenSeriesIds) state.hiddenSeriesIds = [];
let activeShelf = "all";
let pendingRateBookId = null;
let selectedRating = null;
let tagSuggestBlurTimer = null;
let wantTagSuggestBlurTimer = null;
let pendingWantListAdoptId = null;
let pendingSeriesHideId = null;

function persist() {
  saveState(state);
}

function updateScrollTopVisibility() {
  if (!els.btnScrollTop) return;
  const scrolled = window.scrollY > 200;
  els.btnScrollTop.classList.toggle("hidden", !scrolled);
}

function parseTimestamp(value) {
  const n = Date.parse(value || "");
  return Number.isFinite(n) ? n : 0;
}

function shouldShowExportReminder() {
  const now = Date.now();
  const lastExportAt = parseTimestamp(localStorage.getItem(LAST_EXPORT_AT_KEY));
  const dismissedAt = parseTimestamp(localStorage.getItem(EXPORT_REMINDER_DISMISSED_AT_KEY));
  const anchor = Math.max(lastExportAt, dismissedAt);
  if (!anchor) return true;
  return now - anchor >= EXPORT_REMINDER_INTERVAL_MS;
}

function renderExportReminder() {
  if (!els.exportReminder) return;
  els.exportReminder.classList.toggle("hidden", !shouldShowExportReminder());
}

function dismissExportReminder() {
  localStorage.setItem(EXPORT_REMINDER_DISMISSED_AT_KEY, new Date().toISOString());
  renderExportReminder();
}

function makeExportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    app: "book-shelf",
    version: 1,
    data: {
      books: state.books || [],
      series: state.series || [],
      goals: state.goals || [],
      goalsHistory: state.goalsHistory || [],
      hiddenTagSuggestions: state.hiddenTagSuggestions || [],
      wantList: state.wantList || [],
    },
  };
}

function exportDataFile() {
  const payload = makeExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ymd = localYMD(new Date());
  a.href = url;
  a.download = `book-shelf-export-${ymd}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_EXPORT_AT_KEY, new Date().toISOString());
  renderExportReminder();
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
      const next = loadStateFromObject(data);
      if (!confirm("Import will replace your current data. Continue?")) return;
      state = next;
      if (!state.goalsHistory) state.goalsHistory = [];
      if (!state.hiddenTagSuggestions) state.hiddenTagSuggestions = [];
      if (!state.wantList) state.wantList = [];
      persist();
      renderAll();
      renderExportReminder();
      alert("Import complete.");
    } catch (_) {
      alert("Could not import this file. Please choose a valid Book Shelf export JSON file.");
    }
  };
  reader.readAsText(file);
}

function toggleSettingsMenu(force) {
  if (!els.settingsMenu || !els.btnSettingsToggle) return;
  const shouldOpen =
    typeof force === "boolean" ? force : els.settingsMenu.classList.contains("hidden");
  els.settingsMenu.classList.toggle("hidden", !shouldOpen);
  els.btnSettingsToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function hideTagSuggestionsPanel() {
  if (!els.bookTagsSuggestions) return;
  els.bookTagsSuggestions.classList.add("hidden");
  els.bookTagsSuggestions.innerHTML = "";
}

function renderTagSuggestionsPanel() {
  if (!els.bookTags || !els.bookTagsSuggestions) return;
  const modalOpen = !els.modalBookOverlay.classList.contains("hidden");
  if (!modalOpen) {
    hideTagSuggestionsPanel();
    return;
  }
  const last = getLastTagPrefix(els.bookTags.value);
  const suggestions = getMatchingTagSuggestions(state, last);
  els.bookTagsSuggestions.innerHTML = "";
  if (suggestions.length === 0) {
    els.bookTagsSuggestions.classList.add("hidden");
    return;
  }
  for (const display of suggestions) {
    const li = document.createElement("li");
    li.className = "tags-suggestion-item";
    li.setAttribute("role", "presentation");
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "tags-suggestion-pick";
    pick.setAttribute("role", "option");
    pick.textContent = display;
    pick.dataset.tag = display;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "tags-suggestion-remove";
    rm.setAttribute("aria-label", `Stop suggesting “${display}”`);
    rm.dataset.tagKey = display.toLowerCase();
    rm.textContent = "×";
    li.appendChild(pick);
    li.appendChild(rm);
    els.bookTagsSuggestions.appendChild(li);
  }
  els.bookTagsSuggestions.classList.remove("hidden");
}

function hideWantTagSuggestionsPanel() {
  if (!els.wantTagsSuggestions) return;
  els.wantTagsSuggestions.classList.add("hidden");
  els.wantTagsSuggestions.innerHTML = "";
}

function renderWantTagSuggestionsPanel() {
  if (!els.wantTags || !els.wantTagsSuggestions) return;
  const modalOpen = !els.modalWantOverlay.classList.contains("hidden");
  if (!modalOpen) {
    hideWantTagSuggestionsPanel();
    return;
  }
  const last = getLastTagPrefix(els.wantTags.value);
  const suggestions = getMatchingTagSuggestions(state, last);
  els.wantTagsSuggestions.innerHTML = "";
  if (suggestions.length === 0) {
    els.wantTagsSuggestions.classList.add("hidden");
    return;
  }
  for (const display of suggestions) {
    const li = document.createElement("li");
    li.className = "tags-suggestion-item";
    li.setAttribute("role", "presentation");
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "tags-suggestion-pick";
    pick.setAttribute("role", "option");
    pick.textContent = display;
    pick.dataset.tag = display;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "tags-suggestion-remove";
    rm.setAttribute("aria-label", `Stop suggesting “${display}”`);
    rm.dataset.tagKey = display.toLowerCase();
    rm.textContent = "×";
    li.appendChild(pick);
    li.appendChild(rm);
    els.wantTagsSuggestions.appendChild(li);
  }
  els.wantTagsSuggestions.classList.remove("hidden");
}

function renderSeriesNameSuggestions() {
  if (!els.seriesNameOptions) return;
  const seen = new Set();
  const names = [];
  for (const s of state.series || []) {
    const name = String(s?.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  els.seriesNameOptions.innerHTML = names
    .map((name) => `<option value="${name.replace(/"/g, "&quot;")}"></option>`)
    .join("");
}

function getKnownSeriesTotalByName(name) {
  const key = normalizeSeriesName(name);
  if (!key) return null;
  const seriesMeta = (state.series || []).find((s) => normalizeSeriesName(s.name) === key);
  if (!seriesMeta) return null;
  if (Number.isFinite(seriesMeta.expectedTotal) && seriesMeta.expectedTotal > 0) {
    return seriesMeta.expectedTotal;
  }
  const linkedBooks = (state.books || []).filter((b) => b.seriesId === seriesMeta.id);
  const volumeNumbers = linkedBooks
    .map((b) => b.volumeInSeries)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (volumeNumbers.length > 0) return Math.max(...volumeNumbers);
  if (linkedBooks.length > 0) return linkedBooks.length;
  return null;
}

function maybeAutofillSeriesTotal() {
  if (!els.bookIsSeries.checked) return;
  const name = els.bookSeriesName.value.trim();
  if (!name) return;
  const currentTotal = parseInt(els.bookSeriesTotal.value, 10);
  if (Number.isFinite(currentTotal) && currentTotal > 0) return;
  const knownTotal = getKnownSeriesTotalByName(name);
  if (Number.isFinite(knownTotal) && knownTotal > 0) {
    els.bookSeriesTotal.value = String(knownTotal);
  }
}

function initShelfSelects() {
  els.bookShelf.innerHTML = SHELVES.map(
    (s) => `<option value="${s.id}">${s.label}</option>`
  ).join("");

  els.shelfTabs.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "shelf-tab";
  allBtn.setAttribute("role", "tab");
  allBtn.dataset.shelf = "all";
  allBtn.textContent = "All";
  els.shelfTabs.appendChild(allBtn);

  for (const s of SHELVES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "shelf-tab";
    b.setAttribute("role", "tab");
    b.dataset.shelf = s.id;
    b.textContent = s.label;
    els.shelfTabs.appendChild(b);
  }

  els.sort.innerHTML = SORT_OPTIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
}

function setActiveTabs() {
  els.shelfTabs.querySelectorAll(".shelf-tab").forEach((btn) => {
    btn.setAttribute("aria-selected", btn.dataset.shelf === activeShelf ? "true" : "false");
  });
}

function renderBookList() {
  const q = els.search.value;
  const sortId = els.sort.value;
  const type = els.filterType.value;
  const ownership = els.filterOwnership.value;
  const favoritesOnly = els.filterFavorites.checked;

  let list = filterBooks(state.books, { shelfTab: activeShelf, q, type, favoritesOnly, ownership });
  list = sortBooks(list, sortId);

  els.listEmpty.classList.toggle("hidden", list.length > 0);
  els.bookList.innerHTML = "";

  for (const b of list) {
    const li = document.createElement("li");
    li.className = "book-card";

    const spine = document.createElement("span");
    spine.className = `book-card-spine book-card-spine--${b.shelf || "wishlist"}`;
    spine.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    const titleRow = document.createElement("div");
    titleRow.className = "book-title-row";
    const h3 = document.createElement("h3");
    h3.className = "book-card-title";
    h3.textContent = b.title;
    titleRow.appendChild(h3);
    if (b.favorite) {
      const heart = document.createElement("span");
      heart.className = "favorite-badge";
      heart.textContent = "♥";
      titleRow.appendChild(heart);
    }
    const meta = document.createElement("p");
    meta.className = "book-card-meta";
    meta.textContent = `${b.author} · ${typeLabel(b.type)} · ${ownershipLabel(b.ownership)} · ${shelfLabel(b.shelf)}`;

    const tagsRow = document.createElement("div");
    tagsRow.className = "book-card-tags";
    const typeTag = document.createElement("span");
    typeTag.className = "tag tag-type";
    typeTag.textContent = typeLabel(b.type);
    tagsRow.appendChild(typeTag);
    if (b.ownership === "borrowed") {
      const ow = document.createElement("span");
      ow.className = "tag";
      ow.textContent = "Borrowed";
      tagsRow.appendChild(ow);
    }
    for (const t of b.tags || []) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagsRow.appendChild(span);
    }
    if (b.recommendedBy) {
      const rec = document.createElement("span");
      rec.className = "tag";
      rec.textContent = `Rec: ${b.recommendedBy}`;
      tagsRow.appendChild(rec);
    }

    body.appendChild(titleRow);
    body.appendChild(meta);
    body.appendChild(tagsRow);

    if (b.seriesId) {
      const sMeta = state.series.find((s) => s.id === b.seriesId);
      const sb = document.createElement("p");
      sb.className = "series-badge";
      const vol = b.volumeInSeries != null ? `Vol. ${b.volumeInSeries}` : "Series";
      sb.textContent = sMeta ? `${sMeta.name} · ${vol}` : vol;
      body.appendChild(sb);
    }

    if (b.shelf === "read") {
      if (b.rating) {
        const rating = document.createElement("p");
        rating.className = "series-badge";
        if (b.rating === "terrible") rating.textContent = "Rating: Terrible";
        else if (b.rating === "not_good") rating.textContent = "Rating: Not good";
        else if (b.rating === "okay") rating.textContent = "Rating: Okay";
        else if (b.rating === "good") rating.textContent = "Rating: Good";
        else if (b.rating === "great") rating.textContent = "Rating: Great";
        body.appendChild(rating);
      }
      if (!b.readDateUnknown && b.readAt) {
        const finished = document.createElement("p");
        finished.className = "series-badge";
        const dt = new Date(b.readAt);
        if (!Number.isNaN(dt.getTime())) {
          finished.textContent = `Finished: ${dt.toLocaleDateString()}`;
          body.appendChild(finished);
        }
      }
    }

    const actions = document.createElement("div");
    actions.className = "book-card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openBookModal(b.id));

    const shelfQuick = document.createElement("select");
    shelfQuick.className = "select select-shelf-quick";
    shelfQuick.setAttribute("aria-label", "Change shelf");
    for (const s of SHELVES) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      if (s.id === b.shelf) opt.selected = true;
      shelfQuick.appendChild(opt);
    }
    shelfQuick.addEventListener("change", () => {
      const prev = b.shelf;
      const next = shelfQuick.value;
      b.shelf = next;
      if (next === "read" && prev !== "read") {
        b.readAt = new Date().toISOString();
        persist();
        renderAll();
        openRateModal(b.id);
        return;
      }
      if (next !== "read") {
        // optional: clear readAt when leaving read — keep for history
      }
      b.updatedAt = new Date().toISOString();
      persist();
      renderAll();
    });

    actions.appendChild(editBtn);
    actions.appendChild(shelfQuick);

    li.appendChild(spine);
    li.appendChild(body);
    li.appendChild(actions);
    els.bookList.appendChild(li);
  }
}

function renderGoals() {
  const hasGoals = state.goals.length > 0;
  els.goalsEmpty.classList.toggle("hidden", hasGoals);
  els.goalsListWrap.classList.toggle("hidden", !hasGoals);
  els.goalsList.innerHTML = "";

  for (const g of state.goals) {
    const done = countReadBooksInPeriod(state.books, g.period, g.excludeAudiobooks);
    const target = g.target;
    const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    const excludeNote = g.excludeAudiobooks
      ? "Audiobooks excluded · physical books and e-books count"
      : "Physical books, e-books, and audiobooks count";

    const li = document.createElement("li");
    li.className = "goal-card";

    const head = document.createElement("div");
    head.className = "goal-card-head";
    const h3 = document.createElement("h3");
    h3.textContent = `${goalPeriodHeading(g.period)} — ${target} book${target === 1 ? "" : "s"}`;
    head.appendChild(h3);

    const meta = document.createElement("p");
    meta.className = "goal-card-meta";
    meta.textContent = excludeNote;

    const bar = document.createElement("div");
    bar.className = "goal-bar";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = `<div class="goal-bar-fill" style="width:${pct}%"></div>`;

    const stats = document.createElement("p");
    stats.className = "goal-stats";
    stats.textContent = `${done} / ${target} finished (${pct}%)`;

    const actions = document.createElement("div");
    actions.className = "goal-card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openGoalModal(g.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-small";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", () => {
      if (!confirm("Remove this reading goal?")) return;
      const pk = g.currentPeriodKey || getCurrentPeriodKey(g.period, new Date());
      archiveGoalPeriodEntry(state, g, pk, "removed");
      state.goals = state.goals.filter((x) => x.id !== g.id);
      persist();
      renderAll();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(head);
    li.appendChild(meta);
    li.appendChild(bar);
    li.appendChild(stats);
    li.appendChild(actions);
    els.goalsList.appendChild(li);
  }
}

function getSelectedGoalPeriod() {
  const checked = els.formGoal.querySelector('input[name="goal-period"]:checked');
  return checked ? checked.value : "week";
}

function setSelectedGoalPeriod(period) {
  const r = els.formGoal.querySelector(`input[name="goal-period"][value="${period}"]`);
  if (r) {
    r.checked = true;
  }
}

function openGoalModal(goalId) {
  const existing = goalId ? state.goals.find((g) => g.id === goalId) : null;
  els.modalGoalTitle.textContent = existing ? "Edit reading goal" : "Add reading goal";
  els.goalEditId.value = existing?.id || "";
  setSelectedGoalPeriod(existing?.period || "week");
  els.goalExcludeAudiobook.checked = !!existing?.excludeAudiobooks;
  els.goalTarget.value = existing ? String(existing.target) : "";
  els.modalGoalOverlay.classList.remove("hidden");
  els.modalGoalOverlay.setAttribute("aria-hidden", "false");
  els.goalTarget.focus();
}

function closeGoalModal() {
  els.modalGoalOverlay.classList.add("hidden");
  els.modalGoalOverlay.setAttribute("aria-hidden", "true");
  els.formGoal.reset();
  els.goalEditId.value = "";
  setSelectedGoalPeriod("week");
}

function submitGoalForm(e) {
  e.preventDefault();
  const period = getSelectedGoalPeriod();
  if (!["week", "month", "year"].includes(period)) return;

  const target = Math.max(1, parseInt(els.goalTarget.value, 10) || 0);
  if (target < 1) return;

  const excludeAudiobooks = els.goalExcludeAudiobook.checked;
  const editId = els.goalEditId.value.trim();

  if (editId) {
    const idx = state.goals.findIndex((g) => g.id === editId);
    if (idx >= 0) {
      const prev = state.goals[idx];
      const periodChanged = prev.period !== period;
      state.goals[idx] = {
        ...prev,
        period,
        target,
        excludeAudiobooks,
        currentPeriodKey: periodChanged
          ? getCurrentPeriodKey(period, new Date())
          : prev.currentPeriodKey || getCurrentPeriodKey(period, new Date()),
      };
    }
  } else {
    state.goals.push({
      id: uuid(),
      period,
      target,
      excludeAudiobooks,
      currentPeriodKey: getCurrentPeriodKey(period, new Date()),
    });
  }

  persist();
  closeGoalModal();
  renderAll();
}

function renderGoalsHistory() {
  if (!els.goalsHistoryList || !els.goalsHistoryEmpty) return;
  const list = (state.goalsHistory || [])
    .slice()
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  els.goalsHistoryEmpty.classList.toggle("hidden", list.length > 0);
  els.goalsHistoryList.innerHTML = "";
  for (const h of list) {
    const li = document.createElement("li");
    li.className = "goals-history-item";
    const title = document.createElement("div");
    title.className = "goals-history-item-title";
    title.textContent = formatHistoryPeriodLabel(h.period, h.periodKey);
    const meta = document.createElement("div");
    meta.className = "goals-history-item-meta";
    const periodWord = h.period === "week" ? "Weekly" : h.period === "month" ? "Monthly" : "Yearly";
    const ex = h.excludeAudiobooks ? " · Audiobooks excluded" : "";
    meta.textContent = `${periodWord} goal${ex} · Target ${h.target} · Finished ${h.finishedCount} · Logged ${new Date(h.archivedAt).toLocaleDateString()}`;
    const st = document.createElement("div");
    const met = h.finishedCount >= h.target;
    st.className = `goals-history-item-status ${met ? "goals-history-item-status--met" : "goals-history-item-status--missed"}`;
    st.textContent = met ? "Met goal" : "Below target";
    const reason = document.createElement("div");
    reason.className = "goals-history-item-meta";
    reason.style.marginTop = "0.25rem";
    reason.textContent = h.reason === "removed" ? "Archived when goal was removed" : "Period ended (new week / month / year)";
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(st);
    li.appendChild(reason);
    els.goalsHistoryList.appendChild(li);
  }
}

function renderSeries() {
  cleanupEmptySeries(state);
  const hidden = new Set(state.hiddenSeriesIds || []);
  const visibleSeries = state.series.filter((s) => !hidden.has(s.id));
  if (visibleSeries.length === 0) {
    els.seriesEmpty.classList.remove("hidden");
    els.seriesList.innerHTML = "";
    return;
  }
  els.seriesEmpty.classList.add("hidden");
  els.seriesList.innerHTML = "";

  const sorted = [...visibleSeries].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  for (const s of sorted) {
    const { readCount, total, meta, volumes } = seriesProgress(state, s.id);
    if (volumes.length === 0) continue;

    const card = document.createElement("div");
    card.className = "series-card";
    const ongoing = meta?.publishingIncomplete ? " · Series ongoing" : "";
    const totalLabel = meta?.publishingIncomplete && meta?.expectedTotal == null
      ? `${readCount} read (${volumes.length} in library)`
      : `${readCount} / ${total} read`;

    const h3 = document.createElement("h3");
    h3.textContent = s.name;
    const hideBtn = document.createElement("button");
    hideBtn.type = "button";
    hideBtn.className = "series-hide-link";
    hideBtn.setAttribute("aria-label", `Hide ${s.name} from series view`);
    hideBtn.title = "Hide from series view";
    hideBtn.textContent = "×";
    hideBtn.addEventListener("click", () => {
      openSeriesRemoveConfirm(s.id, s.name);
    });
    const metaP = document.createElement("p");
    metaP.className = "series-card-meta";
    metaP.textContent = totalLabel + ongoing;

    const barPct = total > 0 ? Math.min(100, Math.round((readCount / total) * 100)) : 0;
    const bar = document.createElement("div");
    bar.className = "goal-bar";
    bar.innerHTML = `<div class="goal-bar-fill" style="width:${barPct}%"></div>`;

    const volList = document.createElement("ul");
    volList.className = "book-list";
    volList.style.marginTop = "0.75rem";

    const volSorted = [...volumes].sort((a, b) => (a.volumeInSeries || 999) - (b.volumeInSeries || 999));
    for (const v of volSorted) {
      const li = document.createElement("li");
      li.style.fontSize = "0.875rem";
      li.style.color = "var(--text-muted)";
      const st = v.shelf === "read" ? "✓" : v.shelf === "dnf" ? "✗ DNF" : "○";
      li.textContent = `${st} ${v.title}${v.volumeInSeries != null ? ` (#${v.volumeInSeries})` : ""}`;
      volList.appendChild(li);
    }

    card.appendChild(h3);
    card.appendChild(metaP);
    card.appendChild(bar);
    card.appendChild(volList);
    card.appendChild(hideBtn);
    els.seriesList.appendChild(card);
  }
}

function openSeriesRemoveConfirm(seriesId, seriesName) {
  pendingSeriesHideId = seriesId;
  if (els.seriesRemoveMessage) {
    els.seriesRemoveMessage.textContent = `Hide “${seriesName}” from the Series section?`;
  }
  els.modalSeriesRemoveOverlay.classList.remove("hidden");
  els.modalSeriesRemoveOverlay.setAttribute("aria-hidden", "false");
}

function closeSeriesRemoveConfirm() {
  pendingSeriesHideId = null;
  els.modalSeriesRemoveOverlay.classList.add("hidden");
  els.modalSeriesRemoveOverlay.setAttribute("aria-hidden", "true");
}

function confirmSeriesRemove() {
  if (!pendingSeriesHideId) {
    closeSeriesRemoveConfirm();
    return;
  }
  if (!state.hiddenSeriesIds.includes(pendingSeriesHideId)) {
    state.hiddenSeriesIds.push(pendingSeriesHideId);
  }
  persist();
  closeSeriesRemoveConfirm();
  renderSeries();
}

function renderAll() {
  const validShelf = new Set(["all", ...SHELVES.map((s) => s.id)]);
  if (!validShelf.has(activeShelf)) activeShelf = "all";
  if (syncGoalPeriods(state)) persist();
  setActiveTabs();
  renderBookList();
  renderSeriesNameSuggestions();
  renderWantList();
  renderGoals();
  renderGoalsHistory();
  renderSeries();
  renderExportReminder();
}

function renderWantList() {
  if (!els.wantListItems || !els.wantListEmpty) return;
  const list = [...(state.wantList || [])].sort((a, b) =>
    (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
  );
  els.wantListEmpty.classList.toggle("hidden", list.length > 0);
  els.wantListItems.innerHTML = "";

  for (const w of list) {
    const li = document.createElement("li");
    li.className = "want-card";

    const spine = document.createElement("span");
    spine.className = "want-card-spine";
    spine.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "want-card-title";
    h3.textContent = w.title;
    body.appendChild(h3);

    const meta = document.createElement("p");
    meta.className = "want-card-meta";
    meta.textContent = w.author ? w.author : "Author unknown";
    body.appendChild(meta);

    if (w.notes) {
      const notes = document.createElement("p");
      notes.className = "want-card-notes";
      notes.textContent = w.notes;
      body.appendChild(notes);
    }

    const tagsRow = document.createElement("div");
    tagsRow.className = "want-card-tags";
    for (const t of w.tags || []) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagsRow.appendChild(span);
    }
    if (w.recommendedBy) {
      const rec = document.createElement("span");
      rec.className = "tag";
      rec.textContent = `Rec: ${w.recommendedBy}`;
      tagsRow.appendChild(rec);
    }
    if (tagsRow.children.length) body.appendChild(tagsRow);

    const actions = document.createElement("div");
    actions.className = "want-card-actions";

    const adoptBtn = document.createElement("button");
    adoptBtn.type = "button";
    adoptBtn.className = "btn-small";
    adoptBtn.textContent = "Add to library";
    adoptBtn.addEventListener("click", () => openBookModal(null, { adoptWantItemId: w.id }));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openWantModal(w.id));

    const amazonLink = document.createElement("a");
    amazonLink.className = "btn-small";
    amazonLink.textContent = "Amazon";
    amazonLink.href = amazonSearchUrl(w.title, w.author, "book");
    amazonLink.target = "_blank";
    amazonLink.rel = "noopener noreferrer";

    actions.appendChild(adoptBtn);
    actions.appendChild(editBtn);
    actions.appendChild(amazonLink);

    li.appendChild(spine);
    li.appendChild(body);
    li.appendChild(actions);
    els.wantListItems.appendChild(li);
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  try {
    localStorage.setItem(THEME_KEY, theme === "dark" ? "dark" : "light");
  } catch (_) {}
  els.settingTheme.value = theme === "dark" ? "dark" : "light";
}

function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    applyTheme(t === "dark" ? "dark" : "light");
  } catch (_) {
    applyTheme("light");
  }
}

function updateBookFinishedVisibility() {
  const show = els.bookShelf.value === "read";
  els.bookFinishedWrap.classList.toggle("hidden", !show);
  if (show && !els.bookFinishedDate.value) {
    els.bookFinishedDate.value = localYMD(new Date());
  }
}

function updateBookDateUnknownUI() {
  const unknown = !!els.bookDateUnknown?.checked;
  els.bookFinishedDate.disabled = unknown;
  if (unknown) els.bookFinishedDate.value = "";
}

function updateRateDateUnknownUI() {
  const unknown = !!els.rateDateUnknown?.checked;
  els.rateFinishedDate.disabled = unknown;
  if (unknown) els.rateFinishedDate.value = "";
}

function openBookModal(bookId, opts = {}) {
  const isEdit = !!bookId;
  const b = isEdit ? state.books.find((x) => x.id === bookId) : null;

  if (isEdit) {
    pendingWantListAdoptId = null;
  } else if (opts.adoptWantItemId) {
    const w = (state.wantList || []).find((x) => x.id === opts.adoptWantItemId);
    pendingWantListAdoptId = w ? w.id : null;
  } else {
    pendingWantListAdoptId = null;
  }

  const adoptW = pendingWantListAdoptId
    ? state.wantList.find((x) => x.id === pendingWantListAdoptId)
    : null;

  els.modalBookTitle.textContent = isEdit ? "Edit book" : adoptW ? "Add to library" : "Add book";
  els.btnDeleteBook.hidden = !isEdit;
  els.btnEditRating.hidden = !(isEdit && b?.shelf === "read");
  els.bookId.value = b?.id || "";

  if (isEdit && b) {
    els.bookTitle.value = b.title || "";
    els.bookAuthor.value = b.author || "";
    els.bookType.value = b.type || "physical";
    els.bookShelf.value = b.shelf || "wishlist";
    els.bookOwnership.value = b.ownership === "borrowed" ? "borrowed" : "owned";
    const readUnknown = !!b.readDateUnknown || (b.shelf === "read" && !b.readAt);
    els.bookDateUnknown.checked = readUnknown;
    els.bookFinishedDate.value =
      b.shelf === "read" && !readUnknown ? readAtToDateInputValue(b.readAt) || localYMD(new Date()) : "";
    els.bookTags.value = (b.tags || []).join(", ");
    els.bookRecommended.value = b.recommendedBy || "";
  } else if (adoptW) {
    els.bookTitle.value = adoptW.title || "";
    els.bookAuthor.value = adoptW.author || "";
    els.bookType.value = "physical";
    els.bookShelf.value = "wishlist";
    els.bookOwnership.value = "owned";
    els.bookDateUnknown.checked = false;
    els.bookFinishedDate.value = "";
    els.bookTags.value = (adoptW.tags || []).join(", ");
    els.bookRecommended.value = adoptW.recommendedBy || "";
  } else {
    els.bookTitle.value = "";
    els.bookAuthor.value = "";
    els.bookType.value = "physical";
    els.bookShelf.value = "wishlist";
    els.bookOwnership.value = "owned";
    els.bookDateUnknown.checked = false;
    els.bookFinishedDate.value = "";
    els.bookTags.value = "";
    els.bookRecommended.value = "";
  }

  updateBookFinishedVisibility();
  updateBookDateUnknownUI();

  const hasSeries = !!(isEdit && b?.seriesId);
  els.bookIsSeries.checked = hasSeries;
  els.seriesFields.classList.toggle("hidden", !hasSeries);
  if (hasSeries && b) {
    const sm = state.series.find((s) => s.id === b.seriesId);
    els.bookSeriesName.value = sm?.name || "";
    els.bookSeriesVol.value = b.volumeInSeries != null ? String(b.volumeInSeries) : "";
    els.bookSeriesTotal.value = sm?.expectedTotal != null ? String(sm.expectedTotal) : "";
    els.bookSeriesIncomplete.checked = !!sm?.publishingIncomplete;
  } else {
    els.bookSeriesName.value = "";
    els.bookSeriesVol.value = "";
    els.bookSeriesTotal.value = "";
    els.bookSeriesIncomplete.checked = false;
  }
  maybeAutofillSeriesTotal();

  els.modalBookOverlay.classList.remove("hidden");
  els.modalBookOverlay.setAttribute("aria-hidden", "false");
  els.bookTitle.focus();
}

function closeBookModal() {
  pendingWantListAdoptId = null;
  clearTimeout(tagSuggestBlurTimer);
  hideTagSuggestionsPanel();
  els.modalBookOverlay.classList.add("hidden");
  els.modalBookOverlay.setAttribute("aria-hidden", "true");
}

function parseTags(str) {
  return (str || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function submitBookForm(e) {
  e.preventDefault();
  const id = els.bookId.value || uuid();
  const prev = state.books.find((x) => x.id === id);
  const prevShelf = prev?.shelf;

  const title = els.bookTitle.value.trim();
  const author = els.bookAuthor.value.trim();
  if (!title || !author) return;

  let seriesId = prev?.seriesId || null;
  let volumeInSeries = prev?.volumeInSeries ?? null;

  if (els.bookIsSeries.checked) {
    const sName = els.bookSeriesName.value.trim();
    const vol = parseInt(els.bookSeriesVol.value, 10);
    const total = parseInt(els.bookSeriesTotal.value, 10);
    const inc = els.bookSeriesIncomplete.checked;
    if (sName) {
      const s = findOrCreateSeries(state.series, sName, {
        expectedTotal: Number.isFinite(total) && total > 0 ? total : null,
        publishingIncomplete: inc,
      });
      seriesId = s.id;
      volumeInSeries = Number.isFinite(vol) && vol > 0 ? vol : null;
    }
  } else {
    seriesId = null;
    volumeInSeries = null;
  }

  const shelf = els.bookShelf.value;
  const ownership = els.bookOwnership.value === "borrowed" ? "borrowed" : "owned";
  const now = new Date().toISOString();

  let readAt = prev?.readAt ?? null;
  const readDateUnknown = shelf === "read" ? !!els.bookDateUnknown.checked : false;
  if (shelf === "read") {
    if (readDateUnknown) {
      readAt = null;
    } else {
      const fromInput = dateInputToLocalNoonISO(els.bookFinishedDate.value);
      readAt = fromInput || readAt || now;
    }
  }

  const book = {
    id,
    title,
    author,
    type: els.bookType.value,
    tags: parseTags(els.bookTags.value),
    recommendedBy: els.bookRecommended.value.trim() || "",
    shelf,
    ownership,
    seriesId,
    volumeInSeries,
    rating: prev?.rating ?? null,
    favorite: !!prev?.favorite,
    readDateUnknown,
    readAt,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };

  const becameRead = shelf === "read" && prevShelf !== "read";

  const idx = state.books.findIndex((x) => x.id === id);
  if (idx >= 0) state.books[idx] = book;
  else state.books.push(book);

  if (!prev && pendingWantListAdoptId) {
    state.wantList = state.wantList.filter((x) => x.id !== pendingWantListAdoptId);
    pendingWantListAdoptId = null;
  }

  cleanupEmptySeries(state);
  persist();
  closeBookModal();
  renderAll();

  if (becameRead) {
    pendingRateBookId = id;
    openRateModal(id);
  }
}

function openRateModal(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;
  pendingRateBookId = bookId;
  selectedRating = b.rating || null;
  els.rateBookLabel.textContent = b.title;
  const dateUnknown = !!b.readDateUnknown || !b.readAt;
  els.rateDateUnknown.checked = dateUnknown;
  els.rateFinishedDate.value =
    dateUnknown ? "" : readAtToDateInputValue(b.readAt) || readAtToDateInputValue(new Date().toISOString());
  updateRateDateUnknownUI();
  els.rateFavorite.checked = !!b.favorite;
  els.modalRateOverlay.classList.remove("hidden");
  els.modalRateOverlay.setAttribute("aria-hidden", "false");
  els.modalRateOverlay.querySelectorAll(".rating-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.rating === selectedRating ? "true" : "false");
  });
}

function closeRateModal() {
  els.modalRateOverlay.classList.add("hidden");
  els.modalRateOverlay.setAttribute("aria-hidden", "true");
  pendingRateBookId = null;
  selectedRating = null;
}

function saveRating(skipRating) {
  if (!pendingRateBookId) return;
  const b = state.books.find((x) => x.id === pendingRateBookId);
  if (!b) {
    closeRateModal();
    return;
  }
  const dateUnknown = !!els.rateDateUnknown.checked;
  if (dateUnknown) {
    b.readAt = null;
    b.readDateUnknown = true;
  } else {
    const finishedIso = dateInputToLocalNoonISO(els.rateFinishedDate.value);
    if (finishedIso) b.readAt = finishedIso;
    b.readDateUnknown = false;
  }
  if (!skipRating && selectedRating) b.rating = selectedRating;
  else if (!skipRating && !selectedRating) {
    /* user hit save without picking — leave as-is or require? allow partial */
  }
  b.favorite = els.rateFavorite.checked;
  b.updatedAt = new Date().toISOString();
  persist();
  closeRateModal();
  renderAll();
}

function deleteBook() {
  const id = els.bookId.value;
  if (!id) return;
  if (!confirm("Delete this book from your library?")) return;
  state.books = state.books.filter((b) => b.id !== id);
  cleanupEmptySeries(state);
  persist();
  closeBookModal();
  renderAll();
}

function openWantModal(itemId) {
  const existing = itemId ? state.wantList.find((x) => x.id === itemId) : null;
  const mt = document.getElementById("modal-want-title");
  if (mt) mt.textContent = existing ? "Edit want list item" : "Add to want list";
  els.btnWantDelete.hidden = !existing;
  els.wantItemId.value = existing?.id || "";
  els.wantTitle.value = existing?.title || "";
  els.wantAuthor.value = existing?.author || "";
  els.wantNotes.value = existing?.notes || "";
  els.wantTags.value = (existing?.tags || []).join(", ");
  els.wantRecommended.value = existing?.recommendedBy || "";
  els.modalWantOverlay.classList.remove("hidden");
  els.modalWantOverlay.setAttribute("aria-hidden", "false");
  els.wantTitle.focus();
}

function closeWantModal() {
  clearTimeout(wantTagSuggestBlurTimer);
  hideWantTagSuggestionsPanel();
  els.modalWantOverlay.classList.add("hidden");
  els.modalWantOverlay.setAttribute("aria-hidden", "true");
  els.formWant.reset();
  els.wantItemId.value = "";
  els.btnWantDelete.hidden = true;
}

function submitWantForm(e) {
  e.preventDefault();
  const title = els.wantTitle.value.trim();
  if (!title) return;
  const id = els.wantItemId.value.trim() || uuid();
  const prevW = state.wantList.find((x) => x.id === id);
  const item = normalizeWantItem({
    id,
    title,
    author: els.wantAuthor.value.trim(),
    notes: els.wantNotes.value.trim(),
    tags: parseTags(els.wantTags.value),
    recommendedBy: els.wantRecommended.value.trim(),
    createdAt: prevW?.createdAt,
  });
  const idx = state.wantList.findIndex((x) => x.id === id);
  if (idx >= 0) state.wantList[idx] = item;
  else state.wantList.push(item);
  persist();
  closeWantModal();
  renderAll();
}

function deleteWantItem() {
  const id = els.wantItemId.value.trim();
  if (!id || !confirm("Remove this title from your want list?")) return;
  state.wantList = state.wantList.filter((x) => x.id !== id);
  persist();
  closeWantModal();
  renderAll();
}

// Events
initShelfSelects();
loadTheme();
setActiveTabs();
renderExportReminder();

els.shelfTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".shelf-tab");
  if (!btn) return;
  activeShelf = btn.dataset.shelf;
  renderAll();
});

["input", "change"].forEach((ev) => {
  els.search.addEventListener(ev, () => renderBookList());
  els.sort.addEventListener(ev, () => renderBookList());
  els.filterType.addEventListener(ev, () => renderBookList());
  els.filterOwnership.addEventListener(ev, () => renderBookList());
  els.filterFavorites.addEventListener(ev, () => renderBookList());
});

els.btnAdd.addEventListener("click", () => openBookModal(null));
els.btnSettingsToggle?.addEventListener("click", () => toggleSettingsMenu());
els.btnExportData?.addEventListener("click", () => exportDataFile());
els.btnExportReminder?.addEventListener("click", () => exportDataFile());
els.btnDismissExportReminder?.addEventListener("click", () => dismissExportReminder());
els.btnImportData?.addEventListener("click", () => {
  els.inputImportData?.click();
});
els.inputImportData?.addEventListener("change", (e) => {
  const file = e.target?.files?.[0];
  handleImportFile(file);
  if (els.inputImportData) els.inputImportData.value = "";
});
els.btnWantAdd.addEventListener("click", () => openWantModal(null));
els.modalWantClose.addEventListener("click", closeWantModal);
els.btnWantCancel.addEventListener("click", closeWantModal);
els.btnWantDelete.addEventListener("click", deleteWantItem);
els.formWant.addEventListener("submit", submitWantForm);
els.modalWantOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalWantOverlay) closeWantModal();
});

els.modalBookClose.addEventListener("click", closeBookModal);
els.btnCancelBook.addEventListener("click", closeBookModal);
els.btnDeleteBook.addEventListener("click", deleteBook);
els.btnEditRating.addEventListener("click", () => {
  const id = els.bookId.value;
  if (!id) return;
  closeBookModal();
  openRateModal(id);
});
els.formBook.addEventListener("submit", submitBookForm);

els.bookShelf.addEventListener("change", () => {
  updateBookFinishedVisibility();
  if (els.bookShelf.value !== "read") {
    els.bookDateUnknown.checked = false;
  }
  updateBookDateUnknownUI();
});
els.bookDateUnknown.addEventListener("change", () => updateBookDateUnknownUI());
els.rateDateUnknown.addEventListener("change", () => updateRateDateUnknownUI());

if (els.bookTagsSuggestions) {
  els.bookTagsSuggestions.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  els.bookTagsSuggestions.addEventListener("click", (e) => {
    const rm = e.target.closest(".tags-suggestion-remove");
    if (rm) {
      e.stopPropagation();
      const k = rm.dataset.tagKey;
      if (k && !state.hiddenTagSuggestions.includes(k)) {
        state.hiddenTagSuggestions.push(k);
        persist();
      }
      renderTagSuggestionsPanel();
      els.bookTags.focus();
      return;
    }
    const pick = e.target.closest(".tags-suggestion-pick");
    if (pick && pick.dataset.tag) {
      els.bookTags.value = applyTagToInput(els.bookTags.value, pick.dataset.tag);
      renderTagSuggestionsPanel();
      els.bookTags.focus();
    }
  });
}

if (els.wantTagsSuggestions) {
  els.wantTagsSuggestions.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  els.wantTagsSuggestions.addEventListener("click", (e) => {
    const rm = e.target.closest(".tags-suggestion-remove");
    if (rm) {
      e.stopPropagation();
      const k = rm.dataset.tagKey;
      if (k && !state.hiddenTagSuggestions.includes(k)) {
        state.hiddenTagSuggestions.push(k);
        persist();
      }
      renderWantTagSuggestionsPanel();
      els.wantTags.focus();
      return;
    }
    const pick = e.target.closest(".tags-suggestion-pick");
    if (pick && pick.dataset.tag) {
      els.wantTags.value = applyTagToInput(els.wantTags.value, pick.dataset.tag);
      renderWantTagSuggestionsPanel();
      els.wantTags.focus();
    }
  });
}

els.bookTags.addEventListener("input", () => renderTagSuggestionsPanel());
els.bookTags.addEventListener("focus", () => {
  clearTimeout(tagSuggestBlurTimer);
  renderTagSuggestionsPanel();
});
els.bookTags.addEventListener("blur", () => {
  tagSuggestBlurTimer = setTimeout(() => hideTagSuggestionsPanel(), 180);
});
els.wantTags.addEventListener("input", () => renderWantTagSuggestionsPanel());
els.wantTags.addEventListener("focus", () => {
  clearTimeout(wantTagSuggestBlurTimer);
  renderWantTagSuggestionsPanel();
});
els.wantTags.addEventListener("blur", () => {
  wantTagSuggestBlurTimer = setTimeout(() => hideWantTagSuggestionsPanel(), 180);
});

els.bookIsSeries.addEventListener("change", () => {
  els.seriesFields.classList.toggle("hidden", !els.bookIsSeries.checked);
  maybeAutofillSeriesTotal();
});
els.bookSeriesName.addEventListener("input", () => {
  maybeAutofillSeriesTotal();
});
els.bookSeriesName.addEventListener("change", () => {
  maybeAutofillSeriesTotal();
});

els.modalBookOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalBookOverlay) closeBookModal();
});

els.btnGoalFirst.addEventListener("click", () => openGoalModal(null));
els.btnGoalAnother.addEventListener("click", () => openGoalModal(null));
els.modalGoalClose.addEventListener("click", closeGoalModal);
els.btnGoalCancel.addEventListener("click", closeGoalModal);
els.formGoal.addEventListener("submit", submitGoalForm);
els.modalGoalOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalGoalOverlay) closeGoalModal();
});
els.modalSeriesRemoveClose.addEventListener("click", closeSeriesRemoveConfirm);
els.btnSeriesRemoveCancel.addEventListener("click", closeSeriesRemoveConfirm);
els.btnSeriesRemoveConfirm.addEventListener("click", confirmSeriesRemove);
els.modalSeriesRemoveOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalSeriesRemoveOverlay) closeSeriesRemoveConfirm();
});

els.modalRateOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalRateOverlay) closeRateModal();
});
els.modalRateClose.addEventListener("click", closeRateModal);

els.modalRateOverlay.querySelectorAll(".rating-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRating = btn.dataset.rating;
    els.modalRateOverlay.querySelectorAll(".rating-btn").forEach((b) => {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
  });
});

els.btnRateSave.addEventListener("click", () => saveRating(false));
els.btnRateSkip.addEventListener("click", () => saveRating(true));

els.settingTheme.addEventListener("change", () => {
  applyTheme(els.settingTheme.value);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!els.modalRateOverlay.classList.contains("hidden")) closeRateModal();
    else if (!els.modalGoalOverlay.classList.contains("hidden")) closeGoalModal();
    else if (!els.modalSeriesRemoveOverlay.classList.contains("hidden")) closeSeriesRemoveConfirm();
    else if (!els.modalWantOverlay.classList.contains("hidden")) closeWantModal();
    else if (!els.modalBookOverlay.classList.contains("hidden")) closeBookModal();
    else toggleSettingsMenu(false);
  }
});

document.addEventListener("click", (e) => {
  if (!els.settingsMenu || !els.btnSettingsToggle) return;
  const target = e.target;
  if (els.settingsMenu.contains(target) || els.btnSettingsToggle.contains(target)) return;
  toggleSettingsMenu(false);
});

window.addEventListener("scroll", () => {
  updateScrollTopVisibility();
});
els.btnScrollTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.linkWantList?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("want-list")?.scrollIntoView({ behavior: "smooth" });
});
els.linkGoals.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("goals")?.scrollIntoView({ behavior: "smooth" });
});
els.linkSeries.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("series")?.scrollIntoView({ behavior: "smooth" });
});

renderAll();
updateScrollTopVisibility();
