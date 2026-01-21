import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function CalendarWidget() {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const dayOfWeek = format(now, 'EEEE');
  const dayOfMonth = format(now, 'd');
  const monthYear = format(now, 'MMMM yyyy');
  const time = format(now, 'HH:mm:ss');
  
  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-slate-800 to-slate-900 text-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <Calendar className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-white/70">{dayOfWeek}</p>
              <p className="text-3xl font-bold">{dayOfMonth}</p>
              <p className="text-sm text-white/70">{monthYear}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-white/70">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Current Time</span>
            </div>
            <p className="text-2xl font-mono font-bold">{time}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}