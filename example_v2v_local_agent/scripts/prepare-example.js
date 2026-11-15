#!/usr/bin/env node
// postinstall: (1) creates local.config.ts from local.config.example.ts when it is missing (your keys stay in
// local.config.ts, which git ignores); (2) checks that the small bundled models (wake word, speaker verification)
// are real files, not Git LFS pointers. Every TTS voice and every on-device LLM is downloaded by the app itself.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const cfg = path.join(root, "local.config.ts");
if (!fs.existsSync(cfg)) {
  fs.copyFileSync(path.join(root, "local.config.example.ts"), cfg);
  console.log("Created local.config.ts from local.config.example.ts (add your own keys there).");
}

const MODELS = [
  "assets/models/hey_coach_model_28_22012026b.dm",
  "assets/models/sv.dm",
  "android/app/src/main/assets/hey_coach_model_28_22012026b.dm",
  "android/app/src/main/assets/sv.dm",
];
const isPointer = (p) => fs.readFileSync(p).subarray(0, 200).toString("utf8").startsWith("version https://git-lfs.github.com/spec/v1");
const pointers = MODELS.filter((m) => fs.existsSync(path.join(root, m)) && isPointer(path.join(root, m)));
if (pointers.length) {
  console.log("Git LFS pointers found, fetching the model files: " + pointers.join(", "));
  try {
    execSync("git lfs install && git lfs pull --include=\"" + pointers.map((m) => path.basename(m)).join(",") + "\"", { cwd: root, stdio: "inherit" });
  } catch (e) {
    console.error("\nInstall Git LFS (https://git-lfs.com), then run: git lfs install && git lfs pull\n");
    process.exit(1);
  }
}
