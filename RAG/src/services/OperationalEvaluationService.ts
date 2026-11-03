import {evaluateOperationalPerformance,type OperationalObservations} from '../core/operationalMetrics.js';
export class OperationalEvaluationService {
    private cursor=0;
    readonly counters={evaluations:0,jevRequests:0,jevFailures:0};
    async evaluate(input:{scenario:string;framework:string;plan?:unknown;observations?:OperationalObservations},signal?:AbortSignal) {
        const metrics=evaluateOperationalPerformance(input.observations);
        this.counters.evaluations++;
        if(!input.plan)return {valid:true,metrics,mechanisms:{valid:false,reason:'no_plan',scope:'not_evaluated'}};
        const keys=[...new Set([process.env.TYPESAFE_API_KEY,process.env.TYPESAFE_API_KEY_1].filter((s):s is string=>Boolean(s)))];
        if(process.env.JEV_MODE==='off'||!keys.length)return {valid:false,metrics,mechanisms:{valid:false,reason:'judge_unavailable',scope:'plan_mechanisms_only'}};
        const criteria={explicit_supported:'The plan specifies an actionable mechanism, grounded in the supplied document, to address this dimension. This is proposed work, not a measured benefit.',mentioned_only:'The dimension is mentioned or implied, but the plan does not specify a grounded actionable mechanism.',absent_or_unsupported:'No relevant mechanism is supplied, or its proposed operation is unsupported or contradictory.'};
        const questions={
            process_error_mitigation:{type:'choice',instructions:'Does `plan` specify a mechanism to prevent or detect process errors, such as lost requests, duplicate records, unauthorized changes or failed handoffs, in the supplied `scenario` and `framework`? Judge the mechanism, not the framework name or a claim of achieved error reduction.',criteria},
            productivity_mechanism:{type:'choice',instructions:'Does `plan` specify a grounded mechanism to improve accepted useful output per total labor hour, such as reducing duplicate handling or avoidable waiting? A generic promise of efficiency or more output without effort information does not establish a mechanism. Do not estimate a percentage.',criteria},
            rework_mechanism:{type:'choice',instructions:'Does `plan` specify a grounded mechanism to reduce correction, repetition or reopening of work, such as an acceptance check, validation at handoff or recurrence prevention? A general quality claim or backup alone is insufficient. Do not infer a measured reduction.',criteria},
        };
        try {
            this.counters.jevRequests++;
            const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${keys[this.cursor++%keys.length]}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.JEV_MODEL||'jev-1.13.0',state:{scenario:input.scenario,framework:input.framework,plan:input.plan},questions}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
            if(!response.ok)throw new Error('Jev unavailable');
            const data=await response.json() as any;
            if(!Object.keys(questions).every(k=>data.answers?.[k]?.type==='choice'&&Object.keys(criteria).includes(data.answers[k].choice)&&Number.isFinite(data.answers[k].confidence)&&data.answers[k].confidence>=0&&data.answers[k].confidence<=1))throw new Error('Invalid typed mechanism assessment');
            return {valid:true,metrics,mechanisms:{valid:true,scope:'plan_mechanisms_only',model:data.model,answers:data.answers,usage:data.usage}};
        }catch {this.counters.jevFailures++;return {valid:false,metrics,mechanisms:{valid:false,reason:'judge_unavailable',scope:'plan_mechanisms_only'}};}
    }
}
