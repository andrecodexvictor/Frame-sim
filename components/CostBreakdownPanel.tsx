import React from 'react';
import costProfiles from '../data/cost_profiles.json';
import { DollarSign, Users } from 'lucide-react';

interface CostBreakdownPanelProps {
    profileId: string;
}

interface SalaryTier {
    daily: number;
    monthly: number;
    label: string;
}

interface CostProfile {
    id: string;
    name: string;
    region: string;
    currency: string;
    salaryTiers: {
        intern: SalaryTier;
        junior: SalaryTier;
        mid: SalaryTier;
        senior: SalaryTier;
        tech_lead: SalaryTier;
        manager: SalaryTier;
    };
    constants: {
        DEV_DAY_COST: number;
        SENIOR_DEV_DAY_COST: number;
        FEATURE_VALUE: number;
        INCIDENT_COST: number;
        BUG_FIX_COST: number;
        TRAINING_COST_PER_HEAD: number;
        TURNOVER_COST_MULTIPLIER: number;
    };
    description: string;
}

const formatCurrency = (value: number, currency: string): string => {
    const symbols: Record<string, string> = {
        'BRL': 'R$',
        'USD': '$',
        'EUR': '€'
    };
    return `${symbols[currency] || currency} ${value.toLocaleString('pt-BR')}`;
};

const tierColors: Record<string, string> = {
    intern: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    junior: 'bg-green-500/20 border-green-500/50 text-green-400',
    mid: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    senior: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    tech_lead: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
    manager: 'bg-red-500/20 border-red-500/50 text-red-400'
};

export const CostBreakdownPanel: React.FC<CostBreakdownPanelProps> = ({ profileId }) => {
    const profile = costProfiles.profiles.find(p => p.id === profileId) as CostProfile | undefined;

    if (!profile) {
        return (
            <div className="text-xs text-zinc-500 p-4 border border-dashed border-zinc-600 rounded">
                Selecione um perfil econômico para ver os custos detalhados.
            </div>
        );
    }

    const tiers = Object.entries(profile.salaryTiers) as [string, SalaryTier][];

    return (
        <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase flex items-center gap-2 text-zinc-300">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Tabela de Custos: {profile.name}
                </h4>
                <span className="text-xs font-mono text-zinc-500">{profile.currency}</span>
            </div>

            {/* Salary Tiers Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {tiers.map(([key, tier]) => (
                    <div
                        key={key}
                        className={`p-3 rounded border ${tierColors[key]} transition-all hover:scale-[1.02]`}
                    >
                        <div className="text-xs uppercase font-bold mb-1">{tier.label}</div>
                        <div className="text-lg font-black font-mono">
                            {formatCurrency(tier.monthly, profile.currency)}
                        </div>
                        <div className="text-[10px] opacity-60 font-mono">
                            {formatCurrency(tier.daily, profile.currency)}/dia
                        </div>
                    </div>
                ))}
            </div>

            {/* Cost Constants Summary */}
            <div className="border-t border-zinc-700 pt-3 mt-3">
                <h5 className="text-xs font-bold uppercase text-zinc-400 mb-2 flex items-center gap-2">
                    <Users className="w-3 h-3" /> Custos Operacionais
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-zinc-800/50 p-2 rounded">
                        <span className="opacity-60">Fix Bug</span>
                        <div className="font-bold text-red-400">{formatCurrency(profile.constants.BUG_FIX_COST, profile.currency)}</div>
                    </div>
                    <div className="bg-zinc-800/50 p-2 rounded">
                        <span className="opacity-60">Incidente</span>
                        <div className="font-bold text-red-500">{formatCurrency(profile.constants.INCIDENT_COST, profile.currency)}</div>
                    </div>
                    <div className="bg-zinc-800/50 p-2 rounded">
                        <span className="opacity-60">Treinamento</span>
                        <div className="font-bold text-blue-400">{formatCurrency(profile.constants.TRAINING_COST_PER_HEAD, profile.currency)}</div>
                    </div>
                    <div className="bg-zinc-800/50 p-2 rounded">
                        <span className="opacity-60">Valor/Feature</span>
                        <div className="font-bold text-emerald-400">{formatCurrency(profile.constants.FEATURE_VALUE, profile.currency)}</div>
                    </div>
                </div>
            </div>

            <p className="text-[10px] text-zinc-500 italic border-t border-zinc-800 pt-2">
                {profile.description}
            </p>
        </div>
    );
};
