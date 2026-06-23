"use client";

import React from "react";
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Player } from "../lib/player-data";
import type { PositionModifierResult } from "../lib/formation-utils";
import { getCountryFlag } from "../lib/country-flags";

// ── Rating colour band ──────────────────────────────────────────────
export function ratingGradient(rating: number): string {
  if (rating >= 90) return "from-amber-400 to-yellow-600";
  if (rating >= 85) return "from-emerald-400 to-teal-600";
  if (rating >= 80) return "from-sky-400 to-blue-600";
  return "from-slate-400 to-slate-600";
}

// ── FUT-style auction card ──────────────────────────────────────────
export function AuctionCard({ player, onClick }: { player: Player, onClick?: () => void }) {
  const grad = ratingGradient(player.rating);
  return (
    <div 
      className={`relative w-52 select-none ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`} 
      style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" }}
      onClick={onClick}
    >
      {/* Card body */}
      <div className={`relative rounded-2xl bg-gradient-to-br ${grad} p-[2px]`}>
        <div className="rounded-2xl bg-slate-900/95 flex flex-col items-center pt-6 pb-5 px-4 gap-1 backdrop-blur-md">
          {/* Rating */}
          <div className={`text-6xl font-black bg-gradient-to-br ${grad} bg-clip-text text-transparent leading-none`}>
            {player.rating}
          </div>

          {/* Name */}
          <div className="text-xl font-extrabold text-white uppercase tracking-wider text-center leading-tight mt-1">
            {player.name.split(" ").slice(-1)[0]}
          </div>
          <div className="text-[11px] text-slate-400 font-medium uppercase tracking-widest text-center">
            {player.name.split(" ").slice(0, -1).join(" ")}
          </div>

          {/* Positions */}
          <div className="flex gap-1.5 mt-2 flex-wrap justify-center">
            {player.positions.map(p => (
              <span key={p} className={`text-[10px] font-black px-2 py-0.5 rounded bg-gradient-to-r ${grad} text-white`}>
                {p}
              </span>
            ))}
          </div>

          {/* Country */}
          <div className="flex items-center gap-1.5 mt-2 text-slate-300 text-sm font-semibold">
            <span className="text-xl">{getCountryFlag(player.country)}</span>
            <span>{player.country}</span>
          </div>

          {/* Traits */}
          {player.traits.length > 0 && (
            <div className="mt-3 w-full border-t border-white/10 pt-3 flex flex-col gap-1">
              {player.traits.slice(0, 4).map(t => (
                <div key={t} className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold">
                  <span>⭐</span>
                  <span>{t}</span>
                </div>
              ))}
              {player.traits.length > 4 && (
                <div className="relative group/traits cursor-default">
                  <div className="text-slate-500 text-[10px] hover:text-amber-400 transition-colors">+{player.traits.length - 4} more traits ▾</div>
                  <div className="absolute bottom-full left-0 mb-1 bg-slate-900 border border-amber-500/30 rounded-xl p-2 opacity-0 group-hover/traits:opacity-100 pointer-events-none transition-opacity z-50 w-max shadow-xl">
                    {player.traits.slice(4).map(t => (
                      <div key={t} className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold py-0.5">
                        <span>⭐</span><span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Draggable mini player circle (pitch) ───────────────────────────
const POS_RING_COLOR: Record<string, string> = {
  "bg-green-500":  "ring-green-400/60 shadow-green-500/40",
  "bg-yellow-500": "ring-yellow-400/60 shadow-yellow-500/40",
  "bg-red-500":    "ring-red-400/60 shadow-red-500/40",
  "bg-slate-700":  "ring-slate-500/40 shadow-slate-600/30",
};

export function DraggablePlayer({ player, id, modifier, slotY }: { player: Player, id: string, modifier: PositionModifierResult, slotY?: number }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 } : undefined;
  const effectiveRating = Math.floor(player.rating * modifier.modifier);
  const ringColor = POS_RING_COLOR[modifier.colorClass] ?? "ring-white/20";
  const lastName = player.name.split(' ').slice(-1)[0];
  const showBelow = (slotY ?? 50) < 20; // show tooltip below if player is near top

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="relative flex flex-col items-center cursor-grab active:cursor-grabbing group select-none"
      // Ensure hovered player is above all others
    >
      {/* Tooltip */}
      <div className={`absolute ${showBelow ? 'top-full mt-2' : 'bottom-full mb-2'} bg-slate-900/98 border border-white/10 text-white text-[10px] px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-150 z-[200] flex flex-col items-center pointer-events-none w-max shadow-2xl max-w-[180px]`}>
        <span className="font-black text-xs text-white">{player.name}</span>
        <span className="text-indigo-300 mt-0.5 font-semibold">{player.positions.join(" · ")}</span>
        {modifier.modifier < 1 && <span className="text-red-400 text-[9px] mt-0.5">{effectiveRating} (pos penalty)</span>}
        {player.traits.length > 0 && (
          <div className="mt-1.5 border-t border-white/10 pt-1.5 w-full text-center">
            {player.traits.slice(0, 3).map(t => (
              <div key={t} className="text-amber-400 text-[9px] leading-5">⭐ {t}</div>
            ))}
            {player.traits.length > 3 && <div className="text-slate-500 text-[9px]">+{player.traits.length - 3} more</div>}
          </div>
        )}
      </div>

      {/* Circle */}
      <div className={`relative w-11 h-11 rounded-full ${modifier.colorClass} flex flex-col items-center justify-center shadow-lg ring-2 ${ringColor} transition-transform duration-150 group-hover:scale-110 group-hover:shadow-xl group-hover:z-[200]`}>
        {/* Inner rating */}
        <span className="text-white font-black text-sm leading-none">{effectiveRating}</span>
        {/* Pos label inside bottom */}
        <span className="text-white/70 font-bold text-[7px] leading-none mt-0.5 uppercase">{player.positions[0]}</span>
      </div>

      {/* Name label */}
      <div className="mt-0.5 bg-black/70 backdrop-blur-sm text-white text-[8px] px-1.5 py-px rounded-sm truncate max-w-[52px] text-center font-bold tracking-wide">
        {lastName}
      </div>
    </div>
  );
}

// ── Pitch slot ──────────────────────────────────────────────────────
export function PitchSlot({ id, x, y, role, children, isHighlighted }: { id: string, x: number, y: number, role: string, children: React.ReactNode, isHighlighted?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
      className={`absolute w-14 h-14 rounded-full flex items-center justify-center transition-all hover:z-[100]
        ${isOver ? 'bg-white/25 border-2 border-white scale-110' : 
          isHighlighted ? 'bg-indigo-500/40 border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse' : 
          'bg-black/20 border border-white/20 border-dashed'}`}
    >
      {!children && <span className="text-white/50 text-[10px] font-black">{role}</span>}
      {children}
    </div>
  );
}

// ── Bench drop area ─────────────────────────────────────────────────
export function BenchArea({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "bench" });
  return (
    <div
      ref={setNodeRef}
      className={`p-3 rounded-xl min-h-[72px] flex flex-wrap gap-3 items-center transition-colors ${isOver ? 'bg-white/10 border-2 border-white/50' : 'bg-slate-800/60 border border-white/10'}`}
    >
      {children}
    </div>
  );
}
