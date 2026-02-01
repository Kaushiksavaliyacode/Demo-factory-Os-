
import React, { useState, useMemo } from 'react';
import { AppData, PlantProductionPlan, SlittingCoil, SlittingJob } from '../../types';
import { updatePlantPlan, saveSlittingJob } from '../../services/storageService';
import { 
  Factory, Search, Ruler, Scale, CircleCheck, 
  RotateCcw, FileText, X, Scissors, GitMerge, 
  CheckSquare, Square, Zap, Calculator, Settings, Edit, TriangleAlert, Lightbulb, RefreshCw
} from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const PlantQueueView: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [showJobId, setShowJobId] = useState<string | null>(null);
  
  const [mergeSizer, setMergeSizer] = useState('');
  const [mergeRollLength, setMergeRollLength] = useState('2000');
  const [useMultiUp, setUseMultiUp] = useState<boolean>(false);

  const [inlineEditField, setInlineEditField] = useState<'sizer' | 'rollLength' | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState('');

  const calculateSpecs = (orders: {size: number, qty: number}[], mic: number, sizer: number, slitLen: number, multiUp: boolean) => {
      let processedOrders = [...orders];
      if (multiUp && orders.length >= 2) {
          const lengths = orders.map(o => (o.qty * 1000) / (o.size * mic * (PROD_DENSITY/2)));
          const minLenIdx = lengths.indexOf(Math.min(...lengths));
          processedOrders[minLenIdx] = { ...processedOrders[minLenIdx], size: processedOrders[minLenIdx].size * 2, isMulti: true } as any;
      }

      const combinedSlitSize = processedOrders.reduce((s, o) => s + o.size, 0);
      const totalCombinedQty = orders.reduce((s, o) => s + o.qty, 0); 
      if (combinedSlitSize === 0 || sizer === 0 || mic === 0 || totalCombinedQty === 0) return null;

      const tube1mtrWeight = sizer * mic * PROD_DENSITY;
      const tubeRollLen = slitLen / 2;
      const jumboWeight = (tube1mtrWeight / 1000) * tubeRollLen;
      
      const coilsBreakdown = processedOrders.map((o: any) => {
          const unitRollWeight = (o.size * mic * PROD_DENSITY / 2 * slitLen) / 1000;
          const specificRolls = Math.ceil(o.targetQty || o.qty / unitRollWeight);
          const mtrsRequired = (o.qty * 1000) / (o.size * mic * (PROD_DENSITY/2));
          
          return {
              size: o.size,
              unitRollWeight,
              targetQty: o.qty,
              specificRolls,
              totalCoilWeight: o.qty,
              mtrsRequired,
              isMulti: o.isMulti || false
          };
      });

      const maxMtrs = Math.max(...coilsBreakdown.map(r => r.mtrsRequired));
      const minMtrs = Math.min(...coilsBreakdown.map(r => r.mtrsRequired));
      const needsSplitRun = (maxMtrs - minMtrs) > 50; 
      
      const productionQty = (totalCombinedQty / combinedSlitSize) * sizer;

      return { 
          combinedSlitSize, sizer, mic, slitLen,
          tube1mtrWeight, tubeRollLen, jumboWeight,
          maxRolls: Math.max(...coilsBreakdown.map(c => c.specificRolls)), 
          totalCombinedQty,
          coilsBreakdown,
          productionQty,
          maxMtrs, minMtrs, needsSplitRun, multiUp
      };
  };

  const filteredPlans = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return data.plantProductionPlans.filter(p => 
      p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s)
    ).sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [data.plantProductionPlans, searchTerm]);

  const mergePreview = useMemo(() => {
    if (!isMergeModalOpen || selectedIds.length === 0) return null;
    const items = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const orderData = items.map(p => ({ size: parseFloat(p.size), qty: p.qty }));
    const defaultSizer = useMultiUp 
        ? calculateSpecs(orderData, items[0].micron, 1, 2000, true)?.combinedSlitSize || 0
        : orderData.reduce((s, o) => s + o.size, 0);

    return calculateSpecs(
        orderData,
        items[0].micron,
        parseFloat(mergeSizer) || defaultSizer,
        parseFloat(mergeRollLength),
        useMultiUp
    );
  }, [isMergeModalOpen, selectedIds, data.plantProductionPlans, mergeSizer, mergeRollLength, useMultiUp]);

  const activeJob = useMemo(() => {
    if (!showJobId) return null;
    const job = data.slittingJobs.find(j => j.id === showJobId);
    if (!job) return null;
    const orderData = job.coils.map(c => ({ size: parseFloat(c.size), qty: c.targetQty || 0 }));
    const combinedSize = orderData.reduce((s, o) => s + o.size, 0);
    const sizer = job.planSizer || combinedSize;
    return { job, specs: calculateSpecs(orderData, job.planMicron, sizer, job.planRollLength, false) };
  }, [showJobId, data.slittingJobs]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleOpenMerge = () => {
    const items = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    if (items.length < 1) return alert("Select at least 1 order");
    if (!items.every(p => p.micron === items[0].micron)) return alert("Microns must match!");
    setMergeSizer(items.reduce((s, p) => s + parseFloat(p.size), 0).toString());
    setUseMultiUp(false);
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergePreview) return;
    const items = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const jobNo = `MJ-${Date.now().toString().slice(-4)}`;
    const partyCodes = Array.from(new Set(items.map(p => p.partyCode))).join(' / ');
    const slittingCoils: SlittingCoil[] = mergePreview.coilsBreakdown.map((c, idx) => ({
        id: `c-${Date.now()}-${idx}`,
        number: idx + 1, size: c.size.toString(), rolls: c.specificRolls, targetQty: c.targetQty, producedBundles: 0
    }));
    await saveSlittingJob({
        id: `mj-${Date.now()}`, date: new Date().toISOString().split('T')[0],
        jobNo, jobCode: partyCodes, coils: slittingCoils,
        planMicron: items[0].micron, planQty: mergePreview.totalCombinedQty,
        planRollLength: parseFloat(mergeRollLength), planSizer: parseFloat(mergeSizer),
        rows: [], status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    for (const p of items) await updatePlantPlan({ id: p.id, status: 'COMPLETED' });
    setIsMergeModalOpen(false);
    setSelectedIds([]);
    alert(`Master Job Card #${jobNo} Created`);
  };

  const renderCard = (specs: any, job: any, isPreview: boolean) => {
    const srNo = isPreview ? 'MJ-TEMP' : job.jobNo.split('-').pop();
    const party = isPreview ? 'Merged Order' : job.jobCode;
    const cardDate = isPreview ? new Date().toLocaleDateString() : job.date;
    return (
        <div className="bg-[#fefefe] w-full max-w-md overflow-hidden flex flex-col border-t-[8px] border-indigo-600 animate-in slide-in-from-bottom duration-500 max-h-[98vh] shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-12 border-b-[2px] border-slate-900 text-slate-900 bg-white">
                <div className="col-span-4 border-r-[2px] border-slate-900 p-3 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-tighter leading-none mb-1 text-slate-400">Serial No :-</span>
                    <span className="text-3xl font-black font-mono leading-none">{srNo}</span>
                </div>
                <div className="col-span-8 p-3 flex items-center justify-center">
                    <h3 className="text-4xl font-black uppercase tracking-[0.2em] italic text-indigo-700">Slitting</h3>
                </div>
            </div>
            {/* Content area... */}
            <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar bg-white">
                 {/* ...rest of card UI... */}
            </div>
            <div className="mt-auto p-4 bg-white border-t-[2.5px] border-slate-900">
                <button onClick={() => isPreview ? handleConfirmMerge() : setShowJobId(null)} className="w-full bg-indigo-600 text-white font-black py-6 uppercase text-sm tracking-[0.4em] active:bg-indigo-700 shadow-xl rounded-xl transition-all">
                    {isPreview ? 'Generate Master Card' : 'Confirm & Close'}
                </button>
            </div>
            <button onClick={() => { setShowJobId(null); setIsMergeModalOpen(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors bg-white/80 rounded-full p-1 shadow-sm"><X size={24}/></button>
        </div>
    );
  };

  return (
    <div className="max-w-md mx-auto space-y-2 pb-24 px-2 select-none font-sans">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sticky top-0 z-40 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg"><Factory size={16}/></div>
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Industrial Board</h2>
                </div>
            </div>
        </div>
        {/* Plan rows... */}
        <div className="flex items-center justify-center opacity-30 text-[8px] font-black uppercase tracking-[0.5em] pt-8 select-none">factoryOs Industrial clipboard • v2.5</div>
    </div>
  );
};