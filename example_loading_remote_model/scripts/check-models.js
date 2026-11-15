#!/usr/bin/env node
// postinstall: the bundled models (wake word, speaker verification) must be real files, not Git LFS pointers.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const MODELS = [
  "assets/models/hey_coach_model_28_22012026b.dm",
  "assets/models/sv.dm",
  "android/app/src/main/assets/hey_coach_model_28_22012026b.dm",
  "android/app/src/main/assets/sv.dm",
];
const isPointer = (p) => fs.readFileSync(p).subarray(0, 200).toString("utf8").startsWith("version https://git-lfs.github.com/spec/v1");
const missing = MODELS.filter((m) => !fs.existsSync(path.join(root, m)));
if (missing.length) {
  console.error("Missing model files: " + missing.join(", "));
  process.exit(1);
}
const pointers = MODELS.filter((m) => isPointer(path.join(root, m)));
if (pointers.length) {
  console.log("Git LFS pointers found, fetching the model files...");
  try {
    execSync("git lfs install && git lfs pull", { cwd: root, stdio: "inherit" });
  } catch (e) {
    console.error("\nInstall Git LFS (https://git-lfs.com), then run: git lfs install && git lfs pull\n");
    process.exit(1);
  }
}
