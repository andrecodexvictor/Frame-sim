import React, { useId, useRef } from 'react';
import { flowchartSVG } from '../services/flowchartExport';
export const SimulationFlowchart: React.FC = () => {
    const instance = useId();
    const viewport = useRef<HTMLDivElement>(null);
    return <details className="border-t border-zinc-500/40 pt-3" onToggle={event => {
        if (event.currentTarget.open && viewport.current) viewport.current.scrollLeft = (viewport.current.scrollWidth - viewport.current.clientWidth) / 2;
    }}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline">Fluxograma da simulação e das avaliações</summary>
        <p className="text-xs leading-relaxed mb-3 max-w-prose">Retângulos indicam etapas; losangos indicam decisões. As saídas Sim/Não mostram quando há avaliação ou abstenção. Este é o fluxo do processo, não o resultado de uma execução.</p>
        <div ref={viewport} role="region" aria-label="Fluxograma navegável" tabIndex={0} className="overflow-x-auto rounded bg-white focus-visible:outline" style={{ colorScheme: 'light' }}>
            <div className="mx-auto w-full [&_svg]:block [&_svg]:w-full [&_svg]:h-auto" style={{ minWidth: 600, maxWidth: 760 }} dangerouslySetInnerHTML={{ __html: flowchartSVG(instance) }} />
        </div>
        <p className="text-xs leading-relaxed mt-3">No celular, deslize o diagrama para os lados. O pacote de artigo inclui este fluxograma em SVG, Mermaid e TikZ editáveis.</p>
    </details>;
};
