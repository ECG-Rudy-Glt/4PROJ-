import React from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

interface Props {
  visible: boolean;
  value: string;
  onChangeText: (t: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NewFolderModal({ visible, value, onChangeText, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Nouveau dossier</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom du dossier"
            placeholderTextColor={colors.neutral[400]}
            value={value}
            onChangeText={onChangeText}
            autoFocus
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConfirm, !value.trim() && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={!value.trim()}
            >
              <Text style={styles.btnConfirmText}>Créer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
      padding: spacing.xl,
      ...shadows['2xl'],
    },
    title: {
      ...typography.h4,
      color: colors.neutral[800],
      marginBottom: spacing.lg,
    },
    input: {
      backgroundColor: colors.neutral[50],
      borderWidth: 1,
      borderColor: colors.neutral[200],
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.neutral[900],
      marginBottom: spacing.xl,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    btnCancel: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    btnCancelText: {
      ...typography.button,
      color: colors.neutral[500],
    },
    btnConfirm: {
      backgroundColor: colors.primary[600],
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    btnConfirmText: {
      ...typography.button,
      color: '#FFFFFF',
    },
  });
}
