import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const createRoom = mutation({
  args: {
    hostId: v.string(),
    hostName: v.string(),
    settings: v.object({
      draftType: v.union(v.literal("auction"), v.literal("pack")),
      teamSize: v.number(),
      maxPlayers: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Generate unique code
    let code = generateRoomCode();
    let isUnique = false;
    while (!isUnique) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) {
        isUnique = true;
      } else {
        code = generateRoomCode();
      }
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.hostId,
      status: "waiting",
      settings: args.settings,
      players: [
        {
          id: args.hostId,
          name: args.hostName,
          isReady: false,
          isHost: true,
        },
      ],
    });

    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "waiting") {
      throw new Error("Room is already in progress");
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error("Room is full");
    }

    const isAlreadyJoined = room.players.some((p) => p.id === args.playerId);
    if (isAlreadyJoined) {
      return { roomId: room._id, code: room.code };
    }

    const newPlayers = [
      ...room.players,
      {
        id: args.playerId,
        name: args.playerName,
        isReady: false,
        isHost: false,
      },
    ];

    await ctx.db.patch(room._id, { players: newPlayers });

    return { roomId: room._id, code: room.code };
  },
});

export const toggleReady = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) throw new Error("Room not found");

    const newPlayers = room.players.map((p) => {
      if (p.id === args.playerId) {
        return { ...p, isReady: !p.isReady };
      }
      return p;
    });

    await ctx.db.patch(room._id, { players: newPlayers });
  },
});

export const startDraft = mutation({
  args: {
    code: v.string(),
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) throw new Error("Room not found");
    if (room.hostId !== args.hostId) throw new Error("Only the host can start the draft");

    const allReady = room.players.every((p) => p.isReady);
    if (!allReady && room.players.length > 1) { // allow solo start for testing
      throw new Error("Not all players are ready");
    }

    await ctx.db.patch(room._id, { status: "drafting" });
  },
});

export const getRoom = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
  },
});
