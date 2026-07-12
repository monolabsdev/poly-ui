import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

/**
 * HeroOrb — self-contained animated orb (WebGL shader, zero dependencies).
 *
 *   <HeroOrb />                                      // idle, 160px
 *   <HeroOrb state="live" />                         // semantic state
 *   <HeroOrb state="error" size={220} />             // px size
 *   <HeroOrb palette={{ speed: 12 }} />              // tweak one knob
 *   <HeroOrb palette={{ colors: [[0.1,0,0.5], [0.2,0.3,1], [0.9,0.9,0.9]] }} />
 *
 * Props:
 *   state      one of HERO_ORB_STATES (default 'idle'). Changing it eases the
 *              palette on one continuous surface; 'live' plays a scale pulse.
 *   size       diameter in px (default 160).
 *   palette    optional partial override of the state palette:
 *              { colors: [deep, bright, highlight] as rgb 0..1 triples,
 *                speed: motion pace, glowStrength: ring/stir intensity }
 *   audioLevel 0..1 raw audio level — drives a subtle zoom + glow pulse so
 *              the orb reacts to voice without clipping or rotation warp.
 *   className / style  forwarded to the wrapper div.
 */

export const HERO_ORB_STATES = [
  'idle',
  'searching',
  'found',
  'connecting',
  'preparing',
  'live',
  'unavailable',
  'warning',
  'error',
] as const;

export type HeroOrbState = (typeof HERO_ORB_STATES)[number];

export type RGB = [number, number, number];

export interface HeroOrbPalette {
  colors: [RGB, RGB, RGB];
  glowColor: RGB;
  speed: number;
  glowStrength: number;
}

export interface HeroOrbProps {
  state?: HeroOrbState;
  size?: number;
  palette?: Partial<HeroOrbPalette>;
  audioLevel?: number;
  className?: string;
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const COMMON_SPEED = 50;
const COMMON_GLOW = 1.0;

const PALETTES: Record<HeroOrbState, HeroOrbPalette> = {
  idle: {
    colors: [[0.09, 0.08, 0.5], [0.24, 0.28, 0.94], [0.85, 0.81, 0.75]],
    glowColor: [1, 1, 1],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  searching: {
    colors: [[0.15, 0.35, 0.98], [0.55, 0.7, 1.0], [0.95, 0.97, 1.0]],
    glowColor: [1, 1, 1],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  found: {
    colors: [[0.0, 0.55, 0.6], [0.5, 0.85, 0.85], [0.94, 1.0, 1.0]],
    glowColor: [1, 1, 1],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  connecting: {
    colors: [[0.25, 0.3, 1.0], [0.6, 0.65, 1.0], [0.96, 0.96, 1.0]],
    glowColor: [1, 1, 1],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  preparing: {
    colors: [[0.4, 0.2, 0.9], [0.68, 0.58, 0.97], [0.97, 0.95, 1.0]],
    glowColor: [1, 1, 1],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  live: {
    colors: [[0.0, 0.6, 0.32], [0.5, 0.88, 0.68], [0.94, 1.0, 0.97]],
    glowColor: [1, 1, 1],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  unavailable: {
    colors: [[0.35, 0.36, 0.4], [0.62, 0.63, 0.67], [0.9, 0.9, 0.92]],
    glowColor: [0.85, 0.85, 0.88],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  warning: {
    colors: [[0.92, 0.55, 0.05], [1.0, 0.8, 0.5], [1.0, 0.97, 0.9]],
    glowColor: [1.0, 0.95, 0.85],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
  error: {
    colors: [[0.82, 0.12, 0.18], [1.0, 0.55, 0.55], [1.0, 0.94, 0.94]],
    glowColor: [1.0, 0.92, 0.92],
    speed: COMMON_SPEED,
    glowStrength: COMMON_GLOW,
  },
};

function resolvePalette(state: HeroOrbState, override?: Partial<HeroOrbPalette>): HeroOrbPalette {
  const base = PALETTES[state] ?? PALETTES.idle;
  return override ? { ...base, ...override } : base;
}

const PALETTE_TRANSITION_MS = 700;

function interpolateRGB(from: RGB, to: RGB, amount: number): RGB {
  return from.map((value, index) => value + (to[index] - value) * amount) as RGB;
}

function interpolatePalette(
  from: HeroOrbPalette,
  to: HeroOrbPalette,
  amount: number,
): HeroOrbPalette {
  return {
    colors: from.colors.map((color, index) =>
      interpolateRGB(color, to.colors[index], amount),
    ) as [RGB, RGB, RGB],
    glowColor: interpolateRGB(from.glowColor, to.glowColor, amount),
    speed: from.speed + (to.speed - from.speed) * amount,
    glowStrength: from.glowStrength + (to.glowStrength - from.glowStrength) * amount,
  };
}

// ---------------------------------------------------------------------------
// Shader surface
// uAudioLevel — 0..1 smoothed magnitude driving a subtle UV zoom (~3% max)
// and a glow intensity boost.  Attack/release smoothing in JS prevents
// stutter from the 100 ms audio-meter polling interval.
// ---------------------------------------------------------------------------

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uC0, uC1, uC2, uGlow;
uniform float uSpeed, uGlowStrength, uAudioLevel, uPulseTime;

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

float soft(vec2 p, float r, float blur) {
  return 1.0 - smoothstep(r - blur, r + blur, length(p));
}

float crescent(vec2 p, float ang) {
  vec2 q = rot(p, ang);
  float body = soft(q, 0.5, 0.16);
  float cut  = soft(q - vec2(0.0, 0.31), 0.655, 0.16);
  return clamp(body * (1.0 - cut), 0.0, 1.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

float wavyBlob(vec2 p, float t) {
  float loopAng = 6.28318 * t * uSpeed / 90.0;
  vec2 q = p - vec2(0.0, 0.125) - 0.10 * vec2(cos(loopAng), sin(loopAng));
  float a = atan(q.y, q.x);
  float r = 0.42 * (1.0 + 0.35 * sin(3.0 * a + loopAng));
  return 1.0 - smoothstep(r - 0.10, r + 0.10, length(q));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  uv.y = -uv.y;

  // State-transition pulse: exponential decay, combined with audio level
  float pulse = uPulseTime > 0.0 ? exp(-(uTime - uPulseTime) * 12.0) : 0.0;
  float effect = min(uAudioLevel + pulse, 1.0);

  // Subtle zoom (max ~3 %) — pure UV, no CSS transform, no clipping.
  uv /= (1.0 + effect * 0.03);

  float lr = length(uv);
  // Keep enough transparent canvas for the 3% reactive zoom.
  float alpha = 1.0 - smoothstep(0.455, 0.47, lr);

  float t = uTime;
  float spd = radians(uSpeed);
  float gs = uGlowStrength;

  float z = sqrt(max(0.25 - lr * lr, 0.0));
  vec3 nrm = normalize(vec3(uv.x, -uv.y, z));
  vec3 lightDir = normalize(vec3(0.35, 0.55, 0.70));
  float diff = max(dot(nrm, lightDir), 0.0);
  vec3 col = mix(uC0, uC1, diff * diff);

  vec2 np = rot(uv, t * spd * 0.05) * 3.0 + vec2(t * 0.043, t * 0.06);
  float clouds = fbm(np);
  float ha = t * spd * 0.30;
  float ang = atan(uv.y, uv.x);
  float arcCenter = ha * 0.8 + 0.4 * sin(ha * 0.37 + 1.0);
  float d = mod(ang - arcCenter + 3.14159, 6.28318) - 3.14159;
  float width = 1.6 + 0.35 * sin(ha * 0.61 + 0.8);
  float arc = smoothstep(width, 0.0, abs(d));
  float head = exp(-(d - 0.8) * (d - 0.8) / 0.45);
  float limb = smoothstep(0.05, 0.48, lr);

  float d2 = mod(ang + ha * 0.45 + 2.5 + 3.14159, 6.28318) - 3.14159;
  float sheen = smoothstep(1.6, 0.3, abs(d2)) * limb;

  float mass = limb * (0.70 * arc + 0.70 * head) + 0.22 * sheen;
  mass *= 0.90 + 0.10 * clouds;

  mass += 0.05 * crescent(uv,  t * spd * 0.75) * 0.84 * gs;
  mass -= 0.04 * crescent(uv, -t * spd * 0.25) * 0.42 * gs;
  mass += 0.10 * crescent(uv,  t * spd * 0.60) * wavyBlob(uv, t) * 1.26 * gs;
  mass -= 0.05 * crescent(uv,  t * spd * 3.0) * 1.12 * gs;
  mass += 0.04 * crescent(uv, -t * spd * 2.3) * 0.70 * gs;

  // Intensity boost — brighten ribbon up to 60 %
  float ap = 1.0 + effect * 0.60;
  mass = clamp(mass * ap, 0.0, 1.0);

  col = mix(col, uC2, 0.92 * smoothstep(0.02, 1.0, mass));

  float rim = smoothstep(0.40, 0.48, lr);
  float rimGlow = rim * rim * (0.04 + 0.35 * mass);
  // Extra glow bleeding from audio + pulse
  rimGlow += effect * 0.15 * smoothstep(0.30, 0.48, lr);
  col = mix(col, uC2, min(rimGlow, 1.0));

  gl_FragColor = vec4(col * alpha, alpha);
}`;

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed');
  }
  return s;
}

function Surface({ palette, audioLevel, pulseAt }: { palette: HeroOrbPalette; audioLevel: number; pulseAt: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPalette = useRef(palette);
  const fromPalette = useRef(palette);
  const targetPalette = useRef(palette);
  const transitionStartedAt = useRef(performance.now());
  const audioLevelRef = useRef(audioLevel);
  const pulseAtRef = useRef(pulseAt);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  });

  useEffect(() => {
    pulseAtRef.current = pulseAt;
  });

  useEffect(() => {
    fromPalette.current = currentPalette.current;
    targetPalette.current = palette;
    transitionStartedAt.current = performance.now();
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    // antialias/depth/stencil are useless for a fullscreen-triangle shader;
    // disabling them saves fillrate, which matters when the webview falls
    // back to software GL.
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    gl.uniform2f(u('uRes'), canvas.width, canvas.height);
    const uTime = u('uTime');
    const uC0 = u('uC0'), uC1 = u('uC1'), uC2 = u('uC2'), uGlow = u('uGlow');
    const uSpeed = u('uSpeed'), uGlowStrength = u('uGlowStrength'), uAudioLevel = u('uAudioLevel'), uPulseTime = u('uPulseTime');

    const start = performance.now();
    let smooth = 0;
    let lastPulseAt = 0;
    let pulseShaderTime: number | null = null;
    let raf = 0;
    const frame = (now: number) => {
      const progress = Math.min(1, (now - transitionStartedAt.current) / PALETTE_TRANSITION_MS);
      const eased = progress * progress * (3 - 2 * progress);
      const pal = interpolatePalette(fromPalette.current, targetPalette.current, eased);
      currentPalette.current = pal;

      // Attack/release smoothing — fast snap-on, slow decay so the 100 ms
      // audio-meter gaps don't cause stutter.
      const target = audioLevelRef.current;
      const rate = target > smooth ? 0.25 : 0.06;
      smooth += (target - smooth) * rate;

      // State-transition pulse: when pulseAt changes, record the shader time
      // so the shader can decay it exponentially over ~260 ms.
      const curPulseAt = pulseAtRef.current;
      if (curPulseAt !== lastPulseAt) {
        lastPulseAt = curPulseAt;
        pulseShaderTime = (now - start) / 1000;
      }

      const shaderTime = (now - start) / 1000;
      gl.uniform1f(uTime, shaderTime);
      gl.uniform3fv(uC0, pal.colors[0]);
      gl.uniform3fv(uC1, pal.colors[1]);
      gl.uniform3fv(uC2, pal.colors[2]);
      gl.uniform3fv(uGlow, pal.glowColor);
      gl.uniform1f(uSpeed, pal.speed);
      gl.uniform1f(uGlowStrength, pal.glowStrength);
      gl.uniform1f(uAudioLevel, smooth);
      gl.uniform1f(uPulseTime, pulseShaderTime ?? -1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function HeroOrb({
  state = 'idle',
  size = 160,
  palette,
  audioLevel = 0,
  className,
  style,
}: HeroOrbProps) {
  const [pulseAt, setPulseAt] = useState(0);
  const resolvedPalette = useMemo(() => resolvePalette(state, palette), [palette, state]);

  // Fire a shader pulse when state becomes 'live' — no CSS transform, so the
  // orb expands and brightens purely inside the WebGL surface without clipping.
  useEffect(() => {
    if (state === 'live') {
      setPulseAt(Date.now());
    }
  }, [state]);

  // Noise gate: silence below 0.003 → 0  (keeps orb still on background hum)
  // Power curve: even quiet speech (RMS ~0.001) produces a visible pulse.
  const gated = audioLevel < 0.003 ? 0 : audioLevel;
  const magnitude = Math.min(1, Math.pow(Math.max(0, gated) * 30, 0.5));

  return (
    <div
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        ...style,
      }}
    >
      <Surface palette={resolvedPalette} audioLevel={magnitude} pulseAt={pulseAt} />
    </div>
  );
}
