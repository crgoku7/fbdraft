"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const playClick = () => {
  if (typeof Audio !== "undefined") {
    new Audio("/audio/click.wav").play().catch(() => {});
  }
};

export default function MultiplayerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  
  // Create Room State
  const [draftType, setDraftType] = useState<"auction" | "pack">("auction");
  const [teamSize, setTeamSize] = useState<11 | 13 | 15>(11);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [hostName, setHostName] = useState("");
  
  // Join Room State
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);

  // Generate a random playerId for this tab if it doesn't exist
  useEffect(() => {
    if (!sessionStorage.getItem("playerId")) {
      sessionStorage.setItem("playerId", `p_${Math.random().toString(36).substring(2, 9)}`);
    }
  }, []);

  const handleCreateRoom = async () => {
    playClick();
    if (!hostName.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setIsLoading(true);
    
    try {
      const playerId = sessionStorage.getItem("playerId")!;
      const { code } = await createRoom({
        hostId: playerId,
        hostName: hostName.trim(),
        settings: {
          draftType,
          teamSize,
          maxPlayers,
        },
      });
      router.push(`/room/${code}`);
    } catch (e: any) {
      setError(e.message || "Failed to create room");
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    playClick();
    if (!joinCode.trim() || !playerName.trim()) {
      setError("Please enter a room code and your name");
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      const playerId = sessionStorage.getItem("playerId")!;
      const { code } = await joinRoom({
        code: joinCode.trim().toUpperCase(),
        playerId,
        playerName: playerName.trim(),
      });
      router.push(`/room/${code}`);
    } catch (e: any) {
      setError(e.message || "Failed to join room");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            {mode === "menu" && "Multiplayer"}
            {mode === "create" && "Create Room"}
            {mode === "join" && "Join Room"}
          </h1>
          {mode !== "menu" && (
            <button 
              onClick={() => { playClick(); setMode("menu"); setError(""); }}
              className="text-slate-400 hover:text-white text-sm font-bold bg-slate-800 px-3 py-1 rounded-lg transition-colors"
            >
              Back
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm font-bold text-center">
            {error}
          </div>
        )}

        {mode === "menu" && (
          <div className="space-y-4">
            <button
              onClick={() => { playClick(); setMode("create"); }}
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/30 text-white font-black text-xl rounded-2xl shadow-xl transition-all hover:-translate-y-1"
            >
              CREATE ROOM
            </button>
            <button
              onClick={() => { playClick(); setMode("join"); }}
              className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/30 text-white font-black text-xl rounded-2xl shadow-xl transition-all hover:-translate-y-1"
            >
              JOIN ROOM
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-6">
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Your Name</label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Pep Guardiola"
                maxLength={20}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Draft Type</label>
              <div className="flex gap-2">
                <button onClick={() => setDraftType("auction")} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${draftType === "auction" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>Auction</button>
                <button onClick={() => setDraftType("pack")} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${draftType === "pack" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>Pack</button>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Team Size</label>
              <div className="flex gap-2">
                {[11, 13, 15].map(n => (
                  <button key={n} onClick={() => setTeamSize(n as any)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${teamSize === n ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Max Players: {maxPlayers}</label>
              <input 
                type="range" min="2" max="12" value={maxPlayers} 
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full mt-4 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-lg rounded-xl shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              {isLoading ? "CREATING..." : "CREATE LOBBY"}
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-6">
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-black tracking-widest text-white focus:outline-none focus:border-emerald-500 transition-colors uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Jurgen Klopp"
                maxLength={20}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={isLoading}
              className="w-full mt-4 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black text-lg rounded-xl shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              {isLoading ? "JOINING..." : "JOIN LOBBY"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
