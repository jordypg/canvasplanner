import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get all edges (with optional pagination for scalability)
export const getAll = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    // Default to returning all edges (limit: 2000) for real-time collaboration
    // Edges typically outnumber nodes, so we use a higher default limit
    const limit = args.limit || 2000;

    let query = ctx.db.query("edges");

    // Apply pagination cursor if provided
    if (args.cursor) {
      query = query.paginate({ cursor: args.cursor, numItems: limit });
    }

    const results = await query.collect();

    return results;
  },
});

// Query: Get edges connected to a specific node
export const getByNode = query({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("edges")
      .filter((q: any) =>
        q.or(
          q.eq(q.field("source"), args.nodeId),
          q.eq(q.field("target"), args.nodeId)
        )
      )
      .collect();
  },
});

// Mutation: Create a new edge
export const create = mutation({
  args: {
    source: v.id("nodes"),
    target: v.id("nodes"),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    // Validate that source and target nodes exist
    const sourceNode = await ctx.db.get(args.source);
    const targetNode = await ctx.db.get(args.target);

    if (!sourceNode || !targetNode) {
      throw new Error("Source or target node does not exist");
    }

    return await ctx.db.insert("edges", args);
  },
});

// Mutation: Remove an edge
export const remove = mutation({
  args: { id: v.id("edges") },
  handler: async (ctx: any, args: any) => {
    // Check if edge exists before deleting (it might have been cascade deleted)
    const edge = await ctx.db.get(args.id);
    if (edge) {
      await ctx.db.delete(args.id);
    }
  },
});

// Mutation: Remove all edges connected to a node (for cascade deletion)
export const removeByNode = mutation({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx: any, args: any) => {
    const edges = await ctx.db
      .query("edges")
      .filter((q: any) =>
        q.or(
          q.eq(q.field("source"), args.nodeId),
          q.eq(q.field("target"), args.nodeId)
        )
      )
      .collect();

    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }
  },
});
