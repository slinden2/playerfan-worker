# playerfan-worker

This repository contains scripts for populating the database for Player Fan. The scripts fetch data from the NHL API and stores it in a PostgreSQL database. Furthermore, the repo will contain tools for maintaining the integrity of the database.

## Tool summary

### Daily scripts

All daily scripts apart from the runner script `fetchDate` and `fetchGames` have three modes that they can be used in to fetch data. The modes are:

- DATE
  - Used for fetching data for a certain date
  - `npm run <script_name> DATE 2020-01-01`
- GAMEPK
  - Used for fetching data for a certain gamePk
  - `npm run <script_name> GAMEPK 2020020001`
- FLAG
  - Every game record in DB has a flag (boolean) for every script that is needed to be run to fetch all data for the game (example: `boxscoresFetched`). `FLAG` parameter is used to fetch data for all games that have not been flagged `TRUE` in DB for the script to be run.
  - `npm run <script_name> FLAG`

The daily script are usually run by the script runner `fetchDate`, but if something goes wrong, some of the data can be refetched by using the script one-by-one.
The daily scripts are:

- fetchGames
  - This must be run always first, because the other scripts look for the game data in the database
  - `npm run fetchGames 2020-01-01`
- fetchLinescores
- fetchBoxscores
- fetchHighlights
- fetchHighlightMeta
- fetchPlaybacks

#### fetchDate

This is a script runner tool used to run all daily fetch scripts for a specific date/dates.

##### Usage

`npm run fetchDate SINGLE 2020-01-01`
`npm run fetchDate MULTI 2020-01-01 2020-01-31`
The dates are inclusive

### Seasonal scripts

#### fetchConferences

Fetches the conferences for the current season (remember to set SEASON in .env).

##### Usage

`npm run fetchConferences`

#### fetchDivisions

Fetches the divisions for the current season (remember to set SEASON in .env).
It is a good practise to save divisions for every season in a .json file, because it is not possibile to fetch division by season from the API, so there is no historical data available.

##### Usage

`npm run fetchDivisions`

#### fetchTeams

Fetches the teams for the current season (remember to set SEASON in .env).

##### Usage

Some manual work is required.
First check if there is new team data in the API and if there is add it to `genericTeamData.json`.
Then add the data for the current season in `conferenceTeamMap` in `fetchTeam`. When ready you can run the script.
`npm run fetchTeams`

## Manual DB tasks

Sometimes the data coming from the API is not perfect. There may be some fields missing and in that case the records are saved in the DB with a "NA" value. This is just something that I have defined myself. NA stands fro _not available_ in this case. Some examples fields are "Player"."primaryPosition" and "HighlightMeta"."shotType". Both of these fields may be sporadically not defined in the API and must be updated manually after the initial fetch.

### Maintenance scripts

#### resetGamesByDate

If something goes wrong in during the fetch of a certain date, with this script the database can be cleaned of all records made during the fetch. However, if any new `PlayerTeam` relations were created, those won't be touched.

##### Usage

`npm run resetGamesByDate 2020-01-01`

## TODO
