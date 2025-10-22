import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  nodes: defineTable({
    x: v.float64(),
    y: v.float64(),
    width: v.float64(),
    height: v.float64(),
    text: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("not ready"),
      v.literal("can start"),
      v.literal("in progress"),
      v.literal("complete")
    )),
    connectors: v.optional(
      v.array(
        v.object({
          id: v.string(),
          type: v.optional(v.union(v.literal("input"), v.literal("output"))),
          side: v.union(
            v.literal("top"),
            v.literal("right"),
            v.literal("bottom"),
            v.literal("left")
          ),
          position: v.float64(), // 0-100 representing position along the side
        })
      )
    ),
  }),

  edges: defineTable({
    source: v.id("nodes"),
    target: v.id("nodes"),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
  })
    .index("by_source", ["source"])
    .index("by_target", ["target"]),

  cursors: defineTable({
    sessionId: v.string(),
    x: v.float64(),
    y: v.float64(),
    userName: v.string(),
    color: v.string(),
    lastUpdated: v.float64(), // timestamp
  }).index("by_session", ["sessionId"]),

  presence: defineTable({
    sessionId: v.string(),
    userName: v.string(),
    lastUpdated: v.float64(), // timestamp
  }).index("by_session", ["sessionId"]),
});
