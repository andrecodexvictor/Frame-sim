# Avaliação do Invokta para o Frame-sim

Data da avaliação: 2026-09-21.

## Resumo executivo

O Invokta é um bom complemento para o Frame-sim, mas resolve um problema diferente do Jev. Jev pode melhorar julgamentos semânticos dentro da simulação; Invokta pode transformar capacidades estáveis do Frame-sim em ações tipadas e reutilizáveis por aplicação, CLI e agentes via MCP. A arquitetura recomendada é manter o motor determinístico e o EmployeeBrain como núcleo, usar Jev apenas nos julgamentos humanos estreitos e colocar Invokta na fronteira externa do produto.

Não é recomendável reescrever o orquestrador no Invokta nem chamar um Action Engine para cada persona. O próprio projeto declara que não é um workflow engine, model router, agent harness, identity provider ou plataforma de observabilidade. Seu valor está no contrato, validação, controle de acesso, erros estruturados e publicação multicanal de uma capacidade de domínio [1][2].

## O que o Invokta oferece

O Invokta se apresenta como um framework TypeScript para **Action Engines**: capacidades headless, versionadas e independentes de um agente específico. Uma mesma implementação pode ser invocada diretamente por código, por CLI, por MCP stdio ou por MCP Streamable HTTP stateless [1][2].

Uma capability define entrada, saída, regra de acesso, anotações e implementação. `engine.invoke` valida a entrada, aplica acesso, executa a capacidade e valida a saída antes de devolvê-la. Os exemplos oficiais usam Zod, mas o requisito formal é uma biblioteca compatível com Standard Schema v1 e Standard JSON Schema v1 [3][4].

O runtime também oferece erros estruturados, cancelamento via `AbortSignal` e eventos mínimos de início, conclusão e falha. Ele deliberadamente não fornece fila, controle de concorrência, service container, cache, retry policy ou timeout padrão; esses comportamentos continuam pertencendo ao engine/produto [5].

## Encaixe com o Frame-sim

### Fronteira recomendada

```text
Agente / aplicação / CLI
          |
          v
Invokta Action Engine
  - contratos de entrada/saída
  - autorização
  - erros e cancelamento
          |
          v
Frame-sim Orchestrator
  - EmployeeBrain determinístico
  - regras, memória e ROI
  - Jev para julgamentos semânticos opcionais
  - LLM para narrativa
```

Invokta e Jev, portanto, não são alternativas:

| Componente | Responsabilidade |
| --- | --- |
| EmployeeBrain/Frame-sim | Estado, regras, causalidade, seed, contágio e cálculos |
| Jev | Julgamentos semânticos estreitos e probabilísticos sobre personas/casos |
| LLM generativo | Narrativa e explicação em linguagem natural |
| Invokta | Contrato público, validação, acesso e transporte das capacidades |

### Capacidades iniciais sugeridas

1. `simulation.preview-scenario`: normaliza e valida cenário, framework e seleção de personas sem executar provedores caros. Deve ser read-only.
2. `simulation.run`: executa uma simulação semeada e retorna estado, eventos, ROI, qualidade e metadados de degradação.
3. `simulation.compare-frameworks`: roda variantes com a mesma seed e devolve comparação estruturada.
4. `personas.evaluate-reaction`: avalia uma persona/caso usando o pipeline híbrido, incluindo confiança e origem da decisão (`deterministic`, `jev` ou `fallback`).
5. `simulation.explain-result`: produz explicação auditável a partir de um resultado existente, sem recalcular os números.

O primeiro piloto deve publicar apenas `simulation.preview-scenario` e `personas.evaluate-reaction`. São fronteiras menores, verificáveis e com pouco risco de converter prematuramente toda a API Express.

## Pontos fortes para este repositório

- O projeto é TypeScript e ESM, como o backend do Frame-sim, reduzindo atrito de linguagem e módulos [3].
- Schemas de entrada e saída eliminam parte do JSON informal que hoje atravessa frontend, `/api/simulate` e orquestrador.
- A mesma capacidade pode ser testada diretamente e depois publicada em MCP sem mover regras para o adaptador [1][4].
- `Principal` e regras de acesso permitem separar simulações locais, usuários autenticados e futuras operações administrativas, mantendo identidade fora do payload da capability [5].
- Cancelamento por `AbortSignal` combina com o cancelamento já existente no orquestrador.
- O licenciamento é MIT [6].

## Riscos e limitações

1. **Maturidade:** a versão pública observada é `0.9.0`, anterior a 1.0. O repositório foi criado em 2026-07-27. Apesar de o release informar 3.190 testes e vários gates, ainda deve ser tratado como uma dependência jovem, com risco de mudanças de API [6][7].
2. **Runtime:** todos os pacotes 0.9.0 consultados exigem Node `>=22.20.0`. O ambiente local usa Node 22.23.2, mas `RAG/package.json` ainda declara Node `>=18.0.0`. Integrar diretamente exige elevar e verificar o requisito de produção, ou manter o Action Engine como processo/pacote separado [3][8].
3. **Não resolve qualidade da simulação:** Invokta valida contratos e execução, mas prompts, modelos, regras, métricas e qualidade continuam sendo responsabilidade do Frame-sim [1][2].
4. **Não substitui Express automaticamente:** o endpoint atual possui hidratação, seleção de personas, dependências compartilhadas e cancelamento. A migração deve extrair primeiro um serviço de aplicação reutilizável, depois envolvê-lo em uma capability.
5. **Observabilidade limitada por desenho:** eventos do core são best-effort e não carregam payload de negócio por padrão. Métricas completas continuam necessárias no `MetricsService` [5].
6. **MCP não deve virar acoplamento interno:** MCP é uma forma de entrega para consumidores externos. O frontend do Frame-sim deve continuar usando chamada direta/HTTP apropriada, sem dar uma volta por MCP dentro do mesmo processo.

## Veredito

Adotar como **camada opcional de produto e integração**, não como novo kernel. A ordem correta é:

1. estabilizar o contrato do novo pipeline de personas/Jev;
2. extrair a execução do handler Express para um serviço de aplicação tipado;
3. envolver duas capacidades pequenas com `@invokta/core@0.9.0` em um piloto isolado;
4. comparar chamada direta e MCP, incluindo cancelamento, erros, latência e compatibilidade de schemas;
5. só então decidir se `/api/simulate` deve reutilizar o mesmo Action Engine.

O resultado arquitetural desejado não é “Frame-sim construído com Invokta”, mas “Frame-sim exposto com segurança e contratos consistentes por Invokta”.

## Fontes primárias

1. Site oficial do Invokta: https://www.invokta.dev/pt-br/
2. README oficial: https://github.com/vinilana/invokta/blob/main/README.md
3. Instalação e requisitos: https://docs.invokta.dev/getting-started/installation/
4. Primeiro Action Engine: https://docs.invokta.dev/getting-started/first-engine/
5. Referência do core e limites: https://docs.invokta.dev/reference/core/ e https://docs.invokta.dev/concepts/scope-and-limits/
6. Metadados e licença do repositório: https://api.github.com/repos/vinilana/invokta
7. Release 0.9.0: https://github.com/vinilana/invokta/releases/tag/v0.9.0
8. Pacote `@invokta/core` 0.9.0: https://www.npmjs.com/package/@invokta/core/v/0.9.0
