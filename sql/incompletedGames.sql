SELECT
    *
FROM
    "Game"
WHERE
    "statusCode" = 7
    AND (
        "boxscoresFetched" = FALSE
        OR "linescoresFetched" = FALSE
        OR "highlightsFetched" = FALSE
        OR "highlightMetaFetched" = FALSE
        OR "playbacksFetched" = FALSE
    );