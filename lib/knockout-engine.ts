import { simulateMatchV3, type MatchResult } from "./match-engine-v3";
import type { LeagueTeam } from "./league-engine";

export type KnockoutMatch = {
  id: string;
  homeTeamId: number | null; // null if TBD
  awayTeamId: number | null;
  result?: MatchResult;
  nextMatchId?: string;
  isBye?: boolean;
};

export type KnockoutRound = {
  name: string;
  matches: KnockoutMatch[];
  completed: boolean;
};

export type KnockoutState = {
  teams: LeagueTeam[];
  rounds: KnockoutRound[];
  currentRoundIndex: number;
  completed: boolean;
  championId?: number;
};

function getNextPowerOf2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getRoundName(numMatches: number): string {
  if (numMatches === 1) return "Final";
  if (numMatches === 2) return "Semifinals";
  if (numMatches === 4) return "Quarterfinals";
  if (numMatches === 8) return "Round of 16";
  return `Round of ${numMatches * 2}`;
}

export function createKnockoutSession(teams: LeagueTeam[]): KnockoutState {
  const teamIds = teams.map(t => t.id).sort(() => Math.random() - 0.5); // shuffle
  const n = teamIds.length;
  const p2 = getNextPowerOf2(n);
  const byes = p2 - n;
  
  const firstRoundMatches = p2 / 2;
  const rounds: KnockoutRound[] = [];

  let currentRoundMatches: KnockoutMatch[] = [];
  let matchCounter = 1;

  // Build the first round
  let teamIdx = 0;
  for (let i = 0; i < firstRoundMatches; i++) {
    const homeTeamId = teamIds[teamIdx++];
    let awayTeamId: number | null = null;
    let isBye = false;

    if (byes > i) { // distribute byes to the first matches
      isBye = true;
    } else {
      awayTeamId = teamIds[teamIdx++];
    }

    currentRoundMatches.push({
      id: `m${matchCounter++}`,
      homeTeamId,
      awayTeamId,
      isBye
    });
  }

  rounds.push({
    name: getRoundName(firstRoundMatches),
    matches: currentRoundMatches,
    completed: false
  });

  // Build subsequent rounds up to the final
  let prevRoundMatches = currentRoundMatches;
  while (prevRoundMatches.length > 1) {
    const nextRoundMatches: KnockoutMatch[] = [];
    for (let i = 0; i < prevRoundMatches.length; i += 2) {
      const match1 = prevRoundMatches[i];
      const match2 = prevRoundMatches[i + 1];
      const newMatchId = `m${matchCounter++}`;
      
      match1.nextMatchId = newMatchId;
      match2.nextMatchId = newMatchId;

      nextRoundMatches.push({
        id: newMatchId,
        homeTeamId: null,
        awayTeamId: null,
      });
    }

    rounds.push({
      name: getRoundName(nextRoundMatches.length),
      matches: nextRoundMatches,
      completed: false
    });
    prevRoundMatches = nextRoundMatches;
  }

  // Pre-resolve BYEs
  const firstRound = rounds[0];
  for (const match of firstRound.matches) {
    if (match.isBye && match.homeTeamId !== null && match.nextMatchId) {
      // Auto-advance
      advanceTeamToNextMatch(match.homeTeamId, match.nextMatchId, rounds);
      match.result = {
        homeTeamId: match.homeTeamId,
        awayTeamId: -1,
        homeGoals: 0,
        awayGoals: 0,
        homeXg: 0,
        awayXg: 0,
        events: [],
        playerRatings: [],
        meta: { possession: 50, homeShots: 0, awayShots: 0, homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeBigChances: 0, awayBigChances: 0 },
      };
    }
  }

  // Check if first round is already fully completed by byes
  if (firstRound.matches.every(m => m.isBye || m.result)) {
    firstRound.completed = true;
    let idx = 1;
    // Actually we should only increment if currentRoundIndex needs it, but usually not all are byes unless n=1.
    if (n === 1) { /* Should not happen in normal draft */ }
  }

  return {
    teams,
    rounds,
    currentRoundIndex: firstRound.completed ? 1 : 0,
    completed: false
  };
}

function advanceTeamToNextMatch(teamId: number, nextMatchId: string, rounds: KnockoutRound[]) {
  for (const round of rounds) {
    const nextMatch = round.matches.find(m => m.id === nextMatchId);
    if (nextMatch) {
      if (nextMatch.homeTeamId === null) {
        nextMatch.homeTeamId = teamId;
      } else if (nextMatch.awayTeamId === null) {
        nextMatch.awayTeamId = teamId;
      }
      return;
    }
  }
}

export function simulateKnockoutRound(state: KnockoutState): KnockoutState {
  if (state.completed) return state;

  const newState = JSON.parse(JSON.stringify(state)) as KnockoutState;
  const currentRound = newState.rounds[newState.currentRoundIndex];

  if (!currentRound) return state;

  for (const match of currentRound.matches) {
    if (match.isBye || match.result) continue; // Skip already resolved matches

    if (match.homeTeamId !== null && match.awayTeamId !== null) {
      const homeTeam = newState.teams.find(t => t.id === match.homeTeamId);
      const awayTeam = newState.teams.find(t => t.id === match.awayTeamId);

      if (homeTeam && awayTeam) {
        const result = simulateMatchV3(homeTeam, awayTeam, true);
        match.result = result;

        // Determine winner
        let winnerId = -1;
        if (result.homeGoals > result.awayGoals) winnerId = homeTeam.id;
        else if (result.awayGoals > result.homeGoals) winnerId = awayTeam.id;
        else {
          // Penalties
          const hp = result.homePenalties || 0;
          const ap = result.awayPenalties || 0;
          if (hp > ap) winnerId = homeTeam.id;
          else winnerId = awayTeam.id;
        }

        if (match.nextMatchId) {
          advanceTeamToNextMatch(winnerId, match.nextMatchId, newState.rounds);
        } else {
          // Final match!
          newState.championId = winnerId;
          newState.completed = true;
        }
      }
    }
  }

  currentRound.completed = true;
  if (!newState.completed) {
    newState.currentRoundIndex++;
  }

  return newState;
}
