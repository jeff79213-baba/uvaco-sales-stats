import { describe, it, expect } from 'vitest'
import {
  addMonths, diffMonths, computeExpiry, warningStatus,
  formatYyyyMm, expiryFromOrderMonth
} from '../expiry.js'

describe('addMonths', () => {
  it('跨年跨月', () => {
    expect(addMonths('202609', 1)).toBe('202610')
    expect(addMonths('202609', 12)).toBe('202709')
    expect(addMonths('202611', 2)).toBe('202701')
    expect(addMonths('202612', 1)).toBe('202701')
  })
})

describe('diffMonths', () => {
  it('差異月數', () => {
    expect(diffMonths('202709', '202609')).toBe(12)
    expect(diffMonths('202709', '202707')).toBe(2)
    expect(diffMonths('202708', '202707')).toBe(1)
    expect(diffMonths('202707', '202707')).toBe(0)
  })
})

describe('computeExpiry', () => {
  it('有個人業績 → 資料月+1年', () => {
    expect(computeExpiry({ storedExpiry: null, personal: 116, dataMonth: '202609', todayYyyyMm: '202609' })).toBe('202709')
  })

  it('有業績且原到期更晚 → 保留較晚', () => {
    expect(computeExpiry({ storedExpiry: '202810', personal: 116, dataMonth: '202609', todayYyyyMm: '202609' })).toBe('202810')
  })

  it('無業績且無原存 → 今天+1年', () => {
    expect(computeExpiry({ storedExpiry: null, personal: 0, dataMonth: '202609', todayYyyyMm: '202609' })).toBe('202709')
  })

  it('無業績但有原存 → 保留原存', () => {
    expect(computeExpiry({ storedExpiry: '202603', personal: 0, dataMonth: '202609', todayYyyyMm: '202609' })).toBe('202603')
  })

  it('storedExpiry=null 且有業績 → dataMonth+12（手動輸入觸發）', () => {
    const result = computeExpiry({ storedExpiry: null, personal: 100, dataMonth: '202609', todayYyyyMm: '202609' })
    expect(result).toBe('202709')
  })
})

describe('warningStatus', () => {
  it('以資料月份為基準', () => {
    expect(warningStatus('202709', '202607')).toBeNull()   // 剩 14 個月
    expect(warningStatus('202709', '202707')).toBe('orange') // 剩 2 個月
    expect(warningStatus('202709', '202708')).toBe('red')    // 剩 1 個月
    expect(warningStatus('202709', '202709')).toBe('red')    // 本月到期
  })

  it('無到期日 → 無警示', () => {
    expect(warningStatus(null, '202609')).toBeNull()
    expect(warningStatus('', '202609')).toBeNull()
  })
})

describe('formatYyyyMm', () => {
  it('YYYYMM → YYYY/MM', () => {
    expect(formatYyyyMm('202709')).toBe('2027/09')
    expect(formatYyyyMm(null)).toBe('')
  })
})

describe('expiryFromOrderMonth', () => {
  it('最後訂貨月 +1年', () => {
    expect(expiryFromOrderMonth('202509')).toBe('202609')
    expect(expiryFromOrderMonth('2023/3')).toBe('202403')
    expect(expiryFromOrderMonth('blah')).toBeNull()
  })
})