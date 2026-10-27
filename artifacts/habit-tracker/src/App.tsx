import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { CalendarDays, Check, Plus, Sprout, Trash2, X } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type Habit = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  completedDates: string[];
};

const STORAGE_KEY = 'little-promises-habits-v1';

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function streakFor(dates: string[]) {
  const completed = new Set(dates);
  const today = localDateKey();
  let cursor = completed.has(today) ? new Date() : shiftDate(new Date(), -1);
  if (!completed.has(localDateKey(cursor))) return 0;
  let streak = 0;
  while (completed.has(localDateKey(cursor))) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function bestStreakFor(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const [year, month, day] = key.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    const currentDay = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
    const previousDay = previous ? Date.UTC(previous.getFullYear(), previous.getMonth(), previous.getDate()) : 0;
    const consecutive = previous !== null && currentDay - previousDay === 86400000;
    run = consecutive ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

function readHabits(): Habit[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Habit =>
      item && typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.createdAt === 'string' && Array.isArray(item.completedDates),
    ).map((item) => ({
      ...item,
      completedDates: item.completedDates.filter((date: unknown) => typeof date === 'string'),
    }));
  } catch {
    return [];
  }
}

function Home() {
  const [habits, setHabits] = useState<Habit[]>(readHabits);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const today = localDateKey();
  const todayDate = new Date();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch {
      // The tracker remains usable if browser storage is unavailable.
    }
  }, [habits]);

  useEffect(() => {
    if (!formOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFormOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen]);

  const completedToday = habits.filter((habit) => habit.completedDates.includes(today)).length;
  const progress = habits.length ? Math.round((completedToday / habits.length) * 100) : 0;
  const currentOverall = Math.max(0, ...habits.map((habit) => streakFor(habit.completedDates)));
  const bestOverall = Math.max(0, ...habits.map((habit) => bestStreakFor(habit.completedDates)));
  const history = useMemo(() => {
    const end = new Date();
    const daysFromMonday = (end.getDay() + 6) % 7;
    const start = shiftDate(end, -(77 + daysFromMonday));
    return Array.from({ length: 84 }, (_, index) => {
      const date = shiftDate(start, index);
      const key = localDateKey(date);
      const count = habits.filter((habit) => habit.completedDates.includes(key)).length;
      const level = habits.length ? Math.min(4, Math.ceil((count / habits.length) * 4)) : 0;
      return { key, date, count, level, future: date > end };
    });
  }, [habits]);

  function toggleHabit(id: string) {
    setHabits((current) => current.map((habit) => {
      if (habit.id !== id) return habit;
      const completed = new Set(habit.completedDates);
      if (completed.has(today)) completed.delete(today);
      else completed.add(today);
      return { ...habit, completedDates: [...completed].sort() };
    }));
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const habit: Habit = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name: trimmedName,
      ...(description.trim() ? { description: description.trim() } : {}),
      createdAt: new Date().toISOString(),
      completedDates: [],
    };
    setHabits((current) => [...current, habit]);
    setName('');
    setDescription('');
    setFormOpen(false);
  }

  function removeHabit(habit: Habit) {
    if (window.confirm(`Remove “${habit.name}” and its completion history?`)) {
      setHabits((current) => current.filter((item) => item.id !== habit.id));
    }
  }

  return (
    <main className="app-shell">
      <div className="page-wrap">
        <header className="topbar">
          <div className="brand" data-testid="text-brand">
            <span className="brand-mark"><Sprout size={18} strokeWidth={2.2} /></span>
            <span>little by little</span>
          </div>
          <div className="date-label" data-testid="text-today-date">
            {todayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow">A softer kind of progress</div>
            <h1>Keep a promise<br />to yourself.</h1>
            <p>Small things, done with care, add up.</p>
          </div>
          <div className="today-progress" data-testid="status-today-progress">
            <div className="progress-label"><span>Today, so far</span><strong>{completedToday}<span style={{ color: '#91a197', fontSize: 13 }}> / {habits.length}</span></strong></div>
            <div className="progress-track" aria-label={`${progress}% of today's habits completed`}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <div className="main-grid">
          <section className="panel habits-panel" aria-labelledby="habits-heading">
            <div className="section-head">
              <div>
                <h2 className="section-title" id="habits-heading">Your daily rituals</h2>
                <p className="section-subtitle">Show up in your own way.</p>
              </div>
              <button className="add-button" onClick={() => setFormOpen(true)} data-testid="button-add-habit">
                <Plus size={15} /> Add a ritual
              </button>
            </div>

            {habits.length === 0 ? (
              <div className="empty-state" data-testid="empty-habits">
                <div className="empty-art"><Sprout size={27} strokeWidth={1.7} /></div>
                <h3>Make room for one small thing.</h3>
                <p>Choose a promise that feels kind and doable. There’s no perfect pace to begin.</p>
                <button className="empty-action" onClick={() => setFormOpen(true)} data-testid="button-empty-add">Create your first ritual</button>
              </div>
            ) : (
              <div className="habit-list" data-testid="list-habits">
                {habits.map((habit) => {
                  const done = habit.completedDates.includes(today);
                  const streak = streakFor(habit.completedDates);
                  return (
                    <article className={`habit-row${done ? ' is-done' : ''}`} key={habit.id} data-testid={`card-habit-${habit.id}`}>
                      <button
                        className={`check-button${done ? ' checked' : ''}`}
                        type="button"
                        aria-label={`${done ? 'Uncheck' : 'Check off'} ${habit.name} for today`}
                        aria-pressed={done}
                        onClick={() => toggleHabit(habit.id)}
                        data-testid={`button-check-${habit.id}`}
                      >
                        <Check size={18} strokeWidth={2.5} />
                      </button>
                      <div>
                        <h3 className="habit-name" data-testid={`text-habit-name-${habit.id}`}>{habit.name}</h3>
                        {habit.description && <p className="habit-description" data-testid={`text-habit-description-${habit.id}`}>{habit.description}</p>}
                      </div>
                      <div className="habit-meta">
                        <div className="streak" data-testid={`status-streak-${habit.id}`}>
                          <strong>{streak} {streak === 1 ? 'day' : 'days'}</strong>
                          <span>current streak</span>
                        </div>
                        <button className="remove-button" type="button" aria-label={`Remove ${habit.name}`} onClick={() => removeHabit(habit)} data-testid={`button-remove-${habit.id}`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="side-column">
            <section className="panel streak-panel" aria-labelledby="streak-heading">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h2 className="section-title" id="streak-heading">Your rhythm</h2>
              </div>
              <p className="streak-caption">Every return is a little beginning.</p>
              <div className="streak-stats">
                <div className="streak-stat" data-testid="status-current-streak">
                  <span>Current best</span><strong>{currentOverall} <small style={{ fontSize: 12, fontWeight: 500 }}>days</small></strong>
                </div>
                <div className="streak-stat" data-testid="status-best-streak">
                  <span>Personal best</span><strong>{bestOverall} <small style={{ fontSize: 12, fontWeight: 500 }}>days</small></strong>
                </div>
              </div>
            </section>

            <section className="panel history-panel" aria-labelledby="history-heading">
              <div className="section-head">
                <div className="history-title">
                  <CalendarDays size={17} />
                  <h2 className="section-title" id="history-heading">A little history</h2>
                </div>
                <span className="history-summary" data-testid="text-history-window">12 weeks</span>
              </div>
              {habits.length === 0 ? (
                <div className="history-empty" data-testid="empty-history">Your check-ins will gather here, one day at a time.</div>
              ) : (
                <>
                  <div className="weekdays" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
                  <div className="heatmap" role="img" aria-label="Completion history for the last twelve weeks" data-testid="grid-completion-history">
                    {history.map((day) => (
                      <div
                        key={day.key}
                        className={`heat-cell level-${day.level}${day.future ? ' future' : ''}`}
                        title={`${day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${day.count} of ${habits.length} rituals`}
                        data-testid={`cell-history-${day.key}`}
                      />
                    ))}
                  </div>
                  <div className="heat-legend" aria-hidden="true">
                    <span>Less</span><i className="heat-cell" /><i className="heat-cell level-1" /><i className="heat-cell level-2" /><i className="heat-cell level-3" /><i className="heat-cell level-4" /><span>More</span>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
      {formOpen && (
        <div className="form-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <form className="habit-form" onSubmit={addHabit} aria-labelledby="form-heading">
            <div className="form-head">
              <div><h2 id="form-heading">A promise, just for you</h2><p>Keep it small enough to return to.</p></div>
              <button className="form-close" type="button" aria-label="Close form" onClick={() => setFormOpen(false)} data-testid="button-close-form"><X size={17} /></button>
            </div>
            <label className="field-label" htmlFor="habit-name">What would you like to do?</label>
            <input id="habit-name" className="habit-input" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, step outside for a moment" data-testid="input-habit-name" />
            <label className="field-label" htmlFor="habit-description">A gentle reminder <span style={{ color: '#a3ada2', fontWeight: 400 }}>· optional</span></label>
            <textarea id="habit-description" className="habit-input habit-textarea" maxLength={140} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a little context for future you" data-testid="input-habit-description" />
            <div className="form-actions">
              <button className="cancel-button" type="button" onClick={() => setFormOpen(false)} data-testid="button-cancel-habit">Maybe later</button>
              <button className="save-button" type="submit" disabled={!name.trim()} data-testid="button-save-habit">Add this promise</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
