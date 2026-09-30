'use client'
import { useState, useTransition } from 'react'
import { moverItem, adiarItem, concluirItem, excluirItem } from '@/lib/calendar'
import { statusDe } from '@/lib/engine/calendar'
import { fmtData, inputCls } from '@/components/ui'

export type Item = { id: string; tipo: string; titulo: string; data: string; hora_ini: string | null; hora_fim: string | null; duracao_min: number | null; qtd_questoes: number | null; status: string; origem: string }
const COR: Record<string, string> = { concluido: 'border-brand bg-brand/10', agendado: 'border-info bg-info/10', proximo: 'border-warn bg-warn/10', atrasado: 'border-danger bg-danger/10' }
const ROTULO: Record<string, string> = { concluido: 'Concluído', agendado: 'Agendado', proximo: 'Próximo', atrasado: 'Atrasado' }
const TIPO: Record<string, string> = { estudo: 'Estudo', revisao: 'Revisão', questoes: 'Questões', flashcards: 'Flashcards', simulado: 'Simulado' }
const TIPO_COR: Record<string, string> = { questoes: 'text-violet', flashcards: 'text-pink', simulado: 'text-violet' }
const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarBoard({ items, dias, view, hoje, mes }: { items: Item[]; dias: string[]; view: string; hoje: string; mes: string }) {
  const [sel, setSel] = useState<Item | null>(null)
  const [novaData, setNovaData] = useState('')
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setSel(null) })
  const nomeDia = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')
  const cols = view === 'dia' ? 'grid-cols-1' : view === 'semana' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-7'
  const compacto = view === 'mes'

  return (
    <div className={pending ? 'opacity-60' : ''}>
      {compacto && <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">{SEMANA.map(s => <div key={s}>{s}</div>)}</div>}
      <div className={`grid gap-2 ${cols}`}>
        {dias.map(d => {
          const lista = items.filter(i => i.data === d)
          return (
            <section key={d} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) start(async () => { await moverItem(id, d) }) }}
              className={`min-h-24 space-y-1.5 rounded-xl border bg-surface p-2 ${d === hoje ? 'border-brand' : 'border-line'} ${compacto && d.slice(0, 7) !== mes ? 'opacity-40' : ''}`}>
              <h3 className="text-sm">{compacto ? +d.slice(8) : <><span className="capitalize">{nomeDia(d)}</span> <span className="text-muted">{d.slice(8)}/{d.slice(5, 7)}</span></>}</h3>
              {lista.map(i => {
                const st = statusDe(i, hoje)
                return (
                  <div key={i.id} role="button" tabIndex={0} draggable={i.status !== 'concluido'}
                    onDragStart={e => e.dataTransfer.setData('text/plain', i.id)} onClick={() => { setSel(i); setNovaData(i.data) }}
                    onKeyDown={e => e.key === 'Enter' && (setSel(i), setNovaData(i.data))}
                    className={`cursor-pointer rounded-lg border-l-4 px-2 py-1.5 ${compacto ? 'truncate text-[11px]' : 'text-sm'} ${COR[st]}`}>
                    {!compacto && <span className={`block text-xs ${TIPO_COR[i.tipo] ?? 'text-muted'}`}>{TIPO[i.tipo]}{i.hora_ini ? ` · ${i.hora_ini.slice(0, 5)}` : ''}</span>}
                    <span className={st === 'concluido' ? 'line-through opacity-70' : ''}>{i.titulo}</span>
                  </div>)
              })}
            </section>)
        })}
      </div>

      {sel && (
        <div className="fixed inset-0 z-20 grid place-items-end bg-black/60 md:place-items-center" onClick={() => setSel(null)}>
          <div role="dialog" aria-modal="true" aria-label={sel.titulo} onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-t-2xl border border-line bg-surface p-6 md:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className={`text-sm ${TIPO_COR[sel.tipo] ?? 'text-muted'}`}>{TIPO[sel.tipo]} · {ROTULO[statusDe(sel, hoje)]}</p><h2 className="text-lg font-semibold">{sel.titulo}</h2></div>
              <button onClick={() => setSel(null)} aria-label="Fechar" className="text-muted">✕</button>
            </div>
            <p className="text-sm text-muted">{fmtData(sel.data)}{sel.hora_ini ? ` · ${sel.hora_ini.slice(0, 5)}${sel.hora_fim ? `–${sel.hora_fim.slice(0, 5)}` : ''}` : ''}{sel.duracao_min ? ` · ${sel.duracao_min} min` : ''}{sel.qtd_questoes ? ` · ${sel.qtd_questoes} questões` : ''}{sel.origem === 'auto' ? ' · gerada pelo sistema' : ''}</p>
            {sel.status !== 'concluido' && <>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => run(() => concluirItem(sel.id))} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Concluir</button>
                <button onClick={() => run(() => adiarItem(sel.id))} className="rounded-xl border border-line px-4 py-2 text-sm">Adiar 1 dia</button>
                <button onClick={() => confirm('Excluir esta tarefa?') && run(() => excluirItem(sel.id))} className="rounded-xl px-4 py-2 text-sm text-danger hover:bg-danger/10">Excluir</button>
              </div>
              <div className="flex items-center gap-2"><input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className={inputCls} aria-label="Nova data" />
                <button onClick={() => run(() => moverItem(sel.id, novaData))} className="rounded-xl border border-line px-4 py-2 text-sm">Mover para esta data</button></div>
            </>}
          </div>
        </div>)}
    </div>
  )
}
