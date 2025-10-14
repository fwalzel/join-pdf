import fs from "fs/promises";
import { PDFDocument } from "pdf-lib";

/** Represents a single PDF file and its total number of pages. */
export interface PdfInfo {
  file: string;
  pages: number;
}

/**
 * Represents a single instruction in the join list.
 * - Can specify one page (`page: 3`)
 * - Can specify a range (`page: "2-14"`)
 * - Or be a blank page (`blank: true`)
 */
export interface JoinItem {
  pdf?: number;
  page?: number | string; // supports "2-14"
  blank?: boolean;
}

/** Diagnostic information returned by testList(). */
export interface TestResult {
  errors: string[];
  usage: {
    file: string;
    totalPages: number;
    usedPages: Record<number, number>; // pageNumber → usage count
  }[];
}

/**
 * Reads given PDFs and returns array of { file, pages } objects
 */
export async function listPdfs(pdfs: string[]): Promise<PdfInfo[]> {
  const result: PdfInfo[] = [];

  for (const file of pdfs) {
    const data = await fs.readFile(file);
    const pdfDoc = await PDFDocument.load(data);
    result.push({ file, pages: pdfDoc.getPageCount() });
  }

  return result;
}

/**
 * Parse a page number or range string into an array of 1-based page numbers.
 * Examples:
 *   3       → [3]
 *   "2-5"   → [2,3,4,5]
 */
function parsePages(page: number | string): number[] {
  if (typeof page === "number") return [page];

  const match = /^(\d+)\s*-\s*(\d+)$/.exec(page.trim());
  if (!match) throw new Error(`Invalid page range format: "${page}"`);

  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);

  if (start > end) throw new Error(`Invalid range: start > end (${page})`);

  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

/**
 * Joins PDFs according to a joinList definition.
 * Supports single pages, ranges, and blank pages.
 */
export async function join(
    pdfs: string[],
    joinList: JoinItem[]
): Promise<Uint8Array> {
  const loadedPdfs: PDFDocument[] = [];

  for (const file of pdfs) {
    const data = await fs.readFile(file);
    const pdfDoc = await PDFDocument.load(data);
    loadedPdfs.push(pdfDoc);
  }

  const outPdf = await PDFDocument.create();

  for (const item of joinList) {
    if (item.blank) {
      outPdf.addPage();
      continue;
    }

    if (typeof item.pdf !== "number" || item.pdf < 0) {
      throw new Error(`Invalid joinList entry: missing or invalid 'pdf' index`);
    }

    if (item.page === undefined) {
      throw new Error(`Missing 'page' in joinList entry: ${JSON.stringify(item)}`);
    }

    const srcPdf = loadedPdfs[item.pdf];
    const totalPages = srcPdf.getPageCount();

    const pagesToCopy = parsePages(item.page);

    for (const pageNum of pagesToCopy) {
      if (pageNum < 1 || pageNum > totalPages) {
        throw new Error(
            `joinList requests page ${pageNum} from pdf[${item.pdf}] which has only ${totalPages} pages`
        );
      }
      const [copiedPage] = await outPdf.copyPages(srcPdf, [pageNum - 1]);
      outPdf.addPage(copiedPage);
    }
  }

  return await outPdf.save();
}

/**
 * Tests a joinList configuration against available PDFs.
 * Reports invalid page references and usage frequency.
 */
export async function testList(
    pdfs: string[],
    joinList: JoinItem[]
): Promise<TestResult> {
  const info = await listPdfs(pdfs);

  const result: TestResult = {
    errors: [],
    usage: pdfs.map((file, idx) => ({
      file,
      totalPages: info[idx].pages,
      usedPages: {},
    })),
  };

  joinList.forEach((item, i) => {
    if (item.blank) return;

    if (typeof item.pdf !== "number" || item.pdf < 0) {
      result.errors.push(`Entry #${i}: invalid or missing 'pdf' index`);
      return;
    }

    if (item.page === undefined) {
      result.errors.push(`Entry #${i}: missing 'page' value`);
      return;
    }

    const pdfIndex = item.pdf;
    const total = info[pdfIndex]?.pages ?? 0;
    let pages: number[];

    try {
      pages = parsePages(item.page);
    } catch (err) {
      result.errors.push(`Entry #${i}: ${(err as Error).message}`);
      return;
    }

    for (const pageNum of pages) {
      if (pageNum < 1 || pageNum > total) {
        result.errors.push(
            `Entry #${i}: pdf[${pdfIndex}] has no page ${pageNum} (max ${total})`
        );
        continue;
      }

      const usageMap = result.usage[pdfIndex].usedPages;
      usageMap[pageNum] = (usageMap[pageNum] || 0) + 1;
    }
  });

  return result;
}

/**
 * Example usage:
 *
 * (async () => {
 *   const pdfs = ["one.pdf", "two.pdf"];
 *   const joinList: JoinItem[] = [
 *     { pdf: 0, page: 1 },
 *     { blank: true },
 *     { pdf: 1, page: "2-5" },   // Range of pages
 *     { pdf: 0, page: "3-4" },
 *   ];
 *
 *   console.log(await listPdfs(pdfs));
 *   console.log(await testList(pdfs, joinList));
 *
 *   const bytes = await join(pdfs, joinList);
 *   await fs.writeFile("output.pdf", bytes);
 * })();
 */

