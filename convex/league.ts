import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { createLeagueSession, simulateNextRound as runSimNextRound, simulateRemainingRounds as runSimRemainingRounds } from "../lib/league-engine";

export const initLeague = mutation({
  args: {
    roomId: v.id("rooms"),
    teams: v.array(v.any()), // array of LeagueTeam
  },
  handler: async (ctx, args) => {
    // Check if league already exists
    const existing = await ctx.db
      .query("leagues")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (existing) {
      return existing._id;
    }

    const state = createLeagueSession(args.teams);

    const leagueId = await ctx.db.insert("leagues", {
      roomId: args.roomId,
      state: state,
    });
    
    return leagueId;
  },
});

export const getLeague = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leagues")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
  },
});

export const simulateNextRound = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== args.hostId) throw new Error("Only host can simulate");

    const league = await ctx.db
      .query("leagues")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!league || !league.state) throw new Error("League not found");

    const newState = runSimNextRound(league.state);
    await ctx.db.patch(league._id, { state: newState });
  },
});

export const simulateRemainingRounds = mutation({
  args: {
    roomId: v.id("rooms"),
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== args.hostId) throw new Error("Only host can simulate");

    const league = await ctx.db
      .query("leagues")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!league || !league.state) throw new Error("League not found");

    const newState = runSimRemainingRounds(league.state);
    await ctx.db.patch(league._id, { state: newState });
  },
});
