"use strict";
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../../services/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

const QUICK_QUESTIONS = [
  "Can I eat rice with my condition?",
  "What's a good high-protein snack?",
  "How much water should I drink daily?",
  "Is my calorie target correct?",
];

function MessageBubble({ message, isUser }) {
  return (
    <Animated.View entering={FadeInUp.springify()} style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      {!isUser && <View style={styles.aiAvatar}><Ionicons name="sparkles" size={14} color={COLORS.accent} /></View>}
      <Text style={[styles.bubbleText, isUser && { color: '#fff' }]}>{message}</Text>
    </Animated.View>
  );
}

export default function AiChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState([{ text: "Hey! I'm your AI nutrition coach. Ask me anything! 💪", isUser: false }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await API.get('/nutrition/ai-chat');
        const hist = res.data?.messages || res.data || [];
        if (hist.length) setMessages(hist.map(m => ({ text: m.content || m.text || m.message, isUser: m.role === 'user' || m.isUser })));
      } catch (e) {}
    };
    fetchHistory();
  }, []);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setMessages(prev => [...prev, { text: msg, isUser: true }]);
    setLoading(true);
    try {
      const res = await API.post('/nutrition/ai-chat', { message: msg });
      setMessages(prev => [...prev, { text: res.data?.reply || res.data?.message || res.data?.content || 'Sorry, I could not process that.', isUser: false }]);
    } catch (e) {
      setMessages(prev => [...prev, { text: 'Oops, something went wrong. Try again!', isUser: false }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>AI Coach</Text>
          <Text style={styles.headerSub}>Powered by Gemini</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={async () => { try { await API.delete('/nutrition/ai-chat'); setMessages([]); } catch (e) {} }}>
          <Ionicons name="trash-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      <FlatList ref={flatListRef} data={messages} keyExtractor={(_, i) => String(i)} contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <MessageBubble message={item.text} isUser={item.isUser} />}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} />

      {messages.length <= 2 && (
        <View style={styles.quickWrap}>
          {QUICK_QUESTIONS.map((q, i) => (
            <TouchableOpacity key={i} style={styles.quickChip} onPress={() => sendMessage(q)}>
              <Text style={styles.quickText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput style={styles.input} placeholder="Ask me anything..." placeholderTextColor={COLORS.textTertiary} value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()} returnKeyType="send" />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!input.trim() || loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: 11, color: COLORS.textTertiary },
  messageList: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  bubble: { maxWidth: '80%', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, flexDirection: 'row', gap: SPACING.sm },
  aiBubble: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignSelf: 'flex-start' },
  userBubble: { backgroundColor: COLORS.primary, alignSelf: 'flex-end' },
  bubbleText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  aiAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  quickChip: { backgroundColor: COLORS.surface, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  quickText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingBottom: 36, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  input: { flex: 1, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, fontSize: 15, color: COLORS.textPrimary },
  sendBtn: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
});
