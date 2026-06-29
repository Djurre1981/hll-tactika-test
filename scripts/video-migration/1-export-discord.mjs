#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { fetchAllChannelMessages } from "./lib/discord.mjs";
import { requireEnv, appVideoUrl, r2ObjectKey } from "./lib/config.mjs";
import { getPrimaryVideoAttachment, saveManifest } from "./lib/manifest.mjs";

const channelId = requireEnv("DISCORD_CHANNEL_ID");
const token = requireEnv("DISCORD_BOT_TOKEN");

mkdirSync(new URL("./data", import.meta.url), { recursive: true });

console.log(`Exporting messages from channel ${channelId}…`);
const messages = await fetchAllChannelMessages(channelId, token);

const entries = [];
for (const message of messages) {
  const attachment = getPrimaryVideoAttachment(message);
  if (!attachment) {
    continue;
  }

  const messageId = message.id;
  entries.push({
    messageId,
    channelId,
    createdAt: message.created_at,
    content: message.content || "",
    author: message.author?.username || null,
    attachment: {
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.content_type || "video/mp4",
      size: attachment.size || null,
      url: attachment.url,
    },
    r2Key: r2ObjectKey(messageId),
    appVideoUrl: appVideoUrl(messageId),
    localFile: `videos/${messageId}.mp4`,
    status: "exported",
  });
}

entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const manifest = {
  version: 1,
  exportedAt: new Date().toISOString(),
  channelId,
  entryCount: entries.length,
  entries,
};

saveManifest(manifest);
console.log(`Wrote ${entries.length} video entries to data/manifest.json`);
