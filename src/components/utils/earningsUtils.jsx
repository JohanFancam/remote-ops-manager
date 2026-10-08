import jsPDF from 'jspdf';
import {
  formatZAR,
  formatDateZA,
  normalizeShootStatus,
} from '@/utils/shootStatus';
import { shortenTitle } from '@/components/utils/scheduleUtils';
import {
  ADDITIONAL_WINDOW_HOURS,
  DEFAULT_ADDITIONAL_RATE,
  DEFAULT_BASE_RATE,
  DEFAULT_POSTPONED_RATE,
  DEFAULT_STANDBY_RATE,
  additionalIdsForShoots,
  feeForProjectedShoot,
  feeForShoot,
  getAdditionalShootIds,
  isAwaitingApproval,
  mergeAssignedWithPending,
  operatorAssignedCost,
  operatorProjectedCost,
  operatorStandbyCost,
  operatorStandbySessions,
  pairingPoolForDay,
  timeToMinutes,
  isShootReportedComplete,
  isPendingCompletePay,
} from './earningsCost.js';

export {
  ADDITIONAL_WINDOW_HOURS,
  DEFAULT_ADDITIONAL_RATE,
  DEFAULT_BASE_RATE,
  DEFAULT_POSTPONED_RATE,
  DEFAULT_STANDBY_RATE,
  additionalIdsForShoots,
  feeForProjectedShoot,
  feeForShoot,
  getAdditionalShootIds,
  isAwaitingApproval,
  mergeAssignedWithPending,
  operatorAssignedCost,
  operatorProjectedCost,
  operatorStandbyCost,
  operatorStandbySessions,
  pairingPoolForDay,
  isShootReportedComplete,
  isPendingCompletePay,
};

function shootAmount(shoot, { baseRate, additionalRate, postponedRate, isAdditional }) {
  const status = normalizeShootStatus(shoot.status);
  if (status === 'cancelled') {
    return { amount: 0, isAdditional: false, isCancelled: true, isPostponed: false, status };
  }
  if (status === 'postponed') {
    return { amount: postponedRate, isAdditional: false, isCancelled: false, isPostponed: true, status };
  }
  return {
    amount: isAdditional ? additionalRate : baseRate,
    isAdditional: !!isAdditional,
    isCancelled: false,
    isPostponed: false,
    status,
  };
}

export function calculateOperatorEarnings(
  shoots,
  operatorEmail,
  baseRate = DEFAULT_BASE_RATE,
  additionalRate = DEFAULT_ADDITIONAL_RATE,
  postponedRate = DEFAULT_POSTPONED_RATE,
) {
  const safeEmail = operatorEmail?.toLowerCase()?.trim();
  const assigned = shoots.filter(s =>
    s.assigned_operators?.some(e => e?.toLowerCase()?.trim() === safeEmail)
  );

  const byDate = {};
  assigned.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  let total = 0;
  const breakdown = [];

  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dayShots]) => {
    // Additional pairing only among payable (non-cancelled / non-postponed) shoots
    const pairingPool = dayShots.filter(s => {
      const st = normalizeShootStatus(s.status);
      return st !== 'cancelled' && st !== 'postponed';
    });
    const autoAdditionalIds = new Set(
      pairingPool
        .filter(s => (s.auto_assigned_for || []).some(e => e?.toLowerCase()?.trim() === safeEmail))
        .map(s => s.id)
    );
    const nonAutoShots = pairingPool.filter(s => !autoAdditionalIds.has(s.id));
    const proximityAdditionalIds = getAdditionalShootIds(nonAutoShots);

    const sorted = [...dayShots].sort((a, b) =>
      (timeToMinutes(a.game_time || a.start_time) || 0) - (timeToMinutes(b.game_time || b.start_time) || 0)
    );
    sorted.forEach(shoot => {
      const isAdditional = autoAdditionalIds.has(shoot.id) || proximityAdditionalIds.has(shoot.id);
      const resolved = shootAmount(shoot, {
        baseRate,
        additionalRate,
        postponedRate,
        isAdditional,
      });
      total += resolved.amount;
      breakdown.push({
        date,
        shoot,
        amount: resolved.amount,
        isAdditional: resolved.isAdditional,
        isCancelled: resolved.isCancelled,
        isPostponed: resolved.isPostponed,
        isPendingComplete: isPendingCompletePay(shoot),
        status: resolved.status,
      });
    });
  });

  return { total, breakdown };
}

export function getAllOperatorsEarnings(
  shoots,
  users,
  baseRate = DEFAULT_BASE_RATE,
  additionalRate = DEFAULT_ADDITIONAL_RATE,
  postponedRate = DEFAULT_POSTPONED_RATE,
) {
  const adminEmails = new Set(users.filter(u => u.role === 'admin').map(u => u.email));
  const operatorEmails = [...new Set(
    shoots.flatMap(s => s.assigned_operators || []).filter(e => e && !adminEmails.has(e))
  )];

  return operatorEmails.map(email => {
    const user = users.find(u => u.email === email);
    const { total, breakdown } = calculateOperatorEarnings(
      shoots, email, baseRate, additionalRate, postponedRate
    );
    const paidShootCount = breakdown.filter(b => !b.isCancelled).length;
    return {
      email,
      name: user?.full_name || email,
      total,
      breakdown,
      shootCount: paidShootCount,
    };
  }).sort((a, b) => b.total - a.total);
}

export function exportSummaryPDF(operators, title = 'Earnings Summary', companyName = 'Fancam/CrowdIQ') {
  const doc = new jsPDF();
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(companyName, 20, 20);
  doc.setFontSize(13); doc.setFont('helvetica', 'normal');
  doc.text(title, 20, 30);
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 20, 38);
  let y = 55;
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Operator', 20, y); doc.text('Shoots', 120, y); doc.text('Earnings (ZAR)', 155, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 12;
  doc.setFont('helvetica', 'normal');
  operators.forEach(op => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(op.name, 20, y); doc.text(String(op.shootCount), 120, y);
    doc.text(formatZAR(op.total), 155, y); y += 10;
  });
  const grandTotal = operators.reduce((s, o) => s + o.total, 0);
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL', 20, y); doc.text(formatZAR(grandTotal), 155, y);
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

export function exportOperatorPDF(operatorData) {
  const doc = new jsPDF();
  const companyName = operatorData.companyName || 'Fancam/CrowdIQ';
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(companyName, 20, 20);
  doc.setFontSize(13); doc.setFont('helvetica', 'normal');
  doc.text(`Earnings Report: ${operatorData.name}`, 20, 30);
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  if (operatorData.month) doc.text(`Period: ${operatorData.month}`, 20, 38);
  doc.text(`Email: ${operatorData.email}`, 20, operatorData.month ? 45 : 38);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 20, operatorData.month ? 51 : 45);
  let y = 62;
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Date', 20, y); doc.text('Shoot', 55, y); doc.text('Type', 125, y); doc.text('Amount', 165, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 12;
  doc.setFont('helvetica', 'normal');
  operatorData.breakdown.forEach(item => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(formatDateZA(item.date) || '', 20, y);
    doc.text((shortenTitle(item.shoot?.title) || item.shoot?.title || '').substring(0, 32), 55, y);
    const typeLabel = item.isCancelled
      ? 'Cancelled'
      : item.isPostponed
        ? 'Postponed'
        : item.isAdditional
          ? 'Additional'
          : 'Main';
    doc.text(typeLabel, 125, y);
    doc.text(item.isCancelled ? 'Cancelled' : formatZAR(item.amount), 165, y); y += 10;
  });
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 20, y); doc.text(formatZAR(operatorData.total), 165, y);
  const monthSuffix = operatorData.month ? `_${operatorData.month.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  doc.save(`Earnings_${operatorData.name.replace(/[^a-zA-Z0-9]/g, '_')}${monthSuffix}.pdf`);
}
