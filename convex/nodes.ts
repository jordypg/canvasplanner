import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get all nodes (with optional pagination for scalability)
export const getAll = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    // Default to returning all nodes (limit: 1000) for real-time collaboration
    // In the future, can be adjusted for very large canvases
    const limit = args.limit || 1000;

    let query = ctx.db.query("nodes");

    // Apply pagination cursor if provided
    if (args.cursor) {
      query = query.paginate({ cursor: args.cursor, numItems: limit });
    }

    const results = await query.collect();

    return results;
  },
});

// Query: Get a single node by ID
export const getById = query({
  args: { id: v.id("nodes") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation: Create a new node
export const create = mutation({
  args: {
    x: v.float64(),
    y: v.float64(),
    width: v.float64(),
    height: v.float64(),
    text: v.string(),
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
          position: v.float64(),
        })
      )
    ),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("nodes", args);
  },
});

// Mutation: Update node position (called when drag ends)
export const updatePosition = mutation({
  args: {
    id: v.id("nodes"),
    x: v.float64(),
    y: v.float64(),
  },
  handler: async (ctx: any, args: any) => {
    const { id, x, y } = args;
    await ctx.db.patch(id, { x, y });
  },
});

// Mutation: Update node size
export const updateSize = mutation({
  args: {
    id: v.id("nodes"),
    width: v.float64(),
    height: v.float64(),
  },
  handler: async (ctx: any, args: any) => {
    const { id, width, height } = args;
    await ctx.db.patch(id, { width, height });
  },
});

// Mutation: Update node text
export const updateText = mutation({
  args: {
    id: v.id("nodes"),
    text: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const { id, text } = args;
    await ctx.db.patch(id, { text });
  },
});

// Mutation: Update node description
export const updateDescription = mutation({
  args: {
    id: v.id("nodes"),
    description: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const { id, description } = args;
    await ctx.db.patch(id, { description });
  },
});

// Mutation: Update node status
export const updateStatus = mutation({
  args: {
    id: v.id("nodes"),
    status: v.union(
      v.literal("not ready"),
      v.literal("can start"),
      v.literal("in progress"),
      v.literal("complete")
    ),
  },
  handler: async (ctx: any, args: any) => {
    const { id, status } = args;
    await ctx.db.patch(id, { status });
  },
});

// Mutation: Update node time estimate value
export const updateTimeEstimate = mutation({
  args: {
    id: v.id("nodes"),
    timeEstimate: v.optional(v.float64()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, timeEstimate } = args;
    await ctx.db.patch(id, { timeEstimate });
  },
});

// Mutation: Update node time unit
export const updateTimeUnit = mutation({
  args: {
    id: v.id("nodes"),
    timeUnit: v.union(
      v.literal("minutes"),
      v.literal("hours"),
      v.literal("days"),
      v.literal("weeks")
    ),
  },
  handler: async (ctx: any, args: any) => {
    const { id, timeUnit } = args;
    await ctx.db.patch(id, { timeUnit });
  },
});

// Mutation: Update node connectors
export const updateConnectors = mutation({
  args: {
    id: v.id("nodes"),
    connectors: v.array(
      v.object({
        id: v.string(),
        type: v.optional(v.union(v.literal("input"), v.literal("output"))),
        side: v.union(
          v.literal("top"),
          v.literal("right"),
          v.literal("bottom"),
          v.literal("left")
        ),
        position: v.float64(),
      })
    ),
  },
  handler: async (ctx: any, args: any) => {
    const { id, connectors } = args;
    await ctx.db.patch(id, { connectors });
  },
});

// Mutation: Add a single connector to a node
export const addConnector = mutation({
  args: {
    id: v.id("nodes"),
    connector: v.object({
      id: v.string(),
      type: v.optional(v.union(v.literal("input"), v.literal("output"))),
      side: v.union(
        v.literal("top"),
        v.literal("right"),
        v.literal("bottom"),
        v.literal("left")
      ),
      position: v.float64(),
    }),
  },
  handler: async (ctx: any, args: any) => {
    const { id, connector } = args;
    const node = await ctx.db.get(id);
    if (!node) throw new Error("Node not found");

    const currentConnectors = node.connectors || [];
    await ctx.db.patch(id, { connectors: [...currentConnectors, connector] });

    return connector.id;
  },
});

// Mutation: Remove a node (and cascade delete connected edges)
export const remove = mutation({
  args: { id: v.id("nodes") },
  handler: async (ctx: any, args: any) => {
    // First, delete all edges connected to this node
    const connectedEdges = await ctx.db
      .query("edges")
      .filter((q: any) =>
        q.or(
          q.eq(q.field("source"), args.id),
          q.eq(q.field("target"), args.id)
        )
      )
      .collect();

    for (const edge of connectedEdges) {
      await ctx.db.delete(edge._id);
    }

    // Then delete the node itself
    await ctx.db.delete(args.id);
  },
});
