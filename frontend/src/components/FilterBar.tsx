import { useState, useRef, useEffect } from 'react';
import { Filter, X, Calendar, FileType, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FilterBarProps {
    onFilterChange: (filters: FilterState) => void;
    onClearFilters: () => void;
}

export interface FilterState {
    mimeType?: string;
    minSize?: number;
    maxSize?: number;
    dateFrom?: string;
    dateTo?: string;
}

export function FilterBar({ onFilterChange, onClearFilters }: FilterBarProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({});
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleApply = () => {
        onFilterChange(filters);
        setIsOpen(false);
    };

    const handleClear = () => {
        setFilters({});
        onClearFilters();
        setIsOpen(false);
    };

    const activeFiltersCount = Object.keys(filters).length;

    return (
        <div className="relative mb-4" ref={containerRef}>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center px-4 py-2 rounded-lg border transition-all ${isOpen || activeFiltersCount > 0
                        ? 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                        }`}
                >
                    <Filter className="w-4 h-4 mr-2" />
                    {t('filter_bar.button')}
                    {activeFiltersCount > 0 && (
                        <span className="ml-2 bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
                            {activeFiltersCount}
                        </span>
                    )}
                </button>

                {activeFiltersCount > 0 && (
                    <button
                        onClick={handleClear}
                        className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    >
                        <X className="w-4 h-4 mr-1" />
                        {t('filter_bar.clear')}
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-20">
                    <div className="space-y-4">
                        {/* Type de fichier */}
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <FileType className="w-4 h-4 mr-2" />
                                {t('filter_bar.file_type')}
                            </label>
                            <select
                                value={filters.mimeType || ''}
                                onChange={(e) => setFilters({ ...filters, mimeType: e.target.value || undefined })}
                                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="">{t('filter_bar.type_all')}</option>
                                <option value="image">{t('filter_bar.type_image')}</option>
                                <option value="video">{t('filter_bar.type_video')}</option>
                                <option value="audio">{t('filter_bar.type_audio')}</option>
                                <option value="application/pdf">{t('filter_bar.type_pdf')}</option>
                                <option value="text">{t('filter_bar.type_document')}</option>
                                <option value="application/vnd.openxmlformats-officedocument">{t('filter_bar.type_office')}</option>
                                <option value="application/zip">{t('filter_bar.type_archive')}</option>
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <Calendar className="w-4 h-4 mr-2" />
                                {t('filter_bar.creation_date')}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={filters.dateFrom || ''}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                    className="rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    placeholder={t('filter_bar.date_from')}
                                />
                                <input
                                    type="date"
                                    value={filters.dateTo || ''}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                    className="rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    placeholder={t('filter_bar.date_to')}
                                />
                            </div>
                        </div>

                        {/* Taille */}
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <HardDrive className="w-4 h-4 mr-2" />
                                {t('filter_bar.size')}
                            </label>
                            <div className="flex gap-2">
                                <select
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val) {
                                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const { minSize: _min, maxSize: _max, ...rest } = filters;
                                            setFilters(rest);
                                        } else if (val === 'small') {
                                            setFilters({ ...filters, maxSize: 1024 * 1024 }); // < 1MB
                                        } else if (val === 'medium') {
                                            setFilters({ ...filters, minSize: 1024 * 1024, maxSize: 10 * 1024 * 1024 }); // 1-10MB
                                        } else if (val === 'large') {
                                            setFilters({ ...filters, minSize: 10 * 1024 * 1024, maxSize: 100 * 1024 * 1024 }); // 10-100MB
                                        } else if (val === 'huge') {
                                            setFilters({ ...filters, minSize: 100 * 1024 * 1024 }); // > 100MB
                                        }
                                    }}
                                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                >
                                    <option value="">{t('filter_bar.size_all')}</option>
                                    <option value="small">{t('filter_bar.size_small')}</option>
                                    <option value="medium">{t('filter_bar.size_medium')}</option>
                                    <option value="large">{t('filter_bar.size_large')}</option>
                                    <option value="huge">{t('filter_bar.size_huge')}</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleApply}
                            className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            {t('filter_bar.apply')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
