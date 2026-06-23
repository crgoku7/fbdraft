import { simulateMatchV3, validateMatchEvents, type MatchEvent, type TeamInput } from "../lib/match-engine-v3";
import { FORMATIONS } from "../lib/formation-utils";
import type { Player } from "../lib/player-data";

function createMockTeam(id: number, ratingOffset: number): TeamInput {
  const formationId = "4-3-3";
  const formation = FORMATIONS.find(f => f.id === formationId)!;
  const roster = formation.slots.map((slot, index) => {
    const isAttacker = ["ST", "LW", "RW"].includes(slot.role);
    return {
      slotId: slot.id,
      player: {
        id: id * 100 + index,
        name: `Player ${slot.role} ${index}`,
        country: "Mockland",
        rating: 75 + ratingOffset + (isAttacker ? 2 : 0),
        positions: [slot.role],
        traits: isAttacker ? ["Finesse Shot"] : (slot.role === "GK" ? ["Deflector"] : []),
      } as Player,
    };
  });

  return { id, roster, formationId };
}

function event(type: MatchEvent["type"], minute: number, playerId = 101): MatchEvent {
  return { type, minute, teamId: 1, playerId, playerName: `Player ${playerId}` };
}

function assertInvalid(name: string, events: MatchEvent[]) {
  const errors = validateMatchEvents(events);
  if (errors.length === 0) throw new Error(`${name}: invalid timeline was accepted.`);
}

function runRegressionTests() {
  assertInvalid("repeated yellow", [event("YELLOW_CARD", 12), event("YELLOW_CARD", 56)]);
  assertInvalid("injury event", [{ ...event("MISS", 31), type: "INJURY" as never }]);
  assertInvalid("yellow-yellow without red", [event("YELLOW_CARD", 20), event("YELLOW_CARD", 65)]);
  assertInvalid("event after send-off", [event("RED_CARD", 42), event("GOAL", 70)]);

  const validSecondYellow = [event("YELLOW_CARD", 20), event("RED_CARD", 65)];
  if (validateMatchEvents(validSecondYellow).length > 0) {
    throw new Error("second yellow dismissal timeline was rejected.");
  }
}

function runBatchSimulation() {
  const matchCount = 500;
  const strongTeam = createMockTeam(1, 10);
  const weakTeam = createMockTeam(2, 0);
  let strongWins = 0;
  let draws = 0;
  let weakWins = 0;
  let totalStrongXg = 0;
  let totalWeakXg = 0;
  let totalStrongShots = 0;
  let totalWeakShots = 0;
  let totalStrongPossession = 0;
  let totalYellows = 0;
  let totalReds = 0;

  for (let index = 0; index < matchCount; index++) {
    const strongIsHome = index % 2 === 0;
    const result = simulateMatchV3(strongIsHome ? strongTeam : weakTeam, strongIsHome ? weakTeam : strongTeam);
    const strongGoals = strongIsHome ? result.homeGoals : result.awayGoals;
    const weakGoals = strongIsHome ? result.awayGoals : result.homeGoals;

    if (strongGoals > weakGoals) strongWins++;
    else if (weakGoals > strongGoals) weakWins++;
    else draws++;

    totalStrongXg += strongIsHome ? result.homeXg : result.awayXg;
    totalWeakXg += strongIsHome ? result.awayXg : result.homeXg;
    totalStrongShots += strongIsHome ? result.meta.homeShots : result.meta.awayShots;
    totalWeakShots += strongIsHome ? result.meta.awayShots : result.meta.homeShots;
    totalStrongPossession += strongIsHome ? result.meta.possession : 100 - result.meta.possession;
    totalYellows += result.events.filter(entry => entry.type === "YELLOW_CARD").length;
    totalReds += result.events.filter(entry => entry.type === "RED_CARD").length;

    const errors = validateMatchEvents(result.events);
    if (errors.length) throw new Error(`Simulation ${index + 1} produced an invalid timeline: ${errors.join(" ")}`);
  }

  const yellowAverage = totalYellows / matchCount;
  const redAverage = totalReds / matchCount;
  if (yellowAverage < 1.5 || yellowAverage > 5.5) throw new Error(`Yellow-card distribution is out of range: ${yellowAverage.toFixed(2)}.`);
  if (redAverage > 0.25) throw new Error(`Red-card distribution is out of range: ${redAverage.toFixed(2)}.`);
  if (strongWins <= weakWins) throw new Error("Strong team did not outperform the weak team.");

  console.log(`V3 batch verification: ${matchCount} matches passed`);
  console.log(`Strong W/D/L: ${strongWins}/${draws}/${weakWins}`);
  console.log(`Strong vs weak xG: ${(totalStrongXg / matchCount).toFixed(2)} / ${(totalWeakXg / matchCount).toFixed(2)}`);
  console.log(`Strong vs weak shots: ${(totalStrongShots / matchCount).toFixed(1)} / ${(totalWeakShots / matchCount).toFixed(1)}`);
  console.log(`Strong possession: ${(totalStrongPossession / matchCount).toFixed(1)}%`);
  console.log(`Cards per match — yellows: ${yellowAverage.toFixed(2)}, reds: ${redAverage.toFixed(3)}`);
}

runRegressionTests();
runBatchSimulation();
