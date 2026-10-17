import type { DashboardCharts as Charts, ProjectStatus } from '@workspace/api-client-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// PLAN.md palette: Granite for the bars, Blue Slate for axis text, Lavender for the grid.
const barColor = '#395B50';
const axisColor = '#5A7684';
const gridColor = '#C5D1EB';

const statusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning', in_progress: 'In progress', paused: 'On pause', completed: 'Finished',
};

// Chart buckets are UTC dates, so format them in UTC to keep the labels on the right day.
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const monthYearFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type Row = { label: string; detail: string; count: number };

// Few bars (the status chart): show every label and put two-word labels on two lines so they fit at 13px.
function WrappedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = String(payload?.value ?? '').split(' ');
  return <text x={x} y={y} dy={13} textAnchor="middle" fill={axisColor} fontSize={13}>
    {words.map((word, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>{word}</tspan>)}
  </text>;
}

function ChartCard({ eyebrow, title, rows, emptyText, unit, note, testId }: {
  eyebrow: string; title: string; rows: Row[]; emptyText: string; unit: [string, string]; note?: string; testId: string;
}) {
  const hasData = rows.some((row) => row.count > 0);
  return <figure className="chart-card loom-card" data-testid={testId}>
    <figcaption><span className="eyebrow">{eyebrow}</span><h2 className="serif">{title}</h2></figcaption>
    {hasData ? <div className="chart-plot">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 4"/>
          {rows.length <= 4
            ? <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={40} tick={<WrappedTick/>}/>
            : <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: axisColor, fontSize: 13 }}/>}
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: axisColor, fontSize: 13 }}/>
          <Tooltip
            cursor={{ fill: gridColor, opacity: 0.35 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
              if (!row) return null;
              return <div className="chart-tooltip"><b>{row.detail}</b><span>{row.count} {row.count === 1 ? unit[0] : unit[1]}</span></div>;
            }}
          />
          <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={36}/>
        </BarChart>
      </ResponsiveContainer>
    </div> : <p className="chart-empty">{emptyText}</p>}
    {note ? <p className="chart-note">{note}</p> : null}
    <table className="sr-only"><caption>{title}</caption><tbody>{rows.map((row) => <tr key={row.detail}><th scope="row">{row.detail}</th><td>{row.count}</td></tr>)}</tbody></table>
  </figure>;
}

export function DashboardCharts({ charts }: { charts: Charts }) {
  const statusRows = charts.projectsByStatus.map(({ status, count }) => ({
    label: statusLabels[status], detail: statusLabels[status], count,
  }));
  const monthRows = charts.completedPerMonth.map(({ month, count }) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    return { label: monthFormat.format(date), detail: monthYearFormat.format(date), count };
  });
  const weekRows = charts.progressPerWeek.map(({ weekStart, count }) => {
    const date = new Date(`${weekStart}T00:00:00Z`);
    return { label: weekFormat.format(date), detail: `Week of ${weekFormat.format(date)}`, count };
  });
  const undated = charts.completedWithoutDate;

  return <section className="chart-row" aria-label="Your making habits">
    <ChartCard testId="chart-projects-by-status" eyebrow="WHERE THINGS STAND" title="Projects by status" rows={statusRows} unit={['project', 'projects']}
      emptyText="Add your first project and it will show up here."/>
    <ChartCard testId="chart-completed-per-month" eyebrow="THE LAST 12 MONTHS" title="Finished each month" rows={monthRows} unit={['project', 'projects']}
      emptyText="Nothing finished in the last year yet. Your first finish will land here."
      note={undated ? `${undated} finished ${undated === 1 ? 'project has' : 'projects have'} no completed date, so ${undated === 1 ? 'it isn’t' : 'they aren’t'} counted here.` : undefined}/>
    <ChartCard testId="chart-progress-per-week" eyebrow="THE LAST 12 WEEKS" title="Progress notes each week" rows={weekRows} unit={['note', 'notes']}
      emptyText="No progress notes in the last 12 weeks. Add one from any project page."/>
  </section>;
}
