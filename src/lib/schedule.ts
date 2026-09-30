'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { gerarCronograma } from '@/lib/engine/schedule'

/** Gera ou atualiza o cronograma: recalcula tudo que é automático e mantém revisões, concluídos e itens manuais. */
export async function gerarCronogramaAction() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const uid = user.id, agora = hojeBR()
  const { data: p } = await sb.from('profiles').select('exam_date,study_start_date,daily_minutes,daily_questions_goal,available_weekdays').eq('id', uid).single()
  if (!p?.exam_date) redirect('/cronograma?msg=' + encodeURIComponent('Defina a data da prova para gerar o cronograma.'))
  const hoje = p.study_start_date && p.study_start_date > agora ? p.study_start_date : agora

  const [{ data: ds }, { data: ts }, { data: rv }] = await Promise.all([
    sb.from('disciplines').select('id,nome,peso'),
    sb.from('topics').select('id,nome,discipline_id,prioridade,dificuldade,planned_date,planned_auto,status').neq('status', 'concluido'),
    sb.from('schedule_items').select('data,duracao_min').eq('tipo', 'revisao').neq('status', 'concluido').gte('data', hoje),
  ])
  const minutosRevisaoPorDia: Record<string, number> = {}
  for (const r of rv ?? []) minutosRevisaoPorDia[r.data] = (minutosRevisaoPorDia[r.data] ?? 0) + (r.duracao_min ?? 30)

  const topicos = (ts ?? []).map(t => ({ id: t.id, nome: t.nome, disciplineId: t.discipline_id, prioridade: t.prioridade, dificuldade: t.dificuldade, plannedDate: t.planned_date }))
  const ehFixo = (t: { plannedDate?: string | null }, orig: any) => !!t.plannedDate && t.plannedDate >= hoje && !orig.planned_auto
  const origem = new Map((ts ?? []).map(t => [t.id, t]))
  const fixos = topicos.filter(t => ehFixo(t, origem.get(t.id)))
  const auto = topicos.filter(t => !fixos.includes(t))

  const des = await carregarDesempenho(sb, hoje)
  const reforcos = des.assuntos.filter(x => x.status === 'concluido' && x.nivel === 'alta').sort((x, y) => y.pontos - x.pontos).slice(0, 3)
    .map(x => ({ id: x.id, nome: x.nome, disciplineId: x.disciplineId, prioridade: 1, dificuldade: 2 }))
  const r = gerarCronograma({
    hoje, prova: p.exam_date, diasDisponiveis: p.available_weekdays ?? [1, 2, 3, 4, 5, 6], minutosDia: p.daily_minutes ?? 240,
    questoesDia: p.daily_questions_goal ?? 0, disciplinas: ds ?? [], topicos: auto, fixos, minutosRevisaoPorDia, reforcos,
  })

  // limpa o plano automático anterior (nunca toca em revisões, concluídos ou itens manuais)
  await sb.from('schedule_items').delete().eq('origem', 'auto').in('tipo', ['estudo', 'questoes', 'simulado']).neq('status', 'concluido').gte('data', hoje).is('review_id', null)
  await sb.from('topics').update({ status: 'nao_iniciado', planned_date: null }).eq('planned_auto', true).eq('status', 'planejado')
  if (r.blocos.length) await sb.from('schedule_items').insert(r.blocos.map(b => ({ ...b, user_id: uid, origem: 'auto' })))

  const fixoIds = new Set(fixos.map(t => t.id))
  const plan = r.blocos.filter(b => b.tipo === 'estudo' && b.topic_id && !fixoIds.has(b.topic_id))
  if (plan.length) await sb.from('topics').upsert(plan.map(b => {
    const o = origem.get(b.topic_id!)!
    return { id: o.id, user_id: uid, discipline_id: o.discipline_id, nome: o.nome, planned_date: b.data, planned_auto: true, status: o.status === 'nao_iniciado' ? 'planejado' : o.status }
  }))

  ;['/cronograma', '/calendario', '/conteudos', '/disciplinas', '/inicio'].forEach(x => revalidatePath(x, 'layout'))
  const n = plan.length + fixos.length
  redirect('/cronograma?msg=' + encodeURIComponent(`Cronograma atualizado: ${n} assuntos planejados. ${r.avisos.join(' ')}`.trim()))
}
