import { useState, useEffect } from "react";
import { Pencil, Check, X, Trash2, RotateCcw, Plus, Crown, Minimize2, Maximize2 } from "lucide-react";

const STORAGE_KEY = "mention-tally-v2";
const LEGACY_KEY = "mention-tally-v1";

const COLORS = {
  paper: "#E7E4DC",
  graphite: "#24221D",
  graphiteLight: "#3A3730",
  card: "#2F4858",
  cardLight: "#3E5C6E",
  bone: "#F2EDE1",
  inkMuted: "#8C8676",
  boneMuted: "#B7AFA0",
  rustLine: "#C6402F",
};

// One color per person, assigned in rotation. Each pairs a bold "ink" tone
// (buttons, bars, gates) with a pale "wash" tone (tab backgrounds).
const PERSON_PALETTE = [
  { ink: "#B8863C", wash: "#F1E4C9", name: "brass" },
  { ink: "#5B6B4A", wash: "#E1E6D6", name: "moss" },
  { ink: "#A24936", wash: "#F1DDD5", name: "rust" },
  { ink: "#3E6B89", wash: "#D9E6EC", name: "slate" },
  { ink: "#7A4B6B", wash: "#EADCE5", name: "plum" },
  { ink: "#4E7D6F", wash: "#DCE9E3", name: "pine" },
];

function pad(n, width) {
  const s = String(Math.max(0, n));
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

function localDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function colorFor(index) {
  return PERSON_PALETTE[index % PERSON_PALETTE.length];
}

const DAY_PERIODS = [
  { label: "Night", range: "12–6a", start: 0, end: 6 },
  { label: "Morning", range: "6a–12p", start: 6, end: 12 },
  { label: "Afternoon", range: "12–6p", start: 12, end: 18 },
  { label: "Evening", range: "6p–12a", start: 18, end: 24 },
];

function dayLabel(key, todayKey) {
  if (key === todayKey) return "Today";
  const d = new Date(key + "T00:00:00");
  const y = new Date(todayKey + "T00:00:00");
  y.setDate(y.getDate() - 1);
  if (localDayKey(y) === key) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function hourCounts(mentions) {
  const counts = Array(24).fill(0);
  mentions.forEach((m) => {
    counts[new Date(m).getHours()] += 1;
  });
  return counts;
}

function TallyGate({ strokes, ink }) {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none" aria-hidden="true">
      {strokes >= 1 && <line x1="3" y1="2" x2="3" y2="26" stroke={COLORS.graphite} strokeWidth="2.5" strokeLinecap="round" />}
      {strokes >= 2 && <line x1="8" y1="2" x2="8" y2="26" stroke={COLORS.graphite} strokeWidth="2.5" strokeLinecap="round" />}
      {strokes >= 3 && <line x1="13" y1="2" x2="13" y2="26" stroke={COLORS.graphite} strokeWidth="2.5" strokeLinecap="round" />}
      {strokes >= 4 && <line x1="18" y1="2" x2="18" y2="26" stroke={COLORS.graphite} strokeWidth="2.5" strokeLinecap="round" />}
      {strokes >= 5 && <line x1="0.5" y1="24" x2="20.5" y2="3" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />}
    </svg>
  );
}

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    .mt-display { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
    .mt-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    @keyframes mtPulse {
      0% { transform: scale(1); }
      45% { transform: scale(0.92); }
      100% { transform: scale(1); }
    }
    .mt-pulse { animation: mtPulse 0.32s ease-out; }
    @keyframes mtGrow {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    .mt-grow { transform-origin: left; animation: mtGrow 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .mt-pulse, .mt-grow { animation: none; }
    }
    .mt-focus:focus-visible {
      outline: 2px solid #B8863C;
      outline-offset: 2px;
    }
    .mt-scroll::-webkit-scrollbar { display: none; }
    .mt-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  `}</style>
);

export default function MentionTally() {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]); // [{id, name, mentions: []}]
  const [activeId, setActiveId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [onboardInput, setOnboardInput] = useState("");
  const [newPersonInput, setNewPersonInput] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [compact, setCompact] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(localDayKey(new Date()));

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          const loadedPeople = Array.isArray(parsed.people) ? parsed.people : [];
          setPeople(loadedPeople);
          setActiveId(parsed.activeId || (loadedPeople[0] && loadedPeople[0].id) || null);
          setCompact(!!parsed.compact);
          setLoading(false);
          return;
        }
      } catch (e) {
        // fall through to legacy check
      }
      // Try migrating the old single-person format.
      try {
        const legacy = await window.storage.get(LEGACY_KEY, false);
        if (legacy && legacy.value) {
          const parsed = JSON.parse(legacy.value);
          if (parsed.personName) {
            const migrated = [{ id: uid(), name: parsed.personName, mentions: Array.isArray(parsed.mentions) ? parsed.mentions : [] }];
            setPeople(migrated);
            setActiveId(migrated[0].id);
            await persist(migrated, migrated[0].id);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // no legacy data either — start fresh
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setSelectedDayKey(localDayKey(new Date()));
  }, [activeId]);

  async function persist(nextPeople, nextActiveId, nextCompact) {
    const compactToSave = nextCompact === undefined ? compact : nextCompact;
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify({ people: nextPeople, activeId: nextActiveId, compact: compactToSave }), false);
      setSaveError("");
    } catch (e) {
      setSaveError("Couldn't save just now — it'll try again on your next tap.");
    }
  }

  function toggleCompact() {
    const next = !compact;
    setCompact(next);
    persist(people, activeId, next);
  }

  function handleFirstStart() {
    const trimmed = onboardInput.trim();
    if (!trimmed) return;
    const person = { id: uid(), name: trimmed, mentions: [] };
    const next = [person];
    setPeople(next);
    setActiveId(person.id);
    persist(next, person.id);
  }

  function handleAddPerson() {
    const trimmed = newPersonInput.trim();
    if (!trimmed) return;
    const person = { id: uid(), name: trimmed, mentions: [] };
    const next = [...people, person];
    setPeople(next);
    setActiveId(person.id);
    setAddingPerson(false);
    setNewPersonInput("");
    persist(next, person.id);
  }

  function updateActiveMentions(updater) {
    const next = people.map((p) => (p.id === activeId ? { ...p, mentions: updater(p.mentions) } : p));
    setPeople(next);
    persist(next, activeId);
  }

  function handleLog() {
    const now = new Date().toISOString();
    updateActiveMentions((mentions) => [...mentions, now]);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 320);
  }

  function handleUndo() {
    updateActiveMentions((mentions) => (mentions.length ? mentions.slice(0, -1) : mentions));
  }

  function handleDeleteEntry(iso) {
    updateActiveMentions((mentions) => mentions.filter((m) => m !== iso));
  }

  function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const next = people.map((p) => (p.id === activeId ? { ...p, name: trimmed } : p));
    setPeople(next);
    setEditingName(false);
    persist(next, activeId);
  }

  function handleResetActive() {
    updateActiveMentions(() => []);
    setConfirmReset(false);
  }

  function handleDeletePerson() {
    const next = people.filter((p) => p.id !== activeId);
    const nextActive = next[0] ? next[0].id : null;
    setPeople(next);
    setActiveId(nextActive);
    setConfirmDeletePerson(false);
    setEditingName(false);
    persist(next, nextActive);
  }

  if (loading) {
    return (
      <div className="mt-body min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.paper }}>
        <GlobalStyle />
        <div className="text-sm" style={{ color: COLORS.inkMuted }}>Loading…</div>
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="mt-body min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: COLORS.paper }}>
        <GlobalStyle />
        <div className="w-full max-w-xs text-center">
          <div className="mt-display text-xs uppercase mb-3" style={{ color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
            Tally
          </div>
          <h1 className="text-xl font-semibold mb-6" style={{ color: COLORS.graphite }}>
            Whose name are you counting?
          </h1>
          <input
            autoFocus
            maxLength={40}
            value={onboardInput}
            onChange={(e) => setOnboardInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFirstStart()}
            placeholder="Enter a name"
            className="mt-focus w-full text-center text-lg py-3 px-4 rounded-2xl border-0 mb-4"
            style={{ backgroundColor: COLORS.bone, color: COLORS.graphite }}
          />
          <button
            onClick={handleFirstStart}
            disabled={!onboardInput.trim()}
            className="mt-focus w-full py-3 rounded-2xl font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: COLORS.graphite }}
          >
            Start counting
          </button>
          <div className="mt-4 text-xs" style={{ color: COLORS.inkMuted }}>
            You can add more people to track once you're going.
          </div>

          <div className="mt-8 text-center text-xs font-medium" style={{ color: COLORS.graphite }}>
            Made by Morsalin-33
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = Math.max(0, people.findIndex((p) => p.id === activeId));
  const activePerson = people[activeIndex] || people[0];
  const activeColor = colorFor(activeIndex);
  const mentions = activePerson.mentions;

  if (compact) {
    const todayC = mentions.filter((m) => localDayKey(new Date(m)) === localDayKey(new Date())).length;
    return (
      <div className="mt-body min-h-screen relative flex flex-col items-center justify-center px-6 py-8" style={{ backgroundColor: COLORS.paper }}>
        <GlobalStyle />
        <button
          onClick={toggleCompact}
          aria-label="Expand full view"
          className="mt-focus absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: COLORS.bone, color: COLORS.inkMuted }}
        >
          <Maximize2 size={14} />
        </button>

        <div className="w-full max-w-xs text-center">
          {people.length > 1 && (
            <div className="mt-scroll flex items-center justify-center gap-2 overflow-x-auto mb-5">
              {people.map((p, i) => {
                const c = colorFor(i);
                const isActive = p.id === activeId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveId(p.id)}
                    className="mt-focus flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: isActive ? c.ink : c.wash, color: isActive ? "#fff" : COLORS.graphite }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="text-lg font-semibold mb-1" style={{ color: COLORS.graphite }}>
            {activePerson.name}
          </div>
          <div className="mt-display text-xs uppercase mb-6" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
            {todayC} today · {mentions.length} all-time
          </div>

          <button
            onClick={handleLog}
            aria-label={`Log a mention of ${activePerson.name}`}
            className={`mt-focus w-36 h-36 rounded-full flex items-center justify-center border-4 mx-auto transition-transform duration-150 active:scale-95 ${justLogged ? "mt-pulse" : ""}`}
            style={{ backgroundColor: justLogged ? activeColor.ink : COLORS.cardLight, borderColor: activeColor.ink }}
          >
            {justLogged ? (
              <Check size={44} color="white" />
            ) : (
              <span className="mt-display text-white text-lg font-semibold">TAP</span>
            )}
          </button>

          {mentions.length > 0 && (
            <button onClick={handleUndo} className="mt-focus flex items-center justify-center gap-1.5 text-xs mt-5 py-2 mx-auto" style={{ color: COLORS.inkMuted }}>
              <RotateCcw size={12} /> Undo last
            </button>
          )}

          <div className="mt-6 text-center text-xs font-medium" style={{ color: COLORS.graphite }}>
            Made by Morsalin-33
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const todayKey = localDayKey(now);
  const todayCount = mentions.filter((m) => localDayKey(new Date(m)) === todayKey).length;
  const overallCount = mentions.length;

  const selectedMentions = mentions.filter((m) => localDayKey(new Date(m)) === selectedDayKey).reverse();
  const selectedCount = selectedMentions.length;

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    const count = mentions.filter((m) => localDayKey(new Date(m)) === key).length;
    last7.push({ key, letter: d.toLocaleDateString(undefined, { weekday: "narrow" }), count, isToday: i === 0 });
  }
  const maxCount = Math.max(1, ...last7.map((d) => d.count));

  const fullGates = Math.floor(selectedCount / 5);
  const remainder = selectedCount % 5;

  // Time-of-day pattern, across all logged mentions for the active person.
  const hourly = hourCounts(mentions);
  const hourMax = Math.max(1, ...hourly);
  const periodTotals = DAY_PERIODS.map((p) => ({
    ...p,
    total: hourly.slice(p.start, p.end).reduce((a, b) => a + b, 0),
  }));
  const peakPeriod = periodTotals.reduce((a, b) => (b.total > a.total ? b : a), periodTotals[0]);

  // Leaderboard for whichever day is selected — defaults to today.
  const leaderboard = people
    .map((p, i) => ({ ...p, total: p.mentions.filter((m) => localDayKey(new Date(m)) === selectedDayKey).length, color: colorFor(i) }))
    .sort((a, b) => b.total - a.total);
  const leaderMax = Math.max(1, ...leaderboard.map((p) => p.total));
  const topTotal = leaderboard[0] ? leaderboard[0].total : 0;

  return (
    <div className="mt-body min-h-screen relative flex flex-col items-center px-4 py-8" style={{ backgroundColor: COLORS.paper }}>
      <GlobalStyle />
      <button
        onClick={toggleCompact}
        aria-label="Switch to compact view"
        className="mt-focus absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: COLORS.bone, color: COLORS.inkMuted }}
      >
        <Minimize2 size={14} />
      </button>
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          <div className="mt-display text-xs uppercase mb-3" style={{ color: COLORS.inkMuted, letterSpacing: "0.2em" }}>
            Tally
          </div>

          {/* Person tabs */}
          <div className="mt-scroll flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {people.map((p, i) => {
              const c = colorFor(i);
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => { setActiveId(p.id); setEditingName(false); setConfirmReset(false); setConfirmDeletePerson(false); }}
                  className="mt-focus flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? c.ink : c.wash,
                    color: isActive ? "#fff" : COLORS.graphite,
                  }}
                >
                  {p.name}
                </button>
              );
            })}
            {addingPerson ? (
              <div className="flex-shrink-0 flex items-center gap-1">
                <input
                  autoFocus
                  maxLength={40}
                  value={newPersonInput}
                  onChange={(e) => setNewPersonInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
                  placeholder="Name"
                  className="mt-focus text-sm py-2 px-3 rounded-full border-0 w-24"
                  style={{ backgroundColor: COLORS.bone, color: COLORS.graphite }}
                />
                <button onClick={handleAddPerson} aria-label="Add person" className="mt-focus p-2 rounded-full text-white" style={{ backgroundColor: COLORS.graphite }}>
                  <Check size={14} />
                </button>
                <button onClick={() => { setAddingPerson(false); setNewPersonInput(""); }} aria-label="Cancel" className="mt-focus p-2 rounded-full" style={{ backgroundColor: COLORS.bone, color: COLORS.inkMuted }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingPerson(true)}
                aria-label="Add a person"
                className="mt-focus flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: COLORS.bone, color: COLORS.inkMuted }}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="text-center mb-4">
          {editingName ? (
            <div className="flex items-center gap-2 justify-center">
              <input
                autoFocus
                maxLength={40}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="mt-focus text-lg text-center py-1.5 px-3 rounded-xl border-0 w-40"
                style={{ backgroundColor: COLORS.bone, color: COLORS.graphite }}
              />
              <button onClick={saveName} aria-label="Save name" className="mt-focus p-2 rounded-full text-white" style={{ backgroundColor: COLORS.graphite }}>
                <Check size={16} />
              </button>
              <button
                onClick={() => { setEditingName(false); setNameInput(activePerson.name); }}
                aria-label="Cancel"
                className="mt-focus p-2 rounded-full"
                style={{ backgroundColor: COLORS.bone, color: COLORS.inkMuted }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNameInput(activePerson.name); setEditingName(true); }}
              className="mt-focus inline-flex items-center gap-2 text-xl font-semibold"
              style={{ color: COLORS.graphite }}
            >
              {activePerson.name}
              <Pencil size={14} style={{ color: COLORS.inkMuted }} />
            </button>
          )}
        </div>

        <div className="rounded-3xl p-5 shadow-xl" style={{ backgroundColor: COLORS.card }}>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl py-4 px-2 text-center shadow-inner" style={{ backgroundColor: COLORS.bone }}>
              <div className="mt-display text-xs uppercase mb-1" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
                Today
              </div>
              <div className="mt-display text-5xl font-bold tabular-nums" style={{ color: activeColor.ink }}>
                {pad(todayCount, 2)}
              </div>
            </div>
            <div className="rounded-2xl py-4 px-2 text-center shadow-inner" style={{ backgroundColor: COLORS.bone }}>
              <div className="mt-display text-xs uppercase mb-1" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
                All-time
              </div>
              <div className="mt-display text-3xl font-bold tabular-nums" style={{ color: COLORS.graphite }}>
                {pad(overallCount, 4)}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={handleLog}
              aria-label={`Log a mention of ${activePerson.name}`}
              className={`mt-focus w-24 h-24 rounded-full flex items-center justify-center border-4 transition-transform duration-150 active:scale-95 ${justLogged ? "mt-pulse" : ""}`}
              style={{ backgroundColor: justLogged ? activeColor.ink : COLORS.cardLight, borderColor: activeColor.ink }}
            >
              {justLogged ? (
                <Check size={30} color="white" />
              ) : (
                <span className="mt-display text-white text-sm font-semibold">TAP</span>
              )}
            </button>
            <div className="mt-3 text-xs" style={{ color: COLORS.boneMuted }}>
              press when you say it
            </div>
          </div>
        </div>

        {mentions.length > 0 && (
          <button onClick={handleUndo} className="mt-focus w-full flex items-center justify-center gap-1.5 text-xs mt-3 py-2" style={{ color: COLORS.inkMuted }}>
            <RotateCcw size={12} /> Undo last
          </button>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="mt-display text-xs uppercase" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
              Last 7 days · {activePerson.name}
            </div>
            <div className="text-[10px]" style={{ color: COLORS.inkMuted }}>tap a bar for that day</div>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: COLORS.bone }}>
            <div className="flex items-end justify-between gap-2" style={{ height: "56px" }}>
              {last7.map((d) => {
                const px = Math.max(3, Math.round((d.count / maxCount) * 48));
                const isSelected = d.key === selectedDayKey;
                return (
                  <button
                    key={d.key}
                    onClick={() => setSelectedDayKey(d.key)}
                    aria-label={`Show entries for ${dayLabel(d.key, todayKey)}`}
                    className="mt-focus flex-1 flex flex-col items-center justify-end h-full rounded-md"
                  >
                    <div
                      className="w-full rounded-md transition-opacity"
                      style={{
                        height: `${px}px`,
                        backgroundColor: isSelected ? activeColor.ink : COLORS.graphite,
                        opacity: isSelected ? 1 : 0.4,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              {last7.map((d) => (
                <div
                  key={d.key}
                  className="flex-1 text-center mt-display text-xs"
                  style={{ color: d.key === selectedDayKey ? activeColor.ink : COLORS.inkMuted, fontWeight: d.key === selectedDayKey ? 700 : 500 }}
                >
                  {d.letter}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="mt-display text-xs uppercase" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
              {dayLabel(selectedDayKey, todayKey)}
            </div>
            {selectedDayKey !== todayKey && (
              <button onClick={() => setSelectedDayKey(todayKey)} className="mt-focus text-xs font-medium" style={{ color: activeColor.ink }}>
                Back to today
              </button>
            )}
          </div>

          {selectedCount === 0 ? (
            <div className="text-sm py-3" style={{ color: COLORS.inkMuted }}>
              No mentions logged {selectedDayKey === todayKey ? "yet today" : "that day"}.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {Array.from({ length: fullGates }).map((_, i) => (
                  <TallyGate key={`g${i}`} strokes={5} ink={activeColor.ink} />
                ))}
                {remainder > 0 && <TallyGate strokes={remainder} ink={activeColor.ink} />}
              </div>
              <div className="space-y-1.5">
                {selectedMentions.map((m) => (
                  <div key={m} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ backgroundColor: COLORS.bone }}>
                    <span className="mt-display text-sm" style={{ color: COLORS.graphite }}>{formatTime(m)}</span>
                    <button onClick={() => handleDeleteEntry(m)} aria-label="Delete this entry" className="mt-focus" style={{ color: COLORS.inkMuted }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-8">
          <div className="mt-display text-xs uppercase mb-3" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
            By time of day · {activePerson.name}
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: COLORS.bone }}>
            {overallCount === 0 ? (
              <div className="text-sm py-1" style={{ color: COLORS.inkMuted }}>
                No mentions logged yet.
              </div>
            ) : (
              <>
                <div className="flex gap-[3px]">
                  {hourly.map((count, hour) => {
                    const intensity = count === 0 ? 0.06 : 0.25 + 0.75 * (count / hourMax);
                    return (
                      <div
                        key={hour}
                        title={`${hour}:00 — ${count} mention${count === 1 ? "" : "s"}`}
                        className="flex-1 rounded-sm"
                        style={{ height: "22px", backgroundColor: activeColor.ink, opacity: intensity }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5 mt-display text-[10px]" style={{ color: COLORS.inkMuted }}>
                  <span>12a</span>
                  <span>6a</span>
                  <span>12p</span>
                  <span>6p</span>
                  <span>12a</span>
                </div>
                <div className="mt-3 text-xs" style={{ color: COLORS.graphite }}>
                  Most likely in the <span className="font-semibold">{peakPeriod.label.toLowerCase()}</span> ({peakPeriod.range}) — {peakPeriod.total} of {overallCount}
                </div>
              </>
            )}
          </div>
        </div>

        {people.length > 1 && (
          <div className="mt-8">
            <div className="flex items-center gap-1.5 mb-3">
              <Crown size={13} style={{ color: COLORS.rustLine }} />
              <div className="mt-display text-xs uppercase" style={{ color: COLORS.inkMuted, letterSpacing: "0.15em" }}>
                Most on the mind · {dayLabel(selectedDayKey, todayKey)}
              </div>
            </div>
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: COLORS.bone }}>
              {leaderboard.map((p, rank) => {
                const widthPct = Math.max(4, Math.round((p.total / leaderMax) * 100));
                const isLeader = rank === 0 && topTotal > 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => { setActiveId(p.id); setEditingName(false); setConfirmReset(false); setConfirmDeletePerson(false); }}
                        className="mt-focus flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: COLORS.graphite }}
                      >
                        {isLeader && <Crown size={12} style={{ color: COLORS.rustLine }} />}
                        {p.name}
                      </button>
                      <span className="mt-display text-xs tabular-nums" style={{ color: COLORS.inkMuted }}>
                        {p.total}
                      </span>
                    </div>
                    <div className="w-full rounded-full overflow-hidden" style={{ backgroundColor: p.color.wash, height: "10px" }}>
                      <div
                        className="mt-grow h-full rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: p.color.ink }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {saveError && (
          <div className="mt-4 text-center text-xs" style={{ color: "#A24936" }}>{saveError}</div>
        )}

        <div className="mt-10 pb-4">
          <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
            {confirmReset ? (
              <div className="flex items-center gap-3">
                <span style={{ color: COLORS.inkMuted }}>Clear {activePerson.name}'s mentions?</span>
                <button onClick={handleResetActive} className="mt-focus font-semibold" style={{ color: "#A24936" }}>Yes, reset</button>
                <button onClick={() => setConfirmReset(false)} className="mt-focus" style={{ color: COLORS.inkMuted }}>Cancel</button>
              </div>
            ) : confirmDeletePerson ? (
              <div className="flex items-center gap-3">
                <span style={{ color: COLORS.inkMuted }}>Remove {activePerson.name} entirely?</span>
                <button onClick={handleDeletePerson} className="mt-focus font-semibold" style={{ color: "#A24936" }}>Yes, remove</button>
                <button onClick={() => setConfirmDeletePerson(false)} className="mt-focus" style={{ color: COLORS.inkMuted }}>Cancel</button>
              </div>
            ) : (
              <>
                <button onClick={() => setConfirmReset(true)} className="mt-focus" style={{ color: COLORS.inkMuted }}>
                  Reset {activePerson.name}
                </button>
                {people.length > 1 && (
                  <button onClick={() => setConfirmDeletePerson(true)} className="mt-focus" style={{ color: COLORS.inkMuted }}>
                    Remove person
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-xs font-medium" style={{ color: COLORS.graphite }}>
          Made by Morsalin-33
        </div>
      </div>
    </div>
  );
}
