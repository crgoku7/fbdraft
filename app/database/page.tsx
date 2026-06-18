"use client";

import { useState, useMemo } from "react";
import { searchPlayers, getPlayersByPosition, type Player, type PlayerRole } from "../../lib/player-data";

export default function DatabasePage() {
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("");

  const players = useMemo(() => {
    let result = searchPlayers(query);
    if (positionFilter) {
      const positionSet = new Set(getPlayersByPosition(positionFilter).map(p => p.id));
      result = result.filter(p => positionSet.has(p.id));
    }
    return result;
  }, [query, positionFilter]);

  const positions: string[] = ["GK", "DEF", "MID", "ATT"];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Player Database</h1>
          <p className="text-slate-500 dark:text-slate-400">Search and filter top football players. (Milestone 1)</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search players (e.g. Messi)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white shadow-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setPositionFilter("")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!positionFilter ? "bg-blue-600 text-white shadow-md" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"}`}
            >
              ALL
            </button>
            {positions.map(pos => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${positionFilter === pos ? "bg-blue-600 text-white shadow-md" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"}`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Showing {players.length} players
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {players.map(player => (
            <div key={player.id} className="glass-panel p-6 rounded-2xl hover-lift flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1" title={player.name}>{player.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{player.country}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-black w-12 h-12 flex items-center justify-center rounded-xl shadow-lg">
                  {player.rating}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                {player.positions.map(pos => (
                  <span key={pos} className="px-2 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {pos}
                  </span>
                ))}
              </div>
              {player.traits.length > 0 && (
                <div className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2" title={player.traits.join(", ")}>
                  {player.traits.join(" • ")}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {players.length === 0 && (
          <div className="text-center py-24 text-slate-500 dark:text-slate-400">
            <p className="text-xl">No players found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
