import { addDays, diffDays } from './review'
import { weekStart } from './calendar'

export type Topico = { id: string; nome: string; disciplineId: string; prioridade: number; dificuldade: number; plannedDate?: string | null; reforco?: boolean }
export type Disc = { id: string; nome: string; peso: number }
export type Bloco = { tipo: 'estudo' | 'questoes' | 'simulado'; topic_id: string | null; titulo: string; data: string; duracao_min: number; qtd_questoes: number | null; hora_ini?: string; hora_fim?: string }
export type Entrada = {
  hoje: string; prova: string; diasDisponiveis: number[]; minutosDia: number; questoesDia: number
  disciplinas: Disc[]; topicos: Topico[]; fixos: Topico[]; reforcos?: Topico[]; minutosRevisaoPorDia: Record<string, number>
}

const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()
const dias = (a: string, b: string) => Array.from({ length: diffDays(a, b) + 1 }, (_, i) => addDays(a, i))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const score = (t: Topico) => (4 - t.prioridade) * 3 + t.dificuldade
export const duracaoTopico = (t: Topico) => (t.reforco ? 45 : 60 + (t.dificuldade - 2) * 15)

/** Intercala disciplinas proporcionalmente ao peso (round-robin ponderado); dentro de cada uma, prioridade e dificuldade primeiro. */
export function ordemDeEstudo(disciplinas: Disc[], topicos: Topico[]) {
  const fila = new Map(disciplinas.map(d => [d.id, topicos.filter(t => t.disciplineId === d.id).sort((a, b) => score(b) - score(a) || a.nome.localeCompare(b.nome))]))
  const atual = new Map(disciplinas.map(d => [d.id, 0]))
  const out: Topico[] = []
  for (;;) {
    const vivos = disciplinas.filter(d => fila.get(d.id)!.length)
    if (!vivos.length) return out
    vivos.forEach(d => atual.set(d.id, atual.get(d.id)! + d.peso))
    const pick = vivos.reduce((a, b) => (atual.get(b.id)! > atual.get(a.id)! ? b : a))
    atual.set(pick.id, atual.get(pick.id)! - vivos.reduce((s, d) => s + d.peso, 0))
    out.push(fila.get(pick.id)!.shift()!)
  }
}

function comHorarios(blocos: Bloco[]) {
  const ord = [...blocos].sort((a, b) => a.data.localeCompare(b.data)), fim = new Map<string, number>()
  for (const b of ord) { const t = fim.get(b.data) ?? 480; b.hora_ini = hhmm(t); b.hora_fim = hhmm(t + b.duracao_min); fim.set(b.data, t + b.duracao_min + 15) }
  return ord
}

/**
 * Distribui estudo novo até (prova − reserva), questões todo dia disponível e, na reta final,
 * questões ampliadas + um simulado por semana. Revisões já agendadas descontam da capacidade do dia.
 */
export function gerarCronograma(e: Entrada) {
  const blocos: Bloco[] = [], avisos: string[] = []
  const ordem = [...(e.reforcos ?? []).map(t => ({ ...t, reforco: true })), ...ordemDeEstudo(e.disciplinas, e.topicos)]
  const falta = (from: number) => ordem.slice(from).reduce((s, t) => s + duracaoTopico(t), 0)
  for (const t of e.fixos) blocos.push({ tipo: 'estudo', topic_id: t.id, titulo: t.nome, data: t.plannedDate!, duracao_min: duracaoTopico(t), qtd_questoes: null })

  const fimEstudo = addDays(e.prova, -1)
  if (fimEstudo < e.hoje) return { blocos: comHorarios(blocos), naoAlocados: ordem.length, minutosFaltantes: falta(0), avisos: ['A data da prova é hoje ou já passou.'] }

  const todos = dias(e.hoje, fimEstudo), reserva = Math.min(21, Math.floor(todos.length * 0.2)), corte = todos.length - reserva
  const livres = (l: string[]) => l.filter(d => e.diasDisponiveis.includes(dow(d)))
  const estudoDias = livres(todos.slice(0, corte)), finalDias = livres(todos.slice(corte))
  const qMin = e.questoesDia > 0 ? Math.min(e.questoesDia * 2, Math.round(e.minutosDia * 0.35)) : 0
  const capDia = (d: string) => {
    const rev = Math.min(e.minutosRevisaoPorDia[d] ?? 0, Math.round(e.minutosDia * 0.3))
    const fixo = blocos.filter(b => b.data === d && b.tipo === 'estudo').reduce((s, b) => s + b.duracao_min, 0)
    return Math.max(0, e.minutosDia - rev - qMin - fixo)
  }
  const discFoco = [...e.disciplinas].sort((a, b) => b.peso - a.peso)[0]?.nome ?? 'Revisão geral'
  const nome = new Map(e.disciplinas.map(d => [d.id, d.nome]))

  let i = 0
  for (const d of estudoDias) {
    const c0 = capDia(d); let livre = c0, primeira: Topico | null = null
    if (c0 >= 30) while (i < ordem.length) {
      const t = ordem[i], dur = Math.min(duracaoTopico(t), c0)
      if (dur > livre) break
      blocos.push({ tipo: 'estudo', topic_id: t.reforco ? null : t.id, titulo: t.reforco ? `Reforço — ${t.nome}` : t.nome, data: d, duracao_min: dur, qtd_questoes: null })
      primeira ??= t; livre -= dur; i++
    }
    if (qMin) blocos.push({ tipo: 'questoes', topic_id: null, titulo: `${e.questoesDia} questões — ${primeira ? nome.get(primeira.disciplineId) : discFoco}`, data: d, duracao_min: qMin, qtd_questoes: e.questoesDia })
  }

  const semanasComSimulado = new Set<string>()
  for (const d of finalDias) {
    const sem = weekStart(d)
    if (!semanasComSimulado.has(sem)) {
      semanasComSimulado.add(sem)
      blocos.push({ tipo: 'simulado', topic_id: null, titulo: 'Simulado', data: d, duracao_min: e.minutosDia, qtd_questoes: null })
    } else if (e.questoesDia > 0) {
      const q = Math.round(e.questoesDia * 1.5)
      blocos.push({ tipo: 'questoes', topic_id: null, titulo: `${q} questões — Revisão geral`, data: d, duracao_min: Math.min(q * 2, Math.round(e.minutosDia * 0.6)), qtd_questoes: q })
    }
  }

  const naoAlocados = ordem.length - i, minutosFaltantes = falta(i)
  if (naoAlocados) avisos.push(`Faltam cerca de ${Math.ceil(minutosFaltantes / 60)} h para cobrir ${naoAlocados} assuntos antes da prova. Aumente as horas por dia, libere mais dias da semana ou remova assuntos de baixa prioridade.`)
  if (!estudoDias.length && ordem.length) avisos.push('Nenhum dia disponível antes da prova: revise os dias da semana nas configurações.')
  return { blocos: comHorarios(blocos), naoAlocados, minutosFaltantes, avisos }
}
