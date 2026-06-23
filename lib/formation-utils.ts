export type FormationSlot = {
  id: string;
  role: string;
  x: number;
  y: number;
};

export type Formation = {
  id: string;
  name: string;
  slots: FormationSlot[];
};

export const FORMATIONS: Formation[] = [
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: [
      { id: "slot-0", role: "GK", x: 50, y: 92 },
      { id: "slot-1", role: "LB", x: 15, y: 75 },
      { id: "slot-2", role: "CB", x: 35, y: 78 },
      { id: "slot-3", role: "CB", x: 65, y: 78 },
      { id: "slot-4", role: "RB", x: 85, y: 75 },
      { id: "slot-5", role: "CM", x: 30, y: 50 },
      { id: "slot-6", role: "CDM", x: 50, y: 60 },
      { id: "slot-7", role: "CM", x: 70, y: 50 },
      { id: "slot-8", role: "LW", x: 20, y: 25 },
      { id: "slot-9", role: "ST", x: 50, y: 15 },
      { id: "slot-10", role: "RW", x: 80, y: 25 },
    ],
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      { id: "slot-0", role: "GK", x: 50, y: 92 },
      { id: "slot-1", role: "LB", x: 15, y: 75 },
      { id: "slot-2", role: "CB", x: 35, y: 78 },
      { id: "slot-3", role: "CB", x: 65, y: 78 },
      { id: "slot-4", role: "RB", x: 85, y: 75 },
      { id: "slot-5", role: "LM", x: 15, y: 45 },
      { id: "slot-6", role: "CM", x: 35, y: 50 },
      { id: "slot-7", role: "CM", x: 65, y: 50 },
      { id: "slot-8", role: "RM", x: 85, y: 45 },
      { id: "slot-9", role: "ST", x: 35, y: 20 },
      { id: "slot-10", role: "ST", x: 65, y: 20 },
    ],
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      { id: "slot-0", role: "GK", x: 50, y: 92 },
      { id: "slot-1", role: "LB", x: 15, y: 75 },
      { id: "slot-2", role: "CB", x: 35, y: 78 },
      { id: "slot-3", role: "CB", x: 65, y: 78 },
      { id: "slot-4", role: "RB", x: 85, y: 75 },
      { id: "slot-5", role: "CDM", x: 35, y: 60 },
      { id: "slot-6", role: "CDM", x: 65, y: 60 },
      { id: "slot-7", role: "CAM", x: 20, y: 35 },
      { id: "slot-8", role: "CAM", x: 50, y: 35 },
      { id: "slot-9", role: "CAM", x: 80, y: 35 },
      { id: "slot-10", role: "ST", x: 50, y: 15 },
    ],
  },
  {
    id: "3-4-3",
    name: "3-4-3",
    slots: [
      { id: "slot-0", role: "GK", x: 50, y: 92 },
      { id: "slot-1", role: "CB", x: 25, y: 78 },
      { id: "slot-2", role: "CB", x: 50, y: 78 },
      { id: "slot-3", role: "CB", x: 75, y: 78 },
      { id: "slot-4", role: "LM", x: 15, y: 50 },
      { id: "slot-5", role: "CM", x: 35, y: 50 },
      { id: "slot-6", role: "CM", x: 65, y: 50 },
      { id: "slot-7", role: "RM", x: 85, y: 50 },
      { id: "slot-8", role: "LW", x: 20, y: 25 },
      { id: "slot-9", role: "ST", x: 50, y: 15 },
      { id: "slot-10", role: "RW", x: 80, y: 25 },
    ],
  },
];

// Adjacency Map for Positions
const ADJACENT_POSITIONS: Record<string, string[]> = {
  ST: ["CF", "LW", "RW"],
  CF: ["ST", "CAM", "LW", "RW"],
  LW: ["LM", "ST", "CF", "LWB"],
  RW: ["RM", "ST", "CF", "RWB"],
  CAM: ["CM", "CF", "LM", "RM"],
  CM: ["CAM", "CDM", "LM", "RM"],
  LM: ["LWB", "LW", "CM", "CAM"],
  RM: ["RWB", "RW", "CM", "CAM"],
  CDM: ["CM", "CB", "LWB", "RWB"],
  CB: ["LB", "RB", "CDM", "LWB", "RWB"],
  LB: ["LWB", "CB", "LM"],
  RB: ["RWB", "CB", "RM"],
  LWB: ["LB", "LM", "LW", "CB"],
  RWB: ["RB", "RM", "RW", "CB"],
  GK: [],
};

// Secondary positions: very close counterparts (e.g. LW→RW, CM→CAM)
const SECONDARY_POSITIONS: Record<string, string[]> = {
  ST: ["CF"],
  CF: ["ST"],
  LW: ["RW", "LM"],
  RW: ["LW", "RM"],
  CAM: ["CM"],
  CM: ["CAM", "CDM"],
  LM: ["LW", "RM"],
  RM: ["RW", "LM"],
  CDM: ["CM"],
  CB: ["LB", "RB"],
  LB: ["LWB", "RB"],
  RB: ["RWB", "LB"],
  LWB: ["LB", "RWB"],
  RWB: ["RB", "LWB"],
  GK: [],
};

export type PositionModifierResult = {
  modifier: number;
  label: "Favourable" | "Slightly Off" | "Very Off";
  colorClass: string;
};

export function getPositionModifier(
  playerPositions: string[],
  slotRole: string
): PositionModifierResult {
  const upperRole = slotRole.toUpperCase();
  const upperPlayerPositions = playerPositions.map(p => p.toUpperCase());

  // Natural position = 100%
  if (upperPlayerPositions.includes(upperRole)) {
    return { modifier: 1.0, label: "Favourable", colorClass: "bg-green-500" };
  }

  // Secondary position = 90% (very close counterpart like LW↔RW, CM↔CAM)
  for (const pos of upperPlayerPositions) {
    const secondary = SECONDARY_POSITIONS[pos] || [];
    if (secondary.includes(upperRole)) {
      return { modifier: 0.90, label: "Favourable", colorClass: "bg-green-500" };
    }
  }

  // Related position = 75% (adjacent)
  for (const pos of upperPlayerPositions) {
    const adjacent = ADJACENT_POSITIONS[pos] || [];
    if (adjacent.includes(upperRole)) {
      return { modifier: 0.75, label: "Slightly Off", colorClass: "bg-yellow-500" };
    }
  }

  // Unnatural position = 50%
  return { modifier: 0.50, label: "Very Off", colorClass: "bg-red-500" };
}
