import { useEffect } from "react";
import Svg, {
  G, Path, Circle, Ellipse, Rect, Mask, Defs,
  LinearGradient as SvgLinearGradient, RadialGradient, Stop,
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

// Copy for the motivation card header — swaps with the scene so the whole
// card (not just the background) feels tied to the time of day.
export function getMotivationCopy(bucket = getTimeBucket()) {
  switch (bucket) {
    case "morning":
      return { label: "GOOD MORNING", hint: "Early effort compounds all day long.", Icon: SunriseIcon };
    case "day":
      return { label: "MIDDAY MOMENTUM", hint: "Keep the streak alive — you're halfway there.", Icon: SunIcon };
    case "evening":
      return { label: "GOOD EVENING", hint: "Finish today stronger than you started it.", Icon: SunIcon };
    default:
      return { label: "LATE NIGHT FOCUS", hint: "Rest well — tomorrow is a fresh rep.", Icon: MoonStarIcon };
  }
}

// Wide viewBox so the scene reads as a real horizon rather than a cropped
// square, and each bucket carries its own palette, glow, and set-dressing
// (birds at dawn/dusk, clouds by day, stars at night) so the card feels like
// one continuous "same view, different time" illustration.
const SKY_SCENES = {
  morning: {
    sky: ["#FDE7C8", "#F7E4F2"],
    horizonGlow: "#FFC978",
    mountain: "#C99B6E",
    mountainFar: "#E7C29A",
    sun: "#FFB84D",
    sunCy: 76,
    stars: [],
    clouds: [{ cx: 60, cy: 26, rx: 20, ry: 7 }, { cx: 155, cy: 18, rx: 26, ry: 8 }],
    birds: [],
  },
  day: {
    sky: ["#EFE7FC", "#F7E4F2"],
    horizonGlow: null,
    mountain: "#8B7BA8",
    mountainFar: "#BBA9D6",
    sun: "#FFC94D",
    sunCy: 26,
    stars: [],
    clouds: [{ cx: 44, cy: 22, rx: 22, ry: 8 }, { cx: 172, cy: 34, rx: 18, ry: 6.5 }, { cx: 110, cy: 16, rx: 14, ry: 5.5 }],
    birds: [],
  },
  evening: {
    sky: ["#F8A667", "#5B2E73", "#2A1440"],
    horizonGlow: "#FF8A5B",
    mountain: "#2A1440",
    mountainFar: "#4A2560",
    sun: "#FF7A50",
    sunCy: 72,
    stars: [{ cx: 24, cy: 14, r: 1 }, { cx: 200, cy: 10, r: 1.1 }],
    clouds: [],
    birds: [{ x: 40, y: 30 }, { x: 52, y: 24 }, { x: 150, y: 20 }],
  },
  night: {
    sky: ["#140C30", "#3B1D52"],
    horizonGlow: null,
    mountain: "#0B0620",
    mountainFar: "#170F36",
    sun: null,
    sunCy: null,
    stars: [
      { cx: 22, cy: 14, r: 1.2 }, { cx: 46, cy: 26, r: 0.9 }, { cx: 78, cy: 12, r: 1.1 },
      { cx: 118, cy: 22, r: 0.9 }, { cx: 150, cy: 14, r: 1.3 }, { cx: 176, cy: 30, r: 1 },
      { cx: 200, cy: 18, r: 0.9 }, { cx: 92, cy: 34, r: 0.8 },
    ],
    clouds: [],
    birds: [],
  },
};

const SCENE_VB_W = 220;
const SCENE_VB_H = 92;

export function MotivationSkyIllustration({ trigger, width = 220, height = 92 }) {
  const bucket = getTimeBucket();
  const scene = SKY_SCENES[bucket];
  const animatedStyle = usePieceStyle(trigger, 0, false);

  return (
    <Animated.View style={[{ width, height, overflow: "hidden" }, animatedStyle]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${SCENE_VB_W} ${SCENE_VB_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <SvgLinearGradient id="motivSkyGrad" x1="0" y1="0" x2="0" y2="1">
            {scene.sky.map((color, i) => (
              <Stop key={i} offset={i / Math.max(scene.sky.length - 1, 1)} stopColor={color} />
            ))}
          </SvgLinearGradient>
          {scene.sun != null && (
            <RadialGradient id="motivSunGlow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={scene.sun} stopOpacity="0.55" />
              <Stop offset="1" stopColor={scene.sun} stopOpacity="0" />
            </RadialGradient>
          )}
        </Defs>

        {/* full-bleed sky */}
        <Rect x="0" y="0" width={SCENE_VB_W} height={SCENE_VB_H} fill="url(#motivSkyGrad)" />

        {/* warm horizon band for sunrise / sunset */}
        {scene.horizonGlow != null && (
          <Rect x="0" y={SCENE_VB_H - 34} width={SCENE_VB_W} height="34" fill={scene.horizonGlow} opacity="0.28" />
        )}

        {/* stars */}
        {scene.stars.map((s, i) => (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#FDF6FF" opacity={0.55 + (i % 3) * 0.15} />
        ))}

        {/* clouds */}
        {scene.clouds.map((c, i) => (
          <Ellipse key={i} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} fill="#FFFFFF" opacity="0.35" />
        ))}

        {/* birds — simple dawn/dusk silhouette strokes */}
        {scene.birds.map((b, i) => (
          <Path
            key={i}
            d={`M${b.x - 5} ${b.y} Q${b.x - 2.5} ${b.y - 4} ${b.x} ${b.y} Q${b.x + 2.5} ${b.y - 4} ${b.x + 5} ${b.y}`}
            stroke="#2A1440"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
        ))}

        {/* sun / moon */}
        {scene.sun != null ? (
          <>
            <Circle cx={SCENE_VB_W - 60} cy={scene.sunCy} r="34" fill="url(#motivSunGlow)" />
            <Circle cx={SCENE_VB_W - 60} cy={scene.sunCy} r="15" fill={scene.sun} />
          </>
        ) : (
          <>
            <G transform={`translate(${SCENE_VB_W - 54},14)`}>
              <CrescentShape color="#F5EBFA" size={26} cutDx={8} cutDy={-5} maskId="motivMoon" />
            </G>
          </>
        )}

        {/* layered mountains for depth */}
        <Path
          d={`M0 ${SCENE_VB_H} L36 ${SCENE_VB_H - 40} L64 ${SCENE_VB_H - 18} L96 ${SCENE_VB_H - 48} L132 ${SCENE_VB_H - 20} L168 ${SCENE_VB_H - 46} L${SCENE_VB_W} ${SCENE_VB_H - 24} L${SCENE_VB_W} ${SCENE_VB_H} Z`}
          fill={scene.mountainFar}
          opacity="0.75"
        />
        <Path
          d={`M0 ${SCENE_VB_H} L26 ${SCENE_VB_H - 26} L52 ${SCENE_VB_H - 8} L86 ${SCENE_VB_H - 34} L118 ${SCENE_VB_H - 10} L154 ${SCENE_VB_H - 30} L${SCENE_VB_W} ${SCENE_VB_H - 14} L${SCENE_VB_W} ${SCENE_VB_H} Z`}
          fill={scene.mountain}
        />
      </Svg>
    </Animated.View>
  );
}
