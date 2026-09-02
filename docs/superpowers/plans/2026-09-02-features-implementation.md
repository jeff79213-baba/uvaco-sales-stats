# 個人業績手動編輯（提示選人）＋ 01 層全顯示 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改善後台個人業績手動編輯的體驗（autocomplete 提示選人＋單人存入卡片），並讓金字塔第一線（01 層）始終顯示所有成員。

**Architecture:** 所有改動集中在 `app.js`（JS 邏輯）＋ `index.html`（DOM 結構）兩個檔案。測試集中在 `tests/expiry.test.js`。無新檔案。

**Tech Stack:** 原生 JS（ES modules on browser via `<script type="module">`）、Firestore SDK v8（compat）、Vitest（單元測試）。

## Global Constraints
- 無外部套件（不新增 CDN 或 npm dependency）
- 日期規則：有個人業績>0 → 到期日 = 資料月+12 個月（例如 202609→202709）
- `uv_members/{id}` 欄位：`name, title, depth, parentId, order, expiry, lastOrderMonth`
- `uv_months/{month}.members.{id}` 欄位：`p, g, hg, gt`
- 測試指令：`npx vitest run`（從專案根目錄）

---

## Task 1：金字塔 01 層全顯示

**Files:**
- Modify: `app.js:132-201`（`renderPyramid` 函數）
- Test: 手動瀏覽器驗證（金字塔 CDP 腳本）

**Interfaces:**
- Consumes: `state.members`, `state.monthData`, `warningStatus()`
- Produces: `$('pyramid')` DOM（所有 depth-1 成員始終為 `.card`）

- [ ] **Step 1：修改 renderPyramid 的 roots 組裝邏輯**

在 `app.js` 的 `renderPyramid()` 第 203 行（`const roots = ...`）前插入：把所有 depth===1 的 id 加入 roots（原本是 `.filter(subtreeVisible)`，改成無條件加入 depth-1）。

```javascript
// 修改第 203 行
const allDepth1 = [...byId.keys()].filter(id => byId.get(id).depth === 1)
const activeOrPath = (childMap.get(null) || []).filter(subtreeVisible)
const roots = [...new Set([...activeOrPath, ...allDepth1])]
```

- [ ] **Step 2：修改 renderNode，depth-1 強制顯示為卡片**

在 `renderNode` 函數（第 168 行）中，將 `if (n.active)` 改為 `if (n.active || n.depth === 1)`：

```javascript
// 第 174 行
if (n.active || n.depth === 1) {
```

且 depth-1 無業績者顯示為淡色卡（不顯示個人業績數字）：

```javascript
// 第 176 行改為
if (n.personal > 0) {
  card.className = 'card'
  card.innerHTML =
    `<span class="gen">${dep2(n.depth)}</span><span class="name">${esc(n.name)}</span>` +
    `<span class="title">[${esc(n.title)}]</span><span class="pf">${fmtNum(n.personal)}</span>`
} else {
  card.className = 'card faded'
  card.innerHTML =
    `<span class="gen">${dep2(n.depth)}</span><span class="name">${esc(n.name)}</span>` +
    `<span class="title">[${esc(n.title)}]</span>`
}
```

- [ ] **Step 3：用 CDP 腳本驗證瀏覽器**

執行 `cdp_pyrcards.mjs`（已存在於 temp）確認：
- 01 層全部 depth-1 成員皆為 `.card`
- 有業績者 `.pf` 有數字
- 無業績者 `.card.faded`

```powershell
node "C:\Users\TW-10\AppData\Local\Temp\opencode\cdp_pyrcards.mjs" 2>&1
```

確認 `CARDS` 輸出包含所有 7 位 01 成員（陳育慧、周依潔、劉高美、黃芹足、林柏丞、徐于善、洪暉琇），且陳育慧有 `(192)` 數字，其他人無。

- [ ] **Step 4：Commit**

```bash
git add app.js
git commit -m "金字塔01層全顯示：所有第一線成員始終可見"
```

---

## Task 2：後台手動編輯 DOM 結構（index.html）

**Files:**
- Modify: `index.html`（後台面板的手動編輯區塊）

**Interfaces:**
- Consumes: 無（純 DOM 變更）
- Produces: `#manualSearch`（搜尋欄）、`#manualSuggestions`（建議清單容器）、`#manualCard`（操作卡片容器）

- [ ] **Step 1：找到 index.html 中手動編輯區塊**

搜尋 `id="salesSearch"`，找到該 `<input>` 及其父容器 `<div id="salesEditor">`、按鈕 `#saveSalesBtn` 等，記錄完整的 HTML 結構。

- [ ] **Step 2：替換為新的 DOM 結構**

將原本的 `salesSearch`（純文字輸入）＋ `salesEditor`（全列表容器）＋ `saveSalesBtn` 替換為以下結構：

```html
<div id="manualSection">
  <label>個人業績手動編輯</label>
  <input type="text" id="manualSearch" placeholder="搜尋姓名或編號…" autocomplete="off">
  <div id="manualSuggestions" class="suggestions-list"></div>
  <div id="manualCard" class="manual-card hidden"></div>
  <p id="manualSaveMsg" class="msg hidden"></p>
  <button id="saveSalesBtn" class="btn hidden">儲存全部</button>
</div>
```

- [ ] **Step 3：加入 CSS 樣式**

在 `<style>` 區塊中加入 `.suggestions-list` 和 `.manual-card` 樣式：

```css
.suggestions-list { max-height:200px; overflow-y:auto; border:1px solid #d0d0d0; border-radius:6px; margin-top:4px; display:none }
.suggestions-list .sug-item { padding:8px 12px; cursor:pointer; font-size:14px; border-bottom:1px solid #eee }
.suggestions-list .sug-item:last-child { border-bottom:none }
.suggestions-list .sug-item:hover { background:#e8f0fe }
.manual-card { background:#f8f9fa; border:1px solid #d0d0d0; border-radius:8px; padding:12px; margin-top:8px }
.manual-card .mc-name { font-weight:bold }
.manual-card .mc-cur { color:#666; margin:8px 0 }
.manual-card input[type=number] { width:80px; padding:4px 8px; border:1px solid #bbb; border-radius:4px }
.manual-card .mc-actions { margin-top:8px }
```

- [ ] **Step 4：Commit**

```bash
git add index.html
git commit -m "後台手動編輯區改為 autocomplete+卡片結構"
```

---

## Task 3：實作 autocomplete 提示清單（app.js）

**Files:**
- Modify: `app.js`（手動編輯區塊，第 360 行起的 `/* 後台：手動編輯個人業績 */` 區段）

**Interfaces:**
- Consumes: `state.members`、`orderedMembers()`（已存在）
- Produces: `#manualSuggestions` 清單渲染、`#manualCard` 顯示選中成員

- [ ] **Step 1：清空舊的手動編輯程式碼**

移除 `app.js` 中第 360-405 行（`renderSalesEditor`、`salesSearch` listener、`saveSalesBtn` listener），替換為以下新邏輯。

- [ ] **Step 2：實作 renderSuggestions()**

```javascript
/* ============ 後台：手動編輯個人業績（autocomplete） ============ */
function renderSuggestions() {
  const q = ($('manualSearch').value || '').trim().toLowerCase()
  const box = $('manualSuggestions')
  box.innerHTML = ''
  if (!q || !state.members.size) { box.style.display = 'none'; return }
  const matches = []
  for (const id of orderedMembers()) {
    const m = state.members.get(id)
    if (m.name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
      matches.push({ id, m })
      if (matches.length >= 10) break
    }
  }
  if (!matches.length) { box.style.display = 'none'; return }
  for (const { id, m } of matches) {
    const div = document.createElement('div')
    div.className = 'sug-item'
    div.textContent = `${dep2(m.depth)} ${id} ${m.name} [${m.title}]`
    div.addEventListener('click', () => showManualCard(id))
    box.appendChild(div)
  }
  box.style.display = 'block'
}
```

- [ ] **Step 3：實作 showManualCard(id)**

```javascript
function showManualCard(id) {
  const m = state.members.get(id)
  if (!m) return
  const monthMem = state.monthData?.members || {}
  const curP = monthMem[id]?.p || 0
  const card = $('manualCard')
  card.innerHTML =
    `<div class="mc-name">${dep2(m.depth)} ${id} ${esc(m.name)} [${esc(m.title)}]</div>` +
    `<div class="mc-cur">本月目前個人業績：<b>${fmtNum(curP)}</b></div>` +
    `<input type="number" id="manualValue" min="0" step="1" value="${curP}">` +
    `<div class="mc-actions">` +
    `<button id="manualSaveBtn" class="btn btn-primary">存入</button> ` +
    `<button id="manualCancelBtn" class="btn">取消</button></div>` +
    `<p id="manualCardMsg" class="msg hidden"></p>`
  card.classList.remove('hidden')
  $('manualSuggestions').style.display = 'none'
  $('manualSearch').value = ''
  $('manualSaveBtn').addEventListener('click', () => saveManual(id))
  $('manualCancelBtn').addEventListener('click', () => card.classList.add('hidden'))
}
```

- [ ] **Step 4：實作 saveManual(id)**

```javascript
async function saveManual(id) {
  const month = state.selectedMonth
  if (!month) return
  const v = Math.max(0, parseInt($('manualValue').value, 10) || 0)
  const members = { ...(state.monthData?.members || {}) }
  const prev = members[id] || {}
  const wasZero = (prev.p || 0) === 0
  members[id] = { ...prev, p: v }
  await monthsCol.doc(month).set({ members }, { merge: true })
  // 若 p 從 0→>0，同步順延到期日
  if (wasZero && v > 0) {
    const expiry = computeExpiry({ storedExpiry: null, personal: v, dataMonth: month, todayYyyyMm: month })
    await membersCol.doc(id).set({ expiry, lastOrderMonth: month }, { merge: true })
  }
  await loadMonth(month)
  renderPyramid()
  const msg = $('manualCardMsg')
  msg.className = 'msg ok'
  msg.textContent = `✅ 已儲存 ${state.members.get(id)?.name || id} ${month}（${v}）`
  setTimeout(() => $('manualCard').classList.add('hidden'), 2000)
}
```

- [ ] **Step 5：接上事件監聽**

```javascript
$('manualSearch').addEventListener('input', renderSuggestions)
```

- [ ] **Step 6：Commit**

```bash
git add app.js
git commit -m "實作 autocomplete 提示選人 + 單人存入卡片"
```

---

## Task 4：測試 computeExpiry 手動觸發場景

**Files:**
- Modify: `tests/expiry.test.js`

**Interfaces:**
- Consumes: `computeExpiry`（已 export）
- Produces: 新增測試案例驗證：`storedExpiry=null, personal>0, dataMonth` → 結果 = dataMonth + 12 個月

- [ ] **Step 1：加入新測試案例**

在 `tests/expiry.test.js` 末尾（`})` 前）加入：

```javascript
it('storedExpiry=null 且有業績 → dataMonth+12（手動輸入觸發）', () => {
  const result = computeExpiry({ storedExpiry: null, personal: 100, dataMonth: '202609', todayYyyyMm: '202609' })
  expect(result).toBe('202709')
})
```

- [ ] **Step 2：執行測試**

```powershell
npx vitest run
```

確認全部 22 個測試通過（原 21 + 新增 1）。

- [ ] **Step 3：Commit**

```bash
git add tests/expiry.test.js
git commit -m "測試：storedExpiry=null+有業績觸發手動順延場景"
```

---

## Task 5：部署 + 端對端驗證

**Files:**
- 無檔案變更（僅部署與 CDP 驗證）

- [ ] **Step 1：部署 hosting**

```powershell
firebase deploy --only hosting
```

確認輸出含 `Hosting URL: https://uvaco-sk.web.app`。

- [ ] **Step 2：用 CDP 腳本驗證後台手動編輯 UI**

建立並執行以下腳本（放入 temp）：

```javascript
// cdp_manual_test.mjs
const PORT = 9334
const run = async () => {
  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json())
  const page = targets.find(t => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0; const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
  await new Promise(r => ws.onopen = r)
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r && r.result ? r.result.value : undefined }
  await send('Runtime.enable')
  await send('Page.navigate', { url: 'https://uvaco-sk.web.app/' })
  await new Promise(r => setTimeout(r, 7000))
  // 登入老爺（管理員）
  await ev(`(function(){document.getElementById('loginAccount').value='老爺';document.getElementById('loginPassword').value='511328';document.getElementById('loginBtn').click()})()`)
  await new Promise(r => setTimeout(r, 6000))
  // 點後台
  await ev(`document.querySelector('[data-view="admin"]').click()`)
  await new Promise(r => setTimeout(r, 1000))
  // 輸入搜尋
  await ev(`(function(){var s=document.getElementById('manualSearch');s.value='陳';s.dispatchEvent(new Event('input'))})()`)
  await new Promise(r => setTimeout(r, 500))
  // 讀建議清單
  const out = await ev(`JSON.stringify({
    sugVisible: document.getElementById('manualSuggestions').style.display,
    sugCount: document.querySelectorAll('.sug-item').length,
    firstSug: document.querySelector('.sug-item')?.textContent || ''
  })`)
  console.log('MANUAL_TEST', out)
  ws.close(); process.exit()
}
run().catch(e => { console.error(e); process.exit(1) })
```

執行後確認：`sugVisible="block"`、`sugCount>=1`、`firstSug` 含「陳」。

- [ ] **Step 3：Commit（測試腳本不入 repo）**

無需 commit；測試腳本留在 temp 目錄。

---

## Task 6：最終部署與提交

- [ ] **Step 1：執行全部測試**

```powershell
npx vitest run
```

- [ ] **Step 2：執行 lint/typecheck（如有）**

本專案無 lint 設定，跳過。

- [ ] **Step 3：最終 git push**

```powershell
git add -A
git commit -m "feat: 後台手動編輯autocomplete + 金字塔01層全顯示"
git push origin main
```

- [ ] **Step 4：回報完成**

告知使用者：已上傳部署完成，可開 https://uvaco-sk.web.app 查看。
