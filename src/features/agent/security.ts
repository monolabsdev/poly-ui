const SECRET_BASENAME_PATTERNS = [
  /^\.env(\..+)?(?:[.\s:]|$)/i,
  /^.*\.(pem|key|p12|pfx|asc|gpg)(?:[.\s:]|$)/i,
  /^id_(rsa|dsa|ecdsa|ed25519)([._-].*)?(?:[.\s:]|$)/i,
  /^credentials(?:[.\s:]|$)/i,
  /^\.npmrc(?:[.\s:]|$)/i,
  /^secrets?\.(json|ya?ml|toml|env)(?:[.\s:]|$)/i,
];

const PROTECTED_DIRS = [
  "/.ssh",
  "/.gnupg",
  "/.aws",
  "/.azure",
  "/.kube",
  "/.docker",
  "/.git",
];

export type SafetyResult = { ok: true } | { ok: false; reason: string };

export function checkReadable(path: string): SafetyResult {
  if (!path.trim()) return { ok: false, reason: "Refused: empty path." };
  if (/[\x00-\x1f]/.test(path)) return { ok: false, reason: "Refused: path contains control bytes." };
  const base = basename(path);
  for (const pattern of SECRET_BASENAME_PATTERNS) {
    if (pattern.test(base)) return { ok: false, reason: `Refused: "${base}" looks sensitive.` };
  }
  const cmp = comparisonForm(path);
  for (const dir of PROTECTED_DIRS) {
    if (`${cmp}/`.includes(`${dir}/`)) return { ok: false, reason: `Refused: protected directory ${dir}.` };
  }
  return { ok: true };
}

export function checkWritable(path: string): SafetyResult {
  return checkReadable(path);
}

export function checkShellCommand(command: string): SafetyResult {
  const c = command.trim();
  if (!c) return { ok: false, reason: "Refused: empty command." };
  if (/[\x00-\x1f]/.test(c)) return { ok: false, reason: "Refused: command must be one line." };
  if (/\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(['"]?\/['"]?|~|\$\{?HOME\}?)(\s|$|;|&|\|)/.test(c)) {
    return { ok: false, reason: "Refused: destructive recursive delete." };
  }
  if (/--no-preserve-root/.test(c)) return { ok: false, reason: "Refused: --no-preserve-root is not allowed." };
  if (/\b(curl|wget)\b[^|;&]*\|\s*(ba|z|k|d|fi|c)?sh\b/.test(c)) {
    return { ok: false, reason: "Refused: piping network downloads to shell is blocked." };
  }
  return { ok: true };
}

function basename(path: string) {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function comparisonForm(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^[a-zA-Z]:/, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
}
