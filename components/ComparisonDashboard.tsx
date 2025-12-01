
import React, { useState } from 'react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { SimulationOutput, SimulationConfig } from '../types';
import { BrutalButton } from './ui/BrutalButton';
import { Download, Moon, Sun, Trophy, TrendingUp, AlertTriangle } from 'lucide-react';

interface ComparisonDashboardProps {
  results: SimulationOutput[];
  config: SimulationConfig;
  onReset: () => void;
}

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({ results, config, onReset }) => {
  const [darkMode, setDarkMode] = useState(true);

  // Theme definition
  const theme = {
    bg: darkMode ? 'bg-[#09090b]' : 'bg-[#f4f4f5]',
    text: darkMode ? 'text-zinc-100' : 'text-zinc-900',
    card: darkMode ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-zinc-200',
    border: darkMode ? 'border-zinc-800' : 'border-zinc-300',
    gridColor: darkMode ? '#27272a' : '#e4e4e7',
    axisColor: darkMode ? '#71717a' : '#a1a1aa',
  };

  const colors = ['#10b981', '#a855f7', '#3b82f6', '#f59e0b', '#ef4444'];

  // Determine Winner based on weighted score (Adoption * ROI * Maturity)
  const sortedResults = [...results].sort((a, b) => {
    const scoreA = a.summary.finalAdoption + a.summary.maturityScore * 10 + Math.max(0, a.summary.totalRoi);
    const scoreB = b.summary.finalAdoption + b.summary.maturityScore * 10 + Math.max(0, b.summary.totalRoi);
    return scoreB - scoreA;
  });
  const winner = sortedResults[0];

  // Prepare data for Bar Charts
  const comparisonData = results.map(r => ({
    name: r.frameworkName,
    roi: r.summary.totalRoi,
    adoption: r.summary.finalAdoption,
    time: r.summary.monthsToComplete,
    maturity: r.summary.maturityScore
  }));

  // Prepare data for Radar Chart
  const radarData = [
    { subject: 'ROI', fullMark: 100 },
    { subject: 'Adoção', fullMark: 100 },
    { subject: 'Maturidade (x10)', fullMark: 100 },
    { subject: 'Velocidade (inv)', fullMark: 100 }, // Inverted time
    { subject: 'Compliance', fullMark: 100 }
  ].map(metric => {
    const point: any = { subject: metric.subject };
    results.forEach(r => {
      let val = 0;
      if (metric.subject === 'ROI') val = Math.max(0, r.summary.totalRoi);
      if (metric.subject === 'Adoção') val = r.summary.finalAdoption;
      if (metric.subject === 'Maturidade (x10)') val = r.summary.maturityScore * 10;
      if (metric.subject === 'Velocidade (inv)') val = 100 - Math.min(100, r.summary.monthsToComplete * 2);
      if (metric.subject === 'Compliance') val = r.timeline[r.timeline.length -1].compliance;
      point[r.frameworkName] = val;
    });
    return point;
  });

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${theme.bg} ${theme.text} transition-colors duration-300 custom-scrollbar`}>
      <div className={`fixed inset-0 z-0 pointer-events-none opacity-[0.03] ${darkMode ? 'bg-[url("https://grainy-gradients.vercel.app/noise.svg")]' : ''}`} style={{ backgroundSize: '100px 100px' }}></div>

      <div className="relative z-10 max-w-[1600px] mx-auto p-6 md:p-10 space-y-10">
        
        {/* Navigation */}
        <nav className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b ${theme.border} pb-6`}>
           <div className="flex items-center gap-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
              FrameSim<span className="text-brutal-green">.VS</span>
            </h1>
            <div className={`hidden md:flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${theme.border} rounded bg-opacity-50`}>
               Comparison Engine
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded border ${theme.border} hover:bg-zinc-500/10 transition-colors`}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <BrutalButton variant="secondary" className="text-xs h-9 px-4" onClick={onReset}>Nova Comparação</BrutalButton>
          </div>
        </nav>

        {/* Winner Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className={`md:col-span-8 p-8 rounded border-2 border-brutal-green ${darkMode ? 'bg-emerald-900/10' : 'bg-emerald-50'} relative overflow-hidden`}>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-brutal-green">
                <Trophy className="w-6 h-6" />
                <span className="font-mono font-bold uppercase tracking-widest">Recomendação da Engine</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4">{winner.frameworkName}</h2>
              <p className="max-w-xl text-sm opacity-80 font-mono">
                Projeta-se como a opção mais eficiente para o contexto de {config.companySize} funcionários no setor {config.sector}. Apresentou o melhor balanço entre ROI ({winner.summary.totalRoi}%) e Resistência Cultural.
              </p>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
               <Trophy className="w-64 h-64" />
            </div>
          </div>
          
          <div className="md:col-span-4 grid grid-cols-1 gap-4">
             <div className={`p-6 rounded border ${theme.border} ${theme.card} flex flex-col justify-center`}>
                <span className="text-xs font-mono uppercase opacity-60 mb-2">Melhor ROI Projetado</span>
                <span className="text-4xl font-black text-purple-500">
                  {results.reduce((prev, curr) => prev.summary.totalRoi > curr.summary.totalRoi ? prev : curr).frameworkName}
                </span>
             </div>
             <div className={`p-6 rounded border ${theme.border} ${theme.card} flex flex-col justify-center`}>
                <span className="text-xs font-mono uppercase opacity-60 mb-2">Implementação Mais Rápida</span>
                <span className="text-4xl font-black text-blue-500">
                  {results.reduce((prev, curr) => prev.summary.monthsToComplete < curr.summary.monthsToComplete ? prev : curr).frameworkName}
                </span>
             </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Radar Overlay */}
          <div className={`p-6 rounded border ${theme.border} ${theme.card} min-h-[400px]`}>
            <h3 className="font-bold text-sm uppercase mb-6 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Sobreposição de Atributos
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke={theme.gridColor} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: theme.axisColor, fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {results.map((r, idx) => (
                    <Radar 
                      key={r.frameworkName}
                      name={r.frameworkName}
                      dataKey={r.frameworkName}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={2}
                      fill={colors[idx % colors.length]}
                      fillOpacity={0.1}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart ROI */}
          <div className={`p-6 rounded border ${theme.border} ${theme.card} min-h-[400px]`}>
             <h3 className="font-bold text-sm uppercase mb-6 flex items-center gap-2">
               <TrendingUp className="w-4 h-4 text-emerald-500" /> Comparativo de ROI (%)
             </h3>
             <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.gridColor} />
                    <XAxis type="number" stroke={theme.axisColor} tick={{fontSize: 10}} />
                    <YAxis dataKey="name" type="category" stroke={theme.axisColor} width={80} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: darkMode ? '#18181b' : '#fff', border: '1px solid #333'}} />
                    <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

        </div>

        {/* Details Table */}
        <div className={`p-6 rounded border ${theme.border} ${theme.card} overflow-x-auto`}>
           <h3 className="font-bold text-sm uppercase mb-6">Detalhamento Head-to-Head</h3>
           <table className="w-full text-left font-mono text-sm">
             <thead>
               <tr className="border-b border-zinc-700">
                 <th className="p-4 uppercase opacity-60">Framework</th>
                 <th className="p-4 uppercase opacity-60">Maturidade Final</th>
                 <th className="p-4 uppercase opacity-60">Tempo (Meses)</th>
                 <th className="p-4 uppercase opacity-60">Risco Principal</th>
                 <th className="p-4 uppercase opacity-60">Ponto Forte</th>
               </tr>
             </thead>
             <tbody>
               {results.map((r, idx) => (
                 <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-500/5 transition-colors">
                   <td className="p-4 font-bold" style={{ color: colors[idx % colors.length] }}>{r.frameworkName}</td>
                   <td className="p-4">{r.summary.maturityScore}/10</td>
                   <td className="p-4">{r.summary.monthsToComplete}</td>
                   <td className="p-4 text-red-400 text-xs">{r.risks.find(risk => risk.category === 'Crítico')?.description || r.risks[0].description}</td>
                   <td className="p-4 text-emerald-400 text-xs italic">"{r.keyPersonas.find(p => p.sentiment > 80)?.impact || 'Alta aceitação técnica'}"</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

      </div>
    </div>
  );
};
