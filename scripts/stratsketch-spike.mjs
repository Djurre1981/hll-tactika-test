#!/usr/bin/env node
/**
 * Phase 0 spike: fetch and decode a StratSketch briefing without saving.
 * Usage: node scripts/stratsketch-spike.mjs [code-or-url]
 */
import { fetchStratSketchExport } from "../functions/lib/stratsketch-client.js";
import { convertStratSketchBriefing } from "../functions/lib/stratsketch-convert.js";

const input = process.argv[2] || "https://stratsketch.com/DbvCaCJLCrW";

try {
  const exported = await fetchStratSketchExport(input);
  const converted = convertStratSketchBriefing(exported.briefing);

  const summary = {
    metadata: exported.metadata,
    slideCount: exported.briefing.slides.length,
    slides: exported.briefing.slides.map((slide) => ({
      id: slide.id,
      name: slide.name,
      mapName: slide.mapName,
      entityCount: slide.entities.length,
      entityTypes: slide.entities.reduce((acc, entity) => {
        acc[entity.kind] = (acc[entity.kind] || 0) + 1;
        return acc;
      }, {}),
      sample: slide.entities.slice(0, 2).map((entity) => ({
        kind: entity.kind,
        position: entity.position,
        text: entity.text,
        label: entity.label,
      })),
    })),
    converted: {
      title: converted.title,
      slides: converted.slides.map((slide) => ({
        name: slide.name,
        mapId: slide.mapId,
        objectCount: slide.objects.length,
        objectTypes: slide.objects.reduce((acc, object) => {
          acc[object.type] = (acc[object.type] || 0) + 1;
          return acc;
        }, {}),
      })),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error("Spike failed:", error.message);
  process.exit(1);
}
