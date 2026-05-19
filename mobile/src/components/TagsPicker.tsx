import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useColors, AppColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem, Tag } from '../types';
import { tagService } from '../services/tagService';

interface Props {
  file: FileItem | null;
  onClose: () => void;
}

const PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#6366F1'];

export default function TagsPicker({ file, onClose }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!file) return;
    load();
  }, [file?.id]);

  const load = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const [tagsRes, fileTagsRes] = await Promise.all([
        tagService.getUserTags(),
        tagService.getFileTags(file.id),
      ]);
      setAllTags(tagsRes.tags);
      setAssigned(new Set(fileTagsRes.tags.map((ft) => ft.tagId)));
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger les tags' });
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tag: Tag) => {
    if (!file) return;
    const isOn = assigned.has(tag.id);
    // optimistic
    setAssigned((s) => {
      const next = new Set(s);
      isOn ? next.delete(tag.id) : next.add(tag.id);
      return next;
    });
    try {
      if (isOn) {
        await tagService.removeTagFromFile(file.id, tag.id);
      } else {
        await tagService.addTagToFile(file.id, tag.id);
      }
    } catch {
      // revert
      setAssigned((s) => {
        const next = new Set(s);
        isOn ? next.add(tag.id) : next.delete(tag.id);
        return next;
      });
      Toast.show({ type: 'error', text1: 'Erreur' });
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await tagService.createTag(name, newColor);
      setAllTags((t) => [...t, res.tag]);
      setNewName('');
      Toast.show({ type: 'success', text1: 'Tag créé' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur à la création' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    Alert.alert('Supprimer ce tag ?', `« ${tag.name} » sera retiré de tous les fichiers.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await tagService.deleteTag(tag.id);
            setAllTags((l) => l.filter((t) => t.id !== tag.id));
            setAssigned((s) => {
              const next = new Set(s);
              next.delete(tag.id);
              return next;
            });
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
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Ionicons name="pricetags-outline" size={22} color={colors.primary[600]} />
            <Text style={styles.title} numberOfLines={1}>Tags de « {file.name} »</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            {/* New tag */}
            <Text style={styles.label}>Créer un tag</Text>
            <View style={styles.newTagRow}>
              <TextInput
                style={styles.input}
                placeholder="Nom"
                placeholderTextColor={colors.neutral[400]}
                value={newName}
                onChangeText={setNewName}
              />
              <TouchableOpacity
                style={[styles.createBtn, (!newName.trim() || creating) && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                <Ionicons name="add" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.paletteRow}>
              {PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.paletteDot,
                    { backgroundColor: c },
                    newColor === c && styles.paletteDotActive,
                  ]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>

            {/* All tags */}
            <Text style={[styles.label, { marginTop: spacing.xl }]}>
              Tags disponibles {loading && '…'}
            </Text>
            {allTags.length === 0 && !loading && (
              <Text style={styles.muted}>Aucun tag. Créez-en un ci-dessus.</Text>
            )}
            {allTags.map((tag) => {
              const isOn = assigned.has(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tagRow, isOn && styles.tagRowActive]}
                  onPress={() => toggleTag(tag)}
                  onLongPress={() => handleDeleteTag(tag)}
                >
                  <View style={[styles.colorDot, { backgroundColor: tag.color }]} />
                  <Text style={styles.tagName}>{tag.name}</Text>
                  <Ionicons
                    name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isOn ? colors.primary[600] : colors.neutral[300]}
                  />
                </TouchableOpacity>
              );
            })}
            <Text style={styles.hint}>Appui long sur un tag pour le supprimer.</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    ...shadows['2xl'],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.neutral[200],
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: c.neutral[800],
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: c.neutral[500],
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  newTagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: c.neutral[900],
  },
  createBtn: {
    backgroundColor: c.primary[600],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paletteDotActive: {
    borderColor: c.neutral[800],
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tagRowActive: {
    backgroundColor: c.primary[50],
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  tagName: {
    ...typography.body,
    color: c.neutral[800],
    flex: 1,
    fontWeight: '500',
  },
  muted: {
    ...typography.caption,
    color: c.neutral[400],
    textAlign: 'center',
    padding: spacing.lg,
  },
  hint: {
    ...typography.caption,
    color: c.neutral[400],
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
