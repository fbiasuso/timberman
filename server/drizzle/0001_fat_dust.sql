CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"allow_registration" boolean DEFAULT true NOT NULL,
	"default_bet_amount" integer DEFAULT 1500 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_dates" ADD COLUMN "commission" numeric(5, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "prize_won" integer;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "carryover" integer DEFAULT 0 NOT NULL;