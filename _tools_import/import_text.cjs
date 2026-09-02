// 貼上格式匯入 Firestore（admin SDK，繞過 Security Rules）
// 用法：node _tools_import/import_text.cjs <組織文字檔路徑> [月份YYYYMM，預設當月]
const path = require('path')
const fs = require('fs')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const KEY = process.env.UVACO_KEY || 'C:/Users/TW-10/Documents/firebase雲端資料夾/opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json'
const input = process.argv[2]
const month = process.argv[3] || '202609'

if (!input) { console.error('用法：node _tools_import/import_text.cjs <檔案> [月份]'); process.exit(1) }
if (!fs.existsSync(input)) { console.error('找不到檔案:', input); process.exit(1) }

async function real() {
  const { parseOrgText } = await import('../parse.js')
  const { computeExpiry } = await import('../expiry.js')

  const app = initializeApp({ credential: cert(require(path.resolve(KEY))) }, 'uvaco-import')
  const db = getFirestore(app)
  const membersCol = db.collection('uv_members')
  const monthsCol = db.collection('uv_months')

  const text = fs.readFileSync(input, 'utf8')
  const res = parseOrgText(text)
  console.log('解析：', res.nodes.length, '人 / 根', res.roots.length, '/ 錯誤', res.errors.length)
  res.errors.slice(0, 10).forEach(x => console.log('  ERR', x))
  if (!res.nodes.length) { console.error('無資料，中止'); process.exit(1) }

  const active = res.nodes.filter(n => n.personal > 0)
  console.log('有個人業績：', active.length)

  const batch = db.batch()
  const membersMap = {}
  res.nodes.forEach((n, idx) => {
    membersMap[n.id] = { p: n.personal, g: n.groupSales, hg: n.monthGroup, gt: n.groupTotal }
    const expiry = computeExpiry({ storedExpiry: null, personal: n.personal, dataMonth: month, todayYyyyMm: month })
    const lastOrderMonth = n.personal > 0 ? month : null
    batch.set(membersCol.doc(n.id), {
      name: n.name, title: n.title, depth: n.depth, parentId: n.parentId,
      order: idx, expiry, lastOrderMonth
    }, { merge: true })
  })
  batch.set(monthsCol.doc(month), { month, members: membersMap, updatedAt: FieldValue.serverTimestamp() }, { merge: true })

  await batch.commit()
  console.log('已寫入 uv_members + uv_months/' + month)
}

real().then(() => process.exit(0)).catch(e => { console.error('失敗:', e.message); process.exit(1) })