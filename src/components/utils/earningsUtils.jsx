import jsPDF from 'jspdf';

export const BASE_RATE = 1000;
export const ADDITIONAL_RATE = 250;

export function calculateOperatorEarnings(shoots, operatorEmail) {
  const assigned = shoots.filter(s =>
    s.assigned_operators?.includes(operatorEmail) &&
    s.status !== 'cancelled'
  );

  const byDate = {};
  assigned.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  let total = 0;
  const breakdown = [];

  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dayShots]) => {
    const sorted = [...dayShots].sort((a, b) =>
      (a.game_time || a.start_time || '').localeCompare(b.game_time || b.start_time || '')
    );
    sorted.forEach((shoot, idx) => {
      const amount = idx === 0 ? BASE_RATE : ADDITIONAL_RATE;
      total += amount;
      breakdown.push({ date, shoot, amount, isAdditional: idx > 0 });
    });
  });

  return { total, breakdown };
}

export function getAllOperatorsEarnings(shoots, users) {
  const operatorEmails = [...new Set(
    shoots.flatMap(s => s.assigned_operators || []).filter(Boolean)
  )];

  return operatorEmails.map(email => {
    const user = users.find(u => u.email === email);
    const { total, breakdown } = calculateOperatorEarnings(shoots, email);
    return { email, name: user?.full_name || email, total, breakdown, shootCount: breakdown.length };
  }).sort((a, b) => b.total - a.total);
}

export function exportSummaryPDF(operators, title = 'Earnings Summary') {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Remote Ops Manager', 20, 20);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 20, 30);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 20, 38);

  let y = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Operator', 20, y);
  doc.text('Shoots', 120, y);
  doc.text('Earnings (ZAR)', 155, y);

  doc.setDrawColor(180, 180, 180);
  doc.line(20, y + 3, 190, y + 3);
  y += 12;

  doc.setFont('helvetica', 'normal');
  operators.forEach(op => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(op.name, 20, y);
    doc.text(String(op.shootCount), 120, y);
    doc.text(`R ${op.total.toLocaleString('en-ZA')}`, 155, y);
    y += 10;
  });

  const grandTotal = operators.reduce((s, o) => s + o.total, 0);
  doc.line(20, y + 2, 190, y + 2);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL', 20, y);
  doc.text(`R ${grandTotal.toLocaleString('en-ZA')}`, 155, y);

  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

export function exportOperatorPDF(operatorData) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Remote Ops Manager', 20, 20);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(`Earnings Report: ${operatorData.name}`, 20, 30);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Email: ${operatorData.email}`, 20, 38);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 20, 45);

  let y = 62;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Date', 20, y);
  doc.text('Shoot', 55, y);
  doc.text('Type', 135, y);
  doc.text('Amount', 165, y);

  doc.setDrawColor(180, 180, 180);
  doc.line(20, y + 3, 190, y + 3);
  y += 12;

  doc.setFont('helvetica', 'normal');
  operatorData.breakdown.forEach(item => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(item.date || '', 20, y);
    const title = (item.shoot?.title || '').substring(0, 35);
    doc.text(title, 55, y);
    doc.text(item.isAdditional ? 'Additional' : 'Main', 135, y);
    doc.text(`R ${item.amount.toLocaleString('en-ZA')}`, 165, y);
    y += 10;
  });

  doc.line(20, y + 2, 190, y + 2);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 20, y);
  doc.text(`R ${operatorData.total.toLocaleString('en-ZA')}`, 165, y);

  doc.save(`Earnings_${operatorData.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}