# Requirements Document

## Introduction

This document defines the requirements for the Cricket Tournament Scheduler — a single-user admin web application for managing and scheduling a multi-format cricket tournament. The system handles two cricket formats (leather ball and tape ball) across four division tiers, with configurable group structures, round-robin group stages, single-elimination knockout brackets, and a constraint-based scheduling engine. Requirements are derived from the approved design document.

## Glossary

- **Tournament**: The top-level entity representing a cricket season with configurable game durations and qualifier counts per format.
- **Division**: A tier (1–4) within a tournament, representing a competitive level.
- **Format**: The cricket ball type used — either "leather" or "tape_ball".
- **Group**: A collection of teams within a division and format that play a round-robin group stage together.
- **Team**: A registration of a club in a specific group. A club may register separate teams in different formats/divisions/groups, each with an independent name.
- **TeamConflict**: A many-to-many relationship between two teams (in different groups) indicating shared players, with a configurable conflict level of "same_slot" or "same_day".
- **Ground**: A venue assigned to a specific format where matches are played.
- **GameDay**: A calendar date on which matches may be scheduled.
- **TimeSlot**: A specific start time on a specific ground on a specific game day, identified by a slot index (0, 1, or 2).
- **Match**: A scheduled or unscheduled contest between two teams, belonging to either the group or knockout stage.
- **Scheduling_Engine**: The pure-function constraint solver that generates match schedules.
- **Export_Module**: The component that generates CSV and Excel files from schedule data.
- **Admin_UI**: The Next.js web interface through which the administrator manages all tournament data.
- **Umpire_Team**: A team from the same division assigned to officiate a match (not one of the playing teams).
- **Knockout_Bracket**: A single-elimination bracket generated from group stage qualifiers.
- **Standing**: A team's ranking within its group based on points and net run rate.
- **Occupancy_Map**: An internal data structure tracking which teams are playing or umpiring in each time slot.

## Requirements

### Requirement 1: Tournament Configuration Management

**User Story:** As an administrator, I want to create and configure tournaments with format-specific settings, so that I can set up the structure for a cricket season.

#### Acceptance Criteria

1. WHEN an administrator creates a tournament, THE Admin_UI SHALL require a name, season, leather game duration (minutes), tape ball game duration (minutes), leather qualifier count, and tape ball qualifier count.
2. WHEN a tournament is created with default values, THE Admin_UI SHALL set leather game duration to 240 minutes, tape ball game duration to 225 minutes, leather qualifier count to 8, and tape ball qualifier count to 6.
3. WHEN an administrator edits a tournament, THE Admin_UI SHALL allow modification of all tournament fields and persist changes to the database.
4. WHEN an administrator deletes a tournament, THE Admin_UI SHALL remove the tournament and all associated divisions, groups, teams, grounds, game days, time slots, and matches.

### Requirement 2: Division and Group Management

**User Story:** As an administrator, I want to organize teams into divisions and groups by format, so that I can structure the tournament into competitive tiers and round-robin pools.

#### Acceptance Criteria

1. WHEN an administrator creates a division, THE Admin_UI SHALL require a tournament reference, a tier (integer 1–4), and a name.
2. WHEN an administrator creates a group, THE Admin_UI SHALL require a division reference, a format ("leather" or "tape_ball"), and a name.
3. WHEN an administrator attempts to set a division tier outside the range 1–4, THE Admin_UI SHALL reject the input and display a validation error.
4. THE Admin_UI SHALL allow an administrator to create, edit, and delete divisions and groups within a tournament.

### Requirement 3: Team Registration

**User Story:** As an administrator, I want to register teams into specific groups, so that each team is placed in the correct format, division, and round-robin pool.

#### Acceptance Criteria

1. WHEN an administrator registers a team, THE Admin_UI SHALL require a group reference and a team name.
2. THE Admin_UI SHALL allow the same club to register independent teams in different groups, each with its own name.
3. WHEN an administrator attempts to delete a team that has scheduled matches, THE Admin_UI SHALL reject the deletion and display the list of affected matches.
4. WHEN an administrator deletes a team with no scheduled matches, THE Admin_UI SHALL remove the team and all associated team conflicts.

### Requirement 4: Team Conflict Configuration

**User Story:** As an administrator, I want to define conflicts between teams that share players across formats, so that the scheduler avoids scheduling those teams at the same time or on the same day.

#### Acceptance Criteria

1. WHEN an administrator creates a team conflict, THE Admin_UI SHALL require two team references and a conflict level ("same_slot" or "same_day").
2. THE Admin_UI SHALL enforce canonical ordering (teamAId < teamBId) to prevent duplicate conflict entries.
3. WHEN a team conflict has level "same_slot", THE Scheduling_Engine SHALL prevent the two teams from playing in the same time slot.
4. WHEN a team conflict has level "same_day", THE Scheduling_Engine SHALL prevent the two teams from playing on the same game day.
5. THE Admin_UI SHALL allow an administrator to edit the conflict level of an existing team conflict.

### Requirement 5: Ground and Game Day Management

**User Story:** As an administrator, I want to configure grounds with format assignments and define game days with time slots, so that the scheduler knows where and when matches can be played.

#### Acceptance Criteria

1. WHEN an administrator creates a ground, THE Admin_UI SHALL require a tournament reference, a name, and a format ("leather" or "tape_ball").
2. WHEN an administrator creates a game day, THE Admin_UI SHALL require a tournament reference and a date in ISO format (YYYY-MM-DD).
3. WHEN an administrator creates a time slot, THE Admin_UI SHALL require a game day reference, a ground reference, a start time (HH:MM), and a slot index (0, 1, or 2).
4. WHEN an administrator attempts to set a slot index outside the range 0–2, THE Admin_UI SHALL reject the input and display a validation error.
5. THE Admin_UI SHALL allow an administrator to create, edit, and delete grounds, game days, and time slots.

### Requirement 6: Round-Robin Pairing Generation

**User Story:** As an administrator, I want the system to generate all round-robin pairings for each group, so that every team plays every other team in its group exactly once.

#### Acceptance Criteria

1. WHEN the Scheduling_Engine generates round-robin pairings for a group of N teams, THE Scheduling_Engine SHALL produce exactly N×(N−1)/2 unique match pairings.
2. THE Scheduling_Engine SHALL ensure every pair of teams in the group appears exactly once in the generated pairings.
3. THE Scheduling_Engine SHALL ensure no team is paired with itself.
4. WHEN a group contains fewer than 2 teams, THE Scheduling_Engine SHALL reject the generation request and return an error.

### Requirement 7: Constraint-Based Schedule Generation

**User Story:** As an administrator, I want the scheduling engine to assign matches to time slots while respecting all constraints, so that the generated schedule is valid and fair.

#### Acceptance Criteria

1. WHEN the Scheduling_Engine assigns matches to time slots, THE Scheduling_Engine SHALL only assign a match to a ground that matches the group's format.
2. WHEN the Scheduling_Engine assigns matches to time slots, THE Scheduling_Engine SHALL ensure no team appears in two matches in the same time slot.
3. WHEN the Scheduling_Engine cannot find a valid slot for a match, THE Scheduling_Engine SHALL add the match to the unschedulable list with a reason describing which constraints failed.
4. WHEN schedule generation completes, THE Scheduling_Engine SHALL account for every input match in either the scheduled list or the unschedulable list, with no match in both.
5. THE Scheduling_Engine SHALL sort matches by constraint difficulty (teams with most conflicts first) before assigning slots, to maximize the number of successfully scheduled matches.
6. THE Scheduling_Engine SHALL respect all locked and played matches in the existing schedule without modifying them.

### Requirement 8: Even Match Distribution

**User Story:** As an administrator, I want matches spread evenly across the season, so that no team is overloaded on a single game day.

#### Acceptance Criteria

1. WHEN scoring candidate time slots, THE Scheduling_Engine SHALL penalize slots on game days where either playing team already has matches scheduled.
2. WHEN scoring candidate time slots, THE Scheduling_Engine SHALL penalize slots on game days with a high overall match count.
3. THE Scheduling_Engine SHALL select the candidate slot with the lowest penalty score for each match.

### Requirement 9: Umpire Team Assignment

**User Story:** As an administrator, I want umpire teams assigned automatically from the same division, balanced across teams, so that officiating duties are shared fairly.

#### Acceptance Criteria

1. WHEN the Scheduling_Engine assigns an umpire team to a group-stage match, THE Scheduling_Engine SHALL select one team from the same division as the playing teams.
2. THE Scheduling_Engine SHALL exclude the two playing teams from umpire candidacy for their own match.
3. THE Scheduling_Engine SHALL exclude any team that is already playing in the same time slot from umpire candidacy.
4. THE Scheduling_Engine SHALL exclude any team that is already umpiring in the same time slot from umpire candidacy.
5. THE Scheduling_Engine SHALL exclude any team that has a TeamConflict with either playing team from umpire candidacy for that slot.
6. WHEN multiple valid umpire candidates exist, THE Scheduling_Engine SHALL select the team with the fewest total umpire assignments.
7. WHEN no valid umpire candidate exists for a match, THE Scheduling_Engine SHALL return null for the umpire assignment.
8. WHEN the Scheduling_Engine assigns umpire teams to a knockout-stage match, THE Scheduling_Engine SHALL assign two umpire teams.

### Requirement 10: Knockout Bracket Generation

**User Story:** As an administrator, I want to generate a single-elimination knockout bracket from group stage qualifiers, so that the tournament progresses to a final winner.

#### Acceptance Criteria

1. WHEN generating a knockout bracket, THE Scheduling_Engine SHALL determine the bracket size as the smallest power of 2 greater than or equal to the number of qualifiers.
2. WHEN the number of qualifiers is not a power of 2, THE Scheduling_Engine SHALL assign byes to the top-seeded teams.
3. THE Scheduling_Engine SHALL seed teams by group rank, then arrange matchups to maximize cross-group pairings in round 1 (for tape ball format with multiple groups).
4. WHEN generating a knockout bracket for N qualifiers, THE Scheduling_Engine SHALL create ceil(log2(N)) rounds.
5. WHEN not all group-stage matches have been played, THE Admin_UI SHALL block knockout generation and display which matches are still pending.
6. THE Scheduling_Engine SHALL assign time slots to non-bye round 1 matches using the same constraint logic as group-stage scheduling.
7. WHEN a qualifier count is fewer than 2, THE Scheduling_Engine SHALL reject the generation request and return an error.

### Requirement 11: Manual Match Override

**User Story:** As an administrator, I want to manually move matches, override conflicts, and lock matches in place, so that I can handle edge cases the scheduler cannot resolve automatically.

#### Acceptance Criteria

1. WHEN an administrator moves a match to a new time slot with no conflicts, THE Admin_UI SHALL update the match assignment and free the old slot.
2. WHEN an administrator moves a match to a new time slot that causes a conflict, THE Admin_UI SHALL display the conflict description and offer an override option.
3. WHEN an administrator confirms a conflict override, THE Admin_UI SHALL move the match and record the override reason on the match record.
4. WHEN an administrator attempts to move a locked match, THE Admin_UI SHALL reject the move and display an error.
5. WHEN an administrator attempts to move a played match, THE Admin_UI SHALL reject the move and display an error.
6. THE Admin_UI SHALL allow an administrator to toggle the lock status of any unplayed match.
7. THE Admin_UI SHALL allow an administrator to enter match results (scores and winner) for played matches.

### Requirement 12: Re-Scheduling

**User Story:** As an administrator, I want to re-run the scheduler on unscheduled and unlocked matches after making manual changes, so that the remaining schedule is optimized.

#### Acceptance Criteria

1. WHEN an administrator triggers re-scheduling, THE Scheduling_Engine SHALL re-assign only non-locked, non-played matches.
2. WHEN an administrator triggers re-scheduling, THE Scheduling_Engine SHALL preserve all locked and played matches in their current slots.
3. WHEN all unplayed matches are locked, THE Scheduling_Engine SHALL return immediately with an empty result and a message indicating no matches were eligible.
4. THE Scheduling_Engine SHALL apply the same constraint logic and scoring during re-scheduling as during initial schedule generation.

### Requirement 13: Schedule Export

**User Story:** As an administrator, I want to export the schedule to CSV and Excel formats with optional filters, so that I can share the schedule with teams and stakeholders.

#### Acceptance Criteria

1. WHEN an administrator exports the schedule as CSV, THE Export_Module SHALL generate a valid CSV file containing date, time, ground, teams, umpire teams, and match status for each match.
2. WHEN an administrator exports the schedule as Excel, THE Export_Module SHALL generate a valid Excel file containing the same fields as the CSV export.
3. WHEN filters are applied (by format, division, group, or team), THE Export_Module SHALL include only matches that satisfy all active filters.
4. THE Admin_UI SHALL provide a download trigger for both CSV and Excel export formats.

### Requirement 14: Group Standings

**User Story:** As an administrator, I want to view group standings with promotion and relegation zones, so that I can track team performance and determine qualifiers.

#### Acceptance Criteria

1. WHEN calculating standings for a group, THE Admin_UI SHALL display each team's matches played, won, lost, tied, points, and net run rate.
2. THE Admin_UI SHALL sort standings by points descending, then by net run rate descending.
3. THE Admin_UI SHALL visually distinguish promotion zone teams (top N) and relegation zone teams (bottom M), where N and M are configurable.
4. WHEN no matches in a group have been played, THE Admin_UI SHALL display all teams with zero values.

### Requirement 15: Visual Knockout Bracket

**User Story:** As an administrator, I want to view the knockout bracket visually, so that I can see the progression from round 1 through the final.

#### Acceptance Criteria

1. THE Admin_UI SHALL render the knockout bracket as a visual tree showing all rounds from round 1 to the final.
2. WHEN a knockout match has been played, THE Admin_UI SHALL display the winner and advance the winner to the next round in the bracket.
3. WHEN a knockout match is a bye, THE Admin_UI SHALL display the advancing team and mark the match as a bye.
4. THE Admin_UI SHALL display match details (teams, scores, date, time, ground) when an administrator selects a knockout match.

### Requirement 16: Schedule Calendar View

**User Story:** As an administrator, I want to view the schedule on a calendar with filters, so that I can quickly find and manage matches.

#### Acceptance Criteria

1. THE Admin_UI SHALL display scheduled matches in a calendar layout organized by game day.
2. THE Admin_UI SHALL provide filters for format, division, group, and team.
3. WHEN filters are applied, THE Admin_UI SHALL display only matches that satisfy all active filters.
4. WHEN an administrator selects a match in the calendar, THE Admin_UI SHALL display match details and allow editing, conflict override, lock toggle, and result entry.

### Requirement 17: Data Validation

**User Story:** As an administrator, I want the system to validate all inputs, so that invalid data cannot corrupt the tournament structure.

#### Acceptance Criteria

1. THE Admin_UI SHALL ensure that a match's two teams are always different (teamAId ≠ teamBId).
2. THE Admin_UI SHALL ensure that team conflict pairs reference teams in different groups.
3. THE Admin_UI SHALL parameterize all database queries through Drizzle ORM to prevent SQL injection.
4. WHEN any Server Action receives invalid input types or constraint violations, THE Admin_UI SHALL return a descriptive validation error and reject the operation.
5. THE Admin_UI SHALL ensure that the second umpire team assignment is only set for knockout-stage matches.
