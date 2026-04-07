export const formatBytes = (value: number | bigint, fractionDigits: number = 2): string => {
  const bytes = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';

  const units = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];
  const base = 1024;
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );
  const scaled = bytes / Math.pow(base, index);

  return `${scaled.toFixed(index === 0 ? 0 : fractionDigits)} ${units[index]}`;
};
