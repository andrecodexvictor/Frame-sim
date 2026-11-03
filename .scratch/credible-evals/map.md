# FrameSIM: avaliações individuais, comparação e exportação científica

Label: wayfinder:map

## Destination

Implementar a especificação autorizada pelo goal ativo: avaliações individuais rastreáveis, comparação pareada, harnesses offline/online e exportações nativas para artigos LaTeX, com verificação dos contratos e limites científicos.

## Notes

- Usuário autorizou atualizar o Jev gateway mantendo sua credencial atual, configurar credenciais novas no backend e realizar primeiras chamadas.
- O goal já foi iniciado. A execução local está autorizada; não publicar e não executar novos benchmarks pagos sem orçamento explícito.
- Wayfinder, TypeSafe, Research, Spec Driven Development e Superpowers. Tracker local Markdown por ausência de tracker configurado.
- O mapa lista decisões; cada detalhe e resolução pertence ao ticket filho. Credenciais nunca entram em tickets, relatórios ou commits.
- Distinguir desempenho dentro da simulação, avaliação por modelo e validação empírica contra dados observados.

## Decisions so far

- Encerramento autorizado pelo usuário em 2026-10-05 após divulgação da compilação PDF indisponível. O nó final Mermaid foi corrigido; os fluxogramas no app e exports usam o mesmo grafo. Compilação não verificada, validação empírica pendente e orçamento pago ausente continuam explícitos no relatório.

- [Que evidência sustenta avaliações fidedignas no FrameSIM?](issues/01-evaluation-evidence.md): separar consistência sintética, Jev e validação empírica; usar condições pareadas e dados canônicos nos exports.
- [Quais contratos e modelos estão disponíveis nas primeiras requisições?](issues/02-provider-contracts.md): preservar gateway atual e credencial global; registrar saúde de geração, modelos efetivos e pendências por provedor.
- [Execução e evidências do checkpoint](issues/03-implementation-checkpoint.md): registros de corrida, comparação, evals e exportações implementados; gates e lacunas restantes documentados.

## Not yet specified

- Dados observados disponíveis, autorização de uso e rótulos humanos para validação externa.
- Limiares finais de calibração e custo, dependentes do conjunto de referência.

## Out of scope

- Publicação, inferência paga sem orçamento e instalação de infraestrutura sem necessidade comprovada.
