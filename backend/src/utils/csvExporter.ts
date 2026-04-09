import { stringify } from 'csv-stringify/sync';
import { Response } from 'express';

interface SendCsvOptions {
  /** Colonnes à inclure (et ordre). Si absent, toutes les clés du premier objet sont utilisées. */
  columns?: string[];
  /** Préfixe BOM UTF-8 pour compatibilité Excel. Défaut : false. */
  bom?: boolean;
}

/**
 * Sérialise `rows` en CSV et envoie la réponse HTTP avec les bons headers.
 */
export function sendCsv(
  res: Response,
  rows: object[],
  fileName: string,
  options: SendCsvOptions = {}
): void {
  const csv = stringify(rows, {
    header: true,
    ...(options.columns ? { columns: options.columns } : {}),
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.status(200).send(options.bom ? `\uFEFF${csv}` : csv);
}

/**
 * Génère un nom de fichier CSV horodaté.
 * Exemple : `sendCsvFilename('supfile-users')` → `supfile-users-2025-04-09.csv`
 */
export function csvFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().split('T')[0]}.csv`;
}
