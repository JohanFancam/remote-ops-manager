import {
  DEFAULT_INVOICE_EXPORT_NAME,
  invoiceExportName,
  invoiceFilename,
  buildInvoiceCsvRows,
  mergeInvoiceOperatorRows,
} from './invoiceExport.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(invoiceExportName([]) === DEFAULT_INVOICE_EXPORT_NAME, 'default invoice name');
assert(invoiceExportName([{ key: 'invoice_export_name', value: '  Studio Invoice  ' }]) === 'Studio Invoice', 'uses saved name');
assert(invoiceFilename('Remote Photography Invoice', ['2026-10']) === 'Remote_Photography_Invoice_2026-10.csv', 'month filename');
assert(invoiceFilename('Remote Photography Invoice', ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']) === 'Remote_Photography_Invoice_2026.csv', 'year filename');

const confirmed = buildInvoiceCsvRows([
  { name: 'Maya Chen', email: 'maya.chen@example.com', shoots: 3, pending: 0, total: 3000, projectedTotal: 3000 },
]);
assert(confirmed[0].join(',') === 'Operator,Operator email,Total shoots,Earnings totals', 'header');
assert(confirmed[1][2] === 3, 'confirmed shoot count');
assert(confirmed[1][3] === '3000.00', 'confirmed earnings');
assert(confirmed.some((row) => row[0] === 'Grand total' && row[3] === '3000.00'), 'grand total');
assert(!confirmed.some((row) => row[0] === 'After pending'), 'no projection without pending');

const withPending = buildInvoiceCsvRows([
  { name: 'Sam Okonkwo', email: 'sam.okonkwo@example.com', shoots: 3, pending: 1, total: 2250, projectedTotal: 3250 },
]);
assert(withPending[1][2] === 4, 'pending counts toward total shoots');
assert(withPending.some((row) => row[0] === 'After pending' && row[3] === '3250.00'), 'adds after-pending grand total');

const merged = mergeInvoiceOperatorRows([
  [{ name: 'Maya Chen', email: 'maya.chen@example.com', shoots: 2, pending: 1, total: 2000, projectedTotal: 3000 }],
  [{ name: 'Maya Chen', email: 'maya.chen@example.com', shoots: 1, pending: 0, total: 1000, projectedTotal: 1000 }],
]);
assert(merged.length === 1, 'merges same operator');
assert(merged[0].shoots === 3 && merged[0].pending === 1, 'adds shoots across months');
assert(merged[0].total === 3000 && merged[0].projectedTotal === 4000, 'adds earnings across months');

console.log('invoiceExport.test.js: ok');
