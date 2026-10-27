import type { DashboardCharts as Charts, ProjectStatus } from '@workspace/api-client-react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LoomText, fonts } from '@/components/loom';
import { useColors } from '@/hooks/useColors';

const plotHeight = 120;

const statusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning', in_progress: 'In progress', paused: 'On pause', completed: 'Finished',
};

// Chart buckets are UTC dates, so format them in UTC to keep the labels on the right day.
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const monthYearFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type Row = { label: string; detail: string; count: number };

function BarChartCard({ title, rows, unit, emptyText, note, edgeLabelsOnly = false }: {
  title: string; rows: Row[]; unit: [string, string]; emptyText: string; note?: string; edgeLabelsOnly?: boolean;
}) {
  const colors = useColors();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...rows.map((row) => row.count));
  const describe = (row: Row) => `${row.detail}: ${row.count} ${row.count === 1 ? unit[0] : unit[1]}`;
  const picked = selected === null ? undefined : rows[selected];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <LoomText serif style={[styles.title, { color: colors.foreground }]}>{title}</LoomText>
      {max > 0 ? (
        <>
          <View style={[styles.plot, { borderBottomColor: colors.chartGrid }]}>
            {rows.map((row, index) => (
              <Pressable
                key={row.detail}
                accessibilityRole="button"
                accessibilityLabel={describe(row)}
                onPress={() => setSelected(selected === index ? null : index)}
                style={styles.barSlot}
              >
                <View
                  style={[
                    styles.bar,
                    {
                      height: row.count ? Math.max(4, (row.count / max) * plotHeight) : 0,
                      backgroundColor: selected === index ? colors.chartBarSelected : colors.chartBar,
                    },
                  ]}
                />
              </Pressable>
            ))}
          </View>
          {/* Twelve labels don't fit under narrow bars, so long charts only label the first and last bar. */}
          {edgeLabelsOnly ? (
            <View style={[styles.labels, { justifyContent: 'space-between' }]}>
              <LoomText style={[styles.edgeLabel, { color: colors.chartAxis }]}>{rows[0]?.label}</LoomText>
              <LoomText style={[styles.edgeLabel, { color: colors.chartAxis }]}>{rows[rows.length - 1]?.label}</LoomText>
            </View>
          ) : (
            <View style={styles.labels}>
              {rows.map((row) => <LoomText key={row.detail} numberOfLines={1} style={[styles.label, { color: colors.chartAxis }]}>{row.label}</LoomText>)}
            </View>
          )}
          <LoomText style={[styles.caption, { color: colors.chartAxis }]}>
            {picked ? describe(picked) : `Tallest bar: ${max} ${max === 1 ? unit[0] : unit[1]}. Tap a bar for its count.`}
          </LoomText>
        </>
      ) : (
        <LoomText style={[styles.empty, { color: colors.chartAxis }]}>{emptyText}</LoomText>
      )}
      {note ? <LoomText style={[styles.caption, { color: colors.chartAxis }]}>{note}</LoomText> : null}
    </View>
  );
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

  return (
    <View>
      <BarChartCard title="Projects by status" rows={statusRows} unit={['project', 'projects']}
        emptyText="Add your first project and it will show up here." />
      <BarChartCard title="Finished, last 12 months" rows={monthRows} unit={['project', 'projects']} edgeLabelsOnly
        emptyText="Nothing finished in the last year yet. Your first finish will land here."
        note={undated ? `${undated} finished ${undated === 1 ? 'project has' : 'projects have'} no completed date, so ${undated === 1 ? 'it isn’t' : 'they aren’t'} counted here.` : undefined} />
      <BarChartCard title="Notes, last 12 weeks" rows={weekRows} unit={['note', 'notes']} edgeLabelsOnly
        emptyText="No progress notes in the last 12 weeks. Add one from any project page." />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  title: { fontSize: 22, marginBottom: 12 },
  plot: { height: plotHeight, flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 34, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: 'row', gap: 4, marginTop: 5 },
  label: { flex: 1, textAlign: 'center', fontSize: 13 },
  edgeLabel: { fontSize: 13 },
  caption: { fontSize: 14, marginTop: 9, lineHeight: 19 },
  empty: { fontSize: 15, lineHeight: 21, textAlign: 'center', paddingVertical: 34, paddingHorizontal: 10 },
});
