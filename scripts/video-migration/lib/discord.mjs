const DISCORD_API = "https://discord.com/api/v10";

export async function fetchAllChannelMessages(channelId, token) {
  const messages = [];
  let before = null;

  while (true) {
    const url = new URL(`${DISCORD_API}/channels/${channelId}/messages`);
    url.searchParams.set("limit", "100");
    if (before) {
      url.searchParams.set("before", before);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (response.status === 429) {
      const retry = Number(response.headers.get("retry-after") || "1");
      await sleep((retry + 0.25) * 1000);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Discord API ${response.status}: ${body}`);
    }

    const batch = await response.json();
    if (batch.length === 0) {
      break;
    }

    messages.push(...batch);
    before = batch[batch.length - 1].id;
    process.stdout.write(`\rFetched ${messages.length} messages…`);
    await sleep(350);
  }

  process.stdout.write("\n");
  return messages;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
