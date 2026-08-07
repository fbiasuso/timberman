-- Pre-flight: refuse to create the unique index while colliding rows exist.
-- Usernames collide under the normalized key (case-folded only — whitespace is
-- intentionally NOT stripped); deduping legacy rows is a human decision, so the
-- migration fails loudly with a full duplicate report (id + username +
-- normalized) instead of silently dropping or mutating data.
DO $$
DECLARE
  dup_report text := '';
  dup_row record;
BEGIN
  FOR dup_row IN
    SELECT u.id, u.username, lower(u.username) AS normalized
    FROM users u
    JOIN (
      SELECT lower(username) AS normalized
      FROM users
      GROUP BY lower(username)
      HAVING COUNT(*) > 1
    ) d ON lower(u.username) = d.normalized
    ORDER BY normalized, u.id
  LOOP
    dup_report := dup_report || format('id=%s username=%s normalized=%s; ', dup_row.id, dup_row.username, dup_row.normalized);
  END LOOP;

  IF dup_report <> '' THEN
    RAISE EXCEPTION 'Cannot create unique index on normalized username -- duplicate rows found: %', dup_report;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username_normalized_unique" ON "users" USING btree (lower("username"));
