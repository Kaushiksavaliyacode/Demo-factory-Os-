
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
 * OFFLINE DEMO DATASET (100+ ENTRIES)
 */
const generateDemoData = (): AppData => {
    const today = new Date().toISOString().split('T')[0];
    const getPastDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    };

    const parties: Party[] = [
        { id: 'p1', name: 'GLOBAL PACKAGING SOLUTIONS', code: 'REL/001', contact: '9876543210', address: 'Plot 42, GIDC, Vapi' },
        { id: 'p2', name: 'PRIME LABELS PVT LTD', code: 'REL/002', contact: '9988776655', address: 'Sector 5, Pimpri, Pune' },
        { id: 'p3', name: 'APEX BEVERAGES CORP', code: 'REL/003', contact: '9000110022', address: 'Bhiwandi, Mumbai' },
        { id: 'p4', name: 'FINE TECH PRINT WORLD', code: 'REL/004', contact: '8888877777', address: 'Ahmedabad Industrial Belt' },
        { id: 'p5', name: 'M K SHRINK LABEL & LAMINATOR', code: 'REL/005', contact: '7766554433', address: 'Nashik Highway' },
        { id: 'p6', name: 'POLY PAPER CONVERTOR', code: 'REL/006', contact: '9123456789', address: 'Surat Textile Zone' },
        { id: 'p7', name: 'COMMERCIAL PRINT PACK', code: 'REL/007', contact: '9822334455', address: 'Indore, MP' },
        { id: 'p8', name: 'VEERKRUPA PACKAGING', code: 'REL/008', contact: '9011223344', address: 'Morbi, Gujarat' },
        { id: 'p9', name: 'MAKERS POLYSHRINK', code: 'REL/009', contact: '9900998877', address: 'Silvassa UT' },
        { id: 'p10', name: 'D K GLOBAL ENTERPRISE', code: 'REL/010', contact: '9844556677', address: 'Ankleshwar, Gujarat' }
    ];

    const dispatches: DispatchEntry[] = [];
    for (let i = 1; i <= 40; i++) {
        const party = parties[i % parties.length];
        const status = i < 5 ? DispatchStatus.LOADING : (i < 15 ? DispatchStatus.COMPLETED : (i < 25 ? DispatchStatus.SLITTING : DispatchStatus.PENDING));
        dispatches.push({
            id: `d${i}`,
            dispatchNo: (1000 + i).toString(),
            date: getPastDate(i % 10),
            partyId: party.id,
            status: status,
            totalWeight: 50 + (i * 2.5),
            totalPcs: 200 + (i * 10),
            isTodayDispatch: i < 8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            rows: [
                { 
                    id: `r${i}a`, size: `${200 + (i * 5)}mm x 450`, sizeType: 'ROLL', micron: 35, 
                    weight: 25 + (i * 1.25), pcs: 100 + (i * 5), bundle: Math.ceil(i/5), 
                    status: status, isCompleted: i > 15, isLoaded: i < 5, productionWeight: 26 + (i * 1.25), wastage: 1.0 
                },
                { 
                    id: `r${i}b`, size: `150mm x 300`, sizeType: 'LABEL', micron: 30, 
                    weight: 25 + (i * 1.25), pcs: 100 + (i * 5), bundle: Math.ceil(i/5), 
                    status: status, isCompleted: i > 15, isLoaded: i < 5 
                }
            ]
        });
    }

    const challans: Challan[] = [];
    for (let i = 1; i <= 30; i++) {
        const party = parties[i % parties.length];
        challans.push({
            id: `c${i}`,
            challanNumber: (500 + i).toString(),
            partyId: party.id,
            date: getPastDate(i % 15),
            totalWeight: 20 + i,
            totalAmount: (20 + i) * 720,
            paymentMode: i % 3 === 0 ? PaymentMode.CASH : PaymentMode.UNPAID,
            createdAt: new Date().toISOString(),
            lines: [{ id: `cl${i}`, size: 'Custom Film', sizeType: 'ROLL', micron: 40, weight: 20 + i, rate: 720, amount: (20 + i) * 720 }]
        });
    }

    const slittingJobs: SlittingJob[] = [];
    for (let i = 1; i <= 15; i++) {
        slittingJobs.push({
            id: `s${i}`,
            date: getPastDate(i % 5),
            jobNo: `S-${800 + i}`,
            jobCode: parties[i % parties.length].code || 'REL/001',
            planMicron: 35,
            planQty: 200,
            planRollLength: 2000,
            planSizer: 500,
            status: i < 5 ? 'IN_PROGRESS' : (i < 10 ? 'COMPLETED' : 'PENDING'),
            coils: [{ id: `coil${i}`, number: 1, size: '250', rolls: 2, producedBundles: 1 }],
            rows: [{ id: `sr${i}`, coilId: `coil${i}`, srNo: 1, size: '250', meter: 2000, micron: 35, grossWeight: 42.8, coreWeight: 0.5, netWeight: 42.3 }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    const productionPlans: ProductionPlan[] = [];
    for (let i = 1; i <= 20; i++) {
        productionPlans.push({
            id: `plan${i}`,
            date: getPastDate(0),
            partyName: parties[i % parties.length].name,
            size: '350',
            type: i % 2 === 0 ? 'Printing' : 'Roll',
            printName: i % 2 === 0 ? 'Demo Design' : '',
            weight: 150,
            micron: 35,
            meter: 2500,
            cuttingSize: 450,
            pcs: 5000,
            status: i < 10 ? 'COMPLETED' : 'PENDING',
            createdAt: new Date().toISOString()
        });
    }

    const plantProductionPlans: PlantProductionPlan[] = [];
    for (let i = 1; i <= 15; i++) {
        plantProductionPlans.push({
            id: `pp${i}`,
            date: getPastDate(0),
            partyCode: parties[i % parties.length].code || 'REL/001',
            sizer: '500',
            size: '250',
            coils: ['250', '250'],
            micron: 35,
            qty: 300,
            status: i < 5 ? 'COMPLETED' : 'PENDING',
            createdAt: new Date().toISOString()
        });
    }

    const chemicalLogs: ChemicalLog[] = [];
    for (let i = 1; i <= 10; i++) {
        chemicalLogs.push({
            id: `chem${i}`,
            date: getPastDate(i),
            plant: i % 3 === 0 ? 'Jumbo' : '65mm',
            dop: 45, stabilizer: 12, epoxy: 8, nbs: 5, g161: 3,
            createdAt: new Date().toISOString()
        });
    }

    const chemicalPurchases: ChemicalPurchase[] = [];
    for (let i = 1; i <= 10; i++) {
        chemicalPurchases.push({
            id: `purch${i}`,
            date: getPastDate(i * 2),
            chemical: 'dop',
            quantity: 500,
            createdAt: new Date().toISOString()
        });
    }

    return {
        parties,
        dispatches,
        challans,
        slittingJobs,
        productionPlans,
        plantProductionPlans,
        chemicalLogs,
        chemicalPurchases,
        chemicalStock: { dop: 850.5, stabilizer: 145.2, epoxy: 210.0, g161: 65.5, nbs: 92.8 }
    };
};

const DEMO_DATA = generateDemoData();

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
      console.log("Storage: Running in Mock/Demo Mode with Expanded Dataset");
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
export const deleteSlittingJob = async (id: string) => isDemoMode() ? null : await deleteDoc(doc(db, "slitting_jobs", id));

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
