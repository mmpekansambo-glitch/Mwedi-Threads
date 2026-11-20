import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fonts } from '@/components/loom';

// The phone's opening (#120): on a night-mist page a violet thread draws an
// "M" over about three seconds, "Mwedi Threads" fades in under it, and then
// the whole thing fades away to show the app. It plays once each time the
// app starts, a tap skips it, and it's left out when Reduce Motion is on.

const AnimatedPath = Animated.createAnimatedComponent(Path);

const M_PATH = 'M10 120 C30 120 38 110 40 95 L48 35 C50 22 62 22 66 34 L98 118 C100 124 104 124 106 118 L136 34 C140 22 152 22 154 35 L162 100 C164 116 172 122 190 120';
const M_LENGTH = 458;
const NIGHT = '#141917';
const VIOLET = '#C3ADE4';
const NAME = '#E8EAE5';

let playedThisLaunch = false;

export function OpeningThread() {
  const [show, setShow] = useState(!playedThisLaunch);
  const draw = useRef(new Animated.Value(M_LENGTH)).current;
  const name = useRef(new Animated.Value(0)).current;
  const cover = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!show) return;
    playedThisLaunch = true;
    let animation: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) { setShow(false); return; }
      animation = Animated.parallel([
        Animated.timing(draw, { toValue: 0, delay: 300, duration: 3200, easing: Easing.bezier(0.5, 0, 0.3, 1), useNativeDriver: false }),
        Animated.timing(name, { toValue: 1, delay: 3000, duration: 800, useNativeDriver: false }),
        Animated.timing(cover, { toValue: 0, delay: 4600, duration: 700, useNativeDriver: false }),
      ]);
      animation.start(({ finished }) => { if (finished) setShow(false); });
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [show, draw, name, cover]);

  if (!show) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.cover, { opacity: cover }]} testID="opening-thread">
      <Pressable accessibilityRole="button" accessibilityLabel="Mwedi Threads. Tap to skip." onPress={() => setShow(false)} style={styles.center}>
        <Svg width={200} height={160} viewBox="0 0 200 160">
          <AnimatedPath d={M_PATH} stroke={VIOLET} strokeOpacity={0.16} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${M_LENGTH}`} strokeDashoffset={draw} />
          <AnimatedPath d={M_PATH} stroke={VIOLET} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${M_LENGTH}`} strokeDashoffset={draw} />
        </Svg>
        <Animated.Text style={[styles.name, { opacity: name }]}>Mwedi Threads</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: NIGHT, zIndex: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontSize: 28, color: NAME, marginTop: 18 },
});
