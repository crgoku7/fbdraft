import rawPlayers from "../public/data/top500.json";

export type PlayerRole = "GK" | "DEF" | "MID" | "ATT";

export type Player = {
  id: number;
  name: string;
  country: string;
  rating: number;
  positions: string[];
  traits: string[];
};

type RawPlayer = {
  id: number;
  "player name": string;
  country: string;
  rating: number;
  positions: string[];
  traits: string[];
};

type IndexedPlayer = Player & {
  searchText: string;
};

const ROLE_BY_POSITION: Record<string, PlayerRole> = {
  GK: "GK",
  GOALKEEPER: "GK",
  GOALKEEPERS: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  DEF: "DEF",
  DEFENDER: "DEF",
  DEFENDERS: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LM: "MID",
  RM: "MID",
  MID: "MID",
  MIDFIELDER: "MID",
  MIDFIELDERS: "MID",
  ST: "ATT",
  CF: "ATT",
  LW: "ATT",
  RW: "ATT",
  ATT: "ATT",
  ATTACKER: "ATT",
  ATTACKERS: "ATT",
  FORWARD: "ATT",
};

const PLAYER_SORT = (left: Player, right: Player) => {
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
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePosition(value: string) {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

function toPlayer(raw: RawPlayer): Player {
  return {
    id: raw.id,
    name: raw["player name"],
    country: raw.country,
    rating: raw.rating,
    positions: raw.positions.map((position) => position.toUpperCase()),
    traits: [...raw.traits],
  };
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    positions: [...player.positions],
    traits: [...player.traits],
  };
}

function getRoleForPosition(position: string): PlayerRole | undefined {
  return ROLE_BY_POSITION[normalizePosition(position)];
}

const normalizedPlayers = ((rawPlayers as RawPlayer[]) ?? [])
  .map(toPlayer)
  .sort(PLAYER_SORT);

const playerById = new Map<number, Player>();
const searchIndex: IndexedPlayer[] = [];
const playersByPosition = new Map<string, Player[]>();

for (const player of normalizedPlayers) {
  playerById.set(player.id, player);

  const searchText = normalizeText([
    player.name,
    player.country,
    ...player.positions,
    ...player.traits,
  ].join(" "));

  searchIndex.push({
    ...player,
    searchText,
  });

  for (const position of player.positions) {
    const key = normalizePosition(position);
    const current = playersByPosition.get(key) ?? [];
    current.push(player);
    playersByPosition.set(key, current);

    const role = getRoleForPosition(position);
    if (role) {
      const roleCurrent = playersByPosition.get(role) ?? [];
      roleCurrent.push(player);
      playersByPosition.set(role, roleCurrent);
    }
  }
}

function clonePlayers(players: Player[]) {
  return players.map(clonePlayer);
}

function dedupePlayers(players: Player[]) {
  const seen = new Set<number>();
  const result: Player[] = [];

  for (const player of players) {
    if (seen.has(player.id)) {
      continue;
    }

    seen.add(player.id);
    result.push(player);
  }

  return result;
}

export function loadPlayers(): Player[] {
  return clonePlayers(normalizedPlayers);
}

export function getPlayerById(id: number): Player | undefined {
  const player = playerById.get(id);
  return player ? clonePlayer(player) : undefined;
}

export function searchPlayers(query: string): Player[] {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return loadPlayers();
  }

  return clonePlayers(
    searchIndex
      .filter((player) => player.searchText.includes(normalizedQuery))
      .map(({ searchText: _searchText, ...player }) => player),
  );
}

export function getPlayersByPosition(position: string): Player[] {
  const normalizedPosition = normalizePosition(position);

  if (!normalizedPosition) {
    return loadPlayers();
  }

  const directMatches = playersByPosition.get(normalizedPosition);
  if (directMatches?.length) {
    return clonePlayers(dedupePlayers(directMatches).sort(PLAYER_SORT));
  }

  const role = ROLE_BY_POSITION[normalizedPosition];
  if (!role) {
    return [];
  }

  const roleMatches = playersByPosition.get(role) ?? [];
  return clonePlayers(dedupePlayers(roleMatches).sort(PLAYER_SORT));
}

export function getPlayersByRating(minRating: number, maxRating = Number.POSITIVE_INFINITY): Player[] {
  const lowerBound = Number.isFinite(minRating) ? minRating : 0;
  const upperBound = Number.isFinite(maxRating) ? maxRating : Number.POSITIVE_INFINITY;

  return clonePlayers(
    normalizedPlayers.filter(
      (player) => player.rating >= lowerBound && player.rating <= upperBound,
    ),
  );
}

export function getPlayerRoles(player: Player): PlayerRole[] {
  const roles = new Set<PlayerRole>();

  for (const position of player.positions) {
    const role = getRoleForPosition(position);
    if (role) {
      roles.add(role);
    }
  }

  return [...roles];
}

export function normalizePlayerSearchText(value: string) {
  return normalizeText(value);
}
