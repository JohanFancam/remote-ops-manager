import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardSection({ title, icon: Icon, extra, children, className = '' }) {
  return (
    <Card className={`bg-slate-900 border-slate-800 mb-8 ${className}`}>
      <CardHeader className="border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            {Icon ? <Icon className="h-4 w-4 text-blue-400" /> : null}
            {title}
          </CardTitle>
          {extra}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {children}
      </CardContent>
    </Card>
  );
}
