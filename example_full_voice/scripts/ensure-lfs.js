#!/usr/bin/env node
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const FILE = path.join("assets", "models", "model_ex.dm");
const MIN_REAL_SIZE = 50 * 1024 * 1024; // 50MB

function isLFSPointer(p) {
  if (!fs.existsSync(p)) return false;
  const fd = fs.openSync(p, "r");
  const buf = Buffer.alloc(256);
  const n = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const head = buf.slice(0, n).toString("utf8");
  return head.includes("git-lfs.github.com/spec/v1");
}

function hasGitLfs() {
  try { execSync("git lfs version", { stdio: "ignore" }); return true; }
  catch { return false; }
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

try {
  if (!fs.existsSync(FILE)) fail(`Missing required model file: ${FILE}`);

  const size = fs.statSync(FILE).size;
  if (size >= MIN_REAL_SIZE) process.exit(0);

  if (!isLFSPointer(FILE)) {
    fail(`Model file is too small (${size} bytes). Expected ~60MB: ${FILE}`);
  }

  console.error(`\n⚠️ Git LFS pointer detected for ${FILE} (size=${size} bytes).`);

  if (!hasGitLfs()) {
    fail(
      `Git LFS is not installed / not on PATH.\n` +
      `Install it, then run:\n` +
      `  git lfs install\n` +
      `  git lfs pull\n`
    );
  }

  console.error(`✅ git-lfs found. Fetching LFS objects...`);
  run("git lfs install");

  // Pull only what you need (fast)
  const incl = FILE.replace(/\\/g, "/");
  run(`git lfs pull --include="${incl}"`);

  const size2 = fs.statSync(FILE).size;
  if (size2 < MIN_REAL_SIZE) {
    fail(
      `git lfs pull ran but the model is still not present.\n` +
      `Try:\n` +
      `  git lfs pull\n` +
      `  git lfs checkout\n`
    );
  }

  console.error(`✅ LFS OK. ${FILE} is now ${size2} bytes.`);
} catch (e) {
  fail(`ensure-lfs failed: ${e?.message || e}`);
}

