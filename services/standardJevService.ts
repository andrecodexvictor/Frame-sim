import {apiBaseUrl} from './providerClient';
import {deriveInitialBrain,updateBrain,evaluateDecisions,evaluateGraveDecisions,applyContagion,aggregate,reflect,clamp,mulberry32,simulateTeamOffline} from '../RAG/src/core/employeeBrainCore';
import type {BrainProfileInput,EmergentEvent,TurnContext} from '../RAG/src/core/employeeBrainCore';
import type {PersonaTurnJudgment} from '../RAG/src/services/PersonaJudgmentModule';
import type {SimulationOutput,SingleSimulationConfig} from '../types';

async function request(route:string,body?:unknown,signal?:AbortSignal,timeout=30000) {
  const controller=new AbortController();
  const abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort('timeout'),timeout);
  try {
    const response=await fetch(apiBaseUrl()+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    if(!response.ok)throw new Error(`Jev route HTTP ${response.status}`);
    return await response.json();
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export async function simulateStandardTeam(profiles:BrainProfileInput[],keyIds:string[],months:number,seed:number,situation:string,signal?:AbortSignal) {
  let mode:'off'|'shadow'|'active'='off';
  let unavailable=false;
  try {const status=await request('/status',undefined,signal,3000);mode=status.jev?.mode||'off';}catch {unavailable=true;}
  const jev={mode,calls:0,acceptedDecisions:0,appliedDecisions:0,fallbackDecisions:0,unavailable,audits:[] as PersonaTurnJudgment['audit'][]};
  if(mode==='off')return {...simulateTeamOffline(profiles,months,seed),jev};
  let brains=profiles.map(p=>deriveInitialBrain(p,seed));
  const rng=mulberry32(seed);
  const emergentEvents:EmergentEvent[]=[];
  let moralGlobal=50;
  for(let month=1;month<=months;month++) {
    if(signal?.aborted)throw new Error('Simulation cancelled');
    const ctx:TurnContext={turno:month,pressaoBase:month<=2?0.7:month<=4?0.5:0.35,impactoPessoal:0,moralGlobal};
    brains=brains.map(b=>updateBrain(b,ctx));
    let judgment:PersonaTurnJudgment|undefined;
    try {
      const response=await request('/persona-judgment',{situation,turn:month,stakeholders:brains.filter(b=>keyIds.includes(b.personaId)).map(b=>({id:b.personaId,nome:b.nome,cargo:b.cargo,estado:b,context:JSON.stringify(profiles.find(p=>p.id===b.personaId))}))},signal);
      judgment=response.judgment;
      if(!judgment || !Array.isArray(judgment.decisions) || !judgment.audit)throw new Error('Invalid Jev judgment');
      jev.calls++;
      jev.audits.push(judgment.audit);
    }catch {jev.unavailable=true;}
    const decisions=new Map(judgment?.decisions.map(d=>[d.personaId,d]));
    let moralDelta=0;
    for(let i=0;i<brains.length;i++) {
      const decision=decisions.get(brains[i].personaId);
      if(keyIds.includes(brains[i].personaId)) {
        if(decision?.origin==='jev')jev.acceptedDecisions++;
        else jev.fallbackDecisions++;
      }
      const active=mode==='active' && decision?.origin==='jev';
      const evaluated=active?evaluateGraveDecisions(brains[i],ctx,rng):evaluateDecisions(brains[i],ctx,rng);
      brains[i]=evaluated.brain;
      for(const d of evaluated.decisions) {
        emergentEvents.push({mes:month,personaId:brains[i].personaId,nome:brains[i].nome,tipo:d.tipo,narrativa:d.narrativa});
        moralDelta+=d.efeitos.moralGlobal||0;
        if(d.efeitos.contagio)brains=applyContagion(brains,brains[i].personaId,d.efeitos.contagio,rng);
      }
      if(active && brains[i].status==='ativo') {
        const d=decision!;
        brains[i]={...brains[i],humor:clamp(brains[i].humor+d.effects.moralDelta*2,-100,100),estresse:clamp(brains[i].estresse+d.effects.stressDelta,0,100),engajamento:clamp(brains[i].engajamento+d.effects.engagementDelta,0,100)};
        moralDelta+=d.effects.moralDelta;
        jev.appliedDecisions++;
        emergentEvents.push({mes:month,personaId:brains[i].personaId,nome:brains[i].nome,tipo:`jev_${d.reaction}`,narrativa:`${brains[i].nome}: ${d.reaction} (${d.intensity}; Jev).`});
        if(d.influencesPeers && d.effects.contagion)brains=applyContagion(brains,brains[i].personaId,{alvos:d.effects.contagion.targets,humorDelta:d.effects.contagion.humorDelta,estresseDelta:d.effects.contagion.stressDelta},rng);
      }
    }
    moralGlobal=clamp(aggregate(brains).moral+moralDelta,0,100);
    if(month%3===0)brains=brains.map(b=>reflect(b));
  }
  return {brains,emergentEvents,jev};
}

export async function judgeStandardResult(result:SimulationOutput,config:SingleSimulationConfig,signal?:AbortSignal) {
  try {
    return await request('/judge-result',{scenario:config.scenarioContext,employees:config.companySize,budget:config.budgetLevel,framework:config.frameworkText.slice(0,5000),result:{summary:result.summary,implementationNarrative:result.implementationNarrative,timeline:result.timeline,keyPersonas:result.keyPersonas,recommendations:result.recommendations,risks:result.risks}},signal);
  }catch {return {mode:'active',valid:false,error:'judge_unavailable'};}
}
