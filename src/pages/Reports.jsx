import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, AlertCircle, CheckCircle2, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:text-white"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <><Check className="h-3 w-3 mr-1 text-green-400" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
    </Button>
  );
}

function exportCSV(reports, monthLabel) {
  const headers = ['Date', 'Shoot Title', 'Operator', 'Had Issues', 'Notes', 'Completed At'];
  const rows = reports.map(r => [
    r.shoot_date || r.created_date?.slice(0, 10) || '',
    `"${(r.shoot_title || '').replace(/"/g, '""')}"`,
    `"${(r.operator_name || r.operator_email || '').replace(/"/g, '""')}"`,
    r.had_issues ? 'YES' : 'No',
    `"${(r.notes || '').replace(/"/g, '""')}"`,
    r.completed_at ? new Date(r.completed_at).toLocaleString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Shoot_Reports_${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { isAdmin } = useApp();
  const [selected, setSelected] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: reports = [] } = useQuery({
    queryKey: ['shootReports'],
    queryFn: () => base44.entities.ShootReport.list('-created_date', 500),
  });

  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthLabel = format(currentMonth, 'MMMM yyyy');

  const monthReports = reports.filter(r => {
    const d = r.shoot_date || r.created_date?.slice(0, 10) || '';
    return d.startsWith(monthStr);
  });

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
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Shoot Reports</h1>
            <p className="text-gray-400 text-sm mt-1">{monthReports.length} reports in {monthLabel}</p>
          </div>
          <Button onClick={() => exportCSV(monthReports, format(currentMonth, 'yyyy-MM'))}
            variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-3 mb-6 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 w-fit">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-white font-semibold min-w-[130px] text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary row */}
        {monthReports.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white">{monthReports.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Total Reports</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{monthReports.filter(r => !r.had_issues).length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Clean</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{monthReports.filter(r => r.had_issues).length}</p>
                <p className="text-xs text-gray-400 mt-0.5">With Issues</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* List */}
        <Card className="bg-gray-900 border-gray-800">
          {monthReports.length === 0 ? (
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No reports for {monthLabel}.</p>
            </CardContent>
          ) : (
            <div className="divide-y divide-gray-800">
              {monthReports.map(r => (
                <div key={r.id}>
                  <div className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {r.had_issues
                        ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{r.shoot_title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.shoot_date && format(new Date(r.shoot_date), 'EEE, MMM d yyyy')} · {r.operator_name || r.operator_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={r.had_issues ? 'bg-red-500/20 text-red-400 border-red-500/30 text-xs' : 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'}>
                        {r.had_issues ? 'Issues' : 'Clean'}
                      </Badge>
                      <Button size="sm" variant="ghost"
                        className={`h-7 text-xs gap-1 ${selected?.id === r.id ? 'text-blue-400 bg-blue-950/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        onClick={() => setSelected(selected?.id === r.id ? null : r)}>
                        <FileText className="h-3 w-3" />
                        {selected?.id === r.id ? 'Hide' : 'Details'}
                      </Button>
                    </div>
                  </div>

                  {selected?.id === r.id && (
                    <div className="mx-4 mb-4 bg-gray-800/60 rounded-lg p-4 space-y-3 border border-gray-700">
                      {r.notes && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Notes:</p>
                          <p className="text-sm text-gray-300">{r.notes}</p>
                        </div>
                      )}
                      {r.slack_message && (
                        <div className="bg-gray-900 rounded-lg p-3">
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
                      {!r.notes && !r.slack_message && (
                        <p className="text-xs text-gray-500">No additional details for this report.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}