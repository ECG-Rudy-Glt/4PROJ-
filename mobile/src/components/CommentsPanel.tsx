import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem, Comment } from '../types';
import { commentService } from '../services/commentService';
import { useAuthStore } from '../stores/useAuthStore';

interface Props {
  file: FileItem | null;
  onClose: () => void;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function CommentsPanel({ file, onClose }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!file) return;
    load();
  }, [file?.id]);

  const load = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await commentService.getFileComments(file.id);
      setComments(res.comments ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger les commentaires' });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!file || !content.trim()) return;
    setSending(true);
    try {
      await commentService.createComment(file.id, content.trim());
      setContent('');
      load();
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur à l\'envoi' });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (comment: Comment) => {
    Alert.alert('Supprimer ce commentaire ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await commentService.deleteComment(comment.id);
            load();
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur' });
          }
        },
      },
    ]);
  };

  if (!file) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.primary[600]} />
            <Text style={styles.title} numberOfLines={1}>Commentaires — {file.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary[600]} />
              </View>
            )}
            {!loading && comments.length === 0 && (
              <Text style={styles.muted}>Aucun commentaire — soyez le premier !</Text>
            )}
            {comments.map((c) => {
              const isMine = c.userId === currentUser?.id;
              const authorName =
                c.user?.firstName
                  ? `${c.user.firstName} ${c.user.lastName || ''}`.trim()
                  : c.user?.email || 'Anonyme';
              return (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{authorName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{authorName}</Text>
                      <Text style={styles.commentDate}>{formatDate(c.createdAt)}</Text>
                    </View>
                    <Text style={styles.commentContent}>{c.content}</Text>
                  </View>
                  {isMine && (
                    <TouchableOpacity onPress={() => handleDelete(c)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Écrire un commentaire…"
              placeholderTextColor={colors.neutral[400]}
              value={content}
              onChangeText={setContent}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!content.trim() || sending) && styles.btnDisabled]}
              onPress={handleSend}
              disabled={!content.trim() || sending}
            >
              <Ionicons name="send" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadows['2xl'],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[800],
    flex: 1,
  },
  centered: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  muted: {
    ...typography.body,
    color: colors.neutral[400],
    textAlign: 'center',
    padding: spacing.xl,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.body,
    color: colors.primary[700],
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  commentAuthor: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  commentDate: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  commentContent: {
    ...typography.body,
    color: colors.neutral[700],
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  input: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
