import confetti from "canvas-confetti";

function confettiColors() {
  const styles = getComputedStyle(document.documentElement);
  return ["--primary", "--info", "--success", "--destructive", "--warning"]
    .map((name) => styles.getPropertyValue(name).trim())
    .filter(Boolean);
}

function confettiZIndex(): number {
  const styles = getComputedStyle(document.documentElement);
  const zToast = styles.getPropertyValue("--z-toast").trim();
  if (zToast) {
    return parseInt(zToast, 10) + 10;
  }
  return 20000;
}

export function fireConfettiBothSides() {
  const defaults = {
    spread: 60,
    ticks: 200,
    gravity: 0.8,
    decay: 0.94,
    startVelocity: 30,
    zIndex: confettiZIndex(),
    colors: confettiColors(),
  };

  confetti({ ...defaults, angle: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...defaults, angle: 120, origin: { x: 1, y: 0.7 } });
}
