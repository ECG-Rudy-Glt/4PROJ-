import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Text,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { fileService } from '../services/fileService';
import { FileItem } from '../types';
import FileRow from './FileRow';
import EmptyState from './EmptyState';

interface Props {
  visible: boolean;
  onClose: () => void;
  onFilePress?: (file: FileItem) => void;
}

export default function SearchBar({ visible, onClose, onFilePress }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { files } = await fileService.searchFiles(text.trim());
      setResults(files);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.inputWrapper}>
            <Ionicons name="search" size={18} color={colors.neutral[400]} />
            <TextInput
              style={styles.input}
              placeholder="Rechercher des fichiers..."
              placeholderTextColor={colors.neutral[400]}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary[600]} />
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searched && !loading ? (
              <EmptyState
                icon="search-outline"
                title="Aucun résultat"
                subtitle={`Aucun fichier ne correspond à "${query}"`}
              />
            ) : !searched ? (
              <View style={styles.hint}>
                <Ionicons name="search-outline" size={40} color={colors.neutral[300]} />
                <Text style={styles.hintText}>Tapez au moins 2 caractères pour rechercher</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <FileRow
              file={item}
              onPress={() => {
                onFilePress?.(item);
                handleClose();
              }}
            />
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 42,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.neutral[900],
    paddingVertical: 0,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  hint: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.md,
  },
  hintText: {
    ...typography.bodySmall,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
