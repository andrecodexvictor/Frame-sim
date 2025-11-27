import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell 
} from 'recharts';
import { SimulationOutput, SimulationConfig } from '../types';
import { BrutalButton } from './ui/BrutalButton';
import { Download, AlertOctagon, Moon, Sun, ArrowUpRight, User, Activity } from 'lucide-react';

interface DashboardProps {
  data: SimulationOutput;
  config: SimulationConfig;
  onReset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, config, onReset }) => {
  const [darkMode, setDarkMode] = useState(true);

  // Solid, Minimalist Theme configuration
  const theme = {
    bg: darkMode ? 'bg-[#09090b]' : 'bg-[#f4f4f5]', // Solid dark/light
    text: darkMode ? 'text-zinc-100' : 'text-zinc-900',
    card: darkMode ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-zinc-200',
    cardInner: darkMode ? 'bg-[#27272a]' : 'bg-zinc-100',
    border: darkMode ? 'border-zinc-800' : 'border-zinc-300',
    gridColor: darkMode ? '#27272a' : '#e4e4e7',
    axisColor: darkMode ? '#71717a' : '#a1a1aa',
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${theme.bg} ${theme.text} transition-colors duration-300 custom-scrollbar`}>
      {/* Subtle minimalist grid background */}
      <div className={`fixed inset-0 z-0 pointer-events-none opacity-[0.03] ${darkMode ? 'bg-[url("https://grainy-gradients.vercel.app/noise.svg")]' : ''}`} 
           style={{ backgroundSize: '100px 100px', backgroundImage: `linear-gradient(to right, ${darkMode ? '#ffffff' : '#000000'} 1px, transparent 1px), linear-gradient(to bottom, ${darkMode ? '#ffffff' : '#000000'} 1px, transparent 1px)` }}>
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto p-6 md:p-10 space-y-10">
        
        {/* Navigation */}
        <nav className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b ${theme.border} pb-6`}>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
              FrameSim<span className={darkMode ? 'text-emerald-500' : 'text-zinc-900'}>.AI</span>
            </h1>
            <div className={`hidden md:flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${theme.border} rounded bg-opacity-50`}>
               Deep Simulation Kernel
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded border ${theme.border} hover:bg-zinc-500/10 transition-colors`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <BrutalButton variant="secondary" className="text-xs h-9 px-4" onClick={onReset}>
              Reiniciar
            </BrutalButton>
            <BrutalButton variant="primary" className="text-xs h-9 px-4">
              <Download className="w-3 h-3 mr-2" /> Relatório Completo
            </BrutalButton>
          </div>
        </nav>

        {/* Header Data */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-end">
          <div className="lg:col-span-3 space-y-4">
            <div>
              <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest mb-2 block">Simulação Finalizada</span>
              <h2 className="text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter">
                {config.frameworkName}
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-mono opacity-60 border-l-2 border-emerald-500 pl-4">
              <span>ALVO: {config.companySize} AGENTES</span>
              <span>//</span>
              <span>SETOR: {config.sector.toUpperCase()}</span>
              <span>//</span>
              <span>MATURIDADE {config.currentMaturity}</span>
            </div>
          </div>
          <div className="bg-emerald-500/10 p-6 border-l-4 border-emerald-500 rounded-r-lg">
             <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Índice de Sucesso</div>
             <div className="text-6xl font-black font-mono flex items-baseline gap-2 text-emerald-500">
               {data.summary.maturityScore}
               <span className="text-xl opacity-50 font-sans">/10</span>
             </div>
             <div className="text-[10px] uppercase font-mono mt-2 opacity-70">Baseado em {config.companySize * 12} datapoints</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Main Chart */}
          <div className={`md:col-span-8 p-6 rounded border ${theme.border} ${theme.card} relative min-h-[400px]`}>
             <div className="flex justify-between items-center mb-8">
               <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest">
                 <Activity className="w-4 h-4 text-emerald-500" />
                 Dinâmica de Adoção Realista
               </h3>
               <div className="flex gap-4 text-[10px] font-mono uppercase">
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500"></div> Adoção</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-500"></div> ROI</div>
               </div>
             </div>
             
             <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAdoption" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke={theme.axisColor} 
                      tickLine={false}
                      tick={{ fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => `M${val}`} 
                      dy={10}
                    />
                    <YAxis stroke={theme.axisColor} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace' }} dx={-10} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: darkMode ? '#18181b' : '#fff', 
                        border: `1px solid ${darkMode ? '#333' : '#ddd'}`, 
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <Area type="monotone" dataKey="adoptionRate" stroke="#10b981" strokeWidth={2} fill="url(#colorAdoption)" activeDot={{ r: 6 }} />
                    <Area type="monotone" dataKey="roi" stroke="#a855f7" strokeWidth={2} fill="url(#colorRoi)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* KPI Cards */}
          <div className="md:col-span-4 grid grid-cols-1 gap-6">
             {/* Key Personas / Agents */}
            <div className={`p-6 rounded border ${theme.border} ${theme.card} relative flex-1 flex flex-col`}>
               <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <User className="w-3 h-3" /> Simulação de Agentes
               </h3>
               <div className="space-y-4 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                 {data.keyPersonas?.map((persona, idx) => (
                   <div key={idx} className={`p-3 rounded border-l-2 ${persona.sentiment > 70 ? 'border-emerald-500 bg-emerald-500/5' : persona.sentiment < 40 ? 'border-red-500 bg-red-500/5' : 'border-yellow-500 bg-yellow-500/5'}`}>
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[10px] uppercase opacity-70">{persona.role}</span>
                        <span className="font-bold text-xs">{persona.sentiment}%</span>
                      </div>
                      <div className="font-bold text-sm my-1">{persona.archetype}</div>
                      <p className="text-xs italic opacity-80 leading-relaxed">"{persona.impact}"</p>
                   </div>
                 ))}
               </div>
            </div>
          </div>
          
          {/* Radar & Heatmap Row */}
          <div className="md:col-span-4 p-6 rounded border border-zinc-800 bg-[#18181b] flex flex-col justify-center items-center">
               <h3 className="w-full text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Equilíbrio Sistêmico</h3>
               <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                    { subject: 'Processos', A: data.timeline[data.timeline.length-1].efficiency, fullMark: 100 },
                    { subject: 'Compliance', A: data.timeline[data.timeline.length-1].compliance, fullMark: 100 },
                    { subject: 'Cultura', A: data.summary.finalAdoption, fullMark: 100 },
                    { subject: 'Financeiro', A: Math.min(Math.max(data.summary.totalRoi, 0), 100), fullMark: 100 },
                  ]}>
                    <PolarGrid stroke={theme.gridColor} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: theme.axisColor, fontSize: 10, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Impacto" dataKey="A" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
               </div>
          </div>

          <div className="md:col-span-8 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                {/* Department Readiness */}
                <div className={`p-6 rounded border ${theme.border} ${theme.card}`}>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Aderência por Setor</h3>
                  <div className="space-y-3">
                    {data.departmentReadiness.map((dept, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono uppercase">
                          <span>{dept.department}</span>
                          <span className={dept.score < 50 ? 'text-red-500' : 'text-emerald-500'}>{dept.score}%</span>
                        </div>
                        <div className={`h-1.5 w-full rounded-full ${darkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${dept.score > 70 ? 'bg-emerald-500' : dept.score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                            style={{ width: `${dept.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risks - Condensed */}
                <div className={`p-6 rounded border ${theme.border} ${theme.card} overflow-y-auto max-h-[350px] custom-scrollbar`}>
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Pontos de Ruptura</h3>
                  <div className="space-y-3">
                    {data.risks.map((risk, idx) => (
                      <div key={idx} className="pb-3 border-b border-zinc-800 last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                           <div className={`w-1.5 h-1.5 rounded-full ${risk.category === 'Crítico' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                           <span className="text-[10px] font-bold uppercase opacity-80">{risk.category}</span>
                        </div>
                        <p className="text-sm font-medium leading-tight mb-1">{risk.description}</p>
                        <p className="text-xs font-mono opacity-50">Mitigação: {risk.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          </div>

          {/* Strategy Roadmap */}
          <div className="md:col-span-12 pt-6 border-t border-zinc-800">
             <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Execução Estratégica Recomendada</h3>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {data.recommendations.map((rec, idx) => (
                  <div key={idx} className={`p-5 rounded border ${theme.border} ${theme.card} hover:border-emerald-500/50 transition-colors`}>
                    <div className="text-[10px] font-mono uppercase text-emerald-500 mb-2">Fase {rec.phase}</div>
                    <p className="text-sm font-medium">{rec.action}</p>
                  </div>
                ))}
             </div>
          </div>

        </div>

        <footer className="flex justify-between items-center pt-10 border-t border-zinc-800 opacity-40 font-mono text-[10px] uppercase">
          <span>Simulation Hash: {Math.random().toString(36).substring(7)}</span>
          <span>Powered by Gemini 2.5 Flash // Agents Active</span>
        </footer>
      </div>
    </div>
  );
};