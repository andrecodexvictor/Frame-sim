
# Frame-sim: Deep Enterprise Simulation Kernel v3.3

**Frame-sim** é um simulador empresarial avançado projetado para testar a implementação de frameworks de gestão e engenharia (Scrum, SAFe, Spotify, etc.) em ambientes corporativos complexos.

Ao contrário de "quizzes" simples, o Frame-sim utiliza uma engine de **IA Generativa (Gemini 1.5 Pro)** combinada com **RAG (Retrieval-Augmented Generation)** e **Modelos Matemáticos Determinísticos** para simular reações humanas, impactos financeiros (ROI) e culturais com alto grau de realismo.

![Frame-Sim Banner](https://via.placeholder.com/800x400?text=Frame-Sim+v3.3)

---

## 🚀 Novidades da v3.3 (Longo Prazo & UI)

- **Simulação de Longo Prazo (5 Anos)**: Capacidade de projetar maturidade, cultura e ROI ao longo de 60 meses.
- **Micro-SaaS UI**: Interface moderna, "brutalista-clean", com tooltips otimizados para Dark Mode.
- **Análise Detalhada de ROI**: Explicação automática dos fatores que levaram ao lucro ou prejuízo (Curva J, Dívida Técnica, Velocidade).
- **RAG Otimizado**: Retrieval inteligente de personas e playbooks para maior consistência.

## 🧠 Core Features

### 1. Simulação Multi-Agente
Simula stakeholders reais (CEO impaciente, Dev Sênior cético, RH protetor) com memórias e reações baseadas em arquétipos psicológicos.

### 2. Engine Financeira Determinística
O cálculo de ROI não é alucinado pela IA. Utilizamos um motor híbrido que considera:
- **Curva J**: Queda natural de produtividade na adoção.
- **Dívida Técnica**: Juros compostos sobre decisões ruins.
- **CoNQ (Cost of Non-Quality)**: Custo financeiro de bugs e incidentes.

### 3. Cenários Dinâmicos
Configure o ambiente da simulação:
- **Tamanho**: De Startups (10 FTEs) a Enterprises (2000+ FTEs).
- **Cultura**: "Startup Caótica" vs "Corporação Fossilizada".
- **Contexto**: Fusão & Aquisição, Preparação para IPO, Corte de Custos, etc.

---

## 🛠️ Tecnologias

- **Frontend**: React, TypeScript, Vite, TailwindCSS (Design System Customizado).
- **Charts**: Recharts (Visualização de dados complexos).
- **AI Core**: Google Gemini 1.5 Pro (via Google AI Studio).
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
