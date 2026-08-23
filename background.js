const STORAGE_KEY = "jobAutofillProfile";
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "JOB_AUTOFILL_SAVE_JOB") {
    return false;
  }

  saveJobFromPage(message.job || {})
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, message: error.message || "Could not save job" }));

  return true;
});

async function saveJobFromPage(job) {
  const profile = await loadSavedProfile();
  const spreadsheetId = normalizeSpreadsheetId(profile.jobSheetId);
  const range = normalizeJobSheetRange(profile.jobSheetRange);

  if (!spreadsheetId) {
    throw new Error("Add Sheet ID");
  }

  return saveJobWithGoogleSheets({ spreadsheetId, range, job });
}

async function loadSavedProfile() {
  const localResult = await chrome.storage.local.get(STORAGE_KEY);
  if (localResult?.[STORAGE_KEY]) {
    return localResult[STORAGE_KEY];
  }

  const syncResult = await chrome.storage.sync.get(STORAGE_KEY);
  return syncResult?.[STORAGE_KEY] || {};
}

function normalizeJobSheetRange(value) {
  const range = String(value || "").trim();

  if (!range || /^'?sheet1'?!a:[dh]$/i.test(range)) {
    return "'Full Time'!A:D";
  }

  return range;
}

function normalizeSpreadsheetId(value) {
  const text = String(value || "").trim();
  const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

  return match?.[1] || text;
}

async function getGoogleAccessToken() {
  let result;

  try {
    result = await chrome.identity.getAuthToken({ interactive: true });
  } catch (error) {
    const message = String(error?.message || error || "");
    if (message.toLowerCase().includes("bad client id")) {
      throw new Error("Check OAuth client ID");
    }

    throw error;
  }

  const token = typeof result === "string" ? result : result?.token;

  if (!token) {
    throw new Error("Google sign-in needed");
  }

  return token;
}

async function saveJobWithGoogleSheets({ spreadsheetId, range, job }) {
  let token = await getGoogleAccessToken();

  try {
    return await saveJobToSheetWithToken({ token, spreadsheetId, range, job });
  } catch (error) {
    if (error.status !== 401) {
      throw error;
    }

    await removeCachedGoogleToken(token);
    token = await getGoogleAccessToken();
    return saveJobToSheetWithToken({ token, spreadsheetId, range, job });
  }
}

async function saveJobToSheetWithToken({ token, spreadsheetId, range, job }) {
  const existingJobs = await getExistingJobsFromSheet({ token, spreadsheetId, range });
  const duplicate = findSimilarSavedJob(job, existingJobs);
  const result = await appendJobToSheet({ token, spreadsheetId, range, job });

  return duplicate ? { ...result, duplicate } : result;
}

async function removeCachedGoogleToken(token) {
  if (!token) {
    return;
  }

  try {
    await chrome.identity.removeCachedAuthToken({ token });
  } catch (_error) {
    // The retry will surface the original auth problem if token removal fails.
  }
}

async function appendJobToSheet({ token, spreadsheetId, range, job }) {
  const url = `${SHEETS_BASE_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: [[
        cleanCompanyName(job.company),
        job.jobTitle || "",
        cleanJobUrl(job.url),
        formatSheetDate(new Date())
      ]]
    })
  });

  if (!response.ok) {
    throw await googleSheetsError(response, "Google Sheets save failed");
  }

  return response.json();
}

async function getExistingJobsFromSheet({ token, spreadsheetId, range }) {
  const url = `${SHEETS_BASE_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw await googleSheetsError(response, "Could not check existing jobs");
  }

  const body = await response.json();
  return (body.values || []).map((row, index) => ({
    rowNumber: index + 1,
    company: String(row[0] || "").trim(),
    position: String(row[1] || "").trim(),
    link: String(row[2] || "").trim()
  })).filter((entry) => {
    return entry.rowNumber > 1 && (entry.company || entry.position || entry.link);
  });
}

async function googleSheetsError(response, fallbackMessage) {
  let message = fallbackMessage;

  try {
    const body = await response.json();
    message = body?.error?.message || message;
  } catch (_error) {
    // Keep the fallback message.
  }

  if (response.status === 404 || message.toLowerCase().includes("requested entity was not found")) {
    message = "Sheet or tab not found";
  }

  const error = new Error(message);
  error.status = response.status;
  return error;
}

function findSimilarSavedJob(job, existingJobs) {
  const current = {
    company: normalizeComparable(job.company),
    position: normalizeComparable(job.jobTitle),
    link: cleanJobUrl(job.url)
  };

  return existingJobs.find((entry) => {
    const saved = {
      company: normalizeComparable(entry.company),
      position: normalizeComparable(entry.position),
      link: cleanJobUrl(entry.link)
    };

    if (current.link && saved.link && current.link === saved.link) {
      return true;
    }

    if (!current.company || !current.position || !saved.company || !saved.position) {
      return false;
    }

    return similarityScore(current.company, saved.company) >= 0.82
      && similarityScore(current.position, saved.position) >= 0.78;
  });
}

function cleanJobUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (_error) {
    return String(value || "").split("?")[0].split("#")[0];
  }
}

function cleanCompanyName(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      return cleanCompanyName(new URL(text).hostname);
    } catch (_error) {
      return "";
    }
  }

  const withoutWww = text.replace(/^www\./i, "");
  const domainMatch = withoutWww.match(/^([a-z0-9][a-z0-9-]*)(?:\.(?:com|co|io|ai|net|org))+$/i);
  if (domainMatch) {
    return titleCaseWords(domainMatch[1]);
  }

  return text;
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatSheetDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function similarityScore(left, right) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.9;
  }

  return 1 - levenshteinDistance(left, right) / Math.max(left.length, right.length);
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let last = i - 1;
    previous[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const old = previous[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, last + cost);
      last = old;
    }
  }

  return previous[right.length];
}

function normalizeComparable(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
