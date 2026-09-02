// 抓取現行 Firestore rules → 合併 uv_ 集合 → 輸出合併後檔案（供 firebase deploy --only firestore:rules 使用）
// 用法：node _setup/sync_rules.cjs [serviceKeyPath] [輸出路徑]
const { JWT } = require('google-auth-library')
const path = require('path')
const fs = require('fs')

const keyPath = process.env.UVACO_KEY || process.argv[2] ||
  path.resolve(__dirname, '..', '..', 'opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json')
const outPath = process.argv[3] ||
  'C:/Users/TW-10/AppData/Local/Temp/opencode/merged_firestore.rules'
const PROJECT = 'opencode-sk'
const BASE = 'https://firebaserules.googleapis.com/v1'

const OUR_RULES = `
    // ===== 葡眾業績統計（uvaco）=====
    function isUvacoUser() {
      return request.auth != null
        && (request.auth.token.email in ['laoye@uvaco.app', 'furen@uvaco.app']
            || request.auth.uid in ['AiYX2xARkAVQbaCVznKKvv2REX03', 'jkhOnw7BJbPJpAWJbWEWojnOUif2']);
    }
    match /uv_members/{docId} {
      allow read, write: if isUvacoUser();
    }
    match /uv_months/{docId} {
      allow read, write: if isUvacoUser();
    }
`

async function main() {
  const key = require(path.resolve(keyPath))
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  })
  const token = await client.authorize()
  const auth = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }

  const rel = await fetch(`${BASE}/projects/${PROJECT}/releases/cloud.firestore`, { headers: auth }).then(r => r.json())
  if (!rel.rulesetName) throw new Error('無法取得 release: ' + JSON.stringify(rel).slice(0, 300))
  console.log('現行 ruleset:', rel.rulesetName)

  const rs = await fetch(`${BASE}/${rel.rulesetName}`, { headers: auth }).then(r => r.json())
  const content = rs.source && rs.source.files && rs.source.files[0] ? rs.source.files[0].content : ''
  if (!content) throw new Error('無法取得現行規則內容')

  let merged = content
  const MARK = '// ===== 葡眾業績統計（uvaco）====='
  const start = content.indexOf(MARK)
  if (start >= 0) {
    // 找到既有 uv_ 區塊並移除（從 MARK 到 uv_months 區塊右大括號）
    const monIdx = content.indexOf('match /uv_months/{docId} {', start)
    if (monIdx >= 0) {
      const brace = content.indexOf('{', monIdx)
      let depth = 1
      let i = brace + 1
      for (; i < content.length && depth > 0; i++) {
        if (content[i] === '{') depth++
        else if (content[i] === '}') depth--
      }
      // 移除「MARK 前幾行新增的換行」與該區塊，再重新插入新版
      merged = content.slice(0, start).trimEnd() + '\n' + content.slice(i).trimStart()
      console.log('取代既有 uv_ 區塊。')
    }
  }
  if (!merged.includes('/uv_members/')) {
    const trimmed = merged.trimEnd()
    if (!trimmed.endsWith('}')) throw new Error('規則內容格式異常，無法合併')
    merged = trimmed.slice(0, -1) + OUR_RULES + '}'
    console.log('已合併 uv_ 規則。')
  } else {
    console.log('uv_members 已存在。')
  }
  fs.writeFileSync(outPath, merged, 'utf8')
  console.log('合併後規則 →', outPath)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })