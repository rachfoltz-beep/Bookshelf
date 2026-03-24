/**
 * Book Shelf — local-first reading tracker
 */

const STORAGE_KEY = "book_shelf_data_v1";
const THEME_KEY = "book_shelf_theme";
const LAST_EXPORT_AT_KEY = "book_shelf_last_export_at";
const EXPORT_REMINDER_DISMISSED_AT_KEY = "book_shelf_export_reminder_dismissed_at";
const EXPORT_REMINDER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const SUPABASE_URL_KEY = "book_shelf_supabase_url";
const SUPABASE_ANON_KEY_KEY = "book_shelf_supabase_anon_key";
const SUPABASE_MIGRATED_PREFIX = "book_shelf_supabase_migrated_";
const DEFAULT_SUPABASE_URL = "https://butvceqsbfdtwgihqcst.supabase.co";

const DEFAULT_USER_SHELF_NAME = "My Bookshelf";
const MAX_CUSTOM_USER_SHELVES = 25;

/** Reading progress (not physical shelf). */
const READING_STATUSES = [
  { id: "wishlist", label: "To read" },
  { id: "in_progress", label: "In progress" },
  { id: "read", label: "Read" },
  { id: "dnf", label: "Did not finish" },
];

function readingStatusOf(book) {
  let s = book?.readingStatus ?? book?.reading_status ?? book?.shelf;
  if (s === "owned") s = "wishlist";
  if (!["wishlist", "in_progress", "read", "dnf"].includes(s)) return "wishlist";
  return s;
}

function readingStatusLabel(id) {
  return READING_STATUSES.find((x) => x.id === id)?.label || id;
}

function ensureDefaultUserShelf(state) {
  if (!Array.isArray(state.userShelves)) state.userShelves = [];
  let def = state.userShelves.find((s) => s.isDefault);
  if (!def) {
    if (state.userShelves.length === 0) {
      const now = new Date().toISOString();
      state.userShelves.push({
        id: uuid(),
        name: DEFAULT_USER_SHELF_NAME,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      state.userShelves[0].isDefault = true;
      if (!String(state.userShelves[0].name || "").trim()) {
        state.userShelves[0].name = DEFAULT_USER_SHELF_NAME;
      }
    }
  }
  const defaults = state.userShelves.filter((s) => s.isDefault);
  if (defaults.length > 1) {
    defaults.slice(1).forEach((s) => {
      const row = state.userShelves.find((x) => x.id === s.id);
      if (row) row.isDefault = false;
    });
  }
}

function getDefaultShelfId(state) {
  return state.userShelves.find((s) => s.isDefault)?.id || state.userShelves[0]?.id;
}

function assignBookUserShelfIds(state) {
  const defaultId = getDefaultShelfId(state);
  if (!defaultId) return;
  for (const b of state.books) {
    if (!b.userShelfId || !state.userShelves.some((s) => s.id === b.userShelfId)) {
      b.userShelfId = defaultId;
    }
  }
}

function finalizeUserShelvesAndBooks(state) {
  ensureDefaultUserShelf(state);
  state.books = state.books.map((b) => normalizeBook(b));
  assignBookUserShelfIds(state);
}

function sortedUserShelves(state) {
  const list = [...(state.userShelves || [])];
  list.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  });
  return list;
}

function countCustomUserShelves(state) {
  return (state.userShelves || []).filter((s) => !s.isDefault).length;
}

function userShelfName(state, shelfId) {
  const s = state.userShelves.find((x) => x.id === shelfId);
  return s?.name || "Shelf";
}

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

function isUuidString(value) {
  const s = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!s || s === "null" || s === "undefined") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Valid v4 UUID for Postgres `uuid` columns (avoids `id-…` fallback ids from `uuid()`). */
function newUuidV4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  let readingStatus = b.readingStatus ?? b.reading_status;
  const legacyShelf = b.shelf;
  if (!readingStatus && legacyShelf) {
    readingStatus = legacyShelf === "owned" ? "wishlist" : legacyShelf;
  }
  if (!["wishlist", "in_progress", "read", "dnf"].includes(readingStatus)) {
    readingStatus = "wishlist";
  }
  const userShelfId = b.userShelfId ?? b.user_shelf_id ?? null;
  let rating = b.rating ?? null;
  if (rating === "frown") rating = "not_good";
  else if (rating === "meh") rating = "okay";
  else if (rating === "smile") rating = b.favorite ? "great" : "good";
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    type: b.type || "physical",
    tags: Array.isArray(b.tags) ? b.tags : [],
    recommendedBy: b.recommendedBy ?? b.recommended_by ?? "",
    userShelfId,
    readingStatus,
    ownership: b.ownership === "borrowed" ? "borrowed" : "owned",
    seriesId: b.seriesId ?? b.series_id ?? null,
    volumeInSeries: b.volumeInSeries ?? b.volume_in_series ?? null,
    rating,
    favorite: !!b.favorite,
    readAt: b.readAt ?? b.read_at ?? null,
    readDateUnknown: !!(b.readDateUnknown || b.read_date_unknown),
    createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
    updatedAt: b.updatedAt ?? b.updated_at ?? new Date().toISOString(),
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
      const out = {
        books: Array.isArray(data.books) ? data.books : [],
        series: Array.isArray(data.series) ? data.series : [],
        userShelves: Array.isArray(data.userShelves) ? data.userShelves : [],
        goals: normalizeGoalsFromStorage(data.goals),
        goalsHistory: gh,
        hiddenTagSuggestions: hiddenTags,
        wantList,
        hiddenSeriesIds,
      };
      finalizeUserShelvesAndBooks(out);
      return out;
    }
  } catch (_) {}
  const empty = {
    books: [],
    series: [],
    userShelves: [],
    goals: [],
    goalsHistory: [],
    hiddenTagSuggestions: [],
    wantList: [],
    hiddenSeriesIds: [],
  };
  finalizeUserShelvesAndBooks(empty);
  return empty;
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
  const out = {
    books: Array.isArray(data?.books) ? data.books : [],
    series: Array.isArray(data?.series) ? data.series : [],
    userShelves: Array.isArray(data?.userShelves) ? data.userShelves : [],
    goals: normalizeGoalsFromStorage(data?.goals),
    goalsHistory: gh,
    hiddenTagSuggestions: hiddenTags,
    wantList,
    hiddenSeriesIds,
  };
  finalizeUserShelvesAndBooks(out);
  return out;
}

function saveState(state) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      books: state.books,
      series: state.series,
      userShelves: state.userShelves || [],
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
    if (readingStatusOf(b) !== "read" || !readDateInPeriod(b.readAt, period)) return false;
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
    if (readingStatusOf(b) !== "read") return false;
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
  const readCount = volumes.filter((b) => readingStatusOf(b) === "read").length;
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

function filterBooks(books, { userShelfId, readingStatusFilter, q, type, favoritesOnly, ownership }) {
  let list = books;
  if (userShelfId) list = list.filter((b) => b.userShelfId === userShelfId);
  if (readingStatusFilter) list = list.filter((b) => readingStatusOf(b) === readingStatusFilter);
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

function amazonSearchUrl(title, author, mode) {
  const t = String(title || "").trim();
  const a = String(author || "").trim();
  const suffix = mode === "audiobook" ? " audiobook" : " book";
  const query = `${t}${a ? ` ${a}` : ""}${suffix}`.trim();
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

// --- DOM ---
const els = {
  shelfList: document.getElementById("shelf-list"),
  shelfActiveHeading: document.getElementById("shelf-active-heading"),
  newShelfName: document.getElementById("new-shelf-name"),
  btnAddUserShelf: document.getElementById("btn-add-user-shelf"),
  filterReadingStatus: document.getElementById("filter-reading-status"),
  bookList: document.getElementById("book-list"),
  listEmpty: document.getElementById("list-empty"),
  search: document.getElementById("search-books"),
  sort: document.getElementById("sort-books"),
  filterType: document.getElementById("filter-type"),
  filterOwnership: document.getElementById("filter-ownership"),
  filterFavorites: document.getElementById("filter-favorites"),
  btnAdd: document.getElementById("btn-add-book"),
  authGate: document.getElementById("auth-gate"),
  appShell: document.getElementById("app-shell"),
  supabaseUrl: document.getElementById("supabase-url"),
  supabaseAnonKey: document.getElementById("supabase-anon-key"),
  btnSaveSupabaseConfig: document.getElementById("btn-save-supabase-config"),
  profileSupabaseUrl: document.getElementById("profile-supabase-url"),
  profileSupabaseAnonKey: document.getElementById("profile-supabase-anon-key"),
  btnSaveSupabaseConfigProfile: document.getElementById("btn-save-supabase-config-profile"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  btnSignIn: document.getElementById("btn-sign-in"),
  btnSignUp: document.getElementById("btn-sign-up"),
  btnSignOut: document.getElementById("btn-sign-out"),
  authStatus: document.getElementById("auth-status"),
  profileEmail: document.getElementById("profile-email"),
  profileAuthStatus: document.getElementById("profile-auth-status"),
  btnProfileToggle: document.getElementById("btn-profile-toggle"),
  profileMenu: document.getElementById("profile-menu"),
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
  bookUserShelf: document.getElementById("book-user-shelf"),
  bookReadingStatus: document.getElementById("book-reading-status"),
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
};

let state = loadState();
if (!state.goalsHistory) state.goalsHistory = [];
if (!state.hiddenTagSuggestions) state.hiddenTagSuggestions = [];
if (!state.wantList) state.wantList = [];
if (!state.hiddenSeriesIds) state.hiddenSeriesIds = [];
if (!state.userShelves) state.userShelves = [];
let activeUserShelfId = getDefaultShelfId(state) || null;
/** Right column: library | want_list | series */
let activeMainView = "library";
let pendingRateBookId = null;
let selectedRating = null;
let tagSuggestBlurTimer = null;
let wantTagSuggestBlurTimer = null;
let pendingWantListAdoptId = null;
let pendingSeriesHideId = null;
const expandedBookIds = new Set();
let sbClient = null;
let sbSession = null;
let sbUserId = null;
let cloudSyncTimer = null;
let isCloudLoading = false;
let supabaseAuthListenerAttached = false;
/** Set when cloud state has been loaded successfully for the current access token (avoids skipping retry after a failed load). */
let cloudHydratedAccessToken = null;

function persist() {
  saveState(state);
  scheduleCloudSync();
}

function getSupabaseConfig() {
  const url = (localStorage.getItem(SUPABASE_URL_KEY) || DEFAULT_SUPABASE_URL).trim();
  const anonKey = (localStorage.getItem(SUPABASE_ANON_KEY_KEY) || "").trim();
  return { url, anonKey };
}

function setAuthStatus(message, isError) {
  const color = isError ? "var(--danger)" : "var(--text-muted)";
  if (els.authStatus) {
    els.authStatus.textContent = message;
    els.authStatus.style.color = color;
  }
  if (els.profileAuthStatus) {
    els.profileAuthStatus.textContent = message;
    els.profileAuthStatus.style.color = color;
  }
}

function syncSupabaseFormFields(url, anonKey) {
  const u = url ?? "";
  const a = anonKey ?? "";
  if (els.supabaseUrl) els.supabaseUrl.value = u;
  if (els.supabaseAnonKey) els.supabaseAnonKey.value = a;
  if (els.profileSupabaseUrl) els.profileSupabaseUrl.value = u;
  if (els.profileSupabaseAnonKey) els.profileSupabaseAnonKey.value = a;
}

function readSupabaseFormForSave() {
  if (sbUserId && els.profileSupabaseUrl) {
    return {
      url: (els.profileSupabaseUrl.value || "").trim(),
      anon: (els.profileSupabaseAnonKey.value || "").trim(),
    };
  }
  return {
    url: (els.supabaseUrl?.value || "").trim(),
    anon: (els.supabaseAnonKey?.value || "").trim(),
  };
}

function updateShellForAuth() {
  const signedIn = !!sbUserId;
  const skip = document.querySelector(".skip-link");
  if (skip) skip.setAttribute("href", signedIn ? "#main" : "#auth-gate-inner");
  if (els.authGate) els.authGate.classList.toggle("hidden", signedIn);
  if (els.appShell) els.appShell.classList.toggle("hidden", !signedIn);
  if (els.btnProfileToggle) els.btnProfileToggle.classList.toggle("hidden", !signedIn);
  if (signedIn && els.profileEmail) {
    els.profileEmail.textContent = sbSession?.user?.email || "";
  }
}

function hasSupabaseSdk() {
  return typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function";
}

function initSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  syncSupabaseFormFields(url, anonKey);
  if (!hasSupabaseSdk()) {
    setAuthStatus("Supabase SDK did not load.", true);
    return null;
  }
  if (!url || !anonKey) {
    return null;
  }
  try {
    sbClient = window.supabase.createClient(url, anonKey);
    supabaseAuthListenerAttached = false;
    return sbClient;
  } catch (_) {
    setAuthStatus("Could not initialize Supabase client.", true);
    return null;
  }
}

/** If the connection fields on the auth gate are filled, persist them so the client can be created. */
function persistAuthGateSupabaseToStorageIfFilled() {
  const formUrl = (els.supabaseUrl?.value || "").trim();
  const formAnon = (els.supabaseAnonKey?.value || "").trim();
  if (formUrl && formAnon) {
    localStorage.setItem(SUPABASE_URL_KEY, formUrl);
    localStorage.setItem(SUPABASE_ANON_KEY_KEY, formAnon);
    syncSupabaseFormFields(formUrl, formAnon);
  }
}

function attachSupabaseAuthListenerIfNeeded() {
  if (!sbClient || supabaseAuthListenerAttached) return;
  supabaseAuthListenerAttached = true;
  sbClient.auth.onAuthStateChange((_event, session) => {
    void enqueueHandleSession(session);
  });
}

/** Use stored config and/or values typed on the auth gate; attach auth listener. */
function ensureSupabaseClientForAuth() {
  if (!hasSupabaseSdk()) {
    setAuthStatus("Supabase SDK did not load. Check your network.", true);
    return false;
  }
  persistAuthGateSupabaseToStorageIfFilled();
  if (!sbClient && !initSupabaseClient()) {
    setAuthStatus("Enter your Supabase URL and anon key (both required), then try again.", true);
    return false;
  }
  attachSupabaseAuthListenerIfNeeded();
  return true;
}

function localStateHasContent(x) {
  return (
    (x.books?.length || 0) +
    (x.series?.length || 0) +
    (x.wantList?.length || 0) +
    (x.goals?.length || 0) +
    (x.goalsHistory?.length || 0)
  ) > 0;
}

function mapStateToSupabasePayload(userId, s) {
  const shelfRemap = new Map();
  const rawShelves = [...(s.userShelves || [])];
  const shelvesWithIds = rawShelves.map((row) => {
    const rawId = row.id != null ? String(row.id).trim() : "";
    if (isUuidString(rawId)) return { row, id: rawId };
    const newId = newUuidV4();
    const oldKey = row.id != null ? String(row.id).trim() : "";
    if (oldKey) shelfRemap.set(oldKey, newId);
    return { row, id: newId };
  });

  let defaultSeen = false;
  const userShelves = shelvesWithIds.map(({ row, id }) => {
    let isDef = !!row.isDefault;
    if (isDef) {
      if (defaultSeen) isDef = false;
      else defaultSeen = true;
    }
    return {
      id,
      user_id: userId,
      name: String(row.name || "").trim() || DEFAULT_USER_SHELF_NAME,
      is_default: isDef,
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: row.updatedAt || new Date().toISOString(),
    };
  });
  if (userShelves.length && !userShelves.some((x) => x.is_default)) {
    userShelves.forEach((sh, i) => {
      sh.is_default = i === 0;
    });
  }

  const userShelfIds = new Set(userShelves.map((x) => x.id));

  const goalIds = new Set((s.goals || []).map((g) => g.id).filter(isUuidString));
  const seriesIds = new Set((s.series || []).map((x) => x.id).filter(isUuidString));

  const resolveShelfId = (raw) => {
    if (raw == null) return null;
    const ks = String(raw).trim();
    if (!ks) return null;
    return shelfRemap.has(ks) ? shelfRemap.get(ks) : ks;
  };

  const defaultShelfId = userShelves.find((x) => x.is_default)?.id ?? userShelves[0]?.id ?? null;

  const books = (s.books || []).map((b) => {
    let sid = resolveShelfId(b.userShelfId);
    if (sid && !userShelfIds.has(sid)) sid = null;
    const userShelfKey = sid || (defaultShelfId && userShelfIds.has(defaultShelfId) ? defaultShelfId : null);
    return {
      id: b.id,
      user_id: userId,
      title: b.title || "",
      author: b.author || "",
      type: b.type || "physical",
      user_shelf_id: userShelfKey && userShelfIds.has(userShelfKey) ? userShelfKey : null,
      reading_status: readingStatusOf(b),
      ownership: b.ownership || "owned",
      tags: b.tags || [],
      recommended_by: b.recommendedBy || "",
      series_id: b.seriesId && seriesIds.has(b.seriesId) ? b.seriesId : null,
      volume_in_series: b.volumeInSeries ?? null,
      rating: b.rating || null,
      favorite: !!b.favorite,
      read_at: b.readAt || null,
      read_date_unknown: !!b.readDateUnknown,
      created_at: b.createdAt || new Date().toISOString(),
      updated_at: b.updatedAt || new Date().toISOString(),
    };
  });
  const series = (s.series || []).map((x) => ({
    id: x.id,
    user_id: userId,
    name: x.name || "",
    expected_total: x.expectedTotal ?? null,
    publishing_incomplete: !!x.publishingIncomplete,
    hidden: (s.hiddenSeriesIds || []).includes(x.id),
    created_at: x.createdAt || new Date().toISOString(),
    updated_at: x.updatedAt || new Date().toISOString(),
  }));
  const wantList = (s.wantList || []).map((w) => ({
    id: w.id,
    user_id: userId,
    title: w.title || "",
    author: w.author || "",
    notes: w.notes || "",
    tags: w.tags || [],
    recommended_by: w.recommendedBy || "",
    created_at: w.createdAt || new Date().toISOString(),
    updated_at: w.updatedAt || new Date().toISOString(),
  }));
  const goals = (s.goals || []).map((g) => ({
    id: g.id,
    user_id: userId,
    period: g.period,
    target: g.target,
    exclude_audiobooks: !!g.excludeAudiobooks,
    current_period_key: g.currentPeriodKey || null,
    created_at: g.createdAt || new Date().toISOString(),
    updated_at: g.updatedAt || new Date().toISOString(),
  }));
  const goalsHistory = (s.goalsHistory || []).map((h) => ({
    id: h.id,
    user_id: userId,
    source_goal_id: h.sourceGoalId && goalIds.has(h.sourceGoalId) ? h.sourceGoalId : null,
    period: h.period,
    period_key: h.periodKey,
    target: h.target,
    exclude_audiobooks: !!h.excludeAudiobooks,
    finished_count: h.finishedCount || 0,
    archived_at: h.archivedAt || new Date().toISOString(),
    reason: h.reason || "period_rollover",
  }));
  const userSettings = {
    user_id: userId,
    theme: localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light",
    hidden_tag_suggestions: s.hiddenTagSuggestions || [],
    hidden_series_ids: (s.hiddenSeriesIds || []).filter(isUuidString),
    last_export_at: localStorage.getItem(LAST_EXPORT_AT_KEY) || null,
    export_reminder_dismissed_at: localStorage.getItem(EXPORT_REMINDER_DISMISSED_AT_KEY) || null,
  };
  return { books, series, userShelves, wantList, goals, goalsHistory, userSettings };
}

function mapSupabaseRowsToState(rows) {
  const out = {
    books: [],
    series: [],
    userShelves: [],
    goals: [],
    goalsHistory: [],
    hiddenTagSuggestions: [],
    wantList: [],
    hiddenSeriesIds: [],
  };
  out.userShelves = (rows.userShelves || []).map((r) => ({
    id: r.id,
    name: r.name || DEFAULT_USER_SHELF_NAME,
    isDefault: !!r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  out.books = (rows.books || []).map((b) =>
    normalizeBook({
      id: b.id,
      title: b.title,
      author: b.author,
      type: b.type,
      shelf: b.shelf,
      reading_status: b.reading_status,
      user_shelf_id: b.user_shelf_id,
      ownership: b.ownership,
      tags: b.tags || [],
      recommendedBy: b.recommended_by || "",
      seriesId: b.series_id,
      volumeInSeries: b.volume_in_series,
      rating: b.rating,
      favorite: !!b.favorite,
      readAt: b.read_at,
      readDateUnknown: !!b.read_date_unknown,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    })
  );
  out.series = (rows.series || []).map((s) => ({
    id: s.id,
    name: s.name,
    expectedTotal: s.expected_total,
    publishingIncomplete: !!s.publishing_incomplete,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));
  out.wantList = (rows.wantList || []).map((w) =>
    normalizeWantItem({
      id: w.id,
      title: w.title,
      author: w.author,
      notes: w.notes,
      tags: w.tags || [],
      recommendedBy: w.recommended_by || "",
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    })
  );
  out.goals = (rows.goals || []).map((g) => ({
    id: g.id,
    period: g.period,
    target: g.target,
    excludeAudiobooks: !!g.exclude_audiobooks,
    currentPeriodKey: g.current_period_key || null,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  }));
  out.goalsHistory = (rows.goalsHistory || []).map((h) => ({
    id: h.id,
    sourceGoalId: h.source_goal_id || null,
    period: h.period,
    periodKey: h.period_key,
    target: h.target,
    excludeAudiobooks: !!h.exclude_audiobooks,
    finishedCount: h.finished_count || 0,
    archivedAt: h.archived_at,
    reason: h.reason || "period_rollover",
  }));
  const settings = rows.userSettings;
  out.hiddenTagSuggestions = settings?.hidden_tag_suggestions || [];
  out.hiddenSeriesIds = settings?.hidden_series_ids || [];
  out.theme = settings?.theme || null;
  finalizeUserShelvesAndBooks(out);
  return out;
}

function isCloudStateEmpty(x) {
  return !localStateHasContent(x);
}

/** Human-readable Supabase / network error for status line + console. */
function describeLoadError(err) {
  if (err == null) return "";
  if (typeof err === "string") return err;
  const code = err.code ? `${err.code}: ` : "";
  const msg = err.message || String(err);
  const details = err.details ? ` ${err.details}` : "";
  const hint = err.hint ? ` — ${err.hint}` : "";
  const s = `${code}${msg}${details}${hint}`.trim();
  return s || "Unknown error.";
}

async function loadStateFromSupabase(userId) {
  const uid = String(userId || "").trim();
  if (!isUuidString(uid)) {
    throw new Error("Invalid account id for cloud load. Sign out and sign in again.");
  }
  const [booksR, seriesR, shelvesR, wantR, goalsR, goalsHistR, settingsR] = await Promise.all([
    sbClient.from("books").select("*").eq("user_id", uid),
    sbClient.from("series").select("*").eq("user_id", uid),
    sbClient.from("user_shelves").select("*").eq("user_id", uid),
    sbClient.from("want_list").select("*").eq("user_id", uid),
    sbClient.from("goals").select("*").eq("user_id", uid),
    sbClient.from("goals_history").select("*").eq("user_id", uid),
    sbClient.from("user_settings").select("*").eq("user_id", uid).limit(1),
  ]);
  const err =
    booksR.error || seriesR.error || shelvesR.error || wantR.error || goalsR.error || goalsHistR.error || settingsR.error;
  if (err) throw err;
  const settingsRow = Array.isArray(settingsR.data) && settingsR.data.length ? settingsR.data[0] : null;
  return mapSupabaseRowsToState({
    books: booksR.data || [],
    series: seriesR.data || [],
    userShelves: shelvesR.data || [],
    wantList: wantR.data || [],
    goals: goalsR.data || [],
    goalsHistory: goalsHistR.data || [],
    userSettings: settingsRow,
  });
}

async function ensureSupabaseSessionForWrite() {
  if (!sbClient) throw new Error("Not connected to Supabase.");
  const { data: sess, error } = await sbClient.auth.getSession();
  if (!error && sess?.session?.access_token) return;
  const { data: ref, error: refErr } = await sbClient.auth.refreshSession();
  if (refErr || !ref?.session?.access_token) {
    throw new Error("Session expired. Sign in again to sync.");
  }
}

async function replaceTableByUser(table, userId, rows) {
  const uid = String(userId || "").trim();
  if (!isUuidString(uid)) throw new Error("Invalid user id for sync.");
  const del = await sbClient.from(table).delete().eq("user_id", uid);
  if (del.error) throw del.error;
  if (!rows.length) return;
  const ins = await sbClient.from(table).insert(rows);
  if (ins.error) throw ins.error;
}

async function saveStateToSupabase(userId, snapshot) {
  const uid = String(userId || "").trim();
  if (!isUuidString(uid)) throw new Error("Invalid user id for sync.");
  await ensureSupabaseSessionForWrite();
  const payload = mapStateToSupabasePayload(uid, snapshot);
  const delB = await sbClient.from("books").delete().eq("user_id", uid);
  if (delB.error) throw delB.error;
  const delSh = await sbClient.from("user_shelves").delete().eq("user_id", uid);
  if (delSh.error) throw delSh.error;
  const delS = await sbClient.from("series").delete().eq("user_id", uid);
  if (delS.error) throw delS.error;
  if (payload.userShelves.length) {
    const insSh = await sbClient.from("user_shelves").insert(payload.userShelves);
    if (insSh.error) throw insSh.error;
  }
  if (payload.series.length) {
    const insS = await sbClient.from("series").insert(payload.series);
    if (insS.error) throw insS.error;
  }
  if (payload.books.length) {
    const insB = await sbClient.from("books").insert(payload.books);
    if (insB.error) throw insB.error;
  }
  await replaceTableByUser("want_list", uid, payload.wantList);
  await replaceTableByUser("goals", uid, payload.goals);
  await replaceTableByUser("goals_history", uid, payload.goalsHistory);
  const setRes = await sbClient.from("user_settings").upsert(payload.userSettings);
  if (setRes.error) throw setRes.error;
}

function scheduleCloudSync() {
  if (!sbClient || !sbUserId || isCloudLoading) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(async () => {
    try {
      const snapshot = JSON.parse(JSON.stringify(state));
      await saveStateToSupabase(sbUserId, snapshot);
      setAuthStatus(`Signed in. Synced ${new Date().toLocaleTimeString()}.`, false);
    } catch (err) {
      console.error("Cloud sync failed:", err);
      const detail = err?.message || err?.details || "";
      setAuthStatus(detail ? `Cloud sync failed: ${detail}` : "Signed in, but cloud sync failed.", true);
    }
  }, 700);
}

function migrationKeyForUser(userId) {
  return `${SUPABASE_MIGRATED_PREFIX}${userId}`;
}

/** Serialize auth handling so concurrent onAuthStateChange + signIn callbacks don’t clobber session state. */
let handleSessionChain = Promise.resolve();
function enqueueHandleSession(session) {
  handleSessionChain = handleSessionChain
    .then(() => runHandleSession(session))
    .catch((err) => console.error("Auth session handler:", err));
  return handleSessionChain;
}

async function runHandleSession(session) {
  const incomingUid = session?.user?.id ?? null;
  const incomingTok = session?.access_token ?? null;
  if (incomingUid && incomingTok && sbUserId === incomingUid && cloudHydratedAccessToken != null) {
    sbSession = session;
    cloudHydratedAccessToken = incomingTok;
    return;
  }
  sbSession = session || null;
  sbUserId = incomingUid || null;
  if (!sbUserId) {
    cloudHydratedAccessToken = null;
    state = loadState();
    if (!state.goalsHistory) state.goalsHistory = [];
    if (!state.hiddenTagSuggestions) state.hiddenTagSuggestions = [];
    if (!state.wantList) state.wantList = [];
    if (!state.hiddenSeriesIds) state.hiddenSeriesIds = [];
    const { url, anonKey } = getSupabaseConfig();
    if (!hasSupabaseSdk()) {
      setAuthStatus("Supabase SDK did not load. Check your network.", true);
    } else if (!url || !anonKey) {
      setAuthStatus("Enter your Supabase URL and anon key, then save connection.", false);
    } else {
      setAuthStatus("Sign in or create an account to continue.", false);
    }
    activeUserShelfId = getDefaultShelfId(state) || null;
    renderAll();
    updateShellForAuth();
    toggleProfileMenu(false);
    toggleSettingsMenu(false);
    return;
  }
  try {
    isCloudLoading = true;
    setAuthStatus("Loading your library…", false);
    if (session) sbSession = session;

    let authUserData;
    let userErr;
    ({ data: authUserData, error: userErr } = await sbClient.auth.getUser());
    if (userErr) {
      const em = String(userErr.message || userErr.code || "").toLowerCase();
      if (
        em.includes("session") ||
        em.includes("jwt") ||
        userErr.name === "AuthSessionMissingError" ||
        userErr.status === 403
      ) {
        const { data: ref, error: refErr } = await sbClient.auth.refreshSession();
        if (!refErr && ref?.session) {
          sbSession = ref.session;
          ({ data: authUserData, error: userErr } = await sbClient.auth.getUser());
        }
      }
    }
    if (userErr) throw userErr;
    const rawUserId = authUserData?.user?.id;
    const cloudUserId = rawUserId != null ? String(rawUserId).trim() : "";
    if (!isUuidString(cloudUserId)) {
      throw new Error("Could not read your account id after sign-in. Sign out and try again.");
    }
    sbUserId = cloudUserId;

    const localSnapshot = JSON.parse(JSON.stringify(state));
    const cloudState = await loadStateFromSupabase(cloudUserId);
    const migratedKey = migrationKeyForUser(cloudUserId);
    const hasMigrated = localStorage.getItem(migratedKey) === "1";
    if (!hasMigrated && isCloudStateEmpty(cloudState) && localStateHasContent(localSnapshot)) {
      const ok = confirm("Import your current local data to this account now?");
      if (ok) {
        await saveStateToSupabase(cloudUserId, localSnapshot);
        localStorage.setItem(migratedKey, "1");
        state = localSnapshot;
      } else {
        localStorage.setItem(migratedKey, "1");
        state = cloudState;
      }
    } else {
      state = cloudState;
    }
    if (!state.goalsHistory) state.goalsHistory = [];
    if (!state.hiddenTagSuggestions) state.hiddenTagSuggestions = [];
    if (!state.wantList) state.wantList = [];
    if (!state.hiddenSeriesIds) state.hiddenSeriesIds = [];
    if (!state.userShelves) state.userShelves = [];
    finalizeUserShelvesAndBooks(state);
    activeUserShelfId = getDefaultShelfId(state) || null;
    if (state.theme) applyTheme(state.theme);
    renderAll();
    setAuthStatus(`Signed in as ${sbSession.user.email || "user"}.`, false);
    cloudHydratedAccessToken = sbSession?.access_token ?? null;
  } catch (err) {
    console.error("Cloud load failed:", err);
    const detail = describeLoadError(err);
    setAuthStatus(
      detail
        ? `Couldn’t load cloud data: ${detail}`
        : "Signed in, but failed loading cloud data. Check the browser console and your Supabase project (tables + RLS).",
      true
    );
    renderAll();
  } finally {
    isCloudLoading = false;
    updateShellForAuth();
  }
}

async function initSupabaseAuth() {
  initSupabaseClient();
  if (!sbClient) {
    await enqueueHandleSession(null);
    return;
  }
  attachSupabaseAuthListenerIfNeeded();
  const { data: bootSess } = await sbClient.auth.getSession();
  if (bootSess?.session?.user) {
    void enqueueHandleSession(bootSess.session);
  }
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
      userShelves: state.userShelves || [],
      goals: state.goals || [],
      goalsHistory: state.goalsHistory || [],
      hiddenTagSuggestions: state.hiddenTagSuggestions || [],
      wantList: state.wantList || [],
      hiddenSeriesIds: state.hiddenSeriesIds || [],
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
  if (shouldOpen) toggleProfileMenu(false);
  els.settingsMenu.classList.toggle("hidden", !shouldOpen);
  els.btnSettingsToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function toggleProfileMenu(force) {
  if (!els.profileMenu || !els.btnProfileToggle) return;
  const shouldOpen =
    typeof force === "boolean" ? force : els.profileMenu.classList.contains("hidden");
  if (shouldOpen) toggleSettingsMenu(false);
  els.profileMenu.classList.toggle("hidden", !shouldOpen);
  els.btnProfileToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
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

function initSortAndFilters() {
  els.sort.innerHTML = SORT_OPTIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
  if (els.filterReadingStatus) {
    els.filterReadingStatus.innerHTML =
      `<option value="">All statuses</option>` +
      READING_STATUSES.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  }
}

function fillBookShelfFormSelects() {
  if (!els.bookUserShelf || !els.bookReadingStatus) return;
  els.bookUserShelf.innerHTML = "";
  for (const s of sortedUserShelves(state)) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    els.bookUserShelf.appendChild(opt);
  }
  els.bookReadingStatus.innerHTML = READING_STATUSES.map(
    (x) => `<option value="${x.id}">${x.label}</option>`
  ).join("");
}

function updateShelfActiveHeading() {
  if (!els.shelfActiveHeading) return;
  if (activeUserShelfId === null) {
    els.shelfActiveHeading.textContent = "All books";
  } else {
    els.shelfActiveHeading.textContent = userShelfName(state, activeUserShelfId);
  }
}

function validateActiveUserShelfSelection() {
  if (activeUserShelfId != null && !state.userShelves.some((s) => s.id === activeUserShelfId)) {
    activeUserShelfId = getDefaultShelfId(state) || null;
  }
}

function setMainView(view) {
  if (view !== "library" && view !== "want_list" && view !== "series") return;
  activeMainView = view;
  renderAll();
}

function updateMainViewPanes() {
  const lib = document.getElementById("pane-library");
  const want = document.getElementById("pane-want");
  const series = document.getElementById("pane-series");
  if (lib) lib.classList.toggle("hidden", activeMainView !== "library");
  if (want) want.classList.toggle("hidden", activeMainView !== "want_list");
  if (series) series.classList.toggle("hidden", activeMainView !== "series");

  document.querySelectorAll(".nav-rail-card[data-main-view]").forEach((btn) => {
    const v = btn.dataset.mainView;
    const on = v === activeMainView;
    btn.classList.toggle("nav-rail-card--active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function renderShelfSidebar() {
  if (!els.shelfList) return;
  els.shelfList.innerHTML = "";

  const libActive = activeMainView === "library";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "shelf-row" + (libActive && activeUserShelfId === null ? " shelf-row--active" : "");
  allBtn.setAttribute("role", "listitem");
  allBtn.textContent = "All books";
  allBtn.addEventListener("click", () => {
    activeMainView = "library";
    activeUserShelfId = null;
    renderAll();
  });
  els.shelfList.appendChild(allBtn);

  for (const s of sortedUserShelves(state)) {
    const row = document.createElement("div");
    row.className = "shelf-row-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shelf-row" + (libActive && activeUserShelfId === s.id ? " shelf-row--active" : "");
    btn.setAttribute("role", "listitem");
    const count = state.books.filter((b) => b.userShelfId === s.id).length;
    btn.textContent = count ? `${s.name} (${count})` : s.name;
    btn.addEventListener("click", () => {
      activeMainView = "library";
      activeUserShelfId = s.id;
      renderAll();
    });

    const ren = document.createElement("button");
    ren.type = "button";
    ren.className = "shelf-row-action";
    ren.textContent = "✎";
    ren.setAttribute("aria-label", `Rename ${s.name}`);
    ren.addEventListener("click", (e) => {
      e.stopPropagation();
      renameUserShelfPrompt(s.id);
    });

    row.appendChild(btn);
    row.appendChild(ren);

    if (!s.isDefault) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "shelf-row-action shelf-row-action--danger";
      del.setAttribute("aria-label", `Remove ${s.name}`);
      del.textContent = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        removeUserShelfById(s.id);
      });
      row.appendChild(del);
    }

    els.shelfList.appendChild(row);
  }

  if (els.btnAddUserShelf) {
    els.btnAddUserShelf.disabled = countCustomUserShelves(state) >= MAX_CUSTOM_USER_SHELVES;
  }
}

function addUserShelfFromInput() {
  const name = (els.newShelfName?.value || "").trim();
  if (!name) {
    alert("Enter a name for the new shelf.");
    return;
  }
  if (countCustomUserShelves(state) >= MAX_CUSTOM_USER_SHELVES) {
    alert(
      `You can add at most ${MAX_CUSTOM_USER_SHELVES} custom shelves in addition to ${DEFAULT_USER_SHELF_NAME}.`
    );
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id: uuid(),
    name,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  state.userShelves.push(row);
  els.newShelfName.value = "";
  activeMainView = "library";
  activeUserShelfId = row.id;
  persist();
  renderAll();
}

function removeUserShelfById(shelfId) {
  const s = state.userShelves.find((x) => x.id === shelfId);
  if (!s || s.isDefault) return;
  const defaultId = getDefaultShelfId(state);
  if (!defaultId) return;
  const defaultName = state.userShelves.find((x) => x.id === defaultId)?.name || DEFAULT_USER_SHELF_NAME;
  if (!confirm(`Remove shelf “${s.name}”? Books on this shelf move to “${defaultName}”.`)) {
    return;
  }
  for (const b of state.books) {
    if (b.userShelfId === shelfId) b.userShelfId = defaultId;
  }
  state.userShelves = state.userShelves.filter((x) => x.id !== shelfId);
  if (activeUserShelfId === shelfId) activeUserShelfId = defaultId;
  persist();
  renderAll();
}

function renameUserShelfPrompt(shelfId) {
  const s = state.userShelves.find((x) => x.id === shelfId);
  if (!s) return;
  const name = window.prompt("Shelf name", s.name);
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  s.name = trimmed;
  s.updatedAt = new Date().toISOString();
  persist();
  renderAll();
}

function renderBookList() {
  const q = els.search.value;
  const sortId = els.sort.value;
  const type = els.filterType.value;
  const ownership = els.filterOwnership.value;
  const favoritesOnly = els.filterFavorites.checked;
  const readingStatusFilter = els.filterReadingStatus?.value || "";

  let list = filterBooks(state.books, {
    userShelfId: activeUserShelfId,
    readingStatusFilter,
    q,
    type,
    favoritesOnly,
    ownership,
  });
  list = sortBooks(list, sortId);

  els.listEmpty.classList.toggle("hidden", list.length > 0);
  els.bookList.innerHTML = "";

  for (const b of list) {
    const li = document.createElement("li");
    li.className = "book-card";

    const rs = readingStatusOf(b);
    const spine = document.createElement("span");
    spine.className = `book-card-spine book-card-spine--${rs}`;
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
    const shelfBit = activeUserShelfId == null ? ` · ${userShelfName(state, b.userShelfId)}` : "";
    meta.textContent = `${b.author} · ${typeLabel(b.type)} · ${ownershipLabel(b.ownership)} · ${readingStatusLabel(rs)}${shelfBit}`;

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

    const detailsWrap = document.createElement("div");
    detailsWrap.className = "book-card-details";
    const isExpanded = expandedBookIds.has(b.id);
    if (!isExpanded) detailsWrap.classList.add("hidden");
    detailsWrap.appendChild(tagsRow);

    if (b.seriesId) {
      const sMeta = state.series.find((s) => s.id === b.seriesId);
      const sb = document.createElement("p");
      sb.className = "series-badge";
      const vol = b.volumeInSeries != null ? `Vol. ${b.volumeInSeries}` : "Series";
      sb.textContent = sMeta ? `${sMeta.name} · ${vol}` : vol;
      detailsWrap.appendChild(sb);
    }

    if (readingStatusOf(b) === "read") {
      if (b.rating) {
        const rating = document.createElement("p");
        rating.className = "series-badge";
        if (b.rating === "terrible") rating.textContent = "Rating: Terrible";
        else if (b.rating === "not_good") rating.textContent = "Rating: Not good";
        else if (b.rating === "okay") rating.textContent = "Rating: Okay";
        else if (b.rating === "good") rating.textContent = "Rating: Good";
        else if (b.rating === "great") rating.textContent = "Rating: Great";
        detailsWrap.appendChild(rating);
      }
      if (!b.readDateUnknown && b.readAt) {
        const finished = document.createElement("p");
        finished.className = "series-badge";
        const dt = new Date(b.readAt);
        if (!Number.isNaN(dt.getTime())) {
          finished.textContent = `Finished: ${dt.toLocaleDateString()}`;
          detailsWrap.appendChild(finished);
        }
      }
    }
    body.appendChild(detailsWrap);

    const actions = document.createElement("div");
    actions.className = "book-card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openBookModal(b.id));

    const detailsBtn = document.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.className = "btn-small btn-caret-toggle";
    detailsBtn.textContent = isExpanded ? "▾" : "▸";
    detailsBtn.setAttribute("aria-label", isExpanded ? "Collapse details" : "Expand details");
    detailsBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    detailsBtn.addEventListener("click", () => {
      if (expandedBookIds.has(b.id)) expandedBookIds.delete(b.id);
      else expandedBookIds.add(b.id);
      renderBookList();
    });

    const statusQuick = document.createElement("select");
    statusQuick.className = "select select-shelf-quick";
    statusQuick.setAttribute("aria-label", "Reading status");
    for (const s of READING_STATUSES) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      if (s.id === rs) opt.selected = true;
      statusQuick.appendChild(opt);
    }
    statusQuick.addEventListener("change", () => {
      const prev = readingStatusOf(b);
      const next = statusQuick.value;
      b.readingStatus = next;
      if (next === "read" && prev !== "read") {
        b.readAt = new Date().toISOString();
        persist();
        renderAll();
        openRateModal(b.id);
        return;
      }
      b.updatedAt = new Date().toISOString();
      persist();
      renderAll();
    });

    const shelfQuick = document.createElement("select");
    shelfQuick.className = "select select-shelf-quick";
    shelfQuick.setAttribute("aria-label", "Shelf");
    for (const sh of sortedUserShelves(state)) {
      const opt = document.createElement("option");
      opt.value = sh.id;
      opt.textContent = sh.name;
      if (sh.id === b.userShelfId) opt.selected = true;
      shelfQuick.appendChild(opt);
    }
    shelfQuick.addEventListener("change", () => {
      b.userShelfId = shelfQuick.value;
      b.updatedAt = new Date().toISOString();
      persist();
      renderAll();
    });

    actions.appendChild(detailsBtn);
    if (isExpanded) {
      actions.appendChild(editBtn);
      actions.appendChild(statusQuick);
      actions.appendChild(shelfQuick);
    }

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
      const st =
        readingStatusOf(v) === "read" ? "✓" : readingStatusOf(v) === "dnf" ? "✗ DNF" : "○";
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
  ensureDefaultUserShelf(state);
  assignBookUserShelfIds(state);
  validateActiveUserShelfSelection();
  if (syncGoalPeriods(state)) persist();
  renderShelfSidebar();
  updateMainViewPanes();
  updateShelfActiveHeading();
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
  const show = els.bookReadingStatus && els.bookReadingStatus.value === "read";
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
  fillBookShelfFormSelects();
  els.btnEditRating.hidden = !(isEdit && b && readingStatusOf(b) === "read");
  els.bookId.value = b?.id || "";

  if (isEdit && b) {
    els.bookTitle.value = b.title || "";
    els.bookAuthor.value = b.author || "";
    els.bookType.value = b.type || "physical";
    els.bookUserShelf.value = b.userShelfId || getDefaultShelfId(state) || "";
    els.bookReadingStatus.value = readingStatusOf(b);
    els.bookOwnership.value = b.ownership === "borrowed" ? "borrowed" : "owned";
    const readUnknown = !!b.readDateUnknown || (readingStatusOf(b) === "read" && !b.readAt);
    els.bookDateUnknown.checked = readUnknown;
    els.bookFinishedDate.value =
      readingStatusOf(b) === "read" && !readUnknown
        ? readAtToDateInputValue(b.readAt) || localYMD(new Date())
        : "";
    els.bookTags.value = (b.tags || []).join(", ");
    els.bookRecommended.value = b.recommendedBy || "";
  } else if (adoptW) {
    els.bookTitle.value = adoptW.title || "";
    els.bookAuthor.value = adoptW.author || "";
    els.bookType.value = "physical";
    els.bookUserShelf.value = activeUserShelfId || getDefaultShelfId(state) || "";
    els.bookReadingStatus.value = "wishlist";
    els.bookOwnership.value = "owned";
    els.bookDateUnknown.checked = false;
    els.bookFinishedDate.value = "";
    els.bookTags.value = (adoptW.tags || []).join(", ");
    els.bookRecommended.value = adoptW.recommendedBy || "";
  } else {
    els.bookTitle.value = "";
    els.bookAuthor.value = "";
    els.bookType.value = "physical";
    els.bookUserShelf.value = activeUserShelfId || getDefaultShelfId(state) || "";
    els.bookReadingStatus.value = "wishlist";
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
  const prevReading = prev ? readingStatusOf(prev) : null;

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

  const userShelfId = els.bookUserShelf.value || getDefaultShelfId(state);
  const readingStatus = els.bookReadingStatus.value;
  const ownership = els.bookOwnership.value === "borrowed" ? "borrowed" : "owned";
  const now = new Date().toISOString();

  let readAt = prev?.readAt ?? null;
  const readDateUnknown = readingStatus === "read" ? !!els.bookDateUnknown.checked : false;
  if (readingStatus === "read") {
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
    userShelfId,
    readingStatus,
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

  const becameRead = readingStatus === "read" && prevReading !== "read";

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
initSortAndFilters();
loadTheme();
renderExportReminder();

els.btnAddUserShelf?.addEventListener("click", addUserShelfFromInput);
els.newShelfName?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addUserShelfFromInput();
  }
});

["input", "change"].forEach((ev) => {
  els.search.addEventListener(ev, () => renderBookList());
  els.sort.addEventListener(ev, () => renderBookList());
  els.filterType.addEventListener(ev, () => renderBookList());
  els.filterOwnership.addEventListener(ev, () => renderBookList());
  els.filterFavorites.addEventListener(ev, () => renderBookList());
  els.filterReadingStatus?.addEventListener(ev, () => renderBookList());
});

els.btnAdd.addEventListener("click", () => openBookModal(null));
els.btnSettingsToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettingsMenu();
});
els.btnProfileToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleProfileMenu();
});
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

els.bookReadingStatus?.addEventListener("change", () => {
  updateBookFinishedVisibility();
  if (els.bookReadingStatus.value !== "read") {
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

async function saveSupabaseConnection() {
  const { url, anon } = readSupabaseFormForSave();
  if (!url || !anon) {
    setAuthStatus("Enter Supabase URL and anon key first.", true);
    return;
  }
  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_ANON_KEY_KEY, anon);
  syncSupabaseFormFields(url, anon);
  sbClient = null;
  supabaseAuthListenerAttached = false;
  await initSupabaseAuth();
}

els.btnSaveSupabaseConfig?.addEventListener("click", saveSupabaseConnection);
els.btnSaveSupabaseConfigProfile?.addEventListener("click", saveSupabaseConnection);
els.btnSignUp?.addEventListener("click", async () => {
  if (!ensureSupabaseClientForAuth()) return;
  const email = (els.authEmail?.value || "").trim();
  const password = els.authPassword?.value || "";
  if (!email || !password) {
    setAuthStatus("Enter email and password.", true);
    return;
  }
  setAuthStatus("Creating account…", false);
  const { error } = await sbClient.auth.signUp({ email, password });
  if (error) setAuthStatus(`Sign up failed: ${error.message}`, true);
  else setAuthStatus("Sign up successful. Check email if confirmation is enabled.", false);
});
els.btnSignIn?.addEventListener("click", async () => {
  if (!ensureSupabaseClientForAuth()) return;
  const email = (els.authEmail?.value || "").trim();
  const password = els.authPassword?.value || "";
  if (!email || !password) {
    setAuthStatus("Enter email and password.", true);
    return;
  }
  setAuthStatus("Signing in…", false);
  const { error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthStatus(`Sign in failed: ${error.message}`, true);
    return;
  }
});
els.btnSignOut?.addEventListener("click", async () => {
  if (!ensureSupabaseClientForAuth()) return;
  setAuthStatus("Signing out…", false);
  await sbClient.auth.signOut();
});

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
    else {
      toggleProfileMenu(false);
      toggleSettingsMenu(false);
    }
  }
});

document.addEventListener("click", (e) => {
  const target = e.target;
  if (els.settingsMenu && els.btnSettingsToggle) {
    if (!els.settingsMenu.contains(target) && !els.btnSettingsToggle.contains(target)) {
      toggleSettingsMenu(false);
    }
  }
  if (els.profileMenu && els.btnProfileToggle) {
    if (!els.profileMenu.contains(target) && !els.btnProfileToggle.contains(target)) {
      toggleProfileMenu(false);
    }
  }
});

window.addEventListener("scroll", () => {
  updateScrollTopVisibility();
});
els.btnScrollTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll(".nav-rail-card[data-main-view]").forEach((btn) => {
  btn.addEventListener("click", () => setMainView(btn.dataset.mainView));
});

renderAll();
updateScrollTopVisibility();
initSupabaseAuth();
