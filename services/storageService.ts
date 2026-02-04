
import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';
import { AppData, DispatchEntry, DispatchStatus, Challan, Party, SlittingJob, PaymentMode, ProductionPlan, PlantProductionPlan, ChemicalLog, ChemicalPurchase, ChemicalStock } from '../types';

/**
 * OFFLINE DEMO DATASET
 */
const DEMO_DATA: AppData = {
    parties: [
        { id: 'p1', name: 'DEMO GLOBAL PACKAGING SOLUTIONS', code: 'REL/001', contact: '9876543210', address: 'Plot 42, Industrial Area, Phase 1' },
        { id: 'p2', name: 'PRIME LABELS PVT LTD', code: 'REL/002', contact: '9988776655', address: 'Sector 5, GIDC Estate' },
        { id: 'p3', name: 'APEX BEVERAGES CORP', code: 'REL/003', contact: '9000110022', address: 'NH-8, Industrial Belt' }
    ],
    dispatches: [
        {
            id: 'd1', dispatchNo: '1001', date: new Date().toISOString().split('T')[0],
            partyId: 'p1', status: DispatchStatus.SLITTING, totalWeight: 145.5, totalPcs: 450, isTodayDispatch: true,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            rows: [
                { id: 'r1', size: '250mm x 450', sizeType: 'ROLL', micron: 35, weight: 85.5, pcs: 250, bundle: 4, status: DispatchStatus.SLITTING, isCompleted: false, isLoaded: false, productionWeight: 86.2, wastage: 0.7 },
                { id: 'r2', size: '150mm x 300', sizeType: 'ROLL', micron: 30, weight: 60.0, pcs: 200, bundle: 2, status: DispatchStatus.PENDING, isCompleted: false, isLoaded: false }
            ]
        }
    ],
    challans: [
        {
            id: 'c1', challanNumber: '501', partyId: 'p2', date: new Date().toISOString().split('T')[0],
            totalWeight: 25.5, totalAmount: 18500, paymentMode: PaymentMode.UNPAID, createdAt: new Date().toISOString(),
            lines: [{ id: 'l1', size: '100mm Label', sizeType: 'LABEL', micron: 40, weight: 25.5, rate: 725, amount: 18500 }]
        }
    ],
    slittingJobs: [
        {
            id: 's1', date: new Date().toISOString().split('T')[0], jobNo: 'S-882', jobCode: 'REL/001',
            planMicron: 35, planQty: 150, planRollLength: 2000, planSizer: 500, status: 'IN_PROGRESS',
            coils: [{ id: 'c1', number: 1, size: '250', rolls: 2, producedBundles: 1 }],
            rows: [{ id: 'sr1', coilId: 'c1', srNo: 1, size: '250', meter: 2000, micron: 35, grossWeight: 42.8, coreWeight: 0.5, netWeight: 42.3 }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        }
    ],
    productionPlans: [],
    plantProductionPlans: [],
    chemicalLogs: [],
    chemicalPurchases: [],
    chemicalStock: { dop: 450.5, stabilizer: 120.0, epoxy: 85.3, g161: 45.0, nbs: 32.8 }
};

let GOOGLE_SHEET_URL = localStorage.getItem('rdms_sheet_url') || "";

export const setGoogleSheetUrl = (url: string) => {
    GOOGLE_SHEET_URL = url.trim();
    localStorage.setItem('rdms_sheet_url', GOOGLE_SHEET_URL);
};

export const getGoogleSheetUrl = () => GOOGLE_SHEET_URL;

const isDemoMode = () => {
    const projectId = db.app.options.projectId;
    return !projectId || projectId === "demo-project-placeholder" || localStorage.getItem('rdms_demo_active') === 'true';
};

export const subscribeToData = (onDataChange: (data: AppData) => void) => {
  if (isDemoMode()) {
      console.log("Storage: Running in Mock/Demo Mode");
      onDataChange(DEMO_DATA);
      return () => {};
  }

  const localData: AppData = { 
      parties: [], dispatches: [], challans: [], slittingJobs: [], 
      productionPlans: [], plantProductionPlans: [],
      chemicalLogs: [], chemicalStock: { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 },
      chemicalPurchases: [] 
  };
  
  let loaded = { p:false, d:false, c:false, s:false, pl:false, ppl:false, cl:false, stock:false, purch:false };
  const checkLoad = () => { if (Object.values(loaded).every(v => v)) onDataChange({ ...localData }); };

  onSnapshot(collection(db, "parties"), s => { localData.parties = s.docs.map(d => d.data() as Party); loaded.p = true; checkLoad(); });
  onSnapshot(collection(db, "dispatches"), s => { localData.dispatches = s.docs.map(d => d.data() as DispatchEntry); loaded.d = true; checkLoad(); });
  onSnapshot(collection(db, "challans"), s => { localData.challans = s.docs.map(d => d.data() as Challan); loaded.c = true; checkLoad(); });
  onSnapshot(collection(db, "slitting_jobs"), s => { localData.slittingJobs = s.docs.map(d => d.data() as SlittingJob); loaded.s = true; checkLoad(); });
  
  // Subscribe to production plans and other modules for real-time updates in non-demo mode
  onSnapshot(collection(db, "production_plans"), s => { localData.productionPlans = s.docs.map(d => d.data() as ProductionPlan); loaded.pl = true; checkLoad(); });
  onSnapshot(collection(db, "plant_production_plans"), s => { localData.plantProductionPlans = s.docs.map(d => d.data() as PlantProductionPlan); loaded.ppl = true; checkLoad(); });
  onSnapshot(collection(db, "chemical_logs"), s => { localData.chemicalLogs = s.docs.map(d => d.data() as ChemicalLog); loaded.cl = true; checkLoad(); });
  onSnapshot(doc(db, "settings", "chemical_stock"), s => { if(s.exists()) localData.chemicalStock = s.data() as ChemicalStock; loaded.stock = true; checkLoad(); });
  onSnapshot(collection(db, "chemical_purchases"), s => { localData.chemicalPurchases = s.docs.map(d => d.data() as ChemicalPurchase); loaded.purch = true; checkLoad(); });
  
  return () => {};
};

export const loadDemoData = async () => {
    localStorage.setItem('rdms_demo_active', 'true');
    window.location.reload();
};

export const exitDemoMode = () => {
    localStorage.removeItem('rdms_demo_active');
    window.location.reload();
};

// Placeholder saves for Demo Mode
export const saveParty = async (p: Party) => isDemoMode() ? console.log("Demo Save:", p) : await setDoc(doc(db, "parties", p.id), p);
export const saveDispatch = async (d: DispatchEntry) => isDemoMode() ? console.log("Demo Save:", d) : await setDoc(doc(db, "dispatches", d.id), d);
export const saveChallan = async (c: Challan) => isDemoMode() ? console.log("Demo Save:", c) : await setDoc(doc(db, "challans", c.id), c);
export const saveSlittingJob = async (j: SlittingJob) => isDemoMode() ? console.log("Demo Save:", j) : await setDoc(doc(db, "slitting_jobs", j.id), j);
export const deleteDispatch = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "dispatches", id));
export const deleteChallan = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "challans", id));

// Added missing deleteSlittingJob export to resolve error in SlittingManager.tsx
export const deleteSlittingJob = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "slitting_jobs", id));

// Implement actual update and save functions for Firestore persistence
export const updateProductionPlan = async (p: any) => isDemoMode() ? null : await setDoc(doc(db, "production_plans", p.id), p, { merge: true }); 
export const updatePlantPlan = async (p: any) => isDemoMode() ? null : await setDoc(doc(db, "plant_production_plans", p.id), p, { merge: true }); 
export const savePlantPlan = async (p: any) => isDemoMode() ? null : await setDoc(doc(db, "plant_production_plans", p.id), p); 
export const saveProductionPlan = async (p: any) => isDemoMode() ? null : await setDoc(doc(db, "production_plans", p.id), p); 

export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
    const ex = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (ex) return ex.id;
    const newId = `p-${Date.now()}`;
    await saveParty({ id: newId, name, contact: '', address: '' });
    return newId;
};

export const syncAllDataToCloud = async (data: AppData, onProgress: any) => alert("Cloud sync requires App Script URL.");
export const triggerDashboardSetup = async () => alert("Cloud setup requires App Script URL.");
export const restoreFullBackup = async (data: any, onProgress: any) => alert("Restore requires Firebase Connection.");

// Implement chemical inventory operations
export const saveChemicalLog = async (l: ChemicalLog) => isDemoMode() ? null : await setDoc(doc(db, "chemical_logs", l.id), l);
export const updateChemicalStock = async (s: ChemicalStock) => isDemoMode() ? null : await setDoc(doc(db, "settings", "chemical_stock"), s);
export const saveChemicalPurchase = async (p: ChemicalPurchase) => isDemoMode() ? null : await setDoc(doc(db, "chemical_purchases", p.id), p);
export const deleteChemicalPurchase = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "chemical_purchases", id));

export const deleteParty = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "parties", id));
export const updateParty = async (p: Party) => isDemoMode() ? null : await setDoc(doc(db, "parties", p.id), p, { merge: true });

export const deleteProductionPlan = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "production_plans", id));
export const deletePlantPlan = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "plant_production_plans", id));

export const updateProductionPlanStatus = async (id: string, status: 'PENDING' | 'COMPLETED') => 
    isDemoMode() ? null : await setDoc(doc(db, "production_plans", id), { status }, { merge: true });
