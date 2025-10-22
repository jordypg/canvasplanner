import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const CURSOR_TIMEOUT_MS = 5000; // 5 seconds

// Query: Get all active cursors (filter out stale ones)
export const getAll = query({
  handler: async (ctx: any) => {
    const now = Date.now();
    const allCursors = await ctx.db.query("cursors").collect();

    // Filter out stale cursors
    return allCursors.filter(
      (cursor: any) => now - cursor.lastUpdated < CURSOR_TIMEOUT_MS
    );
  },
});

// Query: Get cursor by session ID
export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("cursors")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Mutation: Update cursor position (creates if doesn't exist)
export const update = mutation({
  args: {
    sessionId: v.string(),
    x: v.float64(),
    y: v.float64(),
    userName: v.string(),
    color: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("cursors")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        x: args.x,
        y: args.y,
        userName: args.userName,
        color: args.color,
        lastUpdated: now,
      });
    } else {
      await ctx.db.insert("cursors", {
        sessionId: args.sessionId,
        x: args.x,
        y: args.y,
        userName: args.userName,
        color: args.color,
        lastUpdated: now,
      });
    }
  },
});

// Mutation: Remove cursor for a session
export const remove = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx: any, args: any) => {
    const cursor = await ctx.db
      .query("cursors")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    if (cursor) {
      await ctx.db.delete(cursor._id);
    }
  },
});

// Mutation: Cleanup stale cursors (can be called periodically)
export const cleanup = mutation({
  handler: async (ctx: any) => {
    const now = Date.now();
    const allCursors = await ctx.db.query("cursors").collect();

    for (const cursor of allCursors) {
      if (now - cursor.lastUpdated > CURSOR_TIMEOUT_MS) {
        await ctx.db.delete(cursor._id);
      }
    }
  },
});
