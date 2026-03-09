import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:text-white"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <><Check className="h-3 w-3 mr-1 text-green-400" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
    </Button>
  );
}

export default function Reports() {
  const { isAdmin } = useApp();
  const [selected, setSelected] = useState(null);

  const { data: reports = [] } = useQuery({
    queryKey: ['shootReports'],
    queryFn: () => base44.entities.ShootReport.list('-created_date', 200),
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Remote Ops Manager — Shoot Reports', 20, 20);
    doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);
    let y = 45;
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Date', 20, y); doc.text('Shoot', 55, y); doc.text('Operator', 115, y); doc.text('Issues', 162, y);
    doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 10;
    doc.setFont('helvetica', 'normal');
    reports.forEach(r => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text((r.shoot_date || r.created_date?.slice(0, 10) || '').substring(0, 12), 20, y);
      doc.text((r.shoot_title || '').substring(0, 25), 55, y);
      doc.text((r.operator_name || r.operator_email || '').substring(0, 20), 115, y);
      doc.text(r.had_issues ? 'YES' : 'No', 162, y);
      if (r.notes) {
        y += 7;
        doc.setTextColor(100, 100, 100); doc.setFontSize(7);
        doc.text(`  Notes: ${r.notes.substring(0, 80)}`, 20, y);
        doc.setTextColor(0, 0, 0); doc.setFontSize(9);
      }
      y += 10;
    });
    doc.save('Shoot_Reports.pdf');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 flex items-center justify-center">
        <p className="text-gray-500">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Shoot Reports</h1>
            <p className="text-gray-400 text-sm mt-1">{reports.length} total reports</p>
          </div>
          <Button onClick={exportPDF} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </div>

        <div className="grid gap-3">
          {reports.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">No shoot reports yet. Reports are generated when operators mark shoots complete.</p>
              </CardContent>
            </Card>
          ) : reports.map(r => (
            <Card key={r.id} className={`bg-gray-900 border-gray-800 cursor-pointer hover:border-gray-600 transition-colors ${selected?.id === r.id ? 'border-blue-700' : ''}`}
              onClick={() => setSelected(selected?.id === r.id ? null : r)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {r.had_issues
                        ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      }
                      <p className="font-semibold text-white truncate">{r.shoot_title}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 ml-6">
                      {r.shoot_date && format(new Date(r.shoot_date), 'EEE, MMM d yyyy')} · {r.operator_name || r.operator_email}
                    </p>
                  </div>
                  <Badge className={r.had_issues ? 'bg-red-500/20 text-red-400 border-red-500/30 text-xs ml-2' : 'bg-green-500/20 text-green-400 border-green-500/30 text-xs ml-2'}>
                    {r.had_issues ? 'Issues' : 'Clean'}
                  </Badge>
                </div>

                {selected?.id === r.id && (
                  <div className="mt-3 ml-6 space-y-3 border-t border-gray-800 pt-3">
                    {r.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notes:</p>
                        <p className="text-sm text-gray-300">{r.notes}</p>
                      </div>
                    )}
                    {r.slack_message && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500">Slack Message:</p>
                          <CopyBtn text={r.slack_message} />
                        </div>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{r.slack_message}</pre>
                      </div>
                    )}
                    {r.completed_at && (
                      <p className="text-xs text-gray-500">Completed: {new Date(r.completed_at).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}