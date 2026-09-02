"use strict";
import React, { useState, useRef, useContext, useCallback, useEffect } from "react";
import {
  Image,
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import { AuthContext } from "../../context/AuthContext";
import API from "../../services/api";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOW } from "../../constants/theme";

const BRAND_AVATAR = require("../../../assets/images/chatbot-avatar.png");

const QUICK_QUESTIONS = [
  "How am I doing today?",
  "How much water do I still need?",
  "What should I eat for my next meal?",
  "What is my workout today?",
  "How is my progress this week?",
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    anim(dot1, 0);
    anim(dot2, 150);
    anim(dot3, 300);
  }, []);

  return (
    <View style={td.wrap}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[td.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}

function RichText({ text }) {
  const lines = String(text || "").split(/\n/);

  const renderInline = (line, keyPrefix) => {
    const chunks = String(line).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return (
      <Text key={keyPrefix} style={rt.paragraph}>
        {chunks.map((chunk, i) => {
          if (/^\*\*[^*]+\*\*$/.test(chunk)) {
            return <Text key={`${keyPrefix}-b-${i}`} style={rt.bold}>{chunk.slice(2, -2)}</Text>;
          }
          if (/^`[^`]+`$/.test(chunk)) {
            return <Text key={`${keyPrefix}-c-${i}`} style={rt.code}>{chunk.slice(1, -1)}</Text>;
          }
          return chunk;
        })}
      </Text>
    );
  };

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (!trimmed) return <View key={`sp-${i}`} style={{ height: 6 }} />;

        if (/^#{1,3}\s/.test(trimmed)) {
          return (
            <Text key={`h-${i}`} style={rt.heading}>
              {trimmed.replace(/^#{1,3}\s/, "")}
            </Text>
          );
        }

        if (/^[-•]\s/.test(trimmed)) {
          return (
            <View key={`b-${i}`} style={rt.bulletRow}>
              <View style={rt.bullet} />
              <Text style={rt.listText}>{renderInline(trimmed.replace(/^[-•]\s/, ""), `bullet-${i}`).props.children}</Text>
            </View>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          return (
            <View key={`n-${i}`} style={rt.bulletRow}>
              <Text style={rt.number}>{match[1]}.</Text>
              <Text style={rt.listText}>{renderInline(match[2], `number-${i}`).props.children}</Text>
            </View>
          );
        }

        if (/^>\s?/.test(trimmed)) {
          return (
            <View key={`q-${i}`} style={rt.quote}>
              <Text style={rt.quoteText}>{trimmed.replace(/^>\s?/, "")}</Text>
            </View>
          );
        }

        return renderInline(line, `p-${i}`);
      })}
    </View>
  );
}

function FitLipCard({ card }) {
  const iconByType = {
    calories: "flame",
    protein: "dumbbell",
    hydration: "droplet",
    activity: "footprints",
    running: "route",
    workout: "dumbbell",
    weight: "scale",
  };

  return (
    <View style={fc.card}>
      <View style={fc.topRow}>
        <View style={fc.iconWrap}>
          <LucideIcon name={iconByType[card.type] || "activity"} size={17} color={COLORS.primary} />
        </View>
        <Text style={fc.title}>{card.title}</Text>
      </View>

      <Text style={fc.value}>{card.value}</Text>
      <Text style={fc.secondary}>{card.secondary}</Text>

      {typeof card.progress === "number" && (
        <View style={fc.track}>
          <View style={[fc.fill, { width: `${Math.round(card.progress * 100)}%` }]} />
        </View>
      )}

      <Text style={fc.detail}>{card.detail}</Text>
    </View>
  );
}

const ROUTES = {
  home: "/(app)/(tabs)/home",
  nutrition: "/(app)/(tabs)/diet",
  water: "/(app)/water-tracking",
  workout: "/(app)/(tabs)/workout",
  tracking: "/(app)/(tabs)/tracking",
  running: "/(app)/run-tracking",
  progress: "/(app)/nutrition/progress",
  profile: "/(app)/profile",
};

function MessageBubble({ message, onAction }) {
  const isUser = message.role === "user";
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      mb.row,
      isUser ? mb.rowUser : mb.rowAi,
      { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
    ]}>
      {!isUser && (
        <View style={mb.avatar}>
          <Image source={BRAND_AVATAR} style={mb.avatarImage} />
        </View>
      )}

      <View style={mb.contentWrap}>
        <View style={[mb.bubble, isUser ? mb.bubbleUser : mb.bubbleAi]}>
          {isUser ? (
            <Text style={mb.textUser}>{message.content}</Text>
          ) : (
            <RichText text={message.content} />
          )}

          {!isUser && Array.isArray(message.cards) && message.cards.map((card, i) => (
            <FitLipCard key={`${message.id}-card-${i}`} card={card} />
          ))}

          {!isUser && Array.isArray(message.actions) && message.actions.length > 0 && (
            <View style={mb.actions}>
              {message.actions.map((action, i) => (
                <TouchableOpacity
                  key={`${message.id}-action-${i}`}
                  style={mb.actionChip}
                  onPress={() => onAction(action)}
                  activeOpacity={0.75}
                >
                  <Text style={mb.actionText}>{action.label}</Text>
                  <LucideIcon name="arrow-up-right" size={13} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[mb.time, isUser ? mb.timeUser : mb.timeAi]}>
            {message.time}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const mb = StyleSheet.create({
  avatarImage: { width: 28, height: 28, borderRadius: 14 },
  row: { flexDirection: "row", marginBottom: 14, alignItems: "flex-end", gap: 8 },
  rowUser: { justifyContent: "flex-end" },
  rowAi: { justifyContent: "flex-start" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    justifyContent: "center", alignItems: "center",
  },
  contentWrap: { maxWidth: "86%" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 5 },
  bubbleAi: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 5,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    ...SHADOW,
  },
  textUser: { color: "#fff", ...TYPOGRAPHY.bodyMedium },
  time: { fontSize: 10, marginTop: 7 },
  timeUser: { color: "rgba(255,255,255,0.62)", textAlign: "right" },
  timeAi: { color: COLORS.textMuted },
  actions: { gap: 7, marginTop: 10 },
  actionChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: 38, paddingHorizontal: 11,
    borderRadius: 10, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
  },
  actionText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: "700" },
});

const rt = StyleSheet.create({
  paragraph: { ...TYPOGRAPHY.body, color: COLORS.textDark },
  bold: { fontWeight: "700", color: COLORS.textDark },
  code: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, color: COLORS.primaryDark },
  heading: { ...TYPOGRAPHY.h3, color: COLORS.textDark, marginBottom: 5, marginTop: 2 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 8 },
  number: { width: 18, color: COLORS.primary, fontWeight: "700", fontSize: 13, marginTop: 1 },
  listText: { flex: 1, ...TYPOGRAPHY.body, color: COLORS.textDark },
  quote: { borderLeftWidth: 3, borderLeftColor: COLORS.primaryLight, paddingLeft: 10, paddingVertical: 3, marginTop: 4 },
  quoteText: { ...TYPOGRAPHY.body, color: COLORS.textLight, fontStyle: "italic" },
});

const fc = StyleSheet.create({
  card: {
    marginTop: 10, backgroundColor: COLORS.background,
    borderRadius: 13, padding: 12,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  title: { ...TYPOGRAPHY.label, color: COLORS.textLight, flex: 1 },
  value: { marginTop: 8, ...TYPOGRAPHY.h2, color: COLORS.textDark },
  secondary: { marginTop: 2, fontSize: 12, color: COLORS.textMuted },
  track: { height: 6, backgroundColor: COLORS.surfaceMuted, borderRadius: 3, marginTop: 10, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.primary },
  detail: { marginTop: 7, fontSize: 11, color: COLORS.textMuted },
});

export default function AiChatScreen() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi${user?.name ? ` ${user.name}` : ""} 👋\n\nI’m your **FitLip Coach**. I can use your current meals, hydration, workouts, runs, activity and progress to help you make better decisions.\n\nTry asking me what you should focus on today.`,
      time: formatTime(new Date()),
      cards: [],
      actions: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get("/nutrition/ai-chat");
        const stored = res.data?.messages || [];
        if (!cancelled && stored.length > 0) {
          setMessages((prev) => [
            prev[0],
            ...stored.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              time: m.ts ? formatTime(new Date(m.ts)) : "",
              cards: [],
              actions: [],
            })),
          ]);
        }
      } catch (err) {
        console.warn("Could not load chat history:", err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleAction = useCallback((action) => {
    const target = ROUTES[action?.target];
    if (target) router.push(target);
  }, [router]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const now = new Date();
    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      time: formatTime(now),
      cards: [],
      actions: [],
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await API.post("/nutrition/ai-chat", { message: trimmed });
      const aiMsg = {
        id: `${Date.now()}_ai`,
        role: "assistant",
        content: res.data?.reply || "Sorry, I couldn't understand that.",
        cards: Array.isArray(res.data?.cards) ? res.data.cards : [],
        actions: Array.isArray(res.data?.actions) ? res.data.actions : [],
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const backendMsg = err.response?.data?.message;
      setMessages((prev) => [...prev, {
        id: `${Date.now()}_err`,
        role: "assistant",
        content: backendMsg || "I couldn't reach FitLip right now. Please try again.",
        cards: [],
        actions: [],
        time: formatTime(new Date()),
      }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, scrollToBottom]);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={s.header}>
          <View style={s.headerCenter}>
            <View style={s.headerAvatar}>
              <Image source={BRAND_AVATAR} style={s.headerAvatarImage} />
            </View>
            <View>
              <Text style={s.headerTitle}>FitLip Coach</Text>
              <View style={s.statusRow}>
                <View style={s.statusDot} />
                <Text style={s.headerSub}>Personalized to your FitLip data</Text>
              </View>
            </View>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          renderItem={({ item }) => <MessageBubble message={item} onAction={handleAction} />}
          ListFooterComponent={
            loading ? (
              <View style={s.typingRow}>
                <View style={mb.avatar}>
                  <Image source={BRAND_AVATAR} style={mb.avatarImage} />
                </View>
                <View style={[mb.bubbleAi, { paddingHorizontal: 14 }]}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
        />

        {messages.length <= 1 && (
          <View style={s.quickWrap}>
            <Text style={s.quickLabel}>Try FitLip Coach</Text>
            <FlatList
              horizontal
              data={QUICK_QUESTIONS}
              keyExtractor={(_, i) => i.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.quickChip}
                  onPress={() => sendMessage(item)}
                  activeOpacity={0.7}
                >
                  <Text style={s.quickChipTxt}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Ask FitLip Coach anything…"
            placeholderTextColor="#9A94AE"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <Pressable
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <LucideIcon name="send" size={16} color="#fff" />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    justifyContent: "center", alignItems: "center",
  },
  headerAvatarImage: { width: 31, height: 31, borderRadius: 10 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textDark },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  headerSub: { fontSize: 10, color: COLORS.textMuted, fontWeight: "500" },
  messageList: { padding: 16, paddingBottom: 8 },
  typingRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  quickWrap: { paddingTop: 8, paddingBottom: 4 },
  quickLabel: {
    ...TYPOGRAPHY.label, color: COLORS.textMuted,
    paddingHorizontal: 16, marginBottom: 8, textTransform: "uppercase",
  },
  quickChip: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
  },
  quickChipTxt: { fontSize: 12, color: COLORS.primaryDark, fontWeight: "600" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, gap: 8,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background,
    borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: COLORS.textDark, fontWeight: "500", maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: COLORS.primaryLight },
});
