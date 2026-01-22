import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';

export default function UserActivityPage() {
  const { householdId, isLoading: loadingHousehold, user } = useHousehold();
  const theme = useTheme();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['userActivities', householdId],
    queryFn: () => base44.entities.UserActivity.filter({ household_id: householdId }, '-created_date', 100),
    enabled: !!householdId,
  });

  if (loadingHousehold || isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'create': return <Plus className="h-4 w-4 text-green-600" />;
      case 'update': return <Edit2 className="h-4 w-4 text-blue-600" />;
      case 'delete': return <Trash2 className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className={`text-2xl font-bold ${theme.text} mb-6`}>User Activity</h1>

        <Card className={`border-0 shadow-md ${theme.cardBg}`}>
          <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
            <CardTitle className="text-base font-semibold flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              RECENT ACTIVITY
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activities.length === 0 ? (
              <div className={`p-8 text-center ${theme.textMuted}`}>
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No activity recorded yet</p>
                <p className="text-sm mt-1">Changes made by household members will appear here</p>
              </div>
            ) : (
              <div className={`${theme.divider} divide-y`}>
                {activities.map((activity) => (
                  <div key={activity.id} className={`px-4 py-3 ${theme.hoverBg}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${getActionColor(activity.action)}`}>
                        {getActionIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${theme.text}`}>
                            {activity.user_name || activity.user_email}
                          </span>
                          {activity.user_email !== user?.email && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              Shared User
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${theme.textMuted} mt-0.5`}>
                          {activity.action === 'create' && 'Added'}
                          {activity.action === 'update' && 'Updated'}
                          {activity.action === 'delete' && 'Deleted'}
                          {' '}
                          <span className="font-medium">{activity.entity_name || activity.entity_type}</span>
                          {activity.details && ` - ${activity.details}`}
                        </p>
                        <p className={`text-xs ${theme.textMuted} mt-1`}>
                          {activity.created_date && format(parseISO(activity.created_date), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}