'use client';

import { useState } from 'react';
import { Annotation, Status } from '@/types';
import StatsBar from './StatsBar';

interface Props {
  annotations: Annotation[];
  onSelect: (a: Annotation) => void;
}

const STATUS_ORDER: Record<Status, number> = { ok: 0, maybe: 1, nok: 2, neutral: 3 };
const STATUS_LABEL: Record<Status, string> = { ok: 'Possible', maybe: 'Peut-être ?', nok: 'Refusé', neutral: 'Non visité' };
const STATUS_COLOR: Record<Status, string> = {
  ok: 'text-green bg-green/10 border-green/30',
  maybe: 'text-orange bg-orange/10 border-orange/30',
  nok: 'text-red bg-red/10 border-red/30',
  neutral: 'text-text-dim bg-surface2 border-border',
};

export default function Sidebar({ annotations, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const filtered = annotations
    .filter((a) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        a.id.toLowerCase().includes(q) ||
        (a.owner_name ?? '').toLowerCase().includes(q) ||
        (a.commune_code ?? '').includes(q) ||
        (a.section ?? '').toLowerCase().includes(q) ||
        (a.numero ?? '').includes(q)
      );
    })
    .sort((a, b) => STATUS_ORDER[a.status as Status] - STATUS_ORDER[b.status as Status]);

  function exportCsv() {
    const header = 'id,commune,section,numero,statut,proprietaire,telephone,notes';
    const rows = annotations.map((a) =>
      [
        a.id,
        a.commune_code ?? '',
        a.section ?? '',
        a.numero ?? '',
        a.status,
        (a.owner_name ?? '').replace(/,/g, ' '),
        (a.phone ?? '').replace(/,/g, ' '),
        (a.notes ?? '').replace(/[\r\n,]/g, ' '),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parcelles.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="w-[340px] min-w-[340px] bg-surface border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-base font-semibold mb-3">Prospection Cadastre</h1>
        <StatsBar annotations={annotations} />
      </div>

      <div className="p-3 border-b border-border">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher parcelle, propriétaire…"
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue placeholder:text-text-dim"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-text-dim text-sm">Aucune parcelle annotée</div>
        )}
        {filtered.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className="w-full text-left px-4 py-3 border-b border-border hover:bg-surface2 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-xs text-text-dim">{a.id}</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLOR[a.status as Status]}`}
              >
                {STATUS_LABEL[a.status as Status]}
              </span>
            </div>
            {a.owner_name && <div className="text-sm truncate">{a.owner_name}</div>}
            {a.phone && <div className="text-xs text-text-dim">{a.phone}</div>}
            {a.notes && <div className="text-xs text-text-dim mt-0.5 truncate">{a.notes}</div>}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={exportCsv}
          className="w-full py-2 text-xs text-text-dim border border-border rounded-lg hover:bg-surface2 transition-colors"
        >
          Exporter CSV
        </button>
      </div>
    </aside>
  );
}
