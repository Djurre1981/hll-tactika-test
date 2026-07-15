import { StratSketchReader } from "./stratsketch-reader.js";
import { SS_ENTITY, SS_MSG, SS_MAP } from "./stratsketch-constants.js";

function skipUser(reader) {
  reader.readInt32();
  if (reader.readBoolean()) reader.readString();
  reader.readUInt8();
  reader.readBoolean();
  reader.readBoolean();
  reader.readGuid();
  reader.readUInt8();
  reader.readColor();
}

function decodePersistedUser(reader) {
  const hasId = reader.readBoolean();
  const id = hasId ? reader.readString() : null;
  const hasName = reader.readBoolean();
  const name = hasName ? reader.readString() : null;
  const uuid = reader.readGuid();
  const role = reader.readUInt8();
  return { id, name, uuid, role };
}

function skipPersistedUser(reader) {
  decodePersistedUser(reader);
}

function skipViewport(reader) {
  reader.readFloat();
  reader.readFloat();
  reader.readFloat();
}

function decodeMap(reader, mapById) {
  const mapType = reader.readUInt8();
  let mapName = null;
  if (mapType === SS_MAP.Static) {
    const mapId = reader.readUInt16();
    mapName = mapById.get(mapId) || `map-${mapId}`;
    reader.readUInt8();
    reader.readUInt8();
  } else if (mapType === SS_MAP.Custom) {
    reader.readGuid();
    mapName = "custom";
    reader.readUInt8();
  } else {
    throw new Error(`Unknown StratSketch map type: ${mapType}`);
  }
  return mapName;
}

export function decodeInitMessage(reader, mapById) {
  reader.readInt32();
  const briefingName = reader.readNullableString();
  const briefingCode = reader.readString();

  const userCount = reader.readUInt16();
  reader.readInt32();
  for (let i = 0; i < userCount; i += 1) skipUser(reader);

  reader.readUInt8();
  const slideCount = reader.readUInt16();
  const slides = [];
  for (let i = 0; i < slideCount; i += 1) {
    const id = reader.readUInt16();
    const mapName = decodeMap(reader, mapById);
    const name = reader.readString();
    const entityCount = reader.readUInt16();
    const entities = [];
    for (let j = 0; j < entityCount; j += 1) {
      const type = reader.readUInt8();
      const entityId = reader.readUInt16();
      const isDone = reader.readBoolean();
      const position = reader.readVector();
      entities.push(decodeEntity(reader, type, { entityId, isDone, position }));
    }
    slides.push({ id, mapName, name, entities });
  }

  if (reader.readBoolean()) {
    reader.readUInt16();
    reader.readInt32();
    skipViewport(reader);
  }

  const persistedCount = reader.readInt32();
  const persistedUsers = [];
  for (let i = 0; i < persistedCount; i += 1) {
    persistedUsers.push(decodePersistedUser(reader));
  }

  return { briefingName, briefingCode, slides, persistedUsers };
}

export function colorToHex({ r, g, b }) {
  const hex = (value) => value.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function readStrokeSettings(reader) {
  const color = reader.readColor();
  const size = reader.readUInt8();
  const style = reader.readUInt8();
  const end = reader.readUInt8();
  return {
    color: colorToHex(color),
    size: Math.max(1, Math.min(48, size || 3)),
    lineType: ["solid", "dashed", "dotted"][style] || "solid",
    endType: ["none", "start", "end", "both"][end] || "none",
  };
}

function readShapeSettings(reader) {
  const color = reader.readColor();
  const size = reader.readUInt8();
  const style = reader.readUInt8();
  const filled = reader.readBoolean();
  return {
    color: colorToHex(color),
    size: Math.max(1, Math.min(48, size || 3)),
    lineType: ["solid", "dashed", "dotted"][style] || "solid",
    filled,
  };
}

function readTextSettings(reader) {
  const color = reader.readColor();
  const fontSize = reader.readUInt8();
  const textStyle = reader.readUInt8();
  const textAlign = reader.readUInt8();
  return {
    color: colorToHex(color),
    fontSize: Math.max(6, Math.min(48, fontSize || 10)),
    textStyle: textStyle || 0,
    textAlign: ["left", "center", "right"][textAlign] || "center",
  };
}

function readIconSettings(reader) {
  const color = reader.readColor();
  const iconId = reader.readUInt16();
  return { color: colorToHex(color), iconId };
}

export function decodeEntityPayload(reader, entityType) {
  switch (entityType) {
    case SS_ENTITY.Pen: {
      const settings = readStrokeSettings(reader);
      const count = reader.readUInt16();
      const points = [];
      for (let i = 0; i < count; i += 1) points.push(reader.readVector());
      return { kind: "pen", settings, points };
    }
    case SS_ENTITY.Line: {
      const settings = readStrokeSettings(reader);
      const start = reader.readVector();
      const end = reader.readVector();
      reader.readFloat();
      return { kind: "line", settings, start, end };
    }
    case SS_ENTITY.Circle: {
      const settings = readShapeSettings(reader);
      const radius = reader.readFloat();
      return { kind: "circle", settings, radius };
    }
    case SS_ENTITY.Polygon: {
      const settings = readShapeSettings(reader);
      const count = reader.readUInt16();
      const points = [];
      for (let i = 0; i < count; i += 1) points.push(reader.readVector());
      return { kind: "polygon", settings, points };
    }
    case SS_ENTITY.Rectangle: {
      const settings = readShapeSettings(reader);
      const width = reader.readFloat();
      const height = reader.readFloat();
      return { kind: "rectangle", settings, width, height };
    }
    case SS_ENTITY.Text: {
      const settings = readTextSettings(reader);
      const text = reader.readString();
      reader.readFloat();
      return { kind: "text", settings, text };
    }
    case SS_ENTITY.Icon: {
      const settings = readIconSettings(reader);
      const label = reader.readString();
      return { kind: "icon", settings, label };
    }
    case SS_ENTITY.Measure: {
      const settings = readStrokeSettings(reader);
      const start = reader.readVector();
      const end = reader.readVector();
      return { kind: "measure", settings, start, end };
    }
    default:
      return { kind: "unknown", rawType: entityType };
  }
}

export function decodeEntity(reader, entityType, { entityId, isDone, position }) {
  const payload = decodeEntityPayload(reader, entityType);
  return {
    id: entityId,
    isDone,
    position,
    ...payload,
  };
}

export function decodeSlide(reader, mapById) {
  const id = reader.readUInt16();
  const mapName = decodeMap(reader, mapById);
  const name = reader.readString();
  const entityCount = reader.readUInt16();
  const entities = [];
  for (let i = 0; i < entityCount; i += 1) {
    const type = reader.readUInt8();
    const entityId = reader.readUInt16();
    const isDone = reader.readBoolean();
    const position = reader.readVector();
    entities.push(decodeEntity(reader, type, { entityId, isDone, position }));
  }

  return { id, mapName, name, entities };
}

export function decodeDataMessages(buffer, mapById) {
  const reader = new StratSketchReader(buffer);
  const messages = [];
  while (reader.remaining > 0) {
    const type = reader.readUInt8();
    if (type === SS_MSG.Init) {
      const init = decodeInitMessage(reader, mapById);
      messages.push({
        type: "init",
        briefingName: init.briefingName,
        briefingCode: init.briefingCode,
        slides: init.slides,
        persistedUsers: init.persistedUsers,
      });
      for (const slide of init.slides) {
        messages.push({ type: "slide", slide });
      }
      continue;
    }
    if (type === SS_MSG.AddSlide) {
      messages.push({ type: "slide", slide: decodeSlide(reader, mapById) });
      continue;
    }
    if (type === SS_MSG.EntityAdd) {
      const slideId = reader.readUInt16();
      const count = reader.readUInt16();
      const entities = [];
      for (let i = 0; i < count; i += 1) {
        const entityType = reader.readUInt8();
        const entityId = reader.readUInt16();
        const isDone = reader.readBoolean();
        const position = reader.readVector();
        entities.push(decodeEntity(reader, entityType, { entityId, isDone, position }));
      }
      messages.push({ type: "entityAdd", slideId, entities });
      continue;
    }
    break;
  }
  return messages;
}
