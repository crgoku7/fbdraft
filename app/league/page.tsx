"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  createLeagueSession, 
  simulateNextRound, 
  simulateRemainingRounds,
  type LeagueState,
  type LeagueTeam,
  type Fixture
} from "../../lib/league-engine";
import type { MatchEvent } from "../../lib/match-engine";

function EventList({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) return <div className="text-slate-500 text-sm text-center italic py-2">No events</div>;

  return (
    <div className="space-y-1 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
      {events.map((ev, i) => {
        let icon = "⚽";
        let color = "text-green-600 dark:text-green-400";
        if (ev.type === "YELLOW_CARD") { icon = "🟨"; color = "text-yellow-500"; }
        if (ev.type === "RED_CARD") { icon = "🟥"; color = "text-red-500"; }
        if (ev.type === "INJURY") { icon = "🏥"; color = "text-red-400"; }

        return (
          <div key={i} className="flex gap-2 items-start">
            <span className="font-bold text-slate-500 w-6 text-right">{ev.minute}'</span>
            <span className={color}>{icon}</span>
            <span className="text-slate-700 dark:text-slate-300">
              <span className="font-bold">{ev.playerName}</span>
              {ev.assistPlayerName && <span className="text-slate-500 text-xs ml-1">(ast. {ev.assistPlayerName})</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FixtureCard({ fixture, teams }: { fixture: Fixture, teams: LeagueTeam[] }) {
  const [expanded, setExpanded] = useState(false);
  
  const home = teams.find(t => t.id === fixture.homeTeamId);
  const away = teams.find(t => t.id === fixture.awayTeamId);
  
  if (!home || !away) return null;
  const isUserMatch = home.isUser || away.isUser;
  
  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all ${isUserMatch ? 'border-blue-400 dark:border-blue-600 shadow-md' : 'border-slate-200 dark:border-slate-800'}`}>
      <div 
        onClick={() => fixture.result && setExpanded(!expanded)}
        className={`p-4 flex items-center justify-between ${fixture.result ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
      >
        <div className="flex-1 text-right font-bold text-slate-900 dark:text-white truncate">
          {home.name}
          {home.isUser && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-blue-500"></span>}
        </div>
        
        <div className="w-24 text-center font-black text-xl px-2">
          {fixture.result ? (
            <span className="text-blue-600 dark:text-blue-400">{fixture.result.homeGoals} - {fixture.result.awayGoals}</span>
          ) : (
            <span className="text-slate-400 text-sm">vs</span>
          )}
        </div>
        
        <div className="flex-1 text-left font-bold text-slate-900 dark:text-white truncate">
          {away.isUser && <span className="mr-2 w-2 h-2 inline-block rounded-full bg-blue-500"></span>}
          {away.name}
        </div>
      </div>
      
      {expanded && fixture.result && (
        <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-800/20">
          <div className="flex justify-between text-xs text-slate-500 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <span>xG: {fixture.result.homeXg}</span>
            <span>xG: {fixture.result.awayXg}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="font-bold text-xs text-slate-400 mb-1">Lineup</div>
              {home.roster.filter(r => r.slotId).map((r, i) => (
                <div key={i} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                  <span className="font-semibold w-6 inline-block text-slate-500">{r.player.positions[0]}</span> {r.player.name}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="font-bold text-xs text-slate-400 mb-1">Lineup</div>
              {away.roster.filter(r => r.slotId).map((r, i) => (
                <div key={i} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                  {r.player.name} <span className="font-semibold w-6 inline-block text-right text-slate-500">{r.player.positions[0]}</span>
                </div>
              ))}
            </div>
          </div>

          <EventList events={fixture.result.events} />
        </div>
      )}
    </div>
  );
}

export default function LeaguePage() {
  const router = useRouter();
  const [leagueState, setLeagueState] = useState<LeagueState | null>(null);

  useEffect(() => {
    const data = localStorage.getItem("fbdraft_league_teams");
    if (!data) {
      router.push("/");
      return;
    }
    const teams: LeagueTeam[] = JSON.parse(data);
    setLeagueState(createLeagueSession(teams));
  }, [router]);

  if (!leagueState) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-white font-bold text-xl">Loading League...</div>;

  const currentRound = leagueState.currentRoundIndex < leagueState.rounds.length 
    ? leagueState.rounds[leagueState.currentRoundIndex] 
    : leagueState.rounds[leagueState.rounds.length - 1];

  const handlePlayNextRound = () => {
    setLeagueState(simulateNextRound(leagueState));
  };

  const handleSimulateRest = () => {
    setLeagueState(simulateRemainingRounds(leagueState));
  };

  const champion = leagueState.completed ? leagueState.standings[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex flex-col xl:flex-row gap-8">
      
      {/* Left Panel: Standings */}
      <div className="xl:flex-1 space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">League Standings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Round {Math.min(leagueState.currentRoundIndex + (leagueState.completed ? 0 : 1), 7)} of 7</p>
          </div>
          {champion && (
            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-400 px-4 py-2 rounded-xl font-bold animate-bounce">
              🏆 {champion.name} are the Champions!
            </div>
          )}
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Club</th>
                <th className="p-4 text-center w-12 hidden md:table-cell">MP</th>
                <th className="p-4 text-center w-12">W</th>
                <th className="p-4 text-center w-12 hidden md:table-cell">D</th>
                <th className="p-4 text-center w-12 hidden md:table-cell">L</th>
                <th className="p-4 text-center w-16 hidden lg:table-cell">GF</th>
                <th className="p-4 text-center w-16 hidden lg:table-cell">GA</th>
                <th className="p-4 text-center w-16">GD</th>
                <th className="p-4 text-center w-16 text-lg text-slate-900 dark:text-white">Pts</th>
              </tr>
            </thead>
            <tbody>
              {leagueState.standings.map((s, idx) => (
                <tr key={s.teamId} className={`border-t border-slate-200 dark:border-slate-800 transition-colors ${s.isUser ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                  <td className="p-4 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {s.name} {s.isUser && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">YOU</span>}
                  </td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400 font-medium hidden md:table-cell">{s.played}</td>
                  <td className="p-4 text-center font-medium">{s.wins}</td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400 font-medium hidden md:table-cell">{s.draws}</td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400 font-medium hidden md:table-cell">{s.losses}</td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400 font-medium hidden lg:table-cell">{s.gf}</td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400 font-medium hidden lg:table-cell">{s.ga}</td>
                  <td className="p-4 text-center font-medium">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="p-4 text-center font-black text-lg text-slate-900 dark:text-white">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel: Fixtures */}
      <div className="xl:w-[450px] flex-shrink-0 space-y-6">
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Fixtures</h2>
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              Round {currentRound.roundNum}
            </div>
          </div>

          <div className="space-y-4">
            {currentRound.fixtures.map((f, idx) => (
              <FixtureCard key={idx} fixture={f} teams={leagueState.teams} />
            ))}
          </div>

          {!leagueState.completed && (
            <div className="mt-8 flex gap-3">
              <button 
                onClick={handlePlayNextRound}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Play Next Round
              </button>
              <button 
                onClick={handleSimulateRest}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-transform hover:-translate-y-0.5"
              >
                Simulate Rest
              </button>
            </div>
          )}
          
          {leagueState.completed && (
            <div className="mt-8">
              <button 
                onClick={() => router.push("/")}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all"
              >
                Start New Draft
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
