import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { Folder } from '../../types';

interface Props {
  visible: boolean;
  folders: Folder[];
  loading: boolean;
  onClose: () => void;
  onSelectFolder: (id?: string) => void;
}

export default function BatchMoveModal({ visible, folders, loading, onClose, onSelectFolder }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Déplacer vers</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary[600]} style={{ padding: spacing.xl }} />
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity style={styles.folderItem} onPress={() => onSelectFolder(undefined)}>
                <Ionicons name="home-outline" size={20} color={colors.primary[600]} />
                <Text style={styles.folderText}>Racine</Text>
              </TouchableOpacity>
              {folders.map((f) => (
                <TouchableOpacity key={f.id} style={styles.folderItem} onPress={() => onSelectFolder(f.id)}>
                  <Ionicons name="folder-outline" size={20} color={colors.accent.bright} />
                  <Text style={styles.folderText} numberOfLines={1}>{f.name}</Text>
                </TouchableOpacity>
              ))}
              {folders.length === 0 && (
                <Text style={styles.muted}>Aucun dossier disponible</Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: borderRadius.xl,
      ...shadows['2xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral[100],
    },
    title: {
      ...typography.h4,
      color: colors.neutral[800],
    },
    folderItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral[100],
    },
    folderText: {
      ...typography.body,
      color: colors.neutral[800],
      flex: 1,
    },
    muted: {
      ...typography.caption,
      color: colors.neutral[400],
      textAlign: 'center',
      padding: spacing.lg,
    },
  });
}
