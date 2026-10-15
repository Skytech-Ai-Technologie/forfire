export function toCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`
}

export function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function exportFolderName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}
