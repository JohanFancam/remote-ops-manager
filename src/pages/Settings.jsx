import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, Save, Users, Home, Check, X, Trash2, UserPlus, Calendar, 
  Image, Heart, Star, PiggyBank, Wallet, Upload, Moon, Sun, ToggleLeft,
  User
} from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';

const LOGO_ICONS = [
  { id: 'home', name: 'Home', icon: Home },
  { id: 'heart', name: 'Heart', icon: Heart },
  { id: 'star', name: 'Star', icon: Star },
  { id: 'piggy', name: 'Piggy Bank', icon: PiggyBank },
  { id: 'wallet', name: 'Wallet', icon: Wallet },
];

const FEATURE_OPTIONS = [
  { id: 'investments', label: 'Investments/Savings', description: 'Track savings and investment contributions' },
  { id: 'household_goals', label: 'Household Goals', description: 'Set and track financial goals' },
  { id: 'projections', label: 'Projections', description: 'View future financial projections' },
  { id: 'debt', label: 'Debt Tracker', description: 'Track and manage debts' },
  { id: 'unforeseen_expenses', label: 'Unforeseen Expenses', description: 'Track unexpected expenses' },
  { id: 'user_activity', label: 'User Activity', description: 'Track changes made by household members' },
];

export default function SettingsPage() {
  const { 
    household, isOwner, updateHousehold, features, updateFeatures, 
    user, darkMode, toggleDarkMode, householdId 
  } = useHousehold();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const [householdName, setHouseholdName] = useState('');
  const [defaultIncomeDay, setDefaultIncomeDay] = useState(25);
  const [defaultExpenseDay, setDefaultExpenseDay] = useState(1);
  const [newShareEmail, setNewShareEmail] = useState('');
  const [isAddingShare, setIsAddingShare] = useState(false);
  const [logoIcon, setLogoIcon] = useState('home');
  const [uploading, setUploading] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [localFeatures, setLocalFeatures] = useState({});
  
  useEffect(() => {
    if (household) {
      setHouseholdName(household.name || '');
      setDefaultIncomeDay(household.default_income_day || 25);
      setDefaultExpenseDay(household.default_expense_day || 1);
      setLogoIcon(household.logo_icon || 'home');
      setLocalFeatures(household.features_enabled || {});
    }
  }, [household]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Household.update(household.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      toast.success('Settings saved!');
    },
    onError: () => {
      toast.error('Failed to save settings');
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      name: householdName,
      default_income_day: defaultIncomeDay,
      default_expense_day: defaultExpenseDay,
      logo_icon: logoIcon,
      features_enabled: localFeatures
    });
  };

  const handleFeatureToggle = (featureId, enabled) => {
    setLocalFeatures(prev => ({ ...prev, [featureId]: enabled }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Household.update(household.id, { logo_url: file_url, logo_icon: 'custom' });
      queryClient.invalidateQueries({ queryKey: ['households'] });
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };
  
  const handleRemoveLogo = async () => {
    await base44.entities.Household.update(household.id, { logo_url: null, logo_icon: 'home' });
    queryClient.invalidateQueries({ queryKey: ['households'] });
    toast.success('Logo removed');
  };
  
  const handleIconSelect = async (iconId) => {
    setLogoIcon(iconId);
    await base44.entities.Household.update(household.id, { logo_icon: iconId, logo_url: null });
    queryClient.invalidateQueries({ queryKey: ['households'] });
    toast.success('Icon updated!');
  };

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingProfile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ profile_photo_url: file_url });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Profile photo uploaded!');
    } catch (error) {
      toast.error('Failed to upload profile photo');
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleAddShare = async () => {
    if (!newShareEmail || !newShareEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    
    const currentShares = household.shared_with || [];
    if (currentShares.includes(newShareEmail)) {
      toast.error('Already shared with this email');
      return;
    }
    
    await base44.entities.Household.update(household.id, {
      shared_with: [...currentShares, newShareEmail]
    });
    queryClient.invalidateQueries({ queryKey: ['households'] });
    setNewShareEmail('');
    setIsAddingShare(false);
    toast.success('Budget shared!');
  };

  const handleRemoveShare = async (email) => {
    const currentShares = household.shared_with || [];
    await base44.entities.Household.update(household.id, {
      shared_with: currentShares.filter(e => e !== email)
    });
    queryClient.invalidateQueries({ queryKey: ['households'] });
    toast.success('Share removed');
  };

  if (!household) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className={`text-2xl font-bold ${theme.text} mb-6`}>Settings</h1>
        
        <div className="space-y-6">
          {/* Theme Toggle */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Appearance
              </CardTitle>
              <CardDescription className={theme.textMuted}>Choose between light and dark mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${theme.text}`}>Dark Mode</p>
                  <p className={`text-sm ${theme.textMuted}`}>Use dark theme throughout the app</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
              </div>
            </CardContent>
          </Card>

          {/* Profile Photo */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                <User className="h-5 w-5" />
                Profile Photo
              </CardTitle>
              <CardDescription className={theme.textMuted}>Upload your profile picture</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`w-20 h-20 rounded-full ${theme.headerBg} flex items-center justify-center overflow-hidden border-2 ${theme.border}`}>
                  {user?.profile_photo_url ? (
                    <img src={user.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className={`w-8 h-8 ${theme.textMuted}`} />
                  )}
                </div>
                <div>
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoUpload}
                      className="hidden"
                      disabled={uploadingProfile}
                    />
                    <Button variant="outline" asChild disabled={uploadingProfile}>
                      <span>
                        {uploadingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Upload Photo
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Toggles */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                <ToggleLeft className="h-5 w-5" />
                Features
              </CardTitle>
              <CardDescription className={theme.textMuted}>
                {isOwner ? 'Enable or disable features for your household' : 'Toggle features visible to you'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {FEATURE_OPTIONS.map((feature) => (
                <div key={feature.id} className={`flex items-center justify-between py-2 border-b ${theme.border} last:border-0`}>
                  <div>
                    <p className={`font-medium ${theme.text}`}>{feature.label}</p>
                    <p className={`text-sm ${theme.textMuted}`}>{feature.description}</p>
                  </div>
                  <Switch 
                    checked={localFeatures[feature.id] || false} 
                    onCheckedChange={(checked) => handleFeatureToggle(feature.id, checked)}
                    disabled={!isOwner}
                  />
                </div>
              ))}
              {!isOwner && (
                <p className={`text-xs ${theme.textMuted}`}>
                  Only the household owner can enable/disable features.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Household Logo */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                <Image className="h-5 w-5" />
                Household Logo
              </CardTitle>
              <CardDescription className={theme.textMuted}>Choose an icon or upload your own logo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 rounded-lg ${theme.headerBg} flex items-center justify-center overflow-hidden border-2 ${theme.border}`}>
                  {household?.logo_url ? (
                    <img src={household.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    (() => {
                      const IconComponent = LOGO_ICONS.find(i => i.id === logoIcon)?.icon || Home;
                      return <IconComponent className={`w-8 h-8 ${theme.textMuted}`} />;
                    })()
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${theme.text}`}>Current Logo</p>
                  <p className={`text-xs ${theme.textMuted}`}>{household?.logo_url ? 'Custom uploaded' : `${logoIcon} icon`}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <Label className={`text-sm ${theme.textMuted} mb-2 block`}>Choose an Icon</Label>
                <div className="grid grid-cols-5 gap-2">
                  {LOGO_ICONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => isOwner && handleIconSelect(item.id)}
                      disabled={!isOwner}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        logoIcon === item.id && !household?.logo_url
                          ? `${theme.border} ${theme.headerBg}` 
                          : `border-transparent ${theme.hoverBg}`
                      } ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <item.icon className={`h-6 w-6 ${theme.text}`} />
                      <span className={`text-xs ${theme.textMuted}`}>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {isOwner && (
                <div className={`border-t pt-4 ${theme.border}`}>
                  <Label className={`text-sm ${theme.textMuted} mb-2 block`}>Or Upload Custom Logo</Label>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      <Button variant="outline" className="w-full" asChild disabled={uploading}>
                        <span>
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                          Upload Image
                        </span>
                      </Button>
                    </label>
                    {household?.logo_url && (
                      <Button variant="outline" onClick={handleRemoveLogo} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Household Name */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                <Home className="h-5 w-5" />
                Household Name
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="My Household"
                disabled={!isOwner}
                className={theme.inputBg}
              />
            </CardContent>
          </Card>

          {/* Default Dates */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                <Calendar className="h-5 w-5" />
                Default Dates
              </CardTitle>
              <CardDescription className={theme.textMuted}>
                Income defaults to the 25th of the PREVIOUS month, expenses default to the 1st of the current month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={theme.textMuted}>Income Day (of previous month)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={defaultIncomeDay}
                    onChange={(e) => setDefaultIncomeDay(parseInt(e.target.value) || 25)}
                    disabled={!isOwner}
                    className={theme.inputBg}
                  />
                </div>
                <div>
                  <Label className={theme.textMuted}>Expense Due Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={defaultExpenseDay}
                    onChange={(e) => setDefaultExpenseDay(parseInt(e.target.value) || 1)}
                    disabled={!isOwner}
                    className={theme.inputBg}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sharing */}
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                <Users className="h-5 w-5" />
                Share Budget
              </CardTitle>
              <CardDescription className={theme.textMuted}>Share your budget with family members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(household.shared_with || []).map((email) => (
                <div key={email} className={`flex items-center justify-between p-3 rounded-lg ${theme.headerBg}`}>
                  <span className={`text-sm ${theme.text}`}>{email}</span>
                  {isOwner && (
                    <Button size="icon" variant="ghost" onClick={() => handleRemoveShare(email)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              
              {isOwner && (
                <>
                  {isAddingShare ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Email address"
                        value={newShareEmail}
                        onChange={(e) => setNewShareEmail(e.target.value)}
                        className={theme.inputBg}
                      />
                      <Button size="icon" onClick={handleAddShare}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => setIsAddingShare(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setIsAddingShare(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Person
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          {isOwner && (
            <Button 
              onClick={handleSave} 
              className="w-full"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}