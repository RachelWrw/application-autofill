const STORAGE_KEY = "jobAutofillProfile";
const FLOATING_BUTTON_COMMAND_KEY = "jobAutofillFloatingButtonCommand";
const FLOATING_BUTTON_VISIBLE_KEY = "jobAutofillFloatingButtonVisible";

const form = document.querySelector("#profileForm");
const statusEl = document.querySelector("#status");
const customFieldsEl = document.querySelector("#customFields");
const educationEntriesEl = document.querySelector("#educationEntries");
const experienceEntriesEl = document.querySelector("#experienceEntries");
const resumeFileEl = document.querySelector("#resumeFile");
const deleteResumeButton = document.querySelector("#deleteResume");
const resumeUploadRow = document.querySelector("#resumeUploadRow");
const linkEntriesEl = document.querySelector("#linkEntries");
const skillChipsEl = document.querySelector("#skillChips");
const languageChipsEl = document.querySelector("#languageChips");
const editPanel = document.querySelector("#editPanel");
const profileAvatar = document.querySelector("#profileAvatar");
const summaryName = document.querySelector("#summaryName");
const summaryLocation = document.querySelector("#summaryLocation");
const summaryEmail = document.querySelector("#summaryEmail");
const summaryPhone = document.querySelector("#summaryPhone");
const summaryLinkedin = document.querySelector("#summaryLinkedin");
const saveButton = document.querySelector("#saveProfile");
const fillButton = document.querySelector("#fillPage");
const clearButton = document.querySelector("#clearPage");
const showFloatingButton = document.querySelector("#showFloatingButton");
const hideFloatingButton = document.querySelector("#hideFloatingButton");
const addCustomButton = document.querySelector("#addCustom");
const refreshResumeButton = document.querySelector("#refreshResume");
const toggleEditButton = document.querySelector("#toggleEdit");

let customAnswers = [];
let educationEntries = [];
let experienceEntries = [];
let parsedSkills = [];
let parsedLanguages = [];
let resumeText = "";
let resumeUpdatedAt = "";
let resumeFileName = "";

function setStatus(message) {
  statusEl.textContent = message;
}

function readForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    ...data,
    resumeText,
    resumeUpdatedAt,
    resumeFileName,
    parsedSkills,
    parsedLanguages,
    skillsText: uniqueList([...parsedSkills, ...splitList(data.skills)]).join(", "),
    languagesText: uniqueList([...parsedLanguages, ...splitList(data.languages)]).join(", "),
    fullName: [data.firstName, data.lastName].filter(Boolean).join(" "),
    educationEntries: compactEntries(educationEntries),
    experienceEntries: compactEntries(experienceEntries),
    customAnswers: customAnswers
      .map((answer) => ({
        label: answer.label.trim(),
        value: answer.value.trim()
      }))
      .filter((answer) => answer.label && answer.value)
  };
}

function writeForm(profile = {}) {
  for (const element of form.elements) {
    if (element.name && Object.prototype.hasOwnProperty.call(profile, element.name)) {
      element.value = profile[element.name] || "";
    }
  }
  resumeText = profile.resumeText || "";
  resumeUpdatedAt = profile.resumeUpdatedAt || "";
  resumeFileName = profile.resumeFileName || "";
  parsedSkills = Array.isArray(profile.parsedSkills) ? profile.parsedSkills : [];
  parsedLanguages = Array.isArray(profile.parsedLanguages) ? profile.parsedLanguages : [];
  customAnswers = Array.isArray(profile.customAnswers) ? profile.customAnswers : [];
  educationEntries = Array.isArray(profile.educationEntries) ? profile.educationEntries : [];
  experienceEntries = Array.isArray(profile.experienceEntries) ? profile.experienceEntries : [];
  refreshSummary();
  renderResumeUpload();
  renderLinks();
  renderChips();
  renderCustomAnswers();
  renderEducationEntries();
  renderExperienceEntries();
}

function compactEntries(entries) {
  return entries
    .map((entry) => Object.fromEntries(
      Object.entries(entry).map(([key, value]) => [key, String(value || "").trim()])
    ))
    .filter((entry) => Object.values(entry).some(Boolean));
}

function renderCustomAnswers() {
  customFieldsEl.replaceChildren();

  if (customAnswers.length === 0) {
    addCustomAnswer();
    return;
  }

  customAnswers.forEach((answer, index) => {
    const row = document.createElement("div");
    row.className = "custom-row";
    row.innerHTML = `
      <label>
        <span>Field text</span>
        <input data-custom-label="${index}" placeholder="e.g. salary expectation">
      </label>
      <label>
        <span>Answer</span>
        <input data-custom-value="${index}" placeholder="e.g. Open to discussion">
      </label>
      <button class="remove-custom" type="button" title="Remove custom answer" aria-label="Remove custom answer">×</button>
    `;

    row.querySelector("[data-custom-label]").value = answer.label || "";
    row.querySelector("[data-custom-value]").value = answer.value || "";
    row.querySelector("[data-custom-label]").addEventListener("input", (event) => {
      customAnswers[index].label = event.target.value;
    });
    row.querySelector("[data-custom-value]").addEventListener("input", (event) => {
      customAnswers[index].value = event.target.value;
    });
    row.querySelector(".remove-custom").addEventListener("click", () => {
      customAnswers.splice(index, 1);
      renderCustomAnswers();
    });

    customFieldsEl.append(row);
  });
}

function addCustomAnswer() {
  customAnswers.push({ label: "", value: "" });
  renderCustomAnswers();
}

function renderEducationEntries() {
  renderDisplayEntries({
    container: educationEntriesEl,
    entries: educationEntries,
    type: "education"
  });
}

function renderResumeUpload() {
  resumeUploadRow.replaceChildren();

  const source = resumeFileName ? `${resumeFileName} - ` : "";
  const label = resumeUpdatedAt ? `${source}Updated ${resumeUpdatedAt}` : "No resume uploaded";
  resumeUploadRow.append(
    resourceBadge("doc", "R"),
    resourceBody("Resume", label, resumeText ? "Preview" : "", () => copyText(resumeText))
  );
}

function renderLinks() {
  const profile = readBasicForm();
  const links = [
    ["LinkedIn", profile.linkedin, "in", "linkedin"],
    ["GitHub", profile.github, "GH", "github"],
    ["Portfolio", profile.website, "P", "portfolio"],
    ["Additional", profile.additionalLink, "L", "additional"]
  ].filter(([, value]) => value);

  linkEntriesEl.replaceChildren();

  if (links.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No links yet";
    linkEntriesEl.append(empty);
    return;
  }

  links.forEach(([label, value, badge, tone]) => {
    const row = document.createElement("div");
    row.className = "resource-row";
    row.append(
      resourceBadge(tone, badge),
      resourceBody(label, value, "", () => copyText(value))
    );
    linkEntriesEl.append(row);
  });
}

function renderChips() {
  const profile = readBasicForm();
  const skills = uniqueList([...parsedSkills, ...splitList(profile.skills)]);
  const languages = uniqueList([...parsedLanguages, ...splitList(profile.languages)]);

  renderChipList(skillChipsEl, skills);
  renderChipList(languageChipsEl, languages);
}

function renderChipList(container, items) {
  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No items yet";
    container.append(empty);
    return;
  }

  items.forEach((item) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = item;
    chip.addEventListener("click", () => copyText(item));
    container.append(chip);
  });
}

function resourceBadge(tone, text) {
  const badge = document.createElement("div");
  badge.className = `resource-badge ${tone}`;
  badge.textContent = text;
  return badge;
}

function resourceBody(title, value, actionText, action) {
  const body = document.createElement("div");
  body.className = "resource-body";
  body.append(
    copyButton(title, "resource-title"),
    copyButton(value, "resource-value")
  );

  if (actionText) {
    const actionButton = document.createElement("button");
    actionButton.className = "resource-action";
    actionButton.type = "button";
    actionButton.textContent = actionText;
    actionButton.addEventListener("click", action);
    body.append(actionButton);
  }

  return body;
}

function renderExperienceEntries() {
  renderDisplayEntries({
    container: experienceEntriesEl,
    entries: experienceEntries,
    type: "experience"
  });
}

function renderDisplayEntries({ container, entries, type }) {
  container.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No entries yet";
    container.append(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const card = document.createElement("div");
    card.className = "timeline-item";

    const marker = document.createElement("div");
    marker.className = "entry-marker";
    marker.textContent = type === "education" ? "E" : "W";

    const body = document.createElement("div");
    body.className = "entry-body";

    if (type === "education") {
      body.append(
        copyButton(entry.school || "School", "entry-primary"),
        copyButton([entry.degree, entry.fieldOfStudy].filter(Boolean).join(", "), "entry-secondary"),
        copyButton(entry.graduationYear || "", "entry-secondary")
      );
    } else {
      body.append(
        copyButton(entry.title || "Role", "entry-primary"),
        copyButton([entry.company, entry.location].filter(Boolean).join(" - "), "entry-secondary"),
        copyButton([entry.startDate, entry.endDate].filter(Boolean).join(" - "), "entry-secondary")
      );

      if (entry.description) {
        body.append(copyButton(entry.description, "entry-description"));
      }
    }

    card.append(marker, body);
    container.append(card);
  });
}

function copyButton(value, className) {
  const button = document.createElement("button");
  button.className = `copy-value ${className}`;
  button.type = "button";
  button.textContent = value || "";
  button.dataset.copy = value || "";
  button.hidden = !value;
  button.addEventListener("click", () => copyText(value));
  return button;
}

function refreshSummary() {
  const profile = readBasicForm();
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const initials = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .map((name) => name.trim()[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  profileAvatar.textContent = initials || "JA";
  setCopyValue(summaryName, fullName || "Your Name");
  setCopyValue(summaryLocation, location || "City, State");
  setCopyValue(summaryEmail, profile.email || "Email");
  setCopyValue(summaryPhone, profile.phone || "Phone");
  setCopyValue(summaryLinkedin, profile.linkedin || "LinkedIn");
  renderLinks();
  renderChips();
}

function readBasicForm() {
  return Object.fromEntries(new FormData(form).entries());
}

function setCopyValue(element, value) {
  element.textContent = value;
  element.dataset.copy = value;
  element.classList.toggle("is-placeholder", !value || ["Your Name", "City, State", "Email", "Phone", "LinkedIn"].includes(value));
}

function schoolInitials(name, index) {
  if (!name) {
    return String(index + 1);
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function copyText(value) {
  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setStatus("Copied");
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    setStatus(copied ? "Copied" : "Copy failed");
  }
}

async function saveProfile() {
  const profile = readForm();
  await chrome.storage.local.set({ [STORAGE_KEY]: profile });
  setStatus("Saved");
}

async function loadProfile() {
  const localResult = await chrome.storage.local.get(STORAGE_KEY);

  if (localResult[STORAGE_KEY]) {
    writeForm(localResult[STORAGE_KEY]);
    setStatus("Ready");
    return;
  }

  const syncResult = await chrome.storage.sync.get(STORAGE_KEY);
  if (syncResult[STORAGE_KEY]) {
    writeForm(syncResult[STORAGE_KEY]);
    await saveProfile();
    setStatus("Ready");
    return;
  }

  writeForm({});
  setStatus("Ready");
}

async function refreshResumeEntries() {
  const parsed = parseResume(resumeText);

  if (parsed.hasEducationSection) {
    educationEntries = parsed.educationEntries;
  }

  if (parsed.hasExperienceSection) {
    experienceEntries = parsed.experienceEntries;
  }

  if (parsed.hasSkillsSection) {
    parsedSkills = parsed.skills;
  }

  if (parsed.hasLanguagesSection) {
    parsedLanguages = parsed.languages;
  }

  resumeUpdatedAt = resumeText.trim() ? new Date().toLocaleString() : "";
  renderResumeUpload();
  renderEducationEntries();
  renderExperienceEntries();
  renderChips();
  await saveProfile();
}

async function handleResumeFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  setStatus("Reading resume");

  try {
    const buffer = await file.arrayBuffer();
    const text = await extractResumeText(file, buffer);

    resumeFileName = file.name;
    resumeText = text;
    await refreshResumeEntries();
    setStatus("Resume parsed");
  } catch (error) {
    setStatus(error.message || "Could not parse resume");
  } finally {
    resumeFileEl.value = "";
  }
}

async function deleteResume() {
  resumeText = "";
  resumeFileName = "";
  resumeUpdatedAt = "";
  educationEntries = [];
  experienceEntries = [];
  parsedSkills = [];
  parsedLanguages = [];
  renderResumeUpload();
  renderEducationEntries();
  renderExperienceEntries();
  renderChips();
  await saveProfile();
}

async function extractResumeText(file, buffer) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    return extractDocxText(buffer);
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(buffer);
  }

  throw new Error("Use a PDF or DOCX file");
}

async function extractDocxText(buffer) {
  const files = await readZipFiles(buffer);
  const documentXml = files["word/document.xml"];

  if (!documentXml) {
    throw new Error("Could not read Word document");
  }

  return documentXml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:t[^>]*>/g, "")
    .replace(/<\/w:t>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readZipFiles(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const files = {};
  let offset = 0;

  while (offset < bytes.length - 30) {
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const fileName = decodeBytes(bytes.slice(offset + 30, offset + 30 + fileNameLength));
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = bytes.slice(dataStart, dataEnd);

    if (!fileName.endsWith("/")) {
      files[fileName] = method === 8
        ? decodeBytes(await inflateBytes(compressed, "deflate-raw"))
        : decodeBytes(compressed);
    }

    offset = dataEnd;
  }

  return files;
}

async function extractPdfText(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [decodeBytes(bytes)];
  const streams = findPdfStreams(bytes);

  for (const stream of streams) {
    try {
      chunks.push(decodeBytes(await inflateBytes(stream, "deflate")));
    } catch (error) {
      chunks.push(decodeBytes(stream));
    }
  }

  const text = chunks
    .flatMap((chunk) => extractPdfTextRuns(chunk))
    .join("\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    throw new Error("Could not read text from PDF");
  }

  return text;
}

function findPdfStreams(bytes) {
  const marker = new TextEncoder().encode("stream");
  const endMarker = new TextEncoder().encode("endstream");
  const streams = [];
  let index = 0;

  while (index < bytes.length) {
    const start = indexOfBytes(bytes, marker, index);
    if (start === -1) {
      break;
    }

    let dataStart = start + marker.length;
    if (bytes[dataStart] === 13 && bytes[dataStart + 1] === 10) {
      dataStart += 2;
    } else if (bytes[dataStart] === 10) {
      dataStart += 1;
    }

    const end = indexOfBytes(bytes, endMarker, dataStart);
    if (end === -1) {
      break;
    }

    let dataEnd = end;
    while (dataEnd > dataStart && (bytes[dataEnd - 1] === 10 || bytes[dataEnd - 1] === 13)) {
      dataEnd -= 1;
    }

    streams.push(bytes.slice(dataStart, dataEnd));
    index = end + endMarker.length;
  }

  return streams;
}

function extractPdfTextRuns(value) {
  const runs = [];
  const literalPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayPattern = /\[(.*?)\]\s*TJ/gs;
  let match;

  while ((match = literalPattern.exec(value))) {
    runs.push(decodePdfString(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  while ((match = arrayPattern.exec(value))) {
    const parts = Array.from(match[1].matchAll(/\((?:\\.|[^\\)])*\)/g))
      .map((part) => decodePdfString(part[0].slice(1, -1)));
    if (parts.length) {
      runs.push(parts.join(""));
    }
  }

  return runs.map((run) => run.trim()).filter(Boolean);
}

function decodePdfString(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

async function inflateBytes(bytes, format) {
  if (!("DecompressionStream" in window)) {
    throw new Error("Compressed file parsing is not supported in this browser");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function indexOfBytes(source, target, startIndex = 0) {
  for (let index = startIndex; index <= source.length - target.length; index += 1) {
    let matches = true;
    for (let cursor = 0; cursor < target.length; cursor += 1) {
      if (source[index + cursor] !== target[cursor]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return index;
    }
  }

  return -1;
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function parseResume(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, arr) => line || arr[index - 1]);
  const educationLines = extractSection(lines, "education");
  const experienceLines = extractSection(lines, "experience");
  const skillLines = extractSection(lines, "skills");
  const languageLines = extractSection(lines, "languages");

  return {
    hasEducationSection: educationLines !== null,
    hasExperienceSection: experienceLines !== null,
    hasSkillsSection: skillLines !== null,
    hasLanguagesSection: languageLines !== null,
    educationEntries: parseEducation(educationLines || []),
    experienceEntries: parseExperience(experienceLines || []),
    skills: parseListSection(skillLines || []),
    languages: parseListSection(languageLines || [])
  };
}

function extractSection(lines, sectionName) {
  const sectionAliases = {
    education: ["education", "academic background"],
    experience: ["experience", "work", "work experience", "professional experience", "employment", "work history"],
    skills: ["skills", "technical skills", "core skills", "competencies"],
    languages: ["languages", "language"]
  };
  const stopHeadings = [
    ...Object.values(sectionAliases).flat(),
    "additional information",
    "additional data",
    "additional details",
    "additional",
    "awards",
    "certifications",
    "certificates",
    "contact",
    "interests",
    "links",
    "objective",
    "portfolio",
    "projects",
    "publications",
    "references",
    "summary",
    "volunteer",
    "volunteer experience"
  ];
  const aliases = sectionAliases[sectionName];
  const start = lines.findIndex((line) => aliases.includes(normalizeLine(line)));

  if (start === -1) {
    return null;
  }

  const end = lines.findIndex((line, index) => {
    return index > start && stopHeadings.includes(normalizeLine(line));
  });

  return lines.slice(start + 1, end === -1 ? lines.length : end);
}

function isResumeStopHeading(line) {
  const stopHeadings = [
    "additional information",
    "additional",
    "awards",
    "certifications",
    "certificates",
    "contact",
    "education",
    "interests",
    "languages",
    "links",
    "objective",
    "portfolio",
    "projects",
    "publications",
    "references",
    "skills",
    "summary",
    "technical skills",
    "volunteer",
    "volunteer experience"
  ];

  return stopHeadings.includes(normalizeLine(line));
}

function parseEducation(lines) {
  return chunkLines(lines).map((block) => {
    const dateLine = block.find((line) => /\b(19|20)\d{2}\b/.test(line)) || "";
    const detailLine = block.find((line) => line !== block[0] && line !== dateLine) || "";
    const [degree, fieldOfStudy] = detailLine.split(",").map((part) => part.trim());

    return {
      school: block[0] || "",
      degree: degree || "",
      fieldOfStudy: fieldOfStudy || "",
      graduationYear: dateLine
    };
  }).filter((entry) => entry.school || entry.degree || entry.graduationYear);
}

function parseExperience(lines) {
  return buildWorkBlocks(lines).map(parseWorkBlock).filter((entry) => entry.title || entry.company);
}

function buildWorkBlocks(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (isResumeStopHeading(line)) {
      break;
    }

    if (!line) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }

    if (current.length && looksLikeWorkStart(line, current)) {
      blocks.push(current);
      current = [];
    }

    current.push(line);
  }

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
}

function looksLikeWorkStart(line, current) {
  const currentHasDate = current.some(isDateLine);
  const currentHasDescription = current.some((item) => /^[-•*]\s+/.test(item));
  const lineLooksLikeTitle = !isDateLine(line) && !/^[-•*]\s+/.test(line) && line.length < 90;

  return currentHasDate && currentHasDescription && lineLooksLikeTitle;
}

function parseWorkBlock(block) {
  const usefulLines = block.filter((line) => line && !isResumeStopHeading(line));
  const dateIndex = usefulLines.findIndex(isDateLine);
  const dateLine = dateIndex !== -1 ? usefulLines[dateIndex] : "";
  const dateInfo = dateLine ? parseWorkDateLine(dateLine) : { dates: ["", ""], remainder: "" };
  const labeled = getLabeledWorkFields(usefulLines);
  const unlabeled = usefulLines.filter((line) => {
    return line !== dateLine && !isLabeledWorkLine(line) && !/^[-•*]\s+/.test(line);
  });
  const title = labeled.title || labeled.position || unlabeled[0] || "";
  const companyLine = labeled.company || dateInfo.remainder || unlabeled.find((line) => line !== title && !isLikelySummaryLine(line)) || "";
  const [companyFromLine, locationFromLine] = splitCompanyLocation(companyLine);
  const company = companyFromLine;
  const location = labeled.location || locationFromLine;
  const startDate = labeled.dates?.[0] || dateInfo.dates[0];
  const endDate = labeled.dates?.[1] || dateInfo.dates[1];
  const description = formatDescription(usefulLines, {
    title,
    company,
    location,
    startDate,
    endDate
  });

  return {
    title,
    company,
    location,
    startDate,
    endDate,
    description
  };
}

function getLabeledWorkFields(lines) {
  const fields = {};

  lines.forEach((line) => {
    const match = line.match(/^(title|position|role|company|employer|location|dates?)\s*:\s*(.+)$/i);
    if (!match) {
      return;
    }

    const key = normalizeLine(match[1]);
    const value = match[2].trim();

    if (key === "date" || key === "dates") {
      fields.dates = splitDateRange(value);
    } else {
      fields[key] = value;
    }
  });

  return fields;
}

function isLabeledWorkLine(line) {
  return /^(title|position|role|company|employer|location|dates?)\s*:/i.test(line);
}

function splitCompanyLocation(value) {
  const parts = value.split(/\s+[•|]\s+|\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const locationMatch = value.match(/^(.+?)\s+([A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:,\s*USA)?)$/);
    if (locationMatch) {
      return [locationMatch[1].trim(), locationMatch[2].trim()];
    }
  }

  return [parts[0] || "", parts.slice(1).join(" - ")];
}

function isDateLine(line) {
  return /\b(19|20)\d{2}\b|present|current/i.test(line);
}

function parseWorkDateLine(line) {
  const datePattern = "(?:[A-Za-z]{3,9}\\s+)?(?:19|20)\\d{2}";
  const match = line.match(new RegExp(`^\\s*(${datePattern})\\s*(?:-|–|—|to)\\s*((?:present|current)|${datePattern})\\b(.*)$`, "i"));

  if (!match) {
    return {
      dates: splitDateRange(line),
      remainder: ""
    };
  }

  return {
    dates: [match[1].trim(), match[2].trim()],
    remainder: match[3].trim()
  };
}

function isLikelySummaryLine(line) {
  return line.length > 100 || /^(led|managed|built|created|developed|implemented|owned|drove|improved|reduced|increased)\b/i.test(line);
}

function formatDescription(lines, role = {}) {
  const seen = new Set();

  return lines
    .filter((line) => isDescriptionLine(line, role))
    .flatMap((line) => line.split(/\s+[•*]\s+|\s+-\s+(?=[A-Z0-9])/))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => isDescriptionText(line, role))
    .filter((line) => {
      const key = normalizeComparable(line);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function isDescriptionLine(line, role) {
  if (!line || isResumeStopHeading(line) || isDateLine(line) || isLabeledWorkLine(line)) {
    return false;
  }

  const cleanLine = normalizeComparable(line);
  const rolePieces = [role.title, role.company, role.location, role.startDate, role.endDate].filter(Boolean);

  if (rolePieces.some((piece) => cleanLine === normalizeComparable(piece))) {
    return false;
  }

  if (role.title && cleanLine.startsWith(normalizeComparable(role.title))) {
    return false;
  }

  if (role.company && cleanLine.includes(normalizeComparable(role.company)) && role.location && cleanLine.includes(normalizeComparable(role.location))) {
    return false;
  }

  return /^[-•*]\s+/.test(line) || line.length > 60;
}

function isDescriptionText(text, role) {
  const cleanText = normalizeComparable(text);
  const rolePieces = [role.title, role.company, role.location, role.startDate, role.endDate].filter(Boolean).map(normalizeComparable);

  return !rolePieces.includes(cleanText);
}

function normalizeComparable(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseListSection(lines) {
  return uniqueList(lines.flatMap((line) => {
    return line
      .replace(/^[-•]\s*/, "")
      .split(/,|;|\s{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
  }));
}

function chunkLines(lines) {
  const chunks = [];
  let current = [];

  for (const line of lines) {
    if (!line) {
      if (current.length) {
        chunks.push(current);
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
}

function splitDateRange(value) {
  const parts = value.split(/\s+-\s+|\s+to\s+/i).map((part) => part.trim());
  return [parts[0] || "", parts[1] || ""];
}

function normalizeLine(value) {
  return value.toLowerCase().replace(/[^a-z ]+/g, "").replace(/\s+/g, " ").trim();
}

function splitList(value) {
  return String(value || "")
    .split(/,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fillPage() {
  await saveProfile();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("No active tab found");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "JOB_AUTOFILL_FILL",
      profile: readForm()
    });
    setStatus(`Filled ${response?.count || 0} field${response?.count === 1 ? "" : "s"}`);
  } catch (error) {
    setStatus("Refresh the page, then try again");
  }
}

async function clearPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("No active tab found");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "JOB_AUTOFILL_CLEAR"
    });
    setStatus(`Cleared ${response?.count || 0} field${response?.count === 1 ? "" : "s"}`);
  } catch (error) {
    setStatus("Refresh the page, then try again");
  }
}

async function showPageButton() {
  await saveProfile();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("No active tab found");
    return;
  }

  try {
    await chrome.storage.local.set({
      [FLOATING_BUTTON_VISIBLE_KEY]: true,
      [FLOATING_BUTTON_COMMAND_KEY]: {
        action: "show",
        issuedAt: Date.now()
      }
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "JOB_AUTOFILL_SHOW_FLOATING_BUTTON"
    }).catch(() => {});
    setStatus("Button shown");
  } catch (error) {
    setStatus("Refresh the page, then try again");
  }
}

async function hidePageButton() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("No active tab found");
    return;
  }

  try {
    await chrome.storage.local.set({
      [FLOATING_BUTTON_VISIBLE_KEY]: false,
      [FLOATING_BUTTON_COMMAND_KEY]: {
        action: "hide",
        issuedAt: Date.now()
      }
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "JOB_AUTOFILL_HIDE_FLOATING_BUTTON"
    }).catch(() => {});
    setStatus("Button hidden");
  } catch (error) {
    setStatus("Refresh the page, then try again");
  }
}

saveButton.addEventListener("click", saveProfile);
fillButton.addEventListener("click", fillPage);
clearButton.addEventListener("click", clearPage);
showFloatingButton.addEventListener("click", showPageButton);
hideFloatingButton.addEventListener("click", hidePageButton);
addCustomButton.addEventListener("click", addCustomAnswer);
refreshResumeButton.addEventListener("click", refreshResumeEntries);
resumeFileEl.addEventListener("change", handleResumeFile);
deleteResumeButton.addEventListener("click", deleteResume);
toggleEditButton.addEventListener("click", () => {
  editPanel.hidden = !editPanel.hidden;
  toggleEditButton.textContent = editPanel.hidden ? "Edit" : "Done";
});
document.querySelectorAll(".copy-value").forEach((button) => {
  button.addEventListener("click", () => copyText(button.dataset.copy));
});
form.addEventListener("input", () => {
  refreshSummary();
  setStatus("Unsaved changes");
});
form.addEventListener("change", () => {
  refreshSummary();
  setStatus("Unsaved changes");
});

loadProfile();
