import { FONT_MONO } from './palette';

const TAU = Math.PI * 2;

export interface HorseLook {
  readonly id: number;
  /** Body colour. */
  readonly coat: string;
  /** Darker body colour for the far-side legs, tail and mane. */
  readonly coatDark: string;
  /** Jockey silks: the horse's unique colour. */
  readonly silk: string;
}

export interface HorsePose {
  /** Stride cycle in [0, 1). */
  readonly stridePhase: number;
  /** Gallop amplitude in [0, 1]. */
  readonly amplitude: number;
  /** Final-stretch drive in [0, 1]. */
  readonly drive: number;
  /** True while the jockey may use the whip (still racing). */
  readonly racing: boolean;
  /** Presentation-time seed for the idle sway. */
  readonly idleTime: number;
}

/**
 * Draws a galloping horse and jockey with the nose's ground point at
 * (`x`, `groundY`). The horse faces right and is about 80 × 60 units at scale 1.
 */
export function drawHorse(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  look: HorseLook,
  pose: HorsePose,
): void {
  const { stridePhase: P, drive } = pose;
  const amp = pose.amplitude;
  const line = (a: number, b: number, c: number, d: number) => {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.stroke();
  };

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);
  const bob =
    -(0.5 + 0.5 * Math.sin(P * TAU)) * 2.4 * amp + (1 - amp) * Math.sin(pose.idleTime * 1.7) * 0.3;
  const pitch = Math.sin(P * TAU + 1.3) * 0.045 * amp;
  ctx.translate(0, bob - 30);
  ctx.rotate(pitch);
  ctx.translate(0, 30);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const leg = (hx: number, hy: number, offset: number, fore: boolean, color: string) => {
    const p = (((P + offset) % 1) + 1) % 1;
    const stance = 0.36;
    const extend = 1 + 0.12 * drive;
    const reachForward = (fore ? 0.6 : 0.45) * extend;
    const reachBack = (fore ? -0.55 : -0.75) * extend;
    let upper: number;
    let bend: number;
    if (p < stance) {
      upper = reachForward + (reachBack - reachForward) * (p / stance);
      bend = 0.08;
    } else {
      const k = (p - stance) / (1 - stance);
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * k);
      upper = reachBack + (reachForward - reachBack) * eased;
      bend = Math.sin(Math.PI * k) * (fore ? 1.7 : 1.2);
    }
    upper = upper * amp + (fore ? 0.04 : -0.06) * (1 - amp);
    bend *= amp;
    const a1 = fore ? upper : upper + 0.12;
    const a2 = fore ? upper - bend : upper - 0.18 + bend * 0.9;
    const l1 = fore ? 13 : 14;
    const l2 = fore ? 14 : 13.5;
    const kx = hx + Math.sin(a1) * l1;
    const ky = hy + Math.cos(a1) * l1;
    const fx = kx + Math.sin(a2) * l2;
    const fy = ky + Math.cos(a2) * l2;
    ctx.strokeStyle = color;
    ctx.lineWidth = fore ? 5 : 6.5;
    line(hx, hy, kx, ky);
    ctx.lineWidth = 2.7;
    line(kx, ky, fx, fy);
    ctx.fillStyle = '#0e0c0b';
    ctx.beginPath();
    ctx.arc(fx, fy, 1.9, 0, TAU);
    ctx.fill();
  };

  // Tail and far-side legs.
  const sway = Math.sin(P * TAU + 1) * 3 * amp;
  ctx.strokeStyle = look.coatDark;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(-22, -37);
  ctx.quadraticCurveTo(-33, -38 + sway * 0.4, -40 - amp * 5, -25 - amp * 7 + sway);
  ctx.stroke();
  leg(-15, -28, 0.1, false, look.coatDark);
  leg(13, -27, 0.55, true, look.coatDark);

  // Body.
  ctx.fillStyle = look.coat;
  ctx.beginPath();
  ctx.ellipse(0, -31, 20, 9.5, 0, 0, TAU);
  ctx.moveTo(-2.5, -32);
  ctx.arc(-13, -32, 10.5, 0, TAU);
  ctx.moveTo(22.5, -31);
  ctx.arc(13, -31, 9.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(-2, -38, 15, 2.6, 0, 0, TAU);
  ctx.fill();

  // Neck and head.
  ctx.save();
  ctx.translate(12, -34);
  ctx.rotate(Math.sin(P * TAU + 2) * 0.08 * amp - 0.07 * drive);
  ctx.translate(-12, 34);
  ctx.fillStyle = look.coat;
  ctx.beginPath();
  ctx.moveTo(6, -38);
  ctx.lineTo(24, -55);
  ctx.lineTo(31, -50);
  ctx.lineTo(21, -27);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(36, -47.5, 9.5, 4.3, 0.6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(25, -54);
  ctx.lineTo(27, -60);
  ctx.lineTo(29.5, -54.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = look.coatDark;
  ctx.lineWidth = 2.4;
  line(9, -40, 25, -56);
  ctx.fillStyle = '#0a0908';
  ctx.beginPath();
  ctx.arc(34.5, -50, 0.9, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Near-side legs.
  leg(-15, -28, 0, false, look.coat);
  leg(13, -27, 0.45, true, look.coat);

  // Saddle cloth with the horse number (kept at a constant on-screen size).
  const clothW = 14 / scale;
  const clothH = 10 / scale;
  const clothX = -9 - clothW / 2;
  const clothY = -34 - clothH / 2;
  ctx.beginPath();
  ctx.roundRect(clothX, clothY, clothW, clothH, 1.5 / scale);
  ctx.fillStyle = '#F4F2EC';
  ctx.fill();
  ctx.fillStyle = look.silk;
  ctx.fillRect(clothX, clothY + clothH - 1.8 / scale, clothW, 1.8 / scale);
  ctx.font = `700 ${8.5 / scale}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111';
  ctx.fillText(String(look.id), clothX + clothW / 2, clothY + clothH / 2 - 0.7 / scale);
  ctx.textBaseline = 'alphabetic';

  // Jockey.
  ctx.save();
  ctx.translate(0, -bob * 0.6);
  ctx.strokeStyle = '#E8E3D6';
  ctx.lineWidth = 3.4;
  line(-3, -43, 5, -38);
  ctx.strokeStyle = '#141210';
  ctx.lineWidth = 3;
  line(5, -38, 2, -33);
  const dy = 1.6 * drive;
  const dx = 1.5 * drive;
  if (pose.racing && drive > 0.25) {
    const swing = Math.sin(P * TAU + 0.6);
    const angle = -2.5 + swing * 0.55;
    const hx = -2 + swing * 1.5;
    const hy = -45 + dy;
    ctx.strokeStyle = look.silk;
    ctx.lineWidth = 2.2;
    line(2 + dx, -48 + dy, hx, hy);
    ctx.strokeStyle = 'rgba(20,16,12,0.85)';
    ctx.lineWidth = 0.9;
    line(hx, hy, hx + Math.cos(angle) * 15, hy + Math.sin(angle) * 15);
  }
  ctx.fillStyle = look.silk;
  ctx.beginPath();
  ctx.ellipse(1 + dx, -47.5 + dy, 8.5, 4.2, -0.22 - 0.12 * drive, 0, TAU);
  ctx.fill();
  const pump = Math.sin(P * TAU) * (1.6 + 2.6 * drive) * amp;
  ctx.strokeStyle = look.silk;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(6 + dx, -48 + dy);
  ctx.lineTo(14 + pump * 0.5, -44 + dy * 0.5);
  ctx.lineTo(21 + pump, -46 + dy * 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.8;
  line(21 + pump, -46 + dy * 0.5, 31, -48);
  ctx.fillStyle = look.silk;
  ctx.beginPath();
  ctx.arc(10.5 + dx * 1.6, -51.5 + dy * 1.3, 3.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(10.5 + dx * 1.6, -51.2 + dy * 1.3, 5.2, 1.3);
  ctx.restore();
  ctx.restore();
}
