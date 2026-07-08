/**
 * Testes do employeeBrainCore. Rodar de dentro de RAG/:
 *   npx tsx src/tests/brain.test.ts
 */
import assert from 'node:assert';
import {
    BrainProfileInput,
    EmployeeBrainState,
    TurnContext,
    deriveInitialBrain,
    updateBrain,
    evaluateDecisions,
    applyContagion,
    simulateTeamOffline,
    mulberry32,
} from '../core/employeeBrainCore.js';

let testCount = 0;
function test(name: string, fn: () => void) {
    fn();
    testCount++;
    console.log(`  ✓ ${name}`);
}

function mkProfile(id: string, nome: string, over: Partial<BrainProfileInput> = {}): BrainProfileInput {
    return { id, nome, cargo: 'Desenvolvedor', ...over };
}

// 1. Perfil frágil cruza estresse 80 antes do perfil resiliente sob mesma pressão
test('fragil cruza estresse 80 antes de resiliente', () => {
    const fragil = deriveInitialBrain(mkProfile('p-fragil', 'Ana', { gestao_estresse: 'Necessita ambiente estável' }), 1);
    const forte = deriveInitialBrain(mkProfile('p-forte', 'Bia', { gestao_estresse: 'Thrives no caos' }), 1);

    function turnosAte80(b0: EmployeeBrainState): number {
        let b = b0;
        for (let t = 1; t <= 100; t++) {
            b = updateBrain(b, { turno: t, pressaoBase: 0.8, impactoPessoal: 0, moralGlobal: 50 });
            if (b.estresse > 80) return t;
        }
        return Infinity;
    }

    const tf = turnosAte80(fragil);
    const tr = turnosAte80(forte);
    assert.ok(tf < tr, `frágil (${tf}) deveria cruzar 80 antes do resiliente (${tr})`);
});

// 2. Estresse alto sustentado + humor<-40 → pedido_demissao em ≤6 turnos (seed fixo)
test('pedido_demissao dispara em <=6 turnos com seed fixo', () => {
    let b: EmployeeBrainState = {
        ...deriveInitialBrain(mkProfile('p-quit', 'Caio'), 1),
        estresse: 85,
        humor: -50,
        energia: 80,
        turnosEstresseAlto: 2,
        adaptabilidade: 60, // evita resistencia_passiva
        influencia: 40, // evita fofoca/confronto
    };
    const rng = mulberry32(7);
    const ctx: TurnContext = { turno: 1, pressaoBase: 0.5, impactoPessoal: 0, moralGlobal: 40 };
    let quitTurn = -1;
    for (let t = 1; t <= 6; t++) {
        const r = evaluateDecisions(b, ctx, rng);
        b = r.brain;
        if (r.decisions.some((d) => d.tipo === 'pedido_demissao')) { quitTurn = t; break; }
    }
    assert.ok(quitTurn > 0 && quitTurn <= 6, `esperava pedido_demissao em <=6 turnos, não ocorreu`);
    assert.strictEqual(b.status, 'pediu_demissao');
});

// 3. Determinismo: mesmo seed → estado final idêntico
test('mesmo seed produz resultado identico', () => {
    const profiles = [
        mkProfile('a', 'Ana', { gestao_estresse: 'Necessita ambiente estável', opiniao_agil: 'Cético' }),
        mkProfile('b', 'Bia', { gestao_estresse: 'Thrives no caos', opiniao_agil: 'Entusiasta' }),
        mkProfile('c', 'Caio', { gestao_estresse: 'Workaholic', opiniao_agil: 'Pragmático' }),
    ];
    const r1 = simulateTeamOffline(profiles, 8, 12345);
    const r2 = simulateTeamOffline(profiles, 8, 12345);
    assert.strictEqual(JSON.stringify(r1), JSON.stringify(r2));
});

// 4. 100 turnos variados → clamps nunca violados
test('clamps respeitados em 100 turnos variados', () => {
    const rng = mulberry32(99);
    let b = deriveInitialBrain(mkProfile('p-clamp', 'Duda', { gestao_estresse: 'Workaholic', opiniao_agil: 'Cético' }), 3);

    function checkInvariants(x: EmployeeBrainState) {
        assert.ok(x.estresse >= 0 && x.estresse <= 100, `estresse fora do range: ${x.estresse}`);
        assert.ok(x.humor >= -100 && x.humor <= 100, `humor fora do range: ${x.humor}`);
        assert.ok(x.energia >= 0 && x.energia <= 100, `energia fora do range: ${x.energia}`);
        assert.ok(x.engajamento >= 0 && x.engajamento <= 100, `engajamento fora do range: ${x.engajamento}`);
        assert.ok(x.memoria.length <= 12, `memoria excedeu 12: ${x.memoria.length}`);
    }

    for (let t = 1; t <= 100; t++) {
        const ctx: TurnContext = {
            turno: t,
            pressaoBase: rng(),
            impactoPessoal: Math.round((rng() * 2 - 1) * 10),
            moralGlobal: Math.round(rng() * 100),
        };
        b = updateBrain(b, ctx);
        checkInvariants(b);
        b = evaluateDecisions(b, ctx, rng).brain;
        checkInvariants(b);
    }
});

// 5. Contágio afeta exatamente N alvos ativos, nunca o source
test('contagio afeta exatamente N alvos ativos, nunca o source', () => {
    const brains = ['s', 'a', 'b', 'c', 'd', 'e'].map((id, i) => ({
        ...deriveInitialBrain(mkProfile(id, `P${i}`), 1),
        humor: 0,
        estresse: 50,
    }));
    brains[5] = { ...brains[5], status: 'licenca' as const, turnosAfastado: 2 };

    const result = applyContagion(brains, 's', { alvos: 3, humorDelta: -3, estresseDelta: 4 }, mulberry32(5));

    const changed = result.filter((b, i) => b.humor !== brains[i].humor || b.estresse !== brains[i].estresse);
    assert.strictEqual(changed.length, 3, `esperava 3 afetados, obteve ${changed.length}`);
    assert.ok(!changed.some((b) => b.personaId === 's'), 'source não pode ser afetado');
    assert.ok(!changed.some((b) => b.status !== 'ativo'), 'apenas ativos podem ser afetados');
});

// 6. simulateTeamOffline: equipe frágil/pressão alta gera eventos; resiliente/pressão média sobrevive
test('simulateTeamOffline: fragil gera eventos, resiliente sobrevive', () => {
    const fragilProfiles: BrainProfileInput[] = Array.from({ length: 10 }, (_, i) =>
        mkProfile(`f${i}`, `Fragil${i}`, {
            gestao_estresse: i % 2 === 0 ? 'Necessita ambiente estável' : 'Workaholic',
            opiniao_agil: i % 3 === 0 ? 'Cético' : 'Resistente',
        })
    );
    // pressão 0.95 calibrada: gera 2-4 baixas em 6 meses numa equipe frágil
    const fragil = simulateTeamOffline(fragilProfiles, 6, 777, () => 0.95);
    assert.ok(fragil.emergentEvents.length >= 1, `equipe frágil sob pressão alta deveria gerar >=1 evento, obteve ${fragil.emergentEvents.length}`);

    const resilProfiles: BrainProfileInput[] = Array.from({ length: 10 }, (_, i) =>
        mkProfile(`r${i}`, `Resil${i}`, {
            gestao_estresse: i % 2 === 0 ? 'Thrives no caos' : 'Resiliente sob pressão',
            opiniao_agil: i % 2 === 0 ? 'Entusiasta' : 'Pragmático',
        })
    );
    const resil = simulateTeamOffline(resilProfiles, 12, 777, () => 0.5);
    const baixas = new Set(
        resil.emergentEvents
            .filter((e) => e.tipo === 'burnout' || e.tipo === 'pedido_demissao')
            .map((e) => e.personaId)
    ).size;
    assert.ok(baixas <= 2, `equipe resiliente sob pressão média deveria ter <=2 baixas em 12 meses, obteve ${baixas}`);

    // diagnóstico de calibração (não é assert)
    const fragilBaixas = new Set(
        fragil.emergentEvents
            .filter((e) => e.tipo === 'burnout' || e.tipo === 'pedido_demissao')
            .map((e) => e.personaId)
    ).size;
    console.log(`    [calibração] frágil/alta 6m: ${fragil.emergentEvents.length} eventos, ${fragilBaixas} baixas | resiliente/média 12m: ${baixas} baixas`);
});

console.log(`OK ${testCount} tests`);
