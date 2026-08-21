const FIELD_MATCHERS = [
  { keys: ["first and last name", "first last name", "full name", "candidate name", "legal name", "preferred name", "name"], field: "fullName" },
  { keys: ["first name", "firstname", "given name", "given-name", "fname"], field: "firstName" },
  { keys: ["last name", "lastname", "family name", "family-name", "lname", "surname"], field: "lastName" },
  { keys: ["email", "e-mail"], field: "email" },
  { keys: ["phone", "mobile", "cell", "telephone"], field: "phone" },
  { keys: ["address line 2", "address 2", "address2", "apt", "apartment", "suite", "unit"], field: "address2" },
  { keys: ["street address", "address line 1", "address 1", "address1", "mailing address", "home address", "address"], field: "address" },
  { keys: ["city", "town", "location"], field: "city" },
  { keys: ["state", "province", "region"], field: "state" },
  { keys: ["zip", "postal", "postcode"], field: "zip" },
  { keys: ["linkedin", "linked in"], field: "linkedin" },
  { keys: ["portfolio", "personal website", "personal site", "website"], field: "website" },
  { keys: ["github", "git hub"], field: "github" },
  { keys: ["current company", "employer", "company"], field: "company" },
  { keys: ["current title", "job title", "title", "position"], field: "title" },
  { keys: ["skills", "technical skills", "core skills", "competencies"], field: "skillsText" },
  { keys: ["languages", "language"], field: "languagesText" },
  { keys: ["legally authorized to work in the country", "authorized to work in the country", "legally authorized to work in the united states", "authorized to work in the united states", "authorized", "authorised", "work authorization", "eligible to work"], field: "workAuthorization" },
  { keys: ["will you now or in the future require sponsorship", "require sponsorship for employment visa status", "employment visa status", "sponsorship", "visa sponsorship", "require sponsorship"], field: "sponsorship" }
];

const EDUCATION_MATCHERS = [
  { keys: ["school", "university", "college", "institution"], field: "school" },
  { keys: ["degree", "qualification"], field: "degree" },
  { keys: ["field of study", "major", "concentration", "discipline"], field: "fieldOfStudy" },
  { keys: ["graduation year", "grad year", "year completed", "completion year"], field: "graduationYear" }
];

const EXPERIENCE_MATCHERS = [
  { keys: ["company", "employer", "organization", "organisation"], field: "company" },
  { keys: ["title", "job title", "position", "role"], field: "title" },
  { keys: ["start date", "from date", "started", "start"], field: "startDate" },
  { keys: ["end date", "to date", "ended", "end"], field: "endDate" },
  { keys: ["location", "city", "office"], field: "location" },
  { keys: ["description", "responsibilities", "achievements", "summary"], field: "description" }
];

const STATE_ALIASES = {
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  dc: "district of columbia",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming"
};

const filledOriginals = new WeakMap();
const filledFields = new Set();
const STORAGE_KEY = "jobAutofillProfile";
const FLOATING_BUTTON_COMMAND_KEY = "jobAutofillFloatingButtonCommand";
const FLOATING_BUTTON_VISIBLE_KEY = "jobAutofillFloatingButtonVisible";
const FLOATING_BUTTON_ID = "job-autofill-floating-button";
const FLOATING_BUTTON_MARGIN = 8;
let floatingButtonObserver = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOB_AUTOFILL_FILL") {
    const count = fillJobApplication(message.profile || {});

    if (count > 0 || window.top !== window) {
      sendResponse({ count });
    } else {
      setTimeout(() => sendResponse({ count: 0 }), 120);
    }

    return true;
  }

  if (message?.type === "JOB_AUTOFILL_CLEAR") {
    const count = clearFilledFields();

    if (count > 0 || window.top !== window) {
      sendResponse({ count });
    } else {
      setTimeout(() => sendResponse({ count: 0 }), 120);
    }

    return true;
  }

  if (message?.type === "JOB_AUTOFILL_SHOW_FLOATING_BUTTON") {
    sendResponse({ shown: showFloatingFillButton() });
    return false;
  }

  if (message?.type === "JOB_AUTOFILL_HIDE_FLOATING_BUTTON") {
    sendResponse({ removed: hideFloatingFillButton() });
    return false;
  }

  if (message?.type === "JOB_AUTOFILL_GET_JOB_INFO") {
    if (window.top !== window) {
      return false;
    }

    sendResponse({ job: getCurrentJobInfo() });
    return false;
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[FLOATING_BUTTON_VISIBLE_KEY]) {
    setFloatingButtonVisible(changes[FLOATING_BUTTON_VISIBLE_KEY].newValue === true);
  }

  if (changes[FLOATING_BUTTON_COMMAND_KEY]?.newValue) {
    handleFloatingButtonCommand(changes[FLOATING_BUTTON_COMMAND_KEY].newValue);
  }
});

restoreFloatingButtonVisibility();

function fillJobApplication(profile) {
  let count = 0;
  const fields = getFillableFields();
  const usage = {};

  fields.forEach((field) => {
    try {
      if (field.disabled || field.readOnly || getInputType(field) === "hidden") {
        return;
      }

      const context = getFieldContext(field);
      const match = getProfileMatch(context, profile, usage, field);

      if (!match?.value) {
        return;
      }

      if (requiresRequiredField(match.field) && !isRequiredField(field)) {
        return;
      }

      if (applyValue(field, match.value, match.field)) {
        if (match.repeatKey) {
          usage[match.repeatKey] = (usage[match.repeatKey] || 0) + 1;
        }
        count += 1;
      }
    } catch (error) {
      console.warn("Job Autofill skipped a field after an error.", error, field);
    }
  });

  return count;
}

function getCurrentJobInfo() {
  return {
    savedAt: new Date().toISOString(),
    jobTitle: getJobTitle(),
    company: getCompanyName(),
    location: getJobLocation(),
    pageTitle: document.title || "",
    url: window.location.href,
    source: window.location.hostname,
    notes: ""
  };
}

function getJobTitle() {
  return firstText([
    "[data-automation-id='jobPostingHeader']",
    "[data-testid='job-title']",
    "[class*='job'][class*='title' i]",
    "[class*='position'][class*='title' i]",
    "h1"
  ]) || cleanTitle(document.title);
}

function getCompanyName() {
  const company = getKnownCareerSiteCompanyName() || getAshbyCompanyName() || firstMeta(["og:site_name", "application-name"]) || firstText([
    "[data-testid='company-name']",
    "[class*='company' i]",
    "[class*='employer' i]"
  ]);

  if (company) {
    return company;
  }

  return window.location.hostname.replace(/^www\./, "");
}

function getKnownCareerSiteCompanyName() {
  const host = window.location.hostname.toLowerCase().replace(/^www\./, "");
  const knownCompanies = {
    "stripe.com": "Stripe"
  };

  return knownCompanies[host] || "";
}

function getAshbyCompanyName() {
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith("ashbyhq.com")) {
    return "";
  }

  const [companySlug] = window.location.pathname.split("/").filter(Boolean);
  return titleCaseSlug(companySlug);
}

function titleCaseSlug(value) {
  return String(value || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getJobLocation() {
  return firstText([
    "[data-testid='job-location']",
    "[class*='location' i]",
    "[class*='office' i]"
  ]);
}

function firstText(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = normalizeWhitespace(element?.textContent || "");
    if (text) {
      return text;
    }
  }

  return "";
}

function firstMeta(names) {
  for (const name of names) {
    const element = document.querySelector(`meta[property="${cssEscape(name)}"], meta[name="${cssEscape(name)}"]`);
    const text = normalizeWhitespace(element?.content || "");
    if (text) {
      return text;
    }
  }

  return "";
}

function cleanTitle(title) {
  return normalizeWhitespace(String(title || "").split("|")[0].split(" - ")[0]);
}

function handleFloatingButtonCommand(command) {
  if (!command?.action || document.visibilityState === "hidden") {
    return;
  }

  if (Date.now() - Number(command.issuedAt || 0) > 5000) {
    return;
  }

  if (command.action === "show") {
    showFloatingFillButton();
  }

  if (command.action === "hide") {
    hideFloatingFillButton();
  }
}

async function restoreFloatingButtonVisibility() {
  const result = await chrome.storage.local.get(FLOATING_BUTTON_VISIBLE_KEY);
  if (result[FLOATING_BUTTON_VISIBLE_KEY] === true) {
    showFloatingFillButton();
  }
}

function setFloatingButtonVisible(isVisible) {
  if (isVisible) {
    showFloatingFillButton();
  } else {
    hideFloatingFillButton();
  }
}

function showFloatingFillButton() {
  if (document.getElementById(FLOATING_BUTTON_ID)) {
    return true;
  }

  const added = addFloatingFillButton();

  if (!added) {
    watchForFloatingButtonFields();
    window.setTimeout(addFloatingFillButton, 800);
  }

  return added;
}

function hideFloatingFillButton() {
  floatingButtonObserver?.disconnect();
  floatingButtonObserver = null;

  const button = document.getElementById(FLOATING_BUTTON_ID);
  if (!button) {
    return false;
  }

  button.remove();
  return true;
}

function addFloatingFillButton() {
  if (!document.body || document.getElementById(FLOATING_BUTTON_ID) || getFillableFields().length === 0) {
    return false;
  }

  const button = document.createElement("button");
  const label = document.createElement("span");
  const close = document.createElement("span");

  button.id = FLOATING_BUTTON_ID;
  button.type = "button";
  button.title = "Fill job application fields";
  button.setAttribute("aria-label", "Fill job application fields");
  label.dataset.role = "label";
  label.textContent = "Fill";
  close.dataset.role = "close";
  close.textContent = "x";
  close.setAttribute("role", "button");
  close.setAttribute("aria-label", "Hide floating fill button");
  close.setAttribute("title", "Hide");
  Object.assign(button.style, {
    position: "fixed",
    right: "16px",
    top: "16px",
    zIndex: "2147483647",
    border: "0",
    borderRadius: "999px",
    padding: "10px 18px 10px 16px",
    background: "#1769aa",
    color: "#ffffff",
    font: "600 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.24)",
    cursor: "grab",
    overflow: "visible",
    touchAction: "none",
    userSelect: "none"
  });
  Object.assign(close.style, {
    position: "absolute",
    top: "-7px",
    right: "-7px",
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "#ffffff",
    font: "700 11px/1 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    boxShadow: "0 3px 10px rgba(15, 23, 42, 0.24)",
    cursor: "pointer"
  });
  button.addEventListener("mouseenter", () => {
    button.style.background = "#0f5f9e";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "#1769aa";
  });
  close.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideFloatingButtonEverywhere();
  });
  makeFloatingButtonDraggable(button);
  button.addEventListener("click", handleFloatingFillClick);
  button.append(label, close);
  document.body.append(button);
  return true;
}

async function hideFloatingButtonEverywhere() {
  await chrome.storage.local.set({
    [FLOATING_BUTTON_VISIBLE_KEY]: false,
    [FLOATING_BUTTON_COMMAND_KEY]: {
      action: "hide",
      issuedAt: Date.now()
    }
  });
  hideFloatingFillButton();
}

function watchForFloatingButtonFields() {
  if (!window.MutationObserver || floatingButtonObserver) {
    return;
  }

  const startObserver = () => {
    if (!document.body || document.getElementById(FLOATING_BUTTON_ID)) {
      return;
    }

    floatingButtonObserver = new MutationObserver(() => {
      if (addFloatingFillButton()) {
        floatingButtonObserver?.disconnect();
        floatingButtonObserver = null;
      }
    });

    floatingButtonObserver.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => {
      floatingButtonObserver?.disconnect();
      floatingButtonObserver = null;
    }, 15000);
  };

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }
}

function makeFloatingButtonDraggable(button) {
  let dragState = null;

  button.addEventListener("pointerdown", (event) => {
    if (button.disabled || event.button !== 0) {
      return;
    }

    const rect = button.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      dragged: false
    };

    button.setPointerCapture(event.pointerId);
    button.style.cursor = "grabbing";
  });

  button.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (distance > 4) {
      dragState.dragged = true;
    }

    if (!dragState.dragged) {
      return;
    }

    event.preventDefault();
    moveFloatingButton(button, event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
  });

  button.addEventListener("pointerup", (event) => {
    finishFloatingButtonDrag(button, event);
  });

  button.addEventListener("pointercancel", (event) => {
    finishFloatingButtonDrag(button, event);
  });

  button.addEventListener("click", (event) => {
    if (button.dataset.dragged === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      button.dataset.dragged = "false";
    }
  }, true);

  function finishFloatingButtonDrag(target, event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    target.releasePointerCapture(event.pointerId);
    target.style.cursor = "grab";
    target.dataset.dragged = dragState.dragged ? "true" : "false";
    dragState = null;
  }
}

function moveFloatingButton(button, left, top) {
  const maxLeft = window.innerWidth - button.offsetWidth - FLOATING_BUTTON_MARGIN;
  const maxTop = window.innerHeight - button.offsetHeight - FLOATING_BUTTON_MARGIN;
  const nextLeft = clamp(left, FLOATING_BUTTON_MARGIN, Math.max(FLOATING_BUTTON_MARGIN, maxLeft));
  const nextTop = clamp(top, FLOATING_BUTTON_MARGIN, Math.max(FLOATING_BUTTON_MARGIN, maxTop));

  button.style.left = `${nextLeft}px`;
  button.style.top = `${nextTop}px`;
  button.style.right = "auto";
  button.style.bottom = "auto";
}

async function handleFloatingFillClick(event) {
  const button = event.currentTarget;
  const label = button.querySelector("[data-role='label']");
  const originalText = label?.textContent || "Fill";

  button.disabled = true;
  if (label) {
    label.textContent = "Filling";
  }

  try {
    const profile = await loadSavedProfile();
    if (!profile || Object.keys(profile).length === 0) {
      if (label) {
        label.textContent = "No profile";
      }
      window.setTimeout(() => {
        if (label) {
          label.textContent = originalText;
        }
        button.disabled = false;
      }, 1400);
      return;
    }

    const count = fillJobApplication(profile);
    if (label) {
      label.textContent = `Filled ${count}`;
    }
  } catch (_error) {
    console.warn("Job Autofill floating button failed.", _error);
    if (label) {
      label.textContent = "Try popup";
    }
  }

  window.setTimeout(() => {
    if (label) {
      label.textContent = originalText;
    }
    button.disabled = false;
  }, 1400);
}

async function loadSavedProfile() {
  const localResult = await chrome.storage.local.get(STORAGE_KEY);
  if (localResult?.[STORAGE_KEY]) {
    return localResult[STORAGE_KEY];
  }

  const syncResult = await chrome.storage.sync.get(STORAGE_KEY);
  return syncResult?.[STORAGE_KEY] || {};
}

function clearFilledFields() {
  let count = 0;

  for (const field of Array.from(filledFields)) {
    const original = filledOriginals.get(field);
    if (!original) {
      continue;
    }

    if (field.tagName === "SELECT") {
      field.selectedIndex = original.selectedIndex;
    } else if (getInputType(field) === "radio") {
      field.checked = original.checked;
    } else {
      field.value = original.value;
    }

    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    filledOriginals.delete(field);
    filledFields.delete(field);
    count += 1;
  }

  return count;
}

function getFillableFields() {
  return Array.from(document.querySelectorAll("input, textarea, select, button, [role='button'], [role='radio']")).filter((field) => {
    if (field.id === FLOATING_BUTTON_ID || field.closest?.(`#${FLOATING_BUTTON_ID}`)) {
      return false;
    }

    const type = getInputType(field);
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName)) {
      return isCustomBooleanOption(field);
    }

    return !["button", "checkbox", "color", "file", "image", "password", "reset", "submit"].includes(type);
  });
}

function getProfileMatch(context, profile, usage, field) {
  const customMatch = getCustomMatch(context, profile);
  if (customMatch) {
    return customMatch;
  }

  const repeatMatch = getRepeatMatch(context, profile, usage);
  const baseMatch = getBaseMatch(context, profile, field);

  if (repeatMatch && (!baseMatch || repeatMatch.score > baseMatch.score)) {
    return repeatMatch;
  }

  return baseMatch;
}

function getBaseMatch(context, profile, fieldElement) {
  let bestMatch = null;

  for (const matcher of FIELD_MATCHERS) {
    if (isDisqualifiedMatch(context, matcher.field, fieldElement)) {
      continue;
    }

    const score = getMatcherScore(context, matcher);

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        field: matcher.field,
        score,
        value: profile[matcher.field] || ""
      };
    }
  }

  return bestMatch;
}

function isDisqualifiedMatch(context, field, fieldElement) {
  const text = context.all.join(" ");

  if (["fullName", "firstName", "lastName"].includes(field) && isReferralOrSourceContext(context)) {
    return true;
  }

  if (["fullName", "firstName", "lastName"].includes(field) && isNamePronunciationContext(context)) {
    return true;
  }

  if (["fullName", "firstName", "lastName"].includes(field) && isMiddleNameContext(context)) {
    return true;
  }

  if ((field === "firstName" || field === "lastName") && isCombinedNameContext(context)) {
    return true;
  }

  if (field === "phone" && isPhoneExtensionContext(context)) {
    return true;
  }

  if (["workAuthorization", "sponsorship"].includes(field) && isEeoSelfIdentificationContext(context)) {
    return true;
  }

  if (isBooleanChoiceField(fieldElement) && field === "workAuthorization" && !isWorkAuthorizationQuestionContext(context)) {
    return true;
  }

  if (isBooleanChoiceField(fieldElement) && field === "sponsorship" && !isSponsorshipQuestionContext(context)) {
    return true;
  }

  if (field === "workAuthorization" && isSponsorshipQuestionContext(context)) {
    return true;
  }

  if (field === "sponsorship" && isWorkAuthorizationQuestionContext(context)) {
    return true;
  }

  if (field === "address" || field === "address2") {
    return includesPhrase(text, "email") || includesPhrase(text, "e mail");
  }

  if (field === "website") {
    return isGenericUrlContext(context);
  }

  return false;
}

function isBooleanChoiceField(field) {
  return getInputType(field) === "radio" || isCustomBooleanOption(field);
}

function isEeoSelfIdentificationContext(context) {
  const text = context.all.join(" ");
  const eeoWords = [
    "disability status",
    "veteran status",
    "protected veteran",
    "self identification",
    "self identify",
    "voluntary self identification",
    "demographic",
    "gender",
    "race",
    "ethnicity",
    "hispanic",
    "latino",
    "prefer not to answer"
  ];

  return eeoWords.some((word) => includesPhrase(text, word));
}

function isWorkAuthorizationQuestionContext(context) {
  const text = context.all.join(" ");
  const authorizationWords = [
    "legally authorized to work",
    "authorized to work",
    "legally authorized to work in the country",
    "authorized to work in the country",
    "country for which you are applying",
    "eligible to work",
    "work authorization"
  ];

  return authorizationWords.some((word) => includesPhrase(text, word));
}

function isSponsorshipQuestionContext(context) {
  const text = context.all.join(" ");
  const sponsorshipWords = [
    "require sponsorship",
    "require sponsorship for employment visa status",
    "require sponsorship to work",
    "require sponsorship for an immigration related employment benefit",
    "immigration related employment benefit",
    "immigration sponsorship",
    "visa sponsorship"
  ];

  return sponsorshipWords.some((word) => includesPhrase(text, word));
}

function isMiddleNameContext(context) {
  const text = context.all.join(" ");
  const middleNameWords = ["middle name", "middle initial", "middle", "mi"];

  return middleNameWords.some((word) => includesPhrase(text, word));
}

function isNamePronunciationContext(context) {
  const text = context.all.join(" ");
  const pronunciationWords = ["pronunciation", "pronouciation", "pronounce", "phonetic", "name pronunciation"];

  return pronunciationWords.some((word) => includesPhrase(text, word));
}

function isPhoneExtensionContext(context) {
  const text = context.all.join(" ");
  const extensionWords = ["phone extension", "extension", "ext"];

  return extensionWords.some((word) => includesPhrase(text, word));
}

function isReferralOrSourceContext(context) {
  const text = context.all.join(" ");
  const referralWords = ["referral", "referring", "referred", "employee referral", "referring person"];
  const sourceWords = ["heard about us", "hear about us", "where you heard", "how did you hear", "source"];

  return (
    referralWords.some((word) => includesPhrase(text, word)) ||
    sourceWords.some((word) => includesPhrase(text, word))
  );
}

function isCombinedNameContext(context) {
  const text = context.all.join(" ");

  return (
    includesPhrase(text, "first and last name") ||
    includesPhrase(text, "first last name") ||
    (includesPhrase(text, "first") && includesPhrase(text, "last") && includesPhrase(text, "name"))
  );
}

function isGenericUrlContext(context) {
  const text = context.all.join(" ");
  const allowed = ["portfolio", "personal website", "personal site", "website"];
  const generic = ["url", "link", "links", "homepage", "home page"];

  return generic.some((word) => includesPhrase(text, word)) && !allowed.some((word) => includesPhrase(text, word));
}

function getRepeatMatch(context, profile, usage) {
  const educationMatch = getEntryMatch({
    context,
    entries: profile.educationEntries || [],
    matchers: EDUCATION_MATCHERS,
    collection: "education",
    sectionWords: ["education", "school", "university", "college", "academic"],
    usage
  });
  const experienceMatch = getEntryMatch({
    context,
    entries: profile.experienceEntries || [],
    matchers: EXPERIENCE_MATCHERS,
    collection: "experience",
    sectionWords: ["experience", "employment", "work history", "job history", "professional"],
    usage
  });

  if (educationMatch && experienceMatch) {
    return educationMatch.score >= experienceMatch.score ? educationMatch : experienceMatch;
  }

  return educationMatch || experienceMatch;
}

function getEntryMatch({ context, entries, matchers, collection, sectionWords, usage }) {
  if (!entries.length) {
    return null;
  }

  const sectionScore = sectionWords.some((word) => context.section.some((part) => includesPhrase(part, normalize(word)))) ? 18 : 0;
  if (collection === "experience" && sectionScore === 0) {
    return null;
  }

  let bestMatch = null;

  for (const matcher of matchers) {
    const score = getMatcherScore(context, matcher) + sectionScore;

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      const repeatKey = `${collection}.${matcher.field}`;
      const startIndex = usage[repeatKey] || 0;
      const entryIndex = getEntryIndex(entries, matcher.field, startIndex);

      if (entryIndex !== -1) {
        bestMatch = {
          field: `${collection}.${matcher.field}`,
          repeatKey,
          score,
          value: entries[entryIndex][matcher.field] || ""
        };
      }
    }
  }

  return bestMatch;
}

function getEntryIndex(entries, field, startIndex) {
  for (let index = startIndex; index < entries.length; index += 1) {
    if (entries[index]?.[field]) {
      return index;
    }
  }

  return -1;
}

function getCustomMatch(context, profile) {
  for (const customAnswer of profile.customAnswers || []) {
    const label = normalize(customAnswer.label);
    if (customAnswer.value && label && context.all.some((part) => includesPhrase(part, label))) {
      return {
        field: "custom",
        value: customAnswer.value
      };
    }
  }

  return null;
}

function getMatcherScore(context, matcher) {
  let score = 0;

  for (const key of matcher.keys) {
    const normalizedKey = normalize(key);
    const keyWeight = Math.min(normalizedKey.length, 20);

    score = Math.max(score, getBestPartScore(context.labels, normalizedKey, 100 + keyWeight));
    score = Math.max(score, getBestPartScore(context.attributes, normalizedKey, 70 + keyWeight));
    score = Math.max(score, getBestPartScore(context.nearby, normalizedKey, 35 + keyWeight));
  }

  return score;
}

function getBestPartScore(parts, normalizedKey, baseScore) {
  return parts.some((part) => includesPhrase(part, normalizedKey)) ? baseScore : 0;
}

function getFieldContext(field) {
  const visualLabelText = getVisualLabelText(field);
  const attributes = normalizeParts([
    field.name,
    field.id,
    field.autocomplete,
    field.placeholder,
    field.getAttribute("aria-label")
  ]);
  const labels = normalizeParts([getLabelText(field), visualLabelText, getRadioGroupText(field), getCustomBooleanGroupText(field)]);
  const nearby = normalizeParts([getNearbyText(field)]);
  const section = normalizeParts([getSectionText(field)]);

  return {
    attributes,
    labels,
    nearby,
    section,
    all: [...attributes, ...labels, ...nearby]
  };
}

function getLabelText(field) {
  const labels = Array.from(field.labels || []).map((label) => label.innerText);

  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach((id) => {
      const labelElement = document.getElementById(id);
      if (labelElement) {
        labels.push(labelElement.innerText || labelElement.textContent);
      }
    });
  }

  if (field.id) {
    const explicitLabel = document.querySelector(`label[for="${cssEscape(field.id)}"]`);
    if (explicitLabel) {
      labels.push(explicitLabel.innerText);
    }
  }

  return labels.join(" ");
}

function getRadioGroupText(field) {
  if (getInputType(field) !== "radio") {
    return "";
  }

  const group = getRadioGroupContainer(field);
  if (!group) {
    return "";
  }

  const legend = group.querySelector?.("legend, [role='heading'], h1, h2, h3, h4");
  const groupText = legend?.textContent || group.textContent || "";
  const questionText = getNearbyQuestionText(group);

  if (groupText.length <= 400) {
    return `${groupText} ${questionText}`;
  }

  return `${getPreviousSiblingText(group).slice(0, 220)} ${questionText}`;
}

function getRadioGroupContainer(field) {
  const explicitGroup = field.closest("fieldset, [role='radiogroup']");
  if (explicitGroup) {
    return explicitGroup;
  }

  if (!field.name) {
    return field.closest("div, section, li, form");
  }

  const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${cssEscape(field.name)}"]`));
  if (radios.length <= 1) {
    return field.closest("div, section, li, form");
  }

  return radios.reduce((ancestor, radio) => getCommonAncestor(ancestor, radio), radios[0].parentElement) || field.parentElement;
}

function getCommonAncestor(first, second) {
  if (!first || !second) {
    return first || second;
  }

  let ancestor = first;
  while (ancestor && !ancestor.contains(second)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor;
}

function getCustomBooleanGroupText(field) {
  if (!isCustomBooleanOption(field)) {
    return "";
  }

  const group = getCustomBooleanGroupContainer(field);
  if (!group) {
    return "";
  }

  const heading = group.querySelector?.("legend, [role='heading'], h1, h2, h3, h4");
  const groupText = heading?.textContent || group.textContent || "";
  const questionText = getNearbyQuestionText(group);

  if (groupText.length <= 500) {
    return `${groupText} ${questionText}`;
  }

  return `${getPreviousSiblingText(group).slice(0, 260)} ${questionText}`;
}

function getCustomBooleanGroupContainer(field) {
  const explicitGroup = field.closest("[role='radiogroup'], fieldset");
  if (explicitGroup) {
    return explicitGroup;
  }

  const parent = field.closest("div, section, li, fieldset, form");
  if (!parent) {
    return null;
  }

  const options = Array.from(parent.querySelectorAll("button, [role='button'], [role='radio']"))
    .filter((option) => option !== field && isCustomBooleanOption(option));

  if (options.length > 0) {
    return parent;
  }

  return parent.parentElement?.closest("div, section, li, fieldset, form") || parent;
}

function getVisualLabelText(field) {
  const parts = [];
  let element = field;
  let depth = 0;

  while (element && depth < 5) {
    const previous = element.previousElementSibling;
    if (previous && !previous.querySelector("input, textarea, select")) {
      parts.push(previous.textContent || "");
    }

    const parent = element.parentElement;
    if (parent) {
      const parentText = Array.from(parent.childNodes)
        .filter((node) => node !== element && !node.querySelector?.("input, textarea, select"))
        .map((node) => node.textContent || "")
        .join(" ");

      if (parentText.length <= 120) {
        parts.push(parentText);
      }
    }

    element = parent;
    depth += 1;
  }

  return parts.join(" ");
}

function getNearbyQuestionText(element) {
  const parts = [];
  let current = element;
  let depth = 0;

  while (current && depth < 5) {
    const previousText = getPreviousSiblingText(current);
    if (previousText) {
      parts.push(previousText);
    }

    const parent = current.parentElement;
    const heading = parent?.querySelector?.("legend, [role='heading'], h1, h2, h3, h4");
    if (heading && !current.contains(heading)) {
      parts.push(heading.textContent || "");
    }

    current = parent;
    depth += 1;
  }

  return parts.join(" ").slice(0, 500);
}

function getNearbyText(field) {
  const parent = field.closest("label, div, p, section, fieldset, li, tr");
  if (!parent) {
    return "";
  }

  const siblingText = getPreviousSiblingText(field);
  if (siblingText) {
    return siblingText;
  }

  if (parent.querySelectorAll("input, textarea, select").length > 1) {
    return "";
  }

  return Array.from(parent.childNodes)
    .filter((node) => node !== field && !node.querySelector?.("input, textarea, select"))
    .map((node) => node.textContent || "")
    .join(" ")
    .slice(0, 160);
}

function getSectionText(field) {
  const section = field.closest("fieldset, section, article, form");
  if (!section) {
    return "";
  }

  const heading = section.querySelector("legend, h1, h2, h3, h4, [role='heading']");
  return heading?.textContent || "";
}

function getPreviousSiblingText(field) {
  const parts = [];
  let node = field.previousSibling;

  while (node && parts.join(" ").length < 120) {
    if (node.textContent) {
      parts.unshift(node.textContent);
    }
    node = node.previousSibling;
  }

  return parts.join(" ").trim();
}

function requiresRequiredField(fieldName) {
  return ["address", "address2", "skillsText", "languagesText"].includes(fieldName);
}

function isRequiredField(field) {
  if (field.required || field.getAttribute("aria-required") === "true") {
    return true;
  }

  const requiredText = [
    getLabelText(field),
    getVisualLabelText(field),
    getNearbyText(field)
  ].join(" ");

  return requiredText.includes("*");
}

function applyValue(field, value, profileField) {
  if (isCustomBooleanOption(field)) {
    return selectCustomBooleanOption(field, value, profileField);
  }

  if (getInputType(field) === "radio") {
    return selectRadioOption(field, value, profileField);
  }

  if (field.tagName === "SELECT") {
    return selectOption(field, value, profileField);
  }

  if (field.value === value) {
    return false;
  }

  rememberOriginalValue(field);
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function selectOption(select, value, profileField) {
  const normalizedValues = getSelectValues(value, profileField);
  const option = getClosestOption(select, normalizedValues, normalize(value), profileField);

  if (!option || select.value === option.value) {
    return false;
  }

  rememberOriginalValue(select);
  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function selectCustomBooleanOption(option, value, profileField) {
  if (!isMatchingBooleanOption(option, value, profileField)) {
    return false;
  }

  if (isCustomOptionSelected(option)) {
    return false;
  }

  rememberOriginalValue(option);
  option.focus?.();
  option.click();
  option.dispatchEvent(new Event("input", { bubbles: true }));
  option.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function selectRadioOption(radio, value, profileField) {
  if (!isMatchingBooleanOption(radio, value, profileField)) {
    return false;
  }

  if (radio.checked) {
    return false;
  }

  rememberOriginalValue(radio);
  radio.focus();
  radio.click();
  radio.dispatchEvent(new Event("input", { bubbles: true }));
  radio.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function isMatchingBooleanOption(option, value, profileField) {
  const normalizedProfileValue = normalize(value);
  const normalizedValues = getSelectValues(value, profileField);
  const optionValues = getBooleanOptionValues(option);

  if (["workAuthorization", "sponsorship"].includes(profileField) && isBooleanProfileValue(normalizedProfileValue)) {
    return isExpectedBooleanOption(optionValues, normalizedProfileValue, profileField);
  }

  let bestScore = 0;

  for (const optionValue of optionValues) {
    if (includesPhrase(optionValue, "prefer not to answer")) {
      continue;
    }

    if (isOppositeBooleanOption(optionValue, normalizedProfileValue, profileField)) {
      continue;
    }

    for (const target of normalizedValues) {
      bestScore = Math.max(bestScore, getOptionScore(optionValue, target));
    }
  }

  return bestScore >= 0.5;
}

function getBooleanOptionValues(option) {
  return normalizeParts([
    option.value,
    option.textContent,
    getLabelText(option),
    option.getAttribute("aria-label")
  ]);
}

function isBooleanProfileValue(value) {
  return ["yes", "y", "true", "no", "n", "false"].includes(value);
}

function isExpectedBooleanOption(optionValues, normalizedProfileValue, profileField) {
  if (optionValues.some((optionValue) => includesPhrase(optionValue, "prefer not to answer"))) {
    return false;
  }

  const wantsYes = ["yes", "y", "true"].includes(normalizedProfileValue);
  const wantsNo = ["no", "n", "false"].includes(normalizedProfileValue);
  const positive = optionValues.some((optionValue) => isPositiveBooleanOptionText(optionValue, profileField));
  const negative = optionValues.some((optionValue) => isNegativeBooleanOptionText(optionValue, profileField));

  if (wantsYes) {
    return positive && !negative;
  }

  if (wantsNo) {
    return negative;
  }

  return false;
}

function isPositiveBooleanOptionText(value, profileField) {
  const baseWords = ["yes", "y", "true"];
  const profileWords = profileField === "workAuthorization"
    ? ["authorized", "eligible"]
    : ["require sponsorship", "need sponsorship", "will require sponsorship"];

  return includesAnyPhrase(value, [...baseWords, ...profileWords]);
}

function isNegativeBooleanOptionText(value, profileField) {
  const baseWords = ["no", "n", "false", "not"];
  const profileWords = profileField === "sponsorship"
    ? ["do not require sponsorship", "will not require sponsorship", "no sponsorship"]
    : ["not authorized", "not eligible"];

  return includesAnyPhrase(value, [...baseWords, ...profileWords]);
}

function isCustomBooleanOption(field) {
  if (!field?.tagName) {
    return false;
  }

  if (["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName)) {
    return false;
  }

  if (field.disabled || field.getAttribute("aria-disabled") === "true") {
    return false;
  }

  const text = normalize([field.textContent, field.getAttribute("aria-label"), field.getAttribute("value")].filter(Boolean).join(" "));
  return ["yes", "no", "y", "n"].includes(text);
}

function isCustomOptionSelected(option) {
  if (["true", "mixed"].includes(option.getAttribute("aria-checked")) ||
      ["true", "mixed"].includes(option.getAttribute("aria-pressed")) ||
      option.getAttribute("aria-selected") === "true") {
    return true;
  }

  return /\b(selected|active|checked)\b/i.test(option.className || "");
}

function isMatchingRadioOption(radio, value, profileField) {
  return isMatchingBooleanOption(radio, value, profileField);
}

function rememberOriginalValue(field) {
  if (filledOriginals.has(field)) {
    return;
  }

  filledOriginals.set(field, {
    checked: field.checked,
    selectedIndex: field.selectedIndex,
    value: field.value
  });
  filledFields.add(field);
}

function getClosestOption(select, normalizedValues, normalizedProfileValue, profileField) {
  let best = null;

  for (const option of Array.from(select.options)) {
    if (!option.value && !option.textContent.trim()) {
      continue;
    }

    const optionValues = [normalize(option.value), normalize(option.textContent)].filter(Boolean);

    for (const target of normalizedValues) {
      for (const optionValue of optionValues) {
        if (isOppositeBooleanOption(optionValue, normalizedProfileValue, profileField)) {
          continue;
        }

        const score = getOptionScore(optionValue, target);

        if (!best || score > best.score) {
          best = { option, score };
        }
      }
    }
  }

  return best?.score >= 0.5 ? best.option : null;
}

function isOppositeBooleanOption(optionValue, normalizedProfileValue, profileField) {
  if (!["workAuthorization", "sponsorship"].includes(profileField)) {
    return false;
  }

  const wantsYes = ["yes", "y", "true"].includes(normalizedProfileValue);
  const wantsNo = ["no", "n", "false"].includes(normalizedProfileValue);

  if (!wantsYes && !wantsNo) {
    return false;
  }

  const negative = includesAnyPhrase(optionValue, ["no", "not", "do not", "does not", "will not", "without"]);
  const positive = includesAnyPhrase(optionValue, ["yes", "authorized", "eligible", "require sponsorship", "need sponsorship", "will require sponsorship"]);

  if (wantsYes) {
    return negative;
  }

  if (profileField === "workAuthorization") {
    return positive && !negative;
  }

  return includesAnyPhrase(optionValue, ["yes", "require sponsorship", "need sponsorship", "will require sponsorship"]) && !negative;
}

function getOptionScore(optionValue, target) {
  if (!optionValue || !target) {
    return 0;
  }

  if (optionValue === target) {
    return 1;
  }

  if (optionValue.includes(target) || target.includes(optionValue)) {
    return 0.86;
  }

  const optionTokens = new Set(optionValue.split(" "));
  const targetTokens = target.split(" ");
  const sharedTokens = targetTokens.filter((token) => optionTokens.has(token)).length;
  const tokenScore = sharedTokens / Math.max(optionTokens.size, targetTokens.length);
  const distanceScore = 1 - levenshtein(optionValue, target) / Math.max(optionValue.length, target.length);

  return Math.max(tokenScore, distanceScore);
}

function getSelectValues(value, profileField) {
  const normalizedValue = normalize(value);
  const values = new Set([normalizedValue]);

  getBooleanSelectValues(normalizedValue, profileField).forEach((selectValue) => values.add(selectValue));

  if (profileField === "state") {
    const stateName = STATE_ALIASES[normalizedValue];
    if (stateName) {
      values.add(stateName);
    }

    const stateCode = Object.entries(STATE_ALIASES).find(([, name]) => name === normalizedValue)?.[0];
    if (stateCode) {
      values.add(stateCode);
    }
  }

  return Array.from(values).filter(Boolean);
}

function getBooleanSelectValues(normalizedValue, profileField) {
  if (!["workAuthorization", "sponsorship"].includes(profileField)) {
    return [];
  }

  const isYes = ["yes", "y", "true"].includes(normalizedValue);
  const isNo = ["no", "n", "false"].includes(normalizedValue);

  if (!isYes && !isNo) {
    return [];
  }

  if (profileField === "workAuthorization") {
    return isYes
      ? normalizeParts(["yes", "true", "authorized", "legally authorized", "i am authorized", "eligible to work", "authorized to work in the united states"])
      : normalizeParts(["no", "false", "not authorized", "i am not authorized", "not eligible to work", "not authorized to work in the united states"]);
  }

  return isYes
    ? normalizeParts(["yes", "true", "require sponsorship", "need sponsorship", "will require sponsorship", "i require sponsorship", "visa sponsorship required"])
    : normalizeParts(["no", "false", "do not require sponsorship", "does not require sponsorship", "will not require sponsorship", "i do not require sponsorship", "no sponsorship", "no visa sponsorship required"]);
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function normalizeParts(parts) {
  return parts.map(normalize).filter(Boolean);
}

function includesPhrase(text, phrase) {
  if (!text || !phrase) {
    return false;
  }

  return new RegExp(`(^| )${escapeRegExp(phrase)}($| )`).test(text);
}

function includesAnyPhrase(text, phrases) {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getInputType(field) {
  return (field?.getAttribute?.("type") || "").toLowerCase();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}
