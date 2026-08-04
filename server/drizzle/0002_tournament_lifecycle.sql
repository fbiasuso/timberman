ALTER TABLE "tournaments" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "finished_at" timestamp;--> statement-breakpoint
UPDATE "tournaments" SET "status" = 'active' WHERE "is_active" = true;--> statement-breakpoint
UPDATE "tournaments" SET "status" = 'archived' WHERE "is_active" = false;--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "is_active";--> statement-breakpoint
CREATE TABLE "tournament_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tournament_id" integer NOT NULL,
	"match_date_id" integer NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "tournament_winners" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"user_id" uuid NOT NULL
);--> statement-breakpoint
ALTER TABLE "tournament_points" ADD CONSTRAINT "tournament_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_points" ADD CONSTRAINT "tournament_points_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_points" ADD CONSTRAINT "tournament_points_match_date_id_match_dates_id_fk" FOREIGN KEY ("match_date_id") REFERENCES "public"."match_dates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_winners" ADD CONSTRAINT "tournament_winners_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_winners" ADD CONSTRAINT "tournament_winners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tournament_points_tournament_date_user" ON "tournament_points" USING btree ("tournament_id","match_date_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_points_tournament_user" ON "tournament_points" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tournament_winners_tournament_user" ON "tournament_winners" USING btree ("tournament_id","user_id");
