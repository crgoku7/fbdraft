import type { Player } from "./player-data";
import { FORMATIONS } from "./formation-utils";

export type AuctionTeam = {
  id: number;
  name: string;
  isUser: boolean;
  roster: { player: Player; slotId?: string }[];
  budget: number;
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
};

export function getBasePrice(rating: number): number {
  if (rating < 84) return 50;
  if (rating < 86) return 70;
  if (rating < 89) return 85;
  return 100;
}

function createTeams(teamCount: number, userTeamId: number): AuctionTeam[] {
  return Array.from({ length: teamCount }, (_, index) => ({
    id: index,
    name: index === userTeamId ? "Team 1" : `Team ${index + 1}`,
    isUser: index === userTeamId,
    roster: [],
    budget: 1000,
  }));
}

export function createAuctionSession(players: Player[], teamCount = 3, userTeamId = 0): AuctionState {
  // Sort players by rating descending
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);

  // Split into premium (>= 81) and grace (<81)
  const premiumPlayers = sortedPlayers.filter(p => p.rating >= 81);
  const sub81Players = sortedPlayers.filter(p => p.rating < 81);

  const state: AuctionState = {
    teams: createTeams(teamCount, userTeamId),
    availablePlayers: premiumPlayers,
    sub81Players: sub81Players,

    currentPlayerOnAuction: null,
    currentBid: 0,
    highestBidderId: null,
    basePrice: 0,

    completed: false,
    inGracePeriod: false,
  };

  return setupNextAuctionPlayer(state);
}

export function setupNextAuctionPlayer(state: AuctionState): AuctionState {
  // Check if all teams have 11 players
  const allFull = state.teams.every(t => t.roster.length >= 11);

  if (allFull || state.availablePlayers.length === 0) {
    // If not all full, we enter grace period
    if (!allFull) {
      return runGracePeriod({ ...state, completed: true, inGracePeriod: true, currentPlayerOnAuction: null });
    }
    return { ...state, completed: true, currentPlayerOnAuction: null };
  }

  const teamsNeedingPlayers = state.teams.filter(t => t.roster.length < 11);
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
    currentBid: 0, // Starts at 0, first bid is basePrice
    highestBidderId: null,
    basePrice,
  };
}

export function placeBid(state: AuctionState, teamId: number, bidIncrease: number): AuctionState {
  if (!state.currentPlayerOnAuction) return state;
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return state;

  // Cannot bid if team is full
  if (team.roster.length >= 11) return state;

  // Cannot re-bid if already highest bidder
  if (state.highestBidderId === teamId) return state;

  let newBid = state.currentBid;
  if (state.highestBidderId === null) {
    // First bid must be at least base price
    newBid = state.basePrice;
  } else {
    newBid += bidIncrease;
  }

  // Cannot bid more than budget
  if (newBid > team.budget) return state;

  return {
    ...state,
    currentBid: newBid,
    highestBidderId: teamId,
  };
}

export function concludeAuctionForCurrentPlayer(state: AuctionState): AuctionState {
  if (!state.currentPlayerOnAuction) return state;

  // If no one bid, player goes unsold. Move to next player.
  if (state.highestBidderId === null) {
    return setupNextAuctionPlayer(state);
  }

  // Assign player to highest bidder
  const teamId = state.highestBidderId;
  const price = state.currentBid;

  const nextTeams = state.teams.map(team => {
    if (team.id === teamId) {
      // Find empty slot (if they have a formation, we handle it in UI, but here we just add to roster)
      return {
        ...team,
        budget: team.budget - price,
        roster: [...team.roster, { player: state.currentPlayerOnAuction! }],
      };
    }
    return team;
  });

  const nextState = {
    ...state,
    teams: nextTeams,
  };

  return setupNextAuctionPlayer(nextState);
}

// AI Logic
export function getAIBidDecision(state: AuctionState): { teamId: number, bidIncrease: number } | null {
  if (!state.currentPlayerOnAuction || state.completed) return null;

  // Let's find an AI team that wants to bid
  const eligibleTeams = state.teams.filter(t => !t.isUser && t.roster.length < 11 && t.id !== state.highestBidderId);

  // Shuffle for randomness
  eligibleTeams.sort(() => Math.random() - 0.5);

  for (const team of eligibleTeams) {
    // Valuation logic
    const needs = 11 - team.roster.length;
    const avgBudgetPerPlayer = team.budget / needs;

    // Max valuation is heavily dependent on rating and average budget left
    let valuation = state.basePrice + (avgBudgetPerPlayer * 0.8);

    // High rating multiplier
    if (state.currentPlayerOnAuction.rating >= 89) valuation *= 1.5;

    // Introduce randomness (0.8 to 1.2)
    valuation *= (0.8 + Math.random() * 0.4);

    const requiredBid = state.highestBidderId === null ? state.basePrice : state.currentBid + 1;

    if (requiredBid <= valuation && requiredBid <= team.budget) {
      // Decide increment (1, 5, or 10)
      const diff = team.budget - requiredBid;
      let inc = 1;
      if (diff > 50 && Math.random() > 0.5 && state.highestBidderId !== null) inc = 5;
      if (diff > 100 && Math.random() > 0.7 && state.highestBidderId !== null) inc = 10;

      // Safety check
      if (state.highestBidderId === null) inc = 0; // First bid is exactly basePrice logically handled in placeBid

      return { teamId: team.id, bidIncrease: inc };
    }
  }

  return null;
}

export function runGracePeriod(state: AuctionState): AuctionState {
  let nextTeams = [...state.teams];
  let pool = [...state.sub81Players];

  // For every team that has less than 11 players
  for (let i = 0; i < nextTeams.length; i++) {
    const team = nextTeams[i];
    const missing = 11 - team.roster.length;
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
  let hasBids = true;
  let maxIterations = 200; // prevent infinite loops

  while (hasBids && maxIterations > 0) {
    const decision = getAIBidDecision(currentState);
    if (decision) {
      currentState = placeBid(currentState, decision.teamId, decision.bidIncrease);
    } else {
      hasBids = false;
    }
    maxIterations--;
  }

  return concludeAuctionForCurrentPlayer(currentState);
}
