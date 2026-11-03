import type {SimulationOutput} from '../types';

function finite(value:unknown):value is number {return typeof value==='number' && Number.isFinite(value);}
function percentage(value:unknown):boolean {return finite(value) && value>=0 && value<=100;}

/** Reject missing observations before any UI or financial defaults can fill them. */
export function validateGeneratedSimulation(value:any,months:number): asserts value is SimulationOutput {
  if(!value || !value.summary || typeof value.implementationNarrative!=='string' || !Array.isArray(value.timeline) || value.timeline.length!==months)throw new Error('Invalid simulation structure or horizon');
  const s=value.summary;
  if(!percentage(s.finalAdoption) || !percentage(s.scenarioValidity) || !finite(s.maturityScore) || s.maturityScore<1 || s.maturityScore>10 || !finite(s.monthsToComplete) || s.monthsToComplete<=0)throw new Error('Invalid simulation summary');
  for(let i=0;i<months;i++) {
    const m=value.timeline[i];
    if(m?.month!==i+1 || !percentage(m.adoptionRate) || !percentage(m.compliance) || !finite(m.efficiency) || m.efficiency<0 || m.efficiency>200
      || !['featuresDelivered','bugsGenerated','criticalIncidents','teamSize','learningCurveFactor'].every(k=>finite(m.rawData?.[k])&&m.rawData[k]>=0)
      || m.rawData.teamSize<1)throw new Error(`Invalid observed fields in simulation month ${i+1}`);
  }
  if(Math.abs(s.finalAdoption-value.timeline[months-1].adoptionRate)>0.01)throw new Error('Final adoption contradicts last simulated month');
}
