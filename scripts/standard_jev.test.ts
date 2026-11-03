import assert from 'node:assert/strict';
import {runSimulation} from '../services/geminiService';

(globalThis as any).window=globalThis;
const routes: string[]=[];
globalThis.fetch=async(input,init)=>{
  const route=new URL(String(input)).pathname;
  routes.push(route);
  const body=JSON.parse(String(init?.body||'{}'));
  let payload: unknown;
  if(route==='/api/status') payload={jev:{mode:'active',configured:true}};
  else if(route==='/api/persona-judgment') payload={mode:'active',judgment:{
    decisions:body.stakeholders.map((s:any)=>({personaId:s.id,reaction:'apoiar',intensity:'alta',moralDirection:'positive',influencesPeers:false,confidence:0.99,origin:'jev',effects:{moralDelta:5,engagementDelta:0,stressDelta:0,confidenceDelta:0}})),
    audit:{model:'jev-test',origin:'jev',requestHash:'test',confidence:0.99,latencyMs:1,inputTokens:100,outputTokens:20}}};
  else if(route==='/api/judge-result')payload={mode:'active',valid:true,model:'jev-test',answers:{scenario_fit:{type:'score',score:3,confidence:0.99}},inputTokens:100,outputTokens:20};
  else payload={provider:'offline-test',model:'test',attempts:1,degraded:false,content:JSON.stringify({summary:{finalAdoption:75,totalRoi:0,maturityScore:6,monthsToComplete:12,scenarioValidity:80},implementationNarrative:'teste',keyPersonas:[],timeline:Array.from({length:12},(_,i)=>({month:i+1,adoptionRate:75,compliance:60,efficiency:70,rawData:{featuresDelivered:2,bugsGenerated:1,criticalIncidents:0,teamSize:5,learningCurveFactor:1}}))})};
  return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
};
const output=await runSimulation({frameworkName:'GEAR',frameworkText:'Fluxo visivel e responsabilidades proporcionais.',frameworkCategory:'governance',companySize:5,sector:'Servicos',budgetLevel:'low',currentMaturity:1,employeeArchetypes:['ceo','overworked'],techDebtLevel:'medium',operationalVelocity:'agile',previousFailures:false,scenarioContext:'Organizar fila de demandas.',durationMonths:12,seed:42});
assert.equal(routes.filter(r=>r==='/api/persona-judgment').length,12,'Standard must request one Jev batch for each month');
assert.equal(routes.filter(r=>r==='/api/judge-result').length,1,'Standard must ask Jev to judge the final recalculated result');
assert.ok((output as any).jev?.appliedDecisions>0,'Accepted Jev decisions must affect human state');
assert.equal((output as any).judgeEvaluation?.valid,true);
assert.ok(routes.indexOf('/api/persona-judgment')<routes.indexOf('/api/generate'));
assert.ok(routes.indexOf('/api/judge-result')>routes.indexOf('/api/generate'));
console.log('OK Standard Jev decisions and result judge');
