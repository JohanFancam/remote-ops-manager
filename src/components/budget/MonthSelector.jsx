import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";

export default function MonthSelector({ selectedMonth, onMonthChange }) {
  const theme = useTheme();
  const currentDate = new Date(selectedMonth + "-01");
  
  const goToPrevMonth = () => {
    const prev = subMonths(currentDate, 1);
    onMonthChange(format(prev, "yyyy-MM"));
  };
  
  const goToNextMonth = () => {
    const next = addMonths(currentDate, 1);
    onMonthChange(format(next, "yyyy-MM"));
  };
  
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-lg font-semibold min-w-[140px] text-center">
        {format(currentDate, "MMMM yyyy")}
      </div>
      <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}