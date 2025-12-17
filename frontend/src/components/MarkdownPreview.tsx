import { useState, useEffect } from 'react';
import { File } from '@/types';
import { fileService } from '@/services/fileService';
import { Loader2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownPreviewProps {
  file: File;
  isShared?: boolean;
}

// Language display names
const languageNames: Record<string, string> = {
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  js: 'JavaScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  py: 'Python',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Zsh',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  sql: 'SQL',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  prisma: 'Prisma',
  html: 'HTML',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  markdown: 'Markdown',
  md: 'Markdown',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  dockerfile: 'Dockerfile',
  docker: 'Docker',
  graphql: 'GraphQL',
  text: 'Text',
};

// Map language aliases to Prism language names
const languageMap: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  dockerfile: 'docker',
  prisma: 'javascript', // Fallback for prisma
};

interface CodeBlockProps {
  code: string;
  language: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for non-secure contexts (HTTP)
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('Échec de la copie');
    }
  };

  const displayLang = languageNames[language.toLowerCase()] || language.toUpperCase() || 'Code';
  const prismLang = languageMap[language.toLowerCase()] || language.toLowerCase() || 'text';

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-gray-700">
        <span className="text-xs font-medium text-gray-400">{displayLang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copié !</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      {/* Code */}
      <SyntaxHighlighter
        language={prismLang}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          background: '#1e1e1e',
        }}
        showLineNumbers={code.split('\n').length > 3}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: '#6e7681',
          userSelect: 'none',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// Parse markdown content
interface ParsedContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseMarkdownContent(text: string): ParsedContent[] {
  const parts: ParsedContent[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add code block
    parts.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || 'text',
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return parts;
}

// Parse markdown text to HTML (without code blocks)
function parseMarkdownText(text: string): string {
  let html = text;

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Headers
  html = html.replace(/^###### (.*$)/gm, '<h6 class="text-base font-semibold text-gray-900 dark:text-white mt-6 mb-2">$1</h6>');
  html = html.replace(/^##### (.*$)/gm, '<h5 class="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2">$1</h5>');
  html = html.replace(/^#### (.*$)/gm, '<h4 class="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">$1</h4>');
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-4xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b-2 border-gray-300 dark:border-gray-600">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.*?)__/g, '<strong class="font-bold">$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del class="line-through text-gray-500">$1</del>');

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gm, '<blockquote class="border-l-4 border-primary-600 pl-4 py-2 my-4 bg-primary-50 dark:bg-primary-900/20 text-gray-700 dark:text-gray-300 italic rounded-r">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-8 border-gray-300 dark:border-gray-600" />');
  html = html.replace(/^\*\*\*$/gm, '<hr class="my-8 border-gray-300 dark:border-gray-600" />');
  html = html.replace(/^___$/gm, '<hr class="my-8 border-gray-300 dark:border-gray-600" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-300 hover:underline font-medium">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4 shadow-md" />');

  // Unordered lists
  html = html.replace(/^\* (.*$)/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300">$1</li>');
  html = html.replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300">$1</li>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal text-gray-700 dark:text-gray-300">$1</li>');

  // Wrap consecutive list items
  html = html.replace(/(<li class="ml-4 list-disc[^>]*>.*<\/li>\n?)+/g, '<ul class="my-4 space-y-1 list-disc list-inside">$&</ul>');
  html = html.replace(/(<li class="ml-4 list-decimal[^>]*>.*<\/li>\n?)+/g, '<ol class="my-4 space-y-1 list-decimal list-inside">$&</ol>');

  // Task lists / checkboxes
  html = html.replace(/\[ \]/g, '<input type="checkbox" disabled class="mr-2 rounded" />');
  html = html.replace(/\[x\]/gi, '<input type="checkbox" disabled checked class="mr-2 rounded text-primary-600" />');

  // Paragraphs
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    if (line.match(/^<[a-z]|^\s*$/i)) return line;
    if (line.trim() === '') return '';
    return `<p class="text-gray-700 dark:text-gray-300 leading-relaxed my-3">${line}</p>`;
  });
  html = processedLines.join('\n');

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

export default function MarkdownPreview({ file, isShared = false }: MarkdownPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        const streamUrl = isShared ? fileService.getSharedFileStreamUrl(file.id) : fileService.getStreamUrl(file.id);
        const response = await fetch(streamUrl, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement du fichier');
        }
        
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [file.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-gray-500 dark:text-gray-400">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[70vh] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <p className="text-red-500 mb-2">Erreur</p>
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const parsedContent = parseMarkdownContent(content);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-inner overflow-hidden">
      <div className="p-8 h-[70vh] overflow-y-auto">
        {parsedContent.map((part, index) => {
          if (part.type === 'code') {
            return (
              <CodeBlock
                key={index}
                code={part.content}
                language={part.language || 'text'}
              />
            );
          }
          
          return (
            <div
              key={index}
              className="prose prose-lg dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: parseMarkdownText(part.content) }}
            />
          );
        })}
      </div>
    </div>
  );
}
