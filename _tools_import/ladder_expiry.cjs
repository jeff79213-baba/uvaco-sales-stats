// 用「組織階梯表」的最後訂購日重建每位會員的精確到期月（最後訂購日 + 1 年，取月）
// 用法：node _tools_import/ladder_expiry.cjs <階梯表文字檔> [--commit]
// 預設乾跑（只印出將要更新的統計）；加 --commit 才真正寫入 Firebase
const path = require('path')
const fs = require('fs')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const KEY = process.env.UVACO_KEY || 'C:/Users/TW-10/Documents/firebase雲端資料夾/opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json'
const input = process.argv[2]
const commit = process.argv.includes('--commit')

if (!input) { console.error('用法：node _tools_import/ladder_expiry.cjs <檔案> [--commit]'); process.exit(1) }
if (!fs.existsSync(input)) { console.error('找不到檔案:', input); process.exit(1) }

// 最後訂購日(YYYY/MM/DD) → { expiry: 最後訂購日+1年(取月 YYYYMM), lastOrderMonth: 最後訂購月 }
function parseRow(ln) {
  const idm = ln.match(/\[([A-Za-z]\d{3,9})\]/)
  if (!idm) return null
  const dateCells = [...ln.matchAll(/\[(\d{4})\/(\d{1,2})\/(\d{1,2})\]/g)]
  if (!dateCells.length) return null
  const last = dateCells[dateCells.length - 1]   // 最後一個日期欄 = 最後訂購日
  const y = +last[1], mo = +last[2]
  if (y < 2000) return null
  return { id: idm[1], expiry: (y + 1) * 100 + mo, lastOrderMonth: y * 100 + mo }
}

async function real() {
  const app = initializeApp({ credential: cert(require(path.resolve(KEY))) }, 'uvaco-ladder')
  const db = getFirestore(app)
  const membersCol = db.collection('uv_members')
  const text = fs.readFileSync(input, 'utf8')

  const plan = new Map()
  let parsedRows = 0
  text.split(/\r?\n/).forEach(ln => {
    const t = ln.trim()
    if (!t) return
    const r = parseRow(t)
    if (r) { plan.set(r.id, { expiry: r.expiry, lastOrderMonth: r.lastOrderMonth }); parsedRows++ }
  })

  const sn = await membersCol.get()
  const updates = []
  sn.forEach(doc => {
    const cur = plan.get(doc.id)
    if (cur) updates.push({ id: doc.id, doc: doc.data(), ...cur })
  })

  console.log(`階梯表解析資料行：${parsedRows} | 比對 db 成功：${updates.length} 人`)

  const dist = {}
  updates.forEach(u => { dist[u.expiry] = (dist[u.expiry] || 0) + 1 })
  const keys = Object.keys(dist).map(Number).sort((a, b) => a - b)
  console.log(`不同到期月數：${keys.length}（${keys[0]} ~ ${keys[keys.length - 1]}）`)

  const now = 202609
  const expired = updates.filter(u => u.expiry < now).length
  console.log(`到期月早於 202609（已過期）：${expired} 人`)

  if (!commit) {
    console.log('\n乾跑完成（未寫入）。欲真正寫入請加 --commit')
    keys.forEach(k => console.log(`  ${k} : ${dist[k]} 人`))
    return
  }

  const batch = db.batch()
  let n = 0
  for (const u of updates) {
    batch.set(membersCol.doc(u.id), {
      expiry: u.expiry,
      lastOrderMonth: u.lastOrderMonth,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true })
    n++
    if (n % 400 === 0) { await batch.commit() }
  }
  if (n % 400 !== 0) await batch.commit()
  console.log(`\n已寫入更新 ${n} 位會員的到期月與最後訂貨月`)
}

real().then(() => process.exit(0)).catch(e => { console.error('失敗:', e); process.exit(1) })