CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"format" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"league_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" text[],
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "local_team_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "visitor_team_id" integer;--> statement-breakpoint
ALTER TABLE "team_leagues" ADD CONSTRAINT "team_leagues_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_leagues" ADD CONSTRAINT "team_leagues_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_leagues_name_normalized_unique" ON "leagues" USING btree (lower(regexp_replace("name", '\s+', '', 'g')));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_team_leagues_team_league_unique" ON "team_leagues" USING btree ("team_id","league_id");--> statement-breakpoint
CREATE INDEX "idx_team_leagues_league" ON "team_leagues" USING btree ("league_id");--> statement-breakpoint
-- Pre-flight: refuse to create the unique index while colliding rows exist.
-- Team names collide under the normalized key (case-folded, whitespace
-- stripped); the table is new, so this is a defensive guard for any future
-- backfill — it fails loudly with a full duplicate report instead of silently
-- dropping or mutating data (mirrors 0003).
DO $$
DECLARE
  dup_report text := '';
  dup_row record;
BEGIN
  FOR dup_row IN
    SELECT t.id, t.name, lower(regexp_replace(t.name, '\s+', '', 'g')) AS normalized
    FROM teams t
    JOIN (
      SELECT lower(regexp_replace(name, '\s+', '', 'g')) AS normalized
      FROM teams
      GROUP BY lower(regexp_replace(name, '\s+', '', 'g'))
      HAVING COUNT(*) > 1
    ) d ON lower(regexp_replace(t.name, '\s+', '', 'g')) = d.normalized
    ORDER BY normalized, t.id
  LOOP
    dup_report := dup_report || format('id=%s name=%s normalized=%s; ', dup_row.id, dup_row.name, dup_row.normalized);
  END LOOP;

  IF dup_report <> '' THEN
    RAISE EXCEPTION 'Cannot create unique index on normalized team name -- duplicate rows found: %', dup_report;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_teams_name_normalized_unique" ON "teams" USING btree (lower(regexp_replace("name", '\s+', '', 'g')));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_local_team_id_teams_id_fk" FOREIGN KEY ("local_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_visitor_team_id_teams_id_fk" FOREIGN KEY ("visitor_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_matches_local_team" ON "matches" USING btree ("local_team_id");--> statement-breakpoint
CREATE INDEX "idx_matches_visitor_team" ON "matches" USING btree ("visitor_team_id");