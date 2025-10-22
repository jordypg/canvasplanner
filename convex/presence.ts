import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const PRESENCE_TIMEOUT_MS = 10000; // 10 seconds

// Query: Get count of active users
export const getActiveCount = query({
  handler: async (ctx: any) => {
    const now = Date.now();
    const allPresence = await ctx.db.query("presence").collect();

    // Filter out stale presence records
    const activeUsers = allPresence.filter(
      (presence: any) => now - presence.lastUpdated < PRESENCE_TIMEOUT_MS
    );

    return activeUsers.length;
  },
});

// Query: Get all active users
export const getAll = query({
  handler: async (ctx: any) => {
    const now = Date.now();
    const allPresence = await ctx.db.query("presence").collect();

    // Filter out stale presence records
    return allPresence.filter(
      (presence: any) => now - presence.lastUpdated < PRESENCE_TIMEOUT_MS
    );
  },
});

// Query: Get presence by session ID
export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("presence")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Mutation: Update presence (heartbeat)
export const updatePresence = mutation({
  args: {
    sessionId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userName: args.userName,
        lastUpdated: now,
      });
    } else {
      await ctx.db.insert("presence", {
        sessionId: args.sessionId,
        userName: args.userName,
        lastUpdated: now,
      });
    }
  },
});

// Mutation: Remove presence for a session
export const remove = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx: any, args: any) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    if (presence) {
      await ctx.db.delete(presence._id);
    }
  },
});

// Mutation: Cleanup stale presence records (can be called periodically)
export const cleanup = mutation({
  handler: async (ctx: any) => {
    const now = Date.now();
    const allPresence = await ctx.db.query("presence").collect();

    for (const presence of allPresence) {
      if (now - presence.lastUpdated > PRESENCE_TIMEOUT_MS) {
        await ctx.db.delete(presence._id);
      }
    }
  },
});
