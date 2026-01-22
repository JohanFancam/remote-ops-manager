import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2, Camera, Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";

import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import MonthSelector from '../components/budget/MonthSelector';
import PurchasesSection from '../components/budget/PurchasesSection';
import ReceiptScanner from '../components/common/ReceiptScanner';
import CSVImportDialog from '../components/common/CSVImportDialog';

const CSV_FIELD_MAPPINGS = {
  'description': { field: 'description', type: 'string' },
  'category': { field: 'category', type: 'string' },
  'amount': { field: 'amount', type: 'number' },
  'date': { field: 'date', type: 'string' },
  'store': { field: 'store', type: 'string' },
  'notes': { field: 'notes', type: 'string' },
};

export default function PurchasesPage() {
  const { householdId, isLoading: loadingHousehold, getCurrentMonth } = useHousehold();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showScanner, setShowScanner] = useState(false);
  const [showImport, setShowImport] = useState(false);
  
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', householdId, selectedMonth],
    queryFn: () => base44.entities.Purchase.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', householdId, selectedMonth],
    queryFn: () => base44.entities.BudgetCategory.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
  };
  
  const isLoading = loadingHousehold || loadingPurchases;
  const categoryNames = categories.map(c => c.name);
  
  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className={`h-8 w-8 animate-spin ${theme.textMuted}`} />
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h1 className={`text-2xl font-bold ${theme.text}`}>Purchases</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowScanner(true)}
              className={theme.cardBg}
            >
              <Camera className="h-4 w-4 mr-2" />
              Scan Receipt
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowImport(true)}
              className={theme.cardBg}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <MonthSelector 
              selectedMonth={selectedMonth} 
              onMonthChange={setSelectedMonth}
            />
          </div>
        </div>
        
        <PurchasesSection 
          purchases={purchases}
          categories={categoryNames}
          selectedMonth={selectedMonth}
          householdId={householdId}
          onRefresh={refreshData}
        />
      </div>

      <ReceiptScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        householdId={householdId}
        selectedMonth={selectedMonth}
        categories={categoryNames}
        onSuccess={refreshData}
      />

      <CSVImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        entityType="Purchase"
        householdId={householdId}
        selectedMonth={selectedMonth}
        onSuccess={refreshData}
        fieldMappings={CSV_FIELD_MAPPINGS}
      />
    </div>
  );
}