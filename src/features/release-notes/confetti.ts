import confetti from "canvas-confetti";

export function fireConfettiBothSides() {
  const defaults = {
    spread: 60,
    ticks: 200,
    gravity: 0.8,
    decay: 0.94,
    startVelocity: 30,
    zIndex: 9500,
    colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"],
  };

  confetti({ ...defaults, angle: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...defaults, angle: 120, origin: { x: 1, y: 0.7 } });
}
