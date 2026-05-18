import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { aiService, ChatMessage } from '../../services/aiService';
import { useAuthStore } from '../../stores/useAuthStore';
import { isFeatureAvailableForPlan } from '../../constants/plans';

const BOBBY_IDLE = require('../../../assets/bobby/bobby-idle.png');
const BOBBY_WORKING = require('../../../assets/bobby/bobby-working.gif');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function AIScreen() {
  const userPlan = useAuthStore((state) => state.user?.plan);
  const canUseAi = isFeatureAvailableForPlan(userPlan, 'aiChat');
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Bonjour, je suis Bobby. Comment puis-je vous aider avec vos fichiers ?',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!canUseAi) {
      Toast.show({ type: 'info', text1: 'Bobby nécessite le plan PRO ou supérieur' });
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatMessage[] = messages
        .filter((m) => m.id !== '1')
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));

      const res = await aiService.chat(text, history);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: res.response, sender: 'ai', timestamp: new Date() },
      ]);
    } catch (error: any) {
      if (error?.response?.data?.code === 'PLAN_UPGRADE_REQUIRED') {
        Toast.show({ type: 'info', text1: 'Bobby nécessite le plan PRO ou supérieur' });
      } else {
        Toast.show({ type: 'error', text1: 'Erreur de connexion avec Bobby' });
      }
    } finally {
      setLoading(false);
    }
  };

  const openPlans = () => {
    const base = process.env.EXPO_PUBLIC_API_URL ?? 'https://supfile.fr';
    const rootUrl = base.replace(/\/api\/?$/, '').replace(/\/$/, '');
    Linking.openURL(`${rootUrl}/plans`).catch(() => {
      Toast.show({ type: 'error', text1: 'Impossible d’ouvrir la page des plans' });
    });
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <ExpoImage source={loading ? BOBBY_WORKING : BOBBY_IDLE} style={styles.headerAvatar} contentFit="contain" />
        <View>
          <Text style={styles.headerTitle}>Bobby</Text>
          <Text style={styles.headerSub}>{loading ? 'En train de répondre...' : 'Assistant IA'}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardDismissMode="interactive"
      >
        {!canUseAi ? (
          <View style={styles.upgradeCard}>
            <View style={styles.upgradeIcon}>
              <Ionicons name="sparkles" size={28} color={colors.primary[600]} />
            </View>
            <Text style={styles.upgradeTitle}>Bobby est inclus à partir du plan PRO</Text>
            <Text style={styles.upgradeText}>
              Passez à un plan supérieur pour utiliser l'assistant IA, analyser vos fichiers et lancer des recherches intelligentes.
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={openPlans}>
              <Text style={styles.upgradeButtonText}>Voir les plans</Text>
            </TouchableOpacity>
          </View>
        ) : messages.map((msg) => (
          <View key={msg.id} style={[styles.bubble, msg.sender === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={[styles.bubbleText, msg.sender === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI]}>
              {msg.text}
            </Text>
            <Text style={[styles.bubbleTime, msg.sender === 'user' ? styles.bubbleTimeUser : styles.bubbleTimeAI]}>
              {formatTime(msg.timestamp)}
            </Text>
          </View>
        ))}
        {canUseAi && loading && (
          <View style={styles.loadingRow}>
            <ExpoImage source={BOBBY_WORKING} style={styles.bobbySm} contentFit="contain" />
            <View style={[styles.bubble, styles.bubbleAI]}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={canUseAi ? 'Posez une question sur vos fichiers...' : 'Plan PRO requis pour utiliser Bobby'}
          placeholderTextColor={colors.neutral[400]}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={canUseAi}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canUseAi || !input.trim() || loading}
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.neutral[800],
  },
  headerSub: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    ...shadows.sm,
  },
  bubbleText: {
    ...typography.body,
  },
  bubbleTextUser: {
    color: colors.white,
  },
  bubbleTextAI: {
    color: colors.neutral[800],
  },
  bubbleTime: {
    ...typography.caption,
    marginTop: 4,
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  bubbleTimeAI: {
    color: colors.neutral[400],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  input: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.neutral[900],
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.neutral[300],
  },
  headerAvatar: {
    width: 44,
    height: 44,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  bobbySm: {
    width: 32,
    height: 32,
  },
  upgradeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  upgradeIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    marginBottom: spacing.md,
  },
  upgradeTitle: {
    ...typography.h4,
    color: colors.neutral[900],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  upgradeText: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  upgradeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
  },
  upgradeButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
