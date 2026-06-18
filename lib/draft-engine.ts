import { getPlayerRoles, type Player, type PlayerRole } from "./player-data";

export type DraftTeam = {
  id: number;
  name: string;
  isUser: boolean;
  roster: Player[];
};

export type DraftPick = {
  pickNumber: number;
  round: number;
  teamId: number;
  teamName: string;
  player: Player;
  isUser: boolean;
};

export type DraftState = {
  seed: number;
  order: number[];
  currentPickIndex: number;
  round: number;
  teams: DraftTeam[];
  availablePlayers: Player[];
  picks: DraftPick[];
  rosterTarget: Record<PlayerRole, number>;
  rosterSize: number;
  userTeamId: number;
  completed: boolean;
};

export type DraftOptions = {
  teamCount?: number;
  userTeamId?: number;
  seed?: number;
  rosterTarget?: Record<PlayerRole, number>;
};

export type UserPickStrategy = (state: DraftState) => Player | undefined;

export const DEFAULT_ROSTER_TARGET: Record<PlayerRole, number> = {
  GK: 1,
  DEF: 4,
  MID: 3,
  ATT: 3,
};

const ROLE_SCARCITY: Record<PlayerRole, number> = {
  GK: 4,
  DEF: 3,
  MID: 2,
  ATT: 1,
};

const TOTAL_ROSTER_SIZE =
  DEFAULT_ROSTER_TARGET.GK +
  DEFAULT_ROSTER_TARGET.DEF +
  DEFAULT_ROSTER_TARGET.MID +
  DEFAULT_ROSTER_TARGET.ATT;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleIndexes(length: number, seed: number) {
  const rng = createSeededRandom(seed);
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}

function comparePlayers(left: Player, right: Player) {
  if (left.rating !== right.rating) {
    return right.rating - left.rating;
  }

  const nameCompare = left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });

  if (nameCompare !== 0) {
    return nameCompare;
  }

  return left.id - right.id;
}

function createTeams(teamCount: number, userTeamId: number): DraftTeam[] {
  return Array.from({ length: teamCount }, (_, index) => ({
    id: index,
    name: index === userTeamId ? "Team 1" : `Team ${index + 1}`,
    isUser: index === userTeamId,
    roster: [],
  }));
}

function normalizePlayers(players: Player[]) {
  const seen = new Set<number>();
  const uniquePlayers: Player[] = [];

  for (const player of players) {
    if (seen.has(player.id)) {
      continue;
    }

    seen.add(player.id);
    uniquePlayers.push({
      ...player,
      positions: [...player.positions],
      traits: [...player.traits],
    });
  }

  return uniquePlayers.sort(comparePlayers);
}

function getCurrentTeamIndex(state: DraftState) {
  return state.order[state.currentPickIndex % state.order.length];
}

export function getCurrentTeam(state: DraftState) {
  return state.teams[getCurrentTeamIndex(state)];
}

export function getDraftProgress(state: DraftState) {
  return state.picks.length / (state.order.length * state.rosterSize);
}

export function getTeamRoleCoverage(roster: Player[]) {
  const coverage: Record<PlayerRole, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    ATT: 0,
  };

  for (const player of roster) {
    for (const role of getPlayerRoles(player)) {
      coverage[role] += 1;
    }
  }

  return coverage;
}

export function getTeamNeeds(
  roster: Player[],
  target: Record<PlayerRole, number> = DEFAULT_ROSTER_TARGET,
) {
  const coverage = getTeamRoleCoverage(roster);
  return {
    GK: Math.max(target.GK - coverage.GK, 0),
    DEF: Math.max(target.DEF - coverage.DEF, 0),
    MID: Math.max(target.MID - coverage.MID, 0),
    ATT: Math.max(target.ATT - coverage.ATT, 0),
  };
}

function scorePlayerForNeeds(player: Player, needs: Record<PlayerRole, number>) {
  const roles = getPlayerRoles(player);
  const matchedRoles = roles.filter((role) => needs[role] > 0);

  if (!matchedRoles.length) {
    return player.rating * 100 + roles.length;
  }

  const coverageScore = matchedRoles.reduce((total, role) => total + needs[role], 0);
  const scarcityScore = matchedRoles.reduce(
    (total, role) => total + ROLE_SCARCITY[role] * needs[role],
    0,
  );

  return 1_000_000 + coverageScore * 10_000 + scarcityScore * 100 + player.rating * 10 + roles.length;
}

export function chooseRecommendedPlayer(
  availablePlayers: Player[],
  roster: Player[],
  target: Record<PlayerRole, number> = DEFAULT_ROSTER_TARGET,
) {
  const needs = getTeamNeeds(roster, target);
  let bestPlayer: Player | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const player of availablePlayers) {
    const score = scorePlayerForNeeds(player, needs);
    if (score > bestScore) {
      bestScore = score;
      bestPlayer = player;
    }
  }

  return bestPlayer;
}

function pickAvailablePlayer(state: DraftState, player: Player) {
  const teamIndex = getCurrentTeamIndex(state);
  const currentTeam = state.teams[teamIndex];

  if (!currentTeam || currentTeam.roster.length >= state.rosterSize) {
    return state;
  }

  const nextAvailablePlayers = state.availablePlayers.filter(({ id }) => id !== player.id);
  if (nextAvailablePlayers.length === state.availablePlayers.length) {
    return state;
  }

  const nextTeams = state.teams.map((team) =>
    team.id === teamIndex
      ? {
          ...team,
          roster: [...team.roster, player],
        }
      : team,
  );

  const nextPickNumber = state.picks.length + 1;
  const nextCurrentPickIndex = state.currentPickIndex + 1;

  return {
    ...state,
    teams: nextTeams,
    availablePlayers: nextAvailablePlayers,
    picks: [
      ...state.picks,
      {
        pickNumber: nextPickNumber,
        round: Math.floor((nextPickNumber - 1) / state.order.length) + 1,
        teamId: currentTeam.id,
        teamName: currentTeam.name,
        player,
        isUser: currentTeam.isUser,
      },
    ],
    currentPickIndex: nextCurrentPickIndex,
    round: Math.floor(nextCurrentPickIndex / state.order.length) + 1,
    completed:
      nextTeams.every((team) => team.roster.length >= state.rosterSize) ||
      nextAvailablePlayers.length === 0,
  };
}

export function createDraftSession(players: Player[], options: DraftOptions = {}): DraftState {
  const teamCount = options.teamCount ?? 8;
  const userTeamId = options.userTeamId ?? 0;
  const seed = options.seed ?? 1;
  const rosterTarget = options.rosterTarget ?? DEFAULT_ROSTER_TARGET;
  const rosterSize = rosterTarget.GK + rosterTarget.DEF + rosterTarget.MID + rosterTarget.ATT;
  const order = shuffleIndexes(teamCount, seed);

  return {
    seed,
    order,
    currentPickIndex: 0,
    round: 1,
    teams: createTeams(teamCount, userTeamId),
    availablePlayers: normalizePlayers(players),
    picks: [],
    rosterTarget,
    rosterSize,
    userTeamId,
    completed: false,
  };
}

export function startDraftSession(players: Player[], options: DraftOptions = {}) {
  return advanceToHumanTurn(createDraftSession(players, options));
}

export function advanceToHumanTurn(state: DraftState) {
  let nextState = state;

  while (!nextState.completed) {
    const currentTeam = getCurrentTeam(nextState);

    if (currentTeam.isUser) {
      break;
    }

    const recommendedPlayer = chooseRecommendedPlayer(
      nextState.availablePlayers,
      currentTeam.roster,
      nextState.rosterTarget,
    );

    if (!recommendedPlayer) {
      break;
    }

    nextState = pickAvailablePlayer(nextState, recommendedPlayer);
  }

  return nextState;
}

export function draftPlayerForCurrentTurn(state: DraftState, playerId: number) {
  if (state.completed) {
    return state;
  }

  const currentTeam = getCurrentTeam(state);
  if (!currentTeam.isUser) {
    return state;
  }

  const chosenPlayer = state.availablePlayers.find((player) => player.id === playerId);
  if (!chosenPlayer) {
    return state;
  }

  return advanceToHumanTurn(pickAvailablePlayer(state, chosenPlayer));
}

export function simulateDraftToCompletion(
  players: Player[],
  options: DraftOptions = {},
  userStrategy: UserPickStrategy = (state) =>
    chooseRecommendedPlayer(
      state.availablePlayers,
      getCurrentTeam(state)?.roster ?? [],
      state.rosterTarget,
    ),
) {
  let nextState = startDraftSession(players, options);

  while (!nextState.completed) {
    const currentTeam = getCurrentTeam(nextState);

    if (currentTeam.isUser) {
      const chosenPlayer = userStrategy(nextState);
      if (!chosenPlayer) {
        break;
      }

      nextState = draftPlayerForCurrentTurn(nextState, chosenPlayer.id);
      continue;
    }

    nextState = advanceToHumanTurn(nextState);
  }

  return nextState;
}
