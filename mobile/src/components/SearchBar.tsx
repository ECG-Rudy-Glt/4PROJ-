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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { fileService } from '../services/fileService';
import { FileItem } from '../types';
import FileRow from './FileRow';
import EmptyState from './EmptyState';

interface Props {
  visible: boolean;
  onClose: () => void;
  onFilePress?: (file: FileItem) => void;
}

type TypeFilter = 'all' | 'image' | 'document' | 'video' | 'audio';

const TYPE_FILTERS: { key: TypeFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Tout', icon: 'apps-outline' },
  { key: 'image', label: 'Images', icon: 'image-outline' },
  { key: 'document', label: 'Documents', icon: 'document-text-outline' },
  { key: 'video', label: 'Vidéos', icon: 'videocam-outline' },
  { key: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
];

function matchesFilter(file: FileItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  const mime = file.mimeType ?? '';
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (filter === 'image') return mime.startsWith('image/');
  if (filter === 'video') return mime.startsWith('video/');
  if (filter === 'audio') return mime.startsWith('audio/');
  if (filter === 'document') {
    return (
      mime.startsWith('application/') ||
      mime === 'text/plain' ||
      ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext)
    );
  }
  return true;
}

export default function SearchBar({ visible, onClose, onFilePress }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setAllResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { files } = await fileService.searchFiles(text.trim());
      setAllResults(files);
    } catch {
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClose = () => {
    setQuery('');
    setAllResults([]);
    setSearched(false);
    setTypeFilter('all');
    onClose();
  };

  const results = allResults.filter((f) => matchesFilter(f, typeFilter));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top }]}>
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

        {/* Type filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setTypeFilter(f.key)}
              >
                <Ionicons name={f.icon} size={14} color={active ? '#fff' : colors.neutral[600]} />
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
  filterRow: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
  },
  filterLabel: {
    ...typography.caption,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  filterLabelActive: {
    color: '#fff',
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
