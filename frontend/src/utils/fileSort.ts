import { File } from '@/types';

type SortOrder = 'asc' | 'desc';

export const getFileTagSortValue = (file: Pick<File, 'tags'>) =>
  (file.tags || [])
    .map((fileTag) => fileTag.tag?.name || '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
    .join(' ');

const getFileSortValue = (file: File, sortBy: string) => {
  if (sortBy === 'tags') return getFileTagSortValue(file);
  if (sortBy === 'size') return Number(file.size || 0);
  if (sortBy === 'updatedAt' || sortBy === 'createdAt' || sortBy === 'deletedAt') {
    return new Date((file as any)[sortBy] || 0).getTime();
  }

  return String((file as any)[sortBy] || '').toLowerCase();
};

export const sortFilesForTable = <T extends File>(
  files: T[],
  sortBy: string,
  sortOrder: SortOrder,
  locale: string
) =>
  [...files].sort((a, b) => {
    const aValue = getFileSortValue(a, sortBy);
    const bValue = getFileSortValue(b, sortBy);

    const result = typeof aValue === 'string' && typeof bValue === 'string'
      ? aValue.localeCompare(bValue, locale, { sensitivity: 'base', numeric: true })
      : Number(aValue) - Number(bValue);

    return sortOrder === 'asc' ? result : -result;
  });
