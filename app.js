/**
 * My Cozy Library — local-first reading tracker
 */

const STORAGE_KEY = "book_shelf_data_v1";
const THEME_KEY = "book_shelf_theme";
/** Set localStorage to "1" to show on-card cover lookup debug pills: cozy_library_cover_debug */
const COVER_DEBUG_LS_KEY = "cozy_library_cover_debug";

function isCoverDebugEnabled() {
  try {
    return localStorage.getItem(COVER_DEBUG_LS_KEY) === "1";
  } catch (_) {
    return false;
  }
}
const BOOK_VIEW_MODE_KEY = "book_shelf_book_view_mode";
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
  { id: "wishlist", label: "To read", navLabel: "To Read" },
  { id: "in_progress", label: "In progress", navLabel: "Currently Reading" },
  { id: "read", label: "Read", navLabel: "Read" },
  { id: "on_hold", label: "On hold", navLabel: "On Hold" },
  { id: "dnf", label: "Did not finish", navLabel: "Did Not Finish" },
];

const READING_STATUS_IDS = READING_STATUSES.map((s) => s.id);

/** Sidebar order under "All books" (matches cozy nav mock). */
const SIDEBAR_READING_STATUS_ORDER = ["in_progress", "wishlist", "read", "on_hold", "dnf"];

const COZY_SIDEBAR_ICONS = {
  allBooks:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 5h7v7H5V5zm9 0h7v7h-7V5zM5 14h7v7H5v-7zm9 0h7v7h-7v-7z" stroke="currentColor" stroke-width="1.5"/></svg>',
  inProgress:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7 5h8a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.5"/><path d="M7 5v14a1 1 0 0 0 1 1h10" stroke="currentColor" stroke-width="1.5"/></svg>',
  toRead:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M12 10v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  read:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M8 12.5 10.8 15 16 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  onHold:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v6M14 9v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  dnf:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M9 9l6 6m0-6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  owned:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 5l3 14 2-11 2 11 3-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shelf:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 4h10v16a1 1 0 0 1-1 1H9a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v15a1 1 0 0 0 1 1h9" stroke="currentColor" stroke-width="1.5"/></svg>',
  want:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 20s-7-4.6-7-10a4.5 4.5 0 0 1 8.4-2.25A4.5 4.5 0 0 1 19 10c0 5.4-7 10-7 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  series:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7 4h10v17l-5-3-5 3V4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  goals:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 3v18M6 7h12l-2 4 2 4H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const SIDEBAR_STATUS_ICONS = {
  in_progress: "inProgress",
  wishlist: "toRead",
  read: "read",
  on_hold: "onHold",
  dnf: "dnf",
};

function readingStatusOf(book) {
  let s = book?.readingStatus ?? book?.reading_status ?? book?.shelf;
  if (s === "owned") s = "wishlist";
  if (!READING_STATUS_IDS.includes(s)) return "wishlist";
  return s;
}

function readingStatusLabel(id) {
  return READING_STATUSES.find((x) => x.id === id)?.label || id;
}

function readingStatusNavLabel(id) {
  const row = READING_STATUSES.find((x) => x.id === id);
  return row?.navLabel || row?.label || id;
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
  { id: "added_desc", label: "Recently added", toolbarLabel: "Recent" },
  { id: "title_asc", label: "Title (A–Z)", toolbarLabel: "Title A–Z" },
  { id: "author_asc", label: "Author (A–Z)", toolbarLabel: "Author A–Z" },
  { id: "read_desc", label: "Recently read", toolbarLabel: "Recently read" },
  { id: "rating_desc", label: "Rating (best first)", toolbarLabel: "Rating" },
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
  if (!READING_STATUS_IDS.includes(readingStatus)) {
    readingStatus = "wishlist";
  }
  const userShelfId = b.userShelfId ?? b.user_shelf_id ?? null;
  let rating = b.rating ?? null;
  if (rating === "frown") rating = "not_good";
  else if (rating === "meh") rating = "okay";
  else if (rating === "smile") rating = b.favorite ? "great" : "good";
  const rawIsbn = b.isbn ?? b.isbn_10 ?? b.isbn_13 ?? "";
  const isbn = String(rawIsbn || "").trim();
  const coverPreferenceRaw = String(b.coverPreference ?? b.cover_preference ?? "auto").trim().toLowerCase();
  const coverPreference = ["auto", "openlibrary", "custom_url", "upload"].includes(coverPreferenceRaw)
    ? coverPreferenceRaw
    : "auto";
  const coverUrl = String(b.coverUrl ?? b.cover_url ?? "").trim();
  let coverMeta = b.coverMeta ?? b.cover_meta ?? null;
  if (typeof coverMeta === "string") {
    try {
      coverMeta = JSON.parse(coverMeta);
    } catch (_) {
      coverMeta = null;
    }
  }
  if (coverMeta && typeof coverMeta !== "object") coverMeta = null;
  const rawCurrentPage = parseInt(b.currentPage ?? b.current_page, 10);
  const rawTotalPages = parseInt(b.totalPages ?? b.total_pages, 10);
  const totalPages = Number.isFinite(rawTotalPages) && rawTotalPages > 0 ? rawTotalPages : null;
  let currentPage = Number.isFinite(rawCurrentPage) && rawCurrentPage >= 0 ? rawCurrentPage : null;
  if (totalPages == null) currentPage = null;
  if (totalPages != null && currentPage != null) currentPage = Math.min(currentPage, totalPages);
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    type: b.type || "physical",
    isbn,
    coverPreference,
    coverUrl,
    coverMeta,
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
    currentPage,
    totalPages,
    createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
    updatedAt: b.updatedAt ?? b.updated_at ?? new Date().toISOString(),
  };
}

function isbnForCover(isbn) {
  return String(isbn || "").replace(/[-\s]/g, "").trim();
}

function normalizeIsbnCandidate(value) {
  const cleaned = String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
  if (cleaned.length === 13 || cleaned.length === 10) return cleaned;
  return "";
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeLookupText(value) {
  return normalizeLookupText(value)
    .split(" ")
    .filter((x) => x.length > 1);
}

function openLibraryLookupKey(title, author) {
  return `${String(title || "").trim().toLowerCase()}|${String(author || "").trim().toLowerCase()}`;
}

function openLibraryCoverLookupKey(book) {
  return `${openLibraryLookupKey(book?.title, book?.author)}|${isbnForCover(book?.isbn)}`;
}

function docLanguageIncludesEnglish(doc) {
  const langs = Array.isArray(doc?.language) ? doc.language : [];
  return langs.some((l) => String(l).toLowerCase() === "eng");
}

/** Higher rank = English is more primary on the work record (for sorting / labels). */
function docEnglishPrimaryRank(doc) {
  const langs = Array.isArray(doc?.language)
    ? doc.language.map((l) => String(l).toLowerCase().trim())
    : [];
  if (!langs.length) return 0;
  if (langs.length === 1 && langs[0] === "eng") return 2;
  if (langs[0] === "eng") return 2;
  if (langs.includes("eng")) return 1;
  return 0;
}

function editionHasEnglish(entry) {
  const langs = entry?.languages;
  if (!Array.isArray(langs)) return false;
  for (const x of langs) {
    const s = typeof x === "string" ? x : x?.key || "";
    if (String(s).toLowerCase().includes("/eng") || String(s).toLowerCase() === "eng") return true;
  }
  return false;
}

/** Pick the strongest search hit: score first, then prefer English when tied. */
function selectBestOpenLibraryDocForBook(docs, titleRaw, authorRaw) {
  let bestDoc = null;
  let bestScore = -1;
  let bestIsEng = false;
  for (const doc of docs) {
    const score = scoreDocAgainstBook(doc, titleRaw, authorRaw);
    const eng = docLanguageIncludesEnglish(doc);
    if (score > bestScore || (score === bestScore && eng && !bestIsEng)) {
      bestScore = score;
      bestDoc = doc;
      bestIsEng = eng;
    }
  }
  return { bestDoc, bestScore };
}

function pickBestIsbnFromDoc(doc) {
  const raw = Array.isArray(doc?.isbn) ? [...doc.isbn] : [];
  if (Array.isArray(doc?.ia)) {
    for (const entry of doc.ia) {
      const str = String(entry || "").trim();
      if (!str) continue;
      if (str.toLowerCase().startsWith("isbn_")) {
        raw.push(str.slice(5));
      }
    }
  }
  const normalized = [...new Set(raw.map(normalizeIsbnCandidate).filter(Boolean))];
  const isbn13 = normalized.find((x) => x.length === 13);
  if (isbn13) return isbn13;
  const isbn10 = normalized.find((x) => x.length === 10);
  return isbn10 || "";
}

async function lookupIsbnFromWorkEditions(workKey) {
  const wk = String(workKey || "").trim();
  if (!wk.startsWith("/works/")) return "";
  const url = `https://openlibrary.org${wk}/editions.json?limit=50`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const data = await resp.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const candidates = [];
    for (const entry of entries) {
      const from13 = Array.isArray(entry?.isbn_13) ? entry.isbn_13 : [];
      const from10 = Array.isArray(entry?.isbn_10) ? entry.isbn_10 : [];
      const merged = [...from13, ...from10];
      const normalized = merged.map(normalizeIsbnCandidate).filter(Boolean);
      const isbn13 = normalized.find((x) => x.length === 13);
      const isbn10 = normalized.find((x) => x.length === 10);
      const isbn = isbn13 || isbn10 || "";
      if (isbn) candidates.push({ isbn, eng: editionHasEnglish(entry) });
    }
    if (!candidates.length) return "";
    candidates.sort((a, b) => (b.eng ? 1 : 0) - (a.eng ? 1 : 0));
    return candidates[0].isbn;
  } catch (_) {
    return "";
  }
}

function scoreDocAgainstBook(doc, title, author) {
  const docTitle = normalizeLookupText(doc?.title || "");
  const docAuthor = Array.isArray(doc?.author_name)
    ? normalizeLookupText(doc.author_name.join(" "))
    : normalizeLookupText(doc?.author_name || "");
  const wantedTitle = normalizeLookupText(title);
  const wantedAuthor = normalizeLookupText(author);
  const titleTokens = tokenizeLookupText(title);
  const authorTokens = tokenizeLookupText(author);
  const hasIsbn = !!pickBestIsbnFromDoc(doc);
  let score = 0;

  if (docLanguageIncludesEnglish(doc)) score += 32;
  if (hasIsbn) score += 20;
  if (wantedTitle && docTitle === wantedTitle) score += 60;
  else if (wantedTitle && (docTitle.includes(wantedTitle) || wantedTitle.includes(docTitle))) score += 35;

  for (const tok of titleTokens) {
    if (docTitle.includes(tok)) score += 6;
  }

  if (wantedAuthor && docAuthor === wantedAuthor) score += 30;
  else if (wantedAuthor && (docAuthor.includes(wantedAuthor) || wantedAuthor.includes(docAuthor))) score += 15;

  for (const tok of authorTokens) {
    if (docAuthor.includes(tok)) score += 4;
  }

  return score;
}

function openLibraryCoverUrlFromDoc(doc, size = "M") {
  const coverId = doc?.cover_i;
  if (coverId != null && String(coverId).trim()) {
    return `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(coverId).trim())}-${size}.jpg?default=false`;
  }
  const olid = doc?.cover_edition_key;
  if (olid != null && String(olid).trim()) {
    return `https://covers.openlibrary.org/b/olid/${encodeURIComponent(String(olid).trim())}-${size}.jpg?default=false`;
  }
  return "";
}

async function lookupIsbnByTitleAuthor(title, author) {
  const key = openLibraryLookupKey(title, author);
  if (!key || key === "|") return { isbn: "", lookupError: false };
  if (openLibraryIsbnLookupCache.has(key)) {
    return { isbn: openLibraryIsbnLookupCache.get(key) || "", lookupError: false };
  }
  const titleRaw = String(title || "").trim();
  const authorRaw = String(author || "").trim();
  const qTitle = encodeURIComponent(titleRaw);
  const qAuthor = encodeURIComponent(authorRaw);
  const qCombined = encodeURIComponent(`${titleRaw} ${authorRaw}`.trim());
  const authorLast = authorRaw.split(/\s+/).filter(Boolean).slice(-1)[0] || "";
  const qAuthorLast = encodeURIComponent(authorLast);
  const urls = [
    `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthor}&limit=50`,
    `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthorLast}&limit=50`,
    `https://openlibrary.org/search.json?title=${qTitle}&limit=50`,
    `https://openlibrary.org/search.json?q=${qCombined}&limit=50`,
  ];
  let hadLookupError = false;
  /** @type {string[]} */
  const candidateWorkKeys = [];
  try {
    for (const url of urls) {
      const resp = await fetch(url);
      if (!resp.ok) {
        hadLookupError = true;
        continue;
      }
      const data = await resp.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      const { bestDoc, bestScore } = selectBestOpenLibraryDocForBook(docs, titleRaw, authorRaw);
      if (bestDoc) {
        if (bestDoc.key) candidateWorkKeys.push(String(bestDoc.key));
        const best = pickBestIsbnFromDoc(bestDoc);
        if (best && bestScore >= 30) {
          openLibraryIsbnLookupCache.set(key, best);
          return { isbn: best, lookupError: false };
        }
      }
    }
    for (const workKey of candidateWorkKeys) {
      const fromEditions = await lookupIsbnFromWorkEditions(workKey);
      if (fromEditions) {
        openLibraryIsbnLookupCache.set(key, fromEditions);
        return { isbn: fromEditions, lookupError: false };
      }
    }
  } catch (_) {
    hadLookupError = true;
  }
  // Cache misses only when we had a clean lookup; on lookup errors, allow retries.
  if (!hadLookupError) {
    openLibraryIsbnLookupCache.set(key, "");
  }
  return { isbn: "", lookupError: hadLookupError };
}

async function lookupCoverUrlByTitleAuthor(book, size = "M") {
  const key = openLibraryCoverLookupKey(book);
  if (!key || key === "|") return { coverUrl: "", lookupError: false };
  if (openLibraryCoverLookupCache.has(key)) {
    return { coverUrl: openLibraryCoverLookupCache.get(key) || "", lookupError: false };
  }
  const titleRaw = String(book?.title || "").trim();
  const authorRaw = String(book?.author || "").trim();
  if (!titleRaw) return { coverUrl: "", lookupError: false };
  const qTitle = encodeURIComponent(titleRaw);
  const qAuthor = encodeURIComponent(authorRaw);
  const qCombined = encodeURIComponent(`${titleRaw} ${authorRaw}`.trim());
  const urls = [
    `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthor}&limit=50&fields=key,title,author_name,cover_i,cover_edition_key,isbn,ia,language`,
    `https://openlibrary.org/search.json?title=${qTitle}&limit=50&fields=key,title,author_name,cover_i,cover_edition_key,isbn,ia,language`,
    `https://openlibrary.org/search.json?q=${qCombined}&limit=50&fields=key,title,author_name,cover_i,cover_edition_key,isbn,ia,language`,
  ];
  let hadLookupError = false;
  try {
    for (const url of urls) {
      const resp = await fetch(url);
      if (!resp.ok) {
        hadLookupError = true;
        continue;
      }
      const data = await resp.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      const { bestDoc, bestScore } = selectBestOpenLibraryDocForBook(docs, titleRaw, authorRaw);
      if (!bestDoc || bestScore < 24) continue;
      const coverUrl = openLibraryCoverUrlFromDoc(bestDoc, size);
      if (coverUrl) {
        openLibraryCoverLookupCache.set(key, coverUrl);
        return { coverUrl, lookupError: false };
      }
    }
  } catch (_) {
    hadLookupError = true;
  }
  if (!hadLookupError) openLibraryCoverLookupCache.set(key, "");
  return { coverUrl: "", lookupError: hadLookupError };
}

function resolveBookCoverInBackground(book, size = "M") {
  const key = String(book?.id || "");
  if (!key) return Promise.resolve("");
  if (openLibraryCoverLookupInFlight.has(key)) {
    return openLibraryCoverLookupInFlight.get(key);
  }
  const p = (async () => {
    const { coverUrl, lookupError } = await lookupCoverUrlByTitleAuthor(book, size);
    if (!coverUrl) return lookupError ? "__cover_lookup_error__" : "";
    return coverUrl;
  })().finally(() => {
    openLibraryCoverLookupInFlight.delete(key);
  });
  openLibraryCoverLookupInFlight.set(key, p);
  return p;
}

/** Avoid render loops when cover URL is already cached but the image still fails to load. */
function renderBookListIfOpenLibraryCoverCacheChanged(book, cacheSnapshot) {
  const key = openLibraryCoverLookupKey(book);
  if (openLibraryCoverLookupCache.get(key) !== cacheSnapshot) {
    renderBookList();
  }
}

function sanitizeCoverMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  const source = String(meta.source || "").trim() || "openlibrary";
  const workKey = String(meta.workKey || "").trim();
  const coverType = String(meta.coverType || "").trim();
  const coverValue = String(meta.coverValue || "").trim();
  const language = String(meta.language || "").trim();
  return { source, workKey, coverType, coverValue, language };
}

function openLibraryCoverMetaMatch(choiceMeta, candidateMeta) {
  const a = sanitizeCoverMeta(choiceMeta);
  const b = sanitizeCoverMeta(candidateMeta);
  if (!a || !b) return false;
  return (
    a.coverType === b.coverType &&
    a.coverValue === b.coverValue &&
    a.workKey === b.workKey
  );
}

/** Same Open Library cover may 404 for `-L`; try M/L/S then a placeholder via default=true. */
function openLibraryCoverUrlChain(coverType, coverValue) {
  const v = String(coverValue || "").trim();
  const ct = String(coverType || "").trim().toLowerCase();
  if (!v) return [];
  let pathPrefix;
  if (ct === "isbn") pathPrefix = `b/isbn/${encodeURIComponent(v)}`;
  else if (ct === "id") pathPrefix = `b/id/${encodeURIComponent(v)}`;
  else if (ct === "olid") pathPrefix = `b/olid/${encodeURIComponent(v)}`;
  else return [];
  const out = [];
  for (const sz of ["M", "L", "S"]) {
    out.push(`https://covers.openlibrary.org/${pathPrefix}-${sz}.jpg?default=false`);
  }
  out.push(`https://covers.openlibrary.org/${pathPrefix}-M.jpg?default=true`);
  return out;
}

function setImgSrcWithOpenLibraryChain(img, urls, hooks = null) {
  const list = (Array.isArray(urls) ? urls : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (!list.length || !img) return;
  const onExhausted = hooks && typeof hooks.onExhausted === "function" ? hooks.onExhausted : null;
  const onLoadSuccess = hooks && typeof hooks.onLoadSuccess === "function" ? hooks.onLoadSuccess : null;
  let index = 0;
  const clearHandlers = () => {
    img.onerror = null;
    img.onload = null;
  };
  img.onload = () => {
    clearHandlers();
    if (onLoadSuccess) onLoadSuccess();
  };
  img.onerror = () => {
    index += 1;
    if (index < list.length) {
      img.src = list[index];
    } else {
      clearHandlers();
      img.removeAttribute("src");
      if (onExhausted) onExhausted();
    }
  };
  img.src = list[0];
}

function setModalCoverChoice(preference, url, meta = null) {
  const pref = String(preference || "auto");
  modalCoverChoice = {
    preference: ["auto", "openlibrary", "custom_url", "upload"].includes(pref) ? pref : "auto",
    url: String(url || "").trim(),
    meta: sanitizeCoverMeta(meta),
  };
}

function updateBookCoverPreview(url, options = null) {
  if (!els.bookCoverPreview || !els.bookCoverPreviewFallback) return;
  const u = String(url || "").trim();
  const chain = options && Array.isArray(options.chain) ? options.chain : null;
  els.bookCoverPreview.onerror = null;
  els.bookCoverPreview.onload = null;
  if (!u && !(chain && chain.length)) {
    els.bookCoverPreview.classList.add("hidden");
    els.bookCoverPreview.removeAttribute("src");
    els.bookCoverPreviewFallback.classList.remove("hidden");
    return;
  }
  els.bookCoverPreview.classList.remove("hidden");
  els.bookCoverPreviewFallback.classList.add("hidden");
  if (chain && chain.length) {
    setImgSrcWithOpenLibraryChain(els.bookCoverPreview, chain, {
      onExhausted: () => {
        els.bookCoverPreview.classList.add("hidden");
        els.bookCoverPreviewFallback.classList.remove("hidden");
      },
    });
    return;
  }
  els.bookCoverPreview.src = u;
}

function renderModalCoverCandidates() {
  if (!els.bookCoverCandidates) return;
  els.bookCoverCandidates.innerHTML = "";
  els.bookCoverCandidates.classList.toggle("hidden", modalCoverCandidates.length === 0);
  for (const candidate of modalCoverCandidates) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "book-cover-candidate";
    const candUrls =
      Array.isArray(candidate.urls) && candidate.urls.length
        ? candidate.urls
        : candidate.url
          ? [candidate.url]
          : [];
    const primaryUrl = candUrls[0] || String(candidate.url || "").trim();
    const selected =
      modalCoverChoice.preference === "openlibrary" &&
      (openLibraryCoverMetaMatch(modalCoverChoice.meta, candidate.meta) ||
        (primaryUrl && modalCoverChoice.url === primaryUrl) ||
        (!candidate.meta?.coverValue && modalCoverChoice.url === candidate.url));
    btn.classList.toggle("book-cover-candidate--selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.title = candidate.label || "Cover option";

    const img = document.createElement("img");
    img.className = "book-cover-candidate-img";
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = candidate.label || "Cover option";
    btn.appendChild(img);
    if (candUrls.length) {
      setImgSrcWithOpenLibraryChain(img, candUrls);
    }

    btn.addEventListener("click", () => {
      const resolved =
        img.currentSrc && img.complete && img.naturalWidth > 0
          ? img.currentSrc
          : primaryUrl;
      setModalCoverChoice("openlibrary", resolved, candidate.meta);
      if (els.bookCoverStatus) els.bookCoverStatus.textContent = `Selected: ${candidate.label || "Open Library cover"}`;
      updateBookCoverPreview(primaryUrl, { chain: candUrls });
      renderModalCoverCandidates();
    });
    els.bookCoverCandidates.appendChild(btn);
  }
}

function coverUrlByPreference(book) {
  const pref = String(book?.coverPreference || "auto");
  if (pref !== "auto" && String(book?.coverUrl || "").trim()) return String(book.coverUrl).trim();
  return "";
}

async function fetchModalCoverCandidates(title, author, isbn) {
  const titleRaw = String(title || "").trim();
  const authorRaw = String(author || "").trim();
  const isbnClean = isbnForCover(isbn);
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (urls, label, meta = null) => {
    const list = (Array.isArray(urls) ? urls : [urls])
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (!list.length) return;
    const key = list[0];
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      urls: list,
      url: list[0],
      label,
      meta: sanitizeCoverMeta(meta),
    });
  };
  if (isbnClean) {
    pushCandidate(
      openLibraryCoverUrlChain("isbn", isbnClean),
      "ISBN cover",
      { source: "openlibrary", coverType: "isbn", coverValue: isbnClean, language: "eng" }
    );
  }
  if (!titleRaw) return candidates;
  const qTitle = encodeURIComponent(titleRaw);
  const qAuthor = encodeURIComponent(authorRaw);
  const qCombined = encodeURIComponent(`${titleRaw} ${authorRaw}`.trim());
  const urls = [
    `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthor}&limit=24&fields=key,title,author_name,cover_i,cover_edition_key,language`,
    `https://openlibrary.org/search.json?q=${qCombined}&limit=24&fields=key,title,author_name,cover_i,cover_edition_key,language`,
  ];
  for (const url of urls) {
    let resp;
    try {
      resp = await fetch(url);
    } catch (_) {
      continue;
    }
    if (!resp.ok) continue;
    let data;
    try {
      data = await resp.json();
    } catch (_) {
      continue;
    }
    const docs = Array.isArray(data?.docs) ? data.docs : [];
    const scored = [];
    for (const doc of docs) {
      const score = scoreDocAgainstBook(doc, titleRaw, authorRaw);
      if (score < 20) continue;
      scored.push({
        doc,
        score,
        eng: docLanguageIncludesEnglish(doc),
        enPrimary: docEnglishPrimaryRank(doc),
      });
    }
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.enPrimary - a.enPrimary ||
        (b.eng ? 1 : 0) - (a.eng ? 1 : 0)
    );
    for (const row of scored.slice(0, 12)) {
      const doc = row.doc;
      const enSuffix = row.enPrimary >= 2 ? " (EN)" : "";
      if (doc?.cover_i) {
        pushCandidate(
          openLibraryCoverUrlChain("id", String(doc.cover_i)),
          `${doc.title || "Open Library"}${enSuffix}`,
          {
            source: "openlibrary",
            workKey: doc.key,
            coverType: "id",
            coverValue: String(doc.cover_i),
            language: row.enPrimary >= 2 ? "eng" : "",
          }
        );
      }
      if (doc?.cover_edition_key) {
        pushCandidate(
          openLibraryCoverUrlChain("olid", String(doc.cover_edition_key)),
          `${doc.title || "Open Library"}${enSuffix}`,
          {
            source: "openlibrary",
            workKey: doc.key,
            coverType: "olid",
            coverValue: String(doc.cover_edition_key),
            language: row.enPrimary >= 2 ? "eng" : "",
          }
        );
      }
    }
  }
  return candidates;
}

function resolveBookIsbnInBackground(book) {
  if (!book?.id) return Promise.resolve("");
  if (book.isbn) return Promise.resolve(isbnForCover(book.isbn));
  const key = String(book.id);
  if (openLibraryIsbnLookupInFlight.has(key)) {
    return openLibraryIsbnLookupInFlight.get(key);
  }
  const p = (async () => {
    const { isbn, lookupError } = await lookupIsbnByTitleAuthor(book.title, book.author);
    if (!isbn) return lookupError ? "__lookup_error__" : "";
    const idx = state.books.findIndex((x) => x.id === book.id);
    if (idx < 0) return "";
    if (state.books[idx].isbn) return isbnForCover(state.books[idx].isbn);
    state.books[idx].isbn = isbn;
    state.books[idx].updatedAt = new Date().toISOString();
    persist();
    renderBookList();
    return isbn;
  })().finally(() => {
    openLibraryIsbnLookupInFlight.delete(key);
  });
  openLibraryIsbnLookupInFlight.set(key, p);
  return p;
}

function openLibraryCoverUrlFromIsbn(isbn, size = "M") {
  const cleaned = isbnForCover(isbn);
  if (!cleaned) return null;
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(cleaned)}-${size}.jpg?default=false`;
}

function createBookCoverNode(book, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = opts.className || "book-cover-wrap";
  const showCoverDbg = isCoverDebugEnabled();
  /** @type {HTMLSpanElement|null} */
  let debug = null;
  const setCoverDbg = (code, titleText) => {
    if (!debug) return;
    wrap.dataset.coverDebug = code;
    debug.textContent = code;
    debug.title = titleText;
  };
  if (showCoverDbg) {
    debug = document.createElement("span");
    debug.className = "book-cover-debug";
    wrap.appendChild(debug);
    setCoverDbg("loading", "Cover debug: trying Open Library");
  }

  const fallback = document.createElement("div");
  fallback.className = "book-cover-fallback";
  fallback.setAttribute("aria-hidden", "true");
  fallback.textContent = "No cover";

  const preferredCoverUrl = coverUrlByPreference(book);
  const cacheKey = openLibraryCoverLookupKey(book);
  const cachedFallbackCoverUrl = openLibraryCoverLookupCache.get(cacheKey) || "";
  const coverUrl = preferredCoverUrl || openLibraryCoverUrlFromIsbn(book?.isbn, opts.size || "M") || cachedFallbackCoverUrl;
  if (!coverUrl) {
    setCoverDbg("resolving", "Cover debug: looking up ISBN from title + author");
    void resolveBookIsbnInBackground(book).then((resolvedIsbn) => {
      if (resolvedIsbn === "__lookup_error__") {
        setCoverDbg("lookup-error", "Cover debug: ISBN lookup request failed (network/CORS/API)");
        return;
      }
      if (resolvedIsbn) return;
      setCoverDbg("cover-resolving", "Cover debug: trying metadata cover fallback");
      const coverCacheSnap = openLibraryCoverLookupCache.get(cacheKey);
      void resolveBookCoverInBackground(book, opts.size || "M").then((resolvedCoverUrl) => {
        if (resolvedCoverUrl && resolvedCoverUrl !== "__cover_lookup_error__") {
          renderBookListIfOpenLibraryCoverCacheChanged(book, coverCacheSnap);
          return;
        }
        if (resolvedCoverUrl === "__cover_lookup_error__") {
          setCoverDbg("lookup-error", "Cover debug: cover lookup request failed (network/CORS/API)");
          return;
        }
        setCoverDbg("no-isbn", "Cover debug: no ISBN or fallback cover found");
      });
    });
    wrap.appendChild(fallback);
    return wrap;
  }

  const img = document.createElement("img");
  img.className = "book-cover-img";
  img.loading = "lazy";
  img.decoding = "async";
  img.alt = `Cover of ${book?.title || "book"}`;
  const pref = String(book?.coverPreference || "auto");
  const olMeta = sanitizeCoverMeta(book?.coverMeta);
  const olChain =
    pref === "openlibrary" &&
    preferredCoverUrl &&
    olMeta?.coverType &&
    olMeta?.coverValue
      ? openLibraryCoverUrlChain(olMeta.coverType, olMeta.coverValue)
      : null;
  if (olChain && olChain.length) {
    setImgSrcWithOpenLibraryChain(img, olChain, {
      onLoadSuccess: () => setCoverDbg("ok", "Cover debug: loaded from Open Library"),
      onExhausted: () => {
        if (preferredCoverUrl) {
          img.remove();
          wrap.appendChild(fallback);
          return;
        }
        setCoverDbg("cover-resolving", "Cover debug: ISBN cover missing, trying metadata cover fallback");
        img.remove();
        wrap.appendChild(fallback);
        const coverCacheSnapOl = openLibraryCoverLookupCache.get(cacheKey);
        void resolveBookCoverInBackground(book, opts.size || "M").then((resolvedCoverUrl) => {
          if (resolvedCoverUrl && resolvedCoverUrl !== "__cover_lookup_error__") {
            renderBookListIfOpenLibraryCoverCacheChanged(book, coverCacheSnapOl);
            return;
          }
          if (resolvedCoverUrl === "__cover_lookup_error__") {
            setCoverDbg("lookup-error", "Cover debug: cover lookup request failed (network/CORS/API)");
            return;
          }
          setCoverDbg("no-cover", "Cover debug: Open Library returned no matching cover");
        });
      },
    });
  } else {
    img.src = coverUrl;
    img.addEventListener(
      "load",
      () => {
        setCoverDbg("ok", "Cover debug: loaded from Open Library");
      },
      { once: true }
    );
    img.addEventListener(
      "error",
      () => {
        if (preferredCoverUrl) {
          img.remove();
          wrap.appendChild(fallback);
          return;
        }
        setCoverDbg("cover-resolving", "Cover debug: ISBN cover missing, trying metadata cover fallback");
        img.remove();
        wrap.appendChild(fallback);
        const coverCacheSnapImg = openLibraryCoverLookupCache.get(cacheKey);
        void resolveBookCoverInBackground(book, opts.size || "M").then((resolvedCoverUrl) => {
          if (resolvedCoverUrl && resolvedCoverUrl !== "__cover_lookup_error__") {
            renderBookListIfOpenLibraryCoverCacheChanged(book, coverCacheSnapImg);
            return;
          }
          if (resolvedCoverUrl === "__cover_lookup_error__") {
            setCoverDbg("lookup-error", "Cover debug: cover lookup request failed (network/CORS/API)");
            return;
          }
          setCoverDbg("no-cover", "Cover debug: Open Library returned no matching cover");
        });
      },
      { once: true }
    );
  }

  wrap.appendChild(img);
  return wrap;
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

function clampNumber(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function goalPaceState(done, target, period, periodKey, refDate = new Date()) {
  const safeTarget = Math.max(0, parseInt(target, 10) || 0);
  if (!safeTarget) return { label: "", tone: "neutral" };
  const { start, end } = getPeriodWindow(period, periodKey);
  const span = end.getTime() - start.getTime();
  if (Number.isNaN(span) || span <= 0) return { label: "", tone: "neutral" };
  const nowMs = refDate.getTime();
  const elapsed = clampNumber((nowMs - start.getTime()) / span, 0, 1);
  const expected = safeTarget * elapsed;
  const delta = done - expected;
  if (delta >= 0.75) {
    return { label: `${Math.ceil(delta)} ahead`, tone: "ahead" };
  }
  if (delta >= -0.5) {
    return { label: "On track!", tone: "on-track" };
  }
  return { label: `${Math.ceil(Math.abs(delta))} behind`, tone: "behind" };
}

function formatDateYmdKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function bucketConfigForGoal(period, periodKey) {
  if (period === "week") {
    const { start } = getPeriodWindow(period, periodKey);
    const keys = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      keys.push(formatDateYmdKey(d));
    }
    return { label: "Daily activity", keys, keyForDate: (d) => formatDateYmdKey(d) };
  }
  if (period === "month") {
    const [rawY, rawM] = String(periodKey || "").split("-");
    const y = parseInt(rawY, 10);
    const m = parseInt(rawM, 10);
    const days = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m, 0).getDate() : 31;
    const keys = [];
    for (let startDay = 1; startDay <= days; startDay += 7) {
      const endDay = Math.min(days, startDay + 6);
      keys.push(`${String(startDay).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`);
    }
    return {
      label: "This month",
      keys,
      keyForDate: (d) => {
        if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return "";
        const weekStart = Math.floor((d.getDate() - 1) / 7) * 7 + 1;
        const weekEnd = Math.min(days, weekStart + 6);
        return `${String(weekStart).padStart(2, "0")}-${String(weekEnd).padStart(2, "0")}`;
      },
    };
  }
  const year = parseInt(periodKey, 10);
  const keys = Array.from({ length: 12 }, (_, i) => String(i));
  return {
    label: "Monthly activity",
    keys,
    keyForDate: (d) => (d.getFullYear() === year ? String(d.getMonth()) : ""),
  };
}

function finishCountsForGoalChart(books, period, periodKey, excludeAudiobooks) {
  const cfg = bucketConfigForGoal(period, periodKey);
  const counts = cfg.keys.map(() => 0);
  const indexByKey = new Map(cfg.keys.map((k, i) => [k, i]));
  const { start, end } = getPeriodWindow(period, periodKey);
  for (const b of books) {
    if (readingStatusOf(b) !== "read") continue;
    if (excludeAudiobooks && b.type === "audiobook") continue;
    if (!readAtInWindow(b.readAt, start, end)) continue;
    const d = new Date(b.readAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = cfg.keyForDate(d);
    const idx = indexByKey.get(key);
    if (idx == null) continue;
    counts[idx] += 1;
  }
  return { label: cfg.label, counts };
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

function ratingLabel(rating) {
  if (rating === "terrible") return "Terrible";
  if (rating === "not_good") return "Not good";
  if (rating === "okay") return "Okay";
  if (rating === "good") return "Good";
  if (rating === "great") return "Great";
  return "";
}

function ratingStars(rating) {
  const rank = ratingRank(rating);
  if (!rank) return "";
  return `${"★".repeat(rank)}${"☆".repeat(5 - rank)}`;
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

function sortWantList(list, sortId) {
  const out = [...list];
  switch (sortId) {
    case "author_asc":
      out.sort((a, b) => (a.author || "").localeCompare(b.author || "", undefined, { sensitivity: "base" }));
      break;
    case "added_desc":
      out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case "read_desc":
    case "rating_desc":
      out.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
      break;
    case "title_asc":
    default:
      out.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
  }
  return out;
}

/** Minimal book-shaped object so want-list titles can reuse cover + Open Library lookup. */
function wantItemAsBookStub(w) {
  return {
    id: w.id,
    title: w.title,
    author: w.author,
    isbn: "",
    type: "physical",
    readingStatus: "wishlist",
    coverPreference: "auto",
    coverUrl: "",
    coverMeta: null,
    tags: [],
  };
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
  libraryDashboardAboveControls: document.getElementById("library-dashboard-above-controls"),
  libraryMinimalHead: document.getElementById("library-minimal-head"),
  libraryMinimalTitle: document.getElementById("library-minimal-title"),
  libraryControls: document.getElementById("library-controls"),
  libraryBooksStack: document.getElementById("library-books-stack"),
  libraryWantStack: document.getElementById("library-want-stack"),
  btnStatusColorsFull: document.getElementById("btn-status-colors-full"),
  btnStatusColorsMinimal: document.getElementById("btn-status-colors-minimal"),
  statusColorsPopover: document.getElementById("status-colors-popover"),
  sidebarMyLibrary: document.getElementById("sidebar-my-library"),
  sidebarShelves: document.getElementById("sidebar-shelves"),
  shelfActiveHeading: document.getElementById("shelf-active-heading"),
  newShelfName: document.getElementById("new-shelf-name"),
  btnAddUserShelf: document.getElementById("btn-add-user-shelf"),
  filterReadingStatus: document.getElementById("filter-reading-status"),
  currentlyReadingSection: document.getElementById("currently-reading-section"),
  currentlyReadingList: document.getElementById("currently-reading-list"),
  currentlyReadingEmpty: document.getElementById("currently-reading-empty"),
  currentlyReadingNav: document.getElementById("currently-reading-nav"),
  currentlyReadingPrev: document.getElementById("currently-reading-prev"),
  currentlyReadingNext: document.getElementById("currently-reading-next"),
  bookList: document.getElementById("book-list"),
  listEmpty: document.getElementById("list-empty"),
  search: document.getElementById("search-books"),
  sort: document.getElementById("sort-books"),
  filterType: document.getElementById("filter-type"),
  filterOwnership: document.getElementById("filter-ownership"),
  filterFavorites: document.getElementById("filter-favorites"),
  btnViewList: document.getElementById("btn-view-list"),
  btnViewGrid: document.getElementById("btn-view-grid"),
  bookListCount: document.getElementById("book-list-count"),
  btnFiltersToggle: document.getElementById("btn-filters-toggle"),
  filtersActiveBadge: document.getElementById("filters-active-badge"),
  filtersDrawer: document.getElementById("filters-drawer"),
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
  goalsMainSummaryGrid: document.getElementById("goals-main-summary-grid"),
  btnGoalsOpen: document.getElementById("btn-goals-open"),
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
  seriesCount: document.getElementById("series-count"),
  seriesFilter: document.getElementById("series-filter"),
  seriesSort: document.getElementById("series-sort"),
  seriesTabActive: document.getElementById("series-tab-active"),
  seriesTabCompleted: document.getElementById("series-tab-completed"),
  seriesTabArchived: document.getElementById("series-tab-archived"),
  seriesTabCountActive: document.getElementById("series-tab-count-active"),
  seriesTabCountCompleted: document.getElementById("series-tab-count-completed"),
  seriesTabCountArchived: document.getElementById("series-tab-count-archived"),
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
  bookIsbn: document.getElementById("book-isbn"),
  bookCoverPreview: document.getElementById("book-cover-preview"),
  bookCoverPreviewFallback: document.getElementById("book-cover-preview-fallback"),
  bookCoverStatus: document.getElementById("book-cover-status"),
  bookCoverCandidates: document.getElementById("book-cover-candidates"),
  btnBookCoverFind: document.getElementById("btn-book-cover-find"),
  btnBookCoverResetAuto: document.getElementById("btn-book-cover-reset-auto"),
  bookCoverCustomUrl: document.getElementById("book-cover-custom-url"),
  bookCoverUpload: document.getElementById("book-cover-upload"),
  bookType: document.getElementById("book-type"),
  bookUserShelf: document.getElementById("book-user-shelf"),
  bookReadingStatus: document.getElementById("book-reading-status"),
  bookOwnership: document.getElementById("book-ownership"),
  bookFinishedWrap: document.getElementById("book-finished-wrap"),
  bookFinishedDate: document.getElementById("book-finished-date"),
  bookDateUnknown: document.getElementById("book-date-unknown"),
  bookProgressWrap: document.getElementById("book-progress-wrap"),
  bookCurrentPage: document.getElementById("book-current-page"),
  bookTotalPages: document.getElementById("book-total-pages"),
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
  modalSeriesRateOverlay: document.getElementById("modal-series-rate-overlay"),
  modalSeriesRateClose: document.getElementById("modal-series-rate-close"),
  seriesRateLabel: document.getElementById("series-rate-label"),
  seriesRateFinishedDate: document.getElementById("series-rate-finished-date"),
  btnSeriesRateSave: document.getElementById("btn-series-rate-save"),
  btnSeriesRateCancel: document.getElementById("btn-series-rate-cancel"),
  bookDetailsOverlay: document.getElementById("book-details-overlay"),
  bookDetailsPanel: document.getElementById("book-details-panel"),
  bookDetailsClose: document.getElementById("book-details-close"),
  bookDetailsCloseBtn: document.getElementById("book-details-close-btn"),
  bookDetailsEditBtn: document.getElementById("book-details-edit-btn"),
  bookDetailsCoverSlot: document.getElementById("book-details-cover-slot"),
  bookDetailsTitle: document.getElementById("book-details-title"),
  bookDetailsAuthor: document.getElementById("book-details-author"),
  bookDetailsRating: document.getElementById("book-details-rating"),
  bookDetailsStatus: document.getElementById("book-details-status"),
  bookDetailsFormat: document.getElementById("book-details-format"),
  bookDetailsOwnership: document.getElementById("book-details-ownership"),
  bookDetailsAdded: document.getElementById("book-details-added"),
  bookDetailsSeries: document.getElementById("book-details-series"),
  bookDetailsProgress: document.getElementById("book-details-progress"),
  bookDetailsTags: document.getElementById("book-details-tags"),
};

let state = loadState();
let currentlyReadingPage = 0;
let seriesFilterValue = "all";
let seriesSortValue = "name_asc";
let seriesTabValue = "active";
const expandedSeriesIds = new Set();
let ratingSeriesId = null;
let selectedSeriesStars = null;
if (!state.goalsHistory) state.goalsHistory = [];
if (!state.hiddenTagSuggestions) state.hiddenTagSuggestions = [];
if (!state.wantList) state.wantList = [];
if (!state.hiddenSeriesIds) state.hiddenSeriesIds = [];
if (!state.userShelves) state.userShelves = [];
let activeUserShelfId = getDefaultShelfId(state) || null;
/** Right column: library (books or inline want list) | series | goals */
let activeMainView = "library";

/** Want List uses library pane + minimal chrome (not separate pane-want). */
let showWantListInLibrary = false;

let statusColorsPopoverOpen = false;
let statusColorsAnchor = null;
let activeBookViewMode = localStorage.getItem(BOOK_VIEW_MODE_KEY) === "grid" ? "grid" : "list";
let pendingRateBookId = null;
let selectedRating = null;
let tagSuggestBlurTimer = null;
let wantTagSuggestBlurTimer = null;
let pendingWantListAdoptId = null;
let pendingSeriesHideId = null;
let modalCoverCandidates = [];
let modalCoverChoice = { preference: "auto", url: "", meta: null };
let activeDetailsBookId = null;
let activeDetailsCardEl = null;
const expandedBookIds = new Set();
let sbClient = null;
let sbSession = null;
let sbUserId = null;
let cloudSyncTimer = null;
let isCloudLoading = false;
let supabaseAuthListenerAttached = false;
/** Set when cloud state has been loaded successfully for the current access token (avoids skipping retry after a failed load). */
let cloudHydratedAccessToken = null;
const openLibraryIsbnLookupCache = new Map();
const openLibraryIsbnLookupInFlight = new Map();
const openLibraryCoverLookupCache = new Map();
const openLibraryCoverLookupInFlight = new Map();

function persist() {
  saveState(state);
  scheduleCloudSync();
}

function setBookViewMode(mode) {
  activeBookViewMode = mode === "grid" ? "grid" : "list";
  localStorage.setItem(BOOK_VIEW_MODE_KEY, activeBookViewMode);
  updateBookViewModeUI();
  renderBookList();
}

function updateBookViewModeUI() {
  if (els.bookList) {
    els.bookList.classList.toggle("book-list--grid", activeBookViewMode === "grid");
    els.bookList.classList.toggle("book-list--list", activeBookViewMode !== "grid");
  }
  if (els.wantListItems) {
    els.wantListItems.classList.toggle("book-list--grid", activeBookViewMode === "grid");
    els.wantListItems.classList.toggle("book-list--list", activeBookViewMode !== "grid");
  }
  if (els.btnViewList) {
    const on = activeBookViewMode !== "grid";
    els.btnViewList.classList.toggle("view-mode-btn--active", on);
    els.btnViewList.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (els.btnViewGrid) {
    const on = activeBookViewMode === "grid";
    els.btnViewGrid.classList.toggle("view-mode-btn--active", on);
    els.btnViewGrid.setAttribute("aria-pressed", on ? "true" : "false");
  }
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

/** True when the snapshot has any books, series, or want-list rows (ignores goals-only cloud data). */
function libraryHasContent(x) {
  if (!x) return false;
  return (
    (x.books?.length || 0) +
    (x.series?.length || 0) +
    (x.wantList?.length || 0)
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
      isbn: b.isbn,
      cover_preference: b.coverPreference || "auto",
      cover_url: b.coverUrl || "",
      cover_meta: b.coverMeta ?? null,
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
      current_page: b.currentPage ?? null,
      total_pages: b.totalPages ?? null,
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
      isbn: b.isbn,
      cover_preference: b.cover_preference,
      cover_url: b.cover_url,
      cover_meta: b.cover_meta,
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
      currentPage: b.current_page,
      totalPages: b.total_pages,
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
    showWantListInLibrary = false;
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

    // Always re-read localStorage so we don’t use a stale in-memory `state`, and compare
    // “library” rows only. Cloud can have goals/history/settings while books are still empty;
    // treating that as “non-empty cloud” used to replace local books and persist an empty list.
    const localSnapshot = JSON.parse(JSON.stringify(loadState()));
    const cloudState = await loadStateFromSupabase(cloudUserId);
    const migratedKey = migrationKeyForUser(cloudUserId);
    const hasMigrated = localStorage.getItem(migratedKey) === "1";
    const cloudLibraryEmpty = !libraryHasContent(cloudState);
    const localLibraryHasData = libraryHasContent(localSnapshot);
    if (cloudLibraryEmpty && localLibraryHasData) {
      // Never wipe a non-empty local library with a goals-only (or otherwise book-less) cloud snapshot on refresh.
      state = localSnapshot;
      if (!hasMigrated) {
        const ok = confirm("Cloud library is empty. Upload your local data to this account now?");
        if (ok) {
          await saveStateToSupabase(cloudUserId, localSnapshot);
          localStorage.setItem(migratedKey, "1");
        }
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
    showWantListInLibrary = false;
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
      alert("Could not import this file. Please choose a valid My Cozy Library export JSON file.");
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
  els.sort.innerHTML = SORT_OPTIONS.map(
    (o) => `<option value="${o.id}">${o.toolbarLabel || o.label}</option>`
  ).join("");
  els.sort.value = "added_desc";
  if (els.filterReadingStatus) {
    els.filterReadingStatus.innerHTML =
      `<option value="">All statuses</option>` +
      READING_STATUSES.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  }
}

function toggleFiltersDrawer(forceOpen) {
  if (!els.filtersDrawer || !els.btnFiltersToggle) return;
  const open =
    typeof forceOpen === "boolean" ? forceOpen : els.filtersDrawer.classList.contains("hidden");
  els.filtersDrawer.classList.toggle("hidden", !open);
  els.btnFiltersToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function activeFilterCount() {
  let count = 0;
  if ((els.filterReadingStatus?.value || "") !== "") count += 1;
  if ((els.filterType?.value || "") !== "") count += 1;
  if ((els.filterOwnership?.value || "") !== "") count += 1;
  if (els.filterFavorites?.checked) count += 1;
  return count;
}

function updateFiltersBadge() {
  if (!els.filtersActiveBadge || !els.btnFiltersToggle) return;
  const count = activeFilterCount();
  const show = count > 0;
  els.filtersActiveBadge.textContent = String(count);
  els.filtersActiveBadge.classList.toggle("hidden", !show);
  els.btnFiltersToggle.setAttribute("aria-label", show ? `Filters (${count} active)` : "Filters");
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
    els.shelfActiveHeading.textContent = "All Books";
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
  if (view !== "library" && view !== "want_list" && view !== "series" && view !== "goals") return;
  if (view === "want_list") {
    activeMainView = "library";
    showWantListInLibrary = true;
    activeUserShelfId = null;
    if (els.filterReadingStatus) els.filterReadingStatus.value = "";
    renderAll();
    return;
  }
  showWantListInLibrary = false;
  activeMainView = view;
  renderAll();
}

function updateMainViewPanes() {
  const lib = document.getElementById("pane-library");
  const want = document.getElementById("pane-want");
  const series = document.getElementById("pane-series");
  const goals = document.getElementById("pane-goals");
  if (lib) lib.classList.toggle("hidden", activeMainView !== "library");
  if (want) want.classList.add("hidden");
  if (series) series.classList.toggle("hidden", activeMainView !== "series");
  if (goals) goals.classList.toggle("hidden", activeMainView !== "goals");
}

function cozySidebarIconEl(iconKey) {
  const span = document.createElement("span");
  span.className = "cozy-nav-icon";
  span.innerHTML = COZY_SIDEBAR_ICONS[iconKey] || "";
  return span;
}

function countVisibleSeriesInSidebar() {
  const hidden = new Set(state.hiddenSeriesIds || []);
  return state.series
    .filter((s) => !hidden.has(s.id))
    .filter((s) => seriesProgress(state, s.id).volumes.length > 0).length;
}

function sidebarReadingFilter() {
  return (els.filterReadingStatus?.value || "").trim();
}

function isSidebarAllBooksActive() {
  return (
    activeMainView === "library" &&
    !showWantListInLibrary &&
    activeUserShelfId === null &&
    sidebarReadingFilter() === ""
  );
}

function isSidebarStatusFilterActive(statusId) {
  return activeMainView === "library" && activeUserShelfId === null && sidebarReadingFilter() === statusId;
}

function isSidebarShelfRowActive(shelfId) {
  return activeMainView === "library" && activeUserShelfId === shelfId && sidebarReadingFilter() === "";
}

function isSidebarMainViewActive(view) {
  return activeMainView === view;
}

function isSidebarWantListActive() {
  return activeMainView === "library" && showWantListInLibrary;
}

function isLibraryFullDashboard() {
  return activeMainView === "library" && isSidebarAllBooksActive() && !showWantListInLibrary;
}

function getLibraryMinimalViewTitle() {
  if (showWantListInLibrary) return "Want List";
  const sf = sidebarReadingFilter();
  if (sf) return readingStatusNavLabel(sf);
  if (activeUserShelfId) {
    const def = getDefaultShelfId(state);
    if (def && activeUserShelfId === def) return "Owned";
    return userShelfName(state, activeUserShelfId);
  }
  return "Your library";
}

function updateLibraryChrome() {
  if (activeMainView !== "library") {
    closeStatusColorsPopover();
    return;
  }
  if (!els.libraryDashboardAboveControls || !els.libraryMinimalHead) return;
  const full = isLibraryFullDashboard();
  els.libraryDashboardAboveControls.classList.toggle("hidden", !full);
  els.libraryMinimalHead.classList.toggle("hidden", full);
  els.libraryMinimalHead.setAttribute("aria-hidden", full ? "true" : "false");
  if (els.libraryMinimalTitle) els.libraryMinimalTitle.textContent = getLibraryMinimalViewTitle();
  const hideStatusColors = showWantListInLibrary;
  els.btnStatusColorsFull?.classList.toggle("hidden", !full || hideStatusColors);
  els.btnStatusColorsMinimal?.classList.toggle("hidden", full || hideStatusColors);
  if (!full || hideStatusColors) closeStatusColorsPopover();
}

function closeStatusColorsPopover() {
  if (!els.statusColorsPopover) return;
  els.statusColorsPopover.classList.add("hidden");
  els.statusColorsPopover.setAttribute("aria-hidden", "true");
  els.btnStatusColorsFull?.setAttribute("aria-expanded", "false");
  els.btnStatusColorsMinimal?.setAttribute("aria-expanded", "false");
  statusColorsPopoverOpen = false;
  statusColorsAnchor = null;
}

function positionStatusColorsPopover(anchor) {
  const pop = els.statusColorsPopover;
  if (!pop || !anchor) return;
  const pad = 8;
  const r = anchor.getBoundingClientRect();
  pop.style.position = "fixed";
  pop.style.zIndex = "3000";
  const w = Math.min(260, window.innerWidth - pad * 2);
  pop.style.width = `${w}px`;
  let left = r.right - w;
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  let top = r.bottom + pad;
  const h = pop.getBoundingClientRect().height || 172;
  if (top + h > window.innerHeight - pad) top = Math.max(pad, r.top - h - pad);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

function toggleStatusColorsPopover(anchor) {
  if (!els.statusColorsPopover || !anchor) return;
  if (statusColorsPopoverOpen && statusColorsAnchor === anchor) {
    closeStatusColorsPopover();
    return;
  }
  const nextAnchor = anchor;
  closeStatusColorsPopover();
  statusColorsAnchor = nextAnchor;
  statusColorsPopoverOpen = true;
  els.statusColorsPopover.classList.remove("hidden");
  els.statusColorsPopover.setAttribute("aria-hidden", "false");
  nextAnchor.setAttribute("aria-expanded", "true");
  if (nextAnchor === els.btnStatusColorsFull) els.btnStatusColorsMinimal?.setAttribute("aria-expanded", "false");
  if (nextAnchor === els.btnStatusColorsMinimal) els.btnStatusColorsFull?.setAttribute("aria-expanded", "false");
  requestAnimationFrame(() => {
    positionStatusColorsPopover(nextAnchor);
    requestAnimationFrame(() => positionStatusColorsPopover(nextAnchor));
  });
}

function appendCozySidebarButton(container, { iconKey, label, count, active, onClick }) {
  const li = document.createElement("li");
  li.className = "cozy-sidebar-li";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cozy-nav-row" + (active ? " cozy-nav-row--active" : "");
  if (active) btn.setAttribute("aria-current", "true");
  btn.appendChild(cozySidebarIconEl(iconKey));
  const lab = document.createElement("span");
  lab.className = "cozy-nav-label";
  lab.textContent = label;
  const badge = document.createElement("span");
  badge.className = "cozy-nav-badge";
  badge.textContent = String(count);
  btn.appendChild(lab);
  btn.appendChild(badge);
  btn.addEventListener("click", onClick);
  li.appendChild(btn);
  container.appendChild(li);
}

function renderCozySidebar() {
  if (!els.sidebarMyLibrary || !els.sidebarShelves) return;
  els.sidebarMyLibrary.innerHTML = "";
  els.sidebarShelves.innerHTML = "";

  const books = state.books || [];
  const total = books.length;

  appendCozySidebarButton(els.sidebarMyLibrary, {
    iconKey: "allBooks",
    label: "All Books",
    count: total,
    active: isSidebarAllBooksActive(),
    onClick: () => {
      activeMainView = "library";
      showWantListInLibrary = false;
      activeUserShelfId = null;
      if (els.filterReadingStatus) els.filterReadingStatus.value = "";
      renderAll();
    },
  });

  for (const statusId of SIDEBAR_READING_STATUS_ORDER) {
    const iconKey = SIDEBAR_STATUS_ICONS[statusId] || "toRead";
    const c = books.filter((b) => readingStatusOf(b) === statusId).length;
    appendCozySidebarButton(els.sidebarMyLibrary, {
      iconKey,
      label: readingStatusNavLabel(statusId),
      count: c,
      active: isSidebarStatusFilterActive(statusId),
      onClick: () => {
        activeMainView = "library";
        showWantListInLibrary = false;
        activeUserShelfId = null;
        if (els.filterReadingStatus) els.filterReadingStatus.value = statusId;
        renderAll();
      },
    });
  }

  const defaultShelfId = getDefaultShelfId(state);
  const sorted = sortedUserShelves(state);

  if (defaultShelfId) {
    const ownedCount = books.filter((b) => b.userShelfId === defaultShelfId).length;
    appendCozySidebarButton(els.sidebarShelves, {
      iconKey: "owned",
      label: "Owned",
      count: ownedCount,
      active: isSidebarShelfRowActive(defaultShelfId),
      onClick: () => {
        activeMainView = "library";
        showWantListInLibrary = false;
        activeUserShelfId = defaultShelfId;
        if (els.filterReadingStatus) els.filterReadingStatus.value = "";
        renderAll();
      },
    });
  }

  for (const s of sorted) {
    if (s.isDefault) continue;
    const count = books.filter((b) => b.userShelfId === s.id).length;
    const shelfActive = isSidebarShelfRowActive(s.id);
    const wrap = document.createElement("li");
    wrap.className = "cozy-sidebar-li cozy-nav-row-wrap" + (shelfActive ? " cozy-nav-row-wrap--active" : "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cozy-nav-row cozy-nav-row--grow";
    if (shelfActive) btn.setAttribute("aria-current", "true");
    btn.appendChild(cozySidebarIconEl("shelf"));
    const lab = document.createElement("span");
    lab.className = "cozy-nav-label";
    lab.textContent = s.name;
    const badge = document.createElement("span");
    badge.className = "cozy-nav-badge";
    badge.textContent = String(count);
    btn.appendChild(lab);
    btn.appendChild(badge);
    btn.addEventListener("click", () => {
      activeMainView = "library";
      showWantListInLibrary = false;
      activeUserShelfId = s.id;
      if (els.filterReadingStatus) els.filterReadingStatus.value = "";
      renderAll();
    });

    const actions = document.createElement("div");
    actions.className = "cozy-nav-row-actions";

    const ren = document.createElement("button");
    ren.type = "button";
    ren.className = "cozy-nav-row-action";
    ren.textContent = "✎";
    ren.setAttribute("aria-label", `Rename ${s.name}`);
    ren.addEventListener("click", (e) => {
      e.stopPropagation();
      renameUserShelfPrompt(s.id);
    });
    actions.appendChild(ren);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "cozy-nav-row-action cozy-nav-row-action--danger";
    del.setAttribute("aria-label", `Remove ${s.name}`);
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeUserShelfById(s.id);
    });
    actions.appendChild(del);

    wrap.appendChild(btn);
    wrap.appendChild(actions);
    els.sidebarShelves.appendChild(wrap);
  }

  const wantCount = Array.isArray(state.wantList) ? state.wantList.length : 0;
  appendCozySidebarButton(els.sidebarShelves, {
    iconKey: "want",
    label: "Want List",
    count: wantCount,
    active: isSidebarWantListActive(),
    onClick: () => setMainView("want_list"),
  });

  const seriesCount = countVisibleSeriesInSidebar();
  appendCozySidebarButton(els.sidebarShelves, {
    iconKey: "series",
    label: "Series",
    count: seriesCount,
    active: isSidebarMainViewActive("series"),
    onClick: () => setMainView("series"),
  });

  appendCozySidebarButton(els.sidebarShelves, {
    iconKey: "goals",
    label: "Reading goals",
    count: state.goals?.length || 0,
    active: isSidebarMainViewActive("goals"),
    onClick: () => setMainView("goals"),
  });

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
  showWantListInLibrary = false;
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

function cycleReadingStatusForBook(book) {
  const prev = readingStatusOf(book);
  const idx = READING_STATUSES.findIndex((s) => s.id === prev);
  const next = READING_STATUSES[(idx + 1) % READING_STATUSES.length]?.id || "wishlist";
  book.readingStatus = next;
  if (next === "read" && prev !== "read") {
    book.readAt = new Date().toISOString();
    book.updatedAt = new Date().toISOString();
    persist();
    renderAll();
    openRateModal(book.id);
    return;
  }
  book.updatedAt = new Date().toISOString();
  persist();
  renderAll();
}

function createRatingChipNode(rating) {
  const label = ratingLabel(rating);
  const stars = ratingStars(rating);
  if (!label || !stars) return null;
  const chip = document.createElement("span");
  chip.className = "rating-chip";
  chip.setAttribute("aria-label", `Rating: ${label}`);
  chip.title = `Rating: ${label}`;
  const starsNode = document.createElement("span");
  starsNode.className = "rating-chip-stars";
  starsNode.setAttribute("aria-hidden", "true");
  starsNode.textContent = stars;
  const labelNode = document.createElement("span");
  labelNode.className = "rating-chip-label";
  labelNode.textContent = label;
  chip.appendChild(starsNode);
  chip.appendChild(labelNode);
  return chip;
}

function renderBookDetailsPanel(book) {
  if (!book || !els.bookDetailsOverlay) return;
  if (els.bookDetailsCoverSlot) {
    els.bookDetailsCoverSlot.innerHTML = "";
    const cover = createBookCoverNode(book, {
      className: "book-cover-wrap book-cover-wrap--details",
      size: "L",
    });
    els.bookDetailsCoverSlot.appendChild(cover);
  }
  if (els.bookDetailsTitle) els.bookDetailsTitle.textContent = book.title || "Untitled";
  if (els.bookDetailsAuthor) els.bookDetailsAuthor.textContent = book.author || "Author unknown";

  if (els.bookDetailsRating) {
    els.bookDetailsRating.innerHTML = "";
    const chip = createRatingChipNode(book.rating);
    els.bookDetailsRating.classList.toggle("hidden", !chip);
    if (chip) els.bookDetailsRating.appendChild(chip);
  }

  if (els.bookDetailsStatus) els.bookDetailsStatus.textContent = readingStatusLabel(readingStatusOf(book));
  if (els.bookDetailsFormat) els.bookDetailsFormat.textContent = typeLabel(book.type);
  if (els.bookDetailsOwnership) els.bookDetailsOwnership.textContent = ownershipLabel(book.ownership);
  if (els.bookDetailsAdded) {
    const added = new Date(book.createdAt || "");
    els.bookDetailsAdded.textContent = Number.isNaN(added.getTime()) ? "-" : added.toLocaleDateString();
  }

  if (els.bookDetailsSeries && els.bookDetailsProgress) {
    if (book.seriesId) {
      const progress = seriesProgress(state, book.seriesId);
      const seriesName = progress.meta?.name || "Series";
      const volumeText = book.volumeInSeries != null ? `Vol. ${book.volumeInSeries}` : "Volume unknown";
      els.bookDetailsSeries.textContent = `${seriesName} · ${volumeText}`;
      els.bookDetailsProgress.textContent = `${progress.readCount} of ${progress.total || 0} read`;
    } else {
      els.bookDetailsSeries.textContent = "-";
      if (readingStatusOf(book) === "in_progress" && book.totalPages && book.currentPage != null) {
        const pct = Math.round((book.currentPage / book.totalPages) * 100);
        els.bookDetailsProgress.textContent = `Page ${book.currentPage} of ${book.totalPages} — ${pct}%`;
      } else {
        els.bookDetailsProgress.textContent =
          readingStatusOf(book) === "read" ? "Completed" : readingStatusLabel(readingStatusOf(book));
      }
    }
  }

  if (els.bookDetailsTags) {
    els.bookDetailsTags.innerHTML = "";
    const tags = Array.isArray(book.tags) ? book.tags.filter(Boolean) : [];
    if (!tags.length) {
      const empty = document.createElement("span");
      empty.className = "book-details-empty";
      empty.textContent = "No tags";
      els.bookDetailsTags.appendChild(empty);
    } else {
      for (const t of tags) {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        els.bookDetailsTags.appendChild(span);
      }
    }
  }
}

function openBookDetailsPanel(bookId, sourceEl = null) {
  const book = state.books.find((x) => x.id === bookId);
  if (!book || !els.bookDetailsOverlay) return;
  activeDetailsBookId = bookId;
  activeDetailsCardEl = sourceEl || document.activeElement;
  renderBookDetailsPanel(book);
  els.bookDetailsOverlay.classList.remove("hidden");
  els.bookDetailsOverlay.setAttribute("aria-hidden", "false");
  els.bookDetailsClose?.focus();
}

function closeBookDetailsPanel() {
  if (!els.bookDetailsOverlay) return;
  els.bookDetailsOverlay.classList.add("hidden");
  els.bookDetailsOverlay.setAttribute("aria-hidden", "true");
  activeDetailsBookId = null;
  if (activeDetailsCardEl && typeof activeDetailsCardEl.focus === "function") {
    activeDetailsCardEl.focus();
  }
  activeDetailsCardEl = null;
}

function renderCurrentlyReading(list) {
  if (!els.currentlyReadingSection || !els.currentlyReadingList || !els.currentlyReadingEmpty) return;
  els.currentlyReadingList.innerHTML = "";
  els.currentlyReadingEmpty.classList.toggle("hidden", list.length > 0);
  els.currentlyReadingSection.classList.toggle("hidden", activeMainView !== "library");
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  if (currentlyReadingPage >= pageCount) currentlyReadingPage = 0;
  const start = currentlyReadingPage * pageSize;
  const visible = list.slice(start, start + pageSize);
  const showNav = list.length > pageSize;
  els.currentlyReadingNav?.classList.toggle("hidden", !showNav);
  if (els.currentlyReadingPrev) els.currentlyReadingPrev.disabled = !showNav;
  if (els.currentlyReadingNext) els.currentlyReadingNext.disabled = !showNav;

  for (const b of visible) {
    const li = document.createElement("li");
    li.className = "currently-reading-item";
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");
    li.setAttribute("aria-label", `Open details for ${b.title}`);
    li.addEventListener("click", () => openBookDetailsPanel(b.id, li));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openBookDetailsPanel(b.id, li);
      }
    });

    const text = document.createElement("div");
    text.className = "currently-reading-item-main";
    const cover = createBookCoverNode(b, { className: "book-cover-wrap book-cover-wrap--current", size: "M" });
    const title = document.createElement("p");
    title.className = "currently-reading-item-title";
    title.textContent = b.title;
    const meta = document.createElement("p");
    meta.className = "currently-reading-item-meta";
    meta.textContent = b.author || "Author unknown";
    text.appendChild(title);
    text.appendChild(meta);
    if (b.totalPages && b.currentPage != null) {
      const pct = Math.round((b.currentPage / b.totalPages) * 100);
      const bar = document.createElement("div");
      bar.className = "currently-reading-progress";
      const fill = document.createElement("span");
      fill.className = "currently-reading-progress-fill";
      fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      bar.appendChild(fill);
      const caption = document.createElement("p");
      caption.className = "currently-reading-progress-copy";
      caption.textContent = `Page ${b.currentPage} of ${b.totalPages} — ${pct}%`;
      text.appendChild(bar);
      text.appendChild(caption);
    }

    const statusBtn = document.createElement("button");
    statusBtn.type = "button";
    const rsCr = readingStatusOf(b);
    statusBtn.className = `book-status-cycle book-status-cycle--${rsCr}`;
    statusBtn.textContent = readingStatusLabel(rsCr);
    statusBtn.setAttribute("aria-label", `Change status for ${b.title}`);
    statusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleReadingStatusForBook(b);
    });
    statusBtn.addEventListener("keydown", (e) => e.stopPropagation());

    li.appendChild(cover);
    li.appendChild(text);
    li.appendChild(statusBtn);
    els.currentlyReadingList.appendChild(li);
  }
}

function renderBookList() {
  if (activeMainView === "library") updateLibraryChrome();

  if (activeMainView === "library" && showWantListInLibrary) {
    els.libraryControls?.classList.add("library-controls--want-mode");
    els.libraryBooksStack?.classList.add("hidden");
    els.libraryWantStack?.classList.remove("hidden");
    els.filtersDrawer?.classList.add("hidden");
    els.btnFiltersToggle?.setAttribute("aria-expanded", "false");
    updateBookViewModeUI();
    updateFiltersBadge();
    renderWantList();
    return;
  }

  els.libraryControls?.classList.remove("library-controls--want-mode");
  els.libraryBooksStack?.classList.remove("hidden");
  els.libraryWantStack?.classList.add("hidden");

  if (activeMainView !== "library") return;

  updateBookViewModeUI();
  updateFiltersBadge();
  const q = els.search.value;
  const sortId = els.sort.value;
  const type = els.filterType.value;
  const ownership = els.filterOwnership.value;
  const favoritesOnly = els.filterFavorites.checked;
  const readingStatusFilter = els.filterReadingStatus?.value || "";

  const baseFiltered = filterBooks(state.books, {
    userShelfId: activeUserShelfId,
    readingStatusFilter: "",
    q,
    type,
    favoritesOnly,
    ownership,
  });
  const currentlyReading = [...baseFiltered]
    .filter((b) => readingStatusOf(b) === "in_progress")
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));

  /** Pinned "Currently reading" only on full dashboard (All Books, no status filter). */
  const showPinnedCurrentlyReading =
    isSidebarAllBooksActive() &&
    (readingStatusFilter === "" || readingStatusFilter === "in_progress");
  renderCurrentlyReading(showPinnedCurrentlyReading ? currentlyReading : []);

  let list = filterBooks(state.books, {
    userShelfId: activeUserShelfId,
    readingStatusFilter,
    q,
    type,
    favoritesOnly,
    ownership,
  });
  if (showPinnedCurrentlyReading) {
    const inProgressIds = new Set(currentlyReading.map((b) => b.id));
    list = list.filter((b) => !inProgressIds.has(b.id));
  }
  list = sortBooks(list, sortId);

  const hideMainListEmptyBecausePinnedInProgress =
    showPinnedCurrentlyReading &&
    readingStatusFilter === "in_progress" &&
    currentlyReading.length > 0;
  els.listEmpty.classList.toggle("hidden", list.length > 0 || hideMainListEmptyBecausePinnedInProgress);
  els.bookList.innerHTML = "";
  const isGrid = activeBookViewMode === "grid";
  if (els.bookListCount) {
    const countForToolbar =
      readingStatusFilter === "in_progress" && showPinnedCurrentlyReading
        ? currentlyReading.length
        : list.length;
    els.bookListCount.textContent = `${countForToolbar} book${countForToolbar === 1 ? "" : "s"}`;
  }

  for (const b of list) {
    const li = document.createElement("li");
    li.className = `book-card ${isGrid ? "book-card--grid" : "book-card--list"}`;
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");
    li.setAttribute("aria-label", `Open details for ${b.title}`);
    li.addEventListener("click", () => openBookDetailsPanel(b.id, li));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openBookDetailsPanel(b.id, li);
      }
    });

    const rs = readingStatusOf(b);
    const spine = document.createElement("span");
    spine.className = `book-card-spine book-card-spine--${rs}`;
    spine.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    const cover = createBookCoverNode(b, {
      className:
        isGrid
          ? "book-cover-wrap book-cover-wrap--grid"
          : "book-cover-wrap book-cover-wrap--list",
      size: isGrid ? "M" : "S",
    });
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

    const author = document.createElement("p");
    author.className = "book-card-author";
    author.textContent = b.author || "Author unknown";

    const textCol = document.createElement("div");
    textCol.className = `book-card-text-col ${isGrid ? "book-card-text-col--grid" : "book-card-text-col--list"}`;
    textCol.appendChild(titleRow);
    textCol.appendChild(author);

    body.className = `book-card-body ${isGrid ? "book-card-body--grid" : "book-card-body--list"}`;

    if (isGrid) {
      const coverShell = document.createElement("div");
      coverShell.className = "book-card-cover-shell";
      const statusTop = document.createElement("span");
      statusTop.className = `book-card-status-top book-card-status-top--${rs}`;
      statusTop.setAttribute("aria-hidden", "true");
      coverShell.appendChild(statusTop);
      coverShell.appendChild(cover);

      body.appendChild(textCol);
      const ratingChip = createRatingChipNode(b.rating);
      if (ratingChip) {
        const ratingWrap = document.createElement("div");
        ratingWrap.className = "book-card-rating";
        ratingWrap.appendChild(ratingChip);
        body.appendChild(ratingWrap);
      }
      body.prepend(coverShell);
      li.appendChild(body);
      els.bookList.appendChild(li);
      continue;
    }

    body.appendChild(textCol);
    body.prepend(cover);

    li.appendChild(spine);
    li.appendChild(body);
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

function renderGoalsMainSummary() {
  if (!els.goalsMainSummaryGrid) return;
  const goals = [...(state.goals || [])];
  goals.sort((a, b) => {
    const rank = { year: 0, month: 1, week: 2 };
    return (rank[a.period] ?? 99) - (rank[b.period] ?? 99);
  });

  els.goalsMainSummaryGrid.innerHTML = "";
  if (!goals.length) {
    const empty = document.createElement("p");
    empty.className = "goals-main-summary-empty";
    empty.textContent = "No goals set yet.";
    els.goalsMainSummaryGrid.appendChild(empty);
    return;
  }

  const goalsToRender = goals.length ? [goals[0]] : [];
  for (const g of goalsToRender) {
    const done = countReadBooksInPeriod(state.books, g.period, g.excludeAudiobooks);
    const target = Math.max(0, parseInt(g.target, 10) || 0);
    const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    const periodKey = g.currentPeriodKey || getCurrentPeriodKey(g.period, new Date());
    const pace = goalPaceState(done, target, g.period, periodKey, new Date());
    const chart = finishCountsForGoalChart(state.books, g.period, periodKey, g.excludeAudiobooks);
    const maxCount = Math.max(...chart.counts, 0);

    const card = document.createElement("article");
    card.className = "goals-main-card";

    const head = document.createElement("header");
    head.className = "goals-main-card-head";

    const label = document.createElement("p");
    label.className = "goals-main-card-label";
    label.textContent = goalPeriodHeading(g.period);

    head.appendChild(label);
    if (pace.label) {
      const paceEl = document.createElement("span");
      paceEl.className = `goals-main-pace goals-main-pace--${pace.tone}`;
      paceEl.textContent = pace.label;
      head.appendChild(paceEl);
    }

    const body = document.createElement("div");
    body.className = "goals-main-card-body";

    const ring = document.createElement("div");
    ring.className = "goals-main-ring goals-main-ring--large";
    ring.style.setProperty("--p", `${pct}%`);
    ring.setAttribute(
      "aria-label",
      `${goalPeriodHeading(g.period)} goal progress: ${done} of ${target} books, ${pct} percent`
    );
    ring.setAttribute("role", "img");

    const ringInner = document.createElement("span");
    ringInner.className = "goals-main-ring-inner";
    const ringMain = document.createElement("strong");
    ringMain.className = "goals-main-ring-main";
    ringMain.textContent = `${done} of ${target}`;
    const ringSub = document.createElement("span");
    ringSub.className = "goals-main-ring-sub";
    ringSub.textContent = `${pct}%`;
    ringInner.appendChild(ringMain);
    ringInner.appendChild(ringSub);
    ring.appendChild(ringInner);

    const activity = document.createElement("div");
    activity.className = "goals-main-activity";
    const activityLabel = document.createElement("p");
    activityLabel.className = "goals-main-activity-label";
    activityLabel.textContent = chart.label;
    const bars = document.createElement("div");
    bars.className = "goals-main-activity-bars";
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", `${chart.label}: ${chart.counts.join(", ")} books finished`);
    chart.counts.forEach((count) => {
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = "goals-main-activity-bar";
      const pctHeight = maxCount > 0 ? (count / maxCount) * 100 : 0;
      bar.style.setProperty("--h", `${Math.max(14, Math.round(pctHeight))}%`);
      const label = `${count} book${count === 1 ? "" : "s"} read`;
      bar.setAttribute("aria-label", label);
      bar.dataset.countLabel = label;
      bar.title = label;
      bars.appendChild(bar);
    });
    activity.appendChild(activityLabel);
    activity.appendChild(bars);
    const seriesStats = computeSeriesSummaryCounts();
    const stats = document.createElement("p");
    stats.className = "goals-main-series-stats";
    stats.textContent = `${seriesStats.finished} series finished · ${seriesStats.inProgress} in progress`;
    activity.appendChild(stats);

    body.appendChild(ring);
    body.appendChild(activity);
    card.appendChild(head);
    card.appendChild(body);
    els.goalsMainSummaryGrid.appendChild(card);
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

function seriesFilterMatches(entry, filterId) {
  if (filterId === "all") return true;
  return entry.volumes.some((v) => readingStatusOf(v) === filterId);
}

function isSeriesCompletedEntry(entry) {
  const total = Number.isFinite(entry?.total) ? entry.total : 0;
  const readCount = Number.isFinite(entry?.readCount) ? entry.readCount : 0;
  if (total <= 0) return false;
  return readCount >= total;
}

function formatSeriesFinishedDate(entry) {
  const override = entry?.series?.seriesCompletedAt;
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
  }
  const dates = (entry.volumes || [])
    .map((v) => new Date(v.readAt || ""))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) return "Date unknown";
  return new Date(Math.max(...dates.map((d) => d.getTime()))).toLocaleDateString();
}

function computeSeriesSummaryCounts() {
  const hidden = new Set(state.hiddenSeriesIds || []);
  const entries = (state.series || [])
    .filter((s) => !hidden.has(s.id))
    .map((s) => ({ series: s, ...seriesProgress(state, s.id) }))
    .filter((e) => (e.volumes || []).length > 0);
  const finished = entries.filter((e) => isSeriesCompletedEntry(e)).length;
  const inProgress = entries.filter((e) => (e.volumes || []).some((v) => readingStatusOf(v) === "in_progress")).length;
  return { finished, inProgress };
}

function seriesSortComparator(a, b, sortId) {
  if (sortId === "progress_desc") {
    const ap = a.total > 0 ? a.readCount / a.total : 0;
    const bp = b.total > 0 ? b.readCount / b.total : 0;
    if (bp !== ap) return bp - ap;
  } else if (sortId === "activity_desc") {
    const aTime = a.volumes.reduce((m, v) => Math.max(m, new Date(v.updatedAt || v.createdAt || 0).getTime() || 0), 0);
    const bTime = b.volumes.reduce((m, v) => Math.max(m, new Date(v.updatedAt || v.createdAt || 0).getTime() || 0), 0);
    if (bTime !== aTime) return bTime - aTime;
  }
  return a.series.name.localeCompare(b.series.name, undefined, { sensitivity: "base" });
}

function statusPillLabel(statusId) {
  if (statusId === "in_progress") return "Currently Reading";
  if (statusId === "wishlist") return "To Read";
  if (statusId === "on_hold") return "On Hold";
  if (statusId === "dnf") return "Did Not Finish";
  return "Read";
}

function renderSeries() {
  seriesFilterValue = els.seriesFilter?.value || seriesFilterValue || "all";
  seriesSortValue = els.seriesSort?.value || seriesSortValue || "name_asc";
  if (!["active", "completed", "archived"].includes(seriesTabValue)) seriesTabValue = "active";
  if (els.seriesTabActive) {
    const active = seriesTabValue === "active";
    els.seriesTabActive.classList.toggle("is-active", active);
    els.seriesTabActive.setAttribute("aria-selected", active ? "true" : "false");
  }
  if (els.seriesTabCompleted) {
    const active = seriesTabValue === "completed";
    els.seriesTabCompleted.classList.toggle("is-active", active);
    els.seriesTabCompleted.setAttribute("aria-selected", active ? "true" : "false");
  }
  if (els.seriesTabArchived) {
    const active = seriesTabValue === "archived";
    els.seriesTabArchived.classList.toggle("is-active", active);
    els.seriesTabArchived.setAttribute("aria-selected", active ? "true" : "false");
  }
  cleanupEmptySeries(state);
  const hidden = new Set(state.hiddenSeriesIds || []);
  const allEntries = (state.series || []).map((s) => {
    const progress = seriesProgress(state, s.id);
    return {
      series: s,
      ...progress,
      volumes: progress.volumes || [],
    };
  });
  const archivedEntries = allEntries.filter((e) => hidden.has(e.series.id) && e.volumes.length > 0);
  const nonArchivedEntries = allEntries.filter((e) => !hidden.has(e.series.id) && e.volumes.length > 0);
  const completedEntries = nonArchivedEntries.filter((e) => isSeriesCompletedEntry(e));
  const activeEntries = nonArchivedEntries.filter((e) => !isSeriesCompletedEntry(e));
  if (els.seriesTabCountActive) els.seriesTabCountActive.textContent = String(activeEntries.length);
  if (els.seriesTabCountCompleted) els.seriesTabCountCompleted.textContent = String(completedEntries.length);
  if (els.seriesTabCountArchived) els.seriesTabCountArchived.textContent = String(archivedEntries.length);

  const entries =
    seriesTabValue === "archived"
      ? archivedEntries
      : seriesTabValue === "completed"
        ? completedEntries
        : activeEntries;

  const filtered = entries
    .filter((e) => seriesFilterMatches(e, seriesFilterValue))
    .sort((a, b) => seriesSortComparator(a, b, seriesSortValue));

  if (els.seriesCount) {
    els.seriesCount.textContent = `${filtered.length} series`;
  }

  if (filtered.length === 0) {
    els.seriesEmpty.classList.remove("hidden");
    if (els.seriesEmpty) {
      els.seriesEmpty.textContent =
        seriesTabValue === "archived"
          ? "No archived series. Use Abandon on an active series to move it here."
          : seriesTabValue === "completed"
            ? "No completed series yet. A series moves here when all volumes are marked Read."
            : "No active series yet. Add books and link them to a series.";
    }
    els.seriesList.innerHTML = "";
    return;
  }
  els.seriesEmpty.classList.add("hidden");
  els.seriesList.innerHTML = "";

  for (const entry of filtered) {
    const { series: s, readCount, total, meta, volumes } = entry;
    const card = document.createElement("div");
    card.className = "series-card series-card--rich";
    const isExpanded = expandedSeriesIds.has(s.id);
    const barPct = total > 0 ? Math.min(100, Math.round((readCount / total) * 100)) : 0;

    const top = document.createElement("div");
    top.className = "series-card-top";
    const isCompletedTab = seriesTabValue === "completed";
    const ring = document.createElement("div");
    ring.className = `series-mini-ring${isCompletedTab ? " series-mini-ring--completed" : ""}`;
    ring.style.setProperty("--p", `${barPct}%`);
    ring.textContent = isCompletedTab ? "✓" : `${barPct}%`;

    const headWrap = document.createElement("div");
    headWrap.className = "series-card-main";
    const titleRow = document.createElement("div");
    titleRow.className = "series-card-title-row";
    const h3 = document.createElement("h3");
    h3.textContent = s.name;
    titleRow.appendChild(h3);
    if (meta?.publishingIncomplete) {
      const ongoing = document.createElement("span");
      ongoing.className = "series-ongoing-chip";
      ongoing.textContent = "Ongoing";
      titleRow.appendChild(ongoing);
    }
    const metaP = document.createElement("p");
    metaP.className = "series-card-meta";
    metaP.textContent = `${readCount} / ${total} read`;
    const tagsWrap = document.createElement("div");
    tagsWrap.className = "series-top-tags";
    const tags = Array.from(
      new Set(
        volumes
          .flatMap((v) => (Array.isArray(v.tags) ? v.tags : []))
          .map((t) => String(t || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 3);
    for (const t of tags) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      tagsWrap.appendChild(tag);
    }
    headWrap.appendChild(titleRow);
    headWrap.appendChild(metaP);
    if (isCompletedTab) {
      const doneMeta = document.createElement("p");
      doneMeta.className = "series-complete-meta";
      doneMeta.textContent = `Completed · Finished ${formatSeriesFinishedDate(entry)}`;
      headWrap.appendChild(doneMeta);
    }
    if (tags.length) headWrap.appendChild(tagsWrap);

    const actions = document.createElement("div");
    actions.className = "series-card-actions";
    if (seriesTabValue !== "completed") {
      const abandonBtn = document.createElement("button");
      abandonBtn.type = "button";
      abandonBtn.className = `series-abandon-btn ${seriesTabValue === "archived" ? "series-abandon-btn--resume" : ""}`;
      if (seriesTabValue === "archived") {
        abandonBtn.textContent = "Resume";
      } else {
        abandonBtn.innerHTML = `<span class="series-abandon-btn__icon" aria-hidden="true">\u{1F6AB}</span> Abandon`;
      }
      abandonBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const set = new Set(state.hiddenSeriesIds || []);
        if (seriesTabValue === "archived") set.delete(s.id);
        else set.add(s.id);
        state.hiddenSeriesIds = [...set];
        persist();
        renderCozySidebar();
        renderSeries();
      });
      actions.appendChild(abandonBtn);
    }
    if (isCompletedTab && !Number.isFinite(parseInt(s.seriesRating, 10))) {
      const rateBtn = document.createElement("button");
      rateBtn.type = "button";
      rateBtn.className = "series-rate-btn";
      rateBtn.textContent = "Rate Series";
      rateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        ratingSeriesId = s.id;
        selectedSeriesStars = Number.isFinite(parseInt(s.seriesRating, 10)) ? parseInt(s.seriesRating, 10) : null;
        if (els.seriesRateLabel) els.seriesRateLabel.textContent = s.name || "Series";
        if (els.seriesRateFinishedDate) {
          if (s.seriesCompletedAt) {
            const d = new Date(s.seriesCompletedAt);
            els.seriesRateFinishedDate.value = Number.isNaN(d.getTime()) ? "" : localYMD(d);
          } else {
            const dates = (entry.volumes || [])
              .map((v) => new Date(v.readAt || ""))
              .filter((d) => !Number.isNaN(d.getTime()));
            const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
            els.seriesRateFinishedDate.value = latest ? localYMD(latest) : "";
          }
        }
        els.modalSeriesRateOverlay?.classList.remove("hidden");
        els.modalSeriesRateOverlay?.setAttribute("aria-hidden", "false");
        els.modalSeriesRateOverlay?.querySelectorAll("[data-series-stars]").forEach((btn) => {
          btn.setAttribute("aria-pressed", String(Number(btn.dataset.seriesStars) === selectedSeriesStars));
        });
      });
      actions.appendChild(rateBtn);
    } else if (isCompletedTab && Number.isFinite(parseInt(s.seriesRating, 10))) {
      const rated = document.createElement("span");
      rated.className = "series-rated-chip";
      const stars = "★★★★★".slice(0, parseInt(s.seriesRating, 10)).padEnd(5, "☆");
      rated.textContent = `Rated ${stars}`;
      actions.appendChild(rated);
    }
    const chevron = document.createElement("button");
    chevron.type = "button";
    chevron.className = "series-chevron-btn";
    chevron.setAttribute("aria-label", `${isExpanded ? "Collapse" : "Expand"} ${s.name}`);
    chevron.textContent = isExpanded ? "⌄" : "›";
    chevron.addEventListener("click", () => {
      if (expandedSeriesIds.has(s.id)) expandedSeriesIds.delete(s.id);
      else expandedSeriesIds.add(s.id);
      renderSeries();
    });
    actions.appendChild(chevron);

    top.appendChild(ring);
    top.appendChild(headWrap);
    top.appendChild(actions);
    card.appendChild(top);

    const body = document.createElement("div");
    body.className = "series-card-body";
    body.classList.toggle("hidden", !isExpanded);

    const list = document.createElement("ul");
    list.className = "series-volume-rows";
    const byNumber = new Map();
    const unnumbered = [];
    for (const v of volumes) {
      if (Number.isFinite(v.volumeInSeries) && v.volumeInSeries > 0) byNumber.set(v.volumeInSeries, v);
      else unnumbered.push(v);
    }
    const maxNum = Number.isFinite(meta?.expectedTotal) && meta.expectedTotal > 0 ? meta.expectedTotal : 0;
    for (let i = 1; i <= maxNum; i += 1) {
      const v = byNumber.get(i);
      const row = document.createElement("li");
      row.className = "series-volume-row";
      if (v) {
        row.addEventListener("click", () => openBookDetailsPanel(v.id, row));
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openBookDetailsPanel(v.id, row);
          }
        });
        const dot = document.createElement("span");
        dot.className = `series-volume-dot series-volume-dot--${readingStatusOf(v)}`;
        const cover = createBookCoverNode(v, { className: "book-cover-wrap book-cover-wrap--series-row", size: "S" });
        const copy = document.createElement("div");
        copy.className = "series-volume-copy";
        const title = document.createElement("p");
        title.className = "series-volume-title";
        title.textContent = `Vol ${i}: ${v.title}`;
        const author = document.createElement("p");
        author.className = "series-volume-author";
        author.textContent = v.author || "Author unknown";
        copy.appendChild(title);
        copy.appendChild(author);
        const pill = document.createElement("span");
        const status = readingStatusOf(v);
        pill.className = `series-status-pill series-status-pill--${status}`;
        pill.textContent = statusPillLabel(status);
        row.appendChild(dot);
        row.appendChild(cover);
        row.appendChild(copy);
        row.appendChild(pill);
      } else {
        row.className = "series-volume-row series-volume-row--missing";
        const dot = document.createElement("span");
        dot.className = "series-volume-dot series-volume-dot--missing";
        const emptyCover = document.createElement("div");
        emptyCover.className = "series-volume-cover-placeholder";
        emptyCover.textContent = "+";
        const copy = document.createElement("div");
        copy.className = "series-volume-copy";
        const title = document.createElement("p");
        title.className = "series-volume-title";
        title.textContent = `Vol ${i}: Not in library`;
        copy.appendChild(title);
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn-ghost btn-compact";
        addBtn.textContent = "+ Add";
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openBookModal(null, {
            seriesPrefill: {
              name: s.name,
              volume: i,
              total: meta?.expectedTotal ?? null,
              publishingIncomplete: !!meta?.publishingIncomplete,
            },
          });
        });
        row.appendChild(dot);
        row.appendChild(emptyCover);
        row.appendChild(copy);
        row.appendChild(addBtn);
      }
      list.appendChild(row);
    }
    const appendUnnumbered = [...unnumbered].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    for (const v of appendUnnumbered) {
      const row = document.createElement("li");
      row.className = "series-volume-row";
      const dot = document.createElement("span");
      dot.className = `series-volume-dot series-volume-dot--${readingStatusOf(v)}`;
      const cover = createBookCoverNode(v, { className: "book-cover-wrap book-cover-wrap--series-row", size: "S" });
      const copy = document.createElement("div");
      copy.className = "series-volume-copy";
      const title = document.createElement("p");
      title.className = "series-volume-title";
      title.textContent = v.title;
      const author = document.createElement("p");
      author.className = "series-volume-author";
      author.textContent = v.author || "Author unknown";
      copy.appendChild(title);
      copy.appendChild(author);
      const status = readingStatusOf(v);
      const pill = document.createElement("span");
      pill.className = `series-status-pill series-status-pill--${status}`;
      pill.textContent = statusPillLabel(status);
      row.appendChild(dot);
      row.appendChild(cover);
      row.appendChild(copy);
      row.appendChild(pill);
      list.appendChild(row);
    }

    body.appendChild(list);
    card.appendChild(body);
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
  renderCozySidebar();
  updateMainViewPanes();
  updateShelfActiveHeading();
  renderBookList();
  renderSeriesNameSuggestions();
  renderGoals();
  renderGoalsMainSummary();
  renderGoalsHistory();
  renderSeries();
  renderExportReminder();
  if (activeDetailsBookId && els.bookDetailsOverlay && !els.bookDetailsOverlay.classList.contains("hidden")) {
    const current = state.books.find((x) => x.id === activeDetailsBookId);
    if (current) renderBookDetailsPanel(current);
    else closeBookDetailsPanel();
  }
}

function renderWantList() {
  if (!els.wantListItems || !els.wantListEmpty) return;
  let list = [...(state.wantList || [])];
  const q = (els.search?.value || "").trim().toLowerCase();
  if (q) {
    list = list.filter((w) => {
      const tags = (w.tags || []).join(" ").toLowerCase();
      return (
        (w.title || "").toLowerCase().includes(q) ||
        (w.author || "").toLowerCase().includes(q) ||
        tags.includes(q)
      );
    });
  }
  const sortId = els.sort?.value || "added_desc";
  list = sortWantList(list, sortId);
  els.wantListEmpty.classList.toggle("hidden", list.length > 0);
  const isGrid = activeBookViewMode === "grid";
  if (els.bookListCount) {
    els.bookListCount.textContent = `${list.length} book${list.length === 1 ? "" : "s"}`;
  }
  els.wantListItems.innerHTML = "";

  for (const w of list) {
    const stub = wantItemAsBookStub(w);
    const li = document.createElement("li");
    li.className = `book-card want-list-card ${isGrid ? "book-card--grid" : "book-card--list"}`;
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");
    li.setAttribute("aria-label", `Want list: ${w.title}. Press to edit.`);
    li.addEventListener("click", () => openWantModal(w.id));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openWantModal(w.id);
      }
    });

    const body = document.createElement("div");
    body.className = `book-card-body ${isGrid ? "book-card-body--grid" : "book-card-body--list"}`;
    const cover = createBookCoverNode(stub, {
      className: isGrid ? "book-cover-wrap book-cover-wrap--grid" : "book-cover-wrap book-cover-wrap--list",
      size: isGrid ? "M" : "S",
    });
    const titleRow = document.createElement("div");
    titleRow.className = "book-title-row";
    const h3 = document.createElement("h3");
    h3.className = "book-card-title";
    h3.textContent = w.title;
    titleRow.appendChild(h3);

    const author = document.createElement("p");
    author.className = "book-card-author";
    author.textContent = w.author ? w.author : "Author unknown";

    const textCol = document.createElement("div");
    textCol.className = `book-card-text-col ${isGrid ? "book-card-text-col--grid" : "book-card-text-col--list"}`;
    textCol.appendChild(titleRow);
    textCol.appendChild(author);

    if (isGrid) {
      const coverShell = document.createElement("div");
      coverShell.className = "book-card-cover-shell book-card-cover-shell--want";
      coverShell.appendChild(cover);
      body.appendChild(textCol);
      body.prepend(coverShell);
      li.appendChild(body);
      els.wantListItems.appendChild(li);
      continue;
    }

    const spine = document.createElement("span");
    spine.className = "book-card-spine book-card-spine--wishlist";
    spine.setAttribute("aria-hidden", "true");

    const actions = document.createElement("div");
    actions.className = "want-list-row-actions";

    const adoptBtn = document.createElement("button");
    adoptBtn.type = "button";
    adoptBtn.className = "btn-small";
    adoptBtn.textContent = "Add to library";
    adoptBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openBookModal(null, { adoptWantItemId: w.id });
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openWantModal(w.id);
    });

    const amazonLink = document.createElement("a");
    amazonLink.className = "btn-small";
    amazonLink.textContent = "Amazon";
    amazonLink.href = amazonSearchUrl(w.title, w.author, "book");
    amazonLink.target = "_blank";
    amazonLink.rel = "noopener noreferrer";
    amazonLink.addEventListener("click", (e) => e.stopPropagation());

    actions.appendChild(adoptBtn);
    actions.appendChild(editBtn);
    actions.appendChild(amazonLink);
    textCol.appendChild(actions);

    body.appendChild(textCol);
    body.prepend(cover);
    li.appendChild(spine);
    li.appendChild(body);
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

function updateBookProgressVisibility() {
  const show = els.bookReadingStatus && els.bookReadingStatus.value === "in_progress";
  els.bookProgressWrap?.classList.toggle("hidden", !show);
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

function isValidHttpUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (_) {
    return false;
  }
}

async function findModalCoverOptions() {
  const title = els.bookTitle?.value?.trim() || "";
  const author = els.bookAuthor?.value?.trim() || "";
  const isbn = els.bookIsbn?.value?.trim() || "";
  if (!title) {
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Enter a title first.";
    return;
  }
  if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Finding cover options...";
  const candidates = await fetchModalCoverCandidates(title, author, isbn);
  modalCoverCandidates = candidates;
  renderModalCoverCandidates();
  if (!candidates.length) {
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "No cover options found.";
    return;
  }
  if (!modalCoverChoice.url || modalCoverChoice.preference === "auto") {
    const first = candidates[0];
    const chain =
      Array.isArray(first.urls) && first.urls.length ? first.urls : first.url ? [first.url] : [];
    setModalCoverChoice("openlibrary", first.url, first.meta);
    updateBookCoverPreview(first.url || "", { chain });
  }
  if (els.bookCoverStatus) els.bookCoverStatus.textContent = `Found ${candidates.length} cover option(s).`;
  renderModalCoverCandidates();
}

function resetModalCoverToAuto() {
  setModalCoverChoice("auto", "", null);
  if (els.bookCoverCustomUrl) els.bookCoverCustomUrl.value = "";
  if (els.bookCoverUpload) els.bookCoverUpload.value = "";
  if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Auto uses ISBN/title/author lookup.";
  updateBookCoverPreview("");
  renderModalCoverCandidates();
}

function handleModalCoverCustomUrlInput() {
  const value = String(els.bookCoverCustomUrl?.value || "").trim();
  if (!value) {
    resetModalCoverToAuto();
    return;
  }
  if (!isValidHttpUrl(value)) {
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Custom cover URL must start with http:// or https://";
    return;
  }
  setModalCoverChoice("custom_url", value, null);
  updateBookCoverPreview(value);
  if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Using custom cover URL.";
  renderModalCoverCandidates();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

async function handleModalCoverUploadChange() {
  const file = els.bookCoverUpload?.files?.[0];
  if (!file) return;
  const maxBytes = 2 * 1024 * 1024;
  if (!String(file.type || "").startsWith("image/")) {
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Upload must be an image file.";
    if (els.bookCoverUpload) els.bookCoverUpload.value = "";
    return;
  }
  if (file.size > maxBytes) {
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Image too large (max 2MB).";
    if (els.bookCoverUpload) els.bookCoverUpload.value = "";
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    setModalCoverChoice("upload", dataUrl, null);
    if (els.bookCoverCustomUrl) els.bookCoverCustomUrl.value = "";
    updateBookCoverPreview(dataUrl);
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Using uploaded cover image.";
    renderModalCoverCandidates();
  } catch (_) {
    if (els.bookCoverStatus) els.bookCoverStatus.textContent = "Could not read the uploaded image.";
  } finally {
    if (els.bookCoverUpload) els.bookCoverUpload.value = "";
  }
}

function openBookModal(bookId, opts = {}) {
  if (els.bookDetailsOverlay && !els.bookDetailsOverlay.classList.contains("hidden")) {
    closeBookDetailsPanel();
  }
  const isEdit = !!bookId;
  const b = isEdit ? state.books.find((x) => x.id === bookId) : null;
  modalCoverCandidates = [];

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
  const seriesPrefill = opts.seriesPrefill && !isEdit ? opts.seriesPrefill : null;

  els.modalBookTitle.textContent = isEdit
    ? "Edit book"
    : adoptW
      ? "Add to library"
      : seriesPrefill
        ? "Add series volume"
        : "Add book";
  els.btnDeleteBook.hidden = !isEdit;
  fillBookShelfFormSelects();
  els.btnEditRating.hidden = !(isEdit && b && readingStatusOf(b) === "read");
  els.bookId.value = b?.id || "";

  if (isEdit && b) {
    els.bookTitle.value = b.title || "";
    els.bookAuthor.value = b.author || "";
    if (els.bookIsbn) els.bookIsbn.value = b.isbn || "";
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
    if (els.bookCurrentPage) els.bookCurrentPage.value = b.currentPage != null ? String(b.currentPage) : "";
    if (els.bookTotalPages) els.bookTotalPages.value = b.totalPages != null ? String(b.totalPages) : "";
    setModalCoverChoice(b.coverPreference || "auto", b.coverUrl || "", b.coverMeta || null);
  } else if (adoptW) {
    els.bookTitle.value = adoptW.title || "";
    els.bookAuthor.value = adoptW.author || "";
    if (els.bookIsbn) els.bookIsbn.value = "";
    els.bookType.value = "physical";
    els.bookUserShelf.value = activeUserShelfId || getDefaultShelfId(state) || "";
    els.bookReadingStatus.value = "wishlist";
    els.bookOwnership.value = "owned";
    els.bookDateUnknown.checked = false;
    els.bookFinishedDate.value = "";
    els.bookTags.value = (adoptW.tags || []).join(", ");
    els.bookRecommended.value = adoptW.recommendedBy || "";
    if (els.bookCurrentPage) els.bookCurrentPage.value = "";
    if (els.bookTotalPages) els.bookTotalPages.value = "";
    setModalCoverChoice("auto", "", null);
  } else {
    els.bookTitle.value = "";
    els.bookAuthor.value = "";
    if (els.bookIsbn) els.bookIsbn.value = "";
    els.bookType.value = "physical";
    els.bookUserShelf.value = activeUserShelfId || getDefaultShelfId(state) || "";
    els.bookReadingStatus.value = "wishlist";
    els.bookOwnership.value = "owned";
    els.bookDateUnknown.checked = false;
    els.bookFinishedDate.value = "";
    els.bookTags.value = "";
    els.bookRecommended.value = "";
    if (els.bookCurrentPage) els.bookCurrentPage.value = "";
    if (els.bookTotalPages) els.bookTotalPages.value = "";
    setModalCoverChoice("auto", "", null);
  }
  if (els.bookCoverCustomUrl) {
    els.bookCoverCustomUrl.value =
      modalCoverChoice.preference === "custom_url" && modalCoverChoice.url ? modalCoverChoice.url : "";
  }
  if (els.bookCoverUpload) {
    els.bookCoverUpload.value = "";
  }
  if (els.bookCoverStatus) {
    if (modalCoverChoice.preference === "auto") els.bookCoverStatus.textContent = "Auto uses ISBN/title/author lookup.";
    else if (modalCoverChoice.preference === "custom_url") els.bookCoverStatus.textContent = "Using custom URL.";
    else if (modalCoverChoice.preference === "upload") els.bookCoverStatus.textContent = "Using uploaded image.";
    else els.bookCoverStatus.textContent = "Using selected Open Library cover.";
  }
  {
    const m = sanitizeCoverMeta(modalCoverChoice.meta);
    const olChain =
      modalCoverChoice.preference === "openlibrary" && m?.coverType && m?.coverValue
        ? openLibraryCoverUrlChain(m.coverType, m.coverValue)
        : null;
    if (olChain && olChain.length) {
      updateBookCoverPreview(modalCoverChoice.url || olChain[0], { chain: olChain });
    } else {
      updateBookCoverPreview(modalCoverChoice.url || "");
    }
  }
  renderModalCoverCandidates();

  updateBookFinishedVisibility();
  updateBookProgressVisibility();
  updateBookDateUnknownUI();

  const hasSeries = !!(isEdit && b?.seriesId) || !!seriesPrefill;
  els.bookIsSeries.checked = hasSeries;
  els.seriesFields.classList.toggle("hidden", !hasSeries);
  if (hasSeries && b) {
    const sm = state.series.find((s) => s.id === b.seriesId);
    els.bookSeriesName.value = sm?.name || "";
    els.bookSeriesVol.value = b.volumeInSeries != null ? String(b.volumeInSeries) : "";
    els.bookSeriesTotal.value = sm?.expectedTotal != null ? String(sm.expectedTotal) : "";
    els.bookSeriesIncomplete.checked = !!sm?.publishingIncomplete;
  } else if (seriesPrefill) {
    els.bookSeriesName.value = seriesPrefill.name || "";
    els.bookSeriesVol.value = seriesPrefill.volume != null ? String(seriesPrefill.volume) : "";
    els.bookSeriesTotal.value = seriesPrefill.total != null ? String(seriesPrefill.total) : "";
    els.bookSeriesIncomplete.checked = !!seriesPrefill.publishingIncomplete;
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
  modalCoverCandidates = [];
  setModalCoverChoice("auto", "", null);
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
  const isbn = (els.bookIsbn?.value || "").trim();
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
  const totalPagesRaw = parseInt(els.bookTotalPages?.value, 10);
  const totalPages = Number.isFinite(totalPagesRaw) && totalPagesRaw > 0 ? totalPagesRaw : null;
  const currentPageRaw = parseInt(els.bookCurrentPage?.value, 10);
  let currentPage = Number.isFinite(currentPageRaw) && currentPageRaw >= 0 ? currentPageRaw : null;
  if (totalPages == null) currentPage = null;
  if (totalPages != null && currentPage != null) currentPage = Math.min(currentPage, totalPages);
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
    isbn,
    coverPreference: modalCoverChoice.preference || "auto",
    coverUrl: modalCoverChoice.preference === "auto" ? "" : modalCoverChoice.url || "",
    coverMeta: modalCoverChoice.preference === "openlibrary" ? modalCoverChoice.meta || null : null,
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
    currentPage,
    totalPages,
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

els.btnStatusColorsFull?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleStatusColorsPopover(els.btnStatusColorsFull);
});
els.btnStatusColorsMinimal?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleStatusColorsPopover(els.btnStatusColorsMinimal);
});

window.addEventListener("resize", () => {
  if (statusColorsPopoverOpen && statusColorsAnchor) positionStatusColorsPopover(statusColorsAnchor);
});

["input", "change"].forEach((ev) => {
  els.search.addEventListener(ev, () => renderBookList());
  els.sort.addEventListener(ev, () => renderBookList());
  els.filterType.addEventListener(ev, () => renderBookList());
  els.filterOwnership.addEventListener(ev, () => renderBookList());
  els.filterFavorites.addEventListener(ev, () => renderBookList());
  els.filterReadingStatus?.addEventListener(ev, () => {
    renderCozySidebar();
    renderBookList();
  });
  els.seriesFilter?.addEventListener(ev, () => {
    seriesFilterValue = els.seriesFilter.value || "all";
    renderSeries();
  });
  els.seriesSort?.addEventListener(ev, () => {
    seriesSortValue = els.seriesSort.value || "name_asc";
    renderSeries();
  });
});

els.btnAdd.addEventListener("click", () => openBookModal(null));
els.btnGoalsOpen?.addEventListener("click", () => setMainView("goals"));
els.btnFiltersToggle?.addEventListener("click", () => toggleFiltersDrawer());
els.btnViewList?.addEventListener("click", () => setBookViewMode("list"));
els.btnViewGrid?.addEventListener("click", () => setBookViewMode("grid"));
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
els.btnWantAdd?.addEventListener("click", () => openWantModal(null));
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
els.btnBookCoverFind?.addEventListener("click", () => {
  void findModalCoverOptions();
});
els.btnBookCoverResetAuto?.addEventListener("click", () => {
  resetModalCoverToAuto();
});
els.bookCoverCustomUrl?.addEventListener("change", () => {
  handleModalCoverCustomUrlInput();
});
els.bookCoverUpload?.addEventListener("change", () => {
  void handleModalCoverUploadChange();
});

els.bookReadingStatus?.addEventListener("change", () => {
  updateBookFinishedVisibility();
  updateBookProgressVisibility();
  if (els.bookReadingStatus.value !== "read") {
    els.bookDateUnknown.checked = false;
  }
  if (els.bookReadingStatus.value !== "in_progress") {
    if (els.bookCurrentPage) els.bookCurrentPage.value = "";
    if (els.bookTotalPages) els.bookTotalPages.value = "";
  }
  updateBookDateUnknownUI();
});
els.currentlyReadingPrev?.addEventListener("click", () => {
  const list = state.books.filter((b) => readingStatusOf(b) === "in_progress");
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  currentlyReadingPage = (currentlyReadingPage - 1 + pageCount) % pageCount;
  renderCurrentlyReading(list);
});
els.currentlyReadingNext?.addEventListener("click", () => {
  const list = state.books.filter((b) => readingStatusOf(b) === "in_progress");
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  currentlyReadingPage = (currentlyReadingPage + 1) % pageCount;
  renderCurrentlyReading(list);
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
els.bookDetailsOverlay?.addEventListener("click", (e) => {
  if (e.target === els.bookDetailsOverlay) closeBookDetailsPanel();
});
els.bookDetailsClose?.addEventListener("click", closeBookDetailsPanel);
els.bookDetailsCloseBtn?.addEventListener("click", closeBookDetailsPanel);
els.bookDetailsEditBtn?.addEventListener("click", () => {
  if (!activeDetailsBookId) return;
  const id = activeDetailsBookId;
  closeBookDetailsPanel();
  openBookModal(id);
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
els.seriesTabActive?.addEventListener("click", () => {
  seriesTabValue = "active";
  renderSeries();
});
els.seriesTabCompleted?.addEventListener("click", () => {
  seriesTabValue = "completed";
  renderSeries();
});
els.seriesTabArchived?.addEventListener("click", () => {
  seriesTabValue = "archived";
  renderSeries();
});
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

els.modalSeriesRateOverlay?.addEventListener("click", (e) => {
  if (e.target === els.modalSeriesRateOverlay) {
    els.modalSeriesRateOverlay.classList.add("hidden");
    els.modalSeriesRateOverlay.setAttribute("aria-hidden", "true");
    if (els.seriesRateFinishedDate) els.seriesRateFinishedDate.value = "";
    ratingSeriesId = null;
    selectedSeriesStars = null;
  }
});
els.modalSeriesRateClose?.addEventListener("click", () => {
  els.modalSeriesRateOverlay?.classList.add("hidden");
  els.modalSeriesRateOverlay?.setAttribute("aria-hidden", "true");
  if (els.seriesRateFinishedDate) els.seriesRateFinishedDate.value = "";
  ratingSeriesId = null;
  selectedSeriesStars = null;
});
els.btnSeriesRateCancel?.addEventListener("click", () => {
  els.modalSeriesRateOverlay?.classList.add("hidden");
  els.modalSeriesRateOverlay?.setAttribute("aria-hidden", "true");
  if (els.seriesRateFinishedDate) els.seriesRateFinishedDate.value = "";
  ratingSeriesId = null;
  selectedSeriesStars = null;
});
els.modalSeriesRateOverlay?.querySelectorAll("[data-series-stars]")?.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedSeriesStars = Number(btn.dataset.seriesStars);
    els.modalSeriesRateOverlay?.querySelectorAll("[data-series-stars]")?.forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.seriesStars) === selectedSeriesStars));
    });
  });
});
els.btnSeriesRateSave?.addEventListener("click", () => {
  if (!ratingSeriesId || !selectedSeriesStars) return;
  const s = (state.series || []).find((x) => x.id === ratingSeriesId);
  if (!s) return;
  s.seriesRating = selectedSeriesStars;
  s.seriesRatedAt = new Date().toISOString();
  const overrideIso = dateInputToLocalNoonISO(els.seriesRateFinishedDate?.value || "");
  if (overrideIso) s.seriesCompletedAt = overrideIso;
  persist();
  els.modalSeriesRateOverlay?.classList.add("hidden");
  els.modalSeriesRateOverlay?.setAttribute("aria-hidden", "true");
  if (els.seriesRateFinishedDate) els.seriesRateFinishedDate.value = "";
  ratingSeriesId = null;
  selectedSeriesStars = null;
  renderSeries();
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
    if (els.bookDetailsOverlay && !els.bookDetailsOverlay.classList.contains("hidden")) closeBookDetailsPanel();
    else if (els.modalSeriesRateOverlay && !els.modalSeriesRateOverlay.classList.contains("hidden")) {
      els.modalSeriesRateOverlay.classList.add("hidden");
      els.modalSeriesRateOverlay.setAttribute("aria-hidden", "true");
      ratingSeriesId = null;
      selectedSeriesStars = null;
    }
    else if (!els.modalRateOverlay.classList.contains("hidden")) closeRateModal();
    else if (!els.modalGoalOverlay.classList.contains("hidden")) closeGoalModal();
    else if (!els.modalSeriesRemoveOverlay.classList.contains("hidden")) closeSeriesRemoveConfirm();
    else if (!els.modalWantOverlay.classList.contains("hidden")) closeWantModal();
    else if (!els.modalBookOverlay.classList.contains("hidden")) closeBookModal();
    else if (statusColorsPopoverOpen) closeStatusColorsPopover();
    else {
      toggleProfileMenu(false);
      toggleSettingsMenu(false);
    }
  }
});

document.addEventListener("click", (e) => {
  const target = e.target;
  if (statusColorsPopoverOpen && els.statusColorsPopover) {
    const inPop = els.statusColorsPopover.contains(target);
    const onFull = els.btnStatusColorsFull?.contains(target);
    const onMin = els.btnStatusColorsMinimal?.contains(target);
    if (!inPop && !onFull && !onMin) closeStatusColorsPopover();
  }
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

renderAll();
initSupabaseAuth();
