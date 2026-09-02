// 建立 uvaco 兩個管理員登入帳號（一次性設定）
// 用法：node _setup/create_users.cjs [serviceKeyPath]
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const path = require('path')

const keyPath = process.env.UVACO_KEY || process.argv[2] ||
  path.resolve(__dirname, '..', '..', 'opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json')

let app
try {
  app = initializeApp({ credential: cert(require(path.resolve(keyPath))) })
} catch (e) {
  app = initializeApp({ credential: applicationDefault() })
}
const auth = getAuth(app)

const users = [
  { email: 'laoye@uvaco.app', password: '511328', name: '老爺' },
  { email: 'furen@uvaco.app', password: '511328', name: '夫人' }
]

async function main() {
  for (const u of users) {
    try {
      const rec = await auth.getUserByEmail(u.email)
      console.log(`${u.name} ${u.email} 已存在 uid=${rec.uid}`)
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        const rec = await auth.createUser({ email: u.email, password: u.password, displayName: u.name })
        console.log(`建立 ${u.name} ${u.email} uid=${rec.uid}`)
      } else {
        throw e
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })