const FIELD_MATCHERS = [
  { keys: ["first name", "firstname", "given name", "given-name", "fname"], field: "firstName" },
  { keys: ["last name", "lastname", "family name", "family-name", "lname", "surname"], field: "lastName" },
  { keys: ["full name", "candidate name", "legal name", "preferred name", "name"], field: "fullName" },
  { keys: ["email", "e-mail"], field: "email" },
  { keys: ["phone", "mobile", "cell", "telephone"], field: "phone" },
  { keys: ["address line 2", "address 2", "address2", "apt", "apartment", "suite", "unit"], field: "address2" },
  { keys: ["street address", "address line 1", "address 1", "address1", "mailing address", "home address", "address"], field: "address" },
  { keys: ["city", "town", "location"], field: "city" },
  { keys: ["state", "province", "region"], field: "state" },
  { keys: ["zip", "postal", "postcode"], field: "zip" },
  { keys: ["linkedin", "linked in"], field: "linkedin" },
  { keys: ["portfolio", "website", "personal site", "url"], field: "website" },
  { keys: ["github", "git hub"], field: "github" },
  { keys: ["current company", "employer", "company"], field: "company" },
  { keys: ["current title", "job title", "title", "position"], field: "title" },
  { keys: ["skills", "technical skills", "core skills", "competencies"], field: "skillsText" },
  { keys: ["languages", "language"], field: "languagesText" },
  { keys: ["authorized", "authorised", "work authorization", "eligible to work"], field: "workAuthorization" },
  { keys: ["sponsorship", "visa sponsorship", "require sponsorship"], field: "sponsorship" }
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

  return false;
});

function fillJobApplication(profile) {
  let count = 0;
  const fields = getFillableFields();
  const usage = {};

  fields.forEach((field) => {
    if (field.disabled || field.readOnly || field.type === "hidden") {
      return;
    }

    const context = getFieldContext(field);
    const match = getProfileMatch(context, profile, usage);

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
  });

  return count;
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
  return Array.from(document.querySelectorAll("input, textarea, select")).filter((field) => {
    const type = (field.getAttribute("type") || "").toLowerCase();
    return !["button", "checkbox", "color", "file", "image", "password", "radio", "reset", "submit"].includes(type);
  });
}

function getProfileMatch(context, profile, usage) {
  const customMatch = getCustomMatch(context, profile);
  if (customMatch) {
    return customMatch;
  }

  const repeatMatch = getRepeatMatch(context, profile, usage);
  const baseMatch = getBaseMatch(context, profile);

  if (repeatMatch && (!baseMatch || repeatMatch.score > baseMatch.score)) {
    return repeatMatch;
  }

  return baseMatch;
}

function getBaseMatch(context, profile) {
  let bestMatch = null;

  for (const matcher of FIELD_MATCHERS) {
    if (isDisqualifiedMatch(context, matcher.field)) {
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

function isDisqualifiedMatch(context, field) {
  const text = context.all.join(" ");

  if (field === "address" || field === "address2") {
    return includesPhrase(text, "email") || includesPhrase(text, "e mail");
  }

  return false;
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
  const labels = normalizeParts([getLabelText(field), visualLabelText]);
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
  const option = getClosestOption(select, normalizedValues);

  if (!option || select.value === option.value) {
    return false;
  }

  rememberOriginalValue(select);
  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function rememberOriginalValue(field) {
  if (filledOriginals.has(field)) {
    return;
  }

  filledOriginals.set(field, {
    selectedIndex: field.selectedIndex,
    value: field.value
  });
  filledFields.add(field);
}

function getClosestOption(select, normalizedValues) {
  let best = null;

  for (const option of Array.from(select.options)) {
    if (!option.value && !option.textContent.trim()) {
      continue;
    }

    const optionValues = [normalize(option.value), normalize(option.textContent)].filter(Boolean);

    for (const target of normalizedValues) {
      for (const optionValue of optionValues) {
        const score = getOptionScore(optionValue, target);

        if (!best || score > best.score) {
          best = { option, score };
        }
      }
    }
  }

  return best?.score >= 0.5 ? best.option : null;
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

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
