import React,{useEffect,useId,useRef,useState} from 'react';
import {evaluateOperationalPerformance,type OperationalObservations,type OperationalValue} from '../RAG/src/core/operationalMetrics';
import {recordOperationalMetrics,type OperationalReceipt} from '../services/operationalClient';
const fields=[['processedUnits','Unidades processadas'],['acceptedUnits','Unidades aceitas'],['unitsWithProcessError','Unidades com erro de processo'],['reworkedUnits','Unidades retrabalhadas'],['laborHours','Horas totais de trabalho'],['reworkHours','Horas de retrabalho']] as const;
export function OperationalMetricsPanel({initial,darkMode,onChange,onRegistered,scenario,framework}:{initial?:OperationalObservations;darkMode:boolean;onChange:(data:OperationalObservations|undefined)=>void;onRegistered:(receipt:OperationalReceipt|undefined)=>void;scenario:string;framework:string}) {
 const uid=useId();
 const [unit,setUnit]=useState(initial?.baseline?.unit||'unidade processada');
 const [kind,setKind]=useState<'observed'|'simulated'>(initial?.baseline?.provenance||'simulated');
 const [source,setSource]=useState(initial?.baseline?.source||'Entrada manual do usuário');
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(['baseline','current'].flatMap(period=>fields.map(([key])=>[period+'-'+key,String(initial?.[period as 'baseline'|'current']?.[key]??'')]))));
 const [saving,setSaving]=useState(false),[receipt,setReceipt]=useState<OperationalReceipt>(),[saveError,setSaveError]=useState('');
 const latestInput=useRef('');latestInput.current=JSON.stringify({values,unit,kind,source,scenario,framework});
 useEffect(()=>{setReceipt(undefined);onRegistered(undefined);setSaveError('');},[values,unit,kind,source,scenario,framework,onRegistered]);
 function observations(next:Record<string,string>=values,nextUnit=unit,nextKind=kind,nextSource=source):OperationalObservations|undefined {
  if(!Object.values(next).some(v=>v.trim()))return undefined;
  return Object.fromEntries(['baseline','current'].map(period=>[period,{window:period==='baseline'?'referencia':'atual-ou-projetado',unit:nextUnit,definitionId:'process-units-v1',source:nextSource,provenance:nextKind,...Object.fromEntries(fields.map(([key])=>[key,next[period+'-'+key]?.trim()?Number(next[period+'-'+key]):null]))}])) as OperationalObservations;
 }
 let metrics;let error='';try{metrics=evaluateOperationalPerformance(observations());}catch(e){const message=e instanceof Error?e.message:'';error=message.includes('reworkHours exceeds')?'As horas de retrabalho não podem superar as horas totais.':message.includes('exceeds processedUnits')?'As unidades aceitas, com erro ou retrabalhadas não podem superar o total processado.':message.includes('metadata')?'Informe a unidade de trabalho e a fonte dos dados.':message.includes('positive labor')?'Unidades aceitas exigem horas de trabalho maiores que zero.':'Use contagens inteiras não negativas e horas não negativas.';metrics=evaluateOperationalPerformance();}
 function change(next:Record<string,string>){setValues(next);try{evaluateOperationalPerformance(observations(next));onChange(observations(next));}catch{onChange(undefined);}}
 async function register(){const snapshot=latestInput.current;setSaving(true);setSaveError('');try{const data=await recordOperationalMetrics(observations()!,scenario,framework);if(snapshot!==latestInput.current)return;setReceipt(data.trace);onRegistered(data.trace);}catch{if(snapshot===latestInput.current)setSaveError('Não foi possível registrar no servidor. Os cálculos locais e os dados continuam disponíveis para exportação.');}finally{setSaving(false);}}
 const percent=(m:OperationalValue)=>m.value===null?'Não avaliado':`${m.value>0?'+':''}${m.value.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
 const tone=(m:OperationalValue)=>m.value===null?'':m.value<0?'text-orange-500':m.value>0?'text-emerald-500':'';
 const inputClass=`w-full rounded border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${darkMode?'border-zinc-600 bg-zinc-950 text-zinc-100 placeholder:text-zinc-400':'border-zinc-400 bg-white text-zinc-900 placeholder:text-zinc-600'}`;
 return <section className={`p-6 rounded border ${darkMode?'border-zinc-800 bg-zinc-900':'border-zinc-300 bg-white'}`} aria-labelledby={uid+'-title'}>
  <h3 id={uid+'-title'} className="font-bold text-sm uppercase tracking-widest">Erros de processo, produtividade e retrabalho</h3>
  <p className="text-sm mt-2 max-w-prose">{metrics.status==='not_evaluated'?'Informe dados comparáveis dos dois períodos. Os percentuais não são preenchidos a partir da narrativa da simulação.':metrics.provenance==='observed_comparison'?'Comparação descritiva dos dados observados informados.':'Projeção calculada com dados simulados informados.'}</p>
  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 my-6">
   {[['Redução da taxa de erros',metrics.errorRateReductionPct,'Unidades com erro / unidades processadas'],['Ganho de produtividade',metrics.productivityGainPct,'Unidades aceitas / horas totais'],['Redução da parcela de retrabalho',metrics.reworkShareReductionPct,'Horas de retrabalho / horas totais']].map(([label,value,definition])=><div key={label as string}><dt className="text-sm font-medium">{label as string}</dt><dd className={`text-2xl font-bold mt-2 ${tone(value as OperationalValue)}`}>{percent(value as OperationalValue)}</dd><dd className="text-xs mt-2">{definition as string}</dd></div>)}
  </dl>
  <details>
   <summary className="cursor-pointer text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Informar ou revisar os dados de comparação</summary>
   <div className="grid gap-4 sm:grid-cols-3 mt-4">
    <label className="text-sm">Unidade de trabalho<input className={inputClass} value={unit} onChange={e=>{setUnit(e.target.value);onChange(observations(values,e.target.value));}} /></label>
    <label className="text-sm">Origem dos valores<select className={inputClass} value={kind} onChange={e=>{const k=e.target.value as 'observed'|'simulated';setKind(k);onChange(observations(values,unit,k));}}><option value="simulated">Estimativas simuladas</option><option value="observed">Dados observados</option></select></label>
    <label className="text-sm">Fonte ou registro<input className={inputClass} value={source} onChange={e=>{setSource(e.target.value);onChange(observations(values,unit,kind,e.target.value));}} /></label>
   </div>
   <div className="grid gap-6 sm:grid-cols-2 mt-4">
    {(['baseline','current'] as const).map(period=><fieldset key={period} className="space-y-3"><legend className="font-semibold mb-3">{period==='baseline'?'Período de referência':'Período atual ou projetado'}</legend>{fields.map(([key,label])=><label key={key} htmlFor={uid+period+key} className="block text-sm">{label}<input id={uid+period+key} type="number" min="0" step={key.endsWith('Hours')?'any':'1'} placeholder="Sem dados" className={inputClass} value={values[period+'-'+key]} onChange={e=>change({...values,[period+'-'+key]:e.target.value})} /></label>)}</fieldset>)}
   </div>
   {error&&<p role="alert" className="text-sm text-orange-500 mt-3">Confira unidades, contagens e horas: {error}</p>}
   <button type="button" disabled={saving||metrics.status!=='computed'||Boolean(error)} aria-busy={saving} className="mt-4 rounded border border-current px-4 py-2 text-sm font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed" onClick={register}>{saving?'Registrando cálculo…':'Registrar cálculo no FrameSim'}</button>
   {receipt&&<p role="status" className="text-xs mt-3 break-all">Cálculo registrado no FrameSim · {receipt.runId}</p>}
   {saveError&&<p role="alert" className="text-sm text-orange-500 mt-3">{saveError}</p>}
  </details>
  <p className="text-xs max-w-prose mt-4">Valores negativos indicam piora. Linha de base zero ou dados ausentes não produzem um ganho percentual. A comparação, inclusive com dados observados, não comprova que o framework causou a mudança. Os dados informados acompanham a exportação do relatório.</p>
 </section>;
}
