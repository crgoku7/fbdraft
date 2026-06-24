"use client";

import React, { useState } from "react";
import type { LeagueTeam } from "../lib/league-engine";
import { FORMATIONS, getPositionModifier } from "../lib/formation-utils";
import { getCountryFlag } from "../lib/country-flags";
import { ratingGradient } from "./draft-ui";
import { getTeamStrengthRatings } from "../lib/match-engine";
import { getTeamV3PreviewRatings } from "../lib/match-engine-v3";

// Temporary comparison aid while the legacy display model is evaluated against V3.
export const SHOW_V3_TEAM_RATING_PREVIEW = true;

const playClick = () => {
  if (typeof Audio !== "undefined") {
    new Audio('/audio/click.wav').play().catch(() => {});
  }
};

// ── Shared Game Settings Form ───────────────────────────────────────
export type GameSettings = {
  aiCount: number;
  teamSize: number;
  budget: number;
  tournamentType: "LEAGUE" | "KNOCKOUT";
};

export const DEFAULT_SETTINGS: GameSettings = {
  aiCount: 7,
  teamSize: 11,
  budget: 1000,
  tournamentType: "LEAGUE",
};

export function GameSettingsForm({
  settings,
  onChange,
  onStart,
  disabled,
  title,
  accent = "indigo",
  showBudget = true,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onStart: () => void;
  disabled?: boolean;
  title: string;
  accent?: "indigo" | "emerald";
  showBudget?: boolean;
}) {
  const accentColors = accent === "emerald"
    ? { btn: "from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/30", glow: "bg-emerald-500/20", label: "text-emerald-400" }
    : { btn: "from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/30", glow: "bg-indigo-500/20", label: "text-indigo-400" };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center p-8">
      <div className="relative max-w-md w-full">
        <div className={`absolute inset-0 ${accentColors.glow} blur-3xl rounded-full`} />
        <div className="relative bg-slate-900/90 border border-white/10 p-8 rounded-3xl text-center space-y-6 backdrop-blur-xl shadow-2xl">
          <div className="text-5xl">⚽</div>
          <h1 className="text-3xl font-black text-white tracking-tight">{title}</h1>

          <div className="space-y-3 text-left">
            <SettingsRow label="AI Managers">
              <input
                type="number" min={1} max={15}
                value={settings.aiCount}
                onChange={e => onChange({ ...settings, aiCount: Math.max(1, Math.min(15, parseInt(e.target.value) || 7)) })}
                className="settings-input w-20"
              />
            </SettingsRow>

            <SettingsRow label="Team Size">
              <div className="flex items-center gap-2">
                {[11, 13, 15].map(n => (
                  <button
                    key={n}
                    onClick={() => { playClick(); onChange({ ...settings, teamSize: n }); }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${settings.teamSize === n ? "bg-white/10 text-white border border-white/20" : "text-slate-500 hover:text-white"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </SettingsRow>

            {showBudget && (
              <SettingsRow label="Budget">
                <div className="flex items-center gap-2">
                  {[500, 1000, 2000].map(b => (
                    <button
                      key={b}
                      onClick={() => { playClick(); onChange({ ...settings, budget: b }); }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${settings.budget === b ? "bg-white/10 text-white border border-white/20" : "text-slate-500 hover:text-white"}`}
                    >
                      ${b}
                    </button>
                  ))}
                </div>
              </SettingsRow>
            )}

            <SettingsRow label="Format">
              <div className="flex gap-2">
                {(["LEAGUE", "KNOCKOUT"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { playClick(); onChange({ ...settings, tournamentType: t }); }}
                    className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${settings.tournamentType === t
                      ? t === "LEAGUE" ? "bg-indigo-600 text-white" : "bg-amber-600 text-white"
                      : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {t === "LEAGUE" ? "🏟️ League" : "🏆 Knockout"}
                  </button>
                ))}
              </div>
            </SettingsRow>
          </div>

          <button
            onClick={() => { playClick(); onStart(); }}
            disabled={disabled}
            className={`w-full mt-4 py-4 bg-gradient-to-r ${accentColors.btn} text-white font-black rounded-2xl shadow-xl transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide`}
          >
            {disabled ? "Loading..." : "Start Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5">
      <label className="text-slate-300 font-bold text-sm">{label}</label>
      {children}
    </div>
  );
}


// ── Team Lineup Modal ───────────────────────────────────────────────

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-600", DEF: "bg-blue-600", MID: "bg-emerald-600", ATT: "bg-red-600",
};
function posColor(role: string) {
  if (role === "GK") return POS_COLOR.GK;
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(role)) return POS_COLOR.DEF;
  if (["CM", "CDM", "CAM", "LM", "RM"].includes(role)) return POS_COLOR.MID;
  return POS_COLOR.ATT;
}

export function TeamLineupModal({ team, onClose }: { team: LeagueTeam; onClose: () => void }) {
  const formation = FORMATIONS.find(f => f.id === team.formationId) || FORMATIONS[0];
  const starters = team.roster.filter(r => r.slotId);
  const bench = team.roster.filter(r => !r.slotId);
  const rosterMap = new Map(starters.map(r => [r.slotId!, r.player]));

  const teamRatings = starters.length >= 11 ? getTeamStrengthRatings({
    id: team.id as number,
    roster: starters.map(r => ({ player: r.player, slotId: r.slotId as string })),
    formationId: team.formationId,
  }) : null;
  const v3Ratings = SHOW_V3_TEAM_RATING_PREVIEW && starters.length >= 11 ? getTeamV3PreviewRatings({
    id: team.id as number,
    roster: starters.map(r => ({ player: r.player, slotId: r.slotId as string })),
    formationId: team.formationId,
  }) : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-white">{team.name}</h2>
              <p className="text-slate-500 font-bold text-sm">{team.formationId}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors font-bold">✕</button>
          </div>
          {teamRatings && (
            <div className="mt-3 space-y-2 text-[10px]">
              <RatingRow
                title="Legacy preview"
                ratings={[
                  { label: 'ATT', val: teamRatings.attack, color: 'text-red-400' },
                  { label: 'MID', val: teamRatings.midfield, color: 'text-emerald-400' },
                  { label: 'DEF', val: teamRatings.defense, color: 'text-blue-400' },
                  { label: 'GK', val: teamRatings.gk, color: 'text-amber-400' },
                ]}
              />
              {v3Ratings && (
                <RatingRow
                  title=""
                  ratings={[
                    { label: 'BLD', val: v3Ratings.buildUp, color: 'text-cyan-400' },
                    { label: 'CRT', val: v3Ratings.chanceCreation, color: 'text-violet-400' },
                    { label: 'FIN', val: v3Ratings.finishing, color: 'text-red-400' },
                    { label: 'RES', val: v3Ratings.defensiveResistance, color: 'text-blue-400' },
                    { label: 'OVR', val: v3Ratings.overall, color: 'text-white' },
                  ]}
                />
              )}
            </div>
          )}
        </div>

        {/* Pitch */}
        <div className="p-4">
          <div
            className="relative w-full rounded-xl overflow-hidden border border-white/5"
            style={{ paddingTop: "140%", background: "linear-gradient(180deg, #1a4a1a 0%, #163f16 50%, #1a4a1a 100%)" }}
          >
            <div className="absolute inset-[6px] border border-white/10 rounded-lg pointer-events-none" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/10 pointer-events-none" />

            {formation.slots.map(slot => {
              const player = rosterMap.get(slot.id);
              if (!player) return (
                <div key={slot.id} className="absolute flex flex-col items-center" style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-dashed border-white/20 flex items-center justify-center">
                    <span className="text-white/30 text-[8px] font-bold">{slot.role}</span>
                  </div>
                </div>
              );
              const mod = getPositionModifier(player.positions, slot.role);
              const effRating = Math.floor(player.rating * mod.modifier);
              return (
                <div key={slot.id} className="absolute flex flex-col items-center group" style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className={`w-9 h-9 rounded-full ${posColor(slot.role)} flex items-center justify-center text-white font-black text-xs shadow-lg border border-black/30`}>
                    {effRating}
                  </div>
                  <div className="mt-0.5 text-[8px] font-bold text-white/80 truncate max-w-[48px] text-center leading-none">
                    {player.name.split(" ").slice(-1)[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Bench</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {bench.map(r => {
                const grad = ratingGradient(r.player.rating);
                return (
                  <div key={r.player.id} className="flex items-center gap-2 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-white/5">
                    <span className={`text-xs font-black bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>{r.player.rating}</span>
                    <span className="text-xs font-bold text-white truncate">{r.player.name}</span>
                    <span className="text-[9px] text-slate-500 ml-auto">{r.player.positions[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full roster list */}
        <div className="px-4 pb-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Full Squad</h3>
          <div className="space-y-1">
            {starters.map(r => {
              const slot = formation.slots.find(s => s.id === r.slotId);
              const mod = slot ? getPositionModifier(r.player.positions, slot.role) : { modifier: 1 };
              return (
                <div key={r.player.id} className="flex items-center gap-2 text-xs py-1 border-b border-white/5">
                  <span className="w-6 text-center font-black text-slate-500">{Math.floor(r.player.rating * mod.modifier)}</span>
                  <span className="font-bold text-white flex-1">{r.player.name}</span>
                  <span className="text-slate-500">{r.player.positions.join(" · ")}</span>
                  <span className="text-[9px]">{getCountryFlag(r.player.country)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingRow({ title, ratings }: { title: string; ratings: { label: string; val: number; color: string }[] }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-1">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {ratings.map(r => (
          <div key={r.label} className="flex flex-col items-center bg-slate-800/60 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="text-slate-500 font-black leading-none">{r.label}</span>
            <span className={`${r.color} font-black text-sm leading-none mt-0.5`}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
