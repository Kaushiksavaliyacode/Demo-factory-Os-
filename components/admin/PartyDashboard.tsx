import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode, Party, Challan } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan, saveParty, deleteParty, updateParty } from '../../services/storageService';
import { Trash2, Plus, X, Edit2 } from 'lucide-react';

interface Props {
  data: AppData;
}

const PARTY_SEED_DATA = [
  { code: "REL/001", name: "AAA" },
  { code: "REL/002", name: "BBB" },
  { code: "REL/003", name: "CCC" },
  { code: "REL/004", name: "DDD" },
  { code: "REL/005", name: "EEE" },
  { code: "REL/006", name: "FFF" }
];

export const PartyDashboard: React.FC<Props> = ({ data }) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'production' | 'billing' | 'manage'>('billing');
  const [filterDate, setFilterDate] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyCode, setNewPartyCode] = useState('');

  const formatDateNoYear = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}`;
  };

  const handleSeedParties = async () => {
      if(!confirm(`Import ${PARTY_SEED_DATA.length} legacy parties?`)) return;
      setIsImporting(true);
      let addedCount = 0;
      for (const p of PARTY_SEED_DATA) {
          const exists = data.parties.some(existing => (existing.code === p.code) || (existing.name.toLowerCase() === p.name.toLowerCase()));
          if (!exists) {
              const newId = `party-${p.code.replace('/','-').toLowerCase()}`;
              await saveParty({ id: newId, name: p.name, code: p.code, contact: '', address: '' });
              addedCount++;
          }
      }
      setIsImporting(false);
      alert(`Import Complete! Added ${addedCount} new parties.`);
  };

  const shareChallanImage = async (challan: Challan) => {
    const containerId = 'share-challan-gen';
    let container = document.getElementById(containerId);
    if (container) document.body.removeChild(container);
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0px';
    container.style.width = '550px'; 
    container.style.background = '#fff';
    container.style.zIndex = '-1';
    document.body.appendChild(container);
    const partyName = data.parties.find(p => p.id === challan.partyId)?.name || 'Unknown';
    container.innerHTML = `
        <div style="font-family: sans-serif; background: #fff; border: 2px solid #334155;">
            <div style="background: #1e293b; padding: 24px; color: white;">
                <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: bold;">Tax Invoice / Challan</div>
                <div style="font-size: 24px; font-weight: bold; margin-top: 8px; line-height: 1.2;">${partyName}</div>
            </div>
            <div style="padding: 12px; text-align: center; background: #1e293b; color: #64748b; font-size: 12px; font-weight: bold;">
                factoryOs BILLING SYSTEM
            </div>
        </div>
    `;
    if ((window as any).html2canvas) {
      const canvas = await (window as any).html2canvas(container, { backgroundColor: null, scale: 2 });
      canvas.toBlob(async (blob: Blob) => {
        if (blob) {
          const file = new File([blob], `Challan_${challan.challanNumber}.png`, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `Challan #${challan.challanNumber}`, text: `Bill details for ${partyName}` });
        }
        document.body.removeChild(container!);
      });
    }
  };

  const handleSaveParty = async () => {
      if(!newPartyName) return alert("Party Name is required");
      if(editingPartyId) {
          await updateParty({ id: editingPartyId, name: newPartyName, code: newPartyCode, contact: '', address: '' });
      } else {
          const newId = `party-${Date.now()}`;
          await saveParty({ id: newId, name: newPartyName, code: newPartyCode, contact: '', address: '' });
      }
      setNewPartyName('');
      setNewPartyCode('');
      setEditingPartyId(null);
      setIsPartyModalOpen(false);
  };

  const filteredParties = data.parties.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center"><Plus size={24} /></div>
                <div><h3 className="text-lg font-bold text-slate-800 leading-none">Party Directory</h3><p className="text-xs text-slate-500 font-medium mt-1">{data.parties.length} Registered Parties</p></div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => { setEditingPartyId(null); setNewPartyName(''); setNewPartyCode(''); setIsPartyModalOpen(true); }} className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"><Plus size={16} /> New Party</button>
                <button onClick={handleSeedParties} disabled={isImporting} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2">{isImporting ? 'Importing...' : 'Seed Data'}</button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar List */}
            <div className="w-full lg:w-1/3 space-y-4">
                <div className="relative">
                    <input type="text" placeholder="Search by Name or Code..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-purple-100" />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex flex-col">
                    <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-slate-50">
                        {filteredParties.map(p => (
                            <div key={p.id} onClick={() => setSelectedPartyId(p.id)} className={`p-4 cursor-pointer transition-all hover:bg-purple-50/50 ${selectedPartyId === p.id ? 'bg-purple-50 border-r-4 border-purple-600' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase leading-tight">{p.name}</h4>
                                        {p.code && <div className="text-[10px] font-bold text-purple-600 mt-1">{p.code}</div>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingPartyId(p.id); setNewPartyName(p.name); setNewPartyCode(p.code||''); setIsPartyModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={14}/></button>
                                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete party and all associated data?')) deleteParty(p.id); }} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main View Area */}
            <div className="flex-1 space-y-6">
                {selectedPartyId ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex gap-2 mb-6">
                            {(['billing', 'production', 'manage'] as const).map(tab => (
                                <button key={tab} onClick={() => setDirectoryTab(tab)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${directoryTab === tab ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>{tab}</button>
                            ))}
                        </div>

                        {directoryTab === 'billing' && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="text-sm font-black text-slate-800 uppercase">Billing Ledger</h4>
                                    <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400">Total Unpaid:</span><span className="text-sm font-black text-red-600">₹{data.challans.filter(c => c.partyId === selectedPartyId && c.paymentMode === PaymentMode.UNPAID).reduce((s,c) => s + c.totalAmount, 0).toLocaleString()}</span></div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold uppercase">
                                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Bill #</th><th className="px-6 py-4 text-right">Amount</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-center">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.challans.filter(c => c.partyId === selectedPartyId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(c => (
                                                <React.Fragment key={c.id}>
                                                    <tr className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-500">{formatDateNoYear(c.date)}</td>
                                                        <td className="px-6 py-4 font-black text-slate-800">#{c.challanNumber}</td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900">₹{Math.round(c.totalAmount).toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${c.paymentMode === PaymentMode.UNPAID ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{c.paymentMode}</span></td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex justify-center gap-2">
                                                                <button onClick={() => shareChallanImage(c)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"><Plus size={14}/></button>
                                                                <button onClick={() => deleteChallan(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {directoryTab === 'production' && (
                             <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200"><h4 className="text-sm font-black text-slate-800 uppercase">Production History</h4></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold uppercase">
                                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Job #</th><th className="px-6 py-4">Sizes</th><th className="px-6 py-4 text-right">Weight</th><th className="px-6 py-4 text-center">Status</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.dispatches.filter(d => d.partyId === selectedPartyId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => (
                                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-500">{formatDateNoYear(d.date)}</td>
                                                    <td className="px-6 py-4 font-black text-slate-800">#{d.dispatchNo}</td>
                                                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{d.rows.map((r,i) => <span key={i} className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{r.size}</span>)}</div></td>
                                                    <td className="px-6 py-4 text-right font-black text-indigo-600">{d.totalWeight.toFixed(3)}</td>
                                                    <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-indigo-50 text-indigo-600">{d.status}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 h-[600px] flex flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Plus size={32}/></div>
                        <p className="font-bold text-sm">Select a party from the list to view ledger</p>
                    </div>
                )}
            </div>
        </div>

        {/* Party Create/Edit Modal */}
        {isPartyModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">{editingPartyId ? 'Edit Party Details' : 'Register New Party'}</h3>
                        <button onClick={() => setIsPartyModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Legal Party Name</label>
                            <input value={newPartyName} onChange={e => setNewPartyName(e.target.value)} placeholder="e.g. GLOBAL PACKAGING" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-500 transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Party Code (Optional)</label>
                            <input value={newPartyCode} onChange={e => setNewPartyCode(e.target.value)} placeholder="e.g. REL/042" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-500 transition-all" />
                        </div>
                        <button onClick={handleSaveParty} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase text-xs tracking-[0.2em]">{editingPartyId ? 'Update Record' : 'Create Record'}</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};