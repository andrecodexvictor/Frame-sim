# Pesquisa: “Brain do Invokta” no Frame-sim

Data: 2026-09-21.

## Decisão

**NO-GO para esta semana.** Não existe um pacote oficial `@invokta/brain`. O artefato encontrado é `small-brain`, um projeto separado construído sobre Invokta e publicado como gerenciador local de tarefas. Ele não é um motor cognitivo, modelo de decisão ou implementação de comportamento de personas.

O `small-brain` expõe somente as capacidades `tasks.create`, `tasks.list`, `tasks.get`, `tasks.update` e `tasks.delete`, persistidas em SQLite e acessíveis diretamente ou por MCP stdio. Sua utilidade é demonstrar como empacotar um produto local como Action Engine; não oferece mecanismos que substituam ou aprofundem o `EmployeeBrain` do Frame-sim [1].

## Evidências

- `npm view @invokta/brain` retorna 404: o pacote não existe no registry público [2].
- `small-brain@0.1.1` se descreve como “local-first task manager exposed as an Invokta Action Engine and MCP server” [1].
- A versão publicada depende de `@invokta/core`, `@invokta/mcp` e `@invokta/installer` `0.4.0`, enquanto a linha atual do Invokta é `0.9.0` [1][3].
- Exige Node `>=22.20.0`; o backend do Frame-sim ainda declara Node `>=18.0.0` [1][4].
- O repositório indicado pelo pacote (`vinilana/small-brain`) não estava publicamente acessível no momento da pesquisa; a fonte auditável disponível é o pacote npm e seu README publicado [1][5].
- No repositório principal do Invokta, `brain` aparece como nome ilustrativo de um engine/URL (`/e/brain/mcp`) e em testes de instalação, não como módulo de raciocínio [6].

## Por que não encaixa no problema

O problema desta entrega é melhorar o julgamento comportamental das personas sem perder o determinismo, o fallback e a capacidade de rodar simulações ainda nesta semana. O `small-brain` acrescentaria:

- banco SQLite de tarefas;
- operações CRUD;
- instalação MCP;
- dependências antigas do Invokta;
- uma nova política de persistência por usuário.

Ele não acrescentaria:

- classificação de reações humanas;
- probabilidades ou confiança;
- interpretação de perfil psicológico;
- avaliação de compatibilidade pessoa/framework;
- calibração de impacto moral;
- melhoria no EmployeeBrain.

Pelo teste de deleção da skill `codebase-design`, retirar o `small-brain` do desenho não faz a complexidade cognitiva reaparecer em nenhum caller: ele simplesmente não resolve essa complexidade. Logo, não seria um módulo profundo para este caso, apenas uma camada lateral.

## Uso futuro possível do Invokta

Depois de estabilizar a v9, o Invokta pode publicar o Frame-sim como capacidades externas — por exemplo, `simulation.run`, `simulation.compare-frameworks` e `personas.evaluate-reaction`. Isso é uma seam de produto válida porque aplicação, CLI, MCP e testes seriam adapters reais do mesmo módulo. Essa adoção futura não requer o `small-brain`.

## Fontes primárias

1. Metadados e README publicados no npm: https://www.npmjs.com/package/small-brain/v/0.1.1
2. Registry npm para o pacote inexistente: https://registry.npmjs.org/@invokta%2fbrain
3. Invokta 0.9.0: https://github.com/vinilana/invokta/releases/tag/v0.9.0
4. Requisito atual do Invokta: https://docs.invokta.dev/getting-started/installation/
5. URL de repositório declarada pelo pacote: https://github.com/vinilana/small-brain
6. Busca oficial no repositório Invokta: https://github.com/search?q=repo%3Avinilana%2Finvokta+brain&type=code

