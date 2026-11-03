# Que evidência sustenta avaliações fidedignas no FrameSIM?

Type: research
Label: wayfinder:research
Status: resolved
Assignee: research-evals
Parent: ../map.md
Blocked by: none

## Question

Quais métricas, referências primárias e limites permitem medir desempenhos individuais e comparar simulações sem confundir coerência sintética com validação real?

## Context

Repositório atual: C:/Users/adm/.codex/worktrees/0116/Frame-sim. Estado inicial: 54e069d. Gravar pesquisa em next_steps/credible_evals_research.md. Não acessar arquivos de credenciais.

## Answer

Pesquisa concluída em [credible_evals_research.md](../../../next_steps/credible_evals_research.md), com fontes primárias consultadas e evidências específicas do código. O caminho recomendado separa consistência do kernel, julgamento semântico Jev e validação empírica; exporta estado/eventos por personaId; implementa comparações por coortes e choques pareados com IC adequado; calibra o avaliador em labels independentes e holdout; oferece pacote TeX/PGFPlots/TikZ a partir do dataset canônico.

Limite material: o gerador de perfis contém amostragem sintética e não há comprovação observacional encontrada para chamar as personas de reais. A falta de dados externos permite concluir o trabalho técnico, mas deixa validação empírica como indisponível. Seeds atuais incluem framework/agente, score de warmup usa scenarioValidity, IC atual fica pontual com n=1 e rich output pode gerar trajetória diferente; esses pontos precisam ser corrigidos na implementação.

Sem leitura de .env/credenciais, sem alteração de runtime e sem troca de branch. Documentação produzida na mesma worktree dedicada do handoff. Gortex indisponível ao subagente; leitura de arquivos e rg direcionado como fallback.
