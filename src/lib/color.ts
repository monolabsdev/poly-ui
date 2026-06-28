export function alpha(color: string, opacity: number) {
  if (color.startsWith("var(") || color.startsWith("#")) {
    return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
  }
  return color;
}
