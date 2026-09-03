import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import LucideIcon from "./ui/LucideIcon";

/**
 * Projects a GPS breadcrumb trail into a smooth SVG path inside a box of
 * `width` x `height`, preserving the route's real aspect ratio and centering
 * it with `padding` on every side. Pure client-side math — no map tiles, so
 * the render is identical every time and never depends on a network fetch
 * finishing before a screenshot or a fast list scroll happens.
 */
export function buildRoutePath(route, width, height, padding = 18) {
  if (!width || !height) return null;
  const pts = (route || []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
  if (pts.length < 2) return null;

  // Downsample very long routes — keeps the path light and the curve smooth
  // instead of jagged from thousands of raw GPS samples.
  const MAX_POINTS = 160;
  const stride = Math.max(1, Math.floor(pts.length / MAX_POINTS));
  const sampled = pts.filter((_, i) => i % stride === 0);
  if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);

  const lats = sampled.map((p) => p.lat);
  const lngs = sampled.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.00005);
  const lngRange = Math.max(maxLng - minLng, 0.00005);

  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const scale = Math.min(innerW / lngRange, innerH / latRange);
  const drawW = lngRange * scale;
  const drawH = latRange * scale;
  const offsetX = padding + (innerW - drawW) / 2;
  const offsetY = padding + (innerH - drawH) / 2;

  const projected = sampled.map((p) => ({
    x: offsetX + (p.lng - minLng) * scale,
    y: offsetY + (maxLat - p.lat) * scale, // lat grows north, screen y grows down
  }));

  // Quadratic through-midpoints gives a soft, hand-drawn ribbon feel instead
  // of sharp joints between raw GPS points.
  let d = `M ${projected[0].x.toFixed(1)} ${projected[0].y.toFixed(1)}`;
  for (let i = 1; i < projected.length - 1; i++) {
    const cur = projected[i];
    const next = projected[i + 1];
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    d += ` Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = projected[projected.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  return { path: d, start: projected[0], end: last };
}

let instanceCounter = 0;

/**
 * Self-contained "route chip" — a dark plum panel with the run's GPS trail
 * drawn as a glowing gradient line. Used for both the post-run share card
 * and the activity feed so a route reads the same branded way everywhere in
 * the app, instead of a raw map tile in one place and nothing in another.
 * Deliberately NOT a live MapView: no tile-load race before a screenshot,
 * and no N heavy MapView instances mounted at once in a scrolling feed.
 */
export default function RunRouteArt({ route, style, tint = "#C79BD6", showMarkers = true }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Unique per mounted instance — a hardcoded gradient id would be fine for
  // one card on screen, but the feed renders many RunRouteArt instances at
  // once and react-native-svg gradient ids must not collide across them.
  const [gradId] = useState(() => `routeArt-${instanceCounter++}-${Math.round(Math.random() * 1e6)}`);
  const hasRoute = (route || []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)).length >= 2;
  const routeData = useMemo(() => buildRoutePath(route, size.w, size.h), [route, size.w, size.h]);

  return (
    <View
      style={[localStyles.wrap, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
    >
      <LinearGradient
        colors={["#1A0E24", "#0B0611"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {hasRoute ? (
        routeData && size.w > 0 ? (
          <Svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`}>
            <Defs>
              <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="1" stopColor={tint} stopOpacity={1} />
              </SvgGradient>
            </Defs>
            <Path d={routeData.path} stroke={tint} strokeWidth={10} strokeOpacity={0.14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={routeData.path} stroke={tint} strokeWidth={6} strokeOpacity={0.24} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={routeData.path} stroke={`url(#${gradId})`} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {showMarkers && (
              <>
                <Circle cx={routeData.start.x} cy={routeData.start.y} r={4} fill="#0B0611" stroke="#FFFFFF" strokeWidth={2} />
                <Circle cx={routeData.end.x} cy={routeData.end.y} r={9} fill={tint} opacity={0.3} />
                <Circle cx={routeData.end.x} cy={routeData.end.y} r={4.5} fill={tint} stroke="#FFFFFF" strokeWidth={1.6} />
              </>
            )}
          </Svg>
        ) : null
      ) : (
        <View style={localStyles.fallback}>
          <LucideIcon name="map-outline" size={20} color="rgba(248,242,251,0.4)" />
          <Text style={localStyles.fallbackText}>Route unavailable</Text>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  fallbackText: { color: "rgba(248,242,251,0.4)", fontSize: 10.5, fontWeight: "600" },
});