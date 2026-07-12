const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const STEAM_FETCH_HEADERS = {
  Accept: "text/xml,application/xml,application/json",
  "User-Agent": "HLL-Tactika/1.0",
};
const PROFILE_CACHE_PREFIX = "steam-profile:";
const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_BATCH_SIZE = 100;

export function getOrigin(request) {
  return new URL(request.url).origin;
}

export function buildSteamLoginUrl(request) {
  const origin = getOrigin(request);
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/api/auth/callback`,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

export async function verifySteamCallback(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("openid.mode");
  if (mode !== "id_res") {
    throw new Error("Invalid OpenID response");
  }

  const body = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("openid.")) {
      body.set(key, value);
    }
  }
  body.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  if (!/is_valid\s*:\s*true/i.test(text)) {
    throw new Error("Steam OpenID verification failed");
  }

  const claimedId = url.searchParams.get("openid.claimed_id") || "";
  const match = claimedId.match(/\/openid\/id\/(\d+)$/);
  if (!match) {
    throw new Error("Could not parse Steam ID");
  }

  return match[1];
}

function readXmlCdata(xml, tag) {
  const cdataMatch = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`));
  if (cdataMatch?.[1]) {
    return cdataMatch[1];
  }

  const textMatch = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return textMatch?.[1] || null;
}

async function getCachedProfile(steamId, env) {
  if (!env?.PINS_KV) {
    return null;
  }

  try {
    const cached = await env.PINS_KV.get(`${PROFILE_CACHE_PREFIX}${steamId}`, "json");
    if (!cached?.name) {
      return null;
    }
    if (Date.now() - (cached.cachedAt || 0) > PROFILE_CACHE_TTL_MS) {
      return null;
    }
    return {
      steamId,
      name: cached.name,
      avatar: cached.avatar || null,
    };
  } catch {
    return null;
  }
}

async function cacheProfile(profile, env) {
  if (!env?.PINS_KV || !profile?.steamId || !profile?.name) {
    return;
  }

  try {
    await env.PINS_KV.put(
      `${PROFILE_CACHE_PREFIX}${profile.steamId}`,
      JSON.stringify({
        name: profile.name,
        avatar: profile.avatar || null,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // Ignore cache write failures.
  }
}

async function fetchSteamProfileFromXml(steamId) {
  try {
    const response = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
      headers: STEAM_FETCH_HEADERS,
    });
    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const name = readXmlCdata(xml, "steamID");
    if (!name) {
      return null;
    }

    return {
      steamId,
      name,
      avatar: readXmlCdata(xml, "avatarFull"),
    };
  } catch {
    return null;
  }
}

async function fetchSteamProfilesFromApi(steamIds, apiKey) {
  const profiles = new Map();
  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");

  try {
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamIds.join(","));
    const response = await fetch(url.toString(), { headers: STEAM_FETCH_HEADERS });
    if (!response.ok) {
      return profiles;
    }

    const data = await response.json();
    for (const player of data?.response?.players || []) {
      if (!player?.steamid || !player?.personaname) {
        continue;
      }
      profiles.set(player.steamid, {
        steamId: player.steamid,
        name: player.personaname,
        avatar: player.avatarfull || null,
      });
    }
  } catch {
    return profiles;
  }

  return profiles;
}

export async function fetchSteamProfile(steamId, env) {
  const profiles = await fetchSteamProfiles([steamId], env);
  return profiles.get(String(steamId)) || { steamId, name: null, avatar: null };
}

export async function cacheSteamProfile(profile, env) {
  return cacheProfile(profile, env);
}

export async function fetchSteamProfiles(steamIds, env) {
  const uniqueIds = [...new Set(steamIds.map((id) => String(id)).filter(Boolean))];
  const profiles = new Map();
  const missing = [];

  for (const steamId of uniqueIds) {
    const cached = await getCachedProfile(steamId, env);
    if (cached?.name) {
      profiles.set(steamId, cached);
    } else {
      missing.push(steamId);
    }
  }

  if (missing.length === 0) {
    return profiles;
  }

  if (env?.STEAM_API_KEY) {
    for (let index = 0; index < missing.length; index += PROFILE_BATCH_SIZE) {
      const batch = missing.slice(index, index + PROFILE_BATCH_SIZE);
      const apiProfiles = await fetchSteamProfilesFromApi(batch, env.STEAM_API_KEY);
      for (const [steamId, profile] of apiProfiles) {
        profiles.set(steamId, profile);
        await cacheProfile(profile, env);
      }
    }
  }

  await Promise.all(
    missing
      .filter((steamId) => !profiles.has(steamId))
      .map(async (steamId) => {
        const xmlProfile = await fetchSteamProfileFromXml(steamId);
        if (xmlProfile?.name) {
          profiles.set(steamId, xmlProfile);
          await cacheProfile(xmlProfile, env);
          return;
        }
        profiles.set(steamId, { steamId, name: null, avatar: null });
      })
  );

  return profiles;
}
