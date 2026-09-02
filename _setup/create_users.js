// 建立 uvaco 兩個管理員登入帳號（一次性設定）
// 用法：node _setup/create_users.js [serviceKeyPath]
// 需要 firebase-admin；以 NODE_PATH 指向主目錄 node_modules 執行
const admin = require('firebase-admin')
const path = require('path')

const keyPath = process.env.UVACO_KEY || process.argv[2] ||
  'C:/Users/TW-10/Documents/firebase雲端資料夾/opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json'

const users = [
  { email: 'laoye@uvaco.app', password: '511328', name: '老爺' },
  { email: 'furen@uvaco.app', password: '511328', name: '夫人' }
]

admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyPath))) })

async function main() {
  for (const u of users) {
    try {
      const rec = await admin.auth().getUserByEmail(u.email)
      console.log(`${u.name} ${u.email} 已存在 uid=${rec.uid}`)
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        const rec = await admin.auth().createUser({ email: u.email, password: u.password, displayName: u.name })
        console.log(`建立 ${u.name} ${u.email} uid=${rec.uid}`)
      } else {
        throw e
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })