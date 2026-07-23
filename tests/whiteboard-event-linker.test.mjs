import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findLinkedEventIdForWhiteboard } from "../src/features/micro-prep/event-whiteboard-sync.js";

describe("Whiteboard event linker — findLinkedEventIdForWhiteboard", () => {
  it("finds the event that lists this whiteboard id", () => {
    const id = findLinkedEventIdForWhiteboard(
      [
        { id: "e1", components: { whiteboardIds: ["w-other"] } },
        { id: "e2", components: { whiteboardIds: ["w1", "w2"] } },
      ],
      "w1"
    );
    assert.equal(id, "e2");
  });
});
