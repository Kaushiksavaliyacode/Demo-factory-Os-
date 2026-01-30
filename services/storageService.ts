
import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  getDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { AppData, DispatchEntry, DispatchStatus, Challan, Party, SlittingJob, ChemicalLog, ChemicalStock, ChemicalPurchase, ProductionPlan, PlantProductionPlan, PaymentMode } from '../types';

/**
 * DEMO PROJECT SETTINGS
 * Google Sheet connection disabled to protect Main Project.
 */
const DEMO_SCRIPT_URL = ""; 

let GOOGLE_SHEET_URL = localStorage.getItem('rdms_sheet_url') || DEMO_SCRIPT_URL;

export const setGoogleSheetUrl = (url: string) => {
    GOOGLE_SHEET_URL = url.trim();
    localStorage.setItem('rdms_sheet_url', GOOGLE_SHEET_URL);
};

export const getGoogleSheetUrl = () => GOOGLE_SHEET_URL;

const sanitize = (obj: any): any => {
  const cache = new WeakSet();
  const process = (val: any): any => {
    if (val === null || typeof val !== 'object') return val;
    if (cache.has(val)) return '[Circular]';
    cache.add(val);
    if (val.nodeType || val.window === val) return undefined;
    if (Array.isArray(val)) return val.map(item => process(item)).filter(i => i !== undefined);
    if (val instanceof Date) return val.toISOString();
    const proto = Object.getPrototypeOf(val);
    const isPlainObject = proto === null || proto === Object.prototype;
    if (!isPlainObject) {
      if (typeof val.toJSON === 'function') {
        try { return process(val.toJSON()); } catch (e) { return `[Error]`; }
      }
      return `[Instance]`;
    }
    const clean: any = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        const item = val[key];
        if (key.startsWith('_') || ['nativeEvent', 'view', 'target', 'currentTarget'].includes(key) || typeof item === 'function') continue;
        const safeVal = process(item);
        if (safeVal !== undefined) clean[key] = safeVal;
      }
    }
    return clean;
  };
  return process(obj);
};

export const subscribeToData = (onDataChange: (data: AppData) => void) => {
  const localData: AppData = { 
      parties: [], dispatches: [], challans: [], slittingJobs: [], 
      productionPlans: [], plantProductionPlans: [],
      chemicalLogs: [], chemicalStock: { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 },
      chemicalPurchases: [] 
  };
  
  let loaded = { p:false, d:false, c:false, s:false, pl:false, ppl:false, cl:false, stock:false, purch:false };

  const checkLoad = () => {
    if (Object.values(loaded).every(v => v)) onDataChange({ ...localData });
  };

  // Skip Firebase listeners if no project ID is set to avoid console spam
  const projectId = db.app.options.projectId;
  if (!projectId || projectId === "demo-project-placeholder") {
      onDataChange(localData);
      return () => {};
  }

  onSnapshot(collection(db, "parties"), s => { localData.parties = s.docs.map(d => d.data() as Party); loaded.p = true; checkLoad(); });
  onSnapshot(collection(db, "dispatches"), s => { localData.dispatches = s.docs.map(d => d.data() as DispatchEntry).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.d = true; checkLoad(); });
  onSnapshot(collection(db, "challans"), s => { localData.challans = s.docs.map(d => d.data() as Challan).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.c = true; checkLoad(); });
  onSnapshot(collection(db, "slitting_jobs"), s => { localData.slittingJobs = s.docs.map(d => d.data() as SlittingJob).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.s = true; checkLoad(); });
  onSnapshot(collection(db, "production_plans"), s => { localData.productionPlans = s.docs.map(d => d.data() as ProductionPlan).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.pl = true; checkLoad(); });
  onSnapshot(collection(db, "plant_production_plans"), s => { localData.plantProductionPlans = s.docs.map(d => d.data() as PlantProductionPlan).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.ppl = true; checkLoad(); });
  onSnapshot(collection(db, "chemical_logs"), s => { localData.chemicalLogs = s.docs.map(d => d.data() as ChemicalLog).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); loaded.cl = true; checkLoad(); });
  onSnapshot(collection(db, "chemical_purchases"), s => { localData.chemicalPurchases = s.docs.map(d => d.data() as ChemicalPurchase).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); loaded.purch = true; checkLoad(); });
  onSnapshot(doc(db, "chemical_stock", "main"), d => { if (d.exists()) localData.chemicalStock = d.data() as ChemicalStock; loaded.stock = true; checkLoad(); });

  return () => {};
};

const syncToSheet = async (payload: any) => {
    if (!GOOGLE_SHEET_URL) return;
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitize(payload))
        });
    } catch (e) { console.error("Sync disabled", e); }
};

export const saveParty = async (p: Party) => await setDoc(doc(db, "parties", p.id), sanitize(p));
export const updateParty = async (p: Party) => await updateDoc(doc(db, "parties", p.id), sanitize(p));
export const deleteParty = async (id: string) => await deleteDoc(doc(db, "parties", id));

export const saveDispatch = async (d: DispatchEntry) => {
  await setDoc(doc(db, "dispatches", d.id), sanitize(d));
  syncToSheet({ type: 'JOB', ...d });
};
export const deleteDispatch = async (id: string) => {
  await deleteDoc(doc(db, "dispatches", id));
  syncToSheet({ type: 'DELETE_JOB', id });
};

export const saveChallan = async (c: Challan) => {
  await setDoc(doc(db, "challans", c.id), sanitize(c));
  syncToSheet({ type: 'BILL', ...c });
};
export const deleteChallan = async (id: string) => {
  await deleteDoc(doc(db, "challans", id));
  syncToSheet({ type: 'DELETE_BILL', id });
};

export const saveSlittingJob = async (j: SlittingJob) => {
  await setDoc(doc(db, "slitting_jobs", j.id), sanitize(j));
  syncToSheet({ type: 'SLITTING_JOB', ...j });
};
export const deleteSlittingJob = async (id: string) => await deleteDoc(doc(db, "slitting_jobs", id));

export const saveProductionPlan = async (p: ProductionPlan) => {
  await setDoc(doc(db, "production_plans", p.id), sanitize(p));
  syncToSheet({ type: 'PLAN', ...p });
};
export const updateProductionPlan = async (p: Partial<ProductionPlan> & { id: string }) => await updateDoc(doc(db, "production_plans", p.id), sanitize(p));
export const deleteProductionPlan = async (id: string) => await deleteDoc(doc(db, "production_plans", id));

export const savePlantPlan = async (p: PlantProductionPlan) => await setDoc(doc(db, "plant_production_plans", p.id), sanitize(p));
export const updatePlantPlan = async (p: Partial<PlantProductionPlan> & { id: string }) => await updateDoc(doc(db, "plant_production_plans", p.id), sanitize(p));
export const deletePlantPlan = async (id: string) => await deleteDoc(doc(db, "plant_production_plans", id));

export const saveChemicalLog = async (l: ChemicalLog) => await setDoc(doc(db, "chemical_logs", l.id), sanitize(l));
export const saveChemicalPurchase = async (p: ChemicalPurchase) => await setDoc(doc(db, "chemical_purchases", p.id), sanitize(p));
export const deleteChemicalPurchase = async (id: string) => await deleteDoc(doc(db, "chemical_purchases", id));
export const updateChemicalStock = async (s: ChemicalStock) => await setDoc(doc(db, "chemical_stock", "main"), sanitize(s));

export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
  const ex = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (ex) return ex.id;
  const id = `p-${Date.now()}`;
  await saveParty({ id, name, contact: '', address: '' });
  return id;
};

export const syncAllDataToCloud = async (data: AppData, onProgress: (c: number, t: number) => void) => {
    const items: any[] = [];
    data.dispatches.forEach(d => items.push({ type: 'JOB', ...d }));
    data.challans.forEach(c => items.push({ type: 'BILL', ...c }));
    data.slittingJobs.forEach(s => items.push({ type: 'SLITTING_JOB', ...s }));
    const total = items.length;
    for (let i = 0; i < total; i++) {
        onProgress(i + 1, total);
        await syncToSheet(items[i]);
        await new Promise(r => setTimeout(r, 100));
    }
};

export const triggerDashboardSetup = async () => await syncToSheet({ type: 'SETUP_DASHBOARD' });

export const restoreFullBackup = async (backupData: AppData, onProgress: (s: string, c: number, t: number) => void) => {
    const collections = [
        { k: 'parties', n: 'parties' }, { k: 'dispatches', n: 'dispatches' }, { k: 'challans', n: 'challans' },
        { k: 'slittingJobs', n: 'slitting_jobs' }, { k: 'productionPlans', n: 'production_plans' },
        { k: 'plantProductionPlans', n: 'plant_production_plans' }, { k: 'chemicalLogs', n: 'chemical_logs' },
        { k: 'chemicalPurchases', n: 'chemical_purchases' }
    ];
    for (const coll of collections) {
        const items = (backupData as any)[coll.k] || [];
        const total = items.length;
        for (let i = 0; i < total; i += 500) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + 500);
            chunk.forEach((item: any) => batch.set(doc(db, coll.n, item.id), sanitize(item)));
            await batch.commit();
            onProgress(coll.k, Math.min(i + 500, total), total);
        }
    }
    if (backupData.chemicalStock) await updateChemicalStock(backupData.chemicalStock);
};

export const loadDemoData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    /* Correct Fix: Added missing properties 'contact' and 'address' and typed the array to Party[] to prevent future errors */
    const parties: Party[] = [
        { id: 'dp-1', name: 'DEMO GLOBAL PACKAGING SOLUTIONS', code: 'REL/001', contact: '', address: '' },
        { id: 'dp-2', name: 'DEMO PRIME LABELS PVT LTD', code: 'REL/002', contact: '', address: '' },
        { id: 'dp-3', name: 'DEMO APEX BEVERAGES CORP', code: 'REL/003', contact: '', address: '' }
    ];

    const dispatch: DispatchEntry = {
        id: 'dd-1', dispatchNo: '1001', date: today, partyId: 'dp-1', status: DispatchStatus.SLITTING,
        totalWeight: 45.5, totalPcs: 1200, isTodayDispatch: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        rows: [{ 
            id: 'dr-1', size: '250mm', sizeType: 'ROLL', micron: 35, weight: 45.5, pcs: 1200, 
            bundle: 5, status: DispatchStatus.SLITTING, isCompleted: false, isLoaded: false 
        }]
    };

    const challan: Challan = {
        id: 'dc-1', challanNumber: '101', date: today, partyId: 'dp-2', totalWeight: 12.5, totalAmount: 15400,
        paymentMode: PaymentMode.UNPAID, createdAt: new Date().toISOString(),
        lines: [{ id: 'dl-1', size: '100 x 450', weight: 12.5, rate: 1232, amount: 15400 }]
    };

    const demoData: AppData = {
        parties,
        dispatches: [dispatch],
        challans: [challan],
        slittingJobs: [],
        productionPlans: [],
        plantProductionPlans: [],
        chemicalLogs: [],
        chemicalPurchases: [],
        chemicalStock: { dop: 420.5, stabilizer: 85.2, epoxy: 140.0, g161: 30.5, nbs: 65.8 }
    };

    // If Firebase is disconnected, we can only alert or use local state.
    // For demo purposes, we alert the user that they should connect their own Firebase.
    alert("DEMO MODE: Database is currently disconnected for security. To see real data, please add your Firebase credentials in firebaseConfig.ts");
};
