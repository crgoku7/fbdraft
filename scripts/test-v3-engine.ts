import { simulateMatchV3, type TeamInput, getEffectiveRoster } from "../lib/match-engine-v3";
import { FORMATIONS } from "../lib/formation-utils";
import type { Player } from "../lib/player-data";

function createMockTeam(id: number, ratingOffset: number): TeamInput {
  const formationId = "4-3-3";
  const formation = FORMATIONS.find(f => f.id === formationId)!;
  
  // Create mock players with appropriate ratings
  const roster = formation.slots.map((slot, i) => {
    // Attackers get slightly higher rating to simulate typical star distribution
    const isAttacker = ["ST", "LW", "RW"].includes(slot.role);
    const playerRating = 75 + ratingOffset + (isAttacker ? 2 : 0) + (Math.random() * 4 - 2);
    
    return {
      slotId: slot.id,
      player: {
        id: id * 100 + i,
        name: `Player ${slot.role} ${i}`,
        country: "Mockland",
        rating: playerRating,
        positions: [slot.role],
        traits: isAttacker ? ["Finesse Shot"] : (slot.role === "GK" ? ["Deflector"] : []),
      } as Player
    };
  });

  return { id, roster, formationId };
}

function runTests() {
  const NUM_MATCHES = 100;
  console.log(`Simulating ${NUM_MATCHES} matches: Elite (85 OVR) vs Weak (75 OVR)...\n`);

  const strongTeam = createMockTeam(1, 10); // ~85 rating
  const weakTeam = createMockTeam(2, 0);   // ~75 rating

  let strongWins = 0, draws = 0, weakWins = 0;
  let totalStrongXg = 0, totalWeakXg = 0;
  let totalStrongShots = 0, totalWeakShots = 0;
  let totalStrongPossession = 0;

  for (let i = 0; i < NUM_MATCHES; i++) {
    // Alternate home/away
    const isStrongHome = i % 2 === 0;
    const home = isStrongHome ? strongTeam : weakTeam;
    const away = isStrongHome ? weakTeam : strongTeam;

    const result = simulateMatchV3(home, away, false);

    const strongGoals = isStrongHome ? result.homeGoals : result.awayGoals;
    const weakGoals = isStrongHome ? result.awayGoals : result.homeGoals;
    
    if (strongGoals > weakGoals) strongWins++;
    else if (weakGoals > strongGoals) weakWins++;
    else draws++;

    totalStrongXg += isStrongHome ? result.homeXg : result.awayXg;
    totalWeakXg += isStrongHome ? result.awayXg : result.homeXg;
    
    totalStrongShots += isStrongHome ? result.meta.homeShots : result.meta.awayShots;
    totalWeakShots += isStrongHome ? result.meta.awayShots : result.meta.homeShots;
    
    totalStrongPossession += isStrongHome ? result.meta.possession : (100 - result.meta.possession);
  }

  console.log(`Results over ${NUM_MATCHES} matches:`);
  console.log(`-----------------------------------`);
  console.log(`Strong Wins: ${strongWins} (${((strongWins/NUM_MATCHES)*100).toFixed(1)}%)`);
  console.log(`Draws:       ${draws} (${((draws/NUM_MATCHES)*100).toFixed(1)}%)`);
  console.log(`Weak Wins:   ${weakWins} (${((weakWins/NUM_MATCHES)*100).toFixed(1)}%)`);
  console.log(`\nAverages per match:`);
  console.log(`Strong xG:         ${(totalStrongXg / NUM_MATCHES).toFixed(2)}`);
  console.log(`Weak xG:           ${(totalWeakXg / NUM_MATCHES).toFixed(2)}`);
  console.log(`Strong Shots:      ${(totalStrongShots / NUM_MATCHES).toFixed(1)}`);
  console.log(`Weak Shots:        ${(totalWeakShots / NUM_MATCHES).toFixed(1)}`);
  console.log(`Strong Possession: ${(totalStrongPossession / NUM_MATCHES).toFixed(1)}%`);
}

runTests();
