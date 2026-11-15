#!/usr/bin/env node
/**
 * Writes the SHA-256 sidecar file the example app uses to detect wake word model updates.
 *
 *   node scripts/wakeword-model-hash.js [path/to/model.dm] [--out <dir>]
 *
 * Defaults to assets/models/hey_coach_model_28_22012026b.dm and writes <model>.dm.sha256 next
 * to it. Upload BOTH files to the CDN, keeping the file names:
 *
 *   https://<cdn>/hey_coach_model_28_22012026b.dm
 *   https://<cdn>/hey_coach_model_28_22012026b.dm.sha256
 *
 * The base URL lives in src/modelUpdater.ts (WAKEWORD_MODEL_CDN_BASE_URL). The app
 * compares this hash with the model it runs and downloads the .dm only when they differ.
 * Give the .sha256 file a short cache TTL on the CDN so new versions are noticed quickly.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_MODEL = path.join("assets", "models", "hey_coach_model_28_22012026b.dm");

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function isLFSPointer(p) {
  const fd = fs.openSync(p, "r");
  const buf = Buffer.alloc(256);
  const n = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  return buf.slice(0, n).toString("utf8").includes("git-lfs.github.com/spec/v1");
}

function parseArgs(argv) {
  const args = { model: DEFAULT_MODEL, outDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (argv[i] === "-h" || argv[i] === "--help") {
      console.log("usage: node scripts/wakeword-model-hash.js [path/to/model.dm] [--out <dir>]");
      process.exit(0);
    } else {
      args.model = argv[i];
    }
  }
  return args;
}

const { model, outDir } = parseArgs(process.argv.slice(2));

if (!fs.existsSync(model)) fail(`Model file not found: ${model}`);
if (!model.endsWith(".dm")) fail(`Expected a .dm model file, got: ${model}`);
if (isLFSPointer(model)) {
  fail(`${model} is a Git LFS pointer, not the real model. Run: git lfs pull`);
}

const sha256 = crypto.createHash("sha256").update(fs.readFileSync(model)).digest("hex");
const fileName = path.basename(model);
const targetDir = outDir || path.dirname(model);
const sidecarPath = path.join(targetDir, `${fileName}.sha256`);

fs.mkdirSync(targetDir, { recursive: true });
// sha256sum-compatible format: "<hash>  <file name>"
fs.writeFileSync(sidecarPath, `${sha256}  ${fileName}\n`);

console.log(`SHA-256: ${sha256}`);
console.log(`Wrote:   ${sidecarPath}`);
console.log(`\nUpload to the CDN (same names):\n  ${fileName}\n  ${fileName}.sha256`);
