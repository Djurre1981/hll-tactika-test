/**
 * Carve home + tool HTML shells from scripts/mpa-source-index.html
 * Run: node scripts/gen-mpa-html.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(root, "scripts/mpa-source-index.html");
const src = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
const bodyStart = src.indexOf("<body>");
if (bodyStart < 0) throw new Error("Missing <body>");
const body = src.slice(bodyStart);

const META = `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HLL-Tactika</title>
  <meta name="description" content="Tactika is The Circle's strategy platform for hell let loose. The project is developed by the community and kept strictly exclusive to its competitive team." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://hll-tactika.pages.dev/" />
  <meta property="og:title" content="HLL-Tactika" />
  <meta property="og:description" content="Tactika is The Circle's strategy platform for hell let loose. The project is developed by the community and kept strictly exclusive to its competitive team." />
  <meta property="og:image" content="https://hll-tactika.pages.dev/assets/logos/pixellogo.png" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="HLL-Tactika" />
  <meta name="twitter:description" content="Tactika is The Circle's strategy platform for hell let loose. The project is developed by the community and kept strictly exclusive to its competitive team." />
  <meta name="twitter:image" content="https://hll-tactika.pages.dev/assets/logos/pixellogo.png" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
`;

function cssLinks(hrefs) {
  return hrefs.map((href) => `  <link rel="stylesheet" href="${href}" />`).join("\n") + "\n";
}

const HOME_CSS = cssLinks([
  "/css/base.css",
  "/css/layout.css",
  "/css/utilities.css",
  "/css/fonts/texta.css",
  "/css/components/glass.css",
  "/css/components/auth-gate.css",
  "/css/components/welcome-page.css",
  "/css/components/bye-page.css",
  "/css/components/mode-switch.css",
  "/css/components/dashboard.css",
  "/css/components/user-menu.css",
]);

const MAP_CHROME_CSS = [
  "/css/base.css",
  "/css/layout.css",
  "/css/utilities.css",
  "/css/fonts/texta.css",
  "/css/components/glass.css",
  "/css/components/auth-gate.css",
  "/css/components/mode-switch.css",
  "/css/components/user-menu.css",
  "/css/components/map-viewer.css",
  "/css/components/map-overlays.css",
  "/css/components/sidebar.css",
  "/css/components/filter-bar.css",
  "/css/components/pin-marker.css",
  "/css/components/pin-preview.css",
  "/css/components/pin-modal.css",
  "/css/components/pin-editor.css",
  "/css/components/context-menu.css",
  "/css/components/mg-spot-arrows.css",
  "/css/components/admin-panel.css",
  "/css/editor/editor.css",
];

const CLIMB_CSS = cssLinks(MAP_CHROME_CSS);
const STRAT_CSS = cssLinks([...MAP_CHROME_CSS, "/css/components/strats-panel.css"]);

function sliceTo(startMarker, nextMarker) {
  const start = body.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start: ${startMarker}`);
  const end = body.indexOf(nextMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing next after ${startMarker}: ${nextMarker}`);
  return body.slice(start, end).trimEnd();
}

function sliceInclusive(startMarker, endMarker) {
  const start = body.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start: ${startMarker}`);
  const end = body.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end: ${endMarker}`);
  return body.slice(start, end + endMarker.length);
}

const welcome = sliceTo(
  '<div class="welcome-page" id="welcome-page">',
  '\n\n  <div class="bye-page'
);
const bye = sliceTo(
  '<div class="bye-page is-hidden" id="bye-page">',
  '\n\n  <dialog class="auth-gate"'
);
const authGate = sliceInclusive(
  '<dialog class="auth-gate" id="auth-gate">',
  "</dialog>"
);
const hubChrome = sliceTo(
  '<div id="hub-chrome" class="hub-chrome hidden">',
  '\n\n  <div class="user-cluster'
);
const userCluster = sliceTo(
  '<div class="user-cluster hidden" id="user-cluster">',
  '\n\n  <div id="dashboard-page'
);
const dashboard = sliceTo(
  '<div id="dashboard-page" class="dashboard-page hidden"',
  '\n\n  <div id="app-root'
);
const appRootFull = sliceTo(
  '<div id="app-root" class="hidden is-auth-pending">',
  '\n\n  <dialog class="strats-open-dialog strats-confirm-dialog"'
);

const stratsSidebarStart = appRootFull.indexOf('<div id="strats-sidebar"');
const stratsSidebarEnd = appRootFull.indexOf(
  '<div class="sidebar__section sidebar__section--edit hidden" id="edit-panel">'
);
if (stratsSidebarStart < 0 || stratsSidebarEnd < 0) {
  throw new Error("Could not locate strats-sidebar bounds");
}
const appRootNoStratsSidebar =
  appRootFull.slice(0, stratsSidebarStart) + appRootFull.slice(stratsSidebarEnd);

/** Empty img src so Vite does not fingerprint multi‑MB map tiles from HTML. */
function externalizeMapImage(html) {
  return html
    .replace(/(<img\s+[^>]*id="map-image"[^>]*\ssrc=")[^"]+(")/, "$1$2")
    .replace(
      /if \(localStorage\.getItem\("hll-tactika-authed"\) !== "1"\) return;\s*var mapImage = localStorage\.getItem\("hll-tactika-selected-map-image"\);\s*if \(!mapImage\) \{\s*var mapId = localStorage\.getItem\("hll-tactika-selected-map"\) \|\| "SMDMV2";\s*mapImage = "maps\/no-grid\/" \+ mapId \+ "_NoGrid\.webp";\s*\}\s*document\.getElementById\("map-image"\)\.src = mapImage;/,
      `var mapImage = localStorage.getItem("hll-tactika-selected-map-image");
                if (!mapImage) {
                  var mapId = localStorage.getItem("hll-tactika-selected-map") || "SMDMV2";
                  mapImage = "/maps/no-grid/" + mapId + "_NoGrid.webp";
                }
                if (mapImage.charAt(0) !== "/") mapImage = "/" + mapImage;
                document.getElementById("map-image").src = mapImage;`
    );
}

const appRootClimb = externalizeMapImage(
  appRootNoStratsSidebar
    .replace(
      /\s*<svg\s+class="strats-draw-layer hidden"[\s\S]*?<\/svg>\s*<svg\s+class="strats-draw-layer strats-draw-layer--preview[\s\S]*?<\/svg>\s*<svg\s+class="strats-draw-layer strats-draw-layer--handles[\s\S]*?<\/svg>/,
      "\n"
    )
    .replace(
      /\s*<div class="strats-slides-shell hidden" id="strats-slides-shell">[\s\S]*?<\/div>\s*<\/main>/,
      "\n  </main>"
    )
);

const appRootStrat = externalizeMapImage(appRootFull);

const stratsDialogs = sliceTo(
  '<dialog class="strats-open-dialog strats-confirm-dialog"',
  '\n\n  <dialog class="admin-panel"'
);
const adminPanel = sliceInclusive(
  '<dialog class="admin-panel" id="admin-panel">',
  "</dialog>"
);
const videoModal = sliceInclusive(
  '<dialog class="video-modal" id="video-modal"',
  "</dialog>"
);

const homeBoot = `  <script>
    (function () {
      try {
        var authed = localStorage.getItem("hll-tactika-authed") === "1";
        if (!authed) {
          var params = new URLSearchParams(window.location.search);
          var isForbidden = params.get("auth") === "forbidden";
          var videoPreload = document.createElement("link");
          videoPreload.rel = "preload";
          videoPreload.as = "video";
          videoPreload.href = isForbidden
            ? "/assets/welcome/bye.mp4"
            : "/assets/welcome/welcome.mp4";
          videoPreload.type = "video/mp4";
          document.head.appendChild(videoPreload);
          document.documentElement.classList.remove("dashboard-boot");
          document.documentElement.classList.add("welcome-boot");
          return;
        }
        document.documentElement.classList.remove("welcome-boot");
        document.documentElement.classList.add("dashboard-boot");
      } catch (_) {}
    })();
  </script>
  <style>
    html.welcome-boot #dashboard-page,
    html.welcome-boot #hub-chrome,
    html.welcome-boot #user-cluster,
    html.welcome-boot #bye-page { display: none !important; }
    html.bye-boot #welcome-page,
    html.bye-boot #dashboard-page,
    html.bye-boot #hub-chrome,
    html.bye-boot #user-cluster { display: none !important; }
    html.dashboard-boot #welcome-page,
    html.dashboard-boot #bye-page { display: none !important; }
  </style>
`;

const toolBoot = `  <script>
    (function () {
      try {
        if (localStorage.getItem("hll-tactika-authed") !== "1") return;
        var mapImage = localStorage.getItem("hll-tactika-selected-map-image");
        if (!mapImage) {
          var mapId = localStorage.getItem("hll-tactika-selected-map") || "SMDMV2";
          mapImage = "/maps/no-grid/" + mapId + "_NoGrid.webp";
        }
        if (mapImage.charAt(0) !== "/") mapImage = "/" + mapImage;
        var preload = document.createElement("link");
        preload.rel = "preload";
        preload.as = "image";
        preload.href = mapImage;
        document.head.appendChild(preload);
      } catch (_) {}
    })();
  </script>
  <style>
    #app-root.is-auth-pending .sidebar-shell,
    #app-root.is-auth-pending .map-toolbar-shell {
      display: none !important;
    }
  </style>
`;

function writePage(relPath, htmlClass, styles, boot, body, entry) {
  const out = `<!DOCTYPE html>
<html lang="en" class="${htmlClass}">
<head>
${META}${styles}${boot}</head>
<body>
${body}

  <script type="module" src="${entry}"></script>
</body>
</html>
`;
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, out);
  console.log("wrote", relPath, `(${out.length} bytes)`);
}

writePage(
  "home/index.html",
  "welcome-boot",
  HOME_CSS,
  homeBoot,
  [welcome, bye, authGate, hubChrome, userCluster, dashboard].join("\n\n  "),
  "/js/entries/home.js"
);

writePage(
  "tool/climbing-guide/index.html",
  "app-boot",
  CLIMB_CSS,
  toolBoot,
  [authGate, userCluster, appRootClimb, adminPanel, videoModal].join("\n\n  "),
  "/js/entries/climbing-guide.js"
);

writePage(
  "tool/stratmaker/index.html",
  "app-boot",
  STRAT_CSS,
  toolBoot,
  [authGate, userCluster, appRootStrat, stratsDialogs, adminPanel, videoModal].join(
    "\n\n  "
  ),
  "/js/entries/stratmaker.js"
);

fs.writeFileSync(
  path.join(root, "index.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=/home" />
  <script>location.replace("/home" + location.search + location.hash);</script>
  <title>HLL-Tactika</title>
</head>
<body>
  <p><a href="/home">Continue to Tactika</a></p>
</body>
</html>
`
);
console.log("rewrote root index.html → /home redirect");
