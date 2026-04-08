import { pdfjsLib } from "./pdfjs";

const NOISE_PATTERN = /\b(pdf|document|structure|copyright|page)\b/i;
const SYMBOL_HEAVY_PATTERN = /[^a-zA-Z0-9\s,.;:()'"%/\-]/g;

type CleanAcademicTextOptions = {
  maxChars?: number;
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
  const trimmed = stripProblemCharacters(line).trim();

  if (!trimmed) return false;
  if (NOISE_PATTERN.test(trimmed)) return false;
  if (isNumbersOnly(trimmed)) return false;
  if (!hasEnoughWords(trimmed)) return false;
  if (looksLikeGarbage(trimmed)) return false;

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
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ").trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n\n");
};
