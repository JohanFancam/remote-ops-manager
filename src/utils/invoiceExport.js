export const INVOICE_EXPORT_NAME_KEY = 'invoice_export_name';
export const DEFAULT_INVOICE_EXPORT_NAME = 'Remote Photography Invoice';

export function invoiceExportName(appSettings = []) {
  const raw = appSettings.find((item) => item.key === INVOICE_EXPORT_NAME_KEY)?.value;
  const name = String(raw || '').trim();
  return name || DEFAULT_INVOICE_EXPORT_NAME;
}

export function invoiceFilenameSlug(name) {
  const slug = String(name || DEFAULT_INVOICE_EXPORT_NAME)
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'Remote_Photography_Invoice';
}

export function invoiceFilename(name, monthKeys = []) {
  const slug = invoiceFilenameSlug(name);
  const first = monthKeys[0] || '';
  const last = monthKeys[monthKeys.length - 1] || first;
  const fullYear = monthKeys.length === 12
    && first.endsWith('-01')
    && last.endsWith('-12')
    && first.slice(0, 4) === last.slice(0, 4);
  if (monthKeys.length <= 1) return `${slug}_${first || 'export'}.csv`;
  if (fullYear) return `${slug}_${first.slice(0, 4)}.csv`;
  return `${slug}_${first}_to_${last}.csv`;
}

export function buildInvoiceCsvRows(operatorRows = []) {
  const header = ['Operator', 'Operator email', 'Total shoots', 'Earnings totals'];
  const body = operatorRows.map((row) => [
    row.name || row.email || '',
    row.email || '',
    Number(row.shoots || 0) + Number(row.pending || 0),
    Number(row.total || 0).toFixed(2),
  ]);
  const grand = operatorRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const projected = operatorRows.reduce((sum, row) => sum + Number(row.projectedTotal ?? row.total ?? 0), 0);
  const pendingCount = operatorRows.reduce((sum, row) => sum + Number(row.pending || 0), 0);
  const rows = [
    header,
    ...body,
    [],
    ['Grand total', '', '', grand.toFixed(2)],
  ];
  if (pendingCount > 0) {
    rows.push(['After pending', '', '', projected.toFixed(2)]);
  }
  return rows;
}

export function mergeInvoiceOperatorRows(monthRowSets = []) {
  const byEmail = new Map();
  monthRowSets.forEach((rows) => {
    rows.forEach((row) => {
      const email = row.email || row.name;
      if (!email) return;
      const prev = byEmail.get(email) || {
        name: row.name || email,
        email: row.email || '',
        shoots: 0,
        pending: 0,
        total: 0,
        projectedTotal: 0,
      };
      prev.name = row.name || prev.name;
      prev.email = row.email || prev.email;
      prev.shoots += Number(row.shoots || 0);
      prev.pending += Number(row.pending || 0);
      prev.total += Number(row.total || 0);
      prev.projectedTotal += Number(row.projectedTotal ?? row.total ?? 0);
      byEmail.set(email, prev);
    });
  });
  return [...byEmail.values()].sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));
}
