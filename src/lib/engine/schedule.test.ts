import { describe, it, expect } from 'vitest'
import { gerarCronograma, ordemDeEstudo, type Entrada, type Topico } from './schedule'

const disc = [{ id: 'A', nome: 'Clínica', peso: 3 }, { id: 'B', nome: 'Preventiva', peso: 1 }]
const topicos = (n: number, d = 'A'): Topico[] => Array.from({ length: n }, (_, i) => ({ id: `${d}${i}`, nome: `${d} ${i}`, disciplineId: d, prioridade: 2, dificuldade: 2 }))
const base = (o: Partial<Entrada> = {}): Entrada => ({
  hoje: '2026-09-30', prova: '2026-12-15', diasDisponiveis: [1, 2, 3, 4, 5], minutosDia: 240, questoesDia: 40,
  disciplinas: disc, topicos: [...topicos(6, 'A'), ...topicos(6, 'B')], fixos: [], minutosRevisaoPorDia: {}, ...o,
})
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()

it('intercala disciplinas pelo peso (3:1)', () => {
  expect(ordemDeEstudo(disc, [...topicos(4, 'A'), ...topicos(4, 'B')]).slice(0, 4).map(t => t.disciplineId)).toEqual(['A', 'A', 'B', 'A'])
})
it('dentro da disciplina, prioridade alta vem primeiro', () => {
  const t: Topico[] = [{ id: 'x', nome: 'x', disciplineId: 'A', prioridade: 3, dificuldade: 2 }, { id: 'y', nome: 'y', disciplineId: 'A', prioridade: 1, dificuldade: 2 }]
  expect(ordemDeEstudo(disc, t)[0].id).toBe('y')
})
describe('gerarCronograma', () => {
  it('só usa dias disponíveis e nada depois da prova', () => {
    const { blocos } = gerarCronograma(base())
    expect(blocos.length).toBeGreaterThan(0)
    for (const b of blocos) { expect([1, 2, 3, 4, 5]).toContain(dow(b.data)); expect(b.data < '2026-12-15').toBe(true) }
  })
  it('nunca passa da capacidade diária', () => {
    const por = new Map<string, number>()
    for (const b of gerarCronograma(base()).blocos) por.set(b.data, (por.get(b.data) ?? 0) + b.duracao_min)
    por.forEach(m => expect(m).toBeLessThanOrEqual(240))
  })
  it('desconta revisões já agendadas do dia', () => {
    const { blocos } = gerarCronograma(base({ minutosRevisaoPorDia: { '2026-10-01': 120 } }))
    expect(blocos.filter(b => b.data === '2026-10-01').reduce((s, b) => s + b.duracao_min, 0)).toBeLessThanOrEqual(240 - 72)
  })
  it('reta final não tem estudo novo e tem simulado semanal', () => {
    const { blocos } = gerarCronograma(base())
    expect(blocos.filter(b => b.data >= '2026-11-27' && b.tipo === 'estudo')).toHaveLength(0)
    expect(blocos.filter(b => b.tipo === 'simulado').length).toBeGreaterThanOrEqual(2)
  })
  it('respeita assunto com data fixa', () => {
    const fixo: Topico = { ...topicos(1, 'A')[0], id: 'F', plannedDate: '2026-10-10' }
    expect(gerarCronograma(base({ fixos: [fixo], topicos: [] })).blocos.find(b => b.topic_id === 'F')?.data).toBe('2026-10-10')
  })
  it('avisa quando o tempo não fecha', () => {
    const r = gerarCronograma(base({ prova: '2026-10-14', topicos: topicos(200, 'A') }))
    expect(r.naoAlocados).toBeGreaterThan(0); expect(r.avisos[0]).toMatch(/Faltam/)
  })
  it('reforço de assunto fraco entra primeiro, sem vínculo com o assunto', () => {
    const r = gerarCronograma(base({ reforcos: [{ id: 'W', nome: 'Hipertensão', disciplineId: 'A', prioridade: 1, dificuldade: 2 }] }))
    const b = r.blocos.find(x => x.tipo === 'estudo')!
    expect(b.titulo).toBe('Reforço — Hipertensão'); expect(b.topic_id).toBeNull(); expect(b.duracao_min).toBe(45)
  })
  it('avisa quando a prova já passou', () => { expect(gerarCronograma(base({ prova: '2026-09-30' })).avisos[0]).toMatch(/prova/) })
})
