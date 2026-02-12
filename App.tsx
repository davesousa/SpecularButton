
import React, { useState } from 'react';
import MirrorButton from './components/MirrorButton';

const App: React.FC = () => {
  const [triggerCam, setTriggerCam] = useState(0);
  const [aura, setAura] = useState({ color: '#3b82f6', mood: '' });

  const handleCameraTrigger = () => setTriggerCam(p => p + 1);
  const handleAura = (color: string, mood: string) => setAura({ color, mood });

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#fdfdfd] overflow-hidden font-sans">
      {/* Syncing Background Orbs to AI Aura */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
        <div 
          className="absolute top-[10%] left-[15%] w-[50vw] h-[50vw] blur-[150px] rounded-full transition-colors duration-1000" 
          style={{ backgroundColor: `${aura.color}22` }}
        />
        <div 
          className="absolute bottom-[20%] right-[10%] w-[45vw] h-[45vw] blur-[120px] rounded-full transition-colors duration-1000" 
          style={{ backgroundColor: `${aura.color}11` }}
        />
      </div>
      
      <div className="z-10 text-center flex flex-col items-center justify-between min-h-[70vh] py-12 px-4">
        <header className="space-y-4">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl md:text-6xl font-extralight tracking-tighter text-slate-900">
              SpecularButton <span className="font-semibold" style={{ color: aura.color }}>Demo</span>
            </h1>
            {aura.mood && (
              <div className="mt-2 px-3 py-1 rounded-full bg-white border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: aura.color }}>
                  Mood: {aura.mood}
                </span>
              </div>
            )}
          </div>
          <p className="text-slate-400 text-sm font-light tracking-wide max-w-sm mx-auto leading-relaxed">
            A high-fidelity mirror button you should never use... Who wants this?
          </p>
        </header>

        <div className="relative flex items-center justify-center py-16">
          <MirrorButton externalTrigger={triggerCam} onAuraDetected={handleAura} />
        </div>

        <div className="flex flex-col items-center space-y-6">
          <button 
            onClick={handleCameraTrigger}
            className="px-8 py-3 rounded-full bg-white/60 border border-slate-200 text-slate-500 text-[11px] uppercase tracking-[0.25em] font-black hover:bg-white hover:text-slate-900 hover:border-slate-300 transition-all active:scale-95 shadow-sm backdrop-blur-sm"
          >
            Request Camera Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
