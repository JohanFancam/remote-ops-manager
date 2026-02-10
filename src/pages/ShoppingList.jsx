import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ShoppingCart, Check, X, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import { format } from 'date-fns';

export default function ShoppingList() {
  const { householdId, isLoading: loadingHousehold } = useHousehold();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const [isAddingList, setIsAddingList] = useState(false);
  const [expandedLists, setExpandedLists] = useState({});
  const [addingItemToList, setAddingItemToList] = useState(null);
  const [listForm, setListForm] = useState({ name: '', scheduled_date: '', notes: '' });
  const [itemForm, setItemForm] = useState({ name: '', quantity: 1, estimated_price: '' });
  
  const { data: lists = [] } = useQuery({
    queryKey: ['shoppingLists', householdId],
    queryFn: () => base44.entities.ShoppingList.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: items = [] } = useQuery({
    queryKey: ['shoppingItems', householdId],
    queryFn: () => base44.entities.ShoppingItem.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['shoppingLists'] });
    queryClient.invalidateQueries({ queryKey: ['shoppingItems'] });
  };
  
  const toggleList = (listId) => {
    setExpandedLists(prev => ({ ...prev, [listId]: !prev[listId] }));
  };
  
  const handleAddList = async () => {
    if (!listForm.name) return;
    const newList = await base44.entities.ShoppingList.create({
      ...listForm,
      household_id: householdId
    });
    
    // Create calendar reminder if date is set
    if (listForm.scheduled_date) {
      await base44.entities.CalendarReminder.create({
        title: `Shopping: ${listForm.name}`,
        date: listForm.scheduled_date,
        type: 'shopping',
        linked_list_id: newList.id,
        household_id: householdId
      });
    }
    
    setListForm({ name: '', scheduled_date: '', notes: '' });
    setIsAddingList(false);
    refresh();
    queryClient.invalidateQueries({ queryKey: ['calendarReminders'] });
  };
  
  const handleAddItem = async (listId) => {
    if (!itemForm.name) return;
    await base44.entities.ShoppingItem.create({
      ...itemForm,
      list_id: listId,
      estimated_price: parseFloat(itemForm.estimated_price) || 0,
      household_id: householdId
    });
    setItemForm({ name: '', quantity: 1, estimated_price: '' });
    setAddingItemToList(null);
    refresh();
  };
  
  const toggleItemChecked = async (item) => {
    await base44.entities.ShoppingItem.update(item.id, { is_checked: !item.is_checked });
    refresh();
  };
  
  const toggleListCompleted = async (list) => {
    await base44.entities.ShoppingList.update(list.id, { is_completed: !list.is_completed });
    refresh();
  };
  
  const deleteList = async (listId) => {
    const listItems = items.filter(i => i.list_id === listId);
    for (const item of listItems) {
      await base44.entities.ShoppingItem.delete(item.id);
    }
    await base44.entities.ShoppingList.delete(listId);
    refresh();
  };
  
  const deleteItem = async (itemId) => {
    await base44.entities.ShoppingItem.delete(itemId);
    refresh();
  };
  
  const getListItems = (listId) => items.filter(i => i.list_id === listId);
  
  const getListTotal = (listId) => {
    return getListItems(listId).reduce((sum, i) => sum + ((i.estimated_price || 0) * (i.quantity || 1)), 0);
  };
  
  const activeLists = lists.filter(l => !l.is_completed);
  const completedLists = lists.filter(l => l.is_completed);
  
  if (loadingHousehold) {
    return <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>Loading...</div>;
  }
  
  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl font-bold ${theme.text}`}>Shopping Lists</h1>
          <Button onClick={() => setIsAddingList(true)} className={theme.cardHeader}>
            <Plus className="h-4 w-4 mr-2" /> New List
          </Button>
        </div>
        
        {isAddingList && (
          <Card className="mb-6 border-2 border-blue-200">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <Input
                  placeholder="List name (e.g., Weekly Groceries)"
                  value={listForm.name}
                  onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Shopping Date (optional)</label>
                    <Input
                      type="date"
                      value={listForm.scheduled_date}
                      onChange={(e) => setListForm({ ...listForm, scheduled_date: e.target.value })}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Notes (optional)</label>
                    <Input
                      placeholder="Notes..."
                      value={listForm.notes}
                      onChange={(e) => setListForm({ ...listForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddList}>Create List</Button>
                  <Button variant="outline" onClick={() => setIsAddingList(false)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="space-y-4">
          {activeLists.map(list => {
            const listItems = getListItems(list.id);
            const isExpanded = expandedLists[list.id];
            const checkedCount = listItems.filter(i => i.is_checked).length;
            const total = getListTotal(list.id);
            
            return (
              <Card key={list.id} className={`border-0 shadow-md ${theme.cardBg}`}>
                <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3 cursor-pointer`} onClick={() => toggleList(list.id)}>
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <ShoppingCart className="h-4 w-4" />
                      <span>{list.name}</span>
                      {list.scheduled_date && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(list.scheduled_date), 'dd MMM')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{checkedCount}/{listItems.length} items</span>
                      <span className="text-sm font-bold">R {total.toLocaleString()}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {listItems.map(item => (
                        <div key={item.id} className={`flex items-center justify-between px-4 py-2 ${item.is_checked ? 'bg-green-50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={item.is_checked}
                              onCheckedChange={() => toggleItemChecked(item)}
                            />
                            <span className={`text-sm ${item.is_checked ? 'line-through text-slate-400' : ''}`}>
                              {item.name}
                              {item.quantity > 1 && <span className="text-slate-500 ml-1">x{item.quantity}</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.estimated_price > 0 && (
                              <span className="text-sm text-slate-500">R {(item.estimated_price * item.quantity).toLocaleString()}</span>
                            )}
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteItem(item.id)}>
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {addingItemToList === list.id ? (
                        <div className="px-4 py-3 bg-blue-50 flex gap-2 items-center">
                          <Input
                            placeholder="Item name"
                            value={itemForm.name}
                            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                            className="flex-1 h-8"
                          />
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={itemForm.quantity}
                            onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                            className="w-16 h-8"
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={itemForm.estimated_price}
                            onChange={(e) => setItemForm({ ...itemForm, estimated_price: e.target.value })}
                            className="w-20 h-8"
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleAddItem(list.id)}>
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAddingItemToList(null)}>
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="px-4 py-2">
                          <Button variant="ghost" size="sm" onClick={() => setAddingItemToList(list.id)}>
                            <Plus className="h-3 w-3 mr-1" /> Add Item
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="px-4 py-2 bg-slate-50 flex justify-between items-center">
                      <Button variant="outline" size="sm" onClick={() => toggleListCompleted(list)}>
                        <Check className="h-3 w-3 mr-1" /> Mark Complete
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteList(list.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
          
          {activeLists.length === 0 && !isAddingList && (
            <Card className={`${theme.cardBg} border-0`}>
              <CardContent className="py-12 text-center">
                <ShoppingCart className={`h-12 w-12 mx-auto mb-3 ${theme.textMuted}`} />
                <p className={theme.textMuted}>No shopping lists yet</p>
                <Button className="mt-4" onClick={() => setIsAddingList(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create Your First List
                </Button>
              </CardContent>
            </Card>
          )}
          
          {completedLists.length > 0 && (
            <div className="mt-8">
              <h2 className={`text-lg font-semibold ${theme.text} mb-3`}>Completed</h2>
              {completedLists.map(list => (
                <Card key={list.id} className={`mb-2 opacity-60 ${theme.cardBg}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <span className="line-through">{list.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => toggleListCompleted(list)}>Restore</Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteList(list.id)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}