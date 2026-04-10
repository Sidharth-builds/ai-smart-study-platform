import { pdfjsLib } from "./pdfjs";

const NOISE_PATTERN = /\b(pdf|document|structure|copyright|page|page\s*\d+|fig(?:ure)?|table|chapter|section|www\.|https?:\/\/|\[\d+\])\b/i;
const SYMBOL_HEAVY_PATTERN = /[^a-zA-Z0-9\s,.;:()'"%/\-]/g;
const PAGE_NUMBER_PATTERN = /^\s*(page\s*)?\d+\s*$/i;
const HEADER_FOOTER_PATTERN = /^(\s*chapter\s+\d+|\s*section\s+\d+|\s*\d+\.\s+.*|\s*.*\s+\d+\s*)$/i;

type CleanAcademicTextOptions = {
  maxChars?: number;
};

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

const normalizeWhitespace = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ");

const stripProblemCharacters = (text: string): string =>
  text
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(SYMBOL_HEAVY_PATTERN, " ")
    .replace(/\s{2,}/g, " ");

const isNumbersOnly = (line: string): boolean => /^[\d\s.,:/\\-]+$/.test(line.trim());

const hasEnoughWords = (line: string): boolean => {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length >= 5;
};

const looksLikeHeaderFooter = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (PAGE_NUMBER_PATTERN.test(trimmed)) return true;
  if (HEADER_FOOTER_PATTERN.test(trimmed) && trimmed.split(/\s+/).length <= 6) return true;
  return /^(?:page|chapter|section)\b/i.test(trimmed);
};

const looksLikeGarbage = (line: string): boolean => {
  const trimmed = line.trim();

  if (!/[a-zA-Z]/.test(trimmed)) {
    return true;
  }

  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const symbols = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;

  if (symbols > letters) {
    return true;
  }

  return !/[a-zA-Z]{3,}/.test(trimmed);
};

const isMeaningfulLine = (line: string): boolean => {
  const stripped = stripProblemCharacters(line).trim();

  if (!stripped) return false;
  if (NOISE_PATTERN.test(stripped)) return false;
  if (PAGE_NUMBER_PATTERN.test(stripped)) return false;
  if (looksLikeHeaderFooter(stripped)) return false;
  if (isNumbersOnly(stripped)) return false;
  if (!hasEnoughWords(stripped)) return false;
  if (looksLikeGarbage(stripped)) return false;

  return true;
};

const dedupeLines = (lines: string[]): string[] => {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildMeaningfulParagraphs = (text: string): string[] => {
  const rawParagraphs = normalizeWhitespace(text).split(/\n\s*\n+/);

  return rawParagraphs
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => stripProblemCharacters(line).trim())
        .filter(isMeaningfulLine),
    )
    .map(dedupeLines)
    .map((lines) => lines.join(" ").replace(/\s{2,}/g, " ").trim())
    .filter((paragraph) => paragraph.split(/\s+/).length >= 10);
};

export const cleanAcademicText = (
  text: string,
  { maxChars = 7000 }: CleanAcademicTextOptions = {},
): string => {
  const meaningfulParagraphs = dedupeLines(buildMeaningfulParagraphs(text));
  const cleaned = meaningfulParagraphs.join("\n\n").trim();

  if (!cleaned) {
    return "";
  }

  return cleaned.slice(0, maxChars).trim();
};

export const extractMeaningfulTextFromHtml = (html: string): string => {
  if (typeof DOMParser === "undefined") {
    return cleanAcademicText(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.querySelectorAll("script, style, nav, footer, noscript, iframe, svg").forEach((node) => {
    node.remove();
  });

  const blocks = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6, p"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);

  const joined = blocks.join("\n\n");
  return cleanAcademicText(joined);
};

export const extractTextFromPdfFile = async (file: File): Promise<string> => {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    throw new Error("PDF worker not loaded");
  }

  const arrayBuffer = await file.arrayBuffer();
  const header = new Uint8Array(arrayBuffer, 0, 4);
  const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;

  if (!isPdf) {
    throw new Error("Invalid PDF or unsupported format");
  }

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let currentLine = "";
    let lastY: number | null = null;

    (content.items as PdfTextItem[]).forEach((item) => {
      const value = typeof item.str === "string" ? item.str.trim() : "";
      if (!value) {
        return;
      }

      const y = Array.isArray(item.transform) ? item.transform[5] : null;
      const isNewVisualLine = lastY !== null && y !== null && Math.abs(lastY - y) > 4;

      if ((isNewVisualLine || item.hasEOL) && currentLine.trim()) {
        lines.push(currentLine.replace(/\s{2,}/g, " ").trim());
        currentLine = "";
      }

      currentLine = `${currentLine} ${value}`.trim();
      lastY = y;

      if (item.hasEOL && currentLine.trim()) {
        lines.push(currentLine.replace(/\s{2,}/g, " ").trim());
        currentLine = "";
      }
    });

    if (currentLine.trim()) {
      lines.push(currentLine.replace(/\s{2,}/g, " ").trim());
    }
  }

  return lines.join("\n").replace(/\n{2,}/g, "\n").trim();
};

export const prepareFlashcardSourceText = (
  text: string,
  { maxChars = 5000 }: CleanAcademicTextOptions = {},
): string => {
  const seen = new Set<string>();
  const cleanedLines = normalizeWhitespace(text)
    .split("\n")
    .map((line) => stripProblemCharacters(line).trim())
    .filter((line) => line.length >= 30)
    .filter((line) => !PAGE_NUMBER_PATTERN.test(line))
    .filter((line) => !looksLikeHeaderFooter(line))
    .filter((line) => !isNumbersOnly(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return cleanedLines.join("\n").slice(0, maxChars).trim();
};
