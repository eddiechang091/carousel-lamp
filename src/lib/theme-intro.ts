/**
 * theme-intro.ts
 * 5-second canvas-2D opening animations for each holiday theme.
 * Drawn on a full-screen overlay canvas; the 3D carousel is revealed below
 * as the overlay fades out.
 */
import type { ThemeId } from './themes';

export const INTRO_DURATION = 5; // seconds

// ─── utilities ───────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function sm(lo: number, hi: number, t: number) {
  const x = clamp((t - lo) / (hi - lo), 0, 1);
  return x * x * (3 - 2 * x);
}

// ─── star field (shared) ─────────────────────────────────────
function starField(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, n = 90) {
  for (let i = 0; i < n; i++) {
    const seed = i * 137.508;
    const x = ((Math.sin(seed * 1.1) + 1) / 2) * w;
    const y = ((Math.sin(seed * 1.3) + 1) / 2) * h * 0.68;
    const r = 0.5 + ((Math.sin(seed * 2.7) + 1) / 2) * 1.6;
    const twk = 0.4 + Math.abs(Math.sin(t * (0.5 + (i % 7) * 0.14) + seed)) * 0.6;
    ctx.save();
    ctx.globalAlpha *= twk;
    ctx.fillStyle = '#fffde0';
    ctx.shadowBlur = r * 4; ctx.shadowColor = '#ffffaa';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ════════════════════════════════════════════════════════════════
//  HALLOWEEN
// ════════════════════════════════════════════════════════════════

function hwGhost(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, variant: number) {
  ctx.save();
  ctx.translate(x + Math.sin(t * 1.4 + variant) * s * 0.14, y);
  ctx.globalAlpha *= 0.6 + Math.sin(t * 2 + variant) * 0.2;

  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
  grd.addColorStop(0, 'rgba(100,210,255,0.3)'); grd.addColorStop(1, 'rgba(100,210,255,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(205,235,255,0.84)';
  ctx.shadowBlur = s * 0.5; ctx.shadowColor = '#8bd4ff';
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.44, Math.PI, 0);
  const pts = 5 + variant;
  for (let i = 0; i <= pts; i++) {
    const px = s * 0.44 - (i / pts) * s * 0.88;
    const wy = (i % 2 === 0 ? 1 : -1) * s * (0.12 + variant * 0.03);
    ctx.lineTo(px, s * (0.3 + variant * 0.04) + wy + Math.sin(t * 2.5 + i + variant) * s * 0.04);
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;

  ctx.fillStyle = '#1a0a2e';
  if (variant === 0) {
    ctx.beginPath(); ctx.ellipse(-s * .14, -s * .13, s * .07, s * .1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * .14, -s * .13, s * .07, s * .1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * .08, s * .1, 0, Math.PI * 2); ctx.fill();
  } else if (variant === 1) {
    ctx.beginPath(); ctx.ellipse(-s * .15, -s * .13, s * .09, s * .065, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * .15, -s * .13, s * .09, s * .065, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * .17, s * .08);
    for (let i = 0; i <= 4; i++) ctx.lineTo(-s * .17 + i * s * .085, s * .08 + (i % 2 === 0 ? s * .07 : -s * .03));
    ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(-s * .14, -s * .12, s * .08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * .14, -s * .12, s * .08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * .06, s * .14, 0, Math.PI); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function hwBat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  ctx.save(); ctx.translate(x, y);
  const flap = Math.sin(t * 13) * 0.65;
  ctx.fillStyle = '#17111f';
  ctx.beginPath(); ctx.ellipse(0, 0, s * .28, s * .2, 0, 0, Math.PI * 2); ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * s * .1, -s * .15); ctx.lineTo(side * s * .24, -s * .36);
    ctx.lineTo(side * s * .3, -s * .12); ctx.closePath(); ctx.fill();
  }
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1); ctx.rotate(-flap * 0.65);
    ctx.beginPath(); ctx.moveTo(s * .22, 0); ctx.quadraticCurveTo(s * .75, -s * .38, s * 1.15, flap * s * .55);
    ctx.quadraticCurveTo(s * .85, s * .1, s * .5, s * .1); ctx.quadraticCurveTo(s * .3, s * .05, s * .22, 0);
    ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = '#ff1a1a'; ctx.shadowBlur = 5; ctx.shadowColor = '#ff0000';
  ctx.beginPath(); ctx.arc(-s * .08, -s * .03, s * .05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * .08, -s * .03, s * .05, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.restore();
}

function hwWeb(ctx: CanvasRenderingContext2D, ox: number, oy: number, r: number, progress: number) {
  ctx.save(); ctx.translate(ox, oy);
  ctx.strokeStyle = 'rgba(200,200,255,0.42)'; ctx.lineWidth = 0.8;
  const spokes = 8, rings = 6;
  for (let i = 0; i < spokes; i++) {
    if (i / spokes > progress * 1.6) break;
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * Math.min(1, progress * 2), Math.sin(a) * r * Math.min(1, progress * 2));
    ctx.stroke();
  }
  for (let ring = 1; ring <= rings; ring++) {
    if (ring / rings > progress) break;
    const rr = (ring / rings) * r;
    ctx.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

function hwSpider(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, topY: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(200,200,255,0.42)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0, topY - y); ctx.lineTo(0, 0); ctx.stroke();
  ctx.shadowBlur = 10; ctx.shadowColor = '#7700cc'; ctx.fillStyle = '#1a0a2e';
  ctx.beginPath(); ctx.ellipse(0, -s * .5, s * .4, s * .6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, s * .44, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1a0a2e'; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const sway = Math.sin(t * 4 + i * .8 + side) * s * .07;
    const oy = (-0.15 + i * .14) * s;
    ctx.lineWidth = s * .1;
    ctx.beginPath(); ctx.moveTo(side * s * .4, oy);
    ctx.quadraticCurveTo(side * s * (.9 + i * .1), oy - s * .2 + sway, side * s * (1.3 + i * .08), oy + sway * .5);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 5; ctx.shadowColor = '#ff0000';
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
    ctx.beginPath(); ctx.arc((-1.5 + col) * s * .15, (-s * .05 + row * s * .14), s * .055, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.restore();
}

function hwSkeleton(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, alpha: number) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2.8) * .08); ctx.translate(0, Math.sin(t * 5) * s * .08);
  ctx.strokeStyle = '#d4d4d4'; ctx.lineWidth = s * .07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const ry = (i * .22 + .08) * s;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.quadraticCurveTo(side * s * .42, ry + s * .02, side * s * .34, ry + s * .12); ctx.stroke();
    }
  }
  ctx.beginPath(); ctx.ellipse(0, s * 1.08, s * .28, s * .12, 0, 0, Math.PI * 2); ctx.stroke();
  for (const side of [-1, 1]) {
    const ls = Math.sin(t * 5 + side * 1.2) * s * .14;
    ctx.save(); ctx.translate(side * s * .17, s * 1.1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ls, s * .6); ctx.stroke();
    ctx.translate(ls, s * .6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-ls * .5, s * .5); ctx.stroke();
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * s * .08, s * .1); ctx.rotate(side * (.4 + Math.sin(t * 4) * .3));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * .5); ctx.stroke();
    ctx.rotate(side * .5); ctx.beginPath(); ctx.moveTo(0, s * .5); ctx.lineTo(0, s); ctx.stroke();
    for (let f = 0; f < 3; f++) { ctx.beginPath(); ctx.moveTo((-0.08 + f * .08) * s, s); ctx.lineTo((-0.08 + f * .08) * s + side * s * .03, s + s * .1); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = '#d4d4d4'; ctx.shadowBlur = s * .3; ctx.shadowColor = '#a0ffa0';
  ctx.beginPath(); ctx.arc(0, -s * .22, s * .24, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.ellipse(-s * .1, -s * .24, s * .075, s * .09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * .1, -s * .24, s * .075, s * .09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * .04, -s * .1); ctx.lineTo(s * .04, -s * .1); ctx.lineTo(0, -s * .07); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8c8c8';
  for (let i = 0; i < 5; i++) ctx.fillRect((-0.1 + i * .05) * s, 0, s * .04, s * .07);
  ctx.restore();
}

function hwPumpkin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, variant: number, alpha: number) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
  ctx.shadowBlur = s * 1.4; ctx.shadowColor = '#ff6600';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#f07818', '#e06810', '#f07818'][i];
    ctx.beginPath(); ctx.ellipse((-1 + i) * s * .3, 0, s * .35, s * .5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#3f6b2a';
  ctx.beginPath(); ctx.roundRect(-s * .08, -s * .55, s * .16, s * .22, s * .06); ctx.fill();
  ctx.fillStyle = '#141414'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff4400';
  if (variant === 0) {
    for (const ex of [-s * .26, s * .26]) { ctx.beginPath(); ctx.moveTo(ex, -s * .08); ctx.lineTo(ex - s * .1, s * .1); ctx.lineTo(ex + s * .1, s * .1); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-s * .3, s * .3);
    for (let i = 0; i <= 5; i++) ctx.lineTo(-s * .3 + i * s * .12, s * .3 + (i % 2 === 0 ? s * .1 : -s * .04));
    ctx.fill();
  } else if (variant === 1) {
    for (const ex of [-s * .26, s * .26]) { ctx.beginPath(); ctx.arc(ex, s * .02, s * .11, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, s * .2, s * .3, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f07818';
    for (let i = 0; i < 5; i++) ctx.fillRect((-0.26 + i * .13) * s, s * .11, s * .07, s * .13);
  } else {
    for (const ex of [-s * .26, s * .26]) { ctx.beginPath(); ctx.arc(ex, -s * .05, s * .11, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#141414'; ctx.lineWidth = s * .07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .38, -s * .2); ctx.lineTo(-s * .14, -s * .08); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .38, -s * .2); ctx.lineTo(s * .14, -s * .08); ctx.stroke();
    ctx.fillStyle = '#141414'; ctx.beginPath();
    ctx.moveTo(-s * .32, s * .3);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-s * .32 + i * s * .08, s * .3 + (i % 2 === 0 ? s * .1 : -s * .04));
    ctx.lineTo(-s * .32, s * .42); ctx.closePath(); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.restore();
}

function hwBucket(ctx: CanvasRenderingContext2D, s: number, _t: number) {
  ctx.fillStyle = '#f07818';
  ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s * .88, s * 1.75); ctx.lineTo(s * .88, s * 1.75); ctx.lineTo(s, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,30,0,0.8)';
  ctx.beginPath(); ctx.ellipse(-s * .3, s * .88, s * .17, s * .14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * .3, s * .88, s * .17, s * .14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, s * 1.35, s * .28, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5c3a1e'; ctx.lineWidth = s * .16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, s * .9, Math.PI, 0); ctx.stroke();
  const cc = ['#ff4466', '#44ffaa', '#ffdd22', '#aa44ff', '#ff9900'];
  for (let i = 0; i < 5; i++) {
    const a = -1 + i * .5;
    ctx.fillStyle = cc[i]; ctx.shadowBlur = 5; ctx.shadowColor = cc[i];
    ctx.beginPath(); ctx.ellipse(a * s * .55, -s * .3 + i * s * .07, s * .19, s * .11, a * .5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function hwClown(ctx: CanvasRenderingContext2D, s: number, t: number) {
  const tilt = Math.sin(t * 2.8) * .07;
  const dance = Math.sin(t * 6) * s * .055;
  const arm = Math.sin(t * 4) * .4;
  const leg = Math.sin(t * 6) * .22;
  ctx.rotate(tilt); ctx.translate(0, dance);

  ctx.fillStyle = '#111';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * s * .3, s * .78, s * .27, s * .1, .14 * side, 0, Math.PI * 2); ctx.fill(); }

  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * s * .17, s * .4); ctx.rotate(leg * side);
    ctx.fillStyle = '#3a5fd1'; ctx.beginPath(); ctx.roundRect(-s * .15, 0, s * .3, s * .44, s * .07); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let d = 0; d < 4; d++) { ctx.beginPath(); ctx.arc((-0.08 + d * .055) * s, (.08 + d % 2 * .14) * s, s * .028, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  const jGrd = ctx.createRadialGradient(-s * .09, s * .24, 0, 0, s * .3, s * .44);
  jGrd.addColorStop(0, '#e84030'); jGrd.addColorStop(0.6, '#c43020'); jGrd.addColorStop(1, '#8a1a10');
  ctx.fillStyle = jGrd; ctx.beginPath(); ctx.ellipse(0, s * .3, s * .35, s * .42, 0, 0, Math.PI * 2); ctx.fill();
  const pc = ['#f7c948', '#3aa85e', '#a855e8', '#44aaff'];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + .4;
    ctx.fillStyle = pc[i]; ctx.save(); ctx.translate(Math.cos(a) * s * .21, s * .3 + Math.sin(a) * s * .26);
    ctx.rotate(Math.PI / 4); ctx.fillRect(-s * .085, -s * .085, s * .17, s * .17); ctx.restore();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? '#fff' : '#ffdddd';
    ctx.beginPath(); ctx.arc(Math.cos(a) * s * .28, s * .04 + Math.sin(a) * s * .1, s * .1, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save(); ctx.translate(s * .35, s * .16); ctx.rotate(arm + .42);
  ctx.fillStyle = '#c43020'; ctx.beginPath(); ctx.roundRect(s * .02, 0, s * .14, s * .44, s * .07); ctx.fill();
  ctx.fillStyle = '#ffe4c4'; ctx.beginPath(); ctx.arc(s * .09, s * .48, s * .1, 0, Math.PI * 2); ctx.fill();
  ctx.translate(s * .09, s * .6); hwBucket(ctx, s * .12, t); ctx.restore();

  ctx.save(); ctx.translate(-s * .35, s * .16); ctx.rotate(-arm - .42);
  ctx.fillStyle = '#c43020'; ctx.beginPath(); ctx.roundRect(-s * .16, 0, s * .14, s * .44, s * .07); ctx.fill();
  ctx.fillStyle = '#ffe4c4'; ctx.beginPath(); ctx.arc(-s * .09, s * .48, s * .1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const hGrd = ctx.createRadialGradient(-s * .08, -s * .22, 0, 0, -s * .14, s * .33);
  hGrd.addColorStop(0, '#fffde0'); hGrd.addColorStop(1, '#f5e8c0');
  ctx.fillStyle = hGrd; ctx.shadowBlur = s * .09; ctx.shadowColor = 'rgba(255,200,100,0.3)';
  ctx.beginPath(); ctx.arc(0, -s * .14, s * .31, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,100,100,0.32)';
  ctx.beginPath(); ctx.ellipse(-s * .19, -s * .1, s * .08, s * .055, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * .19, -s * .1, s * .08, s * .055, 0, 0, Math.PI * 2); ctx.fill();

  const blink = Math.abs(Math.sin(t * .63)) > .97 ? .07 : 1;
  ctx.fillStyle = '#222';
  for (const ex of [-s * .11, s * .11]) {
    ctx.beginPath(); ctx.ellipse(ex, -s * .19, s * .056, s * .072 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + s * .02, -s * .21, s * .02, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
  }

  const nGrd = ctx.createRadialGradient(-s * .03, -s * .098, 0, 0, -s * .085, s * .088);
  nGrd.addColorStop(0, '#ff8080'); nGrd.addColorStop(0.4, '#e81515'); nGrd.addColorStop(1, '#8a0000');
  ctx.fillStyle = nGrd; ctx.shadowBlur = s * .07; ctx.shadowColor = '#ff4444';
  ctx.beginPath(); ctx.arc(0, -s * .085, s * .088, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

  ctx.strokeStyle = '#222'; ctx.lineWidth = s * .022; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -s * .025, s * .145, Math.PI * .08, Math.PI * .92); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, s * .015, s * .125, Math.PI * .08, Math.PI * .92); ctx.fill();
  ctx.fillStyle = '#ff8fa0'; ctx.beginPath(); ctx.arc(0, s * .04, s * .08, 0, Math.PI); ctx.fill();

  ctx.fillStyle = '#5a0fa0'; ctx.shadowBlur = s * .06; ctx.shadowColor = '#9b59b6';
  ctx.beginPath(); ctx.ellipse(0, -s * .43, s * .34, s * .09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * .27, -s * .43); ctx.lineTo(s * .27, -s * .43); ctx.lineTo(s * .11, -s * .8); ctx.lineTo(-s * .11, -s * .8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * .11, -s * .8); ctx.lineTo(s * .11, -s * .8); ctx.lineTo(0, -s * 1.1); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  const hd = [{x:-.07,y:-.59},{x:.09,y:-.65},{x:0,y:-.5},{x:.07,y:-.57},{x:-.04,y:-.7}];
  const hc = ['#f7c948','#ff6b6b','#6be5ff','#aaffaa','#ff9f1c'];
  for (const [i, p] of hd.entries()) {
    ctx.fillStyle = hc[i]; ctx.shadowBlur = 7; ctx.shadowColor = hc[i];
    ctx.beginPath(); ctx.arc(p.x * s, p.y * s, s * .028, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f7c948'; ctx.shadowBlur = 12; ctx.shadowColor = '#ffe000';
  ctx.beginPath(); ctx.arc(0, -s * 1.1, s * .078, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
}

function drawHalloween(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const s = Math.min(w, h);

  const bg = ctx.createRadialGradient(w * .4, h * .3, 0, w * .5, h * .5, s * .95);
  bg.addColorStop(0, '#2d1030'); bg.addColorStop(.5, '#1a0820'); bg.addColorStop(1, '#070010');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const fog = ctx.createLinearGradient(0, h * .6, 0, h);
  fog.addColorStop(0, 'rgba(80,20,100,0)'); fog.addColorStop(1, 'rgba(80,20,100,0.42)');
  ctx.fillStyle = fog; ctx.fillRect(0, 0, w, h);

  ctx.save(); ctx.fillStyle = '#ffe066'; ctx.shadowBlur = s * .08; ctx.shadowColor = '#ffe066';
  ctx.beginPath(); ctx.arc(w * .78, h * .14, s * .075, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2d1030'; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(w * .78 + s * .028, h * .14 - s * .016, s * .065, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save(); ctx.globalAlpha *= sm(0, .6, t); starField(ctx, w, h, t, 70); ctx.restore();

  const wp = sm(.4, 2, t);
  hwWeb(ctx, 0, 0, s * .2, wp);
  ctx.save(); ctx.scale(-1, 1); hwWeb(ctx, -w, 0, s * .2, wp); ctx.restore();

  if (t > 1.2) hwSpider(ctx, w * .5, h * .06 + sm(1.2, 3, t) * h * .32, s * .038, t, h * .06);

  ctx.save(); ctx.globalAlpha *= sm(0, .5, t);
  for (let i = 0; i < 7; i++) {
    const prog = (t * .42 + i * .143) % 1;
    hwBat(ctx, (prog * 1.3 - .15) * w, h * (.07 + Math.sin(prog * Math.PI * 2.5 + i * 7.3) * .11 + i * .03), s * (.03 + i % 3 * .007), t);
  }
  ctx.restore();

  ctx.save(); ctx.globalAlpha *= sm(0, .5, t);
  for (let i = 0; i < 4; i++) {
    const gp = (t * .3 + i * .25) % 1;
    hwGhost(ctx, w * (.1 + i * .26), h * (1.08 - gp * 1.5), s * .065, t, i % 3);
  }
  ctx.restore();

  hwSkeleton(ctx, w * .78, h * .66, s * .08, t, sm(.8, 2, t) * (1 - sm(4.3, 5, t)));

  const ci = sm(.3, 1.5, t), co = 1 - sm(4.1, 5, t);
  if (ci > 0) {
    ctx.save(); ctx.translate(w * .5, h * .72 - ci * h * .09); ctx.scale(ci, ci); ctx.globalAlpha *= ci * co;
    hwClown(ctx, s * .19, t);
    ctx.restore();
  }

  const pa = sm(.8, 2, t) * (1 - sm(4.3, 5, t));
  for (const [i, px] of [.2, .5, .8].entries()) hwPumpkin(ctx, w * px, h * .86, s * .058, i, pa);
}

// ════════════════════════════════════════════════════════════════
//  CHRISTMAS
// ════════════════════════════════════════════════════════════════

interface Flake { x: number; y: number; r: number; speed: number; drift: number; opacity: number; }

function xmasSnowflake(ctx: CanvasRenderingContext2D, f: Flake, alpha: number) {
  ctx.save(); ctx.globalAlpha *= f.opacity * alpha;
  ctx.fillStyle = '#fff'; ctx.shadowBlur = 4; ctx.shadowColor = '#aaddff';
  ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawChristmas(ctx: CanvasRenderingContext2D, flakes: Flake[], t: number, w: number, h: number) {
  const s = Math.min(w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#020810'); bg.addColorStop(.4, '#061830'); bg.addColorStop(.7, '#0a2040'); bg.addColorStop(1, '#0f2850');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#c8e0f4';
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * .8);
  ctx.quadraticCurveTo(w * .12, h * .68, w * .28, h * .76);
  ctx.quadraticCurveTo(w * .44, h * .84, w * .58, h * .72);
  ctx.quadraticCurveTo(w * .72, h * .63, w * .88, h * .76);
  ctx.quadraticCurveTo(w, h * .8, w, h * .8); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(90,140,200,0.18)';
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * .82);
  ctx.quadraticCurveTo(w * .25, h * .75, w * .5, h * .8);
  ctx.quadraticCurveTo(w * .75, h * .85, w, h * .84); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();

  ctx.save(); ctx.globalAlpha *= sm(0, .5, t); starField(ctx, w, h, t, 110); ctx.restore();

  ctx.save(); ctx.fillStyle = '#fffde0'; ctx.shadowBlur = s * .05; ctx.shadowColor = '#fffde0';
  ctx.beginPath(); ctx.arc(w * .14, h * .14, s * .058, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#040c18'; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(w * .14 + s * .024, h * .14 - s * .012, s * .05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ── Sleigh ──────────────────────────────────────────────────
  const su = sm(0, 4.8, t);
  const eu = su * su * (3 - 2 * su);
  const p0 = { x: -w * .14, y: h * .52 }, p1 = { x: w * .3, y: h * .06 }, p2 = { x: w * .7, y: h * .06 }, p3 = { x: w * 1.14, y: h * .52 };
  const bez = (u: number) => {
    const mu = 1 - u;
    return { x: mu**3*p0.x+3*mu**2*u*p1.x+3*mu*u**2*p2.x+u**3*p3.x, y: mu**3*p0.y+3*mu**2*u*p1.y+3*mu*u**2*p2.y+u**3*p3.y };
  };
  const pos = bez(eu), pos2 = bez(Math.min(1, eu + .01));
  const ang = Math.atan2(pos2.y - pos.y, pos2.x - pos.x);

  if (eu > .02 && eu < .98) {
    // sparkle trail
    for (let i = 1; i < 20; i++) {
      const tp = bez(Math.max(0, eu - i * .022));
      const ta = (1 - i / 20) * .8 * (su < .05 ? su / .05 : 1);
      ctx.save(); ctx.globalAlpha *= ta;
      const sc = ['#ffd700','#ffe066','#ffffff','#ffbbbb','#bbffff'][i % 5];
      ctx.fillStyle = sc; ctx.shadowBlur = 10; ctx.shadowColor = sc;
      const jit = s * .015;
      ctx.beginPath(); ctx.arc(tp.x + (Math.sin(i*5.1)-.5)*jit, tp.y + (Math.cos(i*4.7)-.5)*jit, 1.5+Math.sin(i*2.3+t*4)*1.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(ang);
    const sc2 = s * .0014; ctx.scale(sc2, sc2);

    // reindeer (4 pairs)
    for (let pair = 0; pair < 4; pair++) {
      const bx = -130 - pair * 58, gal = Math.sin(t * 9 + pair * .6) * 14;
      for (const [si, side] of ([-1, 1] as const).entries()) {
        ctx.save(); ctx.translate(bx, side * 26 + gal * (si === 0 ? 1 : -1));
        ctx.fillStyle = '#2a1810';
        ctx.beginPath(); ctx.ellipse(0,0,27,13,.18,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(22,-8); ctx.quadraticCurveTo(32,-18,38,-12); ctx.quadraticCurveTo(44,-6,38,0); ctx.quadraticCurveTo(32,2,22,0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#2a1810'; ctx.lineWidth=4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(32,-17); ctx.lineTo(28,-36); ctx.moveTo(28,-36); ctx.lineTo(21,-28); ctx.moveTo(28,-36); ctx.lineTo(36,-28); ctx.stroke();
        const lg = Math.sin(t * 9 + pair * .6 + side) * 15;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-12,10); ctx.lineTo(-16,28+lg); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5,11); ctx.lineTo(2,28-lg); ctx.stroke();
        if (pair === 0) {
          ctx.fillStyle='#ff2200'; ctx.shadowBlur=12; ctx.shadowColor='#ff4400';
          ctx.beginPath(); ctx.arc(44,-5,6,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#2a1810';
        }
        ctx.restore();
      }
      ctx.strokeStyle='rgba(180,180,180,0.5)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(bx+30,0); ctx.lineTo(bx+86,0); ctx.stroke();
    }

    // sleigh body
    ctx.fillStyle='#881818';
    ctx.beginPath(); ctx.moveTo(-40,-12); ctx.quadraticCurveTo(-10,-45,22,-32); ctx.quadraticCurveTo(55,-18,58,12); ctx.quadraticCurveTo(26,24,-40,16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-40,16); ctx.quadraticCurveTo(10,26,58,12); ctx.stroke();
    ctx.strokeStyle='#5c3a1e'; ctx.lineWidth=6; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-55,22); ctx.quadraticCurveTo(5,40,70,18); ctx.stroke();

    // Santa
    ctx.fillStyle='#cc1111'; ctx.beginPath(); ctx.ellipse(10,-28,22,28,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.fillRect(-10,-12,42,8); ctx.fillStyle='#333'; ctx.fillRect(-2,-12,10,8);
    ctx.fillStyle='#ffe4c4'; ctx.beginPath(); ctx.arc(10,-58,15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(10,-50,13,0,Math.PI); ctx.fill();
    ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(4,-64,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(16,-64,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#cc1111'; ctx.beginPath(); ctx.moveTo(-4,-68); ctx.lineTo(24,-68); ctx.lineTo(18,-96); ctx.lineTo(2,-96); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff'; ctx.fillRect(-6,-72,32,8); ctx.beginPath(); ctx.arc(10,-98,8,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(30,-35); ctx.rotate(Math.sin(t*5)*.4-.6);
    ctx.fillStyle='#cc1111'; ctx.beginPath(); ctx.roundRect(0,0,14,32,7); ctx.fill();
    ctx.fillStyle='#ffe4c4'; ctx.beginPath(); ctx.arc(7,36,10,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle='#8B4513'; ctx.fillRect(-40,-60,28,38);
    ctx.fillStyle='#cc1111'; ctx.beginPath(); ctx.arc(-26,-60,10,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-38,-40); ctx.lineTo(-14,-40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-26,-60); ctx.lineTo(-26,-40); ctx.stroke();

    ctx.restore();
  }

  // snowflakes
  const snowAlpha = sm(0, 1, t);
  for (const f of flakes) {
    f.x += f.drift; f.y += f.speed * 2.5;
    if (f.y > h + 10) f.y = -10;
    if (f.x > w + 10) f.x = -10; else if (f.x < -10) f.x = w + 10;
    xmasSnowflake(ctx, f, snowAlpha);
  }
}

// ════════════════════════════════════════════════════════════════
//  SPRING FESTIVAL / LUNAR
// ════════════════════════════════════════════════════════════════

interface DragonSeg { x: number; y: number; }
interface FwParticle { dx: number; dy: number; speed: number; }
interface Firework { x: number; y: number; born: number; color: string; particles: FwParticle[]; }

function lunarLantern(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
  ctx.shadowBlur = s * 1.5; ctx.shadowColor = '#ff4400';
  ctx.fillStyle = '#d2222d'; ctx.beginPath(); ctx.ellipse(0,0,s,s*1.3,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f0c24b'; ctx.shadowBlur = s * .5; ctx.shadowColor = '#ffd000';
  ctx.beginPath(); ctx.ellipse(0,-s*1.1,s*.5,s*.22,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,s*1.1,s*.5,s*.22,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#d2222d'; ctx.shadowBlur = 0; ctx.fillRect(-s*.08,s*1.3,s*.16,s*.6); ctx.restore();
}

function dragonSeg(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ci: number) {
  const col = ['#d2222d','#f0c24b','#e05020','#ffd060'][ci % 4];
  const glow = ['#ff4400','#ffd000','#ff6600','#ffe030'][ci % 4];
  ctx.save(); ctx.translate(x, y);
  ctx.shadowBlur = r * .8; ctx.shadowColor = glow;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = ['#ff6633','#ffe066','#ff8844','#ffee88'][ci % 4];
  ctx.beginPath(); ctx.arc(0,-r*.35,r*.65,Math.PI,0); ctx.fill();
  ctx.shadowBlur = 0; ctx.restore();
}

function dragonHead(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, t: number) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
  ctx.shadowBlur = r * 1.8; ctx.shadowColor = '#ff6600';
  ctx.fillStyle = '#d2222d'; ctx.beginPath(); ctx.ellipse(0,0,r*1.4,r,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#c01010'; ctx.beginPath(); ctx.ellipse(r*1.2,0,r*.55,r*.65,0,0,Math.PI*2); ctx.fill();
  // mane spines
  ctx.fillStyle = '#f0c24b';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI/2 + (-2+i)*Math.PI/6;
    const sl = r*(1+i%2*.3); ctx.save(); ctx.rotate(a-Math.PI/2);
    ctx.beginPath(); ctx.moveTo(-r*.5,0); ctx.lineTo(0,-sl); ctx.lineTo(r*.5,0); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // eyes
  ctx.shadowBlur = r * .6; ctx.shadowColor = '#ffd700'; ctx.fillStyle = '#ffd700';
  for (const ey of [-r*.42, r*.42]) {
    ctx.beginPath(); ctx.arc(-r*.15,ey,r*.32,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a0a10'; ctx.beginPath(); ctx.arc(-r*.08,ey,r*.17,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-r*.04,ey-r*.08,r*.07,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffd700';
  }
  // horns
  ctx.fillStyle='#f0c24b'; ctx.shadowBlur=6; ctx.shadowColor='#ffd000';
  for (const hy of [-1,1]) {
    ctx.save(); ctx.scale(1,hy);
    ctx.beginPath(); ctx.moveTo(-r*.4,r*.4); ctx.quadraticCurveTo(-r*.7,r*1.2,-r*.5,r*1.5);
    ctx.quadraticCurveTo(-r*.2,r*1.7,0,r*1.4); ctx.quadraticCurveTo(r*.1,r*1.1,0,r*.5); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.shadowBlur=0;
  // whiskers
  ctx.strokeStyle='#ffd700'; ctx.lineWidth=r*.08; ctx.lineCap='round'; ctx.shadowBlur=5; ctx.shadowColor='#ffd700';
  for (const wy of [-1,1]) {
    ctx.beginPath(); ctx.moveTo(r,wy*r*.22); ctx.quadraticCurveTo(r*1.7,wy*r*.55,r*2.4,wy*r*.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*.8,wy*r*.38); ctx.quadraticCurveTo(r*1.4,wy*r*.85,r*1.9,wy*r*.7); ctx.stroke();
  }
  ctx.shadowBlur=0;
  // nostrils
  ctx.fillStyle='#8a0010';
  for (const ny of [-r*.22,r*.22]) { ctx.beginPath(); ctx.arc(r*1.4,ny,r*.12,0,Math.PI*2); ctx.fill(); }
  // flame breath
  const fa = Math.max(0, (Math.sin(t*2.8)-.3)/.7);
  if (fa > 0) {
    ctx.save(); ctx.globalAlpha *= fa;
    const fg=ctx.createRadialGradient(r*1.8,0,0,r*1.8,0,r*1.6);
    fg.addColorStop(0,'rgba(255,220,50,0.95)'); fg.addColorStop(.3,'rgba(255,120,20,0.8)');
    fg.addColorStop(.7,'rgba(200,30,0,0.4)'); fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(r*1.8,0,r*1.6,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function firework(ctx: CanvasRenderingContext2D, fw: Firework, t: number) {
  const age = t - fw.born, dur = 1.6;
  if (age > dur) return;
  const prog = age / dur, alpha = Math.max(0, 1 - prog * prog);
  ctx.save(); ctx.globalAlpha *= alpha;
  for (const p of fw.particles) {
    const ease = 1 - (1-prog)**2;
    const px = fw.x + p.dx * p.speed * ease * 190;
    const py = fw.y + p.dy * p.speed * ease * 190 + prog * prog * 65;
    const r = (1 - prog) * 4.5; if (r < .15) continue;
    ctx.fillStyle = fw.color; ctx.shadowBlur = r * 3; ctx.shadowColor = fw.color;
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur=0; ctx.restore();
}

function drawLunar(ctx: CanvasRenderingContext2D, hist: DragonSeg[], fws: Firework[], fwTriggers: boolean[], t: number, w: number, h: number) {
  const s = Math.min(w, h);

  const bg = ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#1a0005'); bg.addColorStop(.3,'#3d0010'); bg.addColorStop(.7,'#4a0015'); bg.addColorStop(1,'#1a0510');
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

  // auspicious clouds
  ctx.fillStyle='rgba(200,140,40,0.14)';
  for (let i=0;i<6;i++) {
    const cx=w*(.08+i*.18)+Math.sin(t*.3+i)*w*.025, cy=h*(.12+i%2*.09+Math.sin(t*.2+i*1.5)*.03), cr=s*(.065+i%3*.02);
    ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.arc(cx+cr*1.1,cy+cr*.2,cr*.75,0,Math.PI*2); ctx.arc(cx-cr*.9,cy+cr*.3,cr*.65,0,Math.PI*2); ctx.fill();
  }

  // lanterns
  for (let i=0;i<6;i++) {
    const lx=w*(.1+i*.16), ly=h*.1+Math.sin(t*1.1+i*1.1)*h*.018;
    lunarLantern(ctx,lx,ly,s*.03,(0.5+Math.sin(t*2+i)*.22)*sm(.3,1.5,t));
  }

  // dragon
  const ds = t-.4;
  if (ds>0) {
    const hx=w*.5+Math.cos(ds*1.1)*w*.36+Math.cos(ds*2.5)*w*.09;
    const hy=h*.42+Math.sin(ds*1.1)*h*.26+Math.sin(ds*2.3)*h*.09;
    hist.unshift({x:hx,y:hy}); if (hist.length>80) hist.pop();
    const da=sm(.4,1.1,t)*(1-sm(4.3,5,t));
    const segs=Math.min(hist.length,55);
    for (let i=segs-1;i>=1;i--) {
      const p=hist[i], scale=1-i/segs, r=s*(.048*scale+.012);
      ctx.save(); ctx.globalAlpha*=da*(0.65+scale*.35);
      dragonSeg(ctx,p.x,p.y,r,i%4);
      ctx.restore();
    }
    if (hist.length>1) {
      const h0=hist[0], h1=hist[Math.min(3,hist.length-1)];
      ctx.save(); ctx.globalAlpha*=da;
      dragonHead(ctx,h0.x,h0.y,s*.072,Math.atan2(h0.y-h1.y,h0.x-h1.x),t);
      ctx.restore();
    }
  }

  // fireworks at fixed timestamps
  const fwTimes=[.8,1.4,2.0,2.7,3.3,3.9,4.5];
  const fwColors=['#ff4400','#ffd700','#ff88cc','#44ddff','#88ff44','#ff6600','#cc44ff'];
  for (const [fi,ft] of fwTimes.entries()) {
    if (t>ft && !fwTriggers[fi]) {
      fwTriggers[fi]=true;
      const pts:FwParticle[]=[];
      for (let i=0;i<30;i++) {
        const a=(i/30)*Math.PI*2, sp=.7+Math.sin(i*5.1)*.3;
        pts.push({dx:Math.cos(a)*sp,dy:Math.sin(a)*sp,speed:1});
      }
      fws.push({x:w*(.15+Math.sin(ft*3.3)*.7),y:h*(.08+Math.cos(ft*4.1)*.22),born:t,color:fwColors[fi%fwColors.length],particles:pts});
    }
  }
  // purge old
  for (let i=fws.length-1;i>=0;i--) { if (t-fws[i].born>1.7) fws.splice(i,1); }
  for (const fw of fws) firework(ctx,fw,t);
}

// ════════════════════════════════════════════════════════════════
//  PUBLIC CLASS
// ════════════════════════════════════════════════════════════════

export class ThemeIntroAnimator {
  private flakes: Flake[] = [];
  private dragonHist: DragonSeg[] = [];
  private fireworks: Firework[] = [];
  private fwTriggers = new Array<boolean>(8).fill(false);

  constructor(private theme: ThemeId, w: number, h: number) {
    if (theme === 'christmas') {
      for (let i = 0; i < 90; i++) {
        const seed = i * 137.5;
        this.flakes.push({
          x: ((Math.sin(seed * 1.1) + 1) / 2) * w,
          y: ((Math.sin(seed * 1.3) + 1) / 2) * h,
          r: .8 + ((Math.sin(seed * 2.7) + 1) / 2) * 2.6,
          speed: .4 + ((Math.sin(seed * 3.1) + 1) / 2) * .9,
          drift: (Math.sin(seed * 4.1) - .5) * .35,
          opacity: .4 + ((Math.sin(seed * 5.3) + 1) / 2) * .6,
        });
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, t: number, globalAlpha: number) {
    if (this.theme === 'default') return;
    const { width: w, height: h } = ctx.canvas;
    ctx.save(); ctx.globalAlpha = globalAlpha;
    if (this.theme === 'halloween') drawHalloween(ctx, t, w, h);
    else if (this.theme === 'christmas') drawChristmas(ctx, this.flakes, t, w, h);
    else if (this.theme === 'lunar') drawLunar(ctx, this.dragonHist, this.fireworks, this.fwTriggers, t, w, h);
    ctx.restore();
  }
}
