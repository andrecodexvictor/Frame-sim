import assert from 'node:assert/strict';
import {calculateMonthlyMetrics} from '../services/metricsCalculator';
import {calculateTeamResistance,enrichArchetypesToTeam} from '../services/personaEnricher';
import {runSimulation} from '../services/geminiService';
import {pairedCaseSeed} from '../services/evaluationConfig';
import type {SingleSimulationConfig,SimulationConfig} from '../types';

(globalThis as any).window=globalThis;
const config:SingleSimulationConfig={frameworkName:'GEAR',frameworkText:'Fila unica, responsavel identificado e evidencia de recuperacao.',frameworkCategory:'governance',companySize:1,sector:'Servicos',budgetLevel:'low',employeeArchetypes:['ceo'],techDebtLevel:'medium',operationalVelocity:'agile',previousFailures:false,scenarioContext:'Unico trabalhador acumula direcao e operacao; recuperar servico e ordenar demandas.',durationMonths:2,seed:42,economicProfileId:'br_pme',economicScenarioId:'base'};
const raw={month:1,teamSize:1,featuresDelivered:0,bugsGenerated:0,criticalIncidents:0,teamMood:50,learningCurveFactor:1,efficiency:100,compliance:0};
const zero=calculateMonthlyMetrics(raw,config as unknown as SimulationConfig,0,0,0,()=>0.99);
assert.equal(zero.valueDelivered,0,'zero compliance must not be replaced with 100%');
const person=enrichArchetypesToTeam(['skeptic'],1,42).team[0];
assert.equal(calculateTeamResistance([person]),calculateTeamResistance(Array.from({length:100},()=>person)), 'resistance index must not increase merely by duplicating the same composition');
for(const size of [1,5,10,25,50,100,150])assert.equal(enrichArchetypesToTeam(['ceo','skeptic'],size,42).team.length,size);
const caseConfig={...config,frameworks:[{id:'a',name:'GEAR',text:'same document'}]} as unknown as SimulationConfig;
assert.equal(pairedCaseSeed(caseConfig),pairedCaseSeed({...caseConfig,frameworks:[{id:'b',name:'COBIT',text:'other document'}]}),'UI case seed must exclude treatment labels and texts');

const originalFetch=globalThis.fetch;
const prompts:string[]=[];
let missingTimeline=false;
globalThis.fetch=async(input,init)=>{
 if(String(input).endsWith('/api/status'))return new Response(JSON.stringify({jev:{mode:'off'}}));
 const body=JSON.parse(String(init?.body));prompts.push(body.prompt);
 const content={summary:{finalAdoption:50,totalRoi:0,maturityScore:5,monthsToComplete:2,scenarioValidity:80},implementationNarrative:'Hipotese sintetica.',keyPersonas:[],timeline:missingTimeline?undefined:Array.from({length:2},(_,i)=>({month:i+1,adoptionRate:50,efficiency:100,compliance:0,rawData:{featuresDelivered:0,bugsGenerated:0,criticalIncidents:0,teamSize:1,learningCurveFactor:1}}))};
 return new Response(JSON.stringify({provider:'fixture-for-test',model:'test',degraded:false,attempts:1,content:JSON.stringify(content)}));
};
try {
 const first=await runSimulation({...config,evaluationMode:'blinded-poc'} as SingleSimulationConfig);
 const second=await runSimulation({...config,frameworkName:'COBIT 2019',evaluationMode:'blinded-poc'} as SingleSimulationConfig);
 assert.equal(first.summary.totalRoi,-100,'monthly outer compliance must reach the financial calculator');
 assert.deepEqual(first.summary,second.summary,'identical document and seed must not change output solely by framework label');
 assert.equal(prompts[0],prompts[1],'blinded prompts and human state must be invariant to the framework label');
 assert.ok(!prompts[0].includes('vasto conhecimento interno'),'comparison must not fill documentary gaps with model prior knowledge');
 assert.ok(!prompts[0].includes('FIT PÉSSIMO'),'comparison must not be primed by framework-name penalties');
 missingTimeline=true;
 const invalid=await runSimulation(config);
 assert.equal(invalid.execution?.mode,'fixture','missing observed fields must never be labeled live');
 console.log('OK fidelity: zero values, composition invariance, 1-150 cardinality, label-blinded prompts, paired state, strict missing data');
}finally{globalThis.fetch=originalFetch;}
