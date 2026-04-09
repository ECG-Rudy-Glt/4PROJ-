import { useState, useEffect } from 'react';
import { useTagStore } from '@/stores/useTagStore';
import { X, Plus, Edit2, Trash2, Tag as TagIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface TagsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
];

export default function TagsManager({ isOpen, onClose }: TagsManagerProps) {
  const { t } = useTranslation();
  const { tags, loadTags, createTag, updateTag, deleteTag } = useTagStore();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen, loadTags]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error(t('tags_manager.name_required'));
      return;
    }

    try {
      await createTag(newTagName.trim(), newTagColor);
      toast.success(t('tags_manager.toast_create_success'));
      setNewTagName('');
      setNewTagColor('#6366f1');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tags_manager.toast_create_error'));
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag) return;

    try {
      await updateTag(editingTag.id, editingTag.name, editingTag.color);
      toast.success(t('tags_manager.toast_update_success'));
      setEditingTag(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tags_manager.toast_update_error'));
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm(t('tags_manager.toast_delete_confirm'))) return;

    try {
      await deleteTag(tagId);
      toast.success(t('tags_manager.toast_delete_success'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tags_manager.toast_delete_error'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <TagIcon className="w-6 h-6 text-primary-600 dark:text-primary-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tags_manager.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tags.length === 1 ? t('tags_manager.subtitle', { count: tags.length }) : t('tags_manager.subtitle_plural', { count: tags.length })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create New Tag */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              {t('tags_manager.new_tag')}
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t('tags_manager.name_placeholder')}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-16 h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
              />
              <button
                onClick={handleCreateTag}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('tags_manager.create')}
              </button>
            </div>

            {/* Color Presets */}
            <div className="flex flex-wrap gap-2 mt-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    newTagColor === color
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Tags List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              {t('tags_manager.my_tags')}
            </h3>
            {tags.length === 0 ? (
              <div className="text-center py-8">
                <TagIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">{t('tags_manager.no_tags')}</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  {t('tags_manager.no_tags_desc')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {editingTag?.id === tag.id ? (
                      <>
                        <input
                          type="color"
                          value={editingTag.color}
                          onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateTag()}
                        />
                        <button
                          onClick={handleUpdateTag}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                        >
                          {t('tags_manager.save')}
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                        >
                          {t('tags_manager.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-10 h-10 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{tag.name}</p>
                          {tag._count && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {tag._count.files === 1 ? t('tags_manager.files_count', { count: tag._count.files }) : t('tags_manager.files_count_plural', { count: tag._count.files })}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color })}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title={t('tags_manager.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title={t('tags_manager.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('tags_manager.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
