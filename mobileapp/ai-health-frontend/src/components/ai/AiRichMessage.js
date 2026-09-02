"use strict";

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import LucideIcon from "../ui/LucideIcon";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

function renderInline(text, baseStyle, keyPrefix = "inline") {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <Text key={key} style={[baseStyle, styles.bold]}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <Text key={key} style={[baseStyle, styles.code]}>{part.slice(1, -1)}</Text>;
    }
    return <Text key={key} style={baseStyle}>{part}</Text>;
  });
}

function normalize(content) {
  return String(content ?? "").replace(/\r\n/g, "\n").trim();
}

function MarkdownBlock({ line, index }) {
  const trimmed = line.trim();
  if (!trimmed) return <View key={`sp-${index}`} style={styles.spacer} />;

  const heading = trimmed.match(/^#{1,3}\s+(.*)$/);
  if (heading) {
    return (
      <Text key={index} style={styles.heading}>
        {renderInline(heading[1], styles.heading, `h-${index}`)}
      </Text>
    );
  }

  const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
  if (bullet) {
    return (
      <View key={index} style={styles.listRow}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.body}>{renderInline(bullet[1], styles.body, `b-${index}`)}</Text>
      </View>
    );
  }

  const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
  if (numbered) {
    return (
      <View key={index} style={styles.listRow}>
        <Text style={styles.number}>{numbered[1]}.</Text>
        <Text style={styles.body}>{renderInline(numbered[2], styles.body, `n-${index}`)}</Text>
      </View>
    );
  }

  if (trimmed.startsWith(">")) {
    return (
      <View key={index} style={styles.quoteWrap}>
        <Text style={styles.quote}>{renderInline(trimmed.replace(/^>\s?/, ""), styles.quote, `q-${index}`)}</Text>
      </View>
    );
  }

  return (
    <Text key={index} style={styles.body}>
      {renderInline(trimmed, styles.body, `p-${index}`)}
    </Text>
  );
}

function CardIcon({ type }) {
  const icon = {
    hydration: "water-outline",
    calories: "flame-outline",
    protein: "barbell-outline",
    workout: "barbell-outline",
    running: "walk-outline",
    activity: "footsteps-outline",
    weight: "scale-outline",
  }[type] || "sparkles-outline";
  return <LucideIcon name={icon} size={18} color={COLORS.primary} />;
}

export function FitLipMetricCard({ card, onAction }) {
  const title = card.title || "FitLip insight";
  const value = card.value ?? "—";
  const target = card.target;
  const unit = card.unit || "";
  const percent = Number.isFinite(Number(card.percent)) ? Math.max(0, Math.min(100, Number(card.percent))) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}><CardIcon type={card.type} /></View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {!!unit && <Text style={styles.metricUnit}>{unit}</Text>}
        {target != null && <Text style={styles.metricTarget}> / {target}{unit}</Text>}
      </View>
      {percent != null && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
      )}
      {!!card.subtitle && <Text style={styles.cardSubtitle}>{card.subtitle}</Text>}
      {!!card.actionLabel && !!onAction && (
        <Pressable style={styles.cardAction} onPress={() => onAction(card.actionTarget)}>
          <Text style={styles.cardActionText}>{card.actionLabel}</Text>
          <LucideIcon name="arrow-right" size={15} color={COLORS.primary} />
        </Pressable>
      )}
    </View>
  );
}

export default function AiRichMessage({ content, cards = [], onCardAction }) {
  const blocks = normalize(content).split("\n");
  return (
    <View style={styles.container}>
      {blocks.map((line, index) => <MarkdownBlock key={index} line={line} index={index} />)}
      {!!cards.length && (
        <View style={styles.cardsWrap}>
          {cards.map((card, index) => (
            <FitLipMetricCard key={`${card.type || "card"}-${index}`} card={card} onAction={onCardAction} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  body: { fontSize: 14, lineHeight: 21, color: COLORS.textDark },
  bold: { fontWeight: "700" },
  heading: { fontSize: 15, lineHeight: 21, fontWeight: "700", color: COLORS.textDark, marginTop: 2, marginBottom: 3 },
  code: { fontFamily: "monospace", backgroundColor: COLORS.surfaceMuted, paddingHorizontal: 3, borderRadius: 4 },
  spacer: { height: 5 },
  listRow: { flexDirection: "row", alignItems: "flex-start", paddingRight: 2, gap: 7 },
  bullet: { width: 10, fontSize: 15, lineHeight: 21, color: COLORS.primary, fontWeight: "700" },
  number: { minWidth: 18, fontSize: 13, lineHeight: 21, color: COLORS.primary, fontWeight: "700" },
  quoteWrap: { borderLeftWidth: 2, borderLeftColor: COLORS.primary, paddingLeft: 9, marginVertical: 2 },
  quote: { fontSize: 13, lineHeight: 20, color: COLORS.textLight, fontStyle: "italic" },
  cardsWrap: { marginTop: 9, gap: 8 },
  card: { borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textDark },
  metricRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
  metricValue: { fontSize: 24, lineHeight: 28, fontWeight: "800", color: COLORS.textDark },
  metricUnit: { fontSize: 12, fontWeight: "600", marginLeft: 5, color: COLORS.textLight },
  metricTarget: { fontSize: 12, color: COLORS.textMuted },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceMuted, overflow: "hidden", marginTop: 8 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  cardSubtitle: { marginTop: 7, fontSize: 12, lineHeight: 18, color: COLORS.textMuted },
  cardAction: { marginTop: 9, flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  cardActionText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
});
