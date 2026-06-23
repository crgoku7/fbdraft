import type { Player } from "./player-data";
import { FORMATIONS } from "./formation-utils";

export type AuctionTeam = {
  id: number;
  name: string;
  isUser: boolean;
  roster: { player: Player; slotId?: string }[];
  budget: number;
};

export type AuctionConfig = {
  aiCount: number;
  teamSize: number;
  budget: number;
  tournamentType: "LEAGUE" | "KNOCKOUT";
};

export type AuctionState = {
  teams: AuctionTeam[];
  availablePlayers: Player[];
  sub81Players: Player[];

  currentPlayerOnAuction: Player | null;
  currentBid: number;
  highestBidderId: number | null;
  basePrice: number;

  completed: boolean;
  inGracePeriod: boolean;

  config: AuctionConfig;
};

export function getBasePrice(rating: number): number {
  if (rating < 84) return 50;
  if (rating < 86) return 70;
  if (rating < 89) return 85;
  return 100;
}

function createTeams(teamCount: number, userTeamId: number, budget: number): AuctionTeam[] {
  return Array.from({ length: teamCount }, (_, index) => ({
    id: index,
    name: index === userTeamId ? "Team 1" : `Team ${index + 1}`,
    isUser: index === userTeamId,
    roster: [],
    budget,
  }));
}

/**
 * Shuffle a player pool using rating buckets so higher-rated players
 * appear earlier but with realistic randomness.
 * Buckets: 93+ | 90-92 | 88-89 | 85-87 | 81-84
 * We interleave picks from the buckets in a weighted pattern.
 */
function buildBucketedPlayerOrder(players: Player[]): Player[] {
  const buckets: Player[][] = [
    players.filter(p => p.rating >= 93),   // elite
    players.filter(p => p.rating >= 90 && p.rating < 93),
    players.filter(p => p.rating >= 88 && p.rating < 90),
    players.filter(p => p.rating >= 85 && p.rating < 88),
    players.filter(p => p.rating >= 81 && p.rating < 85),
  ];

  // Shuffle within each bucket for freshness
  buckets.forEach(b => b.sort(() => Math.random() - 0.5));

  // Pattern: 2 from top tier, 1 elite, 2 mid, 1 top tier, 3 mid-low…
  // Simplified: round-robin buckets in weighted order
  const order: Player[] = [];
  const weights = [4, 3, 3, 2, 1]; // pulls per round from each bucket
  
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

export function createAuctionSession(players: Player[], config: AuctionConfig, userTeamId = 0): AuctionState {
  const allPlayers = [...players];
  const teamCount = config.aiCount + 1;

  const premiumPlayers = buildBucketedPlayerOrder(allPlayers.filter(p => p.rating >= 81));
  const sub81Players = allPlayers.filter(p => p.rating < 81).sort((a, b) => b.rating - a.rating);

  const state: AuctionState = {
    teams: createTeams(teamCount, userTeamId, config.budget),
    availablePlayers: premiumPlayers,
    sub81Players,

    currentPlayerOnAuction: null,
    currentBid: 0,
    highestBidderId: null,
    basePrice: 0,

    completed: false,
    inGracePeriod: false,
    config,
  };

  return setupNextAuctionPlayer(state);
}

export function setupNextAuctionPlayer(state: AuctionState): AuctionState {
  const allFull = state.teams.every(t => t.roster.length >= state.config.teamSize);

  if (allFull || state.availablePlayers.length === 0) {
    if (!allFull) {
      return runGracePeriod({ ...state, completed: true, inGracePeriod: true, currentPlayerOnAuction: null });
    }
    return { ...state, completed: true, currentPlayerOnAuction: null };
  }

  const teamsNeedingPlayers = state.teams.filter(t => t.roster.length < state.config.teamSize);
  const maxBudget = Math.max(...teamsNeedingPlayers.map(t => t.budget), 0);

  if (maxBudget < 50) {
    return runGracePeriod({ ...state, completed: true, inGracePeriod: true, currentPlayerOnAuction: null });
  }

  const affordablePlayerIndex = state.availablePlayers.findIndex(p => getBasePrice(p.rating) <= maxBudget);

  if (affordablePlayerIndex === -1) {
    return runGracePeriod({ ...state, completed: true, inGracePeriod: true, currentPlayerOnAuction: null });
  }

  const nextPlayer = state.availablePlayers[affordablePlayerIndex];
  const nextAvailable = [...state.availablePlayers];
  nextAvailable.splice(affordablePlayerIndex, 1);

  const basePrice = getBasePrice(nextPlayer.rating);

  return {
    ...state,
    availablePlayers: nextAvailable,
    currentPlayerOnAuction: nextPlayer,
    currentBid: 0,
    highestBidderId: null,
    basePrice,
  };
}

export function placeBid(state: AuctionState, teamId: number, bidIncrease: number): AuctionState {
  if (!state.currentPlayerOnAuction) return state;
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return state;
  if (team.roster.length >= state.config.teamSize) return state;
  if (state.highestBidderId === teamId) return state;

  let newBid = state.currentBid;
  if (state.highestBidderId === null) {
    newBid = state.basePrice;
  } else {
    newBid += bidIncrease;
  }

  if (newBid > team.budget) return state;

  return {
    ...state,
    currentBid: newBid,
    highestBidderId: teamId,
  };
}

export function concludeAuctionForCurrentPlayer(state: AuctionState): AuctionState {
  if (!state.currentPlayerOnAuction) return state;

  if (state.highestBidderId === null) {
    return setupNextAuctionPlayer(state);
  }

  const teamId = state.highestBidderId;
  const price = state.currentBid;

  const nextTeams = state.teams.map(team => {
    if (team.id === teamId) {
      return {
        ...team,
        budget: team.budget - price,
        roster: [...team.roster, { player: state.currentPlayerOnAuction! }],
      };
    }
    return team;
  });

  return setupNextAuctionPlayer({ ...state, teams: nextTeams });
}

// ── Position category helpers ─────────────────────────────────────────────
type PositionCategory = "GK" | "DEF" | "MID" | "ATT";

function getPositionCategory(positions: string[]): PositionCategory {
  if (positions.some(p => p === "GK")) return "GK";
  if (positions.some(p => ["ST", "CF", "LW", "RW"].includes(p))) return "ATT";
  if (positions.some(p => ["CM", "CAM", "CDM", "LM", "RM"].includes(p))) return "MID";
  return "DEF";
}

function countByCategory(roster: AuctionTeam["roster"]): Record<PositionCategory, number> {
  const counts: Record<PositionCategory, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const { player } of roster) {
    counts[getPositionCategory(player.positions)]++;
  }
  return counts;
}

/**
 * Smarter AI bidding:
 * - Never bid on a 2nd GK
 * - Bias toward positions they're short on
 * - Scale valuation by player rating
 * - Avoid outbidding their rational budget
 */
export function getAIBidDecision(state: AuctionState): { teamId: number, bidIncrease: number } | null {
  if (!state.currentPlayerOnAuction || state.completed) return null;

  const player = state.currentPlayerOnAuction;
  const playerCat = getPositionCategory(player.positions);

  const eligibleTeams = state.teams.filter(t =>
    !t.isUser &&
    t.roster.length < state.config.teamSize &&
    t.id !== state.highestBidderId
  );

  // Shuffle for variety
  eligibleTeams.sort(() => Math.random() - 0.5);

  for (const team of eligibleTeams) {
    const counts = countByCategory(team.roster);
    const needs = state.config.teamSize - team.roster.length;
    const avgBudget = team.budget / needs;

    // NEVER buy a second GK
    if (playerCat === "GK" && counts.GK >= 1) continue;

    // Positional need multiplier
    let needMultiplier = 1.0;
    const idealDEF = Math.round(needs * 0.36);
    const idealMID = Math.round(needs * 0.36);
    const idealATT = Math.round(needs * 0.27);

    if (playerCat === "DEF" && counts.DEF < idealDEF) needMultiplier = 1.3;
    if (playerCat === "MID" && counts.MID < idealMID) needMultiplier = 1.3;
    if (playerCat === "ATT" && counts.ATT < idealATT) needMultiplier = 1.3;
    if (playerCat === "GK" && counts.GK === 0) needMultiplier = 1.4; // always want a GK

    // Surplus position → less desire
    if (playerCat === "DEF" && counts.DEF > idealDEF + 1) needMultiplier = 0.6;
    if (playerCat === "ATT" && counts.ATT > idealATT + 1) needMultiplier = 0.6;

    // Rating premium
    const ratingFactor = 0.3 + (player.rating - 80) / 20; // 0.3→1.3 for 80→100 rated

    // Valuation
    let valuation = state.basePrice + (avgBudget * 0.65 * ratingFactor * needMultiplier);

    // Randomise ±20%
    valuation *= (0.8 + Math.random() * 0.4);

    const requiredBid = state.highestBidderId === null ? state.basePrice : state.currentBid + 1;

    if (requiredBid <= valuation && requiredBid <= team.budget) {
      let inc = 1;
      if (state.highestBidderId !== null) {
        const surplus = team.budget - requiredBid;
        if (surplus > 100 && Math.random() > 0.7) inc = 10;
        else if (surplus > 50 && Math.random() > 0.5) inc = 5;
      } else {
        inc = 0; // first bid handled in placeBid
      }
      return { teamId: team.id, bidIncrease: inc };
    }
  }

  return null;
}

export function runGracePeriod(state: AuctionState): AuctionState {
  let nextTeams = [...state.teams];
  let pool = [...state.sub81Players];

  for (let i = 0; i < nextTeams.length; i++) {
    const team = nextTeams[i];
    const missing = state.config.teamSize - team.roster.length;
    if (missing > 0) {
      const assigned = pool.slice(0, missing);
      pool = pool.slice(missing);
      nextTeams[i] = {
        ...team,
        roster: [...team.roster, ...assigned.map(p => ({ player: p }))]
      };
    }
  }

  return {
    ...state,
    teams: nextTeams,
    sub81Players: pool,
    inGracePeriod: true,
    completed: true,
  };
}

export function autoCompleteAuction(state: AuctionState): AuctionState {
  let currentState = state;
  let maxIterations = 200;

  while (maxIterations > 0) {
    const decision = getAIBidDecision(currentState);
    if (decision) {
      currentState = placeBid(currentState, decision.teamId, decision.bidIncrease);
    } else {
      break;
    }
    maxIterations--;
  }

  return concludeAuctionForCurrentPlayer(currentState);
}
