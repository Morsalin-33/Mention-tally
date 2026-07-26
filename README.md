Mention Tally

A quick tap-to-log tracker for counting occurrences—whether it's names, filler words, habits, jokes, or anything you want to monitor.

Created as a single-file React component, it's quick to use with no accounts or setup required.
Features

● One-tap logging — press a button instantly when it happens

● Multiple trackers — switch tabs for different people or items, each with its own colour and history

● Daily & weekly trends — view a 7-day bar chart and click on any day to see detailed entries

● Time-of-day pattern heatmap — shows when mentions are most frequent (morning vs. night, etc.)

● Leaderboard — track multiple people and see who's "winning" each day

● Compact mode — a simple, single-button view for quick logging on the move
Undo & edit — undo the last log, delete entries, rename trackers, or reset/remove a person

Use cases

● Count how often someone says a specific phrase, name, or word

● Monitor personal habits like self-talk, urges, or filler words such as "um"

● A fun swear jar or inside-joke counter among friends

● Simple behaviour logging for coaching or self-improvement

Status

This version was built with a Claude artefact and uses a Claude-specific storage API (window.storage) that functions only within Claude.ai. To run it as a standalone web app (e.g., on GitHub Pages, Vercel, or Netlify), the storage layer must be replaced with localStorage or a small backend—this is planned for the future.

Tech

■ React (hooks-based, single component)

■ Tailwind utility classes

■ lucide-react for icons

License

MIT — free to modify and distribute
___________________________________________

Created by Morsalin-33
