import { SimulationState, GoalEvaluation } from '../types/index.js';

export class GoalAgent {
    /**
     * Evaluates the current state and adjusts difficulty or goals.
     * Logic:
     * - If Morale & Velocity are too high (>90), introduce friction (Difficulty 1.2x).
     * - If Morale & Velocity are too low (<30), introduce hope (Difficulty 0.8x).
     * - Otherwise, 1.0 (Normal).
     */
    evaluate(state: SimulationState): GoalEvaluation {
        console.log('🎯 GoalAgent: Evaluating simulation balance...');

        const { moral_time, velocidade_sprint } = state;
        const avgScore = (moral_time + velocidade_sprint) / 2;

        if (avgScore > 90) {
            console.log('⚠️ Simulation too easy. Injecting crisis.');
            return {
                difficulty_scalar: 1.2,
                crisis_triggered: true,
                new_directive: "Crisis Mode: Stakeholders become more skeptical due to overconfidence.",
                reasoning: "Team performance is unrealistically high."
            };
        }

        if (avgScore < 30) {
            console.log('🆘 Simulation too hard. Injecting hope.');
            return {
                difficulty_scalar: 0.8,
                hope_triggered: true,
                new_directive: "Recovery Mode: Management offers simplified goals to boost morale.",
                reasoning: "Team is nearing collapse (burnout)."
            };
        }

        return {
            difficulty_scalar: 1.0,
            reasoning: "Simulation is balanced."
        };
    }
}
