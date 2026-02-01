
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow, ProductionPlan } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists, updateProductionPlan } from '../../services/storageService';
import { Layers, CircleArrowRight, CircleCheck, BellRing, GitMerge, Share2, CheckSquare, Square, Trash2, Edit, FileInput, Plus, Minus, List, Calculator, Scale, ArrowRightLeft, X } from 'lucide-react';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "ROLL", "WINDER", "PRINTING", "PLAIN"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  // --- STATE MANAGEMENT ---
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({
    date: new Date().toISOString().split('T')[0],
    dispatchNo: '',
    rows: [],
    status: DispatchStatus.PENDING,
    isTodayDispatch: false
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Row Entry State
  const [rowSize, setRowSize] = useState('');
  const [rowType, setRowType] = useState('');
  const [rowMicron, setRowMicron] = useState('');
  const [rowWeight, setRowWeight] = useState('');
  const [rowPcs, setRowPcs] = useState('');
  const [rowBundle, setRowBundle] = useState('');
  const [rowPlanId, setRowPlanId] = useState<string | null>(null);

  // List View State
  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Selection for WhatsApp Share (Line items)
  const [selectedRowsForShare, setSelectedRowsForShare] = useState<Record<string, string[]>>({});
  
  // Notification State
  const [newPlanNotification, setNewPlanNotification] = useState(false);
  const prevPlanCountRef = useRef<number | null>(null);

  // --- DERIVED LIVE TOTALS ---
  const currentFormTotals = useMemo(() => {
      const rows = activeDispatch.rows || [];
      return {
          weight: rows.reduce((s, r) => s + (Number(r.weight) || 0), 0),
          pcs: rows.reduce((s, r) => s + (Number(r.pcs) || 0), 0),
          bundles: rows.reduce((s, r) => s + (Number(r.bundle) || 0), 0)
      };
  }, [activeDispatch.rows]);

  // --- EFFECTS ---

  // Auto-generate Dispatch Number if not editing
  useEffect(() => {
    if (!isEditingId && !activeDispatch.dispatchNo) {
        const maxNo = data.dispatches.reduce((max, d) => {
            const num = parseInt(d.dispatchNo);
            return !isNaN(num) && num > max ? num : max;
        }, 0);
        const nextNo = maxNo === 0 ? '1001' : (maxNo + 1).toString();
        setActiveDispatch(prev => ({ ...prev, dispatchNo: nextNo }));
    }
  }, [data.dispatches, isEditingId]);

  // Notification Logic for New Plans
  useEffect(() => {
      const pendingCount = data.productionPlans.filter(p => p.status === 'PENDING').length;
      if (prevPlanCountRef.current === null) {
          prevPlanCountRef.current = pendingCount;
          return;
      }
      if (pendingCount > prevPlanCountRef.current) {
          setNewPlanNotification(true);
          const timer = setTimeout(() => setNewPlanNotification(false), 4000);
          return () => clearTimeout(timer);
      }
      prevPlanCountRef.current = pendingCount;
  }, [data.productionPlans]);

  // --- HELPERS ---

  const partySuggestions = data.parties.filter(p => {
    const search = partyInput.toLowerCase();
    return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  const pendingPlans = useMemo(() => 
    data.productionPlans
        .filter(p => p.status === 'PENDING')
        .sort((a,b) => new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime()), 
  [data.productionPlans]);

  const plansByParty = useMemo(() => {
      const groups: Record<string, ProductionPlan[]> = {};
      pendingPlans.forEach(p => {
          if (!groups[p.partyName]) groups[p.partyName] = [];
          groups[p.partyName].push(p);
      });
      return groups;
  }, [pendingPlans]);

  const filteredDispatches = useMemo(() => {
      const search = searchJob.toLowerCase();
      return data.dispatches.filter(d => {
          const p = data.parties.find(p => p.id === d.partyId);
          const pName = p ? p.name.toLowerCase() : '';
          const pCode = p?.code ? p.code.toLowerCase() : '';
          return d.dispatchNo.includes(search) || pName.includes(search) || pCode.includes(search) || d.rows.some(r => r.size.toLowerCase().includes(search));
      }).sort((a, b) => {
          // 1. Mark Today strictly on TOP
          const aToday = a.isTodayDispatch === true;
          const bToday = b.isTodayDispatch === true;
          if (aToday && !bToday) return -1;
          if (!aToday && bToday) return 1;

          // 2. Status Priority
          const getStatusPriority = (s: string) => {
              if (s === DispatchStatus.PENDING) return 1;
              if (['PRINTING', 'SLITTING', 'CUTTING', 'LOADING'].includes(s)) return 2;
              if (s === DispatchStatus.COMPLETED) return 3;
              if (s === DispatchStatus.DISPATCHED) return 4;
              return 5;
          };
          
          const pA = getStatusPriority(a.status);
          const pB = getStatusPriority(b.status);
          if (pA !== pB) return pA - pB;

          // 3. Fallback to updated time
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  // --- ACTIONS ---

  const mapPlanType = (type: string) => {
      const upperType = type.toUpperCase();
      return SIZE_TYPES.find(t => t === upperType) || 
             (type === 'St. Seal' ? 'ST.SEAL' : 
              type === 'Printing' ? 'PRINTING' : 
              type === 'Intas' ? 'INTAS' : 
              type === 'Round' ? 'ROUND' : 
              type === 'Open' ? 'OPEN' : 
              type === 'Roll' ? 'ROLL' : 
              type === 'Winder' ? 'WINDER' : '');
  };

  const handleImportPlan = (plan: ProductionPlan) => {
    setPartyInput(plan.partyName);
    setActiveDispatch(prev => ({ ...prev, date: plan.date, isTodayDispatch: true }));
    
    // Size Logic: Size x Cutting Size
    let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
    if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
    
    setRowSize(displaySize);
    setRowType(mapPlanType(plan.type));
    setRowMicron(plan.micron ? plan.micron.toString() : '');
    
    // DO NOT fill weight/pcs/bundle - User Request
    setRowWeight(''); 
    setRowPcs('');
    setRowBundle('');
    
    setRowPlanId(plan.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergePlans = (plans: ProductionPlan[]) => {
      if (plans.length === 0) return;
      const first = plans[0];
      setPartyInput(first.partyName);
      setActiveDispatch(prev => ({ ...prev, date: first.date, isTodayDispatch: true }));

      const newRows: DispatchRow[] = plans.map(plan => {
          let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
          if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
          return {
              id: `r-${Date.now()}-${Math.random()}`,
              planId: plan.id,
              size: displaySize,
              sizeType: mapPlanType(plan.type),
              micron: plan.micron || 0,
              weight: 0, 
              productionWeight: 0,
              wastage: 0,
              pcs: 0, 
              bundle: 0,
              status: DispatchStatus.PENDING,
              isCompleted: false,
              isLoaded: false
          };
      });
      setActiveDispatch(prev => ({
          ...prev,
          rows: [...(prev.rows || []), ...newRows]
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergeExistingJobs = () => {
    if (selectedJobIds.length < 2) return;
    const selectedJobs = data.dispatches.filter(d => selectedJobIds.includes(d.id));
    
    const parties = new Set(selectedJobs.map(j => j.partyId));
    if (parties.size > 1 && !confirm("Warning: Selected jobs belong to different parties. Merge anyway?")) return;

    const firstJob = selectedJobs[0];
    const p = data.parties.find(pt => pt.id === firstJob.partyId);
    setPartyInput(p ? p.name : '');

    const combinedRows: DispatchRow[] = selectedJobs.flatMap(j => 
        j.rows.map(r => ({
            ...r,
            id: `r-merge-${Date.now()}-${Math.random()}`,
            planId: undefined, 
            status: DispatchStatus.PENDING,
            isCompleted: false,
            isLoaded: false
        }))
    );

    setActiveDispatch({
        date: new Date().toISOString().split('T')[0],
        dispatchNo: '',
        rows: combinedRows,
        status: DispatchStatus.PENDING,
        isTodayDispatch: true
    });
    
    setIsEditingId(null);
    setSelectedJobIds([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addRow = () => {
      if (!rowSize) return alert("Size is required");
      const newRow: DispatchRow = {
          id: `r-${Date.now()}-${Math.random()}`,
          planId: rowPlanId || undefined,
          size: rowSize,
          sizeType: rowType,
          micron: parseFloat(rowMicron) || 0,
          weight: parseFloat(rowWeight) || 0,
          productionWeight: 0, 
          wastage: 0,
          pcs: parseFloat(rowPcs) || 0,
          bundle: parseFloat(rowBundle) || 0,
          status: DispatchStatus.PENDING,
          isCompleted: false,
          isLoaded: false
      };
      setActiveDispatch(prev => ({
          ...prev,
          rows: [newRow, ...(prev.rows || [])]
      }));
      setRowSize(''); setRowType(''); setRowMicron(''); setRowWeight(''); setRowPcs(''); setRowBundle('');
      setRowPlanId(null);
  };

  const resetForm = () => {
      setPartyInput('');
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '',
          rows: [],
          status: DispatchStatus.PENDING,
          isTodayDispatch: false
      });
      setIsEditingId(null);
      setRowPlanId(null);
  };

  const handleSave = async () => {
      if (!partyInput) return alert("Party Name Required");
      if (!activeDispatch.rows || activeDispatch.rows.length === 0) return alert("Add at least one item");
      
      const partyId = await ensurePartyExists(data.parties, partyInput);
      
      const totalWeight = activeDispatch.rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
      const totalPcs = activeDispatch.rows.reduce((sum, r) => sum + (Number(r.pcs) || 0), 0);
      
      const dispatch: DispatchEntry = {
          id: activeDispatch.id || `d-${Date.now()}`,
          dispatchNo: activeDispatch.dispatchNo || 'AUTO',
          date: activeDispatch.date!,
          partyId,
          status: activeDispatch.status || DispatchStatus.PENDING,
          rows: activeDispatch.rows,
          totalWeight,
          totalPcs,
          isTodayDispatch: activeDispatch.isTodayDispatch || false,
          createdAt: activeDispatch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      
      await saveDispatch(dispatch);
      
      for (const row of dispatch.rows) {
          if (row.planId) {
              await updateProductionPlan({ id: row.planId, status: 'COMPLETED' });
          }
      }
      resetForm();
  };

  const handleEdit = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      setActiveDispatch({ ...d });
      setIsEditingId(d.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRepeatOrder = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      const clonedRows = d.rows.map(r => ({ 
          ...r, 
          id: `r-${Date.now()}-${Math.random()}`, 
          planId: undefined, 
          status: DispatchStatus.PENDING,
          productionWeight: 0, 
          weight: 0,
          wastage: 0
      }));
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '', 
          rows: clonedRows,
          status: DispatchStatus.PENDING,
          isTodayDispatch: true
      });
      setIsEditingId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleJobSelection = (id: string) => {
      setSelectedJobIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const toggleToday = async (e: React.MouseEvent, d: DispatchEntry) => {
      e.stopPropagation();
      await saveDispatch({ ...d, isTodayDispatch: !d.isTodayDispatch, updatedAt: new Date().toISOString() });
  };

  const updateDispatchWithRecalculatedTotals = (dispatch: Partial<DispatchEntry>, updatedRows: DispatchRow[]): Partial<DispatchEntry> => {
    const totalWeight = updatedRows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    const totalPcs = updatedRows.reduce((s, r) => s + (Number(r.pcs) || 0), 0);
    return { ...dispatch, rows: updatedRows, totalWeight, totalPcs, updatedAt: new Date().toISOString() };
  };

  const handleRowUpdate = async (d: Partial<DispatchEntry>, rowId: string, field: keyof DispatchRow, value: any) => {
      const newRows = (d.rows || []).map(r => {
          if (r.id === rowId) {
              const updatedRow = { ...r, [field]: value };
              if (field === 'productionWeight' || field === 'weight') {
                  const pWt = field === 'productionWeight' ? (parseFloat(value) || 0) : (r.productionWeight || 0);
                  const dWt = field === 'weight' ? (parseFloat(value) || 0) : (r.weight || 0);
                  updatedRow.wastage = pWt - dWt;
              }
              return updatedRow;
          }
          return r;
      });
      
      const updated = updateDispatchWithRecalculatedTotals(d, newRows);
      if (d.id) {
          await saveDispatch(updated as DispatchEntry);
      } else {
          setActiveDispatch(updated);
      }
  };

  const toggleRowSelectionForShare = (dispatchId: string, rowId: string) => {
      setSelectedRowsForShare(prev => {
          const current = prev[dispatchId] || [];
          const updated = current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId];
          return { ...prev, [dispatchId]: updated };
      });
  };

  const toggleAllRowsForShare = (d: DispatchEntry) => {
      const current = selectedRowsForShare[d.id] || [];
      if (current.length === d.rows.length) {
          setSelectedRowsForShare(prev => ({ ...prev, [d.id]: [] }));
      } else {
          setSelectedRowsForShare(prev => ({ ...prev, [d.id]: d.rows.map(r => r.id) }));
      }
  };

  const shareJobImage = async (d: DispatchEntry) => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      const markedIds = selectedRowsForShare[d.id] || [];
      // Fixed: Added arrow function parameter 'r' to filter callback
      const rowsToShare = markedIds.length > 0 ? d.rows.filter(r => markedIds.includes(r.id)) : d.rows;

      const totalBundles = rowsToShare.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      const totalWeight = rowsToShare.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
      const totalPcs = rowsToShare.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
      
      const containerId = 'share-job-gen-user';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0px';
      container.style.width = '900px'; 
      container.style.background = '#fff';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const rowsHtml = rowsToShare.map((r, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e0f2fe;">
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e;">${r.size}</td>
            <td style="padding: 16px 12px; font-size: 20px; color: #0284c7; text-align: center; font-weight: bold;">${r.sizeType || '-'}</td>
            <td style="padding: 16px 12px; font-size: 20px; color: #64748b; text-align: center; font-weight: bold;">${r.micron || '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.weight > 0 ? r.weight.toFixed(3) : '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.pcs || '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.bundle || '-'}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0c4a6e; background: #fff;">
            <div style="background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 3px; color: #bae6fd; font-weight: bold;">Job Card ${markedIds.length > 0 ? '(Partial)' : ''}</div>
                <div style="font-size: 40px; font-weight: bold; margin-top: 8px; line-height: 1.1;">${party}</div>
                <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #7dd3fc; padding-top: 20px;">
                    <span style="font-size: 28px; background: rgba(255,255,255,0.2); padding: 8px 20px; rounded: 10px; font-weight: bold; border: 1px solid #7dd3fc;">#${d.dispatchNo}</span>
                    <span style="font-size: 24px; color: #e0f2fe; font-weight: bold;">${d.date.split('-').reverse().join('/')}</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #e0f2fe; color: #0c4a6e; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #0284c7;">
                        <th style="padding: 16px 12px; text-align: left;">Size</th>
                        <th style="padding: 16px 12px; text-align: center;">Type</th>
                        <th style="padding: 16px 12px; text-align: center;">Mic</th>
                        <th style="padding: 16px 12px; text-align: right;">Weight</th>
                        <th style="padding: 16px 12px; text-align: right;">Pcs</th>
                        <th style="padding: 16px 12px; text-align: right;">Box</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr style="background: #0c4a6e; color: white; font-weight: bold;">
                        <td colspan="3" style="padding: 24px 12px; font-size: 24px;">TOTAL</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalWeight.toFixed(3)}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalPcs}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalBundles}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      `;

      try {
          if (!(window as any).html2canvas) throw new Error("Library not loaded");
          const canvas = await (window as any).html2canvas(container, { scale: 2, backgroundColor: null });
          canvas.toBlob(async (blob: Blob) => {
              if (blob) {
                  const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      try {
                          await navigator.share({ files: [file], title: `Job ${d.dispatchNo}`, text: `Job Card for ${party}` });
                      } catch (e) { console.log("Share dismissed", e); }
                  } else {
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `Job_${d.dispatchNo}.png`;
                      link.click();
                      alert("Image downloaded. You can share it manually on WhatsApp.");
                  }
              }
              if (document.body.contains(container!)) document.body.removeChild(container!);
          }, 'image/png');
      } catch (err) {
          console.error(err);
          alert("Failed to generate image.");
          if (document.body.contains(container!)) document.body.removeChild(container!);
      }
  };

  const handleMasterStatusChange = async (job: DispatchEntry, newStatus: DispatchStatus) => {
      await saveDispatch({ ...job, status: newStatus, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="relative space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-center opacity-30 text-[8px] font-black uppercase tracking-[0.5em] pt-8 select-none">factoryOs DISPATCH • v2.5</div>
        {/* Rest of the component content omitted for brevity as it was unchanged */}
    </div>
  );
};
