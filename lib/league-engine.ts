import { simulateMatch, type MatchResult } from "./match-engine";
import type { Player } from "./player-data";

export type AssignedRoster = {
  player: Player;
  slotId: string;
};

export type LeagueTeam = {
  id: number;
  name: string;
  isUser: boolean;
  roster: AssignedRoster[];
  formationId: string;
};

export type TeamStanding = {
  teamId: number;
  name: string;
  isUser: boolean;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type Fixture = {
  homeTeamId: number;
  awayTeamId: number;
  result?: MatchResult;
};

export type LeagueRound = {
  roundNum: number;
  fixtures: Fixture[];
  completed: boolean;
};

export type LeagueState = {
  teams: LeagueTeam[];
  standings: TeamStanding[];
  rounds: LeagueRound[];
  currentRoundIndex: number;
  completed: boolean;
};

function generateRoundRobin(teams: LeagueTeam[]): LeagueRound[] {
  let n = teams.length;
  const teamIds = teams.map(t => t.id);

  if (n % 2 !== 0) {
    teamIds.push(-1); // dummy BYE team
    n++;
  }

  const rounds: LeagueRound[] = [];

  // Circle method
  for (let round = 0; round < n - 1; round++) {
    const fixtures: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teamIds[i];
      const away = teamIds[n - 1 - i];
      
      if (home !== -1 && away !== -1) {
        // Alternate home/away for the fixed team to be fair
        if (i === 0 && round % 2 === 1) {
          fixtures.push({ homeTeamId: away, awayTeamId: home });
        } else {
          fixtures.push({ homeTeamId: home, awayTeamId: away });
        }
      }
    }
    rounds.push({ roundNum: round + 1, fixtures, completed: false });
    
    // Rotate
    const last = teamIds.pop()!;
    teamIds.splice(1, 0, last);
  }

  return rounds;
}

export function createLeagueSession(teams: LeagueTeam[]): LeagueState {
  const standings = teams.map(t => ({
    teamId: t.id,
    name: t.name,
    isUser: t.isUser,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  }));

  const rounds = generateRoundRobin(teams);

  return {
    teams,
    standings,
    rounds,
    currentRoundIndex: 0,
    completed: false,
  };
}

function updateStandings(standings: TeamStanding[], result: MatchResult): TeamStanding[] {
  const newStandings = [...standings];
  const homeIdx = newStandings.findIndex(s => s.teamId === result.homeTeamId);
  const awayIdx = newStandings.findIndex(s => s.teamId === result.awayTeamId);

  const home = { ...newStandings[homeIdx] };
  const away = { ...newStandings[awayIdx] };

  home.played++;
  away.played++;
  home.gf += result.homeGoals;
  home.ga += result.awayGoals;
  away.gf += result.awayGoals;
  away.ga += result.homeGoals;
  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;

  if (result.homeGoals > result.awayGoals) {
    home.wins++;
    home.points += 3;
    away.losses++;
  } else if (result.awayGoals > result.homeGoals) {
    away.wins++;
    away.points += 3;
    home.losses++;
  } else {
    home.draws++;
    away.draws++;
    home.points += 1;
    away.points += 1;
  }

  newStandings[homeIdx] = home;
  newStandings[awayIdx] = away;

  // Sort: Points, then GD, then GF
  newStandings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  return newStandings;
}

export function simulateNextRound(state: LeagueState): LeagueState {
  if (state.completed) return state;

  const round = state.rounds[state.currentRoundIndex];
  const nextRounds = [...state.rounds];
  let nextStandings = [...state.standings];
  
  const updatedFixtures = round.fixtures.map(f => {
    const homeTeam = state.teams.find(t => t.id === f.homeTeamId)!;
    const awayTeam = state.teams.find(t => t.id === f.awayTeamId)!;

    const result = simulateMatch(homeTeam, awayTeam);
    nextStandings = updateStandings(nextStandings, result);

    return { ...f, result };
  });

  nextRounds[state.currentRoundIndex] = {
    ...round,
    fixtures: updatedFixtures,
    completed: true,
  };

  const nextIndex = state.currentRoundIndex + 1;
  const isCompleted = nextIndex >= state.rounds.length;

  return {
    ...state,
    rounds: nextRounds,
    standings: nextStandings,
    currentRoundIndex: isCompleted ? state.currentRoundIndex : nextIndex,
    completed: isCompleted,
  };
}

export function simulateRemainingRounds(state: LeagueState): LeagueState {
  let currentState = state;
  while (!currentState.completed) {
    currentState = simulateNextRound(currentState);
  }
  return currentState;
}
