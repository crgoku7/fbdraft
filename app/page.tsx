"use client";

import Link from "next/link";

const playClick = () => {
  new Audio('/audio/click.wav').play().catch(() => {});
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <main className="z-10 max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Draft <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Football</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Experience the ultimate football management simulation. Draft your dream team, simulate seasons, and conquer the league.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
          <Link href="/draft" className="group" onClick={playClick}>
            <div className="glass-panel p-8 rounded-3xl h-full flex flex-col items-center text-center space-y-4 hover-lift border-2 border-transparent hover:border-indigo-500/30 transition-all">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Auction Draft</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Draft against AI managers in a bidding war to build your dream team.
              </p>
            </div>
          </Link>

          <Link href="/pack-draft" className="group" onClick={playClick}>
            <div className="glass-panel p-8 rounded-3xl h-full flex flex-col items-center text-center space-y-4 hover-lift border-2 border-transparent hover:border-emerald-500/30 transition-all">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pack Draft</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Open packs, pick 1 of 5 players per position, and assemble your ultimate squad.
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
