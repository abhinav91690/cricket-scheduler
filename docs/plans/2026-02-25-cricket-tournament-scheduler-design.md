# Cricket Tournament Scheduler — Design Document

**Goal:** A web app to manage and schedule a multi-format cricket tournament with conflict detection, umpire assignments, and schedule export.

**Architecture:** Next.js full-stack app with SQLite database, featuring a configurable scheduling engine that handles round-robin group stages and single-elimination knockouts across two cricket formats.

**Tech Stack:** Next.js (App Router), Drizzle ORM, SQLite, Tailwind CSS, shadcn/ui, SheetJS (xlsx)

---

## 1. Data Model

### Tournament
- Name, season/year
- Configurable settings: qualifier counts per format, game durations (leather: 4hrs, tape ball: 3:45)

### Division
- Tier 1-4, belongs to a tournament
- Completely independent — no cross-division play
- Used for promotion/relegation based on group stage standings

### Format
- Leather ball or tape ball
- Determines ground assignment, game duration, and group structure

### Group
- Belongs to a division + format
- Leather ball: configurable (default 1 group of 13 teams per division)
- Tape ball: configurable (default 2 groups of 10 teams per division)
- Round-robin within each group

### Team
- Name, belongs to a group (and therefore a format + division)
- A registration in a specific format/division/group
- Same real-world players may register as different team names in different formats

### TeamConflict
- Explicit many-to-many link between team records that share players
- Manually managed in the UI
- Conflict level per pair:
  - **same_slot** — linked teams can't play in the same time slot (same day is OK)
  - **same_day** — linked teams can't play on the same day at all
- Can be overridden per specific match after schedule generation

### Ground
- Name + format type
- Configurable (default: 4 leather ball, 4 tape ball)

### GameDay
- A weekend date with manually configured time slots (2 or 3 per ground)
- Each slot has a start time

### Match
- Two teams, assigned to a ground, game day, and time slot
- Stage: group or knockout
- Result fields, status (scheduled/played/cancelled)
- 1 umpire team assignment (group stage) or 2 umpire teams (knockout)
- Lock flag (prevents re-scheduling on re-runs)
- Optional per-match conflict override

---

## 2. Scheduling Engine

### Phase 1: Group Stage

1. **Generate matchups** — all round-robin pairings for every group automatically (N×(N-1)/2 matches per group)

2. **Assign to slots** with constraints:
   - Ground matches the format
   - Neither team is already playing in that slot
   - TeamConflict enforcement at configured level (same_slot or same_day) per conflict pair
   - Umpire team not playing or umpiring in that slot, no TeamConflict overlap
   - Umpire assignments distributed as evenly as possible across division teams
   - **Even spread** — each team's matches distributed uniformly across available game days (not clumped)

3. **Unschedulable matches** reported for manual resolution

### Phase 2: Knockout

- Triggered after group stage results are entered
- Top N qualifiers (configurable) from each group
- Leather ball: top 8 from the single group → single-elimination bracket
- Tape ball: top 6 from each group merge into one 12-team bracket
- Byes for top seeds when count isn't a power of 2
- Same slot-assignment logic as group stage
- 2 umpire teams per knockout match

### Manual Override

After schedule generation:
- Move a specific match to a different slot/day
- Override a conflict for a specific match
- Lock a match in place
- Re-run scheduler on all non-locked, non-played matches to resolve new conflicts

---

## 3. Web App — Pages & UI

### Admin/Setup Pages
- **Tournament setup** — create/edit tournament, configure qualifier counts, game durations
- **Divisions** — manage tiers 1-4
- **Teams** — add/edit/delete teams, assign to format + division + group
- **Team Conflicts** — manage conflict links, set conflict level (same_slot/same_day) per pair
- **Grounds** — manage grounds, assign format
- **Game Days** — add weekend dates, configure 2 or 3 time slots per ground

### Schedule Pages
- **Schedule Generator** — trigger generation, view progress, see unschedulable matches
- **Schedule View** — master calendar across all grounds/days. Filter by format, division, group, team. Shows umpire assignments.
- **Match Detail** — view/edit match. Move to different slot, override conflicts, lock in place, enter results.
- **Umpire Overview** — umpire assignment counts per team for even distribution verification
- **Export** — CSV and Excel export of full or filtered schedule (date, time, ground, teams, umpires, status)

### Standings & Knockout
- **Group Standings** — auto-calculated from results. Points table per group. Promotion/relegation zones.
- **Knockout Bracket** — visual bracket view. Generated from qualifiers after group stage.

No auth — single-user admin tool.

---

## 4. Tech Stack & Architecture

### Framework
- Next.js (App Router) — single project for frontend and API

### Database
- SQLite via Drizzle ORM — type-safe queries, easy migrations, local file

### UI
- React + Tailwind CSS + shadcn/ui components

### Export
- SheetJS (xlsx) for Excel, CSV fallback

### Project Structure
```
src/
  app/                    # Next.js pages (App Router)
    page.tsx              # Dashboard/home
    tournaments/          # Tournament CRUD
    teams/                # Team management
    conflicts/            # Team conflict mappings
    grounds/              # Ground management
    game-days/            # Game day + slot config
    schedule/             # Schedule view, generator, export
    standings/            # Group standings
    knockout/             # Knockout bracket
    api/                  # API routes
  lib/
    db/                   # Drizzle schema, migrations, connection
    scheduler/            # Core scheduling engine
    export/               # CSV/Excel export logic
  components/             # Shared UI components
```

### Key Decisions
- Server Actions for form submissions (CRUD)
- API routes for scheduler (long-running) and export (file download)
- Scheduling engine is a pure function — easy to test independently
