// expiry.js — 會員到期日計算（純函式，供測試）

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toYyyyMm(y, m) {
  return `${y}${pad2(m)}`
}

export function parseYyyyMm(yyyymm) {
  const s = String(yyyymm || '').replace(/[^0-9]/g, '')
  return {
    y: parseInt(s.slice(0, 4), 10),
    m: parseInt(s.slice(4, 6), 10) || 1
  }
}

// yyyymm 往前/往後幾個月
export function addMonths(yyyymm, delta) {
  const { y, m } = parseYyyyMm(yyyymm)
  const t = y * 12 + (m - 1) + delta
  return toYyyyMm(Math.floor(t / 12), (t % 12) + 1)
}

// a - b 相差幾個月
export function diffMonths(a, b) {
  const x = parseYyyyMm(a)
  const y = parseYyyyMm(b)
  return x.y * 12 + x.m - (y.y * 12 + y.m)
}

/**
 * 計算到期月
 * - 個人業績 > 0 → 訂貨月(資料月) + 1 年
 * - 無業績且無原存到期 → 今天 + 1 年（暫訂基準）
 * - 有原存到期 → 保留（取較晚者）
 */
export function computeExpiry({ storedExpiry, personal, dataMonth, todayYyyyMm }) {
  const cands = []
  if (personal > 0) cands.push(addMonths(dataMonth, 12))
  else if (!storedExpiry) cands.push(addMonths(todayYyyyMm, 12))
  if (storedExpiry) cands.push(storedExpiry)
  if (!cands.length) return null
  return cands.reduce((a, b) => (a > b ? a : b))
}

/**
 * 警示狀態（以資料月份為基準）
 * 剩 2 個月 → orange；剩 <=1 個月 → red；其他 → null
 */
export function warningStatus(expiry, dataMonth) {
  if (!expiry) return null
  const left = diffMonths(expiry, dataMonth)
  if (left === 2) return 'orange'
  if (left <= 1) return 'red'
  return null
}

export function formatYyyyMm(yyyymm) {
  if (!yyyymm) return ''
  return `${String(yyyymm).slice(0, 4)}/${String(yyyymm).slice(4, 6)}`
}

// 從「最後訂貨」紀錄換算到期：訂貨月 + 1 年
export function expiryFromOrderMonth(orderMonth) {
  if (!orderMonth) return null
  const { y, m } = parseYyyyMm(orderMonth)
  if (!Number.isFinite(y) || y < 2000) return null
  return addMonths(toYyyyMm(y, m), 12)
}