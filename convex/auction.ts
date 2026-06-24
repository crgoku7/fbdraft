import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function getBasePrice(rating: number): number {
  if (rating < 84) return 50;
  if (rating < 86) return 70;
  if (rating < 89) return 85;
  return 100;
}

function buildBucketedPlayerOrder(players: any[]): any[] {
  const buckets: any[][] = [
    players.filter((p) => p.rating >= 93), // elite
    players.filter((p) => p.rating >= 90 && p.rating < 93),
    players.filter((p) => p.rating >= 88 && p.rating < 90),
    players.filter((p) => p.rating >= 85 && p.rating < 88),
    players.filter((p) => p.rating >= 81 && p.rating < 85),
  ];

  // Shuffle within each bucket
  buckets.forEach((b) => b.sort(() => Math.random() - 0.5));

  const order: any[] = [];
  const weights = [4, 3, 3, 2, 1];

  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (let b = 0; b < buckets.length; b++) {
      const pulls = weights[b];
      for (let p = 0; p < pulls; p++) {
        if (buckets[b].length > 0) {
          order.push(buckets[b].shift()!);
          anyLeft = true;
        }
      }
    }
  }

  return order;
}

function setupNextPlayer(auction: any, teamSize: number): any {
  const allFull = auction.teams.every((t: any) => t.roster.length >= teamSize);

  if (allFull || auction.availablePlayers.length === 0) {
    if (!allFull) {
      // grace period logic
      let nextTeams = [...auction.teams];
      let pool = [...auction.sub81Players];
      for (let i = 0; i < nextTeams.length; i++) {
        const team = nextTeams[i];
        const missing = teamSize - team.roster.length;
        if (missing > 0) {
          const assigned = pool.slice(0, missing);
          pool = pool.slice(missing);
          nextTeams[i] = {
            ...team,
            roster: [...team.roster, ...assigned.map((p: any) => ({ player: p, slotId: null }))]
          };
        }
      }
      return { ...auction, status: "completed", currentPlayer: null, teams: nextTeams, sub81Players: pool };
    }
    return { ...auction, status: "completed", currentPlayer: null };
  }

  const teamsNeedingPlayers = auction.teams.filter((t: any) => t.roster.length < teamSize);
  const maxBudget = Math.max(...teamsNeedingPlayers.map((t: any) => t.budget), 0);

  if (maxBudget < 50) {
    return { ...auction, status: "completed", currentPlayer: null };
  }

  const affordablePlayerIndex = auction.availablePlayers.findIndex((p: any) => getBasePrice(p.rating) <= maxBudget);

  if (affordablePlayerIndex === -1) {
    return { ...auction, status: "completed", currentPlayer: null };
  }

  const nextPlayer = auction.availablePlayers[affordablePlayerIndex];
  const nextAvailable = [...auction.availablePlayers];
  nextAvailable.splice(affordablePlayerIndex, 1);

  // Reset withdrawn status
  const resetTeams = auction.teams.map((t: any) => ({ ...t, hasWithdrawnFromCurrent: false }));

  return {
    ...auction,
    availablePlayers: nextAvailable,
    currentPlayer: nextPlayer,
    currentBid: 0,
    highestBidderId: null,
    basePrice: getBasePrice(nextPlayer.rating),
    status: "countdown",
    timerEnd: Date.now() + 3000,
    teams: resetTeams,
  };
}

export const initAuction = mutation({
  args: {
    roomId: v.id("rooms"),
    players: v.array(v.any()), // Array of Player objects passed from client
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const allPlayers = [...args.players];
    const premiumPlayers = buildBucketedPlayerOrder(allPlayers.filter((p) => p.rating >= 81));
    const sub81Players = allPlayers.filter((p) => p.rating < 81).sort((a, b) => b.rating - a.rating);

    const initialTeams = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      budget: room.settings.draftType === "auction" ? 1000 : 0, // adjust later if needed
      roster: [],
      hasWithdrawnFromCurrent: false,
    }));

    let initialAuction = {
      roomId: room._id,
      status: "countdown" as any,
      timerEnd: Date.now() + 3000,
      currentPlayer: null,
      currentBid: 0,
      highestBidderId: null,
      basePrice: 0,
      availablePlayers: premiumPlayers,
      sub81Players: sub81Players,
      teams: initialTeams,
    };

    initialAuction = setupNextPlayer(initialAuction, room.settings.teamSize);

    const auctionId = await ctx.db.insert("auctions", initialAuction);
    return auctionId;
  },
});

export const getAuction = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auctions")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
  },
});

export const startBidding = mutation({
  args: { auctionId: v.id("auctions") },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) return;
    if (auction.status === "countdown") {
      await ctx.db.patch(args.auctionId, {
        status: "bidding",
        timerEnd: Date.now() + 7000,
      });
    }
  },
});

export const placeBid = mutation({
  args: {
    auctionId: v.id("auctions"),
    teamId: v.string(),
    bidIncrease: v.number(),
  },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction || auction.status !== "bidding") return;

    const team = auction.teams.find((t) => t.id === args.teamId);
    if (!team) return;

    if (auction.highestBidderId === args.teamId) return; // already highest
    if (team.hasWithdrawnFromCurrent) return;

    let newBid = auction.currentBid;
    if (auction.highestBidderId === null || auction.highestBidderId === undefined) {
      newBid = auction.basePrice;
    } else {
      newBid += args.bidIncrease;
    }

    if (newBid > team.budget) return; // cannot afford

    await ctx.db.patch(args.auctionId, {
      currentBid: newBid,
      highestBidderId: args.teamId,
      timerEnd: Date.now() + 7000, // reset timer
    });
  },
});

export const withdraw = mutation({
  args: {
    auctionId: v.id("auctions"),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction || auction.status !== "bidding") return;

    const newTeams = auction.teams.map((t) => {
      if (t.id === args.teamId) return { ...t, hasWithdrawnFromCurrent: true };
      return t;
    });

    await ctx.db.patch(args.auctionId, { teams: newTeams });

    // Check if everyone except one (or all) have withdrawn
    const activeTeams = newTeams.filter((t) => !t.hasWithdrawnFromCurrent);
    if (activeTeams.length <= 1) {
      // Timer drops to 0 instantly if 1 or 0 people are left active
      // Wait, let's just let the client call resolveRound when timer drops, but we can fast forward
      await ctx.db.patch(args.auctionId, { timerEnd: Date.now() });
    }
  },
});

export const resolveRound = mutation({
  args: {
    auctionId: v.id("auctions"),
    teamSize: v.number(),
  },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction || auction.status === "completed" || auction.status === "sold") return;

    // Optional grace period check
    if (auction.timerEnd && Date.now() < auction.timerEnd - 500) {
      // If client called it too early, ignore
      return;
    }

    // Sell!
    if (auction.highestBidderId) {
      const winnerId = auction.highestBidderId;
      const price = auction.currentBid;
      const newTeams = auction.teams.map((t) => {
        if (t.id === winnerId) {
          return {
            ...t,
            budget: t.budget - price,
            roster: [...t.roster, { player: auction.currentPlayer }],
          };
        }
        return t;
      });

      // Temporarily set to sold for the UI to show
      await ctx.db.patch(args.auctionId, {
        status: "sold",
        teams: newTeams,
      });
    } else {
      // Nobody bid
      await ctx.db.patch(args.auctionId, { status: "sold" });
    }
  },
});

export const advanceToNextPlayer = mutation({
  args: {
    auctionId: v.id("auctions"),
    teamSize: v.number(),
  },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction || auction.status !== "sold") return;

    const nextState = setupNextPlayer(auction, args.teamSize);
    await ctx.db.patch(args.auctionId, nextState);
  },
});

export const updateSlot = mutation({
  args: {
    auctionId: v.id("auctions"),
    teamId: v.string(),
    playerId: v.number(),
    slotId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);
    if (!auction) return;

    const nt = [...auction.teams];
    const mi = nt.findIndex((t) => t.id === args.teamId);
    if (mi === -1) return;

    const mr = [...nt[mi].roster];
    const playerIdx = mr.findIndex((r) => r.player.id === args.playerId);
    if (playerIdx === -1) return;

    const occupiedIdx = args.slotId ? mr.findIndex((r) => r.slotId === args.slotId) : -1;
    if (occupiedIdx !== -1) {
      // Swap
      const tempSlot = mr[playerIdx].slotId;
      mr[playerIdx] = { ...mr[playerIdx], slotId: args.slotId };
      mr[occupiedIdx] = { ...mr[occupiedIdx], slotId: tempSlot || null };
    } else {
      mr[playerIdx] = { ...mr[playerIdx], slotId: args.slotId };
    }

    nt[mi] = { ...nt[mi], roster: mr };
    await ctx.db.patch(args.auctionId, { teams: nt });
  },
});
