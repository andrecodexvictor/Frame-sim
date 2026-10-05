# Especificação: primeiras requisições e credenciais FrameSIM

Data: 2026-10-04. Escopo autorizado: preservar configuração e chave global Jev; verificar versão mais recente; armazenar chaves específicas FrameSIM somente em RAG/.env ignorado; descobrir IDs reais de modelos; executar chamadas sintéticas mínimas e produzir relatório sem segredos.

## Critérios de aceitação

- A configuração global Jev conserva seu conteúdo exato. Uma requisição de decisão comprova o funcionamento ou registra erro sanitizado.
- As credenciais existentes do backend são preservadas; as novas recebem nomes próprios. DeepSeek NVIDIA só usa endpoint NVIDIA, nunca api.deepseek.com com nvapi.
- Relatório separa descoberta de catálogo, autenticação e geração efetiva. Não trata a mera presença da chave como saúde comprovada.
- Chamadas têm timeout, conteúdo sintético, limite de saída e nenhuma tentativa ilimitada. Modelos pedidos que não constam do catálogo são registrados como indisponíveis, sem substituição silenciosa.
- Nenhum valor de credencial, corpo de erro ou URL com chave aparece no relatório/log.

## Comandos

`node scripts/provider_probe.mjs` executa primeiras requisições após configuração local. `npm run test:keys` verifica o health check existente. O plano integral de evals é entregue para revisão e início posterior pelo `/goal`.

## Integração inicial DeepSeek autorizada

Usar a chave NVIDIA específica no adaptador OpenAICompatibleProvider já existente e no fallback do ProviderGateway. Quando NVIDIA_DEEPSEEK_API_KEY estiver configurada, o destino é fixo em https://integrate.api.nvidia.com/v1 e o modelo é NVIDIA_DEEPSEEK_MODEL ou deepseek-ai/deepseek-v4.1-flash. A chave DeepSeek antiga continua disponível e o caminho api.deepseek.com permanece usado se não há chave NVIDIA. Não substituir a configuração global Jev. Provar transporte e retorno por teste offline, depois fazer chamada mínima pelo adaptador real; registrar timeout como falha e não como sucesso.
