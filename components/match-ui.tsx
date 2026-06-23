import { useState } from "react";
import type { MatchEvent, MatchResult } from "../lib/match-engine-v3";
import type { LeagueTeam } from "../lib/league-engine";
import { FORMATIONS, getPositionModifier } from "../lib/formation-utils";
import type { PlayerStat } from "../lib/player-stats";

export function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "GOAL") return <span>⚽</span>;
  if (type === "YELLOW_CARD") return <span>🟨</span>;
  if (type === "RED_CARD") return <span>🟥</span>;
  if (type === "SAVE") return <span title="Save">🧤</span>;
  return <span title="Miss">↗️</span>;
}

export function EventList({ events, homeTeamId }: { events: MatchEvent[]; homeTeamId: number }) {
  if (events.length === 0) return <div className="text-slate-600 text-xs text-center py-2 italic">No events</div>;
  return (
    <div className="space-y-1 mt-2">
      {events.map((ev, i) => (
        <div key={i} className={`flex items-start text-xs ${ev.teamId === homeTeamId ? 'justify-start' : 'justify-end'}`}>
          <div className={`flex gap-2 items-start max-w-[80%] ${ev.teamId === homeTeamId ? '' : 'flex-row-reverse text-right'}`}>
            <span className="text-slate-500 font-bold w-6 tabular-nums shrink-0">{ev.minute}'</span>
            <EventIcon type={ev.type} />
            <span className="text-slate-300">
              <span className="font-bold text-white">{ev.playerName}</span>
              {ev.assistPlayerName && <span className="text-slate-500 ml-1">(ast. {ev.assistPlayerName})</span>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-600", DEF: "bg-blue-600", MID: "bg-emerald-600", ATT: "bg-red-600",
};
function posColor(role: string) {
  if (role === "GK") return POS_COLOR.GK;
  if (["CB","LB","RB","LWB","RWB"].includes(role)) return POS_COLOR.DEF;
  if (["CM","CDM","CAM","LM","RM"].includes(role)) return POS_COLOR.MID;
  return POS_COLOR.ATT;
}

export function MiniPitch({ team, ratingsByPlayer, flipped }: { team: LeagueTeam; ratingsByPlayer: Map<number, number>; flipped?: boolean }) {
  const formation = FORMATIONS.find(f => f.id === team.formationId) || FORMATIONS[0];
  const rosterMap = new Map(team.roster.filter(r => r.slotId).map(r => [r.slotId!, r.player]));
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-white/5"
      style={{
        paddingTop: "150%",
        background: "linear-gradient(180deg, #1a4a1a 0%, #163f16 50%, #1a4a1a 100%)",
        transform: flipped ? "scaleY(-1)" : undefined,
      }}
    >
      <div className="absolute inset-[4px] border border-white/10 rounded pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/10 pointer-events-none" />

      {formation.slots.map(slot => {
        const player = rosterMap.get(slot.id);
        const performanceRating = player ? ratingsByPlayer.get(player.id) : undefined;
        return (
          <div
            key={slot.id}
            className="absolute flex flex-col items-center"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {player ? (
              <>
                <div
                  className={`w-6 h-6 rounded-full ${posColor(slot.role)} flex items-center justify-center text-white font-black text-[8px] shadow-md border border-black/30`}
                  style={{ transform: flipped ? "scaleY(-1)" : undefined }}
                  title={player.name}
                >
                  {Math.floor(player.rating * getPositionModifier(player.positions, slot.role).modifier)}
                </div>
                {performanceRating !== undefined && (
                  <div
                    className="mt-px rounded bg-slate-950/80 px-1 text-[7px] font-black text-amber-300 leading-tight"
                    style={{ transform: flipped ? "scaleY(-1)" : undefined }}
                    title="Match rating"
                  >
                    {performanceRating.toFixed(1)}
                  </div>
                )}
                <div
                  className="mt-px text-[7px] font-bold text-white/80 truncate max-w-[36px] text-center leading-none"
                  style={{ transform: flipped ? "scaleY(-1)" : undefined }}
                >
                  {player.name.split(" ").slice(-1)[0]}
                </div>
              </>
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 border border-dashed border-white/20 flex items-center justify-center">
                <span className="text-white/30 text-[7px]">{slot.role}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StatRow({ rank, stat, valueKey, valueLabel }: { rank: number, stat: PlayerStat, valueKey: keyof PlayerStat, valueLabel?: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${rank === 1 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
      <div className={`w-6 text-center font-black text-sm ${rank === 1 ? 'text-amber-400' : 'text-slate-500'}`}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-white truncate">{stat.playerName}</div>
        <div className="text-[11px] text-slate-500">{stat.teamName}</div>
      </div>
      <div className="text-right">
        <div className="font-black text-xl text-white">{stat[valueKey] as number}</div>
        {valueLabel && <div className="text-[10px] text-slate-500">{valueLabel}</div>}
      </div>
    </div>
  );
}

export function MatchDetailsModal({ result, homeTeam, awayTeam, onClose }: { result: MatchResult; homeTeam: LeagueTeam; awayTeam: LeagueTeam; onClose: () => void }) {
  const [lineupTab, setLineupTab] = useState<'events' | 'lineups'>('events');
  const playerRatings = new Map(result.playerRatings.map(rating => [rating.playerId, rating.rating]) ?? []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-white/5 shrink-0">
          <h2 className="font-black text-lg text-white">Match Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="text-center w-1/3">
              <div className="text-xl font-black text-white truncate">{homeTeam.name}</div>
              <div className="text-xs text-slate-500">{homeTeam.formationId}</div>
            </div>
            <div className="text-3xl font-black text-white px-4">
              {result.homeGoals} - {result.awayGoals}
            </div>
            <div className="text-center w-1/3">
              <div className="text-xl font-black text-white truncate">{awayTeam.name}</div>
              <div className="text-xs text-slate-500">{awayTeam.formationId}</div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 mb-3 border-t border-white/5">
            <span className="text-[11px] text-slate-500">xG {result.homeXg}</span>
            <div className="flex gap-1 items-center">
              {result.motmName && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-lg mr-2" title="Man of the Match">
                  ⭐ {result.motmName}
                </span>
              )}
              <button
                onClick={() => setLineupTab('events')}
                className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all ${lineupTab === 'events' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                EVENTS
              </button>
              <button
                onClick={() => setLineupTab('lineups')}
                className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all ${lineupTab === 'lineups' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                LINEUPS
              </button>
            </div>
            <span className="text-[11px] text-slate-500 font-bold">xG {result.awayXg}</span>
          </div>

          {result.meta && (
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-6 px-8">
              <div className="text-right w-12">
                <div>{result.meta.homeShots} <span className="text-[8px] text-slate-500">({result.meta.homeShotsOnTarget})</span></div>
                <div>{result.meta.homeBigChances}</div>
              </div>
              
              <div className="text-center flex-1 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden flex flex-row-reverse">
                    <div className="h-full bg-indigo-500" style={{ width: `${result.meta.possession}%` }} />
                  </div>
                  <span className="font-black text-white w-8">{result.meta.possession}%</span>
                  <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-500" style={{ width: `${100 - result.meta.possession}%` }} />
                  </div>
                </div>
                <div className="text-[8px] uppercase tracking-widest font-bold">Shots (on target)</div>
                <div className="text-[8px] uppercase tracking-widest font-bold">Big Chances</div>
              </div>

              <div className="text-left w-12">
                <div>{result.meta.awayShots} <span className="text-[8px] text-slate-500">({result.meta.awayShotsOnTarget})</span></div>
                <div>{result.meta.awayBigChances}</div>
              </div>
            </div>
          )}

          {lineupTab === 'events' && <EventList events={result.events} homeTeamId={homeTeam.id} />}

          {lineupTab === 'lineups' && (
            <div className="grid grid-cols-2 gap-4 mt-1">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 text-center">{homeTeam.name}</div>
                <MiniPitch team={homeTeam} ratingsByPlayer={playerRatings} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 text-center">{awayTeam.name}</div>
                <MiniPitch team={awayTeam} ratingsByPlayer={playerRatings} flipped />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
