export const collectFilesFromEntry = async (entry: any): Promise<globalThis.File[]> => {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: globalThis.File) => {
        // Enregistrer le chemin relatif s'il est disponible
        if (entry.fullPath) {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath,
            writable: false,
          });
        }
        resolve([file]);
      });
    });
  }

  if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries: any[] = [];

    const readEntries = (): Promise<any[]> => {
      return new Promise((resolve) => {
        reader.readEntries((results: any[]) => resolve(results));
      });
    };

    let batch;
    do {
      batch = await readEntries();
      entries.push(...batch);
    } while (batch.length > 0);

    const nestedFiles = await Promise.all(entries.map((child) => collectFilesFromEntry(child)));
    return nestedFiles.flat();
  }

  return [];
};

export const extractDroppedFiles = async (e: React.DragEvent): Promise<globalThis.File[]> => {
  const items = Array.from(e.dataTransfer.items || []);
  if (items.length === 0) {
    return Array.from(e.dataTransfer.files || []);
  }

  const groupedFiles = await Promise.all(
    items.map(async (item) => {
      const withEntry = item as DataTransferItem & {
        webkitGetAsEntry?: () => any;
      };
      const entry = withEntry.webkitGetAsEntry ? withEntry.webkitGetAsEntry() : null;

      if (entry) {
        return await collectFilesFromEntry(entry);
      }

      const file = item.getAsFile();
      return file ? [file] : [];
    })
  );

  const flattened = groupedFiles.flat();
  if (flattened.length > 0) {
    return flattened;
  }

  return Array.from(e.dataTransfer.files || []);
};
