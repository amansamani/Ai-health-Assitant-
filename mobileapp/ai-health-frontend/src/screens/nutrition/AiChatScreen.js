"use strict";
import React, { useState, useRef, useContext, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import API from "../../services/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  "Can I eat rice with my condition?",
  "What's a good high-protein snack?",
  "How much water should I drink daily?",
  "What foods should I avoid for my goal?",
  "Is my calorie target correct?",
];

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0,  duration: 300, useNativeDriver: true }),
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

const td = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 },
  dot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4C2E96" },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
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
          <Ionicons name="sparkles" size={14} color="#4C2E96" />
        </View>
      )}
      <View style={[mb.bubble, isUser ? mb.bubbleUser : mb.bubbleAi]}>
        <Text style={[mb.text, isUser ? mb.textUser : mb.textAi]}>
          {message.content}
        </Text>
        <Text style={[mb.time, isUser ? mb.timeUser : mb.timeAi]}>
          {message.time}
        </Text>
      </View>
    </Animated.View>
  );
}

const mb = StyleSheet.create({
  row:        { flexDirection: "row", marginBottom: 12, alignItems: "flex-end", gap: 8 },
  rowUser:    { justifyContent: "flex-end" },
  rowAi:      { justifyContent: "flex-start" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#EDE9FE",
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt:  { fontSize: 16 },
  bubble: {
    maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: "#4C2E96",
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  text:     { fontSize: 14, lineHeight: 21 },
  textUser: { color: "#fff", fontWeight: "500" },
  textAi:   { color: "#29195A", fontWeight: "400" },
  time:     { fontSize: 10, marginTop: 4 },
  timeUser: { color: "rgba(255,255,255,0.6)", textAlign: "right" },
  timeAi:   { color: "#9A94AE" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AiChatScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const [messages, setMessages] = useState([
    {
      id:      "welcome",
      role:    "assistant",
      content: `Hi! 👋 I'm your AI nutrition assistant.\n\nI already know your health profile — ask me anything about your diet, meals, conditions, or fitness goal.`,
      time:    formatTime(new Date()),
    },
  ]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef                     = useRef(null);

  // Chat history lives server-side for 7 days (Redis) — restore it on mount
  // so leaving and returning to this screen doesn't wipe the conversation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get("/nutrition/ai-chat");
        const stored = res.data?.messages || [];
        if (!cancelled && stored.length > 0) {
          setMessages((prev) => [
            prev[0], // keep the welcome message at the top
            ...stored.map((m) => ({
              id:      m.id,
              role:    m.role,
              content: m.content,
              time:    m.ts ? formatTime(new Date(m.ts)) : "",
            })),
          ]);
        }
      } catch (err) {
        // Non-fatal — just start fresh with the welcome message if this fails.
        console.warn("Could not load chat history:", err.message);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = {
      id:      Date.now().toString(),
      role:    "user",
      content: trimmed,
      time:    formatTime(new Date()),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await API.post("/nutrition/ai-chat", { message: trimmed });
      const aiMsg = {
        id:      Date.now().toString() + "_ai",
        role:    "assistant",
        content: res.data?.reply || "Sorry, I couldn't understand that.",
        time:    formatTime(new Date()),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = {
        id:      Date.now().toString() + "_err",
        role:    "assistant",
        content: "Sorry, something went wrong. Please try again.",
        time:    formatTime(new Date()),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading]);

  const handleQuickQuestion = (q) => sendMessage(q);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color="#1B1730" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <View style={s.headerIconWrap}>
              <Ionicons name="sparkles" size={18} color="#4C2E96" />
            </View>
            <View>
              <Text style={s.headerTitle}>AI Nutrition Coach</Text>
              <Text style={s.headerSub}>Powered by Gemini · Knows your profile</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          renderItem={({ item }) => <MessageBubble message={item} />}
          ListFooterComponent={
            loading ? (
              <View style={s.typingRow}>
                <View style={mb.avatar}>
                  <Ionicons name="sparkles" size={14} color="#4C2E96" />
                </View>
                <View style={[mb.bubbleAi, { paddingHorizontal: 14 }]}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
        />

        {/* ── Quick Questions ── */}
        {messages.length <= 1 && (
          <View style={s.quickWrap}>
            <Text style={s.quickLabel}>Quick questions</Text>
            <FlatList
              horizontal
              data={QUICK_QUESTIONS}
              keyExtractor={(_, i) => i.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.quickChip}
                  onPress={() => handleQuickQuestion(item)}
                  activeOpacity={0.7}
                >
                  <Text style={s.quickChipTxt}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Input Bar ── */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Ask about your diet, meals, conditions…"
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
              : <Ionicons name="send" size={16} color="#fff" />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3FF" },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#EDE9FE",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#EDE9FE",
    justifyContent: "center", alignItems: "center",
  },
  backIcon:     { fontSize: 18, color: "#1B1730", fontWeight: "700" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#EDE9FE",
    justifyContent: "center", alignItems: "center",
  },
  headerIcon:  { fontSize: 20 },
  headerTitle: { fontSize: 15, fontWeight: "800", color: "#1B1730" },
  headerSub:   { fontSize: 11, color: "#4C2E96", fontWeight: "500", marginTop: 1 },

  messageList: { padding: 16, paddingBottom: 8 },
  typingRow:   { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, marginBottom: 8 },

  quickWrap:  { paddingTop: 8, paddingBottom: 4 },
  quickLabel: { fontSize: 11, fontWeight: "700", color: "#9A94AE", paddingHorizontal: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  quickChip: {
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: "#E4E0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  quickChipTxt: { fontSize: 12, color: "#6B667D", fontWeight: "600" },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#EDE9FE",
    gap: 8,
  },
  input: {
    flex: 1, backgroundColor: "#F5F3FF",
    borderRadius: 22, borderWidth: 1.5, borderColor: "#E4E0F0",
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: "#1B1730", fontWeight: "500",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#4C2E96",
    justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#A78BFA" },
  sendIcon:        { fontSize: 16, color: "#fff", fontWeight: "800" },
});