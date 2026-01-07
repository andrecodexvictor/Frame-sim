# Frame-sim: Roadmap Estratégico

> Planejamento de evolução do projeto para produto comercial e melhorias com novidades de IA.

---

## 📊 Estado Atual (v7.0 - Janeiro 2026)

| Aspecto | Status | Nível |
|---------|--------|-------|
| Arquitetura Multi-Agente | ✅ Completo | Enterprise-grade |
| RAG + Self-RAG | ✅ Completo | Avançado |
| Self-Improvement (Warmup) | ✅ Completo | Inovador |
| Agent Racing | ✅ Completo | Inovador |
| Smart Chunking | ✅ Completo | Escalável |
| CriticAgent | ✅ Completo | Diferencial único |
| Cálculo Determinístico ROI | ✅ Completo | Científico |
| Documentação | ✅ Completo | Profissional |

**Acurácia Estimada:** 85-95% (full pipeline)

---

## 🚀 Melhorias com Novidades de IA (2025-2026)

### 1. Gemini 2.0 + Deep Research
| Feature | Benefício | Complexidade |
|---------|-----------|--------------|
| Thinking Tokens | Raciocínio em cadeia visível | Baixa |
| Deep Research | Buscar cases reais de mercado | Média |
| Grounding | Validar com dados Google Search | Baixa |

**Implementação:**
```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash-thinking-exp",
  config: { thinkingConfig: { thinkingBudget: 10000 } }
});
```

---

### 2. MCP (Model Context Protocol)
| Integração | Dados Obtidos |
|------------|---------------|
| Glassdoor MCP | Salários reais por cargo/região |
| LinkedIn MCP | Dados de mercado de trabalho |
| GitHub MCP | Métricas de projetos open source |
| Jira MCP | Dados de sprints reais |

**Impacto:** Cenários econômicos baseados em dados reais, não estimativas.

---

### 3. Agentes Autônomos (Computer Use)
| Capacidade | Aplicação |
|------------|-----------|
| Web Browsing | Buscar notícias sobre frameworks |
| Screenshot Analysis | Analisar dashboards de empresas |
| Form Filling | Preencher assessments automaticamente |

**Caso de Uso:** Agente navega no Google Scholar e busca papers sobre "Scrum failure cases" para alimentar simulação.

---

### 4. Fine-tuning Domain-Specific
| Etapa | Descrição |
|-------|-----------|
| Dataset | Coletar 10k+ simulações validadas |
| Labeling | Marcar como "plausível" ou "implausível" |
| Training | Fine-tune Gemini 1.5 Pro via Vertex AI |
| Deploy | Substituir base model |

**Resultado:** Modelo especializado em simulações empresariais.

---

### 5. Multimodalidade
| Input | Output |
|-------|--------|
| Organograma (imagem) | Stakeholders detectados automaticamente |
| Diagrama de processos | Cerimônias identificadas |
| - | Animação da timeline de adoção |
| - | Vídeo explicativo auto-gerado |

---

### 6. Voice Interface
```
Usuário: "Simule SAFe para uma fintech de 200 funcionários 
         com dívida técnica alta"
         
Sistema: [Executa simulação + narra resultados]
         "A simulação projeta ROI de 23% em 18 meses, 
          com break-even no mês 11..."
```

---

## 💼 Transformação em Produto Comercial

### Funcionalidades Prioritárias

| Funcionalidade | Prioridade | Esforço | Descrição |
|----------------|------------|---------|-----------|
| **Autenticação** | 🔴 Crítico | 2 semanas | Clerk/Auth0 + JWT |
| **Persistência** | 🔴 Crítico | 1 semana | PostgreSQL + Prisma |
| **Dashboard Histórico** | 🔴 Crítico | 2 semanas | Lista de simulações passadas |
| **Pagamentos** | 🔴 Crítico | 1 semana | Stripe + planos |
| **Export PDF** | 🟡 Alto | 1 semana | Relatório formatado |
| **Export PowerPoint** | 🟡 Alto | 1 semana | Slides auto-gerados |
| **Comparativo** | 🟡 Alto | 2 semanas | Scrum vs SAFe lado a lado |
| **API REST** | 🟡 Médio | 2 semanas | OpenAPI/Swagger |
| **Integração Jira** | 🟢 Baixo | 3 semanas | Dados reais de sprints |
| **White-label** | 🟢 Baixo | 2 semanas | Customização de marca |

---

### Infraestrutura de Produção

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION STACK                         │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND          │  BACKEND            │  DATA                │
│  ─────────         │  ───────            │  ────                │
│  Vercel            │  Railway/Render     │  Supabase/Neon      │
│  Next.js 14        │  NestJS             │  PostgreSQL          │
│  React 19          │  BullMQ + Redis     │  ChromaDB (Vector)   │
│  TailwindCSS       │  Prisma ORM         │  Redis (Cache)       │
├─────────────────────────────────────────────────────────────────┤
│  OBSERVABILITY     │  SECURITY           │  CI/CD               │
│  ─────────────     │  ────────           │  ─────               │
│  Sentry            │  Clerk (Auth)       │  GitHub Actions      │
│  DataDog/Grafana   │  Rate Limiting      │  Vercel Deploy       │
│  Logflare          │  CORS + Helmet      │  Docker              │
└─────────────────────────────────────────────────────────────────┘
```

---

### Modelo de Negócio

#### Planos de Assinatura

| Tier | Preço/mês | Simulações | Funcionalidades |
|------|-----------|------------|-----------------|
| **Free** | R$ 0 | 3/mês | 1 framework, sem batch |
| **Starter** | R$ 47 | 20/mês | 3 frameworks, batch 5x |
| **Pro** | R$ 97 | Ilimitado | Todos frameworks, batch 20x, export PDF |
| **Enterprise** | R$ 497 | Ilimitado | API, white-label, SSO, suporte premium |

#### Métricas de Sucesso (KPIs)

| Métrica | Meta M1 | Meta M6 | Meta M12 |
|---------|---------|---------|----------|
| MAU (Monthly Active Users) | 100 | 1.000 | 5.000 |
| Paying Customers | 10 | 100 | 500 |
| MRR (Monthly Recurring Revenue) | R$ 1k | R$ 15k | R$ 80k |
| Churn Rate | - | < 10% | < 5% |
| NPS | - | > 40 | > 60 |

---

### Público-Alvo

| Segmento | Problema | Solução Frame-sim |
|----------|----------|-------------------|
| **Consultorias Ágeis** | Precisa justificar proposta com ROI | Simulação validada por CriticAgent |
| **Agile Coaches** | Cliente quer ver projeção antes de contratar | Cenário visual com timeline |
| **PMOs** | Precisa apresentar business case para diretoria | Export PDF profissional |
| **Professores** | Quer ferramenta interativa para aulas | Simulações em tempo real |
| **RH/T&D** | Avaliar impacto de treinamentos | Métricas de adoção e moral |

---

### Análise Competitiva

| Produto | Tipo | Limitação | Vantagem Frame-sim |
|---------|------|-----------|-------------------|
| Planilhas ROI | Estático | Sem simulação de personas | Dinâmico + Multi-agente |
| Assessments | Diagnóstico | Sem projeção futura | Timeline de 12-60 meses |
| Jogos de Simulação | Lúdico | Sem métricas financeiras | ROI determinístico |
| Consultoria Humana | Caro | R$ 500-2000/hora | R$ 97/mês ilimitado |

---

## 📅 Roadmap Trimestral

### Q1 2026: MVP Comercial
- [ ] Autenticação com Clerk
- [ ] PostgreSQL + Prisma
- [ ] Dashboard de histórico de simulações
- [ ] Stripe para pagamentos
- [ ] Landing page profissional
- [ ] Onboarding guiado

### Q2 2026: Expansão
- [ ] API REST pública (OpenAPI)
- [ ] Integração Jira (leitura de sprints)
- [ ] Export PowerPoint
- [ ] Benchmark dataset (1000 simulações)
- [ ] Gemini 2.0 com Deep Research
- [ ] Mobile responsive

### Q3 2026: Enterprise
- [ ] SSO (SAML/OIDC)
- [ ] Multi-tenant com isolamento
- [ ] White-label completo
- [ ] Opção on-premise (Docker)
- [ ] SLA e suporte premium
- [ ] Certificação SOC 2

### Q4 2026: AI 2.0
- [ ] Fine-tuned model (Vertex AI)
- [ ] MCP integrations (Glassdoor, LinkedIn)
- [ ] Voice interface
- [ ] Multimodalidade (organogramas)
- [ ] Agente autônomo de pesquisa
- [ ] Benchmark público

---

## 🎓 Destaques para TCC

Para a apresentação do Trabalho de Conclusão de Curso, os diferenciais técnicos são:

1. **Agentic AI Level 4**
   - Orchestrator → CriticAgent → PersonaAgent
   - Self-Improvement (warmup iterativo)
   - Agent Racing (concorrência com seleção)

2. **RAG Avançado**
   - Self-RAG (skipa retrieval quando desnecessário)
   - Smart Chunking para documentos grandes
   - Vector Store dinâmico (ChromaDB)

3. **Cálculo Determinístico**
   - Fórmulas financeiras reais (Curva J, CoNQ, Brooks)
   - Ruído estocástico controlado (±10%)
   - IC 95% para validação estatística

4. **Validação Científica**
   - CriticAgent com pontuação de plausibilidade
   - Threshold de 70% para replanejamento
   - Auto-avaliação com modelo diferente (GPT-4 vs Gemini)

---

## 📈 Projeção de Crescimento

```
        Usuários Ativos Mensais (MAU)
    │
 5k ┤                                    ╭──
    │                              ╭─────╯
 2k ┤                        ╭─────╯
    │                  ╭─────╯
 1k ┤            ╭─────╯
    │      ╭─────╯
100 ┤──────╯
    │
    └────────────────────────────────────────
        M1   M3   M6   M9   M12  (meses)
```

---

*Última atualização: Janeiro 2026*
