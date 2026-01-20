import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addMonths } from "date-fns";
import { Loader2 } from "lucide-react";

export default function CopyToMonthDialog({ open, onClose, onCopy, title }) {
  const [targetMonth, setTargetMonth] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  
  // Generate next 12 months
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = addMonths(now, i);
    months.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    });
  }
  
  const handleCopy = async () => {
    if (!targetMonth) return;
    setIsCopying(true);
    await onCopy(targetMonth);
    setIsCopying(false);
    setTargetMonth('');
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy {title} to Another Month</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-slate-500 mb-4">
            Select the month you want to copy the {title.toLowerCase()} to. You can delete items you don't need after copying.
          </p>
          <Select value={targetMonth} onValueChange={setTargetMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCopy} disabled={!targetMonth || isCopying}>
            {isCopying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}