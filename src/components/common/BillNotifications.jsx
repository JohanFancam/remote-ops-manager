import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Clock, Check } from 'lucide-react';
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useTheme } from '../ThemeProvider';

export default function BillNotifications({ expenses = [] }) {
  const theme = useTheme();
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    const today = new Date();
    const upcomingBills = expenses
      .filter(exp => !exp.is_paid && exp.due_date)
      .map(exp => {
        const dueDate = parseISO(exp.due_date);
        const daysUntil = differenceInDays(dueDate, today);
        return {
          ...exp,
          dueDate,
          daysUntil,
          isOverdue: daysUntil < 0,
          isDueToday: isToday(dueDate),
          isDueTomorrow: isTomorrow(dueDate),
          isDueSoon: daysUntil >= 0 && daysUntil <= 3
        };
      })
      .filter(exp => exp.isOverdue || exp.isDueSoon)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    
    setNotifications(upcomingBills);
  }, [expenses]);
  
  const overdueCount = notifications.filter(n => n.isOverdue).length;
  const urgentCount = notifications.filter(n => n.isDueToday || n.isDueTomorrow).length;
  const hasNotifications = notifications.length > 0;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "relative text-white/80 hover:text-white hover:bg-white/10",
            hasNotifications && "text-white"
          )}
        >
          <Bell className="h-5 w-5" />
          {hasNotifications && (
            <span className={cn(
              "absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-medium",
              overdueCount > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"
            )}>
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <h3 className="font-semibold">Bill Reminders</h3>
          <p className="text-xs text-slate-500">
            {hasNotifications 
              ? `${notifications.length} upcoming or overdue bills`
              : 'No upcoming bills'}
          </p>
        </div>
        
        <div className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">All bills are paid!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((bill) => (
                <div key={bill.id} className="p-3 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      bill.isOverdue ? "bg-red-100" :
                      bill.isDueToday ? "bg-amber-100" :
                      "bg-blue-100"
                    )}>
                      {bill.isOverdue ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{bill.category}</p>
                      <p className="text-xs text-slate-500">
                        R {bill.amount?.toLocaleString()}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        bill.isOverdue ? "text-red-600 font-medium" :
                        bill.isDueToday ? "text-amber-600 font-medium" :
                        "text-slate-500"
                      )}>
                        {bill.isOverdue 
                          ? `Overdue by ${Math.abs(bill.daysUntil)} days`
                          : bill.isDueToday 
                          ? 'Due today!'
                          : bill.isDueTomorrow
                          ? 'Due tomorrow'
                          : `Due in ${bill.daysUntil} days`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}