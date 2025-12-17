import { Home, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center space-x-2 text-sm">
      <button
        onClick={() => navigate('/files')}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <Home className="w-4 h-4" />
      </button>
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center space-x-2">
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => navigate(`/files/${item.id}`)}
            className={`${
              index === items.length - 1
                ? 'text-gray-900 dark:text-white font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400'
            } transition-colors`}
          >
            {item.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
