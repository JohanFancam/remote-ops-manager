import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function CSVImportDialog({ 
  open, 
  onClose, 
  entityType, 
  householdId, 
  selectedMonth,
  onSuccess,
  fieldMappings 
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError('');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const data = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim() || '';
        });
        data.push(row);
      }
      setPreview(data);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setError('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const record = { household_id: householdId };
          
          if (selectedMonth) {
            record.month = selectedMonth;
          }
          
          headers.forEach((header, idx) => {
            const mapping = fieldMappings[header];
            if (mapping) {
              let value = values[idx]?.trim() || '';
              if (mapping.type === 'number') {
                // Remove currency symbols (R, $, etc.), spaces, and handle comma as thousand separator
                value = value.replace(/^[R$€£]\s*/i, '').replace(/\s/g, '').replace(/,/g, '');
                value = parseFloat(value) || 0;
              } else if (mapping.type === 'boolean') {
                value = value.toLowerCase() === 'true' || value === '1';
              }
              record[mapping.field] = value;
            }
          });
          
          if (Object.keys(record).length > 2) {
            records.push(record);
          }
        }
        
        if (records.length === 0) {
          setError('No valid records found in CSV');
          setImporting(false);
          return;
        }
        
        await base44.entities[entityType].bulkCreate(records);
        toast.success(`Imported ${records.length} records`);
        onSuccess?.();
        onClose();
      };
      reader.readAsText(file);
    } catch (err) {
      setError('Failed to import CSV: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with your data. First row should be headers.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!file ? (
            <label className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-slate-400 transition-colors">
              <Upload className="h-8 w-8 text-zinc-400" />
              <span className="text-sm text-zinc-500">Click to select CSV file</span>
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
                  Change
                </Button>
              </div>
              
              {preview.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-medium text-zinc-500">
                    Preview (first {preview.length} rows)
                  </div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {Object.keys(preview[0]).map(key => (
                            <th key={key} className="px-2 py-1 text-left font-medium">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-t">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-2 py-1 truncate max-w-[100px]">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}