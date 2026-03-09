import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Shield, User, Trash2, RefreshCw, Phone, PhoneOff, MessageSquare, Save } from 'lucide-react';

const SLACK_PHASES = [
  { key: 'setup_complete', label: 'Setup Complete', placeholder: '🔧 Setup complete — {team} shoot ready to go!' },
  { key: 'pre_shoot_started', label: 'Pre-Shoot Started', placeholder: '📸 Pre-shoot started — {team}' },
  { key: 'attention_started', label: 'Attention Started', placeholder: '⚠️ Attention phase started — {team}' },
  { key: 'sound_started', label: 'Sound Started', placeholder: '🔊 Sound check in progress — {team}' },
];

export default function Settings() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [slackMsgs, setSlackMsgs] = useState({});
  const [slackSaved, setSlackSaved] = useState(false);
  const [standbyDone, setStandbyDone] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: isAdmin,
  });

  // Load slack message settings
  useEffect(() => {
    if (!appSettings.length) return;
    const msgs = {};
    SLACK_PHASES.forEach(p => {
      const setting = appSettings.find(s => s.key === `slack_${p.key}`);
      if (setting) msgs[p.key] = setting.value;
    });
    setSlackMsgs(msgs);
  }, [appSettings]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

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
      setInviteMsg('Failed to send invite.');
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (userId) => {
    await base44.entities.User.delete(userId);
    setDeleteConfirm(null);
    refresh();
  };

  const handleSetAdminLevel = async (userId, level) => {
    await base44.entities.User.update(userId, { admin_level: level });
    refresh();
  };

  const handleStandbyToggle = async () => {
    const current = user?.standby || false;
    await base44.auth.updateMe({ standby: !current });
    setStandbyDone(true);
    setTimeout(() => setStandbyDone(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
  };

  const handleSaveSlackMessages = async () => {
    for (const phase of SLACK_PHASES) {
      if (slackMsgs[phase.key] !== undefined) {
        const existing = appSettings.find(s => s.key === `slack_${phase.key}`);
        if (existing) {
          await base44.entities.AppSettings.update(existing.id, { value: slackMsgs[phase.key] });
        } else {
          await base44.entities.AppSettings.create({ key: `slack_${phase.key}`, value: slackMsgs[phase.key] });
        }
      }
    }
    setSlackSaved(true);
    setTimeout(() => setSlackSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const isStandby = user?.standby === true;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh App
          </Button>
        </div>

        {/* My Profile */}
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader className="border-b border-gray-800 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" /> My Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-blue-400">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-white">{user?.full_name || 'Unnamed'}</p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
                <Badge className={`mt-1 text-xs ${user?.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                  {user?.role === 'admin' ? `⚡ Admin Level ${user?.admin_level ?? 1}` : '📡 Remote Operator'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Standby Toggle — Admin only */}
        {isAdmin && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader className="border-b border-gray-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Phone className="h-5 w-5 text-yellow-400" /> Standby Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-gray-400 text-sm mb-4">
                When on standby, your name will appear in operator shoot details as the contact person.
              </p>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${isStandby ? 'border-yellow-700 bg-yellow-950/30' : 'border-gray-700 bg-gray-800/40'}`}>
                  {isStandby ? <Phone className="h-4 w-4 text-yellow-400" /> : <PhoneOff className="h-4 w-4 text-gray-500" />}
                  <span className={isStandby ? 'text-yellow-300 font-medium text-sm' : 'text-gray-400 text-sm'}>
                    {isStandby ? 'On Standby' : 'Not on Standby'}
                  </span>
                </div>
                <Button
                  onClick={handleStandbyToggle}
                  className={isStandby ? 'bg-gray-700 hover:bg-gray-600' : 'bg-yellow-700 hover:bg-yellow-600'}
                  size="sm"
                >
                  {standbyDone ? '✓ Saved' : isStandby ? 'Go Off Standby' : 'Go On Standby'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Slack Messages — Level 1 Admin only */}
        {isLevel1Admin && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader className="border-b border-gray-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-400" /> Phase Slack Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs text-gray-500">Use <code className="text-blue-400">{'{team}'}</code> to insert the team/client name dynamically.</p>
              {SLACK_PHASES.map(phase => (
                <div key={phase.key}>
                  <label className="text-xs text-gray-400 block mb-1">{phase.label}</label>
                  <Input
                    placeholder={phase.placeholder}
                    value={slackMsgs[phase.key] || ''}
                    onChange={e => setSlackMsgs({ ...slackMsgs, [phase.key]: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 text-sm"
                  />
                </div>
              ))}
              <Button onClick={handleSaveSlackMessages} className="bg-green-700 hover:bg-green-600 gap-2">
                <Save className="h-4 w-4" /> {slackSaved ? '✓ Saved!' : 'Save Messages'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* User Management — Admin only */}
        {isAdmin && (
          <>
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-green-400" /> Invite User
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex gap-3 flex-wrap">
                  <Input
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1 min-w-40"
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 text-sm"
                  >
                    <option value="user">Remote Operator</option>
                    {isLevel1Admin && <option value="admin">Admin</option>}
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

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" /> Team Members ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-800">
                  {users.map(u => (
                    <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0">
                          {u.full_name?.charAt(0) || u.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{u.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          {u.standby && <span className="text-xs text-yellow-400">📞 On Standby</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-xs border ${u.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                          {u.role === 'admin' ? `⚡ L${u.admin_level ?? 1}` : '📡'}
                        </Badge>
                        {/* Level 1 admin can set admin levels for other admins */}
                        {isLevel1Admin && u.role === 'admin' && u.id !== user?.id && (
                          <select
                            value={u.admin_level ?? 1}
                            onChange={e => handleSetAdminLevel(u.id, Number(e.target.value))}
                            className="bg-gray-800 border border-gray-700 text-white rounded px-1.5 py-0.5 text-xs"
                          >
                            <option value={1}>L1 Full</option>
                            <option value={2}>L2 Restricted</option>
                          </select>
                        )}
                        {isLevel1Admin && u.id !== user?.id && (
                          <>
                            {deleteConfirm === u.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-400">Sure?</span>
                                <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-red-900/30" onClick={() => handleDelete(u.id)}>Yes</Button>
                                <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(null)}>No</Button>
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
                  {users.length === 0 && <p className="text-gray-500 text-sm p-6 text-center">No users found.</p>}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}