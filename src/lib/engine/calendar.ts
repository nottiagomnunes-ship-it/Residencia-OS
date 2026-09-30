import { addDays, diffDays } from './review'

export type Visao = 'dia' | 'semana' | 'mes'
/** Segunda-feira da semana de `iso`. */
export const weekStart = (iso: string) => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7))
export const lastOfMonth = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }

/** Dias exibidos: 1 (dia), 7 (semana) ou a grade do mês completa, começando na segunda. */
export function diasDaVisao(v: Visao, ancora: string) {
  if (v === 'dia') return [ancora]
  if (v === 'semana') { const s = weekStart(ancora); return Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
  const s = weekStart(ancora.slice(0, 8) + '01'), n = Math.ceil((diffDays(s, lastOfMonth(ancora)) + 1) / 7) * 7
  return Array.from({ length: n }, (_, i) => addDays(s, i))
}
/** Âncora anterior (-1) ou seguinte (+1). */
export function mover(v: Visao, ancora: string, dir: 1 | -1) {
  if (v === 'dia') return addDays(ancora, dir)
  if (v === 'semana') return addDays(ancora, 7 * dir)
  const [y, m] = ancora.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10)
}
/** Status visual derivado da data: concluído, atrasado, próximo (hoje/amanhã) ou agendado. */
export function statusDe(i: { status: string; data: string }, hoje: string) {
  if (i.status === 'concluido') return 'concluido'
  if (i.data < hoje) return 'atrasado'
  return diffDays(hoje, i.data) <= 1 ? 'proximo' : 'agendado'
}
