
import React, { useEffect, useState } from 'react';
import { User, Briefcase, Coffee, FolderOpen, Monitor } from 'lucide-react';

export const SimulationLoader: React.FC = () => {
  const [log, setLog] = useState<string[]>([]);
  
  const messages = [
    "Inicializando Engine Monte Carlo (Multi-Threaded)...",
    "Carregando vertentes: Financeira, Técnica, Cultural...",
    "Conectando à base de conhecimento vetorial...",
    "Analisando estrutura semântica do framework...",
    "Identificando Stakeholders Críticos...",
    "Calculando coeficientes de resistência à mudança...",
    "Validando coerência do cenário proposto...",
    "Projetando Curva S de adoção tecnológica...",
    "Ajustando parâmetros para mercado brasileiro...",
    "Gerando matriz de riscos e mitigação...",
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLog(prev => [...prev, messages[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto text-center space-y-12 animate-fade-in py-12 relative overflow-hidden min-h-[60vh] flex flex-col justify-center items-center">
      
      {/* Background Ambience - Walking People / Office */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden z-0">
         <style>{`
           @keyframes walkRight {
             0% { transform: translateX(-10vw); }
             100% { transform: translateX(110vw); }
           }
           @keyframes walkLeft {
             0% { transform: translateX(110vw); }
             100% { transform: translateX(-10vw); }
           }
         `}</style>
         
         {/* Walking Figures */}
         <div className="absolute bottom-10 left-0" style={{ animation: 'walkRight 15s linear infinite', animationDelay: '0s' }}>
           <User className="w-24 h-24 text-gray-500" />
         </div>
         <div className="absolute bottom-12 left-0" style={{ animation: 'walkRight 20s linear infinite', animationDelay: '5s' }}>
           <Briefcase className="w-20 h-20 text-gray-400" />
         </div>
         <div className="absolute bottom-8 left-0" style={{ animation: 'walkLeft 25s linear infinite', animationDelay: '2s' }}>
           <div className="flex gap-2">
             <User className="w-24 h-24 text-gray-600" />
             <Coffee className="w-8 h-8 text-gray-600 mt-4" />
           </div>
         </div>
         
         {/* Office Elements Static */}
         <div className="absolute top-20 left-20 opacity-20">
            <Monitor className="w-32 h-32" />
         </div>
         <div className="absolute top-40 right-40 opacity-20">
            <FolderOpen className="w-24 h-24" />
         </div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="relative w-40 h-40 mx-auto group mb-8">
          <div className="absolute inset-0 border-2 border-gray-800 rounded-full animate-ping opacity-20"></div>
          <div className="absolute inset-0 border-2 border-[#00ff88] rounded-full animate-spin-slow opacity-80 shadow-[0_0_30px_rgba(0,255,136,0.3)]"></div>
          <div className="absolute inset-4 border-2 border-purple-500 rounded-full animate-spin-reverse opacity-80"></div>
          <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs animate-pulse text-[#00ff88]">
            AI_PROCESSING
          </div>
        </div>
        
        <div className="space-y-2 mb-8">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
            Simulando<span className="animate-pulse">...</span>
          </h2>
          <p className="font-mono text-sm text-gray-500">Isso pode levar alguns segundos.</p>
        </div>
        
        <div className="w-full max-w-2xl bg-black/90 border border-[#333] p-6 h-64 overflow-hidden flex flex-col justify-end shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00ff88] to-transparent opacity-50"></div>
          {log.map((line, idx) => (
            <div key={idx} className="text-xs md:text-sm font-mono flex items-center gap-2 mb-1">
              <span className="text-[#00ff88]">➜</span>
              <span className="text-gray-300">{line}</span>
            </div>
          ))}
          <div className="w-2 h-4 bg-[#00ff88] animate-pulse mt-1"></div>
        </div>
      </div>
    </div>
  );
};
