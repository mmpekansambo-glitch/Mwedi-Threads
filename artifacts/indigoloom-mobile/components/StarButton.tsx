import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { Project } from '@workspace/api-client-react';
import {
  getGetDashboardQueryKey,
  getGetProjectQueryKey,
  getGetProjectsQueryKey,
  useStarProject,
  useUnstarProject,
} from '@workspace/api-client-react';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function StarButton({ project }: { project: Project }) {
  const colors = useColors();
  const client = useQueryClient();
  const star = useStarProject();
  const unstar = useUnstarProject();
  const refresh = {
    onSettled: () => {
      void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
      void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    },
  };
  const toggle = () => {
    if (project.starred) unstar.mutate({ projectId: project.id }, refresh);
    else star.mutate({ projectId: project.id }, refresh);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: project.starred, disabled: star.isPending || unstar.isPending }}
      accessibilityLabel={project.starred ? `Remove star from ${project.title}` : `Star ${project.title}`}
      onPress={toggle}
      disabled={star.isPending || unstar.isPending}
      hitSlop={8}
      style={[styles.button, { backgroundColor: colors.card, borderColor: project.starred ? colors.primary : colors.border }]}
      testID={`button-star-${project.id}`}
    >
      <Feather name="star" size={16} color={project.starred ? colors.primary : colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
