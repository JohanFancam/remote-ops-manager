import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, RotateCw } from 'lucide-react';
import {
  COMMON_TIMEZONES, detectTimezone, getManualTimezone,
  setDisplayTimezone, tzAbbrev,
} from '@/components/utils/timezoneUtils';

export default function TimezoneSettings() {
  const [value, setValue] = useState(getManualTimezone());
  const [applied, setApplied] = useState(false);

  const detected = detectTimezone();

  const handleApply = () => {
    setDisplayTimezone(value);
    setApplied(true);
    // Reload so every screen re-renders in the new timezone.
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-400" /> Time Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-gray-500">
          Shoot times are stored in South African time (SAST). Choose how the app displays them for you.
          Leave on Auto to use your device's current time zone ({detected}).
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-gray-400 block mb-1">Display time zone</label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="auto">Auto — my device ({detected})</SelectItem>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.tz} value={tz.tz}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApply} className="bg-blue-700 hover:bg-blue-600 gap-2">
            <RotateCw className="h-4 w-4" /> {applied ? 'Applying…' : 'Apply'}
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Currently showing times in <span className="text-gray-300">{value === 'auto' ? detected : value}</span> ({tzAbbrev(value === 'auto' ? detected : value)}).
        </p>
      </CardContent>
    </Card>
  );
}