import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColors, AppColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { fileService } from '../../services/fileService';
import { FileItem } from '../../types';
import FileRow from '../../components/FileRow';
import EmptyState from '../../components/EmptyState';
import FilePreviewModal from '../../components/FilePreviewModal';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const { files } = await fileService.getFavoriteFiles();
      setFiles(files);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleToggleFavorite = async (fileId: string) => {
    await fileService.toggleFavorite(fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (previewFile?.id === fileId) setPreviewFile(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>{t('favorites.title')}</Text>

      <FlatList
        data={files}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchFavorites} tintColor={colors.primary[600]} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="star-outline"
              title={t('favorites.empty_title')}
              subtitle={t('favorites.empty_sub')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <FileRow
            file={item}
            showFavorite
            onPress={() => setPreviewFile(item)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
          />
        )}
      />

      <FilePreviewModal
        file={previewFile}
        visible={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onToggleFavorite={handleToggleFavorite}
      />
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg.secondary,
  },
  title: {
    ...typography.h2,
    color: c.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
});
