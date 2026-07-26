Mention Tally

A tap-to-log tracker for counting how often something gets said — names, filler words, habits, running jokes, whatever you want to keep score of.

Built as a single-file React component. Fast to use, no accounts, no setup.
Features

● One-tap logging — press a button the moment it happens

● Multiple people/things at once — switch between tabs, each gets its own colour and history

● Daily & weekly trends — see a 7-day bar chart and drill into any single day's entries

● Time-of-day patterns — a heatmap showing when mentions tend to happen (morning vs. night, etc.)

● Leaderboard — when tracking more than one person, see who's "winning" for any given day

● Compact mode — a minimal single-button view for quick logging on the go
Undo & edit — undo the last tap, delete individual entries, rename people, reset or remove someone entirely

Use cases

● Counting how often someone says a specific phrase, name, or word

● Tracking a personal habit (self-talk, urges, filler words like "um")

● A lighthearted swear jar or inside-joke counter among friends

● Lightweight behaviour logging for coaching or self-improvement

Status

This version was built with Claude artefact and uses a Claude-specific storage API (window.storage) that only works inside Claude.ai. To run it as a standalone web app (e.g., hosted on GitHub Pages, Vercel, or Netlify), the storage layer needs to be replaced with localStorage or a small backend — that's on the roadmap.

Tech

■ React (hooks-based, single component)

■ Tailwind utility classes

■ lucide-react for icons

License

MIT — do whatever you'd like with it
___________________________________________

Made by Morsalin-33
