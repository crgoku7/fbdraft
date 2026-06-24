import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostId: v.string(),
    status: v.union(v.literal("waiting"), v.literal("drafting"), v.literal("finished")),
    settings: v.object({
      draftType: v.union(v.literal("auction"), v.literal("pack")),
      teamSize: v.number(),
      maxPlayers: v.number(),
    }),
    players: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        isReady: v.boolean(),
        isHost: v.boolean(),
      })
    ),
  }).index("by_code", ["code"]),

  auctions: defineTable({
    roomId: v.id("rooms"),
    status: v.union(v.literal("countdown"), v.literal("bidding"), v.literal("sold"), v.literal("completed")),
    timerEnd: v.union(v.number(), v.null()),
    
    currentPlayer: v.union(v.any(), v.null()),
    currentBid: v.number(),
    highestBidderId: v.union(v.string(), v.null()),
    basePrice: v.number(),
    
    availablePlayers: v.array(v.any()),
    sub81Players: v.array(v.any()),
    
    teams: v.array(v.object({
      id: v.string(),
      name: v.string(),
      budget: v.number(),
      roster: v.array(v.any()),
      hasWithdrawnFromCurrent: v.boolean(),
    })),
  }).index("by_room", ["roomId"]),

  leagues: defineTable({
    roomId: v.id("rooms"),
    teams: v.array(v.any()),
    matches: v.array(v.any()),
  }).index("by_room", ["roomId"]),
});
