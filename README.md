# Frame-sim

Simulador de cenários para frameworks corporativos.

## Instalação e Execução

### Frontend
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env` com a sua chave da API do Gemini:
   ```env
   VITE_API_KEY=sua_chave_aqui
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

### Backend (Opcional)
Para simulações com suporte a banco de dados de perfis adicionais:
1. Acesse o diretório `RAG/`:
   ```bash
   cd RAG
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie o arquivo `RAG/.env` com a chave do Gemini:
   ```env
   GOOGLE_API_KEY=sua_chave_aqui
   ```
4. Execute o servidor:
   ```bash
   npm run server
   ```
