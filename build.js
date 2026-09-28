const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ENTRY_FILE = path.join(ROOT_DIR, 'index.html');
const OUTPUT_FILE = path.join(DIST_DIR, 'index.html');

let includedCount = 0;
const missingFiles = [];

function resolveInclude(content, currentFilePath, visitedStack = new Set(), depth = 0) {
  if (depth > 10) return content;

  return content.replace(/<\?!=\s*include\(['"]([^'"]+)['"]\);\s*\?>/g, (match, rawFilename) => {
    let targetFilename = rawFilename;
    if (!path.extname(targetFilename)) {
      targetFilename += '.html';
    }

    const targetPath = path.join(ROOT_DIR, targetFilename);

    // Self-include or circular include defense
    if (visitedStack.has(targetPath)) {
      console.log(`[SKIP] Preventing circular include of ${targetFilename} inside ${path.basename(currentFilePath)}`);
      return `<!-- Skipped self/circular include: ${targetFilename} -->`;
    }

    if (fs.existsSync(targetPath)) {
      includedCount++;
      const subContent = fs.readFileSync(targetPath, 'utf8');
      
      const newStack = new Set(visitedStack);
      newStack.add(targetPath);
      
      return resolveInclude(subContent, targetPath, newStack, depth + 1);
    } else {
      console.warn(`[WARN] Included file not found: ${targetFilename}`);
      missingFiles.push(targetFilename);
      return `<!-- Missing include: ${targetFilename} -->`;
    }
  });
}

function build() {
  console.log('🚀 Starting Vercel bundle build for 수학실험실...');
  if (!fs.existsSync(ENTRY_FILE)) {
    console.error(`[ERROR] Entry file not found: ${ENTRY_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const entryContent = fs.readFileSync(ENTRY_FILE, 'utf8');
  const initialStack = new Set([ENTRY_FILE]);
  const bundledHtml = resolveInclude(entryContent, ENTRY_FILE, initialStack);

  fs.writeFileSync(OUTPUT_FILE, bundledHtml, 'utf8');

  const stats = fs.statSync(OUTPUT_FILE);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('--------------------------------------------------');
  console.log('✅ Build Complete!');
  console.log(`- Output File: ${OUTPUT_FILE}`);
  console.log(`- Total Files Included: ${includedCount}`);
  console.log(`- Missing Files: ${missingFiles.length}`);
  console.log(`- Final Bundle Size: ${sizeMB} MB`);
  console.log('--------------------------------------------------');
}

build();
