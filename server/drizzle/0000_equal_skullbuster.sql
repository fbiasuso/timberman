CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"amount" integer,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer,
	"date_number" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"pozo" integer DEFAULT 0 NOT NULL,
	"bet_amount" integer DEFAULT 1500 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_date_id" integer NOT NULL,
	"local_team" text NOT NULL,
	"visitor_team" text NOT NULL,
	"local_img" text,
	"visitor_img" text,
	"scheduled_at" timestamp,
	"result" text,
	"score" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"prediction" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"match_date_id" integer NOT NULL,
	"bet_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"commission" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_dates" ADD CONSTRAINT "match_dates_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_match_date_id_match_dates_id_fk" FOREIGN KEY ("match_date_id") REFERENCES "public"."match_dates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_predictions" ADD CONSTRAINT "ticket_predictions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_predictions" ADD CONSTRAINT "ticket_predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_match_date_id_match_dates_id_fk" FOREIGN KEY ("match_date_id") REFERENCES "public"."match_dates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_admin" ON "audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_match_dates_tournament" ON "match_dates" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "idx_matches_date" ON "matches" USING btree ("match_date_id");--> statement-breakpoint
CREATE INDEX "idx_predictions_ticket" ON "ticket_predictions" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_user_date" ON "tickets" USING btree ("user_id","match_date_id");