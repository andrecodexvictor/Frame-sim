import type {OperationalObservations,OperationalEvaluation} from '../RAG/src/core/operationalMetrics';
import {apiBaseUrl,type ProviderGenerateResponse} from './providerClient';
export type OperationalReceipt=NonNullable<ProviderGenerateResponse['trace']>;
export async function recordOperationalMetrics(observations:OperationalObservations,scenario:string,framework:string):Promise<{metrics:OperationalEvaluation;trace:OperationalReceipt}> {
 const runId='manual-'+crypto.randomUUID();
 const response=await fetch(apiBaseUrl()+'/evaluate-operational',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,scenario,framework,observations}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok||data.trace?.engine!=='FrameSim'||data.trace.runId!==runId)throw new Error('Não foi possível registrar o cálculo no FrameSim.');
 return data;
}
