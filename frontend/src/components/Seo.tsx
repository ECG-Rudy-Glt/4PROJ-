import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  robots?: string;
}

const getFrontendOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'https://supfile.tech';
};

const upsertMeta = (attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
};

const upsertCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
};

export default function Seo({ title, description, canonicalPath, robots }: SeoProps) {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
      upsertMeta('name', 'twitter:description', description);
    }

    upsertMeta('property', 'og:title', title);
    upsertMeta('name', 'twitter:title', title);

    if (robots) {
      upsertMeta('name', 'robots', robots);
    }

    if (canonicalPath) {
      const canonicalUrl = new URL(canonicalPath, getFrontendOrigin()).toString();
      upsertCanonical(canonicalUrl);
      upsertMeta('property', 'og:url', canonicalUrl);
    }
  }, [canonicalPath, description, robots, title]);

  return null;
}
