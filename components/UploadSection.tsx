
import React, { useState } from 'react';
import { Upload, FileText, AlertTriangle, Plus, Trash2, Layers, Zap, Paperclip, Check, Loader2 } from 'lucide-react';
import { BrutalButton } from './ui/BrutalButton';
import { FrameworkInput } from '../types';
import { digestFrameworkDocument } from '../services/geminiService';

interface UploadSectionProps {
  onNext: (inputs: FrameworkInput[]) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ onNext }) => {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [inputs, setInputs] = useState<FrameworkInput[]>([{ id: '1', name: '', text: '' }]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Single file state (legacy support for drag drop visual)
  const [dragActive, setDragActive] = useState(false);

  const handleAddFramework = () => {
    if (inputs.length < 5) {
      setInputs([...inputs, { id: Math.random().toString(36).substr(2, 9), name: '', text: '' }]);
    }
  };

  const handleRemoveFramework = (id: string) => {
    if (inputs.length > 1) {
      setInputs(inputs.filter(i => i.id !== id));
    }
  };

  const handleInputChange = (id: string, field: 'name' | 'text', value: string) => {
    setInputs(inputs.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const processFile = async (file: File): Promise<string> => {
    let extractedText = '';

    // 1. Text Files including JSON/MD/CSV
    if (file.type.startsWith('text/') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.csv')) {
      try {
        extractedText = (await file.text()).slice(0, 500000);
      } catch (e) {
        console.warn('Failed to read text file', e);
      }
    }
    // 2. PDF Handling
    else if (file.type === 'application/pdf') {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        // Read ALL pages for digestion (up to ~50 pages safe limit for speed)
        const maxPages = Math.min(pdf.numPages, 50);

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          extractedText += `\n--- Page ${i} ---\n${pageText}`;
        }
      } catch (e) {
        console.error('PDF parsing error', e);
        return `Erro ao ler PDF: ${file.name}.`;
      }
    }
    // 3. DOCX Handling
    else if (file.name.endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value.slice(0, 500000);
      } catch (e) {
        console.error('DOCX parsing error', e);
        return `Erro ao ler DOCX: ${file.name}.`;
      }
    } else {
      return `Tipo de arquivo não suportado: ${file.name}`;
    }

    // Call Gemini Flash for Digestion if content is substantial
    if (extractedText.length > 200) {
      return await digestFrameworkDocument(extractedText);
    }

    return extractedText;
  };

  const handleFileSelect = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const fileName = file.name.split('.')[0];

      // Update name immediately if empty
      setInputs(prev => prev.map(i => i.id === id ? { ...i, name: i.name || fileName } : i));

      try {
        const content = await processFile(file);
        setInputs(prev => prev.map(i => i.id === id ? { ...i, text: content } : i));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSubmit = () => {
    // Validate inputs
    const validInputs = inputs.filter(i => i.name.trim() !== '');

    const processedInputs = validInputs.map(i => ({
      ...i,
      text: i.text || `Gere uma simulação completa baseada nas práticas padrão de mercado para ${i.name}, incluindo suas cerimônias, papéis, artefatos e desafios típicos de adoção.` // Fallback if no content provided
    }));

    onNext(processedInputs);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setIsProcessing(true);
      const fileName = file.name.split('.')[0];

      try {
        const content = await processFile(file);
        setInputs(prev => prev.map((i, idx) => idx === 0 ? {
          ...i,
          name: i.name || fileName,
          text: content
        } : i));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in-up">
      <div className="text-center space-y-4">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase text-zinc-900 dark:text-white">
          Frame<span className="text-brutal-green">Sim</span>
        </h1>
        <p className="font-mono text-sm md:text-base border-l-4 border-brutal-black dark:border-white pl-4 text-left md:text-center md:border-l-0 md:inline-block md:px-2 bg-yellow-400 text-black">
          ENGINE DE COMPARAÇÃO CORPORATIVA v6.0
        </p>
      </div>

      <div className="brutal-card bg-white dark:bg-[#18181b] border-4 border-brutal-black dark:border-zinc-700 shadow-hard p-1">
        {/* Mode Tabs */}
        <div className="grid grid-cols-2 mb-6 border-b-4 border-brutal-black dark:border-zinc-700">
          <button
            onClick={() => { setMode('single'); setInputs([{ id: '1', name: '', text: '' }]); }}
            className={`p-4 font-mono font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors ${mode === 'single' ? 'bg-brutal-black text-white dark:bg-zinc-200 dark:text-black' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
          >
            <Zap className="w-4 h-4" /> Simulação Única
          </button>
          <button
            onClick={() => { setMode('compare'); if (inputs.length < 2) handleAddFramework(); }}
            className={`p-4 font-mono font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors ${mode === 'compare' ? 'bg-brutal-black text-white dark:bg-zinc-200 dark:text-black' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
          >
            <Layers className="w-4 h-4" /> Comparar (2-5)
          </button>
        </div>

        <div className="p-6 space-y-6">
          {mode === 'single' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="font-bold text-lg font-mono uppercase dark:text-zinc-200">Nome do Framework</label>
                <input
                  type="text"
                  className="w-full p-4 border-4 border-brutal-black dark:border-zinc-600 font-mono text-lg focus:outline-none focus:ring-4 focus:ring-brutal-green/30 bg-zinc-50 dark:bg-zinc-900 dark:text-white placeholder-zinc-400"
                  placeholder="EX: SCRUM"
                  value={inputs[0].name}
                  onChange={(e) => handleInputChange(inputs[0].id, 'name', e.target.value)}
                />
              </div>
              <div
                className={`relative border-4 border-dashed p-10 text-center transition-colors ${dragActive ? 'border-brutal-green bg-green-50 dark:bg-green-900/10' : 'border-zinc-300 dark:border-zinc-700'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-4 text-zinc-500 dark:text-zinc-400">
                  <div className="relative">
                    {isProcessing ? (
                      <Loader2 className="w-12 h-12 animate-spin text-brutal-green" />
                    ) : (
                      <>
                        <Upload className="w-12 h-12" />
                        {inputs[0].text && (
                          <div className="absolute -right-2 -top-2 bg-brutal-green text-black rounded-full p-1 border-2 border-black">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <p className="font-mono text-sm uppercase">
                    {isProcessing
                      ? 'Processando IA (Isso pode levar alguns segundos)...'
                      : inputs[0].text
                        ? 'Arquivo Processado com Sucesso!'
                        : 'Arraste o documento técnico ou digite o nome acima'
                    }
                  </p>
                </div>
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleFileSelect(inputs[0].id, e)}
                  disabled={isProcessing}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold font-mono uppercase text-sm dark:text-zinc-300">Frameworks para Batalha ({inputs.length}/5)</h3>
                {inputs.length < 5 && (
                  <button onClick={handleAddFramework} className="text-xs font-bold font-mono uppercase flex items-center gap-1 hover:text-brutal-green dark:text-zinc-400 dark:hover:text-brutal-green">
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                )}
              </div>

              {inputs.map((input, idx) => (
                <div key={input.id} className="flex gap-2 animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border-2 border-brutal-black dark:border-zinc-600 p-2 flex items-center gap-4 focus-within:border-brutal-green transition-colors">
                    <span className="font-mono font-bold text-zinc-400 px-2">0{idx + 1}</span>
                    <input
                      type="text"
                      placeholder={`Nome do Framework ${idx + 1}`}
                      className="bg-transparent w-full font-mono text-sm uppercase focus:outline-none dark:text-white"
                      value={input.name}
                      onChange={(e) => handleInputChange(input.id, 'name', e.target.value)}
                    />
                    <label className={`cursor-pointer p-2 rounded transition-all ${input.text ? 'bg-brutal-green/20 text-brutal-green' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400'}`} title="Importar Arquivo">
                      <input type="file" className="hidden" onChange={(e) => handleFileSelect(input.id, e)} disabled={isProcessing} />
                      {isProcessing && idx === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : (input.text ? <Check className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />)}
                    </label>
                  </div>
                  {inputs.length > 2 && (
                    <button
                      onClick={() => handleRemoveFramework(input.id)}
                      className="p-3 bg-red-100 hover:bg-red-200 text-red-600 border-2 border-brutal-black dark:border-zinc-600 dark:bg-red-900/20 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 text-xs font-mono flex gap-2 dark:text-blue-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>O conteúdo do arquivo será analisado pela IA para extrair parâmetros técnicos cruciais.</p>
          </div>

          <BrutalButton
            className="w-full"
            onClick={handleSubmit}
            disabled={inputs.some(i => !i.name) || isProcessing}
          >
            {isProcessing ? 'PROCESSANDO DOCUMENTOS...' : (mode === 'single' ? 'INICIAR SIMULAÇÃO ÚNICA' : 'INICIAR BATALHA COMPARATIVA')} &rarr;
          </BrutalButton>
        </div>
      </div>
    </div>
  );
};
