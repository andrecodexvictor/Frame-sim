export interface OperationalPeriod {
    window: string;
    unit: string;
    definitionId: string;
    source: string;
    provenance: 'observed' | 'simulated';
    processedUnits?: number | null;
    acceptedUnits?: number | null;
    unitsWithProcessError?: number | null;
    reworkedUnits?: number | null;
    laborHours?: number | null;
    reworkHours?: number | null;
}

export interface OperationalObservations { baseline?: OperationalPeriod; current?: OperationalPeriod }
export interface OperationalValue { value: number | null; reason?: string }
export interface OperationalEvaluation {
    status: 'computed' | 'not_evaluated';
    provenance: 'observed_comparison' | 'simulated_projection' | 'unavailable';
    baseline?: OperationalPeriod;
    current?: OperationalPeriod;
    errorRateBefore: OperationalValue;
    errorRateAfter: OperationalValue;
    errorRateReductionPct: OperationalValue;
    errorsDifferenceAtCurrentVolume: OperationalValue;
    productivityBefore: OperationalValue;
    productivityAfter: OperationalValue;
    productivityGainPct: OperationalValue;
    reworkShareBefore: OperationalValue;
    reworkShareAfter: OperationalValue;
    reworkShareReductionPct: OperationalValue;
    reworkRateBefore: OperationalValue;
    reworkRateAfter: OperationalValue;
    reworkRateReductionPct: OperationalValue;
    interpretation: string;
}

const absent=(reason:string):OperationalValue=>({value:null,reason});
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const ratio=(a:number|null|undefined,b:number|null|undefined):OperationalValue=>
    !finite(a)||!finite(b)?absent('missing_denominator_or_numerator'):b===0?absent('zero_denominator'):{value:a/b};
const relative=(before:OperationalValue,after:OperationalValue,reduction:boolean):OperationalValue=>
    before.value===null||after.value===null?absent('missing_comparable_rates'):before.value===0?absent('zero_baseline'):{value:(reduction?before.value-after.value:after.value-before.value)/before.value*100};

export function validateOperationalPeriod(period:OperationalPeriod):void {
    if(!period||!['window','unit','definitionId','source'].every(k=>typeof period[k as keyof OperationalPeriod]==='string'&&String(period[k as keyof OperationalPeriod]).trim().length>0&&String(period[k as keyof OperationalPeriod]).length<=300)
        || !['observed','simulated'].includes(period.provenance))throw new Error('Invalid operational period metadata');
    const counts=['processedUnits','acceptedUnits','unitsWithProcessError','reworkedUnits'] as const;
    for(const key of [...counts,'laborHours','reworkHours'] as const){
        const value=period[key];if(value!==undefined&&value!==null&&(!finite(value)||value<0||(counts.includes(key as typeof counts[number])&&!Number.isInteger(value))))throw new Error(`Invalid operational value: ${key}`);
    }
    for(const key of ['acceptedUnits','unitsWithProcessError','reworkedUnits'] as const)
        if(finite(period.processedUnits)&&finite(period[key])&&period[key]>period.processedUnits)throw new Error(`${key} exceeds processedUnits`);
    if(finite(period.laborHours)&&finite(period.reworkHours)&&period.reworkHours>period.laborHours)throw new Error('reworkHours exceeds laborHours');
    if(period.laborHours===0&&finite(period.acceptedUnits)&&period.acceptedUnits>0)throw new Error('Accepted output requires positive labor hours');
}

/** Descriptive changes. Neither the formulas nor a simulated projection establish causality. */
export function evaluateOperationalPerformance(observations?:OperationalObservations):OperationalEvaluation {
    if(observations!==undefined&&(!observations||typeof observations!=='object'||Array.isArray(observations)))throw new Error('Invalid operational observations');
    for(const value of [observations?.baseline,observations?.current])if(value!==undefined&&(!value||typeof value!=='object'||Array.isArray(value)))throw new Error('Invalid operational period');
    const before=observations?.baseline,after=observations?.current;
    if(before)validateOperationalPeriod(before);if(after)validateOperationalPeriod(after);
    const missing=!before||!after?'missing_baseline_or_current':before.unit!==after.unit||before.definitionId!==after.definitionId?'incomparable_unit_or_definition':undefined;
    const read=(period:OperationalPeriod|undefined,a:keyof OperationalPeriod,b:keyof OperationalPeriod)=>missing?absent(missing):ratio(period?.[a] as number|undefined,period?.[b] as number|undefined);
    const eb=read(before,'unitsWithProcessError','processedUnits'),ea=read(after,'unitsWithProcessError','processedUnits');
    const pb=read(before,'acceptedUnits','laborHours'),pa=read(after,'acceptedUnits','laborHours');
    const rb=read(before,'reworkHours','laborHours'),ra=read(after,'reworkHours','laborHours');
    const ub=read(before,'reworkedUnits','processedUnits'),ua=read(after,'reworkedUnits','processedUnits');
    const hasRates=[eb,ea,pb,pa,rb,ra,ub,ua].some(v=>v.value!==null);
    const evaluated=[relative(eb,ea,true),relative(pb,pa,false),relative(rb,ra,true),relative(ub,ua,true)].some(v=>v.value!==null);
    return {
        status:evaluated?'computed':'not_evaluated',provenance:!hasRates?'unavailable':before?.provenance==='observed'&&after?.provenance==='observed'?'observed_comparison':'simulated_projection',
        baseline:before,current:after,errorRateBefore:eb,errorRateAfter:ea,errorRateReductionPct:relative(eb,ea,true),
        errorsDifferenceAtCurrentVolume:eb.value===null||!finite(after?.processedUnits)||!finite(after?.unitsWithProcessError)?absent(missing||'missing_current_volume'):{value:eb.value*after.processedUnits-after.unitsWithProcessError},
        productivityBefore:pb,productivityAfter:pa,productivityGainPct:relative(pb,pa,false),
        reworkShareBefore:rb,reworkShareAfter:ra,reworkShareReductionPct:relative(rb,ra,true),
        reworkRateBefore:ub,reworkRateAfter:ua,reworkRateReductionPct:relative(ub,ua,true),
        interpretation:'Mudanças descritivas entre os períodos informados. Produtividade usa unidades aceitas por hora total de trabalho; retrabalho usa horas de retrabalho por hora total. Diferença de erros considera o volume atual à taxa de referência. Ausência de dados permanece nula. Projeções simuladas e comparações antes/depois não comprovam efeito causal do framework.'
    };
}
