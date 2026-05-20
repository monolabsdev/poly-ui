import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const configPath = 'src-tauri/tauri.conf.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const originalProductName = config.productName;
config.productName = originalProductName + '-Ollama';
config.bundle.windows ??= {};
config.bundle.windows.nsis ??= {};
config.bundle.windows.nsis.installerHooks = './windows/hooks.nsh';

writeFileSync(configPath, JSON.stringify(config, null, 2));

try {
  execSync('bun run tauri build', { stdio: 'inherit', shell: true });
} finally {
  config.productName = originalProductName;
  delete config.bundle.windows.nsis.installerHooks;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
