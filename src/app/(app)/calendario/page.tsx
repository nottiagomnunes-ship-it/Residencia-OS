import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { criarItem } from '@/lib/calendar'
import { hojeBR } from '@/lib/dates'
import { diasDaVisao, mover, type Visao } from '@/lib/engine/calendar'
import CalendarBoard, { type Item } from '@/components/CalendarBoard'
import { inputCls } from '@/components/ui'

export default async function Calendario({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const sp = await searchParams, hoje = hojeBR()
  const v: Visao = sp.v === 'dia' || sp.v === 'mes' ? sp.v : 'semana'
  const ancora = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : hoje
  const dias = diasDaVisao(v, ancora)
  const sb = await supabaseServer()
  const { data } = await sb.from('schedule_items').select('id,tipo,titulo,data,hora_ini,hora_fim,duracao_min,qtd_questoes,status,origem')
    .gte('data', dias[0]).lte('data', dias[dias.length - 1]).order('hora_ini', { nullsFirst: false }).order('titulo')
  const link = (view: string, d: string) => `/calendario?v=${view}&d=${d}`
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { ...o, timeZone: 'UTC' })
  const titulo = v === 'mes' ? fmt(ancora, { month: 'long', year: 'numeric' }) : v === 'dia' ? fmt(ancora, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${fmt(dias[0], { day: '2-digit', month: '2-digit' })} a ${fmt(dias[6], { day: '2-digit', month: '2-digit' })}`
  const btn = 'rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold capitalize">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={link(v, mover(v, ancora, -1))} className={btn} aria-label="Anterior">‹</Link>
          <Link href={link(v, hoje)} className={btn}>Hoje</Link>
          <Link href={link(v, mover(v, ancora, 1))} className={btn} aria-label="Próximo">›</Link>
          {(['dia', 'semana', 'mes'] as const).map(x => <Link key={x} href={link(x, ancora)} className={`${btn} ${x === v ? 'border-brand text-brand' : ''}`}>{x === 'mes' ? 'Mês' : x[0].toUpperCase() + x.slice(1)}</Link>)}
        </div>
      </div>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-brand">Nova tarefa</summary>
        <form action={criarItem} className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <input name="titulo" required placeholder="Título" className={inputCls + ' sm:col-span-3 xl:col-span-2'} />
          <select name="tipo" defaultValue="estudo" className={inputCls}><option value="estudo">Estudo</option><option value="questoes">Questões</option><option value="flashcards">Flashcards</option><option value="simulado">Simulado</option></select>
          <input name="data" type="date" required defaultValue={ancora} aria-label="Data" className={inputCls} />
          <input name="hora_ini" type="time" aria-label="Horário" className={inputCls} />
          <input name="duracao_min" type="number" min={5} step={5} placeholder="Minutos" className={inputCls} />
          <input name="qtd_questoes" type="number" min={1} placeholder="Nº de questões" className={inputCls} />
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black sm:col-span-3 xl:col-span-6">Adicionar ao calendário</button>
        </form>
      </details>
      <CalendarBoard items={(data ?? []) as Item[]} dias={dias} view={v} hoje={hoje} mes={ancora.slice(0, 7)} />
      <p className="text-xs text-muted">No computador, arraste uma tarefa para outro dia. No celular, toque na tarefa e use “Mover para esta data”.</p>
    </div>
  )
}
