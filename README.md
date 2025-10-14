# join-pdf 🧩🧩🧩

A **Node.js + TypeScript** module and CLI tool to **combine multiple PDF files** with full control over page order, duplication, and insertion of blank pages.  
You can use it as a **CLI command** or as a **programmatic library** inside your Node projects.

---

## Installation

```bash
# install locally in your project
npm install join-pdf

# or install globally to use as a CLI command
npm install -g join-pdf
```

---

## CLI Usage

Once installed globally, you can use the `join-pdf` command directly in your terminal.

### Basic Syntax

```bash
join-pdf [command] [options]
```

---

### Commands

#### 1. `list`

Lists all PDFs and their total page counts.

```bash
join-pdf list file1.pdf file2.pdf file3.pdf
```

**Example Output:**

```
┌─────────┬────────────┬──────────────┐
│ (index) │ file       │ totalPages   │
├─────────┼────────────┼──────────────┤
│ 0       │ file1.pdf  │ 12           │
│ 1       │ file2.pdf  │ 7            │
└─────────┴────────────┴──────────────┘
```

---

#### 2. `test`

Validates a join definition before combining PDFs.  
It checks whether page references exist and reports how often each source page is used.

```bash
join-pdf test file1.pdf file2.pdf --join joinlist.json
```

or define the join inline using `--pages`:

```bash
join-pdf test file1.pdf file2.pdf --pages "0:1,blank,1:2-4,0:5"
```

**Example Output:**

```
✅ No validation errors found.

📘 Usage Summary:
- file1.pdf: 1(1×), 5(1×) / total 12
- file2.pdf: 2(1×), 3(1×), 4(1×) / total 7
```

---

#### 3. `join`

Creates a new combined PDF according to a defined page order.

##### Option A — using a JSON join list

```bash
join-pdf join file1.pdf file2.pdf --join joinlist.json --out result.pdf
```

**joinlist.json Example:**

```json
[
  { "pdf": 0, "page": 1 },
  { "blank": true },
  { "pdf": 1, "page": "2-4" },
  { "pdf": 0, "page": 5 }
]
```

##### Option B — inline with `--pages`

```bash
join-pdf join file1.pdf file2.pdf --pages "0:1,blank,1:2-4,0:5" --out result.pdf
```

---

### Options Summary

| Option | Description | Example |
|--------|--------------|----------|
| `-j, --join <file>` | Path to a JSON join definition file | `--join joinlist.json` |
| `-p, --pages <definition>` | Inline page definition string | `--pages "0:1,blank,1:2-4"` |
| `-o, --out <file>` | Output file name | `--out result.pdf` |
| `--help` | Show command help | `join-pdf join --help` |

---

### Page Definition Syntax (`--pages`)

Each token in the `--pages` string is separated by commas:

| Token Type | Meaning | Example |
|-------------|----------|----------|
| `0:1` | Page 1 from first PDF | `0:1` |
| `1:2-4` | Pages 2 through 4 from second PDF | `1:2-4` |
| `blank` | Insert a blank page | `blank` |

PDFs are indexed **starting at 0**, in the order they are listed on the command line.

---

## Programmatic Usage in Node.js

You can also use `join-pdf` as a module in your Node.js or TypeScript projects.

### 🔹 Import

```ts
import { listPdfs, join, testList } from "join-pdf";
```

---

### `async listPdfs(pdfs: string[]): Promise<{ file: string; totalPages: number }[]>`

Reads all given PDFs and returns their total page counts.

```ts
const info = await listPdfs(["a.pdf", "b.pdf"]);
console.log(info);
```

**Example Output:**

```js
[
  { file: "a.pdf", totalPages: 12 },
  { file: "b.pdf", totalPages: 7 }
]
```

---

### `async join(pdfs: string[], joinList: JoinItem[]): Promise<Uint8Array>`

Combines PDFs according to a defined page order.

```ts
const joinList = [
  { pdf: 0, page: 1 },
  { blank: true },
  { pdf: 1, page: "2-4" },
  { pdf: 0, page: 5 }
];

const bytes = await join(["a.pdf", "b.pdf"], joinList);
await fs.writeFile("output.pdf", bytes);
```

✅ You can reuse or skip pages  
✅ You can insert blank pages  
✅ You can use page ranges like `"2-5"`

---

### `async testList(pdfs: string[], joinList: JoinItem[]): Promise<TestResult>`

Validates that all referenced pages exist and reports usage.

```ts
const result = await testList(["a.pdf", "b.pdf"], joinList);

if (result.errors.length) {
  console.error("Errors:", result.errors);
} else {
  console.log("Usage:", result.usage);
}
```

**Example Output:**

```js
{
  errors: [],
  usage: [
    { file: "a.pdf", totalPages: 12, usedPages: { "1": 1, "5": 1 } },
    { file: "b.pdf", totalPages: 7, usedPages: { "2": 1, "3": 1, "4": 1 } }
  ]
}
```

---

## JSON JoinList Format

Each item in the join list is an object with one of the following forms:

| Type | Example | Description |
|------|----------|-------------|
| Single Page | `{ "pdf": 0, "page": 1 }` | Take page 1 from first PDF |
| Page Range | `{ "pdf": 1, "page": "3-5" }` | Take pages 3–5 from second PDF |
| Blank Page | `{ "blank": true }` | Insert a blank page |

---

## Example Project Structure

```
my-project/
├─ src/
│  ├─ join-pdf.ts
│  └─ cli.ts
├─ package.json
└─ joinlist.json
```

---

## Tips

- You can reuse pages multiple times (e.g., `{ "pdf": 0, "page": 1 }` repeated).
- Non-consecutive pages are supported — order is fully flexible.
- `testList` helps ensure all requested pages exist before joining.
- Works best with **Node.js v18+**.

---

## License

MIT © 2025 Florian Walzel
