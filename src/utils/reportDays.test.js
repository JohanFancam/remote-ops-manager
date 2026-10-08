import { pageReportDays } from './reportDays.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const keys = ['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-01'];
const first = pageReportDays(keys, 0, 4);
assert(first.visible.join(',') === '2026-10-08,2026-10-07,2026-10-06,2026-10-05', 'first page is 4 newest days');
assert(first.totalPages === 2, 'six days make two pages');
assert(first.safePage === 0, 'page 0 stays in range');

const second = pageReportDays(keys, 1, 4);
assert(second.visible.join(',') === '2026-10-04,2026-10-01', 'second page has the remaining days');
assert(second.safePage === 1, 'page 1 is valid');

const overflow = pageReportDays(keys, 9, 4);
assert(overflow.safePage === 1, 'overflow page clamps to last page');
assert(overflow.visible.length === 2, 'clamped page still returns leftover days');

const empty = pageReportDays([], 0, 4);
assert(empty.totalPages === 1 && empty.visible.length === 0, 'empty list has one empty page');

console.log('report day paging tests passed');
