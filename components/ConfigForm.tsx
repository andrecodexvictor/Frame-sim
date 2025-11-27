
import React from 'react';
import { useForm } from 'react-hook-form';
import { SimulationConfig, FrameworkInput } from '../types';
import { BrutalButton } from './ui/BrutalButton';

interface ConfigFormProps {
  frameworks: FrameworkInput[];
  onSubmit: (config: SimulationConfig) => void;
  onBack: () => void;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({ frameworks, onSubmit, onBack }) => {
  const { register, handleSubmit } = useForm<SimulationConfig>({
    defaultValues: {
      frameworks: frameworks,
      frameworkCategory: 'hybrid',
      companySize: 100,
      currentMaturity: 2,
      sector: 'tech',
      budgetLevel: 'medium'
    }
  });

  const isComparison = frameworks.length > 1;

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up text-zinc-900">
      <div className="mb-6 flex items-center justify-between">
         <h2 className="text-3xl font-black uppercase text-brutal-black dark:text-white">
           {isComparison ? 'Parâmetros do Cenário' : 'Configuração'}
         </h2>
         <span className="bg-brutal-black text-white font-mono px-2 py-1 text-xs">PASSO 2/3</span>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-zinc-900 border-4 border-brutal-black dark:border-zinc-700 shadow-hard p-8 space-y-6 transition-colors">
        
        {/* Selected Frameworks Display */}
        <div className="space-y-2 pb-4 border-b border-zinc-200 dark:border-zinc-700">
          <label className="font-bold text-sm uppercase dark:text-zinc-300">
            {isComparison ? 'Combatentes Selecionados' : 'Framework Selecionado'}
          </label>
          <div className="flex flex-wrap gap-2">
            {frameworks.map((f) => (
              <span key={f.id} className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 font-mono text-sm uppercase dark:text-emerald-400">
                {f.name}
              </span>
            ))}
          </div>
        </div>

        {/* Global Params */}
        <div className="space-y-2">
          <label className="font-bold text-sm uppercase dark:text-zinc-300">Categoria do Cenário</label>
          <div className="relative">
            <select 
              {...register('frameworkCategory')}
              className="w-full p-4 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-zinc-50 dark:bg-zinc-800 dark:text-white appearance-none uppercase"
            >
              <option value="development">Desenvolvimento (Engenharia / DevOps / QA)</option>
              <option value="management">Gestão (Ágil / Projetos / Produto)</option>
              <option value="governance">Governança (Compliance / Segurança / Audit)</option>
              <option value="hybrid">Híbrido / Transformação Digital Geral</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-bold">▼</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="font-bold text-sm uppercase dark:text-zinc-300">Tamanho da Empresa (FTEs)</label>
            <input 
              type="number" 
              {...register('companySize', { valueAsNumber: true })}
              className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <label className="font-bold text-sm uppercase dark:text-zinc-300">Setor de Atuação</label>
            <select 
              {...register('sector')}
              className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
            >
              <option value="tech">Tecnologia / SaaS</option>
              <option value="finance">Financeiro / Fintech</option>
              <option value="retail">Varejo / E-commerce</option>
              <option value="healthcare">Saúde</option>
              <option value="other">Outros</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <label className="font-bold text-sm uppercase dark:text-zinc-300">Nível de Maturidade Atual (1-5)</label>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <label key={level} className="flex-1 relative cursor-pointer group">
                <input 
                  type="radio" 
                  value={level} 
                  {...register('currentMaturity', { valueAsNumber: true })}
                  className="peer sr-only"
                />
                <div className="w-full py-3 border-2 border-brutal-black dark:border-zinc-600 text-center font-bold peer-checked:bg-brutal-black peer-checked:text-brutal-white dark:peer-checked:bg-brutal-green dark:peer-checked:text-black dark:text-white transition-all hover:bg-gray-100 dark:hover:bg-zinc-700">
                  {level}
                </div>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase font-mono opacity-0 peer-checked:opacity-100 transition-opacity whitespace-nowrap dark:text-zinc-400">
                  {level === 1 ? 'Ad Hoc' : level === 5 ? 'Otimizado' : `Nível ${level}`}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <label className="font-bold text-sm uppercase dark:text-zinc-300">Disponibilidade Orçamentária</label>
          <select 
              {...register('budgetLevel')}
              className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
            >
              <option value="low">Restrito (Bootstrap)</option>
              <option value="medium">Adequado (Padrão de Mercado)</option>
              <option value="high">Agressivo (Investimento Alto)</option>
            </select>
        </div>

        <div className="pt-6 flex gap-4">
          <BrutalButton type="button" variant="secondary" onClick={onBack} className="flex-1">
            VOLTAR
          </BrutalButton>
          <BrutalButton type="submit" className="flex-[2]">
            {isComparison ? 'EXECUTAR COMPARAÇÃO' : 'EXECUTAR SIMULAÇÃO'}
          </BrutalButton>
        </div>
      </form>
    </div>
  );
};
