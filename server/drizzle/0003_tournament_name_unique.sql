-- Pre-flight: refuse to create the unique index while colliding rows exist.
-- Names collide under the normalized key (case-folded, whitespace stripped);
-- deduping legacy rows is a human decision, so the migration fails loudly with
-- a full duplicate report (id + name + normalized) instead of silently
-- dropping or mutating data.
DO $$
DECLARE
  dup_report text := '';
  dup_row record;
BEGIN
  FOR dup_row IN
    SELECT t.id, t.name, lower(regexp_replace(t.name, '\s+', '', 'g')) AS normalized
    FROM tournaments t
    JOIN (
      SELECT lower(regexp_replace(name, '\s+', '', 'g')) AS normalized
      FROM tournaments
      GROUP BY lower(regexp_replace(name, '\s+', '', 'g'))
      HAVING COUNT(*) > 1
    ) d ON lower(regexp_replace(t.name, '\s+', '', 'g')) = d.normalized
    ORDER BY normalized, t.id
  LOOP
    dup_report := dup_report || format('id=%s name=%s normalized=%s; ', dup_row.id, dup_row.name, dup_row.normalized);
  END LOOP;

  IF dup_report <> '' THEN
    RAISE EXCEPTION 'Cannot create unique index on normalized tournament name -- duplicate rows found: %', dup_report;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tournaments_name_normalized_unique" ON "tournaments" USING btree (lower(regexp_replace("name", '\s+', '', 'g')));
