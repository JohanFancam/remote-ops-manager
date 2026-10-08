import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardSection({ title, icon: Icon, extra, children, className = '' }) {
  return (
    <Card className={`mb-8 border-0 bg-slate-900 shadow-none ${className}`}>
      <CardHeader className="border-0 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            {Icon ? <Icon className="h-4 w-4 text-orange-400" /> : null}
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
