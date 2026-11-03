import assert from 'node:assert/strict';
import {StandardJevRuntime} from '../services/StandardJevRuntime.js';
const previousFetch=globalThis.fetch;
const names=['JEV_MODE','TYPESAFE_API_KEY','JEV_MODEL'];
const previous=names.map(n=>[n,process.env[n]] as const);
try {
  const runtime=new StandardJevRuntime();
  process.env.JEV_MODE='off';
  globalThis.fetch=async()=>{throw new Error('off must not call API');};
  assert.equal((await runtime.judge({})).error,'mode_off');
  assert.equal(runtime.counters.httpRequests,0);
  process.env.JEV_MODE='active';process.env.TYPESAFE_API_KEY='offline';process.env.JEV_MODEL='jev-test';
  globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    const answers=Object.fromEntries(Object.entries(body.questions).map(([id,q]:[string,any])=>[id,
      q.type==='score'?{type:'score',score:2,confidence:0.99}:q.type==='noul'?{type:'noul',noul:0.9}:{type:'choice',choice:Object.keys(q.criteria)[0],confidence:0.99}]));
    return new Response(JSON.stringify({model:'jev-test',answers,usage:{input_tokens:100,output_tokens:20}}),{status:200});
  };
  const person=await runtime.personas({situation:'Mudanca proporcional',turn:1,stakeholders:[{id:'p1',nome:'Ana',cargo:'Analista',estado:{humor:0,estresse:30}}]});
  assert.equal(person.judgment.decisions[0].origin,'jev');
  assert.equal(person.judgment.audit.acceptedDecisions,1);
  assert.equal(person.judgment.audit.responseReceived,true);
  assert.equal((await runtime.judge({})).valid,true);
  assert.deepEqual(runtime.counters,{personaBatches:1,resultJudgments:1,httpRequests:2,failedRequests:0,lowConfidenceBatches:0});
  const actionState={result:{plan:{actions:[{task:'T1',action:'Restore a file',evidence:'Authorized restoration log',sourceQuote:'Verify restoration'}]}}};
  const actionJudge=await runtime.judge(actionState);
  assert.equal(actionJudge.valid,true);
  assert.equal(actionJudge.answers?.action_0_support.type,'choice');
  assert.equal(actionJudge.answers?.action_0_evidence.type,'choice');
  const completeFetch=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    const response=await completeFetch(url,init);
    const data=await response.json() as any;
    delete data.answers.action_0_support;
    return new Response(JSON.stringify(data),{status:200});
  };
  assert.equal((await runtime.judge(actionState)).valid,false,'Global scores must not conceal a missing per-action answer');
  globalThis.fetch=completeFetch;
  process.env.JEV_MODE='shadow';
  const shadow=await runtime.personas({situation:'Teste',turn:1,stakeholders:[{id:'p1',nome:'Ana'}]});
  assert.equal(shadow.judgment.audit.responseReceived,true);
  assert.equal(shadow.judgment.audit.acceptedDecisions,1);
  assert.equal(shadow.judgment.audit.appliedDecisions,0);
  console.log('OK Standard Jev runtime: typed decisions, result judge, shadow and HTTP counters');
} finally {
 globalThis.fetch=previousFetch;
 for(const[n,v]of previous){if(v===undefined)delete process.env[n];else process.env[n]=v;}
}
