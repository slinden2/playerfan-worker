SELECT
    "Highlight"."gamePk",
    "PlaybackType"."name",
    "Playback"."url"
FROM
    "Highlight"
    INNER JOIN "Playback" ON "Highlight"."id" = "Playback"."highlightId"
    INNER JOIN "PlaybackType" ON "Playback"."playbackTypeId" = "PlaybackType"."id"
WHERE
    "Highlight"."gamePk" = 2019020001;