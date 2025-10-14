#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { listPdfs, validateList, join, JoinItem } from "./join-pdf.js";

// Dynamically resolve version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, "../package.json");

let version = "0.0.0";
try {
  const pkgData = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  version = pkgData.version || version;
} catch {
  console.warn("⚠️ Could not read version from package.json, defaulting to 0.0.0");
}

const program = new Command();

program
    .name("join-pdf")
    .description("Join and manage PDF files with flexible page selection")
    .version(version);

/**
 * Helper: parse a --pages string into JoinItem[]
 * Example: "0:1,blank,1:2-4,0:5"
 */
function parsePagesArg(arg: string): JoinItem[] {
  const items: JoinItem[] = [];
  const tokens = arg.split(",").map((t) => t.trim());

  for (const token of tokens) {
    if (!token || token.toLowerCase() === "blank") {
      items.push({ blank: true });
      continue;
    }

    const match = /^(\d+):([\d]+(?:-[\d]+)?)$/.exec(token);
    if (!match) {
      throw new Error(
          `Invalid --pages token "${token}". Use format "pdfIndex:page" or "pdfIndex:start-end" or "blank".`
      );
    }

    const pdf = parseInt(match[1], 10);
    const page = match[2].includes("-") ? match[2] : parseInt(match[2], 10);

    items.push({ pdf, page });
  }

  return items;
}

/**
 * LIST COMMAND
 */
program
    .command("list")
    .description("List all PDFs with their total page counts")
    .argument("<pdf...>", "PDF file paths")
    .action(async (pdfs: string[]) => {
      try {
        const info = await listPdfs(pdfs);
        console.table(info);
      } catch (err) {
        console.error("❌ Error listing PDFs:", (err as Error).message);
        process.exit(1);
      }
    });

/**
 * TEST COMMAND
 */
program
    .command("validate")
    .description("Validate a join list against PDFs (check page existence, usage, etc.)")
    .argument("<pdf...>", "PDF file paths")
    .option("-j, --join <file>", "JSON file defining join list")
    .option("-p, --pages <definition>", "Inline page definition (e.g. '0:1,blank,1:2-5')")
    .action(async (pdfs: string[], options) => {
      try {
        let joinData: JoinItem[] = [];

        if (options.join && options.pages) {
          throw new Error("Use either --join or --pages, not both.");
        }

        if (options.join) {
          joinData = JSON.parse(await fs.readFile(options.join, "utf8"));
        } else if (options.pages) {
          joinData = parsePagesArg(options.pages);
        } else {
          throw new Error("You must specify either --join <file> or --pages <definition>");
        }

        const result = await validateList(pdfs, joinData);

        if (result.errors.length) {
          console.error("\n⚠️  Validation Errors:");
          result.errors.forEach((e) => console.error(" - " + e));
        } else {
          console.log("✅ No validation errors found.");
        }

        console.log("\n📘 Usage Summary:");
        for (const u of result.usage) {
          const usedCount = Object.entries(u.usedPages)
              .map(([page, count]) => `${page}(${count}×)`)
              .join(", ");
          console.log(
              `- ${path.basename(u.file)}: ${usedCount || "no pages used"} / total ${u.totalPages}`
          );
        }
      } catch (err) {
        console.error("❌ Error testing join list:", (err as Error).message);
        process.exit(1);
      }
    });

/**
 * JOIN COMMAND
 */
program
    .command("join")
    .description("Join PDFs according to join list or inline page definition")
    .argument("<pdf...>", "PDF file paths")
    .option("-j, --join <file>", "JSON file defining join list")
    .option("-p, --pages <definition>", "Inline page definition (e.g. '0:1,blank,1:2-5')")
    .option("-o, --out <file>", "Output PDF file name", "output.pdf")
    .action(async (pdfs: string[], options) => {
      try {
        let joinData: JoinItem[] = [];

        if (options.join && options.pages) {
          throw new Error("Use either --join or --pages, not both.");
        }

        if (options.join) {
          joinData = JSON.parse(await fs.readFile(options.join, "utf8"));
        } else if (options.pages) {
          joinData = parsePagesArg(options.pages);
        } else {
          throw new Error("You must specify either --join <file> or --pages <definition>");
        }

        console.log(`📄 Combining ${pdfs.length} PDFs...`);

        const bytes = await join(pdfs, joinData);
        await fs.writeFile(options.out, bytes);

        console.log(`✅ Output written to ${options.out}`);
      } catch (err) {
        console.error("❌ Error joining PDFs:", (err as Error).message);
        process.exit(1);
      }
    });

program.parseAsync(process.argv);
