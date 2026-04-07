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
  // 1. Clean the input email to prevent case-sensitive misses
  const targetEmail = operatorEmail?.toLowerCase().trim();

  // 2. Filter shoots belonging to this operator
  const assigned = shoots.filter(s => {
    if (!s.assigned_operators) return false;
    
    // Check if the email exists in the operators list (handles String or Array)
    const opsList = String(s.assigned_operators).toLowerCase();
    return opsList.includes(targetEmail) && s.status !== 'cancelled';
  });

  // 3. Group by date to handle "Additional Shoot" logic
  const byDate = {};
  assigned.forEach(s => {
    if (!s.date) return;
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  let total = 0;
  const breakdown = [];

  // 4. Calculate the rates
  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dayShots]) => {
    const additionalIds = getAdditionalShootIds(dayShots);
    
    const sorted = [...dayShots].sort((a, b) =>
      (timeToMinutes(a.game_time || a.start_time) || 0) - (timeToMinutes(b.game_time || b.start_time) || 0)
    );

    sorted.forEach(shoot => {
      const isAdditional = additionalIds.has(shoot.id);
      const amount = isAdditional ? additionalRate : baseRate;
      total += amount;
      breakdown.push({ date, shoot, amount, isAdditional });
    });
  });

  return { total, breakdown };
} // <--- FUNCTION NOW CLOSES CORRECTLY HERE


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

export function exportSummaryPDF(operators, title = 'Earnings Summary') {
  const doc = new jsPDF();
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Remote Ops Manager', 20, 20);
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
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Remote Ops Manager', 20, 20);
  doc.setFontSize(13); doc.setFont('helvetica', 'normal');
  doc.text(`Earnings Report: ${operatorData.name}`, 20, 30);
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`Email: ${operatorData.email}`, 20, 38);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 20, 45);
  let y = 62;
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Date', 20, y); doc.text('Shoot', 55, y); doc.text('Type', 135, y); doc.text('Amount', 165, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 12;
  doc.setFont('helvetica', 'normal');
  operatorData.breakdown.forEach(item => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(item.date || '', 20, y);
    doc.text((item.shoot?.title || '').substring(0, 35), 55, y);
    doc.text(item.isAdditional ? 'Additional' : 'Main', 135, y);
    doc.text(`R ${item.amount.toLocaleString('en-ZA')}`, 165, y); y += 10;
  });
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 20, y); doc.text(`R ${operatorData.total.toLocaleString('en-ZA')}`, 165, y);
  doc.save(`Earnings_${operatorData.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}