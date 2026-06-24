import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submitTeam = mutation({
  args: {
    roomId: v.id("rooms"),
    team: v.object({
      id: v.string(),
      name: v.string(),
      roster: v.array(v.any()),
      formationId: v.string(),
      budget: v.optional(v.number()),
      isUser: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    let league = await ctx.db
      .query("leagues")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!league) {
      league = {
        _id: await ctx.db.insert("leagues", {
          roomId: args.roomId,
          teams: [],
          matches: [],
        }),
        roomId: args.roomId,
        teams: [],
        matches: [],
      } as any;
    }

    // Check if team already submitted
    const teamsList = league!.teams || [];
    const existingIdx = teamsList.findIndex((t: any) => t.id === args.team.id);
    let newTeams = [...teamsList];
    
    if (existingIdx !== -1) {
      newTeams[existingIdx] = args.team;
    } else {
      newTeams.push(args.team);
    }

    await ctx.db.patch(league!._id, { teams: newTeams });
    
    // Check if all players have submitted
    if (newTeams.length >= room.players.length) {
      // All teams submitted, could transition room to "finished" or just let the host start the league
      await ctx.db.patch(args.roomId, { status: "finished" });
    }
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
