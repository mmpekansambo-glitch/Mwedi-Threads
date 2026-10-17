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
import { useColors } from '@/hooks/useColors';
import { StarButton } from '@/components/StarButton';

export const fonts = {
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  display: 'Fraunces_500Medium',
  displayBold: 'Fraunces_600SemiBold',
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

export function Brand({ light = false }: { light?: boolean }) {
  const colors = useColors();
  const foreground = light ? colors.primaryForeground : colors.foreground;
  const soft = light ? colors.primaryForeground : colors.mutedForeground;
  return (
    <View style={styles.brand}>
      <View style={styles.mark}>
        <Feather name="git-merge" size={23} color={light ? colors.accent : colors.primary} />
      </View>
      <LoomText style={[styles.brandName, { color: foreground }]}>
        Mwe<LoomText style={{ color: soft, fontFamily: fonts.semibold }}>di</LoomText>
      </LoomText>
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
  const colors = useColors();
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
  const colors = useColors();
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
  const colors = useColors();
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
      <LoomText style={{ color: tone.fg, fontFamily: fonts.semibold, fontSize: 11 }}>{statusLabels[status]}</LoomText>
    </View>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const colors = useColors();
  const craft = project.craft === 'knitting' ? 'Knitting' : 'Crochet';
  return (
    <Pressable
      accessibilityRole="button"
      testID={`project-card-${project.id}`}
      onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}
      style={({ pressed }) => [
        styles.projectCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.cardArt, { backgroundColor: project.craft === 'knitting' ? colors.knitWash : colors.crochetWash }]}>
        <View style={[styles.cardOrb, { borderColor: project.craft === 'knitting' ? colors.primary : colors.accent }]} />
        <View>
          <LoomText style={[styles.cardKicker, { color: colors.mutedForeground }]}>{craft.toUpperCase()}</LoomText>
          <LoomText serif style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{project.title}</LoomText>
        </View>
        <View style={styles.cardActions}>
          <StatusChip status={project.status} />
          <StarButton project={project} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <LoomText numberOfLines={1} style={[styles.cardSub, { color: colors.mutedForeground }]}>
          {project.patternName || project.yarn || 'Your next little project'}
        </LoomText>
        <ProgressBar value={project.completionPercent} />
        <View style={styles.cardFooter}>
          <LoomText style={[styles.cardPercent, { color: colors.primary }]}>{project.completionPercent}% complete</LoomText>
          <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
        </View>
      </View>
    </Pressable>
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
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.emptyMark, { backgroundColor: colors.selectedWash }]}>
        <Feather name="feather" size={23} color={colors.primary} />
      </View>
      <LoomText serif style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</LoomText>
      <LoomText style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</LoomText>
      {actionTitle && onAction ? <LoomButton title={actionTitle} icon="plus" onPress={onAction} style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Gathering your projects…' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <LoomText style={{ color: colors.mutedForeground, marginTop: 10 }}>{label}</LoomText>
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.errorCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Feather name="alert-circle" size={22} color={colors.destructive} />
      <LoomText serif style={styles.emptyTitle}>A little snag in the thread</LoomText>
      <LoomText style={[styles.emptyBody, { color: colors.mutedForeground }]}>Your work is safe. Try loading this page again.</LoomText>
      <LoomButton title="Try again" icon="refresh-cw" variant="secondary" onPress={onRetry} style={{ marginTop: 14 }} />
    </View>
  );
}

export function SignedInGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingState label="Opening your workroom…" />;
  if (!isSignedIn) return <Redirect href="/" />;
  return <>{children}</>;
}

export function FormFieldLabel({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <LoomText style={{ color: colors.foreground, fontFamily: fonts.semibold, fontSize: 12, marginBottom: 7 }}>{children}</LoomText>;
}

export function AuthFooter({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={[styles.authFooter, { borderTopColor: colors.border }]}>{children}</View>;
}

export function AuthLink({ href, children }: { href: '/(auth)/sign-in' | '/(auth)/sign-up'; children: ReactNode }) {
  const colors = useColors();
  return <Link href={href} style={{ color: colors.primary, fontFamily: fonts.semibold }}>{children}</Link>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, letterSpacing: -0.6, fontFamily: fonts.bold },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  pageHeaderCopy: { flex: 1, gap: 5 },
  pageTitle: { fontSize: 29, letterSpacing: -0.6 },
  pageSubtitle: { fontSize: 13, lineHeight: 19 },
  progressTrack: { height: 5, borderRadius: 9, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 9 },
  statusChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  projectCard: { overflow: 'hidden', borderWidth: 1, borderRadius: 17, marginBottom: 13 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardArt: { minHeight: 95, padding: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, overflow: 'hidden' },
  cardOrb: { position: 'absolute', width: 165, height: 72, borderWidth: 1, borderRadius: 100, opacity: 0.25, right: -12, top: 8, transform: [{ rotate: '-23deg' }] },
  cardKicker: { fontSize: 9, letterSpacing: 1.1, marginBottom: 4, fontFamily: fonts.bold },
  cardTitle: { fontSize: 20, maxWidth: 180 },
  cardBody: { paddingHorizontal: 15, paddingVertical: 13, gap: 10 },
  cardSub: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPercent: { fontSize: 11, fontFamily: fonts.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, minHeight: 245 },
  emptyMark: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  emptyTitle: { fontSize: 22, textAlign: 'center' },
  emptyBody: { textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 290 },
  loading: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 240, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 18, padding: 22 },
  authFooter: { marginTop: 20, borderTopWidth: 1, paddingTop: 18, flexDirection: 'row', justifyContent: 'center', gap: 5 },
});
