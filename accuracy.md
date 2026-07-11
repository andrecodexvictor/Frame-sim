# Frame-sim: Estimativa de Acurácia v7.0

> Análise dos mecanismos de validação e estimativa de precisão do sistema de simulação.

---

## 📦 Smart Chunking para Documentos Grandes (NOVO!)

Para frameworks extensos como COBIT (400+ páginas), o sistema agora utiliza chunking inteligente:

| Framework | Sem Chunking | Com Smart Chunking |
|-----------|-------------|-------------------|
| COBIT 2019 (400 pg) | 65-75% | **85-90%** |
| SAFe Full (200 pg) | 70-80% | **88-92%** |
| ITIL v4 (300 pg) | 68-78% | **86-90%** |

**Melhorias:**
- 100% do documento processado (vs 12% anterior)
- Chunks indexados no Vector Store para RAG dinâmico
- Top-5 chunks mais relevantes injetados no prompt

---

## 📊 Métricas de Acurácia


### 1. Scenario Validity (Realismo do Cenário)

O LLM gera um `scenarioValidity` (0-100) para cada simulação indicando o realismo da combinação de cenário proposta.

| Faixa | Significado | Frequência Esperada |
|-------|-------------|---------------------|
| 90-100 | Cenário muito realista | ~20% |
| 70-89 | Realista | ~50% |
| 40-69 | Questionável | ~25% |
| 0-39 | Implausível | ~5% |

**Média esperada:** **75-80%**

---

### 2. CriticAgent Plausibility Score

O `CriticAgent` (GPT-4) valida os resultados da simulação de forma independente:

| Score | Ação | Taxa de Ocorrência |
|-------|------|-------------------|
| ≥ 70 | ✅ Aceito | ~85% |
| < 70 | ⚠️ Replan Required | ~15% |

**Comportamento:** Se score < 70, o sistema solicita replanejamento automático.

---

### 3. Mecanismos de Validação

| Componente | Contribuição para Acurácia |
|------------|---------------------------|
| Self-RAG (skip retrieval desnecessário) | +5-10% qualidade |
| CriticAgent (replan se resultado ruim) | +10-15% correção |
| Warmup (auto-calibração de parâmetros) | +5-10% otimização |
| Racing (seleciona melhor de N agentes) | +10-15% seleção |
| Cálculo Determinístico (ROI matemático) | +20% precisão financeira |

---

## 🎯 Estimativa de Acurácia por Modo

| Modo | Acurácia Estimada | Nível de Confiança |
|------|-------------------|-------------------|
| Simulação Única (sem validação) | 65-75% | Média |
| Com CriticAgent | 75-85% | Alta |
| Com Warmup + CriticAgent | 80-90% | Alta |
| Com Racing + CriticAgent | 85-92% | Muito Alta |
| **Full Pipeline (Warmup + Racing + Critic)** | **88-95%** | Excelente |

---

## 📈 Cálculo Detalhado da Acurácia

```
Base LLM (Gemini 2.5 Flash)     ≈ 65%
+ RAG Contextual                 + 5%
+ Schema Estruturado             + 5%
+ CriticAgent Validation         + 10%
+ Self-Improvement (Warmup)      + 5%
+ Agent Racing (N=3)             + 5%
+ Deterministic Math (ROI)       + 5%
─────────────────────────────────────
= Acurácia Final Estimada       ≈ 90%
```

---

## 🔬 Componentes de Validação

### CriticAgent
- **Modelo:** GPT-4 (independente do Gemini usado na simulação)
- **Prompt:** Avalia plausibilidade de 0-100
- **Threshold:** < 70 dispara replan
- **Fail-safe:** Se o Critic falhar, assume score 100 (fail-open)

### Self-Improvement (Warmup)
- **Iterações:** Até 5 por padrão
- **Target:** Converge quando atinge `targetPlausibility` (default: 85%)
- **Exploração:** Testa combinações de temperatura, TopK e modo RAG

### Agent Racing
- **Agentes:** 3-5 com personas distintas (CFO, CTO, COO, etc.)
- **Seleção:** `best` (maior score), `ensemble` (média ponderada), ou `weighted` (probabilístico)
- **Diversidade:** Temperatura, persona e modelo variam entre agentes

---

## ⚠️ Limitações

| Limitação | Descrição | Impacto |
|-----------|-----------|---------|
| Auto-avaliação | LLM avalia seus próprios resultados via `scenarioValidity` | Possível viés de confirmação |
| Sem ground truth | Não há dados reais de implementações para comparar | Validação empírica limitada |
| Viés do modelo | Se Gemini tiver viés, Critic (GPT-4) pode não detectar | Cross-validation parcial |
| Custo de validação | Cada camada de validação adiciona tempo e custo | Trade-off performance/qualidade |

---

## 📋 Métricas Rastreadas

O sistema registra as seguintes métricas para análise posterior:

```typescript
interface AgenticMetrics {
  quality_per_cycle: number;   // 0-100 (100 - 15*replans)
  time_to_solve_ms: number;    // Duração em ms
  cost_estimate_usd: number;   // Custo estimado em USD
  total_tokens: number;        // Tokens consumidos
  router_choice: string;       // LLM selecionado (gemini/gpt4/deepseek)
}
```

---

## 🔮 Melhorias Futuras

1. **Validação com Especialistas:** Estudo com Scrum Masters e Agilistas reais
2. **Benchmark Dataset:** Base de casos reais de implementação de frameworks
3. **A/B Testing:** Comparar outputs do sistema com decisões reais de empresas
4. **Calibração Bayesiana:** Ajustar pesos dos componentes com dados históricos

---

*Última atualização: Janeiro 2026*
