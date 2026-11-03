import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class EvaluationAudit {
    readonly counters={receipts:0};
    private readonly code:Promise<string>;
    constructor(private readonly root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../.context/evaluation-audit')) {
        this.code=readFile(fileURLToPath(import.meta.url)).then(b=>createHash('sha256').update(b).digest('hex'));
    }
    runId(value:unknown):string {
        if(value===undefined)return randomUUID();
        if(typeof value!=='string'||!value.length||value.length>128||!/^[A-Za-z0-9_.-]+$/.test(value)||value.includes('..'))throw new Error('Invalid evaluation run ID');
        return value;
    }
    async record(route:string,runId:string,input:unknown,output:unknown) {
        this.runId(runId);
        const trace={engine:'FrameSim',instrument:'native-audit-v1',traceId:randomUUID(),runId,route,inputSha256:digest(input),outputSha256:digest(output),auditCodeSha256:await this.code,serverPid:process.pid,at:new Date().toISOString()};
        const dir=path.join(this.root,digest(runId));await mkdir(dir,{recursive:true});
        const target=path.join(dir,trace.traceId+'.json');await writeFile(target+'.tmp',JSON.stringify(trace,null,2));await rename(target+'.tmp',target);
        this.counters.receipts++;
        return trace;
    }
    async receipts(runId:string) {
        this.runId(runId);const dir=path.join(this.root,digest(runId));
        let names:string[];try{names=await readdir(dir);}catch{return [];}
        return Promise.all(names.filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await readFile(path.join(dir,n),'utf8'))));
    }
}
