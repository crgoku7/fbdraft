
# Project: Draft Football

## High-Level Vision

Draft Football is an online football management game focused on:

1. Drafting a team of real-world football players.
2. Building the strongest squad within draft constraints.
3. Competing in simulated matches.
4. Following league and tournament progression.
5. Receiving AI-generated match reports and storylines.

The core experience is inspired by fantasy drafts, sports management games, and AI storytelling.

The game is not a football gameplay simulator where users directly control players. Instead, users act as managers who build squads and compete through a simulation engine.

---

# Core Gameplay Loop

```text
Create League
      ↓
Join Draft
      ↓
Draft Players
      ↓
Build Lineup
      ↓
Simulate Matches
      ↓
League Table Updates
      ↓
Playoffs / Finals
      ↓
Champion Crowned
```

The draft is the most important part of the game.

---

# Player Data

Each player contains:

```ts
{
  id: number;
  name: string;
  country: string;
  rating: number;
  positions: string[];
  traits: string[];
}
```

Current dataset:

* ~506 players
* Top footballers from around the world
* Ratings based on FC-style ratings
* Multiple position support
* Trait support

Examples:

```text
Julián Alvarez
Argentina
87
ST
Finesse Shot
```

```text
Khvicha Kvaratskhelia
Georgia
87
LW / RW / LM

Traits:
Finesse Shot
Gamechanger
Incisive Pass
Technical
Trickster
```

---

# Draft System

## Primary Draft Mode

Auction Draft

Every participant receives a fixed budget.

Example:

```text
Budget: 1000
```

Players are auctioned one at a time.

Example:

```text
Mbappe
Starting Bid: 100

User A: 120
User B: 140
User C: 150

Sold to User C
```

Rules:

* No duplicate players.
* One player can belong to only one team.
* Budget cannot go negative.
* Draft continues until all teams have required players.

---

# Team Building

After drafting:

Players build a lineup.

Supported formations:

```text
4-3-3
4-4-2
4-2-3-1
```

Position fit matters.

Example:

```text
ST playing ST = 100%

LW playing RW = 90%

ST playing CB = 60%
```

Effective rating depends on position fit.

---

# Match Simulation Philosophy

Matches are NOT decided by an LLM.

The simulation engine determines:

```text
Goals
Assists
Cards
Injuries
Winner
```

using deterministic and probabilistic calculations.

Factors:

```text
Player Ratings
Position Fit
Formation
Traits
Team Strength
```

The simulation should feel realistic while allowing occasional upsets.

---

# AI Usage

AI is used for storytelling only.

Examples:

## Match Report

```text
Alvarez opened the scoring in the 18th minute...
```

## Player Ratings

```text
Julián Alvarez - 8.5
```

## Man of the Match

```text
Khvicha Kvaratskhelia
```

## League News

```text
Alvarez now leads the Golden Boot race.
```

AI should never determine match outcomes.

---

# League System

League contains:

```text
Teams
Standings
Fixtures
Match History
```

Track:

```text
Wins
Draws
Losses
Goals For
Goals Against
Points
```

Standard scoring:

```text
Win = 3
Draw = 1
Loss = 0
```

---

# Tournament System

Supported formats:

### Round Robin

Every team plays every team.

### Knockout

```text
Quarter Final
Semi Final
Final
```

### Hybrid

```text
League Stage
↓
Playoffs
↓
Champion
```

---

# Multiplayer

Users can:

```text
Create League
Invite Friends
Join Draft
Compete Together
```

League host controls:

```text
League Name
Number of Teams
Draft Budget
Draft Size
Tournament Format
```

---

# Technical Architecture

## Frontend

```text
Next.js
TypeScript
Tailwind
shadcn/ui
```

---

## Backend

```text
Convex
```

Responsibilities:

```text
Auth
Rooms
Draft State
League State
Match Records
Standings
```

---

## Simulation Layer

Custom TypeScript service.

Responsibilities:

```text
Draft Logic
Lineup Validation
Match Simulation
League Scheduling
```

---

## AI Layer

External LLM API.

Responsibilities:

```text
Match Reports
Player Ratings
News Generation
Storylines
```

---

# MVP Definition

The project is considered MVP-complete when a user can:

1. Create a league.
2. Draft players.
3. Build a lineup.
4. Simulate a season.
5. View standings.
6. Play a final.
7. Read AI-generated match reports.

Everything else is a post-MVP enhancement.

---

# Success Criteria

A successful MVP should make users say:

> "I want to draft another team and run another season."

Not:

> "The UI is nice."

Not:

> "The authentication works."

The core success metric is whether the drafting, team-building, and season simulation loop is engaging enough that users voluntarily start a second league immediately after finishing the first.
