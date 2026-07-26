WITH event_scores AS (
  SELECT
    visitor_id,
    json_extract(payload, '$.best_score') AS score
  FROM events
  WHERE type = 'game.game_over'
    AND json_valid(payload)
    AND json_type(payload, '$.best_score') IN ('integer', 'real')
  UNION ALL
  SELECT
    visitor_id,
    json_extract(payload, '$.final_score') AS score
  FROM events
  WHERE type = 'game.game_over'
    AND json_valid(payload)
    AND json_type(payload, '$.final_score') IN ('integer', 'real')
), restored_scores AS (
  SELECT visitor_id, MAX(score) AS best_score
  FROM event_scores
  WHERE score = CAST(score AS INTEGER) AND score BETWEEN 0 AND 1000000
  GROUP BY visitor_id
)
UPDATE visitors
SET
  best_score = MAX(visitors.best_score, restored_scores.best_score),
  best_score_updated_at = CASE
    WHEN restored_scores.best_score > visitors.best_score THEN CURRENT_TIMESTAMP
    ELSE visitors.best_score_updated_at
  END
FROM restored_scores
WHERE visitors.id = restored_scores.visitor_id
  AND restored_scores.best_score > visitors.best_score;
