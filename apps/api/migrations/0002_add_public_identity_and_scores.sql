ALTER TABLE visitors ADD COLUMN public_color_id TEXT;
ALTER TABLE visitors ADD COLUMN public_name_id TEXT;
ALTER TABLE visitors ADD COLUMN best_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE visitors ADD COLUMN public_identity_assigned_at TEXT;
ALTER TABLE visitors ADD COLUMN best_score_updated_at TEXT;

WITH indexed_visitors AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1 AS identity_index
  FROM visitors
  WHERE public_color_id IS NULL OR public_name_id IS NULL
)
UPDATE visitors
SET
  public_color_id = CASE identity_index % 30
    WHEN 0 THEN 'blue'
    WHEN 1 THEN 'green'
    WHEN 2 THEN 'purple'
    WHEN 3 THEN 'orange'
    WHEN 4 THEN 'cyan'
    WHEN 5 THEN 'silver'
    WHEN 6 THEN 'gold'
    WHEN 7 THEN 'crimson'
    WHEN 8 THEN 'violet'
    WHEN 9 THEN 'teal'
    WHEN 10 THEN 'amber'
    WHEN 11 THEN 'indigo'
    WHEN 12 THEN 'mint'
    WHEN 13 THEN 'rose'
    WHEN 14 THEN 'white'
    WHEN 15 THEN 'black'
    WHEN 16 THEN 'lime'
    WHEN 17 THEN 'pink'
    WHEN 18 THEN 'red'
    WHEN 19 THEN 'yellow'
    WHEN 20 THEN 'azure'
    WHEN 21 THEN 'jade'
    WHEN 22 THEN 'plum'
    WHEN 23 THEN 'coral'
    WHEN 24 THEN 'pearl'
    WHEN 25 THEN 'neon'
    WHEN 26 THEN 'ruby'
    WHEN 27 THEN 'sapphire'
    WHEN 28 THEN 'emerald'
    ELSE 'opal'
  END,
  public_name_id = 'nova-' || CASE CAST(identity_index / 30 AS INTEGER) % 15
    WHEN 0 THEN 'fox'
    WHEN 1 THEN 'wolf'
    WHEN 2 THEN 'raven'
    WHEN 3 THEN 'comet'
    WHEN 4 THEN 'falcon'
    WHEN 5 THEN 'lynx'
    WHEN 6 THEN 'pulse'
    WHEN 7 THEN 'viper'
    WHEN 8 THEN 'otter'
    WHEN 9 THEN 'nova'
    WHEN 10 THEN 'mantis'
    WHEN 11 THEN 'orion'
    WHEN 12 THEN 'kestrel'
    WHEN 13 THEN 'beacon'
    ELSE 'puma'
  END,
  public_identity_assigned_at = COALESCE(public_identity_assigned_at, created_at)
FROM indexed_visitors
WHERE visitors.id = indexed_visitors.id
  AND (visitors.public_color_id IS NULL OR visitors.public_name_id IS NULL);

CREATE INDEX visitors_best_score_idx ON visitors(best_score DESC, created_at ASC, id ASC);
CREATE INDEX visitors_public_identity_idx ON visitors(public_color_id, public_name_id);
