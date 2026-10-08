export const REPORT_DAYS_PER_PAGE = 4;

export function pageReportDays(dayKeys = [], page = 0, pageSize = REPORT_DAYS_PER_PAGE) {
  const keys = Array.isArray(dayKeys) ? dayKeys : [];
  const totalPages = Math.max(1, Math.ceil(keys.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  return {
    totalPages,
    safePage,
    visible: keys.slice(safePage * pageSize, safePage * pageSize + pageSize),
  };
}
