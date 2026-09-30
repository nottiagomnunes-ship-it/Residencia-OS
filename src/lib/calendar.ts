'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { concluirConteudo, concluirRevisao } from '@/lib/flow'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/calendario', '/inicio', '/revisoes', '/conteudos', '/disciplinas'].forEach(p => revalidatePath(p, 'layout'))
const ISO = /^\d{4}-\d{2}-\d{2}$/
const COLS = 'id,tipo,status,data,review_id,topic_id,duracao_min'

async function reagendar(sb: Awaited<ReturnType<typeof ctx>>['sb'], i: any, data: string) {
  await sb.from('schedule_items').update({ data, status: 'agendado' }).eq('id', i.id)
  if (i.review_id) await sb.from('reviews').update({ due_date: data }).eq('id', i.review_id)
  else if (i.tipo === 'estudo' && i.topic_id) await sb.from('topics').update({ planned_date: data, planned_auto: false }).eq('id', i.topic_id)
}

export async function moverItem(id: string, data: string) {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido' || !ISO.test(data)) return
  await reagendar(sb, i, data); refresh()
}
export async function adiarItem(id: string) {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido') return
  const base = i.data > hojeBR() ? i.data : hojeBR()
  await reagendar(sb, i, addDays(base, 1)); refresh()
}
/** Concluir usa o mesmo fluxo de Revisões/Conteúdos, então gera revisões, XP e estatísticas. */
export async function concluirItem(id: string) {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select(COLS).eq('id', id).single()
  if (!i || i.status === 'concluido') return
  const f = new FormData()
  if (i.review_id) { f.set('review_id', i.review_id); await concluirRevisao(f) }
  else if (i.tipo === 'estudo' && i.topic_id) { f.set('topic_id', i.topic_id); f.set('duration_min', String(i.duracao_min ?? 60)); await concluirConteudo(f) }
  else await sb.from('schedule_items').update({ status: 'concluido' }).eq('id', id)
  refresh()
}
/** Excluir uma revisão automática remove a própria revisão (o item some junto, por cascata). */
export async function excluirItem(id: string) {
  const { sb } = await ctx()
  const { data: i } = await sb.from('schedule_items').select('id,review_id').eq('id', id).single()
  if (!i) return
  if (i.review_id) await sb.from('reviews').delete().eq('id', i.review_id)
  else await sb.from('schedule_items').delete().eq('id', id)
  refresh()
}
export async function criarItem(fd: FormData) {
  const { sb, uid } = await ctx()
  const data = String(fd.get('data'))
  if (!ISO.test(data)) return
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null)
  const ini = String(fd.get('hora_ini') || '') || null, dur = n('duracao_min')
  const fim = ini && dur ? new Date(Date.UTC(2000, 0, 1, +ini.slice(0, 2), +ini.slice(3, 5) + dur)).toISOString().slice(11, 16) : null
  await sb.from('schedule_items').insert({ user_id: uid, tipo: String(fd.get('tipo')), titulo: String(fd.get('titulo')).trim(), data,
    hora_ini: ini, hora_fim: fim, duracao_min: dur, qtd_questoes: n('qtd_questoes'), origem: 'manual' })
  refresh()
}
