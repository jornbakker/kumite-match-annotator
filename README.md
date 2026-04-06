# kumite-match-annotator
The kumite match annotator allows a user to annotate a video of a WKF kumite match and save the results to a database for further analysis.
A minimal app to annotate a karate kumite match for a specific player using either YouTube or an uploaded MP4.

## What it stores

- Annotator name
- Player name
- Opponent name
- Match name
- Match location
- Match date
- Selected player side (`ao` or `aka`)
- Ao player name
- Aka player name
- Video source type (`youtube` or `mp4`)
- Video source value (YouTube ID or uploaded MP4 URL)
- YouTube video ID (for compatibility with old records)
- Event timestamp (in seconds)
- Event type:
  - Score (`Yuko`, `Wasari`, `Ippon`)
  - Warning
  - Technique (no score)
- Event side (`ao` or `aka`)
- Technique for score events:
  - Also used when event type is `Technique (no score)`
  - `Kizami tsuki`
  - `Gyaku tsuki`
  - `Yoko geri`
  - `Mawashi geri`
  - `Ura mawashi geri`
  - `Ashi barai`
- Whether the defending player defended against the technique
- Whether event is **against** the selected player
- Event points (`Yuko=1`, `Wasari=2`, `Ippon=3`, warning `0`)
- Optional note
- Match totals:
  - Scores in favor
  - Scores against
  - Warnings
  - Points in favor
  - Points against

## Run locally

```bash
npm install
npm start
```

Then open:

- http://localhost:3000

## Streamlit dashboard

This repository also includes a Python Streamlit dashboard to inspect technique percentages by player.

It provides:
- Player selector loaded from the SQLite database
- Bar chart: techniques scored by selected player (x = technique, y = percentage)
- Bar chart: techniques scored against selected player (x = technique, y = percentage)

Run it with:

```bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
```

## How to use

1. Enter annotator name and choose **Register** (first time) or **Login**.
2. Choose **Video Source**:
  - `YouTube`: paste a YouTube URL and click **Load Video**.
  - `MP4 upload`: choose an MP4 file and click **Load Video**.
3. Fill in match name, location, date, and opponent name.
4. Create/select a player.
5. Set **Selected player side** and fill both **Ao player name** and **Aka player name**.
6. Use the side-by-side panes:
  - Left pane for **Ao** events.
  - Right pane for **Aka** events.
  - Both panes include score/warning/no-score technique options and a defense checkbox.
7. Pause/play the video and add events from either pane at the current timestamp.
8. Click **Save Match Results to Database**.
9. Use **Saved Matches** to browse all saved matches for the selected player and click **Select Match** to load one back into the editor.

## Data storage

- SQLite database file: `data.sqlite3`
- Tables:
  - `annotators`
  - `players`
  - `matches`
  - `match_events`
