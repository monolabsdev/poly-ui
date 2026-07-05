const LOCAL_TARGET = /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#].*)?$/i;
const DOMAIN_TARGET = /^[^\s/]+\.[^\s/]+(?:[/?#].*)?$/i;

export function resolveBrowserInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (LOCAL_TARGET.test(value)) return `http://${value}`;
  if (DOMAIN_TARGET.test(value)) return `https://${value}`;
  return `https://www.google.com/search?${new URLSearchParams({ q: value })}`;
}
