import { describe, expect, it } from 'vitest'
import { makeEntry, normalize, searchEntries } from './search'

const entries = [
  makeEntry('bench', 'Press de banca', ['press banca', 'bench press'], ['pecho', 'barra']),
  makeEntry('incline-machine', 'Press inclinado en máquina', [], ['pecho', 'máquina']),
  makeEntry('smith-bench', 'Press de banca en multipower', ['press banca smith'], ['pecho']),
  makeEntry('lat-pulldown', 'Jalón al pecho', ['polea al pecho'], ['espalda', 'polea']),
  makeEntry('squat', 'Sentadilla con barra', ['squat'], ['cuádriceps', 'barra']),
]

describe('normalize', () => {
  it('quita acentos, mayúsculas y espacios repetidos', () => {
    expect(normalize('  Press  BÁNCA ')).toBe('press banca')
    expect(normalize('Jalón')).toBe('jalon')
  })
})

describe('searchEntries', () => {
  it('encuentra sin acentos ni mayúsculas', () => {
    expect(searchEntries('press bánca', entries)).toContain('bench')
    expect(searchEntries('JALON', entries)[0]).toBe('lat-pulldown')
  })

  it('prioriza el prefijo del nombre sobre coincidencias sueltas', () => {
    const result = searchEntries('press', entries)
    expect(result[0]).toBe('bench')
    expect(result).not.toContain('lat-pulldown')
  })

  it('multi-palabra exige que todas coincidan', () => {
    const result = searchEntries('press maquina', entries)
    expect(result).toEqual(['incline-machine'])
  })

  it('los alias también puntúan', () => {
    expect(searchEntries('smith', entries)).toContain('smith-bench')
  })

  it('busca por grupo muscular', () => {
    const result = searchEntries('espalda', entries)
    expect(result).toEqual(['lat-pulldown'])
  })

  it('consulta vacía devuelve todo en orden alfabético', () => {
    expect(searchEntries('', entries)).toHaveLength(entries.length)
    expect(searchEntries('  ', entries)[0]).toBe('lat-pulldown')
  })

  it('sin coincidencias devuelve vacío', () => {
    expect(searchEntries('zzz', entries)).toEqual([])
  })
})
