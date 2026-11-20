import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import type { Project, ProjectStatus } from '@workspace/api-client-react';
import { Link, Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useColors, useRoomColors } from '@/hooks/useColors';
import { BoardTile } from '@/components/paper';
import { StarButton } from '@/components/StarButton';

export const fonts = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'EBGaramond_500Medium',
  displayBold: 'EBGaramond_600SemiBold',
};

export function LoomText({
  serif = false,
  style,
  ...props
}: TextProps & { serif?: boolean }) {
  const colors = useColors();
  return (
    <Text
      {...props}
      style={[
        { color: colors.foreground, fontFamily: serif ? fonts.display : fonts.body },
        style,
      ]}
    />
  );
}

export function Brand() {
  const colors = useColors();
  return (
    <View style={styles.brand} accessibilityLabel="Mwedi Threads">
      <LoomText style={[styles.brandName, { color: colors.foreground }]}>Mwedi Threads</LoomText>
    </View>
  );
}

export function LoomButton({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  busy = false,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const colors = useRoomColors();
  const palette = {
    primary: { backgroundColor: colors.primary, color: colors.primaryForeground, borderColor: colors.primary },
    secondary: { backgroundColor: colors.card, color: colors.primary, borderColor: colors.border },
    quiet: { backgroundColor: 'transparent', color: colors.mutedForeground, borderColor: 'transparent' },
    danger: { backgroundColor: colors.destructive, color: colors.destructiveForeground, borderColor: colors.destructive },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled || busy}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.color} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={palette.color} /> : null}
          <LoomText style={[styles.buttonText, { color: palette.color }]}>{title}</LoomText>
        </>
      )}
    </Pressable>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        <LoomText serif style={[styles.pageTitle, { color: colors.foreground }]}>{title}</LoomText>
        {subtitle ? <LoomText style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>{subtitle}</LoomText> : null}
      </View>
      {action}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const colors = useRoomColors();
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityLabel={`${safeValue}% complete`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: safeValue }}
      style={[styles.progressTrack, { backgroundColor: colors.muted }]}
    >
      <View style={[styles.progressFill, { width: `${safeValue}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const statusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In progress',
  paused: 'On pause',
  completed: 'Finished',
};

export function StatusChip({ status }: { status: ProjectStatus }) {
  const colors = useRoomColors();
  const tone =
    status === 'completed'
      ? { bg: colors.completedChip, fg: colors.completedText }
      : status === 'in_progress'
        ? { bg: colors.inProgressChip, fg: colors.inProgressText }
        : status === 'paused'
          ? { bg: colors.pausedChip, fg: colors.pausedText }
          : { bg: colors.planningChip, fg: colors.planningText };
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
      <LoomText style={{ color: tone.fg, fontFamily: fonts.semibold, fontSize: 14 }}>{statusLabels[status]}</LoomText>
    </View>
  );
}

// A project on a board (#120): its name in a craft font, pinned at a slight
// tilt, with the status underneath.
export function ProjectCard({ project }: { project: Project }) {
  const colors = useColors();
  const showPercent = project.status !== 'completed' && project.completionPercent > 0;
  return (
    <BoardTile
      title={project.title}
      craft={project.craft === 'knitting' ? 'knitting' : 'crochet'}
      status={statusLabels[project.status]}
      detail={showPercent ? `${project.completionPercent}%` : undefined}
      star={<StarButton project={project} />}
      onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}
      colors={colors}
      testID={`project-card-${project.id}`}
    />
  );
}

export function EmptyState({
  title,
  body,
  actionTitle,
  onAction,
}: {
  title: string;
  body: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const colors = useRoomColors();
  return (
    <View style={[styles.empty, { borderColor: colors.stitch }]}>
      <LoomText serif style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</LoomText>
      <LoomText style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</LoomText>
      {actionTitle && onAction ? <LoomButton title={actionTitle} icon="plus" onPress={onAction} style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Gathering your projects…' }: { label?: string }) {
  const colors = useRoomColors();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <LoomText style={{ color: colors.mutedForeground, marginTop: 10 }}>{label}</LoomText>
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useRoomColors();
  return (
    <View style={[styles.errorCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <LoomText serif style={styles.emptyTitle}>Something went wrong</LoomText>
      <LoomText style={[styles.emptyBody, { color: colors.mutedForeground }]}>Your work is safe. Please try again.</LoomText>
      <LoomButton title="Try again" icon="refresh-cw" variant="secondary" onPress={onRetry} style={{ marginTop: 14 }} />
    </View>
  );
}

export function SignedInGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingState label="Loading…" />;
  if (!isSignedIn) return <Redirect href="/" />;
  return <>{children}</>;
}

export function FormFieldLabel({ children }: { children: ReactNode }) {
  const colors = useRoomColors();
  return <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 7 }}>{children}</LoomText>;
}

export function AuthFooter({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={[styles.authFooter, { borderTopColor: colors.border }]}>{children}</View>;
}

export function AuthLink({ href, children }: { href: '/(auth)/sign-in' | '/(auth)/sign-up'; children: ReactNode }) {
  const colors = useRoomColors();
  return <Link href={href} style={{ color: colors.primary, fontFamily: fonts.semibold }}>{children}</Link>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 24, lineHeight: 28, fontFamily: fonts.display },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 2, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  pageHeaderCopy: { flex: 1, gap: 5 },
  pageTitle: { fontSize: 36, lineHeight: 40, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 16, lineHeight: 23 },
  progressTrack: { height: 5, borderRadius: 9, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 9 },
  statusChip: { borderRadius: 2, paddingHorizontal: 9, paddingVertical: 5 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 2, borderStyle: 'dashed', borderRadius: 1, minHeight: 200 },
  emptyTitle: { fontSize: 25, textAlign: 'center' },
  emptyBody: { textAlign: 'center', fontSize: 16, lineHeight: 23, marginTop: 7, maxWidth: 290 },
  loading: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 200, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 2, padding: 22 },
  authFooter: { marginTop: 20, borderTopWidth: 1, paddingTop: 18, flexDirection: 'row', justifyContent: 'center', gap: 5 },
});
