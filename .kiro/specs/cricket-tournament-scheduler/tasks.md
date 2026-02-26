# Implementation Plan: Cricket Tournament Scheduler

## Overview

Build a full-stack Next.js application for managing and scheduling a multi-format cricket tournament. The implementation follows a bottom-up approach: database schema first, then pure-function scheduling engine, then CRUD server actions, then UI pages, and finally export/views. Each task builds on the previous, with no orphaned code.

## Tasks

- [x] 1. Project setup and database schema
  - [x] 1.1 Initialize Next.js project with Tailwind CSS, Drizzle ORM, and dependencies
    - Run `npx create-next-app@latest` with App Router, TypeScript, Tailwind CSS
    - Install dependencies: `drizzle-orm`, `better-sqlite3`, `@types/better-sqlite3`, `drizzle-kit`, `xlsx`, `vitest`, `fast-check`, `@vitejs/plugin-react`
    - Initialize shadcn/ui: `npx shadcn@latest init`
    - Add commonly needed shadcn components: button, input, select, table, dialog, card, badge, tabs, label, form, dropdown-menu, separator, calendar, popover
    - Create `src/lib/db/connection.ts` — SQLite connection via better-sqlite3
    - Create `drizzle.config.ts` pointing to local SQLite file
    - Create `vitest.config.ts` with path aliases matching tsconfig
    - _Requirements: N/A (project scaffolding)_

  - [x] 1.2 Define Drizzle ORM schema for all tables
    - Create `src/lib/db/schema.ts` with all tables exactly as specified in the design: `tournaments`, `divisions`, `groups`, `teams`, `teamConflicts`, `grounds`, `gameDays`, `timeSlots`, `matches`
    - Include all column types, defaults, foreign key references, and enums from the design data model
    - Ensure `teamConflicts` enforces canonical ordering (teamAId < teamBId) at the application level
    - Ensure `matches.conflictOverride` is a nullable text field for JSON
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 4.1, 5.1, 5.2, 5.3, 17.1, 17.2, 17.3, 17.5_

  - [x] 1.3 Generate and run initial migration
    - Run `npx drizzle-kit generate` to create migration SQL
    - Create a migration runner script or use `drizzle-kit push` for development
    - Verify all tables are created with correct columns and constraints
    - _Requirements: N/A (infrastructure)_

- [ ] 2. Scheduling engine — round-robin and slot scoring
  - [x] 2.1 Implement `generateRoundRobinPairings()` in `src/lib/scheduler/round-robin.ts`
    - Pure function: takes array of teams, returns array of `[Team, Team]` pairs
    - Validate input: reject if fewer than 2 teams
    - Generate all unique pairs using nested loop (i < j)
    - Export types: `TeamRef`, `Pairing`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Write property tests for round-robin pairing generation
    - **Property 1: Round-Robin Completeness** — for N teams (2 ≤ N ≤ 20), output has exactly N×(N−1)/2 pairings, every pair appears once, no self-pairings
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Test file: `src/lib/scheduler/__tests__/round-robin.property.test.ts`
    - Use fast-check to generate arbitrary team arrays of varying sizes

  - [x] 2.3 Implement slot scoring in `src/lib/scheduler/scoring.ts`
    - Pure function `scoreSlot()`: takes slot, match, teamDayCounts map, umpireCounts map, occupancy map
    - Penalize clumping: +10 per existing match for each playing team on that day
    - Penalize day load: +1 per existing match on that day
    - Return non-negative integer score (lower = better)
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 2.4 Write property test for slot scoring monotonicity
    - **Property 14: Slot Scoring Monotonicity** — score increases when team has more matches on that day, and when day has higher overall count
    - **Validates: Requirements 8.1, 8.2**
    - Test file: `src/lib/scheduler/__tests__/scoring.property.test.ts`

- [ ] 3. Scheduling engine — constraint solver and umpire assignment
  - [x] 3.1 Implement constraint helpers in `src/lib/scheduler/constraints.ts`
    - `isFormatCompatible(slot, match)` — ground format matches group format
    - `hasTeamConflictInSlot(slot, match, occupancy, conflicts)` — checks same_slot conflicts
    - `hasTeamConflictOnDay(day, match, occupancy, conflicts)` — checks same_day conflicts
    - `isTeamAvailable(slot, match, occupancy)` — team not double-booked
    - `buildOccupancyMap(existingMatches)` — slot → list of team IDs playing/umpiring
    - `sortByConstraintDifficulty(matches, conflicts)` — most-constrained first
    - _Requirements: 7.1, 7.2, 7.5, 4.3, 4.4_

  - [x] 3.2 Implement `selectUmpireTeam()` in `src/lib/scheduler/umpire.ts`
    - Filter candidates: not playing teams, not playing in slot, not umpiring in slot, no conflict with playing teams
    - Pick candidate with fewest umpire assignments
    - Return null if no valid candidate
    - For knockout matches, call twice to get two umpire teams
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 3.3 Write property tests for umpire eligibility and balance
    - **Property 8: Umpire Eligibility** — umpire team is in same division, not playing, not umpiring elsewhere in slot, no conflict with playing teams
    - **Property 9: Umpire Balance** — max minus min umpire count across division teams ≤ 1
    - **Validates: Requirements 9.1–9.6**
    - Test file: `src/lib/scheduler/__tests__/umpire.property.test.ts`

  - [x] 3.4 Implement `generateGroupSchedule()` in `src/lib/scheduler/group-schedule.ts`
    - Takes `ScheduleInput` (matches, slots, conflicts, existingSchedule)
    - Sort matches by constraint difficulty
    - Build occupancy, umpireCounts, teamDayCounts from existing schedule
    - For each match: filter compatible slots, filter by constraints, score remaining, pick best, assign umpire
    - Track unschedulable matches with reason strings
    - Return `ScheduleResult` { scheduled, unschedulable }
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3_

  - [ ]* 3.5 Write property tests for schedule generation
    - **Property 2: Schedule Partition** — scheduled ∪ unschedulable = input, intersection empty
    - **Property 3: Format-Ground Compatibility** — every scheduled match on correct format ground
    - **Property 4: No Team Double-Booking** — no team in two matches in same slot
    - **Property 5: Same-Slot Conflict Enforcement** — conflicting teams not in same slot
    - **Property 6: Same-Day Conflict Enforcement** — same_day conflicts not on same day
    - **Property 28: Unschedulable Matches Have Reasons** — every unschedulable match has non-empty reason
    - **Validates: Requirements 4.3, 4.4, 7.1, 7.2, 7.3, 7.4**
    - Test file: `src/lib/scheduler/__tests__/group-schedule.property.test.ts`

- [ ] 4. Checkpoint — Scheduling engine core
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Scheduling engine — knockout bracket and re-scheduling
  - [x] 5.1 Implement `generateKnockoutBracket()` in `src/lib/scheduler/knockout.ts`
    - Determine bracket size as next power of 2
    - Seed teams by group rank, arrange for cross-group matchups (tape ball)
    - Assign byes to top seeds
    - Create round 1 matchups, assign slots to non-bye matches using constraint logic
    - Assign 2 umpire teams per knockout match
    - Return `KnockoutResult` { bracket, scheduled }
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

  - [ ]* 5.2 Write property tests for knockout bracket
    - **Property 10: Knockout Bracket Size** — bracket size = smallest power of 2 ≥ N
    - **Property 11: Knockout Round Count** — ceil(log2(N)) rounds
    - **Property 12: Bye Assignment to Top Seeds** — byes go to top-seeded teams
    - **Property 13: Knockout Dual Umpires** — knockout matches have exactly 2 umpire teams
    - **Validates: Requirements 10.1, 10.2, 10.4, 9.8, 17.5**
    - Test file: `src/lib/scheduler/__tests__/knockout.property.test.ts`

  - [x] 5.3 Implement `reschedule()` in `src/lib/scheduler/reschedule.ts`
    - Filter out locked and played matches (preserve them)
    - Clear slot assignments for remaining matches
    - Re-run `generateGroupSchedule()` with locked/played as existing schedule
    - Return empty result with message if no eligible matches
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 5.4 Write property test for locked/played match preservation
    - **Property 7: Locked and Played Match Preservation** — locked/played matches unchanged after reschedule
    - **Validates: Requirements 7.6, 12.1, 12.2**
    - Test file: `src/lib/scheduler/__tests__/reschedule.property.test.ts`

- [ ] 6. Standings calculation and match operations
  - [x] 6.1 Implement `calculateStandings()` in `src/lib/scheduler/standings.ts`
    - Takes groupId, queries played matches
    - Calculate: played, won, lost, tied, points (win=2, tie=1, loss=0), net run rate
    - Sort by points desc, then NRR desc
    - Return array with promotion/relegation zone markers based on qualifier counts
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ]* 6.2 Write property tests for standings
    - **Property 21: Standings Sort Order** — sorted by points desc, then NRR desc
    - **Property 22: Standings Field Completeness** — won + lost + tied = played for each entry
    - **Validates: Requirements 14.1, 14.2**
    - Test file: `src/lib/scheduler/__tests__/standings.property.test.ts`

  - [x] 6.3 Implement `moveMatch()` in `src/lib/scheduler/match-ops.ts`
    - Reject if match is locked or played
    - Check new slot for conflicts (format, team availability, team conflicts)
    - If conflict and no override: return conflict description
    - If no conflict or override confirmed: move match, free old slot, record override reason
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 6.4 Write property tests for match operations
    - **Property 15: Locked and Played Matches Are Immovable** — move rejected for locked/played
    - **Property 16: Match Move Frees Old Slot** — successful move updates slot assignment
    - **Property 17: Conflict Override Recording** — overridden moves have non-null override reason
    - **Property 18: Lock Toggle Round-Trip** — toggling lock twice returns to original state
    - **Validates: Requirements 11.1, 11.3, 11.4, 11.5, 11.6**
    - Test file: `src/lib/scheduler/__tests__/match-ops.property.test.ts`

- [ ] 7. Checkpoint — Full scheduling engine
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Export module
  - [x] 8.1 Implement CSV and Excel export in `src/lib/export/export.ts`
    - `exportToCSV(matches, filters?)` — returns CSV string with headers: Date, Time, Ground, Team A, Team B, Umpire 1, Umpire 2, Status, Score
    - `exportToExcel(matches, filters?)` — returns Buffer using SheetJS (xlsx) with same columns
    - Apply filters before export (format, division, group, team)
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 8.2 Write property tests for export
    - **Property 19: Export Field Completeness** — every row has all required fields
    - **Property 20: Filter Correctness** — filtered result contains exactly the matches satisfying all filters
    - **Validates: Requirements 13.1, 13.2, 13.3, 16.3**
    - Test file: `src/lib/export/__tests__/export.property.test.ts`

- [ ] 9. Server actions — Tournament, Division, Group CRUD
  - [x] 9.1 Implement tournament CRUD server actions in `src/app/actions/tournament-actions.ts`
    - `createTournament(data)` — validate required fields, insert with defaults
    - `updateTournament(id, data)` — validate, update all fields
    - `deleteTournament(id)` — cascade delete all associated data (divisions, groups, teams, grounds, gameDays, timeSlots, matches)
    - Use Drizzle ORM parameterized queries throughout
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 17.3, 17.4_

  - [ ]* 9.2 Write property test for tournament edit round-trip and cascade deletion
    - **Property 30: Tournament Edit Round-Trip** — edit then read returns updated values
    - **Property 25: Cascade Deletion Integrity** — tournament deletion removes all associated records
    - **Validates: Requirements 1.3, 1.4, 3.4**
    - Test file: `src/app/actions/__tests__/tournament-actions.property.test.ts`

  - [x] 9.3 Implement division and group CRUD server actions in `src/app/actions/division-actions.ts`
    - `createDivision(data)` — validate tier 1–4, insert
    - `createGroup(data)` — validate format enum, insert
    - `updateDivision`, `updateGroup`, `deleteDivision`, `deleteGroup`
    - Reject tier outside 1–4 with validation error
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 9.4 Write property test for range validation
    - **Property 29: Range Validation** — division tier outside 1–4 rejected, slot index outside 0–2 rejected
    - **Validates: Requirements 2.3, 5.4**
    - Test file: `src/app/actions/__tests__/validation.property.test.ts`

- [ ] 10. Server actions — Team, Conflict, Ground, GameDay CRUD
  - [x] 10.1 Implement team CRUD server actions in `src/app/actions/team-actions.ts`
    - `createTeam(data)` — validate group reference, insert
    - `deleteTeam(id)` — check for scheduled matches, reject if any exist (return match list), otherwise delete team and associated conflicts
    - `updateTeam(id, data)` — validate, update
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 10.2 Write property test for team deletion rules
    - **Property 24: Team Deletion Blocked by Matches** — deletion rejected when team has matches
    - **Validates: Requirement 3.3**
    - Test file: `src/app/actions/__tests__/team-actions.property.test.ts`

  - [x] 10.3 Implement team conflict CRUD server actions in `src/app/actions/conflict-actions.ts`
    - `createConflict(data)` — enforce canonical ordering (teamAId < teamBId), validate teams in different groups, validate level enum
    - `updateConflictLevel(id, level)` — update conflict level
    - `deleteConflict(id)` — remove conflict
    - _Requirements: 4.1, 4.2, 4.5, 17.2_

  - [ ]* 10.4 Write property tests for conflict validation
    - **Property 23: Canonical Conflict Ordering** — stored conflicts always have teamAId < teamBId
    - **Property 27: Conflict Teams in Different Groups** — conflict teams must be in different groups
    - **Validates: Requirements 4.2, 17.2**
    - Test file: `src/app/actions/__tests__/conflict-actions.property.test.ts`

  - [x] 10.5 Implement ground, game day, and time slot CRUD server actions in `src/app/actions/ground-actions.ts`
    - `createGround(data)`, `createGameDay(data)`, `createTimeSlot(data)`
    - Validate slot index 0–2, format enum, date format
    - CRUD operations for all three entities
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 11. Server actions — Schedule generation and match operations
  - [x] 11.1 Implement schedule generation API route in `src/app/api/schedule/generate/route.ts`
    - POST handler: load all scheduling data from DB, call `generateGroupSchedule()`, insert scheduled matches, return counts and unschedulable list
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 11.2 Implement knockout generation API route in `src/app/api/schedule/generate-knockout/route.ts`
    - POST handler: load standings, verify all group matches played (block if pending), call `generateKnockoutBracket()`, insert matches, return bracket
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 11.3 Implement re-schedule API route in `src/app/api/schedule/reschedule/route.ts`
    - POST handler: call `reschedule()`, update matches in DB
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 11.4 Implement match operation server actions in `src/app/actions/match-actions.ts`
    - `moveMatch(matchId, newSlotId, overrideConflict?)` — delegates to scheduler `moveMatch()`, persists result
    - `toggleLock(matchId)` — toggle `isLocked` on unplayed match
    - `enterResult(matchId, teamAScore, teamBScore, winnerId)` — set scores, winner, status to "played"
    - Validate: teamAId ≠ teamBId on any match creation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 17.1_

  - [ ]* 11.5 Write property test for match team validation
    - **Property 26: Match Teams Differ** — teamAId ≠ teamBId for every match
    - **Validates: Requirement 17.1**
    - Test file: `src/app/actions/__tests__/match-actions.property.test.ts`

- [ ] 12. Checkpoint — All server actions and API routes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Export API route
  - [x] 13.1 Implement export API routes in `src/app/api/export/route.ts`
    - GET handler with query params: `format` (csv/excel), plus optional filters (format, division, group, team)
    - Call `exportToCSV()` or `exportToExcel()` from export module
    - Return appropriate content-type headers and file download response
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 14. UI — Layout, navigation, and tournament pages
  - [x] 14.1 Create app layout and navigation in `src/app/layout.tsx` and `src/components/nav.tsx`
    - Root layout with Tailwind, sidebar or top nav with links: Tournaments, Schedule, Standings, Knockout, Umpires, Export
    - Tournament list page at `src/app/page.tsx` (or `src/app/tournaments/page.tsx`)
    - _Requirements: N/A (UI scaffolding)_

  - [x] 14.2 Create tournament CRUD pages
    - `src/app/tournaments/page.tsx` — list all tournaments with create button
    - `src/app/tournaments/new/page.tsx` — create form with all fields and defaults
    - `src/app/tournaments/[id]/page.tsx` — tournament detail with edit/delete, links to divisions
    - Wire forms to server actions from task 9.1
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 14.3 Create division and group management pages
    - `src/app/tournaments/[id]/divisions/page.tsx` — list divisions, create/edit/delete
    - `src/app/tournaments/[id]/divisions/[divId]/groups/page.tsx` — list groups in division, create/edit/delete
    - Validate tier 1–4 in form, format enum in group form
    - Wire to server actions from task 9.3
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 15. UI — Team, conflict, ground, and game day pages
  - [x] 15.1 Create team management pages
    - `src/app/tournaments/[id]/divisions/[divId]/groups/[groupId]/teams/page.tsx` — list teams, register new, edit, delete
    - Show error with affected matches when deletion blocked
    - Wire to server actions from task 10.1
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 15.2 Create team conflict management page
    - `src/app/tournaments/[id]/conflicts/page.tsx` — list conflicts, create new (select two teams from different groups), edit level, delete
    - Enforce canonical ordering in UI (auto-swap if needed)
    - Wire to server actions from task 10.3
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 15.3 Create ground and game day management pages
    - `src/app/tournaments/[id]/grounds/page.tsx` — list grounds, create/edit/delete with format selector
    - `src/app/tournaments/[id]/game-days/page.tsx` — list game days, create/edit/delete with date picker
    - Time slot management within game day detail: create slots with ground selector, start time, slot index (0–2 validated)
    - Wire to server actions from task 10.5
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 16. UI — Schedule calendar view and match detail
  - [x] 16.1 Create schedule calendar view at `src/app/tournaments/[id]/schedule/page.tsx`
    - Calendar layout organized by game day, showing matches in time slots
    - Filter controls: format, division, group, team (using shadcn select/combobox)
    - Each match card shows: teams, ground, time, umpire, status
    - Trigger buttons for: generate schedule, re-schedule, export
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 16.2 Create match detail dialog/panel
    - Click a match in calendar to open detail view
    - Show full match info: teams, slot, ground, umpire(s), status, scores, lock state, conflict override
    - Actions: move match (slot picker), toggle lock, enter result, override conflict
    - Wire to server actions from task 11.4
    - _Requirements: 16.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 17. UI — Standings, knockout bracket, and umpire overview
  - [x] 17.1 Create group standings page at `src/app/tournaments/[id]/standings/page.tsx`
    - Table per group showing: team, P, W, L, T, Pts, NRR
    - Sorted by points desc, NRR desc
    - Visual distinction for promotion zone (top N, green/highlight) and relegation zone (bottom M, red/highlight)
    - Show all zeros when no matches played
    - Wire to `calculateStandings()` from task 6.1
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 17.2 Create visual knockout bracket page at `src/app/tournaments/[id]/knockout/page.tsx`
    - Render bracket as visual tree: rounds left-to-right, matches connected by lines
    - Show team names, scores for played matches, "BYE" labels
    - Advance winners visually to next round
    - Click match for detail (teams, scores, date, time, ground)
    - Trigger button for knockout generation (blocked if group matches pending)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 10.5_

  - [x] 17.3 Create umpire overview page at `src/app/tournaments/[id]/umpires/page.tsx`
    - Table showing each team's umpire assignment count per division
    - Highlight imbalances (difference > 1)
    - List of upcoming umpire duties per team
    - _Requirements: 9.6 (visibility into umpire balance)_

- [ ] 18. Checkpoint — Full UI
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Integration tests
  - [ ]* 19.1 Write integration test for full tournament workflow
    - Test file: `src/__tests__/integration/full-workflow.test.ts`
    - Use in-memory SQLite database
    - Create tournament → add divisions/groups/teams → add grounds/game days/time slots → generate schedule → verify constraints → enter results → generate knockout → verify bracket
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 6.1, 7.1, 10.1, 14.1_

  - [ ]* 19.2 Write integration test for re-scheduling
    - Test file: `src/__tests__/integration/reschedule.test.ts`
    - Generate schedule → lock some matches → re-schedule → verify locked matches unchanged, others re-assigned
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 19.3 Write integration test for export
    - Test file: `src/__tests__/integration/export.test.ts`
    - Generate schedule → export CSV → parse and verify all fields present → export Excel → verify buffer is valid
    - Apply filters and verify filtered output
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 20. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The scheduling engine (tasks 2–7) is pure functions with no DB dependency, making it easy to test in isolation
- Server actions (tasks 9–11) wire the engine to the database
- UI tasks (14–17) build on server actions — no orphaned code
- TypeScript is used throughout (design specifies TypeScript interfaces and implementations)
