/** Minimal RFC-4180 CSV writer with UTF-8 BOM so Excel opens Amharic correctly. */
export function toCsv(rows, columns) {
  if (!rows || rows.length === 0) {
    const header = columns.map((c) => escapeCell(c.label)).join(',');
    return `\uFEFF${header}\r\n`;
  }
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
    .join('\r\n');
  return `\uFEFF${header}\r\n${body}`;
}

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/\r?\n/g, ' ').trim();
  if (/[",;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function sendCsv(res, filename, rows, columns) {
  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

export default toCsv;
