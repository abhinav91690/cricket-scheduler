# Cricket Tournament Scheduler

A multi-format cricket tournament management application that handles scheduling, standings, knockout brackets, and umpire assignments across leather ball and tape ball formats.

Built with Next.js 16, React 19, Drizzle ORM, SQLite, and Tailwind CSS v4.

## Getting Started

```bash
npm install
npm run db:push    # create/migrate the SQLite database
npm run dev        # start the dev server at http://localhost:3000
```

Run tests:

```bash
npm test           # single run
npm run test:watch # watch mode
```

## Data Model

The application uses a hierarchical structure:

```
Tournament
├── Division (tier-based, e.g. Division 1, Division 2)
│   └── Group (format-specific: leather or tape_ball)
│       └── Team
├── Ground (format-specific: leather or tape_ball)
└── Game Day
    └── Time Slot (bound to a specific ground + start time)
```

Each tournament has configurable game durations per format and qualifier counts for knockout stages. Teams belong to a single group, and groups belong to a single division. Grounds are format-specific — a leather ground only hosts leather matches.

### Key Entities

- **Tournaments** — top-level container with season, format durations, and qualifier counts
- **Divisions** — tier-based groupings (e.g. Tier 1, Tier 2)
- **Groups** — within a division, separated by format (leather / tape_ball)
- **Teams** — belong to exactly one group
- **Grounds** — physical venues, each assigned to one format
- **Game Days** — dates when matches can be played
- **Time Slots** — a specific ground + start time on a game day; each slot holds exactly one match
- **Matches** — group stage or knockout, with score tracking, umpire assignments, lock state, and conflict overrides
- **Team Conflicts** — pairwise constraints between teams at two levels: `same_slot` (can't play at the same time) or `same_day` (can't play on the same day)
- **Team Blackout Dates** — dates when a specific team is unavailable to play

## Scheduling Engine

The core scheduler lives in `src/lib/scheduler/` and is a pure-function pipeline with no database dependencies. All DB interaction happens in the API routes, which load data, call the scheduler, and persist results.

### Group Stage Scheduling

`generateGroupSchedule()` in `group-schedule.ts` takes a `ScheduleInput` and produces a `ScheduleResult`:

1. **Sort by constraint difficulty** — matches involving teams with more conflicts are scheduled first (most-constrained-first heuristic), reducing the chance of painting yourself into a corner.

2. **Filter candidate slots** — for each match, all time slots pass through a pipeline of constraint checks:
   - `isFormatCompatible` — slot's ground format must match the match format
   - `isSlotOccupied` — each slot holds exactly one match
   - `isTeamAvailable` — neither team is already playing/umpiring in this slot
   - `hasTeamConflictInSlot` — no `same_slot` conflict between match teams and teams already in the slot
   - `hasTeamConflictOnDay` — no `same_day` conflict between match teams and any team playing that day
   - `hasTeamPlayedThisWeekend` — each team plays at most once per weekend (Saturday + Sunday are grouped; weekdays are independent)
   - `isTeamBlackedOut` — neither team has a blackout on this date

3. **Score remaining candidates** — slots that pass all constraints are scored. Lower score = better. The scoring function (`scoreSlot`) applies weighted penalties:
   - **+10** per existing match for each team on that date (spreads games across the season)
   - **+8** per existing match for each team on that ground (distributes ground usage)
   - **+8** per existing match for each team at that start time (varies time-of-day)
   - **+1** per total match on that date (balances day load)

4. **Assign umpire** — `selectUmpireTeam()` picks the best umpire from eligible teams:
   - Must be the same format as the match (leather teams umpire leather, tape ball teams umpire tape ball)
   - Cannot be one of the playing teams
   - Cannot already be in the slot (playing or umpiring another match)
   - Cannot have a conflict with either playing team
   - Among eligible candidates, the team with the fewest umpire assignments is chosen (load balancing)

5. **Update tracking state** — occupancy maps, umpire counts, and fairness counters are updated after each assignment.

Matches that cannot be placed in any slot are returned in the `unschedulable` array with a reason string.

### Rescheduling

`reschedule()` in `reschedule.ts` handles re-generating the schedule while preserving locked and played matches:

1. Separates matches into preserved (locked or played) and eligible (everything else)
2. Builds an `existingSchedule` from preserved matches so the scheduler respects their slot assignments
3. Clears slot assignments from eligible matches and feeds them back through `generateGroupSchedule`

This means you can lock important matches in place, then regenerate the rest of the schedule around them.

### Round-Robin Pairing

`generateRoundRobinPairings()` generates all unique pairings for a group of teams. Every team plays every other team exactly once.

### Knockout Bracket

`generateKnockoutBracket()` in `knockout.ts` creates a single-elimination bracket:

1. Bracket size is the next power of 2 >= number of qualifiers
2. Teams are seeded by group rank and interleaved across groups for cross-group matchups
3. Top seeds receive byes (auto-advance)
4. Non-bye matches are scheduled into available slots using the same constraint and scoring system
5. Knockout matches get two umpire teams assigned (vs one for group stage)

### Standings

`calculateStandings()` computes group standings from played matches:

- Win = 2 points, Tie = 1 point, Loss = 0 points
- Net Run Rate = (total scored - total conceded) / matches played
- Sorted by points descending, then NRR descending

### Match Operations

`moveMatch()` validates whether a match can be moved to a different slot, checking lock status, played status, format compatibility, team availability, and conflicts. Moves can optionally override conflicts.

`toggleLock()` flips the lock state of a match (locked matches are preserved during rescheduling).

## Constraint System

All constraint functions are pure functions in `constraints.ts`, fully unit-tested:

| Constraint | What it prevents |
|---|---|
| Format compatibility | Leather match on tape ball ground (or vice versa) |
| Slot occupancy | Two matches in the same time slot |
| Team availability | A team playing two matches simultaneously |
| Same-slot conflict | Conflicting teams playing at the same time |
| Same-day conflict | Conflicting teams playing on the same day |
| Weekend limit | A team playing more than once per weekend (Sat+Sun grouped) |
| Team blackout | A team playing on a date they've marked as unavailable |
| Umpire format | A leather team umpiring a tape ball match (or vice versa) |

## Export

The schedule can be exported as CSV or Excel (.xlsx). Exports support filtering by format, division, group, or team. The export module uses the `xlsx` library.

Teams can be bulk imported/exported via Excel files through the Teams page.

## Project Structure

```
src/
├── app/
│   ├── actions/          # Server actions (CRUD for all entities)
│   ├── api/
│   │   ├── export/       # Schedule CSV/Excel export
│   │   ├── schedule/
│   │   │   ├── generate/         # Generate group schedule
│   │   │   ├── generate-knockout/ # Generate knockout bracket
│   │   │   └── reschedule/       # Reschedule unlocked matches
│   │   └── teams/
│   │       ├── export/   # Team Excel export
│   │       └── import/   # Team Excel import
│   └── tournaments/      # All tournament UI pages
│       └── [id]/
│           ├── conflicts/   # Team conflicts + blackout dates
│           ├── divisions/   # Division/group/team management
│           ├── game-days/   # Game day + time slot config
│           ├── grounds/     # Ground management
│           ├── import/      # Team bulk import/export
│           ├── knockout/    # Knockout bracket
│           ├── schedule/    # Full schedule view + actions
│           ├── standings/   # Group standings
│           └── umpires/     # Umpire assignment view
├── components/
│   ├── ui/               # Radix-based UI primitives
│   ├── match-detail-dialog.tsx
│   └── nav.tsx
└── lib/
    ├── db/
    │   ├── connection.ts  # SQLite + Drizzle setup (WAL mode)
    │   └── schema.ts      # All table definitions
    ├── export/
    │   └── export.ts      # CSV/Excel export logic
    └── scheduler/         # Pure scheduling engine
        ├── types.ts       # Shared types
        ├── constraints.ts # All constraint checks
        ├── scoring.ts     # Slot scoring/fairness
        ├── round-robin.ts # Round-robin pairing generation
        ├── group-schedule.ts # Main scheduling algorithm
        ├── reschedule.ts  # Reschedule with locked match support
        ├── knockout.ts    # Knockout bracket generation
        ├── standings.ts   # Standings calculation
        ├── umpire.ts      # Umpire team selection
        └── match-ops.ts   # Match move/lock operations
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4, Radix UI primitives
- **Database**: SQLite via better-sqlite3 (WAL mode, foreign keys enforced)
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Testing**: Vitest (157 tests across 10 test files)
- **Export**: xlsx library for Excel import/export

## Database Commands

```bash
npm run db:generate  # generate migration SQL from schema changes
npm run db:push      # push schema directly to SQLite (dev workflow)
```
