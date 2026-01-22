import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Loader2, Receipt } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { format } from 'date-fns';

const PURCHASE_CATEGORIES = [
  'Groceries',
  'Entertainment',
  'Fuel',
  'Dining',
  'Shopping',
  'Transport',
  'Health',
  'Other'
];

export default function ReceiptScanner({ open, onClose, householdId, selectedMonth, categories, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [form, setForm] = useState({
    description: '',
    store: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    notes: ''
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReceiptUrl(file_url);
      
      // Analyze receipt with AI
      setAnalyzing(true);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this receipt image and extract the following information:
        - Store name
        - Total amount (number only)
        - Date of purchase (if visible)
        - Brief description of items purchased
        
        If you can't determine something, leave it blank.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            store: { type: "string" },
            total: { type: "number" },
            date: { type: "string" },
            description: { type: "string" }
          }
        }
      });
      
      setExtractedData(result);
      setForm(prev => ({
        ...prev,
        store: result.store || prev.store,
        amount: result.total ? result.total.toString() : prev.amount,
        date: result.date || prev.date,
        description: result.description || prev.description
      }));
      
      toast.success('Receipt analyzed!');
    } catch (error) {
      toast.error('Failed to process receipt');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!form.amount || !form.category) {
      toast.error('Please fill in amount and category');
      return;
    }
    
    try {
      await base44.entities.Purchase.create({
        description: form.description || 'Receipt purchase',
        store: form.store,
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category,
        notes: form.notes,
        receipt_url: receiptUrl,
        month: selectedMonth,
        household_id: householdId
      });
      
      toast.success('Purchase added!');
      onSuccess?.();
      handleClose();
    } catch (error) {
      toast.error('Failed to save purchase');
    }
  };

  const handleClose = () => {
    setReceiptUrl('');
    setExtractedData(null);
    setForm({
      description: '',
      store: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      notes: ''
    });
    onClose();
  };

  const allCategories = [...new Set([...PURCHASE_CATEGORIES, ...(categories || [])])];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Scan Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt image to automatically extract details
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!receiptUrl ? (
            <label className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-slate-400 transition-colors">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              ) : (
                <>
                  <Camera className="h-8 w-8 text-slate-400" />
                  <span className="text-sm text-slate-600">Take photo or upload receipt</span>
                </>
              )}
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileUpload} 
                className="hidden" 
                disabled={uploading}
              />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img 
                  src={receiptUrl} 
                  alt="Receipt" 
                  className="w-full h-32 object-cover rounded-lg"
                />
                {analyzing && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                    <span className="ml-2 text-white text-sm">Analyzing...</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Store</Label>
                  <Input 
                    value={form.store} 
                    onChange={(e) => setForm({...form, store: e.target.value})}
                    placeholder="Store name"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount (R)</Label>
                  <Input 
                    type="number"
                    value={form.amount} 
                    onChange={(e) => setForm({...form, amount: e.target.value})}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input 
                    type="date"
                    value={form.date} 
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Description</Label>
                <Input 
                  value={form.description} 
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="What was purchased"
                  className="h-9"
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!receiptUrl || analyzing}>
              Save Purchase
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}