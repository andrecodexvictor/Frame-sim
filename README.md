
# Frame-sim: Deep Enterprise Simulation Kernel v4.0

**Frame-sim** é um simulador empresarial avançado projetado para testar a implementação de frameworks de gestão e engenharia (Scrum, SAFe, Spotify, etc.) em ambientes corporativos complexos.

Ao contrário de "quizzes" simples, o Frame-sim utiliza uma engine **Multi-LLM Agentic** (Gemini, GPT-4, DeepSeek, Ollama) combinada com **RAG (Retrieval-Augmented Generation)**, **Agentes Autônomos (CriticAgent)** e **Modelos Matemáticos Determinísticos** para simular reações humanas, impactos financeiros (ROI) e culturais com alto grau de realismo.

![Frame-Sim Banner](https://via.placeholder.com/800x400?text=Frame-Sim+v4.0)

---

## 🚀 Novidades da v4.0 (Agentic Loop & Multi-LLM)

- **SmartRouter (Multi-LLM)**: Roteia automaticamente para o LLM mais adequado (GPT-4 para raciocínio complexo, Gemini para criatividade, DeepSeek/Ollama para validações simples).
- **CriticAgent (Auto-Reflexão)**: Agente que valida os resultados da simulação com uma pontuação de plausibilidade. Se < 70%, solicita replanejamento.
- **Memória de Curto Prazo (Scratchpad)**: Foco dinâmico que evolui a cada turno da simulação.
- **Memória de Longo Prazo (ChromaDB)**: Histórico de turnos persiste para RAG de situações passadas.
- **Viés Cognitivo nas Personas**: Cada stakeholder agora carrega um viés (Confirmação, Status Quo, Aversão à Perda) que afeta suas respostas.
- **Ruído Estocástico no ROI**: Variações aleatórias (±10%) para quebrar o determinismo absoluto.

## 🧠 Core Features

### 1. Simulação Multi-Agente & Persona Enrichment
Simula stakeholders reais e um time completo com base em **arquétipos estendidos**:
- **Key Stakeholders**: CEO, CTO, Tech Leads com perfis psicológicos profundos.
- **Distribuição Realista**: O restante do time (Júniors, Plenos, QA, RH) é gerado automaticamente com base no tamanho da empresa.
- **Enriquecimento RAG**: Personas ganham nomes reais, histórias de fundo e vieses cognitivos extraídos de um banco de dados de 21k perfis (`profiles.json`).

### 2. Roteamento de Cenário Econômico (NOVO 💰)
Selecione perfis econômicos realistas para calibrar custos e ROI:
- **Brasil**: PME, Startup SP/RJ, Grande Empresa, Interior.
- **Internacional**: US Big Tech (FAANG), LATAM Remoto, Europa Ocidental.
- **Impacto**: Salários, custo de incidentes e valor por feature variam drasticamente conforme o perfil (ex: Incidente no Google custa $1M vs R$5k na PME).

### 3. Engine Financeira Determinística + Estocástica
O cálculo de ROI combina fórmulas determinísticas com ruído aleatório:
- **Curva J**: Queda natural de produtividade na adoção.
- **Dívida Técnica**: Juros compostos sobre decisões ruins.
- **CoNQ (Cost of Non-Quality)**: Custo financeiro de bugs e incidentes.
- **Ruído Gaussiano**: Variação de ±10% para maior realismo.

### 4. Métricas de Negócio e Evolução (NOVO 📊)
Painéis detalhados para métricas além do ROI:
- **Eficiência e Qualidade**: Ganho de eficiência, redução de retrabalho, agilidade.
- **Evolução da Empresa**: Crescimento do time, contratações, turnover, promoções.
- **Break-even Point**: Projeção de quando o framework se paga.

### 5. Cenários Dinâmicos
Configure o ambiente da simulação:
- **Tamanho**: De Startups (10 FTEs) a Enterprises (2000+ FTEs).
- **Cultura**: "Startup Caótica" vs "Corporação Fossilizada".
- **Contexto**: Fusão & Aquisição, Preparação para IPO, Corte de Custos, etc.
- **Contexto Econômico**: Seleção de país/moeda e perfil salarial.

---


## 🛠️ Tecnologias

- **Frontend**: React, TypeScript, Vite, TailwindCSS (Design System Customizado).
- **Charts**: Recharts (Visualização de dados complexos).
- **AI Core**: Google Gemini 2.5 Pro (via Google AI Studio),Gpt4 (via Gpt free API), Deep-Seek API( via deepseek spaces)
- **RAG**: ChromaDB (Vetorização local) + Lógica de Self-RAG.
- **Arquitetura**: Componentização modular e serviços desacoplados.

## 📦 Instalação e Uso

### Pré-requisitos
- Node.js 18+
- Chave de API do Google Gemini (Google AI Studio)

### 1. Clone o repositório
```bash
git clone https://github.com/andrecodexvictor/Frame-sim.git
cd Frame-sim
```

### 2. Configure as Variáveis de Ambiente
Crie um arquivo `.env` na raiz:
```env
VITE_API_KEY=sua_chave_api_do_gemini_aqui
```

### 3. Instale as Dependências
```bash
npm install
# Para o módulo RAG (opcional para dev web puro, mas recomendado):
cd RAG && npm install && cd ..
```

### 4. Execute o Projeto
```bash
npm run dev
```
Acesse `http://localhost:5173`.

---

## 🔧 Estrutura do Projeto

```
Frame-sim/
├── src/
│   ├── components/      # UI Components (Dashboard, Forms)
│   ├── services/        # Logic (Gemini, RAG, Metrics)
│   ├── types/           # TypeScript Definitions
│   └── App.tsx          # Main Entry point
├── RAG/                 # Módulo Python/Node para Vector Store
├── public/              # Assets
└── documentacao.md      # Documentação técnica detalhada
```

## 🤝 Contribuindo

Pull requests são bem-vindos. Para mudanças maiores, abra uma issue primeiro para discutir o que você gostaria de mudar.

## 📄 Licença

[MIT](https://choosealicense.com/licenses/mit/)
