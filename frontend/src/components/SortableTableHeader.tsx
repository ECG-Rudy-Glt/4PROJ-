import { ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

type SortOrder = 'asc' | 'desc';

interface SortableTableHeaderProps {
  field: string;
  label: ReactNode;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (field: string, order: SortOrder) => void;
  defaultOrder?: SortOrder;
  className?: string;
}

export default function SortableTableHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  defaultOrder = 'asc',
  className = '',
}: SortableTableHeaderProps) {
  const isActive = sortBy === field;
  const nextOrder: SortOrder = isActive ? (sortOrder === 'asc' ? 'desc' : 'asc') : defaultOrder;
  const Icon = isActive ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-6 py-3 text-left text-xs font-semibold uppercase ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field, nextOrder)}
        className={`group inline-flex min-h-8 items-center gap-1.5 rounded-md -ml-2 px-2 text-xs font-semibold uppercase transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
          isActive
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        <span>{label}</span>
        <Icon
          className={`h-3.5 w-3.5 transition-opacity ${
            isActive
              ? 'opacity-100'
              : 'opacity-50 group-hover:opacity-100'
          }`}
        />
      </button>
    </th>
  );
}
