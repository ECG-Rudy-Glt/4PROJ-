import { useState, useEffect } from 'react';
import { useTagStore } from '@/stores/useTagStore';
import { Tag, File } from '@/types';
import { tagService } from '@/services/tagService';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface TagSelectorProps {
  file: File;
  onTagsChanged: () => void;
}

export default function TagSelector({ file, onTagsChanged }: TagSelectorProps) {
  const { tags, loadTags } = useTagStore();
  const [isOpen, setIsOpen] = useState(false);
  const [fileTags, setFileTags] = useState<Tag[]>([]);

  useEffect(() => {
    loadTags();
    if (file.tags) {
      setFileTags(file.tags.map((ft) => ft.tag));
    }
  }, [file, loadTags]);

  const handleAddTag = async (tag: Tag) => {
    try {
      await tagService.addTagToFile(file.id, tag.id);
      setFileTags([...fileTags, tag]);
      toast.success(`Tag "${tag.name}" ajouté`);
      onTagsChanged();
      setIsOpen(false);
    } catch (error: any) {
      if (error.response?.status === 200) {
        // Tag déjà ajouté
        toast('Tag déjà ajouté à ce fichier');
      } else {
        toast.error(error.response?.data?.error || 'Échec de l\'ajout du tag');
      }
    }
  };

  const handleRemoveTag = async (tag: Tag) => {
    try {
      await tagService.removeTagFromFile(file.id, tag.id);
      setFileTags(fileTags.filter((t) => t.id !== tag.id));
      toast.success(`Tag "${tag.name}" retiré`);
      onTagsChanged();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec du retrait du tag');
    }
  };

  const availableTags = tags.filter((tag) => !fileTags.some((ft) => ft.id === tag.id));

  return (
    <div className="relative">
      {/* Current Tags */}
      <div className="flex flex-wrap gap-1.5">
        {fileTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleRemoveTag(tag)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-white hover:opacity-80 transition-opacity group"
            style={{ backgroundColor: tag.color }}
            title={`Cliquer pour retirer "${tag.name}"`}
          >
            <span>{tag.name}</span>
            <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
          </button>
        ))}

        {/* Add Tag Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-600 dark:hover:border-primary-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          title="Ajouter un tag"
        >
          <Plus className="w-3 h-3" />
          <span>Tag</span>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px] max-w-[300px]">
            {availableTags.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                <TagIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucun tag disponible</p>
                <p className="text-xs mt-1">Tous les tags sont déjà ajoutés</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {tag.name}
                    </span>
                    {tag._count && (
                      <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {tag._count.files}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
