/**
 * Headless smoke checks for map-kernel icon resolve + layered ping animation.
 * Run: node scripts/verify-strat-render.mjs
 */
import { resolveIconDef } from "../map-kernel/icons/resolve-icon.js";
import {
  STRAT_ICON_IDS,
  objectNeedsAnimation,
  createStratObject,
} from "../map-kernel/object-schema.js";
import { CanvasRenderer } from "../map-kernel/CanvasRenderer.js";
import { applyHandleDrag } from "../map-kernel/selection-handles.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log("OK ", name);
  } catch (error) {
    failed += 1;
    console.error("FAIL", name, error.message);
  }
}

function makeCtx(ops, tag) {
  return {
    save() {
      ops.push(`${tag}:save`);
    },
    restore() {
      ops.push(`${tag}:restore`);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {
      ops.push(`${tag}:fill`);
    },
    stroke() {
      ops.push(`${tag}:stroke`);
    },
    fillRect() {},
    strokeRect() {},
    clearRect() {
      ops.push(`${tag}:clear`);
    },
    arc() {},
    ellipse() {},
    fillText() {},
    setLineDash() {},
    translate() {
      ops.push(`${tag}:translate`);
    },
    scale() {
      ops.push(`${tag}:scale`);
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    lineCap: "",
    lineJoin: "",
  };
}

function makeCanvas(ctx) {
  return {
    width: 512,
    height: 512,
    style: {},
    getContext() {
      return ctx;
    },
  };
}

check("all toolbar icons resolve to real paths", () => {
  for (const iconId of STRAT_ICON_IDS) {
    const def = resolveIconDef({ iconId });
    assert(def?.path, `missing path for ${iconId}`);
    assert(def.name === iconId, `unexpected name for ${iconId}: ${def.name}`);
    assert(def.layers?.length, `missing layers for ${iconId}`);
  }
});

check("binoculars is not a bullseye glyph", () => {
  const def = resolveIconDef({ iconId: "binoculars" });
  assert(def.name === "binoculars", "expected binoculars");
  assert(def.path.includes("M128"), "expected FA binoculars path");
});

check("ssIconId pack lookup wins over iconId", () => {
  const def = resolveIconDef({ iconId: "check", ssIconId: 61925 });
  assert(def.name === "binoculars", `got ${def.name}`);
});

check("ping needs animation, icon does not", () => {
  assert(objectNeedsAnimation({ type: "ping" }));
  assert(!objectNeedsAnimation({ type: "icon" }));
});

check("circle-a uses knockout layers like StratSketch", () => {
  const def = resolveIconDef({ iconId: "circle-a" });
  assert(def.layers?.length === 2, `expected 2 layers, got ${def.layers?.length}`);
  assert(def.layers[0].startsWith("M0 256"), "primary should start with outer circle");
});

check("hll garrison places at Maps Let Loose radius size", () => {
  const obj = createStratObject("hll", {
    points: [{ x: 50, y: 50 }],
    meta: { hllId: "garrison", showRadius: true },
  });
  assert(obj.type === "hll", "expected hll type");
  assert(obj.points.length === 2, "expected bbox points");
  const w = Math.abs(obj.points[1].x - obj.points[0].x);
  assert(w > 18 && w < 22, `garrison width ~19.8%, got ${w}`);
});

check("hll class uses smaller catalog size", () => {
  const obj = createStratObject("hll", {
    points: [{ x: 50, y: 50 }],
    meta: { hllId: "class-rifleman" },
  });
  const w = Math.abs(obj.points[1].x - obj.points[0].x);
  assert(w > 0.5 && w < 1.5, `class width ~0.8%, got ${w}`);
});

check("icon places as 2-point bbox and handle drag stretches", () => {
  const icon = createStratObject("icon", {
    points: [{ x: 50, y: 50 }],
    style: { color: "#fff", size: 6 },
    meta: { iconId: "check" },
  });
  assert(icon.points.length === 2, "expected bbox points");
  const original = structuredClone(icon.points);
  const stretched = applyHandleDrag(icon, "e", { x: original[1].x + 4, y: 50 }, original, null);
  assert(stretched.length === 2, "resize should keep 2 points");
  assert(stretched[1].x > original[1].x, "east handle should widen");
  assert(Math.abs(stretched[0].y - original[0].y) < 0.001, "east handle should not move top");
  assert(Math.abs(stretched[1].y - original[1].y) < 0.001, "east handle should not move bottom");
});

check("CanvasRenderer layers: static once, anim every frame", () => {
  const ops = [];
  const staticCtx = makeCtx(ops, "static");
  const animCtx = makeCtx(ops, "anim");
  const canvas = makeCanvas(staticCtx);
  const animCanvas = makeCanvas(animCtx);

  globalThis.Path2D = class Path2D {
    constructor(d) {
      this.d = d;
    }
  };

  const cbs = [];
  globalThis.requestAnimationFrame = (cb) => {
    cbs.push(cb);
    return cbs.length;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cbs[id - 1] = null;
  };

  // Force every throttled frame to draw (bypass 30fps gate).
  const realNow = performance.now.bind(performance);
  let fakeNow = 1_000_000;
  globalThis.performance = {
    now() {
      fakeNow += 50;
      return fakeNow;
    },
  };

  const ping = createStratObject("ping", {
    points: [{ x: 40, y: 40 }],
    style: { color: "#0ff", size: 6 },
  });
  const icon = createStratObject("icon", {
    points: [{ x: 50, y: 50 }],
    style: { color: "#ff0", size: 8 },
    meta: { iconId: "binoculars" },
  });
  assert(icon.points.length === 2, "icon should expand to a 2-point bbox");
  const scene = [icon, ping];

  const renderer = new CanvasRenderer(canvas, {
    animCanvas,
    getObjects: () => scene,
  });
  renderer.setMapSize(512);
  renderer.stopAnimationLoop();
  if (renderer._raf) {
    cancelAnimationFrame(renderer._raf);
    renderer._raf = 0;
  }
  cbs.length = 0;
  ops.length = 0;

  renderer.requestDraw(scene);
  assert(renderer._animRunning, "animation loop should start when ping exists");

  for (let i = 0; i < 5; i += 1) {
    const pending = cbs.filter(Boolean);
    cbs.length = 0;
    assert(pending.length > 0, `expected pending rAF at frame ${i}`);
    pending.forEach((cb) => cb(fakeNow + 50));
  }

  const staticClears = ops.filter((op) => op === "static:clear").length;
  const animClears = ops.filter((op) => op === "anim:clear").length;
  const staticScales = ops.filter((op) => op === "static:scale").length;
  const animStrokes = ops.filter((op) => op === "anim:stroke").length;

  assert(staticClears === 1, `static should rebuild once, got ${staticClears} clears`);
  assert(animClears >= 5, `expected continuous anim clears, got ${animClears}`);
  assert(staticScales >= 1, `icon Path2D should paint on static, got ${staticScales}`);
  assert(animStrokes >= 5, `ping rings should stroke on anim layer, got ${animStrokes}`);
  assert(!ops.includes("anim:scale"), "icon must not redraw on anim layer");

  renderer.destroy();
  assert(!renderer._animRunning, "destroy should stop animation");

  globalThis.performance = { now: realNow };
});

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll strat render smoke checks passed.");
