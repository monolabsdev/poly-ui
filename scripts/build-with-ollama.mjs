import { writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const installerDest = join(
  __dirname,
  "..",
  "src-tauri",
  "windows",
  "install-ollama.ps1",
);

async function main() {
  console.log("Downloading Ollama installer...");
  const response = await fetch("https://ollama.com/install.ps1");
  if (!response.ok) {
    throw new Error(
      `Failed to download Ollama installer (HTTP ${response.status})`,
    );
  }
  const script = await response.text();
  mkdirSync(dirname(installerDest), { recursive: true });
  writeFileSync(installerDest, script, "utf8");
  console.log("Downloaded Ollama installer");

  execSync(
    "bun run tauri bundle --bundles nsis --config src-tauri/tauri.ollama.conf.json --ci",
    { stdio: "inherit", shell: true },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
