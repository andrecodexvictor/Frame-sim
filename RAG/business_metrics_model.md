# Modelo de Métricas de Negócio e ROI

Este documento define as fórmulas matemáticas utilizadas pelo agente para calcular o Retorno sobre Investimento (ROI) e outras métricas financeiras durante a simulação.

## 1. Variáveis Base (Adaptáveis por PME/Enterprise)

As variáveis abaixo são ajustadas automaticamente com base no `simulation_config.json`.

| Variável | Descrição | Valor Base (PME) | Valor Base (Enterprise) |
| :--- | :--- | :--- | :--- |
| `CUSTO_DEV_DIA` | Custo médio diário de um desenvolvedor (salário + encargos) | R$ 400 | R$ 800 |
| `VALOR_PONTO_FUNCAO` | Receita estimada gerada por ponto de complexidade entregue | R$ 1.500 | R$ 5.000 |
| `CUSTO_ATRASO_DIA` | Prejuízo diário por atraso em features críticas | R$ 1.000 | R$ 50.000 |
| `CUSTO_INCIDENTE` | Custo médio de um incidente em produção (perda de vendas/imagem) | R$ 5.000 | R$ 500.000 |

## 2. Fórmulas de Cálculo

### 2.1. Custo Operacional (OpEx)
O custo de manter o time rodando.

$$
OpEx_{mensal} = (N_{devs} \times CUSTO\_DEV\_DIA \times 22) + Custo_{infra} + Custo_{licencas}
$$

### 2.2. Valor Entregue (Value)
O valor financeiro gerado pelas entregas.

$$
Value_{mensal} = \sum (Features_{entregues} \times Complexidade \times VALOR\_PONTO\_FUNCAO)
$$

### 2.3. Custo da Não-Qualidade (CoNQ)
O impacto financeiro de bugs e dívida técnica.

$$
CoNQ = (N_{bugs} \times CUSTO\_REWORK) + (N_{incidentes} \times CUSTO\_INCIDENTE)
$$

### 2.4. ROI (Retorno sobre Investimento)
A métrica final projetada.

$$
ROI = \frac{(Value_{acumulado} - CoNQ_{acumulado}) - OpEx_{acumulado}}{OpEx_{acumulado}} \times 100\%
$$

## 3. Modificadores de Cenário

O `simulation_config.json` aplica multiplicadores nestas fórmulas:

*   **Dívida Técnica Alta**: Aumenta `N_bugs` em 50% e reduz `Features_entregues` em 20%.
*   **Velocidade Burocrática**: Reduz `Features_entregues` em 30% mas reduz `N_bugs` em 10% (mais testes/processos).
*   **Histórico Traumático**: Aumenta o tempo de ramp-up (início lento), reduzindo `Value` nos primeiros 3 meses.
*   **Migração de Legado**: `Value` é próximo de zero até a virada de chave, gerando ROI negativo profundo inicialmente (Curva J).


## 4. Adaptação para PMEs

Se `adaptacao_pme` for `true`:
1.  Reduz `CUSTO_DEV_DIA` e `VALOR_PONTO_FUNCAO`.
2.  Aumenta a sensibilidade ao `OpEx` (Cash Flow é rei).
3.  Incidentes têm impacto proporcionalmente maior na reputação local.

## 5. Dinâmica Avançada (O "Motor" da Simulação)

Para atingir a acurácia de 95% em um "minimundo", o agente deve aplicar estas lógicas não-lineares:

### 5.1. Juros Compostos da Dívida Técnica
A dívida técnica não paga cresce exponencialmente, tornando o desenvolvimento futuro cada vez mais lento.

$$
Custo\_Manutencao_{t} = Custo\_Base \times (1 + Taxa\_Divida)^{t}
$$

*   **Taxa\_Divida**: Definida pelo `divida_tecnica` no config (ex: Baixa = 0.01, Crítica = 0.15 ao mês).
*   **Impacto**: Se o time ignorar a dívida, em 6 meses a velocidade cai pela metade.

### 5.2. A Curva J (Productivity Dip)
Qualquer mudança de framework (ex: Waterfall -> Scrum) causa queda imediata de produtividade antes da melhora.

$$
Velocidade_{real} = Velocidade_{teorica} \times Fator\_Adaptacao_{t}
$$

*   **Mês 1-2**: Fator 0.6 (Queda de 40% - "Learning Curve")
*   **Mês 3-4**: Fator 0.9 (Recuperação)
*   **Mês 5+**: Fator 1.2 (Superação - "Performing")

### 5.3. Lei de Brooks (Saturação)
Adicionar pessoas a um projeto atrasado o atrasa mais.

Se `novas_contratacoes` > 10% do time atual em < 1 mês:
*   `Velocidade` cai 20% por 2 meses (Onboarding Tax).
*   `CoNQ` (Bugs) aumenta 15% (Novatos quebrando código).

