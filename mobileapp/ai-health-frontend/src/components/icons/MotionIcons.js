import { useEffect } from "react";
import Svg, {
  G, Path, Circle, Ellipse, Rect, Mask, Defs,
  LinearGradient as SvgLinearGradient, Stop,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";

// ── Shared "piece" animation ────────────────────────────────────────────────
// Every animated icon below is built the exact same way your app already
// animates the tab bar / FAB successfully: a plain react-native View
// (Animated.View) with a `useAnimatedStyle` driving `opacity` +
// `transform: [{ scale }]` — the standard RN style-array format Reanimated's
// native side expects. Nothing inside the SVG itself is animated (no
// animatedProps on G/Rect/Path), which is what crashed the previous version —
// Reanimated's native proxy rejected an SVG `transform` string prop because
// it expects the array format, not a string, and that mismatch is a hard
// native crash, not a recoverable JS error.
//
// Each icon "piece" is its own full-size <Svg> stacked absolutely inside a
// fixed-size wrapper, so multiple pieces can be scaled/faded independently
// while still lining up into one icon.
function usePieceStyle(trigger, delay = 0, spring = true) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      spring
        ? withSpring(1, { damping: 9, stiffness: 140 })
        : withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + progress.value * 0.5 }],
  }));
}

function Piece({ trigger, delay, spring, size, children }) {
  const animatedStyle = usePieceStyle(trigger, delay, spring);
  return (
    <Animated.View
      style={[
        { position: "absolute", top: 0, left: 0, width: size, height: size },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function IconFrame({ size, children }) {
  return <Animated.View style={{ width: size, height: size }}>{children}</Animated.View>;
}

// ── Steps ────────────────────────────────────────────────────────────────────
// The two footprint shapes sit a little below/right of true center by design
// (a diagonal stride reads more naturally that way), so every Svg here uses a
// shifted viewBox to recenter the *visual* content in its frame instead of
// literally centering the coordinate origin.
const STEPS_VB = "0.25 1 32 32";

export function StepsIcon({ trigger, size = 24, color = "#22C55E" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox={STEPS_VB}>
          <Ellipse cx="11" cy="19" rx="4" ry="6" fill={color} transform="rotate(-12 11 19)" />
          <Circle cx="9" cy="12.5" r="1.3" fill={color} />
          <Circle cx="11.6" cy="11.6" r="1.3" fill={color} />
          <Circle cx="13.8" cy="12.6" r="1.1" fill={color} />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={130} size={size}>
        <Svg width={size} height={size} viewBox={STEPS_VB}>
          <Ellipse cx="21.5" cy="15" rx="4" ry="6" fill={color} transform="rotate(10 21.5 15)" />
          <Circle cx="19.6" cy="8" r="1.1" fill={color} />
          <Circle cx="21.8" cy="7.3" r="1.3" fill={color} />
          <Circle cx="24" cy="8.2" r="1.3" fill={color} />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

// ── Water ────────────────────────────────────────────────────────────────────
// Simple teardrop pop-in — dropped the "filling wave" version since that
// relied on the same kind of SVG-internal animated prop that crashed steps.
const DROP_PATH =
  "M16 3C16 3 6.7 14 6.7 20C6.7 25.1 10.9 29.3 16 29.3C21.1 29.3 25.3 25.1 25.3 20C25.3 14 16 3 16 3Z";

export function WaterIcon({ trigger, size = 24, color = "#3B82F6" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Path d={DROP_PATH} fill={color} opacity={0.22} />
          <Path d={DROP_PATH} fill="none" stroke={color} strokeWidth={1.8} />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

// ── Sleep ────────────────────────────────────────────────────────────────────
// Crescent via the standard two-circle mask technique (static, unanimated —
// only the wrapping Piece fades/scales in).
function CrescentShape({ color, size = 20, cutDx = 5, cutDy = -4, maskId }) {
  const r = size / 2;
  return (
    <>
      <Defs>
        <Mask id={maskId}>
          <Rect x={0} y={0} width={size} height={size} fill="white" />
          <Circle cx={r + cutDx} cy={r + cutDy} r={r * 0.9} fill="black" />
        </Mask>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={color} mask={"url(#" + maskId + ")"} />
    </>
  );
}

export function SleepIcon({ trigger, size = 24, color = "#6E3482" }) {
  const SLEEP_VB = "-2 -1 32 32";
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox={SLEEP_VB}>
          <G transform="translate(3,5)">
            <CrescentShape color={color} size={20} cutDx={6} cutDy={-4} maskId="sleepCrescent" />
          </G>
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={210} size={size}>
        <Svg width={size} height={size} viewBox={SLEEP_VB}>
          <Circle cx="23" cy="11" r="1.5" fill={color} />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={330} size={size}>
        <Svg width={size} height={size} viewBox={SLEEP_VB}>
          <Circle cx="25" cy="17" r="1" fill={color} />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

// ── Manual food log ───────────────────────────────────────────────────────────
export function ManualLogIcon({ trigger, size = 22, color = "#F59E0B" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Rect x="6" y="5" width="16" height="22" rx="3.5" fill="none" stroke={color} strokeWidth="2.2" />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={150} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Rect x="10" y="12" width="8" height="2" rx="1" fill={color} />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={230} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Rect x="10" y="17" width="5" height="2" rx="1" fill={color} />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={340} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Rect x="18" y="19.5" width="11" height="3.2" rx="1.5" fill={color} transform="rotate(45 18 19.5)" />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

// ── Meal-type icons (food logging page) ──────────────────────────────────────
export function SunriseIcon({ trigger, size = 22, color = "#FF8F00" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Defs>
            <Mask id="sunriseSky">
              <Rect x="0" y="0" width="32" height="21" fill="white" />
            </Mask>
          </Defs>
          <Circle cx="16" cy="20" r="7" fill={color} mask="url(#sunriseSky)" />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={160} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <G stroke={color} strokeWidth="2" strokeLinecap="round">
            <Path d="M16 4v3" />
            <Path d="M5 15h3" />
            <Path d="M27 15h3" />
            <Path d="M8.5 7.5l2 2" />
            <Path d="M23.5 7.5l-2 2" />
          </G>
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={70} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Rect x="4" y="24" width="24" height="2.4" rx="1.2" fill={color} />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

export function SunIcon({ trigger, size = 22, color = "#F59E0B" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Circle cx="16" cy="16" r="7" fill={color} />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={160} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <G stroke={color} strokeWidth="2" strokeLinecap="round">
            <Path d="M16 3v4" />
            <Path d="M16 25v4" />
            <Path d="M3 16h4" />
            <Path d="M25 16h4" />
            <Path d="M6.5 6.5l2.8 2.8" />
            <Path d="M22.7 22.7l2.8 2.8" />
            <Path d="M25.5 6.5l-2.8 2.8" />
            <Path d="M9.3 22.7l-2.8 2.8" />
          </G>
        </Svg>
      </Piece>
    </IconFrame>
  );
}

export function MoonStarIcon({ trigger, size = 22, color = "#1E88E5" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <G transform="translate(4,4)">
            <CrescentShape color={color} size={20} cutDx={6} cutDy={-4} maskId="dinnerCrescent" />
          </G>
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={220} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Circle cx="25" cy="9" r="1.5" fill={color} />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

export function AppleIcon({ trigger, size = 22, color = "#8E24AA" }) {
  return (
    <IconFrame size={size}>
      <Piece trigger={trigger} delay={0} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Defs>
            <Mask id="appleBite">
              <Rect x="0" y="0" width="32" height="32" fill="white" />
              <Circle cx="16" cy="7" r="2.6" fill="black" />
            </Mask>
          </Defs>
          <Circle cx="16" cy="19" r="9.5" fill={color} mask="url(#appleBite)" />
          <Rect x="15" y="6" width="2" height="5" rx="1" fill={color} />
        </Svg>
      </Piece>
      <Piece trigger={trigger} delay={200} size={size}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Ellipse cx="20" cy="7" rx="4" ry="2.2" fill={color} transform="rotate(-30 20 7)" />
        </Svg>
      </Piece>
    </IconFrame>
  );
}

// ── Motivation card sky illustration ─────────────────────────────────────────
// A small time-of-day scene for the Home motivation card: sun rising in the
// morning, high in the afternoon, setting in the evening, and a moon +
// stars at night — over a mountain silhouette so it reads as one continuous
// "same view, different time of day" rather than an unrelated icon swap.
// Entirely static SVG (gradient defs + plain shapes) — only the wrapping
// view is animated, on the same safe opacity/scale pattern as every other
// icon here.
export function getTimeBucket() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

const SKY_SCENES = {
  morning: { sky: ["#FCEBD5", "#F5EBFA"], mountain: "#C99B6E", sun: "#FDBA55", sunCy: 58 },
  day:     { sky: ["#EDE6FB", "#F5EBFA"], mountain: "#8B7BA8", sun: "#FFC94D", sunCy: 20 },
  evening: { sky: ["#F6A66B", "#6E3482"], mountain: "#3D1F52", sun: "#FF8A5B", sunCy: 55 },
  night:   { sky: ["#170F36", "#49225B"], mountain: "#0D0820", sun: null,     sunCy: null },
};

export function MotivationSkyIllustration({ trigger, width = 118, height = 78 }) {
  const scene = SKY_SCENES[getTimeBucket()];
  const animatedStyle = usePieceStyle(trigger, 0, false);

  return (
    <Animated.View style={[{ width, height }, animatedStyle]}>
      <Svg width={width} height={height} viewBox="0 0 118 78">
        <Defs>
          <SvgLinearGradient id="motivSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={scene.sky[0]} />
            <Stop offset="1" stopColor={scene.sky[1]} />
          </SvgLinearGradient>
        </Defs>

        <Rect x="0" y="0" width="118" height="78" rx="16" fill="url(#motivSkyGrad)" />

        {scene.sun != null ? (
          <Circle cx="80" cy={scene.sunCy} r="16" fill={scene.sun} />
        ) : (
          <>
            <G transform="translate(66,10)">
              <CrescentShape color="#F5EBFA" size={26} cutDx={8} cutDy={-5} maskId="motivMoon" />
            </G>
            <Circle cx="30" cy="14" r="1.4" fill="#F5EBFA" />
            <Circle cx="40" cy="24" r="1" fill="#A56ABD" />
          </>
        )}

        <Path d="M0 78 L28 40 L46 58 L62 32 L88 60 L118 38 L118 78 Z" fill={scene.mountain} />
      </Svg>
    </Animated.View>
  );
}
