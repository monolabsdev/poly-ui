import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const installerDest = join(__dirname, '..', 'src-tauri', 'windows', 'install-ollama.ps1');

async function main() {
  console.log('Downloading Ollama installer...');
  const response = await fetch('https://ollama.com/install.ps1');
  if (!response.ok) {
    throw new Error(`Failed to download Ollama installer (HTTP ${response.status})`);
  }
  const script = await response.text();
  mkdirSync(dirname(installerDest), { recursive: true });
  writeFileSync(installerDest, script, 'utf8');
  console.log('Downloaded Ollama installer');

  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  const originalProductName = config.productName;
  const originalResources = config.bundle.resources;

  config.productName = originalProductName + '-Ollama';
  config.bundle.windows ??= {};
  config.bundle.windows.nsis ??= {};
  config.bundle.windows.nsis.installerHooks = './windows/hooks.nsh';
  config.bundle.resources = ['windows/install-ollama.ps1'];

  writeFileSync(configPath, JSON.stringify(config, null, 2));

  try {
    execSync('bun run tauri build', { stdio: 'inherit', shell: true });
  } finally {
    config.productName = originalProductName;
    delete config.bundle.windows.nsis.installerHooks;
    config.bundle.resources = originalResources;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
