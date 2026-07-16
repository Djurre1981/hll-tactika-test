#!/usr/bin/env node
/**
 * Attach D1 (and keep existing KV/R2) bindings on the hll-tactika-test Pages project.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ACCOUNT_ID = "8a28d1bd00d998a2996108ae20654638";
const PROJECT = "hll-tactika-test";

const PRODUCTION_BINDINGS = {
  kv_namespaces: {
    PINS_KV: { namespace_id: "25a3a121f49e4bc082cfa7d565d0890d" },
  },
  r2_buckets: {
    VIDEOS_R2: { name: "hll-climb-videos" },
  },
  d1_databases: {
    DB: { id: "6d617404-fe7c-4f77-980c-a64fbefde494" },
  },
  compatibility_date: "2024-01-01",
  compatibility_flags: ["nodejs_compat"],
};

const PREVIEW_BINDINGS = {
  kv_namespaces: {
    PINS_KV: { namespace_id: "e5ed67e5071744a290fa94f020905a6c" },
  },
  r2_buckets: {
    VIDEOS_R2: { name: "hll-climb-videos-preview" },
  },
  d1_databases: {
    DB: { id: "101f085d-bbd6-4513-9d21-5d3942df1cc3" },
  },
  compatibility_date: "2024-01-01",
  compatibility_flags: ["nodejs_compat"],
};

function wranglerConfigPath() {
  const base = path.join(os.homedir(), ".wrangler", "config", "default.toml");
  const fallback = path.join(
    process.env.APPDATA || os.homedir(),
    "xdg.config",
    ".wrangler",
    "config",
    "default.toml",
  );
  return fs.existsSync(base) ? base : fallback;
}

function readOAuthToken() {
  const config = fs.readFileSync(wranglerConfigPath(), "utf8");
  const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("No wrangler oauth_token found. Run: npx wrangler login");
  return match[1];
}

async function cf(method, apiPath, body) {
  const token = readOAuthToken();
  const res = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(
      `Cloudflare API ${method} ${apiPath} failed: ${JSON.stringify(data.errors ?? data, null, 2)}`,
    );
  }
  return data.result;
}

const before = await cf("GET", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`);
console.log("Before d1:", Object.keys(before.deployment_configs?.production?.d1_databases ?? {}));

await cf("PATCH", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`, {
  deployment_configs: {
    production: PRODUCTION_BINDINGS,
    preview: PREVIEW_BINDINGS,
  },
});

const after = await cf("GET", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`);
const prodD1 = after.deployment_configs?.production?.d1_databases ?? {};
const previewD1 = after.deployment_configs?.preview?.d1_databases ?? {};
console.log("Production D1:", JSON.stringify(prodD1, null, 2));
console.log("Preview D1:", JSON.stringify(previewD1, null, 2));

if (!prodD1.DB?.id) {
  throw new Error("Production DB binding missing after patch");
}
console.log("\nD1 binding attached to Pages project", PROJECT);
