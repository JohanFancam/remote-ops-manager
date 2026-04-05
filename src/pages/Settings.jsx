import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, UserPlus, User, Trash2, RefreshCw, Phone, PhoneOff,
  MessageSquare, Save, Image, Send, Clock, X, DollarSign, Edit2, Bell, Zap, Mail
} from 'lucide-react';

const SLACK_PHASES = [
  { key: 'setup_complete', label: 'Setup Complete', placeholder: 'Setup complete — {team} shoot ready to go!' },
  { key: 'pre_shoot_started', label: 'Pre-Shoot Started', placeholder: 'Pre-shoot started — {team}' },
  { key: 'attention_started', label: 'Attention Started', placeholder: 'Attention phase started — {team}' },
  { key: 'sound_started', label: 'Sound Started', placeholder: 'Sound check in progress — {team}' },
];

export default function Settings() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [slackMsgs, setSlackMsgs] = useState({});
  const [slackSaved, setSlackSaved] = useState(false);
  const [standbyDone, setStandbyDone] = useState(false);
  const [rateBaseInput, setRateBaseInput] = useState('');
  const [rateAdditionalInput, setRateAdditionalInput] = useState('');
  const [ratesSaved, setRatesSaved] = useState(false);
  const [notifyHoursInput, setNotifyHoursInput] = useState('5');
  const [notifySaved, setNotifySaved] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [remindersSent, setRemindersSent] = useState(false);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState(null); // null = not yet initialized
  const [emailTemplate, setEmailTemplate] = useState('');
  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState('');
  const [emailTemplateSaved, setEmailTemplateSaved] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);

  // Pending users
  const [showAddPending, setShowAddPending] = useState(false);
  const [pendingForm, setPendingForm] = useState({ full_name: '', email: '', role: 'user', notes: '' });
  const [savingPending, setSavingPending] = useState(false);
  const [invitingId, setInvitingId] = useState(null);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef();

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list('-created_date', 100),
    enabled: isAdmin,
  });

  const logoSetting = appSettings.find(s => s.key === 'app_logo_url');
  const logoUrl = logoSetting?.value;

  useEffect(() => {
    if (!appSettings.length) return;
    const msgs = {};
    SLACK_PHASES.forEach(p => {
      const setting = appSettings.find(s => s.key === `slack_${p.key}`);
      if (setting) msgs[p.key] = setting.value;
    });
    setSlackMsgs(msgs);
    const br = appSettings.find(s => s.key === 'base_rate')?.value;
    const ar = appSettings.find(s => s.key === 'additional_rate')?.value;
    if (br) setRateBaseInput(br);
    if (ar) setRateAdditionalInput(ar);
    const nh = appSettings.find(s => s.key === 'notify_hours_before')?.value;
    if (nh) setNotifyHoursInput(nh);
    const et = appSettings.find(s => s.key === 'email_reminder_template')?.value;
    if (et) setEmailTemplate(et);
    const es = appSettings.find(s => s.key === 'email_reminder_subject')?.value;
    if (es) setEmailSubjectTemplate(es);
  }, [appSettings]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
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

  const handleSaveNotifySettings = async () => {
    const key = 'notify_hours_before';
    const existing = appSettings.find(s => s.key === key);
    if (existing) {
      await base44.entities.AppSettings.update(existing.id, { value: notifyHoursInput });
    } else {
      await base44.entities.AppSettings.create({ key, value: notifyHoursInput, description: 'Hours before setup to notify operators' });
    }
    setNotifySaved(true);
    setTimeout(() => setNotifySaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const handleSendTestEmail = async () => {
    if (!user?.email) return;
    setSendingTestEmail(true);
    const subjectTpl = emailSubjectTemplate || '📡 Your Shoots This Week';
    const bodyTpl = emailTemplate || `Hi {name},\n\nHere are your upcoming shoots for the week:\n\n{shoots}\n\nCheck the Remote Ops Manager app for full details.\n\nThanks,\nRemote Ops Team`;
    const sampleShoot = `📅 Sample Shoot — Lakers vs Celtics\n🗓 Date: ${new Date().toISOString().split('T')[0]}\n⏰ Setup Time: 17:30\n🎥 Rig Type: Data\n📍 Location: Staples Center\n`;
    const body = bodyTpl
      .replace(/{name}/g, user.full_name || user.email.split('@')[0])
      .replace(/{shoots}/g, sampleShoot);
    const subject = `[TEST] ${subjectTpl.replace(/{name}/g, user.full_name || user.email.split('@')[0])}`;
    await base44.integrations.Core.SendEmail({ to: user.email, subject, body });
    setSendingTestEmail(false);
    setTestEmailSent(true);
    setTimeout(() => setTestEmailSent(false), 3000);
  };

  const handleSaveEmailTemplate = async () => {
    const pairs = [
      { key: 'email_reminder_template', value: emailTemplate, description: 'Weekly shoot reminder email body template' },
      { key: 'email_reminder_subject', value: emailSubjectTemplate, description: 'Weekly shoot reminder email subject template' },
    ];
    for (const pair of pairs) {
      const existing = appSettings.find(s => s.key === pair.key);
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value: pair.value });
      } else {
        await base44.entities.AppSettings.create(pair);
      }
    }
    setEmailTemplateSaved(true);
    setTimeout(() => setEmailTemplateSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);

    // Get shoots for the next 7 days
    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const shoots = await base44.entities.Shoot.list('date', 500);
    const upcoming = shoots.filter(s =>
      s.status !== 'cancelled' && s.status !== 'completed' &&
      s.date >= todayStr && s.date <= nextWeekStr &&
      s.assigned_operators?.length > 0
    );

    // Determine which emails are allowed
    const allowedEmails = selectedRecipients !== null
      ? selectedRecipients
      : new Set(users.filter(u => u.role !== 'admin' && u.role !== 'accounts').map(u => u.email));

    // Group shoots by operator
    const byOperator = {};
    for (const shoot of upcoming) {
      for (const email of (shoot.assigned_operators || [])) {
        const u = users.find(u => u.email === email);
        if (!u || !allowedEmails.has(email)) continue;
        if (!byOperator[email]) byOperator[email] = { user: u, shoots: [] };
        byOperator[email].shoots.push(shoot);
      }
    }

    const defaultSubject = `📡 Your Shoots This Week`;
    const defaultTemplate = `Hi {name},\n\nHere are your upcoming shoots for the week:\n\n{shoots}\n\nCheck the Remote Ops Manager app for full details.\n\nThanks,\nRemote Ops Team`;
    const defaultShootBlock = `📅 {shoot_title}\n🗓 Date: {date}\n⏰ Setup Time: {setup_time}\n🎥 Rig Type: {rig_type}\n📍 Location: {location}\n`;

    const subjectTpl = emailSubjectTemplate || defaultSubject;
    const bodyTpl = emailTemplate || defaultTemplate;

    for (const [email, { user: u, shoots: operatorShoots }] of Object.entries(byOperator)) {
      const shootsText = operatorShoots.map(s => {
        // Calculate setup time from game_time
        let setupTime = 'TBD';
        if (s.game_time) {
          const [h, m] = s.game_time.split(':').map(Number);
          const offset = s.setup_offset ?? -150;
          const totalMins = h * 60 + m + offset;
          const sh = Math.floor(((totalMins % 1440) + 1440) % 1440 / 60);
          const sm = ((totalMins % 1440) + 1440) % 1440 % 60;
          setupTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
        }
        return defaultShootBlock
          .replace('{shoot_title}', s.title)
          .replace('{date}', s.date)
          .replace('{setup_time}', setupTime)
          .replace('{rig_type}', s.rig_type_override || 'Standard')
          .replace('{location}', s.location || 'TBD');
      }).join('\n---\n\n');

      const body = bodyTpl
        .replace(/{name}/g, u.full_name || email.split('@')[0])
        .replace(/{shoots}/g, shootsText);

      const subject = subjectTpl.replace(/{name}/g, u.full_name || email.split('@')[0]);

      await base44.integrations.Core.SendEmail({ to: email, subject, body });
    }

    setSendingReminders(false);
    setRemindersSent(true);
    setTimeout(() => setRemindersSent(false), 3000);
  };

  const handleSaveRates = async () => {
    const pairs = [
      { key: 'base_rate', value: rateBaseInput || '1000', description: 'Standard shoot rate (ZAR)' },
      { key: 'additional_rate', value: rateAdditionalInput || '250', description: 'Additional shoot rate (ZAR)' },
    ];
    for (const pair of pairs) {
      const existing = appSettings.find(s => s.key === pair.key);
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value: pair.value });
      } else {
        await base44.entities.AppSettings.create(pair);
      }
    }
    setRatesSaved(true);
    setTimeout(() => setRatesSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (logoSetting) {
      await base44.entities.AppSettings.update(logoSetting.id, { value: file_url });
    } else {
      await base44.entities.AppSettings.create({ key: 'app_logo_url', value: file_url, description: 'Custom app logo' });
    }
    setLogoUploading(false);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const handleAddPendingUser = async () => {
    if (!pendingForm.email) return;
    setSavingPending(true);
    await base44.entities.PendingUser.create({ ...pendingForm, invited: false });
    setPendingForm({ full_name: '', email: '', role: 'user', notes: '' });
    setShowAddPending(false);
    setSavingPending(false);
    refresh();
  };

  const handleInvitePendingUser = async (pu) => {
    setInvitingId(pu.id);
    await base44.users.inviteUser(pu.email, pu.role === 'admin' ? 'admin' : 'user');
    await base44.entities.PendingUser.update(pu.id, { invited: true });
    setInvitingId(null);
    refresh();
  };

  const handleDeletePendingUser = async (id) => {
    await base44.entities.PendingUser.delete(id);
    refresh();
  };

  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ full_name: '', role: 'user', admin_level: 1 });

  const handleEditUser = (u) => {
    setEditingUserId(u.id);
    setEditUserForm({ full_name: u.full_name || '', role: u.role || 'user', admin_level: u.admin_level ?? 1 });
  };

  const handleSaveUser = async (u) => {
    const updatePayload = {
      role: editUserForm.role,
      admin_level: editUserForm.role === 'admin' ? Number(editUserForm.admin_level) : null,
    };
    // full_name can be updated via User.update for other users (admin only)
    if (editUserForm.full_name && editUserForm.full_name !== u.full_name) {
      updatePayload.full_name = editUserForm.full_name;
    }
    await base44.entities.User.update(u.id, updatePayload);
    setEditingUserId(null);
    refresh();
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
                  {user?.role === 'admin' ? `Admin Level ${user?.admin_level ?? 1}` : 'Remote Operator'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Logo — Admin only */}
        {isAdmin && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader className="border-b border-gray-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Image className="h-5 w-5 text-blue-400" /> App Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden border border-gray-700">
                  {logoUrl
                    ? <img src={logoUrl} alt="App Logo" className="w-full h-full object-contain" />
                    : <span className="text-2xl font-bold text-blue-400">R</span>
                  }
                </div>
                <div>
                  <p className="text-sm text-gray-300 mb-2">Upload a custom logo (PNG, JPG, SVG recommended)</p>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                    className="bg-blue-700 hover:bg-blue-600 gap-2">
                    <Image className="h-4 w-4" />
                    {logoUploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Pay Rates — Admin only */}
        {isAdmin && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader className="border-b border-gray-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-400" /> Pay Rates (ZAR)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-gray-500">Additional shoots only apply when within 2 hours of a standard shoot on the same day.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Standard Shoot Rate (R)</label>
                  <Input
                    type="number"
                    value={rateBaseInput}
                    onChange={e => setRateBaseInput(e.target.value)}
                    placeholder="1000"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Additional Shoot Rate (R)</label>
                  <Input
                    type="number"
                    value={rateAdditionalInput}
                    onChange={e => setRateAdditionalInput(e.target.value)}
                    placeholder="250"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              <Button onClick={handleSaveRates} className="bg-green-700 hover:bg-green-600 gap-2">
                <Save className="h-4 w-4" /> {ratesSaved ? '✓ Saved!' : 'Save Rates'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notification Settings — Admin only */}
        {isAdmin && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader className="border-b border-gray-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-400" /> Shoot Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-gray-500">
                Remote operators see an in-app notification badge when a shoot setup is approaching.
                Set how many hours before setup they are notified.
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Notify operators (hours before setup)</label>
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={notifyHoursInput}
                    onChange={e => setNotifyHoursInput(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white w-32"
                  />
                </div>
                <Button onClick={handleSaveNotifySettings} className="bg-blue-700 hover:bg-blue-600 gap-2">
                  <Save className="h-4 w-4" /> {notifySaved ? '✓ Saved!' : 'Save'}
                </Button>
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <p className="text-xs text-gray-400 font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-orange-400" /> Weekly Email Template</p>
                <p className="text-xs text-gray-500">
                  Customize the email sent to each operator. Available variables:<br />
                  <code className="text-blue-400">{'{name}'}</code> — operator's name &nbsp;|&nbsp;
                  <code className="text-blue-400">{'{shoots}'}</code> — list of their shoots
                </p>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Subject</label>
                  <Input
                    value={emailSubjectTemplate}
                    onChange={e => setEmailSubjectTemplate(e.target.value)}
                    placeholder="📡 Your Shoots This Week"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Body</label>
                  <Textarea
                    value={emailTemplate}
                    onChange={e => setEmailTemplate(e.target.value)}
                    placeholder={`Hi {name},\n\nHere are your upcoming shoots for the week:\n\n{shoots}\n\nCheck the Remote Ops Manager app for full details.\n\nThanks,\nRemote Ops Team`}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 text-sm min-h-[160px] font-mono text-xs"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleSaveEmailTemplate} className="bg-blue-700 hover:bg-blue-600 gap-2">
                    <Save className="h-4 w-4" /> {emailTemplateSaved ? '✓ Saved!' : 'Save Template'}
                  </Button>
                  <Button onClick={handleSendTestEmail} disabled={sendingTestEmail} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-2">
                    <Mail className="h-4 w-4" />
                    {sendingTestEmail ? 'Sending...' : testEmailSent ? '✓ Test Sent!' : `Send Test to Me`}
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <p className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-400" /> WhatsApp Schedule Reminder
                </p>
                <p className="text-xs text-gray-500">
                  Opens WhatsApp so you can select which team members to remind to check their Remote Ops app for their schedule.
                </p>
                <Button
                  onClick={() => {
                    const msg = encodeURIComponent("Hi! 👋 Please check the Remote Ops app for your latest shoot schedule. Thanks!");
                    window.open(`https://wa.me/?text=${msg}`, '_blank');
                  }}
                  className="bg-green-700 hover:bg-green-600 gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open WhatsApp Reminder
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
            {/* Pending / Pre-registered Users */}
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardHeader className="border-b border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-400" /> Pre-registered Users ({pendingUsers.length})
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowAddPending(!showAddPending)}
                    className="bg-orange-700 hover:bg-orange-600 gap-1.5 text-xs">
                    <UserPlus className="h-3.5 w-3.5" /> Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {showAddPending && (
                  <div className="bg-gray-800/60 rounded-xl p-4 mb-4 border border-gray-700 space-y-3">
                    <p className="text-sm font-medium text-gray-300">Add user — invite now or later</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input placeholder="Full Name" value={pendingForm.full_name}
                        onChange={e => setPendingForm({ ...pendingForm, full_name: e.target.value })}
                        className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500" />
                      <Input placeholder="Email address *" value={pendingForm.email}
                        onChange={e => setPendingForm({ ...pendingForm, email: e.target.value })}
                        className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500" />
                    </div>
                    <div className="flex gap-3 flex-wrap items-center">
                      <select value={pendingForm.role} onChange={e => setPendingForm({ ...pendingForm, role: e.target.value })}
                        className="bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 text-sm">
                        <option value="user">Remote Operator</option>
                        {isLevel1Admin && <option value="admin">Admin</option>}
                      </select>
                      <Input placeholder="Notes (optional)" value={pendingForm.notes}
                        onChange={e => setPendingForm({ ...pendingForm, notes: e.target.value })}
                        className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddPendingUser} disabled={savingPending || !pendingForm.email}
                        className="bg-orange-700 hover:bg-orange-600 gap-1.5">
                        <Save className="h-3.5 w-3.5" /> Save (invite later)
                      </Button>
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white" onClick={() => setShowAddPending(false)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {pendingUsers.length === 0 && !showAddPending && (
                  <p className="text-gray-500 text-sm text-center py-4">No pre-registered users. Use "Add User" to register someone for later.</p>
                )}

                <div className="space-y-2">
                  {pendingUsers.map(pu => (
                    <div key={pu.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{pu.full_name || pu.email}</p>
                        <p className="text-xs text-gray-400">{pu.email}</p>
                        {pu.notes && <p className="text-xs text-gray-500 mt-0.5">{pu.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <Badge className={`text-xs ${pu.invited ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                          {pu.invited ? 'Invited' : 'Pending'}
                        </Badge>
                        {!pu.invited && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400 hover:bg-gray-700 gap-1"
                            disabled={invitingId === pu.id}
                            onClick={() => handleInvitePendingUser(pu)}>
                            <Send className="h-3 w-3" />
                            {invitingId === pu.id ? 'Sending...' : 'Invite Now'}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400"
                          onClick={() => handleDeletePendingUser(pu.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Team Members */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" /> Active Team Members ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-800">
                  {users.map(u => (
                    <div key={u.id} className="px-5 py-4">
                      {editingUserId === u.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editUserForm.full_name}
                            onChange={e => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                            placeholder="Full name"
                            className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                          />
                          <div className="flex gap-2 flex-wrap items-center">
                            <select
                              value={editUserForm.role}
                              onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
                              className="bg-gray-800 border border-gray-700 text-white rounded-md px-2 py-1.5 text-sm"
                            >
                              <option value="user">Remote Operator</option>
                              <option value="admin">Admin</option>
                              <option value="accounts">Accounts</option>
                            </select>
                            {editUserForm.role === 'admin' && (
                              <select
                                value={editUserForm.admin_level}
                                onChange={e => setEditUserForm({ ...editUserForm, admin_level: Number(e.target.value) })}
                                className="bg-gray-800 border border-gray-700 text-white rounded-md px-2 py-1.5 text-sm"
                              >
                                <option value={1}>L1 Full</option>
                                <option value={2}>L2 Restricted</option>
                              </select>
                            )}
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 gap-1" onClick={() => handleSaveUser(u)}>
                              <Save className="h-3 w-3" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:text-white" onClick={() => setEditingUserId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0">
                              {u.full_name?.charAt(0) || u.email?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{u.full_name || 'Unnamed'}</p>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                              {u.standby && <span className="text-xs text-yellow-400">On Standby</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={`text-xs border ${u.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : u.role === 'accounts' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                              {u.role === 'admin' ? `Admin L${u.admin_level ?? 1}` : u.role === 'accounts' ? 'Accounts' : 'Operator'}
                            </Badge>
                            {isLevel1Admin && u.id !== user?.id && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-blue-400 hover:bg-gray-800" onClick={() => handleEditUser(u)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isLevel1Admin && u.id !== user?.id && (
                              deleteConfirm === u.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-red-400">Sure?</span>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-red-900/30" onClick={() => handleDelete(u.id)}>Yes</Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(null)}>No</Button>
                                </div>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-600 hover:text-red-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(u.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )}
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