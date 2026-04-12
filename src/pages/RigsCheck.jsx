import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RigsCheckPanel from '../components/dashboard/RigsCheckPanel.jsx';
import { useApp } from '../components/AppContext';
import { CheckSquare } from 'lucide-react';

export default function RigsCheck() {
  const { isAdmin } = useApp();
  const { data: shoots = [] } = useQuery({ queryKey: ['shoots'], queryFn: () => base44.entities.Shoot.list('-date', 500) });
  const { data: rigSettings = [] } = useQuery({ queryKey: ['rigSettings'], queryFn: () => base44.entities.RigSetting.list() });
  const { data: appSettings = [] } = useQuery({ queryKey: ['appSettings'], queryFn: () => base44.entities.AppSettings.list() });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <CheckSquare className="h-6 w-6 text-orange-400" />
          <h1 className="text-2xl font-bold text-white">Rigs Check</h1>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <RigsCheckPanel shoots={shoots} rigSettings={rigSettings} appSettings={appSettings} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}