#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { listPdfs, testList, join, JoinItem } from "./join-pdf.js";

const program = new Command();

program
    .name("join-pdf")
    .description("Join and manage PDF files with flexible page selection")
    .version("1.0.0");

/**
 * LIST COMMAND
 * Example: join-pdf list file1.pdf file2.pdf
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
 * Example: join-pdf test file1.pdf file2.pdf --join joinlist.json
 */
program
    .command("test")
    .description("Validate a join list against PDFs (check page existence, usage, etc.)")
    .argument("<pdf...>", "PDF file paths")
    .option("-j, --join <file>", "JSON file defining join list")
    .action(async (pdfs: string[], options) => {
      const joinFile = options.join;
      if (!joinFile) {
        console.error("❌ Missing --join <file> argument");
        process.exit(1);
      }

      try {
        const joinData = JSON.parse(await fs.readFile(joinFile, "utf8")) as JoinItem[];
        const result = await testList(pdfs, joinData);

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
 * Example: join-pdf join file1.pdf file2.pdf --join joinlist.json --out output.pdf
 */
program
    .command("join")
    .description("Join PDFs according to join list into one output file")
    .argument("<pdf...>", "PDF file paths")
    .option("-j, --join <file>", "JSON file defining join list")
    .option("-o, --out <file>", "Output PDF file name", "output.pdf")
    .action(async (pdfs: string[], options) => {
      const joinFile = options.join;
      if (!joinFile) {
        console.error("❌ Missing --join <file> argument");
        process.exit(1);
      }

      try {
        const joinData = JSON.parse(await fs.readFile(joinFile, "utf8")) as JoinItem[];
        console.log(`📄 Combining ${pdfs.length} PDFs according to ${joinFile}...`);

        const bytes = await join(pdfs, joinData);
        await fs.writeFile(options.out, bytes);

        console.log(`✅ Output written to ${options.out}`);
      } catch (err) {
        console.error("❌ Error joining PDFs:", (err as Error).message);
        process.exit(1);
      }
    });

program.parseAsync(process.argv);
