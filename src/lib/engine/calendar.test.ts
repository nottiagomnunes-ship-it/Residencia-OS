import { it, expect } from 'vitest'
import { weekStart, diasDaVisao, mover, statusDe } from './calendar'

it('semana começa na segunda', () => { expect(weekStart('2026-09-29')).toBe('2026-09-28'); expect(weekStart('2026-09-27')).toBe('2026-09-21') })
it('grade do mês tem semanas completas', () => {
  const d = diasDaVisao('mes', '2026-10-15')
  expect(d[0]).toBe('2026-09-28'); expect(d.length % 7).toBe(0); expect(d).toContain('2026-10-31')
})
it('navegação entre meses e semanas', () => { expect(mover('mes', '2026-01-15', -1)).toBe('2025-12-01'); expect(mover('semana', '2026-10-01', 1)).toBe('2026-10-08') })
it('status visual', () => {
  const h = '2026-09-29'
  expect(statusDe({ status: 'agendado', data: '2026-09-28' }, h)).toBe('atrasado')
  expect(statusDe({ status: 'agendado', data: '2026-09-30' }, h)).toBe('proximo')
  expect(statusDe({ status: 'agendado', data: '2026-10-05' }, h)).toBe('agendado')
  expect(statusDe({ status: 'concluido', data: '2026-09-01' }, h)).toBe('concluido')
})
