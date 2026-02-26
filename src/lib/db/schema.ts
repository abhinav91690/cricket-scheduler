import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  season: text("season").notNull(),
  leatherGameDurationMin: integer("leather_game_duration_min").notNull().default(240),
  tapeBallGameDurationMin: integer("tape_ball_game_duration_min").notNull().default(225),
  leatherQualifierCount: integer("leather_qualifier_count").notNull().default(8),
  tapeBallQualifierCount: integer("tape_ball_qualifier_count").notNull().default(6),
})

export const divisions = sqliteTable("divisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  tier: integer("tier").notNull(),
  name: text("name").notNull(),
})

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  divisionId: integer("division_id").notNull().references(() => divisions.id),
  format: text("format", { enum: ["leather", "tape_ball"] }).notNull(),
  name: text("name").notNull(),
})

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  name: text("name").notNull(),
})

export const teamConflicts = sqliteTable("team_conflicts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamAId: integer("team_a_id").notNull().references(() => teams.id),
  teamBId: integer("team_b_id").notNull().references(() => teams.id),
  level: text("level", { enum: ["same_slot", "same_day"] }).notNull(),
})

export const teamBlackoutDates = sqliteTable("team_blackout_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id),
  date: text("date").notNull(),
})


export const grounds = sqliteTable("grounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  name: text("name").notNull(),
  format: text("format", { enum: ["leather", "tape_ball"] }).notNull(),
})

export const gameDays = sqliteTable("game_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  date: text("date").notNull(),
})

export const timeSlots = sqliteTable("time_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameDayId: integer("game_day_id").notNull().references(() => gameDays.id),
  groundId: integer("ground_id").notNull().references(() => grounds.id),
  startTime: text("start_time").notNull(),
  slotIndex: integer("slot_index").notNull(),
})

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").references(() => groups.id),
  teamAId: integer("team_a_id").notNull().references(() => teams.id),
  teamBId: integer("team_b_id").notNull().references(() => teams.id),
  timeSlotId: integer("time_slot_id").references(() => timeSlots.id),
  stage: text("stage", { enum: ["group", "knockout"] }).notNull(),
  knockoutRound: integer("knockout_round"),
  status: text("status", { enum: ["scheduled", "played", "cancelled"] }).notNull().default("scheduled"),
  teamAScore: integer("team_a_score"),
  teamBScore: integer("team_b_score"),
  winnerId: integer("winner_id").references(() => teams.id),
  umpireTeam1Id: integer("umpire_team_1_id").references(() => teams.id),
  umpireTeam2Id: integer("umpire_team_2_id").references(() => teams.id),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  conflictOverride: text("conflict_override"),
})
