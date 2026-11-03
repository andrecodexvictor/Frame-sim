import type {SimulationConfig} from '../types';
export function pairedCaseSeed(config:SimulationConfig):number {
 if(config.seed!==undefined){if(!Number.isFinite(config.seed))throw new Error('Invalid evaluation seed');return config.seed;}
 const {frameworks,seed,...context}=config;
 const input=JSON.stringify(Object.keys(context).sort().map(key=>[key,context[key as keyof typeof context]]));
 let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;
}
