/* ============ Firebase ============ */
// 純函式 parseOrgText / computeExpiry / warningStatus / formatYyyyMm /
// expiryFromOrderMonth 由 parse.js / expiry.js 以 window.* 提供。

firebase.initializeApp({
  apiKey: 'AIzaSyD3quPJCOUoUH_Um5UceWXYuUXfRpJEuyo',
  authDomain: 'opencode-sk.firebaseapp.com',
  projectId: 'opencode-sk'
})
const auth = firebase.auth()
const db = firebase.firestore()
const membersCol = db.collection('uv_members')
const monthsCol = db.collection('uv_months')

const USER_MAP = { '老爺': 'laoye@uvaco.app', '夫人': 'furen@uvaco.app' }

/* ============ 小工具 ============ */
const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const pad2 = n => String(n).padStart(2, '0')
const fmtNum = n => (n || 0).toLocaleString('en-US')
const dep2 = d => String(d).padStart(2, '0')
function todayYyyyMm() {
  const t = new Date()
  return `${t.getFullYear()}${pad2(t.getMonth() + 1)}`
}
function normalizeMonth(s) {
  const d = String(s || '').replace(/\D/g, '')
  const v = d.length === 5 ? d.slice(0, 4) + '0' + d.slice(4) : d
  if (v.length !== 6) return todayYyyyMm()
  const y = +v.slice(0, 4)
  const m = +v.slice(4, 6)
  if (y < 2020 || y > 2099 || m < 1 || m > 12) return todayYyyyMm()
  return v
}
function maxYyyyMm(a, b) {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}
function resolveAccount(input) {
  const v = String(input || '').trim()
  if (USER_MAP[v]) return USER_MAP[v]
  if (v.includes('@')) return v
  return null
}

/* ============ 狀態 ============ */
const state = {
  user: null,
  members: new Map(),   // id -> {name,title,depth,parentId,order,expiry,lastOrderMonth}
  months: [],           // [{id, month}] 由大而小
  selectedMonth: null,
  monthData: null,      // 當月快照 { members: {...} }
  preview: null
}

/* ============ 資料載入 ============ */
async function loadAll() {
  await Promise.all([loadMembers(), loadMonths()])
  if (state.months.length) {
    state.selectedMonth = state.months[0].month
    $('monthSelect').value = state.selectedMonth
    await loadMonth(state.selectedMonth)
  }
  renderAll()
}

async function loadMembers() {
  const snap = await membersCol.get()
  state.members = new Map()
  snap.forEach(d => {
    const m = d.data()
    state.members.set(d.id, { parentId: m.parentId || null, ...m })
  })
}

async function loadMonths() {
  const snap = await monthsCol.get()
  const list = []
  snap.forEach(d => {
    const m = d.data()
    list.push({ id: d.id, month: m.month || d.id })
  })
  list.sort((a, b) => (a.month > b.month ? -1 : 1))
  state.months = list
  $('monthSelect').innerHTML = list.map(x => `<option value="${esc(x.month)}">${esc(x.month)}</option>`).join('')
}

async function loadMonth(month) {
  const d = await monthsCol.doc(month).get()
  state.monthData = d.exists ? d.data() : null
}

/* ============ 渲染 ============ */
function renderAll() {
  renderControls()
  renderPyramid()
  renderSalesEditor()
  renderWarnPreview()
}

function renderControls() {
  const noData = !state.months.length
  $('monthSelect').style.opacity = noData ? '0.5' : '1'
}

function orderedMembers() {
  const childMap = new Map()
  for (const m of state.members.values()) {
    const k = m.parentId || null
    if (!childMap.has(k)) childMap.set(k, [])
    childMap.get(k).push(m.id)
  }
  const sortList = list => list.sort((a, b) => (state.members.get(a).order ?? 0) - (state.members.get(b).order ?? 0))
  const out = []
  const roots = sortList(childMap.get(null) || [])
  for (const r of roots) out.push(r)
  // DFS 補齊非根成員（避免根清單漏了 hanging 節點）
  const seen = new Set(out)
  for (let i = 0; i < out.length; i++) {
    const kids = sortList(childMap.get(out[i]) || [])
    for (const k of kids) if (!seen.has(k)) { seen.add(k); out.push(k) }
  }
  // 任何不在樹內（無 parentId 也非根）的補到最後
  for (const id of state.members.keys()) {
    if (!seen.has(id)) { seen.add(id); out.push(id) }
  }
  return out
}

function renderPyramid() {
  const dataMonth = state.selectedMonth
  const monthMem = state.monthData?.members || {}
  const byId = new Map()

  for (const [id, m] of state.members) {
    const mm = monthMem[id] || {}
    const personal = mm.p || 0
    const warn = personal === 0 ? warningStatus(m.expiry, dataMonth) : null
    byId.set(id, {
      ...m, personal,
      warn,
      active: personal > 0 || !!warn,
      groupSales: mm.g || 0,
      monthGroup: mm.hg || 0,
      groupTotal: mm.gt || 0
    })
  }

  const childMap = new Map()
  for (const id of byId.keys()) {
    const k = byId.get(id).parentId || null
    if (!childMap.has(k)) childMap.set(k, [])
    childMap.get(k).push(id)
  }
  for (const list of childMap.values()) {
    list.sort((a, b) => (byId.get(a).order ?? 0) - (byId.get(b).order ?? 0))
  }

  function subtreeVisible(id) {
    const n = byId.get(id)
    if (!n) return false
    if (n.active) return true
    return (childMap.get(id) || []).some(subtreeVisible)
  }

  function renderNode(id, isRoot) {
    const n = byId.get(id)
    const kids = (childMap.get(id) || []).filter(subtreeVisible)
    const el = document.createElement('div')
    if (isRoot) el.className = 'pylon root'
    else el.className = 'pylon'
    if (n.active) {
      const card = document.createElement('div')
      if (n.personal > 0) {
        card.className = 'card'
        card.innerHTML =
          `<span class="gen">${dep2(n.depth)}</span><span class="name">${esc(n.name)}</span>` +
          `<span class="title">[${esc(n.title)}]</span><span class="pf">${fmtNum(n.personal)}</span>`
      } else {
        card.className = 'card warn ' + n.warn
        card.innerHTML =
          `<span class="gen">${dep2(n.depth)}</span><span class="name">${esc(n.name)}</span>` +
          `<span class="expiry">${formatYyyyMm(n.expiry)}</span>`
      }
      card.addEventListener('click', () => showModal(n))
      el.appendChild(card)
    } else {
      const dot = document.createElement('div')
      dot.className = 'dot'
      el.appendChild(dot)
    }
    if (kids.length) {
      const wrap = document.createElement('div')
      wrap.className = 'children'
      for (const k of kids) wrap.appendChild(renderNode(k, false))
      el.appendChild(wrap)
    }
    return el
  }

  const roots = (childMap.get(null) || []).filter(subtreeVisible)
  const box = $('pyramid')
  box.innerHTML = ''
  if (!roots.length) {
    $('pyramidEmpty').classList.remove('hidden')
    return
  }
  $('pyramidEmpty').classList.add('hidden')
  if (roots.length === 1) {
    box.appendChild(renderNode(roots[0], true))
  } else {
    const wrap = document.createElement('div')
    wrap.className = 'children' // 多個頭並排
    for (const r of roots) wrap.appendChild(renderNode(r, true))
    box.appendChild(wrap)
  }
}

function showModal(n) {
  const wc = n.warn ? (n.warn === 'red' ? 'expiry-red' : 'expiry-orange') : ''
  const rows = `
    <tr><td>個人業績</td><td>${fmtNum(n.personal)}</td></tr>
    <tr><td>小組業績</td><td>${fmtNum(n.groupSales)}</td></tr>
    <tr><td>本月整組</td><td>${fmtNum(n.monthGroup)}</td></tr>
    <tr><td>整組累計</td><td>${fmtNum(n.groupTotal)}</td></tr>
    ${n.expiry ? `<tr><td>會員到期</td><td class="${wc}">${formatYyyyMm(n.expiry)}（當月26日取消）</td></tr>` : ''}
    ${n.lastOrderMonth ? `<tr><td>最後訂貨月</td><td>${formatYyyyMm(n.lastOrderMonth)}</td></tr>` : ''}`
  $('modalBody').innerHTML =
    `<h3>${esc(n.name)}</h3><div class="sub">${esc(n.title)} · 第 ${dep2(n.depth)} 代</div>` +
    `<table class="detail-table">${rows}</table>`
  $('modal').classList.remove('hidden')
}

/* ============ 登入 ============ */
$('loginBtn').addEventListener('click', login)
$('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') login() })
$('loginAccount').addEventListener('keydown', e => { if (e.key === 'Enter') login() })

async function login() {
  const errEl = $('loginError')
  errEl.textContent = ''
  const account = resolveAccount($('loginAccount').value)
  if (!account) { errEl.textContent = '請輸入 老爺／夫人，或完整的 Email'; return }
  try {
    await auth.signInWithEmailAndPassword(account, $('loginPassword').value)
  } catch (err) {
    errEl.textContent = '登入失敗：帳號或密碼錯誤'
  }
}

$('logoutBtn').addEventListener('click', () => auth.signOut())

auth.onAuthStateChanged(async user => {
  if (user) {
    state.user = user
    $('whoAmI').textContent = displayName(user.email)
    $('loginView').classList.add('hidden')
    $('mainView').classList.remove('hidden')
    $('pyramidEmpty').classList.add('hidden')
    try {
      await loadAll()
    } catch (err) {
      console.error(err)
      $('pyramidEmpty').textContent = '讀取資料失敗：' + err.message
      $('pyramidEmpty').classList.remove('hidden')
    }
  } else {
    state.user = null
    $('loginView').classList.remove('hidden')
    $('mainView').classList.add('hidden')
  }
})

function displayName(email) {
  for (const [k, v] of Object.entries(USER_MAP)) if (v === email) return k
  return email
}

/* ============ 月份切換 / 分頁 ============ */
$('monthSelect').addEventListener('change', async e => {
  state.selectedMonth = e.target.value
  $('importMonth').value = state.selectedMonth
  await loadMonth(state.selectedMonth)
  renderPyramid()
  renderSalesEditor()
  renderWarnPreview()
})

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    $('pyramidTab').classList.toggle('hidden', btn.dataset.tab !== 'pyramid')
    $('adminTab').classList.toggle('hidden', btn.dataset.tab !== 'admin')
  })
})

/* ============ 後台：貼上匯入 ============ */
$('parseBtn').addEventListener('click', () => {
  const month = normalizeMonth($('importMonth').value)
  $('importMonth').value = month
  const res = parseOrgText($('importText').value)
  state.preview = { month, res }
  const first = res.nodes.slice(0, 5).map(n => `${dep2(n.depth)}${n.name}`).join('、')
  const errHtml = res.errors.map(e => `<div class="err">⚠ ${esc(e)}</div>`).join('')
  $('parseResult').innerHTML =
    `<div class="summary"><b>月份 ${month}</b>　共 ${res.nodes.length} 人、根 ${res.roots.length} 個<br>` +
    `開頭：${esc(first)}${first ? '…' : ''}${errHtml}</div>`
  $('importBtn').disabled = res.nodes.length === 0
})

$('importBtn').addEventListener('click', async () => {
  if (!state.preview) return
  const { month, res } = state.preview
  const ok = confirm(
    `確定匯入 ${month} 嗎？\n${res.nodes.length} 人。\n這份值將覆蓋該月份個人業績（含手動輸入），以「整份貼上」為準。`
  )
  if (!ok) return

  const batch = db.batch()
  const membersMap = {}
  for (const n of res.nodes) membersMap[n.id] = { p: n.personal, g: n.groupSales, hg: n.monthGroup, gt: n.groupTotal }
  batch.set(monthsCol.doc(month), {
    month,
    members: membersMap,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true })

  res.nodes.forEach((n, idx) => {
    const cur = state.members.get(n.id)
    const expiry = computeExpiry({
      storedExpiry: cur?.expiry || null,
      personal: n.personal,
      dataMonth: month,
      todayYyyyMm: todayYyyyMm()
    })
    let lastOrderMonth = cur?.lastOrderMonth || null
    if (n.personal > 0) lastOrderMonth = maxYyyyMm(lastOrderMonth, month)
    batch.set(membersCol.doc(n.id), {
      name: n.name, title: n.title, depth: n.depth, parentId: n.parentId,
      order: idx, expiry, lastOrderMonth
    }, { merge: true })
  })

  await batch.commit()
  await Promise.all([loadMembers(), loadMonth(month)])
  state.selectedMonth = month
  $('monthSelect').value = month
  if (!state.months.some(x => x.month === month)) {
    await loadMonths()
    $('monthSelect').value = state.selectedMonth
  }
  renderAll()
  $('parseResult').innerHTML = `<div class="summary"><b>✅ 已匯入 ${month}（${res.nodes.length} 人）</b></div>`
  $('importBtn').disabled = true
})

/* ============ 後台：手動編輯個人業績 ============ */
function renderSalesEditor() {
  const monthMem = state.monthData?.members || {}
  const box = $('salesEditor')
  box.innerHTML = ''
  if (!state.members.size) { box.textContent = '（尚無成員資料）'; return }
  const q = ($('salesSearch').value || '').trim().toLowerCase()
  for (const id of orderedMembers()) {
    const m = state.members.get(id)
    if (q && !(m.name.toLowerCase().includes(q) || id.toLowerCase().includes(q))) continue
    const row = document.createElement('div')
    row.className = 'sed-row'
    row.innerHTML =
      `<span class="gen">${dep2(m.depth)}</span><span class="name">${esc(m.name)}</span>` +
      `<span class="title">[${esc(m.title)}]</span>`
    const inp = document.createElement('input')
    inp.type = 'number'
    inp.min = '0'
    inp.step = '1'
    inp.dataset.id = id
    inp.value = monthMem[id]?.p || 0
    row.appendChild(inp)
    box.appendChild(row)
  }
}

$('salesSearch').addEventListener('input', renderSalesEditor)

$('saveSalesBtn').addEventListener('click', async () => {
  if (!state.selectedMonth) return
  const inputs = document.querySelectorAll('.sed-row input[data-id]')
  const members = { ...(state.monthData?.members || {}) }
  let changed = 0
  for (const inp of inputs) {
    const id = inp.dataset.id
    const v = Math.max(0, parseInt(inp.value, 10) || 0)
    const prev = members[id] || {}
    if ((prev.p || 0) !== v) { members[id] = { ...prev, p: v }; changed++ }
  }
  await monthsCol.doc(state.selectedMonth).set({ members }, { merge: true })
  await loadMonth(state.selectedMonth)
  renderPyramid()
  const msg = $('salesSaveMsg')
  msg.className = 'msg ok'
  msg.textContent = `✅ 已儲存 ${state.selectedMonth}（變更 ${changed} 位）。注意：下次整份貼上會以貼上值覆蓋。`
})

/* ============ 後台：最後訂貨／到期匯入 ============ */
$('orderImportBtn').addEventListener('click', async () => {
  const lines = $('orderImportText').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const batch = db.batch()
  const matched = []
  const unmatched = []

  for (const line of lines) {
    const mm = line.match(/(20\d{2})[\/\.\-年]?\s*(0?[1-9]|1[0-2])/)
    if (!mm) { unmatched.push(`${line} → 找不到訂貨月`); continue }
    const orderMonth = mm[1] + pad2(mm[2])
    const idm = line.match(/[A-Za-z]\d{3,7}/)
    const nameM = line.match(/[\u4e00-\u9fff]{2,8}/)
    let member = idm ? state.members.get(idm[0]) : null
    if (!member && nameM) {
      for (const m of state.members.values()) {
        if (m.name === nameM[0]) { member = m; break }
      }
    }
    if (!member) {
      const key = idm ? idm[0] : (nameM ? nameM[0] : line)
      unmatched.push(`${line} → 找不到會員 ${key}`)
      continue
    }
    const lastOrderMonth = maxYyyyMm(member.lastOrderMonth || null, orderMonth)
    const expiry = expiryFromOrderMonth(lastOrderMonth)
    batch.set(membersCol.doc(member.id), { expiry, lastOrderMonth }, { merge: true })
    matched.push(`${member.name} → 到期 ${formatYyyyMm(expiry)}（最後訂貨 ${formatYyyyMm(lastOrderMonth)}）`)
  }

  await batch.commit()
  await loadMembers()
  const unHtml = unmatched.length ? `<div class="err">⚠ 無法比對 ${unmatched.length} 筆：<br>${esc(unmatched.join('<br>'))}</div>` : ''
  $('orderImportResult').className = 'msg ok'
  $('orderImportResult').innerHTML =
    `✅ 已更新 ${matched.length} 位${unHtml ? '<br>' + unHtml : ''}`
  renderPyramid()
  renderWarnPreview()
})

/* ============ 後台：到期警示預覽 ============ */
function renderWarnPreview() {
  const box = $('warnPreview')
  const monthMem = state.monthData?.members || {}
  const list = []
  for (const [id, m] of state.members) {
    const mm = monthMem[id]
    if (mm && (mm.p || 0) > 0) continue // 有訂貨已順延
    const w = warningStatus(m.expiry, state.selectedMonth)
    if (!w) continue
    list.push({ id, m, w })
  }
  list.sort((a, b) => (a.w === b.w ? 0 : a.w === 'red' ? -1 : 1))
  if (!list.length) { box.innerHTML = '<p class="hint">目前沒有到期警示。</p>'; return }
  box.innerHTML = '<ul class="warn-list">' + list.map(x =>
    `<li><span class="badge ${x.w}">${x.w === 'red' ? '最後1個月' : '剩2個月'}</span>` +
    `<span class="name">${esc(x.m.name)}</span> [${esc(x.m.title)}]　` +
    `<b>${formatYyyyMm(x.m.expiry)}</b></li>`).join('') + '</ul>'
}

/* ============ 彈窗 ============ */
$('modalClose').addEventListener('click', () => $('modal').classList.add('hidden'))
$('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').classList.add('hidden') })

/* ============ 密碼顯示開關 ============ */
document.querySelector('.pw-toggle').addEventListener('click', e => {
  const inp = $('loginPassword')
  const show = inp.type === 'password'
  inp.type = show ? 'text' : 'password'
  e.currentTarget.innerHTML = show
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
})