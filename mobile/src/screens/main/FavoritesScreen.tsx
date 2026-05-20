import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, AppColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useFileStore } from '../../stores/useFileStore';
import { FileItem } from '../../types';
import FileRow from '../../components/FileRow';
import EmptyState from '../../components/EmptyState';
import FilePreviewModal from '../../components/FilePreviewModal';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const favorites = useFileStore((s) => s.favorites);
  const loading = useFileStore((s) => s.loading);
  const fetchFavorites = useFileStore((s) => s.fetchFavorites);
  const toggleFavorite = useFileStore((s) => s.toggleFavorite);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [fetchFavorites])
  );

  const handleToggleFavorite = async (fileId: string) => {
    await toggleFavorite(fileId);
    if (previewFile?.id === fileId) setPreviewFile(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>{t('favorites.title')}</Text>

      <FlatList
        data={favorites}
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
