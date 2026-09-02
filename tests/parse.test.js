import { describe, it, expect } from 'vitest'
import { parseOrgText, parseLine, parseNum } from '../parse.js'

const SAMPLE = `組織關係圖	原職	現職	個人業績	小組業績	本月整組	整組累計
00 B082282 林莉雯	翡翠		116	116	3212	1810752
．01 B090956 陳育慧	松柏		192	192	1668	596468
．．02 B121699 田敏娜	經理		0	0	0	18,756
．．．03 H016315 張容需	副理		0	0	0	8924
．．02 H013815 楊惠婷	珍珠		0	0	1476	540736
．．．03 B113299 鄭蕙馨	副理		0	0	0	8804
．01 B095662 周依潔	翡翠		0	0	1164	680576
．．02 B095663 廖子淇	經理		0	0	0	16104`

describe('parseLine', () => {
  it('解析主欄位', () => {
    const r = parseLine('00 B082282 林莉雯\t翡翠\t\t116\t116\t3212\t1810752')
    expect(r.ok).toBe(true)
    expect(r.node.id).toBe('B082282')
    expect(r.node.name).toBe('林莉雯')
    expect(r.node.title).toBe('翡翠')
    expect(r.node.depth).toBe(0)
    expect(r.node.personal).toBe(116)
    expect(r.node.groupSales).toBe(116)
    expect(r.node.monthGroup).toBe(3212)
    expect(r.node.groupTotal).toBe(1810752)
  })

  it('帶前導點也能解析', () => {
    const r = parseLine('．01 B090956 陳育慧\t松柏\t\t192\t192\t1668\t596468')
    expect(r.ok).toBe(true)
    expect(r.node.name).toBe('陳育慧')
    expect(r.node.depth).toBe(1)
  })

  it('現職同欄／原職空的取現職', () => {
    const r = parseLine('02 A123456 測試員\t\t珍珠\t0\t0\t0\t0')
    expect(r.node.title).toBe('珍珠')
  })

  it('金額帶千分位逗號', () => {
    expect(parseNum('18,756')).toBe(18756)
    expect(parseNum('')).toBe(0)
    expect(parseNum('abc')).toBe(0)
  })

  it('格式錯誤行回傳 ok=false', () => {
    expect(parseLine('這不是組織資料').ok).toBe(false)
    expect(parseLine('').ok).toBe(false)
  })
})

describe('parseOrgText', () => {
  const { nodes, errors, roots } = parseOrgText(SAMPLE)

  it('跳過標頭列、只算資料列', () => {
    expect(nodes.length).toBe(8)
    expect(errors).toEqual([])
  })

  it('找出根節點', () => {
    expect(roots).toEqual(['B082282'])
    expect(nodes[0].name).toBe('林莉雯')
    expect(nodes[0].parentId).toBeNull()
  })

  it('父子關係正確', () => {
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId['B121699'].parentId).toBe('B090956') // 田敏娜→陳育慧
    expect(byId['H016315'].parentId).toBe('B121699') // 張容需→田敏娜
    expect(byId['H013815'].parentId).toBe('B090956') // 楊惠婷→陳育慧
    expect(byId['B113299'].parentId).toBe('H013815') // 鄭蕙馨→楊惠婷
    expect(byId['B095662'].parentId).toBe('B082282') // 周依潔→林莉雯
  })

  it('多個根支援', () => {
    const text = SAMPLE + '\n00 C000001 第二個頭\t翡翠\t\t0\t0\t0\t0'
    const r = parseOrgText(text)
    expect(r.roots).toEqual(['B082282', 'C000001'])
  })

  it('異常列會回報但不中斷', () => {
    const r = parseOrgText('00 B082282 林莉雯\t翡翠\t\t116\t116\t0\t0\n亂湊的一行資料')
    expect(r.nodes.length).toBe(1)
    expect(r.errors.length).toBe(1)
  })

  it('深度跳層回報', () => {
    const r = parseOrgText('00 B082282 林莉雯\t翡翠\t\t0\t0\t0\t0\n．．．03 H016315 張容需\t副理\t\t0\t0\t0\t0')
    expect(r.errors.some(e => e.includes('跳層'))).toBe(true)
  })
})