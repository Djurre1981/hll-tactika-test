/**
 * Extract wheeled-vehicle theoretical top speeds from FModel JSON exports.
 *
 * Input: folder of HLL blueprint JSON (…/Blueprints/Vehicles or …/Wheeled).
 * Output: public/data/vehicles.json
 *
 * Method: PhysX drivetrain limit
 *   maxSpeedKmh = MaxRPM / (topGearRatio * FinalRatio) * wheelRadius(m) * 3.6
 * Inheritance: child BPs inherit EngineSetup / gears / wheels from parent BP JSON
 * when those fields are omitted in the export.
 *
 * Usage:
 *   npm run extract:vehicles -- --input "C:/path/to/Exports/HLL/Content/Blueprints/Vehicles"
 *   npm run extract:vehicles -- --input ".../Vehicles/Wheeled"
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "data", "vehicles.json");

/** UE4 PhysXVehicles default ForwardGears when BP omits them (UE 4.25-era defaults). */
const UE_DEFAULT_FORWARD_GEARS = [4.0, 2.5, 1.5, 1.0];

/** Routeplanner default until multi-vehicle (#27). */
const DEFAULT_TRANSPORT_SOURCE = "BP_Ford_Base_Transport";

function parseArgs(argv) {
  const args = { input: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" || argv[i] === "-i") {
      args.input = argv[++i];
    }
  }
  return args;
}

function walkJsonFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function classNameFromObjectName(objectName) {
  if (!objectName) return null;
  const m = String(objectName).match(/'([^']+)_C'/);
  return m ? m[1] : null;
}

function slugifyBlueprint(name) {
  return String(name)
    .replace(/^BP_/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/--+/g, "-")
    .toLowerCase();
}

function inferRole(name, display) {
  const hay = `${name} ${display || ""}`.toLowerCase();
  if (/\btransport\b/.test(hay)) return "transport";
  if (/\bsupply\b/.test(hay)) return "supply";
  if (/\bjeep\b|kubelwagen|gaz-?67|gaz67|willys/.test(hay)) return "jeep";
  if (/half-?track|halftrack|sdkfz\s*251|\bm3\b/.test(hay)) return "halftrack";
  if (/puma|greyhound|daimler|ba-?10/.test(hay)) return "armored-car";
  if (/truck|blitz|bedford|ford|gmc|zis|deuce|oyd|cckw|60l/.test(hay)) return "truck";
  return "wheeled";
}

function torquePeak(engine) {
  const keys = engine?.TorqueCurve?.EditorCurveData?.Keys;
  if (!Array.isArray(keys) || keys.length === 0) return null;
  let best = keys[0];
  for (const k of keys) {
    if ((k.Value ?? 0) > (best.Value ?? 0)) best = k;
  }
  return { rpm: best.Time, nm: best.Value };
}

function theoreticalMaxKmh(maxRpm, topGearRatio, finalRatio, radiusCm) {
  if (![maxRpm, topGearRatio, finalRatio, radiusCm].every((x) => typeof x === "number" && x > 0)) {
    return null;
  }
  const omegaE = (maxRpm * 2 * Math.PI) / 60;
  const omegaW = omegaE / (topGearRatio * finalRatio);
  const vMs = omegaW * (radiusCm / 100);
  return Math.round(vMs * 3.6 * 100) / 100;
}

function extractMovement(arr) {
  return (arr || []).find((o) => o?.Type === "WheeledVehicleMovementComponent4W") || null;
}

function readJeepBarrierHalfWidthCm(file) {
  const arr = loadJson(file);
  if (!Array.isArray(arr)) return null;
  for (const o of arr) {
    if (o?.Type !== "BoxComponent" || o?.Name !== "JeepBarrier") continue;
    const y = o?.Properties?.BoxExtent?.Y;
    if (typeof y === "number" && y > 0) return y;
  }
  return null;
}

function readBlueprintRecord(file, rel) {
  const arr = loadJson(file);
  if (!Array.isArray(arr)) return null;
  const bpg = arr.find((o) => o.Type === "BlueprintGeneratedClass");
  const cdo = arr.find((o) => typeof o.Name === "string" && o.Name.startsWith("Default__"));
  const mv = extractMovement(arr);
  if (!mv) return null;

  const display =
    cdo?.Properties?.ArmourMetaData?.DisplayName?.SourceString ||
    cdo?.Properties?.ArmourMetaData?.DisplayName?.LocalizedString ||
    null;
  const name = path.basename(file, ".json");
  const parent =
    classNameFromObjectName(bpg?.Super?.ObjectName) ||
    classNameFromObjectName(bpg?.SuperStruct?.ObjectName);

  const props = mv.Properties || {};
  const eng = props.EngineSetup || {};
  const trans = props.TransmissionSetup || {};
  const gears = (trans.ForwardGears || []).map((g) => g.Ratio).filter((n) => typeof n === "number");
  const wheelClass = classNameFromObjectName(props.WheelSetups?.[0]?.WheelClass?.ObjectName);
  const peak = torquePeak(eng);

  return {
    name,
    rel: rel.replace(/\\/g, "/"),
    display,
    parent,
    maxRpm: typeof eng.MaxRPM === "number" ? eng.MaxRPM : null,
    moi: typeof eng.MOI === "number" ? eng.MOI : null,
    peakTorqueNm: peak?.nm ?? null,
    finalRatio: typeof trans.FinalRatio === "number" ? trans.FinalRatio : null,
    gears: gears.length ? gears : null,
    mass: typeof props.Mass === "number" ? props.Mass : null,
    wheelClass,
    bodyHalfWidthCm: readJeepBarrierHalfWidthCm(file),
    ownEngine: Boolean(eng.MaxRPM != null || eng.TorqueCurve?.EditorCurveData?.Keys?.length),
  };
}

function readWheelRadiusCm(file) {
  const arr = loadJson(file);
  if (!Array.isArray(arr)) return null;
  const cdo = arr.find((o) => typeof o.Name === "string" && o.Name.startsWith("Default__"));
  const r = cdo?.Properties?.ShapeRadius;
  return typeof r === "number" ? r : null;
}

function resolveChain(rec, byName, field, depth = 0) {
  if (!rec || depth > 10) return { value: null, from: null };
  const v = rec[field];
  const empty = Array.isArray(v) && v.length === 0;
  if (v != null && v !== "" && !empty) return { value: v, from: rec.name };
  if (!rec.parent || !byName.has(rec.parent)) return { value: null, from: null };
  return resolveChain(byName.get(rec.parent), byName, field, depth + 1);
}

function main() {
  const { input } = parseArgs(process.argv.slice(2));
  if (!input) {
    console.error(`Missing --input path to FModel Vehicles (or Wheeled) export folder.

Example:
  npm run extract:vehicles -- --input "C:/Users/.../Exports/HLL/Content/Blueprints/Vehicles"`);
    process.exit(1);
  }

  const inputRoot = path.resolve(input);
  if (!fs.existsSync(inputRoot)) {
    console.error(`Input not found: ${inputRoot}`);
    process.exit(1);
  }

  const files = walkJsonFiles(inputRoot);
  const byName = new Map();
  const wheelRadiusByName = new Map();

  for (const file of files) {
    const base = path.basename(file, ".json");
    const rel = path.relative(inputRoot, file);
    if (/Wheel/i.test(base) && !/Movement/i.test(base)) {
      const radius = readWheelRadiusCm(file);
      if (radius != null) wheelRadiusByName.set(base, radius);
    }
    const rec = readBlueprintRecord(file, rel);
    if (rec) byName.set(rec.name, rec);
  }

  const vehicles = {};
  let skippedNoSpeed = 0;

  for (const rec of byName.values()) {
    // Skip pure wreck / audio helpers if they somehow got a movement comp with no usable identity
    if (/Wreck|AudioController/i.test(rec.name)) continue;

    const maxRpm = resolveChain(rec, byName, "maxRpm");
    const finalRatio = resolveChain(rec, byName, "finalRatio");
    const gearsResolved = resolveChain(rec, byName, "gears");
    const mass = resolveChain(rec, byName, "mass");
    const peakTorqueNm = resolveChain(rec, byName, "peakTorqueNm");
    const wheelClass = resolveChain(rec, byName, "wheelClass");
    const bodyHalfWidthCm = resolveChain(rec, byName, "bodyHalfWidthCm");

    let gears = gearsResolved.value;
    let gearsAssumedDefault = false;
    if (!gears || !gears.length) {
      if (finalRatio.value != null && maxRpm.value != null) {
        gears = UE_DEFAULT_FORWARD_GEARS;
        gearsAssumedDefault = true;
      } else {
        skippedNoSpeed += 1;
        continue;
      }
    }

    const topGearRatio = Math.min(...gears.map(Number));
    const radiusCm = wheelClass.value ? wheelRadiusByName.get(wheelClass.value) ?? null : null;
    if (radiusCm == null) {
      skippedNoSpeed += 1;
      continue;
    }

    const maxSpeedKmh = theoreticalMaxKmh(
      maxRpm.value,
      topGearRatio,
      finalRatio.value,
      radiusCm
    );
    if (maxSpeedKmh == null) {
      skippedNoSpeed += 1;
      continue;
    }

    const id = slugifyBlueprint(rec.name);
    const role = inferRole(rec.name, rec.display);
    vehicles[id] = {
      id,
      blueprint: rec.name,
      label: rec.display || rec.name,
      role,
      maxSpeedKmh,
      placeholder: false,
      derived: true,
      massKg: mass.value,
      maxRpm: maxRpm.value,
      finalRatio: finalRatio.value,
      topGearRatio,
      gears,
      gearsAssumedDefault: gearsAssumedDefault || undefined,
      peakTorqueNm: peakTorqueNm.value,
      wheelRadiusCm: radiusCm,
      bodyHalfWidthCm: bodyHalfWidthCm.value ?? undefined,
      bodyHalfWidthSource: bodyHalfWidthCm.from ?? undefined,
      wheelBlueprint: wheelClass.value,
      parentBlueprint: rec.parent || undefined,
      sourceFile: rec.rel,
    };
  }

  // Canonical routeplanner entry (#26 / MVP transport)
  const fordTransport = Object.values(vehicles).find(
    (v) => v.blueprint === DEFAULT_TRANSPORT_SOURCE
  );
  if (!fordTransport) {
    console.error(
      `Could not find ${DEFAULT_TRANSPORT_SOURCE} in export — needed for default transport-truck.`
    );
    process.exit(1);
  }

  vehicles["transport-truck"] = {
    id: "transport-truck",
    label: "Transport Truck",
    role: "transport",
    maxSpeedKmh: fordTransport.maxSpeedKmh,
    placeholder: false,
    derived: true,
    derivedFrom: fordTransport.blueprint,
    note: "Routeplanner default; uses Ford F60L Transport theoretical top speed until multi-vehicle (#27).",
    massKg: fordTransport.massKg,
    maxRpm: fordTransport.maxRpm,
    finalRatio: fordTransport.finalRatio,
    topGearRatio: fordTransport.topGearRatio,
    gears: fordTransport.gears,
    peakTorqueNm: fordTransport.peakTorqueNm,
    wheelRadiusCm: fordTransport.wheelRadiusCm,
    bodyHalfWidthCm: fordTransport.bodyHalfWidthCm,
    bodyHalfWidthSource: fordTransport.bodyHalfWidthSource,
    bodyWidthMethod:
      "JeepBarrier BoxExtent.Y (UE cm) — half of PhysX vehicle footprint width for route clearance",
  };

  // Avoid committing machine-specific absolute paths.
  const inputLabel = path.basename(inputRoot);

  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    method:
      "theoreticalMaxKmh = MaxRPM / (topGearRatio * FinalRatio) * wheelRadius_m * 3.6 (PhysX drivetrain limit); bodyHalfWidthCm from JeepBarrier BoxExtent.Y",
    inputLabel,
    defaultVehicleId: "transport-truck",
    counts: {
      wheeledWithSpeed: Object.keys(vehicles).length,
      skippedIncomplete: skippedNoSpeed,
    },
    vehicles,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  const bodyOut = path.join(ROOT, "src", "features", "routeplanner", "path", "vehicle-body.js");
  const halfWidth = fordTransport.bodyHalfWidthCm ?? 108.54575;
  const bodySource = fordTransport.bodyHalfWidthSource ?? fordTransport.blueprint ?? "BP_Ford_Base";
  fs.writeFileSync(
    bodyOut,
    `/**
 * Transport truck body half-width for route clearance (UE centimeters).
 * Updated by \`npm run extract:vehicles\` from JeepBarrier BoxExtent.Y.
 */
export const TRANSPORT_TRUCK_BODY_HALF_WIDTH_CM = ${halfWidth};
export const TRANSPORT_TRUCK_BODY_HALF_WIDTH_SOURCE = "${bodySource}";
`,
    "utf8"
  );
  console.log(`Wrote ${bodyOut} (half-width ${halfWidth} cm)`);

  const transports = Object.values(vehicles)
    .filter((v) => v.role === "transport" && v.id !== "transport-truck")
    .sort((a, b) => a.maxSpeedKmh - b.maxSpeedKmh);

  console.log(`Wrote ${OUT}`);
  console.log(
    `Vehicles: ${catalog.counts.wheeledWithSpeed} (skipped incomplete: ${skippedNoSpeed})`
  );
  console.log(`Default transport-truck: ${fordTransport.maxSpeedKmh} km/h ← ${fordTransport.blueprint}`);
  console.log("Transport trucks:");
  for (const t of transports) {
    console.log(`  ${String(t.maxSpeedKmh).padStart(5)} km/h  ${t.blueprint}  (${t.label})`);
  }
}

main();
