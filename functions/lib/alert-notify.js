/** Discord webhook helpers for admin alert-test only (no KV signal state). */

function withWaitParam(webhookUrl) {
  try {
    const url = new URL(webhookUrl);
    if (!url.searchParams.has("wait")) {
      url.searchParams.set("wait", "true");
    }
    return url.toString();
  } catch {
    return webhookUrl;
  }
}

/**
 * @returns {Promise<{ ok: boolean, status: number | null, body: string, error?: string, urlHost?: string }>}
 */
export async function postDiscordAlert(webhookUrl, content) {
  let urlHost = null;
  try {
    urlHost = new URL(webhookUrl).host;
  } catch {
    return {
      ok: false,
      status: null,
      body: "",
      error: "Invalid webhook URL (check ALERT_DISCORD_WEBHOOK_URL quoting)",
      urlHost: null,
    };
  }

  try {
    let response = await fetch(withWaitParam(webhookUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "HLL-Tactika-Alerts/1.0",
      },
      body: JSON.stringify({ content }),
    });
    let body = await response.text().catch(() => "");

    if (!response.ok && (response.status === 400 || response.status === 405)) {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "HLL-Tactika-Alerts/1.0",
        },
        body: JSON.stringify({ content }),
      });
      body = await response.text().catch(() => "");
    }

    if (!response.ok) {
      console.error(`Discord alert failed (${response.status}): ${body.slice(0, 300)}`);
      return { ok: false, status: response.status, body: body.slice(0, 500), urlHost };
    }
    console.error(`Discord alert sent host=${urlHost} status=${response.status}`);
    return { ok: true, status: response.status, body: body.slice(0, 500), urlHost };
  } catch (error) {
    console.error("Discord alert failed", error);
    return {
      ok: false,
      status: null,
      body: "",
      error: error?.message || String(error),
      urlHost,
    };
  }
}

/**
 * @returns {Promise<{ ok: boolean, sent: number, failed: number, results: object[] }>}
 */
export async function postDiscordAlerts(webhookUrls, content) {
  const urls = Array.isArray(webhookUrls) ? webhookUrls.filter(Boolean) : [];
  if (!urls.length) {
    return { ok: false, sent: 0, failed: 0, results: [] };
  }

  const results = await Promise.all(urls.map((url) => postDiscordAlert(url, content)));
  const sent = results.filter((result) => result.ok).length;
  const failed = results.length - sent;
  return {
    ok: sent > 0,
    sent,
    failed,
    results,
  };
}

export function describeWebhookUrl(webhookUrl) {
  if (!webhookUrl) {
    return { webhookConfigured: false, webhookHost: null, webhookPathPrefix: null, webhookCount: 0 };
  }
  try {
    const url = new URL(webhookUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const prefix =
      parts.length >= 3 ? `/${parts.slice(0, 3).join("/")}/…` : url.pathname;
    return {
      webhookConfigured: true,
      webhookHost: url.host,
      webhookPathPrefix: prefix,
      webhookCount: 1,
    };
  } catch {
    return { webhookConfigured: true, webhookHost: null, webhookPathPrefix: null, webhookCount: 1 };
  }
}

export function describeWebhookUrls(webhookUrls) {
  const urls = Array.isArray(webhookUrls) ? webhookUrls.filter(Boolean) : [];
  if (!urls.length) {
    return { webhookConfigured: false, webhookHost: null, webhookPathPrefix: null, webhookCount: 0 };
  }
  const first = describeWebhookUrl(urls[0]);
  return {
    ...first,
    webhookConfigured: true,
    webhookCount: urls.length,
  };
}
