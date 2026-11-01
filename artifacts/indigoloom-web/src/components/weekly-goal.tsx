import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { checkInWeeklyGoal, getGetWeeklyGoalQueryKey, setWeeklyGoal, useGetWeeklyGoal } from '@workspace/api-client-react';
import type { GetWeeklyGoalParams, Studio, WeeklyGoal } from '@workspace/api-client-react';
import { Wheel } from './date-wheel-field';

const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const goalItems = Array.from({ length: 7 }, (_, index) => (index === 0 ? '1 day' : `${index + 1} days`));

// The maker's own date and time zone, so the week turns over at their midnight.
function weekParams(studio: Studio): GetWeeklyGoalParams {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let timeZone: string | undefined;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { timeZone = undefined; }
  return { studio, today, ...(timeZone ? { timeZone } : {}) };
}

// "This week" on each studio's Overview: crafting days against the weekly goal.
// A day fills in from a journal note, the row counter or the button here.
export function WeeklyGoalCard({ studio }: { studio: Studio }) {
  const client = useQueryClient();
  const params = weekParams(studio);
  const key = getGetWeeklyGoalQueryKey(params);
  const query = useGetWeeklyGoal(params, { query: { queryKey: key } });
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(2);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const week = query.data;

  useEffect(() => {
    if (!picking) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPicking(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [picking]);

  // Nothing to show until the week has loaded; the card never blocks the Overview.
  if (query.isLoading || !Array.isArray(week?.days)) return null;

  const run = async (action: () => Promise<WeeklyGoal>) => {
    setBusy(true);
    setProblem('');
    try {
      client.setQueryData(key, await action());
      setPicking(false);
    } catch {
      setProblem("That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const saveGoal = (goal: number | null) => run(() => setWeeklyGoal({ goal }, params));
  const checkIn = () => run(() => checkInWeeklyGoal(params));
  const openPicker = () => { setDraft(Math.max(0, (week.goal ?? 3) - 1)); setPicking(!picking); };
  const met = week.goal !== null && week.count >= week.goal;
  const todayIndex = (new Date().getDay() + 6) % 7;
  const checkInLabel = studio === 'sewing' ? 'I sewed today' : 'I crafted today';

  return <section className="weekly-goal loom-card" aria-labelledby={`weekly-goal-${studio}`} data-testid={`card-weekly-goal-${studio}`}>
    <div className="weekly-goal-head">
      <h2 className="serif" id={`weekly-goal-${studio}`}>This week</h2>
      {week.goal !== null && <button type="button" className="quiet-link weekly-goal-change" aria-expanded={picking} onClick={openPicker} data-testid="button-change-weekly-goal">Change</button>}
    </div>
    {week.goal === null ? <>
      <p className="weekly-goal-sub">{week.count === 1 ? '1 day so far' : `${week.count} days so far`}</p>
      {!picking && <button type="button" className="button button-outline weekly-goal-set" onClick={openPicker} data-testid="button-set-weekly-goal">Set a weekly goal</button>}
    </> : <>
      {met && <span className="weekly-goal-met" data-testid="text-weekly-goal-met">Goal met</span>}
      <p className="weekly-goal-count" data-testid="text-weekly-goal-count"><strong>{week.count}</strong> of {week.goal} {week.goal === 1 ? 'day' : 'days'}</p>
      <ol className="weekly-goal-days">
        {week.days.map((done, index) => <li key={index} className={`${done ? 'is-done' : ''}${index === todayIndex ? ' is-today' : ''}`} aria-label={`${dayNames[index]}${done ? ', crafted' : ''}`}><i/><span aria-hidden="true">{dayLetters[index]}</span></li>)}
      </ol>
      {week.weeksInARow >= 2 && <p className="weekly-goal-sub" data-testid="text-weeks-in-a-row">{week.weeksInARow} weeks in a row</p>}
      {week.todayCounted
        ? <p className="weekly-goal-today" data-testid="text-today-counted">Today counted</p>
        : <button type="button" className="button button-outline weekly-goal-set" disabled={busy} onClick={checkIn} data-testid="button-weekly-check-in">{checkInLabel}</button>}
    </>}
    {picking && <div className="date-wheel-panel weekly-goal-panel" role="dialog" aria-label="Days per week">
      <div className="date-wheels weight-wheels">
        <div className="date-wheel-band" aria-hidden="true"/>
        <Wheel label="Days per week" items={goalItems} index={draft} onChange={setDraft} testId="input-weekly-goal-wheel"/>
      </div>
      <div className="date-wheel-actions">
        {week.goal !== null
          ? <button type="button" className="button button-outline" disabled={busy} onClick={() => saveGoal(null)} data-testid="button-turn-off-weekly-goal">Turn off goal</button>
          : <button type="button" className="button button-outline" onClick={() => setPicking(false)}>Cancel</button>}
        <button type="button" className="button button-primary" disabled={busy} onClick={() => saveGoal(draft + 1)} data-testid="button-save-weekly-goal">Save</button>
      </div>
    </div>}
    {problem && <p className="form-error" role="alert">{problem}</p>}
  </section>;
}
