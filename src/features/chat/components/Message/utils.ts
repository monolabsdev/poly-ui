export const stripInvisible = (s: string) =>
  s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g, "");
