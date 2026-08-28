import jsPDF from 'jspdf';

export const DEFAULT_BASE_RATE = 1000;
export const DEFAULT_ADDITIONAL_RATE = 250;
export const ADDITIONAL_WINDOW_HOURS = 2;

// Parse "HH:MM" into minutes since midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Determine which shoots on a given day are "additional" (within 2hrs of a standard shoot)
// Returns array of shoot ids that are additional
export function getAdditionalShootIds(dayShots) {
  const sorted = [...dayShots].sort((a, b) => {
    const ta = timeToMinutes(a.game_time || a.start_time);
    const tb = timeToMinutes(b.game_time || b.start_time);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  const additionalIds = new Set();

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const tPrev = timeToMinutes(prev.game_time || prev.start_time);
    const tCurr = timeToMinutes(curr.game_time || curr.start_time);

    if (tPrev != null && tCurr != null) {
      const diffHours = (tCurr - tPrev) / 60;
      if (diffHours <= ADDITIONAL_WINDOW_HOURS) {
        additionalIds.add(curr.id);
      }
      // else: separate shoots — both are standard rate
    }
  }

  return additionalIds;
}

export function calculateOperatorEarnings(shoots, operatorEmail, baseRate = DEFAULT_BASE_RATE, additionalRate = DEFAULT_ADDITIONAL_RATE) {
  const safeEmail = operatorEmail?.toLowerCase()?.trim();
  const assigned = shoots.filter(s =>
    s.assigned_operators?.some(e => e?.toLowerCase()?.trim() === safeEmail)
  );
  const activeShoots = assigned.filter(s => s.status !== 'cancelled');
  const cancelledShoots = assigned.filter(s => s.status === 'cancelled');

  const byDate = {};
  activeShoots.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  let total = 0;
  const breakdown = [];

  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dayShots]) => {
    // Use auto_assigned_for as the authoritative source for "additional"
    // Fall back to time-proximity logic for shoots without that field
    const autoAdditionalIds = new Set(
      dayShots.filter(s => (s.auto_assigned_for || []).some(e => e?.toLowerCase()?.trim() === safeEmail)).map(s => s.id)
    );
    const nonAutoShots = dayShots.filter(s => !autoAdditionalIds.has(s.id));
    const proximityAdditionalIds = getAdditionalShootIds(nonAutoShots);

    const sorted = [...dayShots].sort((a, b) =>
      (timeToMinutes(a.game_time || a.start_time) || 0) - (timeToMinutes(b.game_time || b.start_time) || 0)
    );
    sorted.forEach(shoot => {
      const isAdditional = autoAdditionalIds.has(shoot.id) || proximityAdditionalIds.has(shoot.id);
      const amount = isAdditional ? additionalRate : baseRate;
      total += amount;
      breakdown.push({ date, shoot, amount, isAdditional });
    });
  });

  cancelledShoots.forEach(shoot => {
    const amount = shoot.earning_override != null ? (Number(shoot.earning_override) || 0) : 0;
    total += amount;
    breakdown.push({ date: shoot.date, shoot, amount, isAdditional: false, isCancelled: true, cancelReason: shoot.cancellation_reason });
  });

  return { total, breakdown };
}

// Per-operator monthly summary mirroring the operator-side (RemoteEarnings) logic:
//   - "additional" = auto_assigned_for (authoritative) OR time-proximity
//   - cancelled shoots earn override_fee (payment record) > earning_override (shoot) > 0
//   - payment record override_fee / is_additional override the computed values
export function getOperatorMonthlySummary(monthShoots, operatorEmail, baseRate, additionalRate, opRecords) {
  const { breakdown } = calculateOperatorEarnings(monthShoots, operatorEmail, baseRate, additionalRate);
  let activeCount = 0, cancelledCount = 0;
  const adjusted = breakdown.map(item => {
    const rec = opRecords?.find(r => r.shoot_id === item.shoot?.id);
    if (item.isCancelled) {
      let amount = item.amount;
      if (rec?.override_fee != null) amount = Number(rec.override_fee);
      cancelledCount++;
      return { ...item, amount, isAdditional: false, override_fee: rec?.override_fee, manual_additional: false, notes: rec?.notes };
    }
    let amount = item.amount;
    let isAdditional = item.isAdditional;
    if (rec?.override_fee != null) amount = Number(rec.override_fee);
    if (rec?.is_additional != null) {
      isAdditional = rec.is_additional;
      amount = rec.override_fee != null ? Number(rec.override_fee) : (isAdditional ? additionalRate : baseRate);
    }
    activeCount++;
    return { ...item, amount, isAdditional, override_fee: rec?.override_fee, manual_additional: rec?.is_additional != null, notes: rec?.notes };
  });
  const total = adjusted.reduce((s, b) => s + b.amount, 0);
  return { total, breakdown: adjusted, activeCount, cancelledCount };
}

export function getAllOperatorsEarnings(shoots, users, baseRate = DEFAULT_BASE_RATE, additionalRate = DEFAULT_ADDITIONAL_RATE) {
  const adminEmails = new Set(users.filter(u => u.role === 'admin').map(u => u.email));
  const operatorEmails = [...new Set(
    shoots.flatMap(s => s.assigned_operators || []).filter(e => e && !adminEmails.has(e))
  )];

  return operatorEmails.map(email => {
    const user = users.find(u => u.email === email);
    const { total, breakdown } = calculateOperatorEarnings(shoots, email, baseRate, additionalRate);
    return { email, name: user?.full_name || email, total, breakdown, shootCount: breakdown.length };
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
    doc.text(`R ${op.total.toLocaleString('en-ZA')}`, 155, y); y += 10;
  });
  const grandTotal = operators.reduce((s, o) => s + o.total, 0);
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL', 20, y); doc.text(`R ${grandTotal.toLocaleString('en-ZA')}`, 155, y);
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
  doc.text('Date', 20, y); doc.text('Shoot', 55, y); doc.text('Type', 135, y); doc.text('Amount', 165, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 12;
  doc.setFont('helvetica', 'normal');
  operatorData.breakdown.forEach(item => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(item.date || '', 20, y);
    doc.text((item.shoot?.title || '').substring(0, 35), 55, y);
    doc.text(item.isCancelled ? 'Cancelled' : (item.isAdditional ? 'Additional' : 'Main'), 135, y);
    doc.text(`R ${item.amount.toLocaleString('en-ZA')}`, 165, y); y += 10;
  });
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 20, y); doc.text(`R ${operatorData.total.toLocaleString('en-ZA')}`, 165, y);
  const monthSuffix = operatorData.month ? `_${operatorData.month.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  doc.save(`Earnings_${operatorData.name.replace(/[^a-zA-Z0-9]/g, '_')}${monthSuffix}.pdf`);
}