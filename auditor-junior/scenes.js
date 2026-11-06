'use strict';
// Scenes for the deck: each slide bakes its own small place with engine.js, then draws its moving parts every frame.

/* ---------- example data shared by the slides and the scenes ---------- */
const CASES = [
  { nf: '1043', valor: 'R$ 18.400', obs: 'sem cadastro', alerta: true },
  { nf: '1051', valor: 'R$ 2.300', obs: 'cadastrado', alerta: false },
  { nf: '1060', valor: 'R$ 12.900', obs: 'cadastrado', alerta: true },
  { nf: '1077', valor: 'R$ 640', obs: 'cadastrado', alerta: false },
  { nf: '1082', valor: 'R$ 5.100', obs: 'sem cadastro', alerta: true },
  { nf: '1090', valor: 'R$ 31.000', obs: 'cancelada', alerta: false },
  { nf: '1102', valor: 'R$ 9.990', obs: 'cadastrado', alerta: false },
  { nf: '1115', valor: 'R$ 10.450', obs: 'cadastrado', alerta: true },
  { nf: '1123', valor: 'R$ 1.200', obs: 'cadastrado', alerta: false },
  { nf: '1131', valor: 'R$ 22.000', obs: 'cancelada', alerta: false },
  { nf: '1146', valor: 'R$ 870', obs: 'sem cadastro', alerta: true },
  { nf: '1158', valor: 'R$ 7.300', obs: 'cadastrado', alerta: false },
];
// each optimisation round adds one line to the instructions; `wrong` lists the cases it still misses
const ROUNDS = [
  { line: 'Analise a nota fiscal e diga se ela tem risco.', wrong: [0, 2, 4, 7, 9, 10] },
  { line: 'Responda só Alerta ou OK e explique o motivo em uma frase.', wrong: [2, 4, 7, 9] },
  { line: 'Dê Alerta quando o fornecedor não tiver cadastro.', wrong: [2, 7, 9] },
  { line: 'Dê Alerta quando o valor passar de R$ 10.000,00.', wrong: [5, 9] },
  { line: 'Nota cancelada recebe OK, mesmo com valor alto.', wrong: [] },
];
const WEEKS = [92, 93, 91, 92, 90, 91, 87, 82, 79, 77, 76, 75];
const RECOVERY = [86, 90, 92, 93, 92, 93, 92, 93, 92, 93, 92];
const LIMIT = 85, CHANGE_WEEK = 7;
function weekScore(w) {
  return UI.fixedAt && w > UI.fixedAt ? RECOVERY[w - UI.fixedAt - 1] : WEEKS[w - 1];
}

// what the slides' controls have set; deck.js writes it, the scenes read it
const UI = {
  instr: 'claras', deliverAt: -1, delivered: 'claras',
  app: 'sm', input: 'arquivos',
  gold: new Set([0, 1, 2, 3, 4, 6, 7]), toggled: -1, toggledAt: -9,
  round: 1, roundAt: -9,
  use: 'tela', useAt: 0, useRunAt: -9,
  week: 6, weekAt: -9, fixedAt: 0,
  cycleStop: 0,
};
let T = 0; // seconds since the page loaded, set by deck.js every frame
const since = at => STILL ? 99 : T - at; // reduced motion jumps every animation to its end

/* ---------- palette ---------- */
const SHEET = [238, 234, 222], KRAFT = [192, 160, 116], WOOD = [150, 106, 64], WOOD_DARK = [96, 70, 50];
const METAL = [74, 80, 94], STONE = [196, 178, 150], GLASS = [112, 160, 190], GOLD = [232, 200, 62];
const RED = [176, 58, 44], BLUE = [48, 84, 124], GREEN = [70, 124, 78], VIOLET = [112, 82, 140];
const GROUP_COLORS = [RED, BLUE, GREEN, VIOLET];
const BOARD_OK = [132, 192, 128], BOARD_BAD = [222, 128, 108], BIN_INSIDE = [52, 48, 54], TILE = [178, 172, 160];
const LAMP_IDLE = [210, 200, 160], LAMP_RED = [228, 72, 52], LAMP_GREEN = [92, 200, 108];
const LIT_SCREEN = rgb(156, 218, 232), DIM_SCREEN = rgb(96, 150, 170);
const LED_ON = rgb(120, 236, 140), LED_OFF = rgb(40, 46, 52);
const OK_PIX = rgb(54, 150, 84), BAD_PIX = rgb(214, 62, 44), GOLD_PIX = rgb(...GOLD);
const AUDITOR = { shirt: [46, 98, 92], stripe: [226, 232, 220], legs: [44, 46, 58], hair: [40, 30, 24], skin: [214, 164, 126] };

/* ---------- ground: a small tiled office floor on a grass island ---------- */
const FLOOR = [[203, 197, 184], [210, 205, 193], [217, 212, 201], [224, 220, 210]];
const JOINT = rgb(186, 180, 168), DIRT = [132, 100, 72];
const KIND_FLOOR = 1, KIND_DIRT = 2;
function islandGround(island, floor) {
  return (x, y, ix, iy, i) => {
    const edge = Math.pow(Math.pow(Math.abs(x) / island, 4) + Math.pow(Math.abs(y) / island, 4), .25);
    const rough = edge + (noise(x * 1.3, y * 1.3) - .5) * .13;
    if (rough > 1.04) return 0;
    if (rough > .93 && hash(ix, iy) < (rough - .93) / .11) return 0;
    const fine = hash(ix, iy);
    if (Math.abs(x) < floor && Math.abs(y) < floor) {
      kinds[i] = KIND_FLOOR;
      const jx = x / 2 - Math.floor(x / 2), jy = y / 2 - Math.floor(y / 2);
      if ((jx < .06 || jy < .06) && fine > .1) return JOINT;
      // close tones, so the dither reads as stone and not as a checkerboard
      const v = .5 + (noise(x * .6, y * .6) - .5) * .5 + (hash(Math.floor(x / 2), Math.floor(y / 2) + 9) - .5) * .3;
      return rgb(...FLOOR[clamp(Math.floor(v * 4 + (bayerAt(ix, iy) - .5) * .6), 0, 3)]);
    }
    const rim = Math.max(Math.abs(x), Math.abs(y)) - floor;
    if (rim < .3 + noise(x * 2.2, y * 2.2) * .7) {
      kinds[i] = KIND_DIRT;
      const ramp = rampOf(DIRT);
      if (fine > .975) return ramp[4];
      return ramp[clamp(Math.floor(2.1 + noise(x * 3, y * 3) * 1.4 + (bayerAt(ix, iy) - .5) * .9), 1, 4)];
    }
    kinds[i] = KIND_GRASS;
    const t = noise(x * .9, y * .9) * 1.15 + (fine - .5) * .55 - .08;
    return rgb(...GRASS[clamp(Math.floor(t * 4.2), 0, 3)]);
  };
}

function bakeScene(sc) {
  zb.fill(-1e9); pix.fill(PAPER); ground.fill(0); kinds.fill(0); shadowMask.fill(0);
  tufts.length = 0; leaves.length = 0;
  const color = islandGround(sc.island || 9.2, sc.floor || 6.4);
  for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
    const g = unproject(ix + .5, iy + .5), i = iy * W + ix, c = color(g.x, g.y, ix, iy, i);
    if (!c) continue;
    pix[i] = c; ground[i] = 1;
    zb[i] = (g.x + g.y) / R2 * COS;
  }
  growGrass();
  groundZ.set(zb);
  pendingShadows.length = 0;
  if (sc.bake) sc.bake();
  flushShadows();
  bakeOcclusion();
  staticShadow.set(shadowMask);
  applyShadows(groundZ);
  bakedPix.set(pix);
  bakedZ.set(zb);
}
function drawFrame(sc, t) {
  pix.set(bakedPix);
  zb.set(bakedZ);
  pendingShadows.length = 0;
  if (sc.draw) sc.draw(t);
  const windT = STILL ? 0 : Math.floor(t * WIND_FPS) / WIND_FPS;
  drawLeaves(windT);
  drawTufts(windT);
  flushShadows();
  // shadows only touch pixels still at ground depth, so props and figures stay clean
  applyShadows(bakedZ);
  shadeEdges();
  if (sc.overlay) sc.overlay(t);
  ctx.putImageData(image, 0, 0);
}

/* ---------- props ---------- */
// a box's cast shadow: discs over its footprint at every height, so tall and thin props still leave one
function shade(x0, y0, z0, x1, y1, z1) {
  const nx = Math.max(1, Math.round((x1 - x0) / .3)), ny = Math.max(1, Math.round((y1 - y0) / .3));
  for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
    const x = x0 + (a + .5) * (x1 - x0) / nx, y = y0 + (b + .5) * (y1 - y0) / ny;
    for (let z = z1; z >= z0 - .01; z -= .25) castShadow(x, y, Math.max(z, 0), .24, 1, .2);
  }
}
const mix = (a, b, k, lift) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k) + Math.sin(Math.PI * k) * lift];
function solid(x0, y0, z0, x1, y1, z1, c, seed = 0) {
  box(x0, y0, z0, x1, y1, z1, c, seed);
  shade(x0, y0, z0, x1, y1, z1);
}
function desk(x, y, w = 2.4, d = 1.2) {
  solid(x, y, .82, x + w, y + d, .95, WOOD, 3);
  for (const [lx, ly] of [[x + .08, y + .08], [x + w - .24, y + .08], [x + .08, y + d - .24], [x + w - .24, y + d - .24]]) {
    solid(lx, ly, 0, lx + .16, ly + .16, .82, WOOD_DARK, 5);
  }
}
function papers(x, y, z, n, seed = 0) {
  for (let k = 0; k < n; k++) {
    const dx = (hash(k + seed, 3) - .5) * .12, dy = (hash(k + seed, 5) - .5) * .12;
    box(x + dx, y + dy, z + k * .07, x + dx + .62, y + dy + .82, z + k * .07 + .06, SHEET, k + seed);
  }
  shade(x, y, z, x + .62, y + .82, z + n * .07);
}
function crate(x, y, z, c, s = .9, h = .7) { solid(x, y, z, x + s, y + s, z + h, c, (x * 7 + y * 3) | 0); }
function rack(x, y) { solid(x, y, 0, x + .9, y + .9, 2.2, METAL, 7); }
function rackLights(x, y, busy) {
  const tick = Math.floor(T * (busy ? 9 : 2));
  for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) {
    const c = hash(r * 3 + k, tick) > .45 ? LED_ON : LED_OFF, z = .45 + r * .28;
    plot(x + .91, y + .22 + k * .22, z, c);
    plot(x + .91, y + .27 + k * .22, z, c);
    plot(x + .22 + k * .22, y + .91, z, c);
    plot(x + .27 + k * .22, y + .91, z, c);
  }
}
function building(x, y) {
  solid(x, y, 0, x + 1.5, y + 1.3, 3, STONE, 9);
  for (let z = .5; z < 2.8; z += .6) {
    for (const yy of [y + .2, y + .75]) box(x + 1.5, yy, z, x + 1.53, yy + .32, z + .34, GLASS);
    for (const xx of [x + .2, x + .62, x + 1.04]) box(xx, y + 1.3, z, xx + .28, y + 1.33, z + .34, GLASS);
  }
}
// a small desk with a monitor whose screen faces down-right
function kiosk(x, y) {
  desk(x, y, 1.2, 1.2);
  solid(x + .5, y + .55, .95, x + .62, y + .67, 1.3, METAL, 2);
  solid(x + .45, y + .05, 1.3, x + .6, y + 1.15, 2.05, METAL, 4);
}
function screenGlow(x, y, busy) {
  const scroll = busy ? Math.floor(T * 6) : 0;
  for (let z = 1.38; z < 1.98; z += .05) {
    const line = Math.floor((z - 1.38) / .1), lit = (line + scroll) % 3 !== 2;
    for (let yy = y + .14; yy < y + 1.06; yy += .05) plot(x + .61, yy, z, lit ? LIT_SCREEN : DIM_SCREEN);
  }
}
function lamp(x, y, c) {
  capsule([x, y, 0], [x, y, 2.1], .09, .07, () => METAL, 'solid');
  sphere(x, y, 2.4, .32, c, 'gloss');
  castShadow(x, y, 1, .1, 1, 0);
  castShadow(x, y, 2.1, .32, 1, 0);
}
function bins(x, y) {
  for (let k = 0; k < 3; k++) {
    const bx = x + k * 1.1;
    solid(bx, y, 0, bx + .9, y + .9, .6, GROUP_COLORS[k], k);
    box(bx + .1, y + .1, .45, bx + .8, y + .8, .61, BIN_INSIDE);
  }
}
function auditor(x, y, yaw, pose = {}) {
  const breathe = STILL ? 0 : Math.sin(T * 1.8) * .012;
  const base = { armR: .05 + breathe, armL: .1, stance: .08 };
  return figure(x, y, yaw, Object.assign(base, pose, { lean: (pose.lean || 0) + breathe }), AUDITOR, dynamicAdd);
}
function packet(a, b, k, lift, c = GOLD, r = .3) {
  const x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k), z = lerp(a[2], b[2], k) + Math.sin(Math.PI * k) * lift;
  sphere(x, y, z, r, c, 'gloss');
  castShadow(x, y, Math.max(0, z - r), r * .9, 1, 0);
}

/* ---------- overlay marks: drawn after the edges, always on top ---------- */
const CHECK = ['.....XX', '....XX.', 'X..XX..', 'XXXX...', '.XX....'];
const CROSS = ['XX...XX', '.XX.XX.', '..XXX..', '.XX.XX.', 'XX...XX'];
const spriteCache = new Map();
function spriteParts(mask) {
  let parts = spriteCache.get(mask);
  if (parts) return parts;
  const fill = [], on = new Set(), key = (x, y) => x + ',' + y;
  mask.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') { fill.push([x, y]); on.add(key(x, y)); } }));
  const ink = [], seen = new Set();
  for (const [x, y] of fill) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const k = key(x + dx, y + dy);
    if (!on.has(k) && !seen.has(k)) { seen.add(k); ink.push([x + dx, y + dy]); }
  }
  parts = { fill, ink, w: mask[0].length, h: mask.length };
  spriteCache.set(mask, parts);
  return parts;
}
// a mark whose bottom centre sits at (sx, sy)
function drawSprite(mask, sx, sy, color) {
  const p = spriteParts(mask), left = Math.round(sx - p.w / 2), top = Math.round(sy - p.h);
  const at = pts => pts.map(([x, y]) => [left + x, top + y]);
  haloDots(at(p.ink));
  drawDots(at(p.ink), INK);
  drawDots(at(p.fill), color);
}
function markAt(x, y, z, good) {
  const p = project(x, y, z);
  drawSprite(good ? CHECK : CROSS, p.sx, p.sy, good ? OK_PIX : BAD_PIX);
}
function arrowAt(x, y, z) {
  const p = project(x, y, z);
  drawArrow(p.sx, p.sy - 2, T);
}
// a dotted line between two points in the world, used for goals and limits
function dottedLine(a, b, color) {
  const pa = project(...a), pb = project(...b), n = Math.ceil(Math.hypot(pb.sx - pa.sx, pb.sy - pa.sy));
  const dots = [];
  for (let k = 0; k <= n; k += 3) dots.push([lerp(pa.sx, pb.sx, k / n), lerp(pa.sy, pb.sy, k / n)]);
  haloDots(dots);
  drawDots(dots, color);
}
function clockFace(x, y, z, angle) {
  const p = project(x, y, z), cx = Math.round(p.sx), cy = Math.round(p.sy), r = 8;
  const fill = [], ring = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= r - .5) fill.push([cx + dx, cy + dy]);
    else if (d <= r + .6) ring.push([cx + dx, cy + dy]);
  }
  drawDots(fill, PAPER);
  drawDots(ring, INK);
  const hand = (a, len, color) => {
    const dots = [];
    for (let k = 0; k <= len; k++) dots.push([cx + Math.sin(a) * k, cy - Math.cos(a) * k]);
    drawDots(dots, color);
  };
  hand(angle / 12, 4, INK);
  hand(angle, 7, BAD_PIX);
}

// a speech bubble with dots that fill in, next to the agent's head while he reads
function thinking(x, y, z) {
  const p = project(x, y, z), left = Math.round(p.sx) + 5, top = Math.round(p.sy) - 8, w = 15, h = 9;
  const fill = [], ink = [];
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if ((xx === 0 || xx === w - 1) && (yy === 0 || yy === h - 1)) continue;
    (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1 ? ink : fill).push([left + xx, top + yy]);
  }
  ink.push([left + 1, top + h], [left, top + h + 1]);
  haloDots(ink);
  drawDots(fill, PAPER);
  drawDots(ink, INK);
  const n = STILL ? 3 : Math.floor(T * 4) % 4, dots = [];
  for (let k = 0; k < n; k++) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dots.push([left + 3 + k * 4 + dx, top + 3 + dy]);
  drawDots(dots, INK);
}

/* ---------- one scene per slide ---------- */
const AGENT = [-2.05, -1.0], HEAD = [-2.05, -1.0, 2.9], ON_DESK = [0, 0, 1.05];
const agentDesk = () => desk(-1.2, -.6, 2.4, 1.2);
const seated = busy => ({ armR: busy ? .7 : .45, armL: busy ? .65 : .4, lean: busy ? .22 : .05 });
const IN_TOP = { arquivos: 1.5, banco: 2.4, cnpj: 3.2 };
// a case passing through the agent: it arrives, he reads it, the answer leaves, the answer lands
const BUILD_CYCLE = 5, buildStep = s => s < 1.4 ? 0 : s < 2.6 ? 1 : s < 3.8 ? 2 : 3;
const USE_CYCLE = 3.6, useStep = s => s < 1.3 ? 0 : s < 2.2 ? 1 : s < 3.5 ? 2 : 3;
const READ_AT = 1.3, ANSWER_AT = 2.6; // the single delivery on "O que é um agente"
const crateSpot = k => [-2.3 + (k % 4) * 1.25, -2.4 + Math.floor(k / 4) * 1.25];
const colSpot = r => [-2 + r * 1.3, 2.4 - r * 1.3];
const COL_MAX = 6; // height of a column that got all 12 cases right
function bestRound() {
  let best = -1, bestScore = -1;
  for (let r = 0; r < UI.round; r++) {
    const score = 12 - ROUNDS[r].wrong.length;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}
const USE_FROM = { tela: [-.4, 4.0, 1.7], agenda: [-3.6, -3.6, 2.9], api: [3.45, -1.15, 1.8] };
const USE_MARK = { tela: [-.4, 4.0, 2.4], agenda: [-3.6, -3.6, 4.4], api: [3.45, -1.15, 2.6] };
const postSpot = w => { const u = -7 + (w - 1) * 1.25, v = 1.2; return [(u + v) / R2 - .27, (v - u) / R2 - .27]; };
const POST_MAX = 8; // height of a week that scored 100%
const LIMIT_Z = LIMIT / 100 * POST_MAX;
const limitAt = u => [(u + 1.2) / R2, (1.2 - u) / R2, LIMIT_Z];
const STOPS = [0, 1, 2, 3, 4].map(k => {
  const a = -Math.PI / 2 + k * Math.PI * 2 / 5, u = Math.cos(a) * 5.6, v = Math.sin(a) * 5;
  return [(u + v) / R2, (v - u) / R2];
});
const INNER = STOPS.map(([x, y]) => [x * .55, y * .55]);
const STOP_TOP = [1.5, 1.7, 2.6, 2.4, 2.9];
const WALK = 3, STAY = 1.8;

function trail(a, b, marked) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .03);
  for (let k = 0; k <= n; k++) {
    if (Math.floor(k * .03 / .3) % 2) continue; // dashes
    const p = project(lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n), 0), ix = p.sx | 0, iy = p.sy | 0, i = iy * W + ix;
    if (ix < 0 || iy < 0 || ix >= W || iy >= H || !ground[i] || marked[i]) continue;
    marked[i] = 1;
    tint(i, .8, .78, .86);
  }
}
const deliveryAge = () => UI.deliverAt < 0 ? -1 : since(UI.deliverAt);

const SCENES = {
  inicio: {
    bake() {
      agentDesk();
      papers(-.9, -.45, .95, 6, 1);
      papers(.35, -.25, .95, 3, 9);
      rack(-4.6, 2.2);
      building(2.4, -5.2);
      crate(2.4, 2.2, 0, GOLD); crate(3.5, 2.5, 0, GOLD); crate(2.7, 2.4, .7, GOLD);
      growTree(-7.6, -6.2, .9, 380);
    },
    draw() {
      auditor(...AGENT, Math.PI / 4, seated(false));
      rackLights(-4.6, 2.2, false);
    },
  },

  agente: {
    bake() {
      agentDesk();
      desk(-.6, 3.6, 1.2, 1.2);
      papers(-.4, 3.75, .95, 7, 3);
      for (const x of [2.5, 3.78]) solid(x, -.8, 0, x + .12, -.68, .95, WOOD_DARK, 2);
      growTree(-7.4, -5.6, .85, 360);
    },
    draw() {
      const s = deliveryAge();
      auditor(...AGENT, Math.PI / 4, seated(s >= READ_AT && s < ANSWER_AT));
      if (s >= 0) {
        const p = mix([-.1, 4.1, 1.5], [-.3, -.4, .97], ease(clamp(s / READ_AT, 0, 1)), 1.4);
        box(p[0], p[1], p[2], p[0] + .55, p[1] + .7, p[2] + .05, SHEET);
        shade(p[0], p[1], p[2], p[0] + .55, p[1] + .7, p[2] + .05);
      }
      const face = s < ANSWER_AT ? SHEET : UI.delivered === 'claras' ? BOARD_OK : BOARD_BAD;
      solid(2.4, -.82, .95, 4.0, -.7, 2.05, face, 1);
    },
    overlay() {
      const s = deliveryAge();
      if (s >= READ_AT && s < ANSWER_AT) thinking(...HEAD);
      if (s >= ANSWER_AT) markAt(3.2, -.7, 2.35, UI.delivered === 'claras');
      else if (s < 0) arrowAt(-.05, 4.2, 1.6);
    },
  },

  montar: {
    bake() { agentDesk(); growTree(6.8, -7.2, .8, 340); },
    draw() {
      const n = Math.floor(T / BUILD_CYCLE), s = STILL ? 2 : T % BUILD_CYCLE, step = buildStep(s);
      auditor(...AGENT, Math.PI / 4, seated(step === 1));
      if (UI.input === 'arquivos') { desk(-.6, 3.6, 1.2, 1.2); papers(-.4, 3.75, .95, 6, 3); }
      else if (UI.input === 'banco') { rack(-.45, 3.75); rackLights(-.45, 3.75, step === 0); }
      else building(-.75, 3.55);
      if (UI.app === 'sm') lamp(3.0, -1.4, step < 3 ? LAMP_IDLE : n % 2 ? LAMP_GREEN : LAMP_RED);
      else bins(2.2, -2.9);
      if (STILL) return;
      const src = [0, 4.2, IN_TOP[UI.input]];
      const dst = UI.app === 'sm' ? [3.0, -1.4, 2.4] : [2.65 + (n % 3) * 1.1, -2.45, .5];
      if (step === 0) packet(src, ON_DESK, ease(s / 1.4), 1.2);
      else if (step === 1) packet(ON_DESK, ON_DESK, 0, 0);
      else if (step === 2) packet(ON_DESK, dst, ease((s - 2.6) / 1.2), 1.4);
      else if (UI.app === 'cl') packet(dst, dst, 0, 0);
    },
    overlay() { if (buildStep(STILL ? 2 : T % BUILD_CYCLE) === 1) thinking(...HEAD); },
  },

  gabarito: {
    bake() {
      desk(-4.9, -4.4, 1.6, 1.0);
      papers(-4.6, -4.3, .95, 4, 5);
      growTree(6.6, -7.4, .85, 360);
    },
    draw() {
      auditor(-3.4, -2.9, Math.PI / 4, { armR: .9, armL: .2 });
      for (let k = 0; k < 12; k++) {
        const [x, y] = crateSpot(k), s = k === UI.toggled ? since(UI.toggledAt) : 9;
        crate(x, y, s < .35 ? Math.sin(Math.PI * s / .35) * .5 : 0, UI.gold.has(k) ? GOLD : KRAFT);
      }
    },
    overlay() {
      if (UI.toggled < 0 || since(UI.toggledAt) > 1.6) return;
      const [x, y] = crateSpot(UI.toggled);
      arrowAt(x + .45, y + .45, .8);
    },
  },

  otimizar: {
    bake() {
      for (let r = 0; r < ROUNDS.length; r++) { const [x, y] = colSpot(r); box(x, y, 0, x + .9, y + .9, .05, TILE); }
      crate(-4.9, 3.9, 0, GOLD); crate(-3.9, 4.4, 0, GOLD); crate(-4.6, 4.1, .7, GOLD);
      growTree(-7.2, -6.4, .85, 360);
    },
    draw() {
      auditor(-5.2, 2.6, -.45, { armR: .5, armL: .2 });
      const best = bestRound();
      for (let r = 0; r < UI.round; r++) {
        const [x, y] = colSpot(r), s = r === UI.round - 1 ? since(UI.roundAt) : 9;
        const h = (12 - ROUNDS[r].wrong.length) / 12 * COL_MAX * ease(clamp(s / .8, 0, 1));
        if (h > .02) solid(x, y, 0, x + .9, y + .9, h, r === best ? GOLD : BLUE, r);
      }
    },
    overlay() {
      const a = colSpot(0), b = colSpot(ROUNDS.length - 1);
      dottedLine([a[0] - .4, a[1] + 1.3, COL_MAX], [b[0] + .8, b[1] + .1, COL_MAX], SIGNAL);
    },
  },

  usar: {
    bake() {
      agentDesk();
      kiosk(-1.0, 3.4);
      solid(-3.9, -3.9, 0, -3.3, -3.3, 2.7, STONE, 4);
      rack(3.0, -1.6);
      growTree(6.6, -7.2, .8, 340);
    },
    draw() {
      const s = STILL ? 1.5 : (T - UI.useAt) % USE_CYCLE, step = useStep(s);
      auditor(...AGENT, Math.PI / 4, seated(step === 1));
      screenGlow(-1.0, 3.4, UI.use === 'tela');
      rackLights(3.0, -1.6, UI.use === 'api');
      if (STILL) return;
      const from = USE_FROM[UI.use];
      if (step === 0) packet(from, ON_DESK, ease(s / 1.3), 1);
      else if (step === 2) packet(ON_DESK, from, ease((s - 2.2) / 1.3), 1, LAMP_GREEN);
    },
    overlay() {
      const s = STILL ? 1.5 : (T - UI.useAt) % USE_CYCLE;
      clockFace(-3.6, -3.6, 3.45, STILL ? 0 : s / USE_CYCLE * Math.PI * 2);
      if (useStep(s) === 1) thinking(...HEAD);
      arrowAt(...USE_MARK[UI.use]);
    },
  },

  acompanhar: {
    bake() {
      for (let w = 1; w <= 12; w++) { const [x, y] = postSpot(w); box(x, y, 0, x + .55, y + .55, .05, TILE); }
      growTree(-6.8, -7.0, .85, 360);
    },
    draw() {
      auditor(-3.89, 7.2, -Math.PI / 4, { armR: .9, armL: .1 });
      for (let w = 1; w <= UI.week; w++) {
        const [x, y] = postSpot(w), s = w === UI.week ? since(UI.weekAt) : 9;
        const score = weekScore(w), h = score / 100 * POST_MAX * ease(clamp(s / .5, 0, 1));
        if (h > .02) solid(x, y, 0, x + .55, y + .55, h, score < LIMIT ? RED : GREEN, w);
      }
      const low = weekScore(UI.week) < LIMIT, blink = STILL || Math.floor(T * 3) % 2;
      lamp(7.07, -5.66, low ? (blink ? LAMP_RED : LAMP_IDLE) : LAMP_GREEN);
    },
    overlay() {
      dottedLine(limitAt(-8.8), limitAt(7.6), SIGNAL);
      const [x, y] = postSpot(UI.week);
      arrowAt(x + .27, y + .27, weekScore(UI.week) / 100 * POST_MAX + .4);
    },
  },

  ciclo: {
    bake() {
      const marked = new Uint8Array(W * H);
      INNER.forEach((p, k) => trail(p, INNER[(k + 1) % 5], marked));
      const [c0, c1, c2, c3, c4] = STOPS;
      desk(c0[0] - .6, c0[1] - .5, 1.2, 1.0); papers(c0[0] - .3, c0[1] - .4, .95, 4, 2);
      crate(c1[0] - .45, c1[1] - .45, 0, GOLD); crate(c1[0] - .4, c1[1] - .4, .7, GOLD, .8, .6);
      [1, 1.6, 2.3].forEach((h, j) => {
        const x = c2[0] + (j - 1) * .45 - .2, y = c2[1] - (j - 1) * .45 - .2;
        solid(x, y, 0, x + .4, y + .4, h, j === 2 ? GOLD : BLUE, j);
      });
      kiosk(c3[0] - .6, c3[1] - .6);
      [.9, .7, 1.1].forEach((h, j) => {
        const x = c4[0] + (j - 1) * .4 - .55, y = c4[1] - (j - 1) * .4 - .15;
        solid(x, y, 0, x + .3, y + .3, h, j === 1 ? RED : GREEN, j);
      });
      lamp(c4[0] + .45, c4[1] + .2, LAMP_GREEN);
    },
    draw() {
      screenGlow(STOPS[3][0] - .6, STOPS[3][1] - .6, true);
      const n = STILL ? 0 : Math.floor(T / (WALK + STAY)), s = STILL ? 0 : T % (WALK + STAY);
      const k = n % 5, next = (k + 1) % 5, a = INNER[k], b = INNER[next];
      if (s < STAY) {
        UI.cycleStop = k;
        auditor(a[0], a[1], Math.atan2(STOPS[k][1] - a[1], STOPS[k][0] - a[0]), { armR: .7, armL: .1 });
        return;
      }
      UI.cycleStop = next;
      const f = ease((s - STAY) / WALK), swing = Math.sin(T * 8);
      auditor(lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0]),
        { stance: .2 * swing, armR: .45 * swing, armL: -.45 * swing, lean: .08 });
    },
    overlay() {
      if (!STILL && T % (WALK + STAY) >= STAY) return;
      const [x, y] = STOPS[UI.cycleStop];
      arrowAt(x, y, STOP_TOP[UI.cycleStop]);
    },
  },
};
