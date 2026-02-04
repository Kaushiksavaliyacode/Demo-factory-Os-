
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { UserDashboard } from './components/user/UserDashboard';
import { Dashboard } from './components/admin/Dashboard';
import { SlittingDashboard } from './components/slitting/SlittingDashboard'; 
import { ChemicalDashboard } from './components/chemical/ChemicalDashboard'; 
import { subscribeToData, loadDemoData, exitDemoMode } from './services/storageService';
import { Role, AppData } from './types';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authId, setAuthId] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [view, setView] = useState<string>('dashboard');
  const [data, setData] = useState<AppData>({ 
    parties: [], dispatches: [], challans: [], slittingJobs: [], 
    productionPlans: [], plantProductionPlans: [],
    chemicalLogs: [], chemicalPurchases: [],
    chemicalStock: { dop:0, stabilizer:0, epoxy:0, g161:0, nbs:0 } 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToData((newData) => {
      setData(newData);
      setLoading(false);
    });
    
    if (localStorage.getItem('rdms_demo_active') === 'true') {
        setIsDemo(true);
        setIsAuthenticated(true);
        setRole(Role.ADMIN);
    }

    return () => unsubscribe();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authId === 'admin' && authPass === 'Admin.123') {
      setRole(Role.ADMIN);
      setIsAuthenticated(true);
      setLoginError('');
    } else if (authId === 'user' && authPass === 'User.123') {
      setRole(Role.USER);
      setIsAuthenticated(true);
      setLoginError('');
    } else if (authId === 'Chemical' && authPass === 'Chemical.123') {
      setRole(Role.CHEMICAL);
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid ID or Password');
    }
  };

  const handleLaunchDemo = () => {
    loadDemoData();
  };

  const handleLogout = () => {
    if (isDemo) {
        exitDemoMode();
    } else {
        setIsAuthenticated(false);
        setAuthId('');
        setAuthPass('');
        setRole(Role.ADMIN);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="glass w-full max-w-md p-8 rounded-3xl shadow-2xl border border-white/50 backdrop-blur-xl animate-in fade-in zoom-in duration-500">
           <div className="flex flex-col items-center mb-10 text-center">
             <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
             </div>
             <h1 className="text-3xl font-bold text-slate-800 tracking-tight">RDMS Portal</h1>
             <p className="text-slate-500 font-medium">Production Management System</p>
           </div>
           
           <div className="space-y-4">
              <button 
                onClick={handleLaunchDemo}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-[0.98] flex flex-col items-center justify-center gap-1 group"
              >
                <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <span className="uppercase tracking-widest text-sm">Launch Industrial Demo</span>
                </div>
                <span className="text-[10px] font-bold opacity-60 group-hover:opacity-100 transition-opacity">No Login Required • View Full Features</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-white/50 backdrop-blur px-3 text-slate-400">Or Authorized Sign-In</span></div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                  <input 
                    type="text" 
                    value={authId}
                    onChange={e => setAuthId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="Access ID"
                  />
                  <input 
                    type="password" 
                    value={authPass}
                    onChange={e => setAuthPass(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="Passkey"
                  />
                  {loginError && <div className="text-red-500 text-xs font-bold text-center">{loginError}</div>}
                  <button className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all">Secure Entry</button>
              </form>
           </div>

           <div className="mt-8 text-center">
             <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Authorized Build v2.10</span>
           </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Initializing System...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout currentRole={role} setRole={setRole} currentView={view} setView={setView} onLogout={handleLogout}>
      {isDemo && (
          <div className="fixed bottom-4 left-4 z-[60] bg-amber-100 border border-amber-200 px-4 py-2 rounded-full shadow-lg flex items-center gap-3 animate-bounce">
              <span className="text-lg">🏗️</span>
              <span className="text-xs font-black text-amber-800 uppercase tracking-tighter">Demo Mode Active</span>
              <button onClick={handleLogout} className="bg-amber-800 text-white text-[10px] px-2 py-0.5 rounded-md font-bold">Exit</button>
          </div>
      )}
      {role === Role.ADMIN && <Dashboard data={data} />}
      {role === Role.USER && <UserDashboard data={data} onUpdate={() => {}} />}
      {role === Role.SLITTING && <SlittingDashboard data={data} onUpdate={() => {}} />}
      {role === Role.CHEMICAL && <ChemicalDashboard data={data} onUpdate={() => {}} />}
    </Layout>
  );
};

export default App;
