import mammoth from "mammoth";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /\+?\d[\d()\-\s]{8,}\d/;

function firstNonEmptyLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function guessNameFromText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !!line);

  const nameLabel = lines.find((line) => /^name[:\-\s]/i.test(line));
  if (nameLabel) {
    return nameLabel.replace(/^name[:\-\s]*/i, "").trim() || null;
  }

  for (const line of lines.slice(0, 6)) {
    if (/[@\d]/.test(line)) continue;
    if (line.split(" ").length > 5) continue;
    if (/^(summary|objective|experience|profile)/i.test(line)) continue;
    if (line.toUpperCase() !== line && line.toLowerCase() !== line) {
      return line;
    }
  }

  return firstNonEmptyLine(text) ?? null;
}

async function extractTextFromPdf(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, useWorker: false });
  const pdf = await loadingTask.promise;

  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += strings + "\n";
  }
  return text;
}

async function extractTextFromDocx(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value ?? "";
}

export async function parseResumeFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") {
    return extractTextFromPdf(file);
  }
  if (extension === "docx" || extension === "doc") {
    return extractTextFromDocx(file);
  }

  throw new Error("Unsupported file type. Please upload a PDF or DOCX resume.");
}

export function extractContactDetails(text: string) {
  const emailMatch = text.match(EMAIL_REGEX);
  const phoneMatch = text.match(PHONE_REGEX);
  const name = guessNameFromText(text);

  return {
    name: name ?? null,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : null,
  };
}
