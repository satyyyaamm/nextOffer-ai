/**
 * Clean ATS resume PDF export (Helvetica-safe ASCII only).
 */
import { jsPDF } from "jspdf";

const MARGIN_X = 18;
const MARGIN_TOP = 16;
const PAGE_H = 297;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const FONT = {
  name: 17,
  title: 11,
  contact: 9.5,
  section: 10.5,
  body: 9.5,
  role: 10.5,
  company: 9.5,
};

const LINE = {
  body: 4.6,
  tight: 4.1,
  sectionGap: 7,
  blockGap: 3,
};

const KNOWN_SECTIONS = [
  "PROFESSIONAL SUMMARY",
  "SUMMARY",
  "PROFILE",
  "TECHNICAL SKILLS",
  "SKILLS",
  "CORE COMPETENCIES",
  "PROFESSIONAL EXPERIENCE",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "PROJECTS",
  "SELECTED PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
  "ADDITIONAL",
  "ADDITIONAL CREDENTIALS",
  "ADDITIONAL CREDENTIALS & CAPABILITIES",
];

/** Strip bracket labels from links, e.g. "[GitHub]" -> "GitHub". */
function stripLinkBrackets(line) {
  return String(line || "").replace(/\[([^\]]+)\]/g, "$1");
}

/** Bullets and special chars break default jsPDF fonts — normalize to ASCII. */
export function normalizeResumePlainText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/●/g, "-")
    .replace(/[•◦▪▸►]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/^[\s]*[●•]\s*/gm, "- ")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => stripLinkBrackets(line))
    .join("\n")
    .trim();
}

function isSectionHeader(line) {
  const t = line.trim().toUpperCase();
  if (!t || t.startsWith("-")) return false;
  if (KNOWN_SECTIONS.some((s) => t === s || t.startsWith(s))) return true;
  return (
    t.length >= 4 &&
    t.length <= 48 &&
    t === t.toUpperCase() &&
    /[A-Z]/.test(t) &&
    !t.includes("@") &&
    !t.includes("|") &&
    !/^\d/.test(t)
  );
}

function looksLikeCompanyLine(line) {
  const t = line.trim();
  return (t.includes("|") || t.includes("·")) && (/\d{4}/.test(t) || /present/i.test(t) || /–|-/.test(t));
}

function ensureSpace(doc, y, needed = LINE.body) {
  if (y + needed > PAGE_H - 16) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

function writeLines(doc, parts, x, y) {
  let cursor = y;
  parts.forEach((part) => {
    cursor = ensureSpace(doc, cursor);
    doc.text(part, x, cursor);
    cursor += LINE.body;
  });
  return cursor;
}

/**
 * @param {string} text
 * @param {string} filename
 */
export function downloadResumePdf(text, filename = "resume.pdf") {
  const source = normalizeResumePlainText(text);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = MARGIN_TOP;
  let headerLines = 0;
  let inExperience = false;

  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      y += LINE.tight;
      continue;
    }

    if (headerLines < 5 && !isSectionHeader(trimmed)) {
      const displayLine = stripLinkBrackets(trimmed);
      if (headerLines === 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(FONT.name);
        y = writeLines(doc, doc.splitTextToSize(displayLine, CONTENT_W), MARGIN_X, ensureSpace(doc, y));
        y += 2;
      } else if (headerLines === 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(FONT.title);
        y = writeLines(doc, doc.splitTextToSize(displayLine, CONTENT_W), MARGIN_X, ensureSpace(doc, y));
        y += 1;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FONT.contact);
        y = writeLines(doc, doc.splitTextToSize(displayLine, CONTENT_W), MARGIN_X, ensureSpace(doc, y));
      }
      headerLines += 1;
      continue;
    }

    if (isSectionHeader(trimmed)) {
      inExperience = /EXPERIENCE/i.test(trimmed);
      y += LINE.sectionGap;
      y = ensureSpace(doc, y, LINE.sectionGap);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT.section);
      y = writeLines(doc, doc.splitTextToSize(trimmed, CONTENT_W), MARGIN_X, y);
      y += LINE.blockGap;
      continue;
    }

    if (trimmed.startsWith("-")) {
      const bulletText = trimmed.replace(/^-\s*/, "").trim();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT.body);
      const wrapped = doc.splitTextToSize(bulletText, CONTENT_W - 6);
      for (let bi = 0; bi < wrapped.length; bi += 1) {
        y = ensureSpace(doc, y);
        if (bi === 0) {
          doc.text("-", MARGIN_X + 1, y);
        }
        doc.text(wrapped[bi], MARGIN_X + 5, y);
        y += LINE.body;
      }
      continue;
    }

    if (inExperience && !looksLikeCompanyLine(trimmed) && i + 1 < lines.length) {
      const next = lines[i + 1]?.trim() || "";
      if (looksLikeCompanyLine(next) || isSectionHeader(next)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(FONT.role);
        y = writeLines(doc, doc.splitTextToSize(trimmed, CONTENT_W), MARGIN_X, ensureSpace(doc, y));
        y += 0.5;
        continue;
      }
    }

    if (inExperience && looksLikeCompanyLine(trimmed)) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT.company);
      y = writeLines(doc, doc.splitTextToSize(trimmed, CONTENT_W), MARGIN_X, ensureSpace(doc, y));
      y += 1.5;
      continue;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT.body);
    y = writeLines(doc, doc.splitTextToSize(trimmed, CONTENT_W), MARGIN_X, ensureSpace(doc, y));
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
