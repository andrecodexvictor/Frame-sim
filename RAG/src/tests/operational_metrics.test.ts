import assert from 'node:assert/strict';
import {evaluateOperationalPerformance,type OperationalPeriod} from '../core/operationalMetrics.js';
import {OperationalEvaluationService} from '../services/OperationalEvaluationService.js';
const baseline:OperationalPeriod={window:'before',unit:'pedido',definitionId:'orders-v1',source:'constructed-test',provenance:'simulated',processedUnits:100,acceptedUnits:80,unitsWithProcessError:20,reworkedUnits:20,laborHours:160,reworkHours:40};
const current:OperationalPeriod={...baseline,window:'after',processedUnits:200,acceptedUnits:170,unitsWithProcessError:30,reworkedUnits:20,laborHours:200,reworkHours:20};
const metric=evaluateOperationalPerformance({baseline,current});
assert.ok(Math.abs(metric.errorRateReductionPct.value!-25)<1e-9,'Normalize errors by volume, even when absolute error count increases');
assert.equal(metric.errorsDifferenceAtCurrentVolume.value,10);
assert.equal(metric.productivityGainPct.value,70);
assert.equal(metric.reworkShareReductionPct.value,60);
assert.equal(metric.reworkRateReductionPct.value,50);
assert.equal(metric.provenance,'simulated_projection');
assert.equal(evaluateOperationalPerformance().status,'not_evaluated');
assert.equal(evaluateOperationalPerformance().productivityGainPct.value,null);
assert.equal(evaluateOperationalPerformance({baseline,current:{window:'after',unit:'pedido',definitionId:'orders-v1',source:'missing data test',provenance:'simulated'}}).status,'not_evaluated','A baseline alone does not establish a change');
assert.equal(evaluateOperationalPerformance({baseline,current:{...current,unitsWithProcessError:0}}).errorRateReductionPct.value,100);
assert.equal(evaluateOperationalPerformance({baseline:{...baseline,unitsWithProcessError:0},current}).errorRateReductionPct.value,null,'Zero baseline is not infinite improvement');
assert.equal(evaluateOperationalPerformance({baseline,current:{...current,unit:'chamado'}}).status,'not_evaluated');
assert.ok(evaluateOperationalPerformance({baseline,current:{...current,unitsWithProcessError:100}}).errorRateReductionPct.value!<0,'Do not hide deterioration');
assert.throws(()=>evaluateOperationalPerformance({baseline,current:{...current,reworkHours:201}}),/exceeds/);
assert.throws(()=>evaluateOperationalPerformance({baseline,current:{...current,processedUnits:Infinity}}),/Invalid/);
console.log('OK operational metrics: volume normalization, productivity, rework, zero, missing data and deterioration');
const previousMode=process.env.JEV_MODE,previousKey=process.env.TYPESAFE_API_KEY,previousKey1=process.env.TYPESAFE_API_KEY_1,previousFetch=globalThis.fetch;
let judgeCalls=0;
try {
    process.env.TYPESAFE_API_KEY='test-backend-credential';delete process.env.TYPESAFE_API_KEY_1;
    globalThis.fetch=async()=>{judgeCalls++;return new Response(JSON.stringify({model:'jev-test',answers:Object.fromEntries(['process_error_mitigation','productivity_mechanism','rework_mechanism'].map(id=>[id,{type:'choice',choice:'explicit_supported',confidence:.8}]))}));};
    const service=new OperationalEvaluationService();
    for(const mode of [undefined,'off','invalid-mode']){
        if(mode===undefined)delete process.env.JEV_MODE;else process.env.JEV_MODE=mode;
        const output=await service.evaluate({scenario:'bounded case',framework:'supplied source',plan:{actions:[]}});
        assert.equal(output.valid,false);
        assert.equal(judgeCalls,0,'Missing or disabled Jev mode must never consume inference');
    }
    process.env.JEV_MODE='active';
    const active=await service.evaluate({scenario:'bounded case',framework:'supplied source',plan:{actions:[]}});
    assert.equal(active.valid,true);assert.equal(judgeCalls,1);
    console.log('OK operational judge: explicit opt-in, disabled defaults and typed active response');
}finally{
    globalThis.fetch=previousFetch;
    for(const [name,value] of [['JEV_MODE',previousMode],['TYPESAFE_API_KEY',previousKey],['TYPESAFE_API_KEY_1',previousKey1]])if(value===undefined)delete process.env[name!];else process.env[name!]=value;
}
