SELECT
    "Highlight"."id",
    "Highlight"."gamePk",
    "HighlightMeta"."id",
    "HighlightMeta"."shotType",
    "Playback"."url",
    "PlaybackType"."name"
FROM
    "Highlight"
    INNER JOIN "HighlightMeta" ON "Highlight"."id" = "HighlightMeta"."highlightId"
    INNER JOIN "Playback" ON "Highlight"."id" = "Playback"."highlightId"
    INNER JOIN "PlaybackType" ON "PlaybackType"."id" = "Playback"."playbackTypeId"
WHERE
    "HighlightMeta"."shotType" = 'NA';