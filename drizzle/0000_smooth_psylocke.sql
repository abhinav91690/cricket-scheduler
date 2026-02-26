CREATE TABLE `divisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`tier` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `game_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`division_id` integer NOT NULL,
	`format` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer,
	`team_a_id` integer NOT NULL,
	`team_b_id` integer NOT NULL,
	`time_slot_id` integer,
	`stage` text NOT NULL,
	`knockout_round` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`team_a_score` integer,
	`team_b_score` integer,
	`winner_id` integer,
	`umpire_team_1_id` integer,
	`umpire_team_2_id` integer,
	`is_locked` integer DEFAULT false NOT NULL,
	`conflict_override` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`time_slot_id`) REFERENCES `time_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`umpire_team_1_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`umpire_team_2_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_conflicts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_a_id` integer NOT NULL,
	`team_b_id` integer NOT NULL,
	`level` text NOT NULL,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `time_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_day_id` integer NOT NULL,
	`ground_id` integer NOT NULL,
	`start_time` text NOT NULL,
	`slot_index` integer NOT NULL,
	FOREIGN KEY (`game_day_id`) REFERENCES `game_days`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ground_id`) REFERENCES `grounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`season` text NOT NULL,
	`leather_game_duration_min` integer DEFAULT 240 NOT NULL,
	`tape_ball_game_duration_min` integer DEFAULT 225 NOT NULL,
	`leather_qualifier_count` integer DEFAULT 8 NOT NULL,
	`tape_ball_qualifier_count` integer DEFAULT 6 NOT NULL
);
