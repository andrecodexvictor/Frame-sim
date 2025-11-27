import React, { useEffect, useState } from 'react';

export const SimulationLoader: React.FC = () => {
  const [log, setLog] = useState<string[]>([]);
  
  const messages = [
    "Inicializando Engine Monte Carlo...",
    "Conectando à base de conhecimento vetorial...",
    "Analisando estrutura semântica do framework...",
    "Calculando coeficientes de resistência à mudança...",
    "Projetando Curva S de adoção tecnológica...",
    "Ajustando parâmetros para mercado brasileiro...",
    "Gerando matriz de riscos e mitigação...",
    "Compilando visualizações de dados..."
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
    <div className="w-full max-w-2xl mx-auto text-center space-y-12 animate-fade-in py-12">
      <div className="relative w-40 h-40 mx-auto group">
        <div className="absolute inset-0 border-2 border-gray-800 rounded-full animate-ping opacity-20"></div>
        <div className="absolute inset-0 border-2 border-[#00ff88] rounded-full animate-spin-slow opacity-80 shadow-[0_0_30px_rgba(0,255,136,0.3)]"></div>
        <div className="absolute inset-4 border-2 border-purple-500 rounded-full animate-spin-reverse opacity-80"></div>
        <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs animate-pulse text-[#00ff88]">
          AI_PROCESSING
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
          Simulando<span className="animate-pulse">...</span>
        </h2>
        <p className="font-mono text-sm text-gray-500">Isso pode levar alguns segundos.</p>
      </div>
      
      <div className="bg-black/90 border border-[#333] p-6 h-64 overflow-hidden flex flex-col justify-end shadow-2xl relative">
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
  );
};