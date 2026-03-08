import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Shield, User, Trash2, AlertCircle } from 'lucide-react';

export default function Settings() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['allUsers'] });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole === 'admin' ? 'admin' : 'user');
      setInviteEmail('');
      setInviteMsg(`✓ Invite sent to ${inviteEmail}`);
      refresh();
    } catch (e) {
      setInviteMsg('Failed to send invite. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (userId) => {
    await base44.entities.User.delete(userId);
    setDeleteConfirm(null);
    refresh();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* My Profile */}
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader className="border-b border-gray-800 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" /> My Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-blue-400">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{user?.full_name || 'Unnamed'}</p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
                <Badge className={`mt-1 text-xs ${user?.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                  {user?.role === 'admin' ? '⚡ Admin' : '📡 Remote Operator'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Management — Admin only */}
        {isAdmin && (
          <>
            {/* Invite */}
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-green-400" /> Invite User
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 text-sm"
                  >
                    <option value="user">Remote Operator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="bg-green-700 hover:bg-green-600">
                    {inviting ? 'Sending...' : 'Invite'}
                  </Button>
                </div>
                {inviteMsg && (
                  <p className={`text-sm mt-2 ${inviteMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{inviteMsg}</p>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" /> Team Members ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-800">
                  {users.map(u => (
                    <div key={u.id} className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0">
                          {u.full_name?.charAt(0) || u.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{u.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`text-xs border ${u.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                          {u.role === 'admin' ? <><Shield className="h-3 w-3 mr-1 inline" />Admin</> : '📡 Remote'}
                        </Badge>
                        {/* Don't allow deleting yourself */}
                        {u.id !== user?.id && (
                          <>
                            {deleteConfirm === u.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400">Confirm?</span>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-900/30" onClick={() => handleDelete(u.id)}>Yes</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(null)}>No</Button>
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-600 hover:text-red-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(u.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-gray-500 text-sm p-6 text-center">No users found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}