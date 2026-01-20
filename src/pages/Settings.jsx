import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Palette, Users, Home, Check, X, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const THEMES = [
  { id: 'slate', name: 'Classic', primary: 'bg-slate-800', accent: 'bg-slate-600' },
  { id: 'blue', name: 'Ocean', primary: 'bg-blue-700', accent: 'bg-blue-500' },
  { id: 'green', name: 'Forest', primary: 'bg-emerald-700', accent: 'bg-emerald-500' },
  { id: 'purple', name: 'Royal', primary: 'bg-purple-700', accent: 'bg-purple-500' },
  { id: 'rose', name: 'Rose', primary: 'bg-rose-700', accent: 'bg-rose-500' },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const [householdName, setHouseholdName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('slate');
  const [newShareEmail, setNewShareEmail] = useState('');
  const [isAddingShare, setIsAddingShare] = useState(false);
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const { data: households = [], isLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => base44.entities.Household.list(),
  });
  
  const household = households.find(h => 
    h.owner_email === user?.email || h.shared_with?.includes(user?.email)
  );
  
  useEffect(() => {
    if (household) {
      setHouseholdName(household.name || '');
      setSelectedTheme(household.theme || 'slate');
    }
  }, [household]);
  
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (household) {
        await base44.entities.Household.update(household.id, data);
      } else {
        await base44.entities.Household.create({
          ...data,
          owner_email: user?.email,
          shared_with: []
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      toast.success('Settings saved!');
    }
  });
  
  const handleSave = () => {
    saveMutation.mutate({
      name: householdName,
      theme: selectedTheme
    });
  };
  
  const handleAddShare = async () => {
    if (!newShareEmail || !household) return;
    const updatedShared = [...(household.shared_with || []), newShareEmail];
    await base44.entities.Household.update(household.id, { shared_with: updatedShared });
    queryClient.invalidateQueries({ queryKey: ['households'] });
    setNewShareEmail('');
    setIsAddingShare(false);
    toast.success(`Budget shared with ${newShareEmail}`);
  };
  
  const handleRemoveShare = async (email) => {
    if (!household) return;
    const updatedShared = (household.shared_with || []).filter(e => e !== email);
    await base44.entities.Household.update(household.id, { shared_with: updatedShared });
    queryClient.invalidateQueries({ queryKey: ['households'] });
    toast.success(`Removed ${email} from shared access`);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }
  
  const isOwner = !household || household.owner_email === user?.email;
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-8">Settings</h1>
        
        <div className="space-y-6">
          {/* Household Name */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Home className="h-5 w-5" />
                Household Name
              </CardTitle>
              <CardDescription>Customize your household budget name</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="e.g., Brits Family Budget"
                  className="flex-1"
                  disabled={!isOwner}
                />
                <Button onClick={handleSave} disabled={saveMutation.isPending || !isOwner}>
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!isOwner && (
                <p className="text-sm text-slate-500 mt-2">Only the owner can change the household name</p>
              )}
            </CardContent>
          </Card>
          
          {/* Theme Selection */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5" />
                Theme
              </CardTitle>
              <CardDescription>Choose a color scheme for your budget</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setSelectedTheme(theme.id);
                      saveMutation.mutate({ name: householdName, theme: theme.id });
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedTheme === theme.id 
                        ? 'border-slate-800 ring-2 ring-slate-200' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div className={`h-6 w-6 rounded ${theme.primary}`}></div>
                      <div className={`h-6 w-6 rounded ${theme.accent}`}></div>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{theme.name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Share Budget */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Share Budget
              </CardTitle>
              <CardDescription>
                Share your household budget with family members. They'll need to have an account to access it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOwner ? (
                <>
                  <div className="space-y-3 mb-4">
                    {(household?.shared_with || []).map((email) => (
                      <div key={email} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm">{email}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveShare(email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(household?.shared_with || []).length === 0 && !isAddingShare && (
                      <p className="text-sm text-slate-500">No one else has access to this budget yet</p>
                    )}
                  </div>
                  
                  {isAddingShare ? (
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        value={newShareEmail}
                        onChange={(e) => setNewShareEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="icon" onClick={handleAddShare}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => setIsAddingShare(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setIsAddingShare(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Person
                    </Button>
                  )}
                </>
              ) : (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    This budget is shared with you by <strong>{household?.owner_email}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Account Info */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Your Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Email</span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Name</span>
                  <span className="text-sm font-medium">{user?.full_name || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}