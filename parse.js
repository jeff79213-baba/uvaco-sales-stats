// parse.js — 貼上組織圖文字 → 樹狀成員資料（純函式，供測試）

const NUM_RE = /[0-9,]+/

export function parseNum(s) {
  if (s == null) return 0
  const m = String(s).replace(/,/g, '').match(/^-?\d+/)
  return m ? parseInt(m[0], 10) : 0
}

// 解析單行：00 B082282 林莉雯	翡翠		116	116	3212	1810752
export function parseLine(raw) {
  const cells = raw.split('\t')
  const head = (cells[0] || '').replace(/^[\s.．・、•。]+/, '')
  const headMatch = head.match(/^(\d{1,2})\s*([A-Za-z][A-Za-z0-9]{2,7})?\s*(.*)$/)
  if (!headMatch) return { ok: false }
  const depth = parseInt(headMatch[1], 10)
  const id = headMatch[2] || null
  let name = (headMatch[3] || '').trim()
  if (!name) return { ok: false }
  if (!id) return { ok: false, reason: '缺會員編號', depth }
  const title = (cells[1] || '').trim() || (cells[2] || '').trim()
  return {
    ok: true,
    node: {
      id,
      name,
      title,
      depth,
      personal: parseNum(cells[3]),
      groupSales: parseNum(cells[4]),
      monthGroup: parseNum(cells[5]),
      groupTotal: parseNum(cells[6])
    }
  }
}

function isHeaderLike(line) {
  return /組織關係圖|原職|現職|個人業績|累計/.test(line) && !/^\s*[.．・]*\d{1,2}\s*[A-Za-z]/.test(line)
}

// 整份貼上文字 → 樹狀
export function parseOrgText(text) {
  const nodes = []
  const errors = []
  const lines = String(text || '').split(/\r?\n/)
  lines.forEach((raw, idx) => {
    const line = raw.trim()
    if (!line) return
    if (isHeaderLike(line)) return
    const r = parseLine(line)
    if (!r.ok) {
      errors.push(`第 ${idx + 1} 行無法解析：${line.slice(0, 40)}${line.length > 40 ? '…' : ''}`)
      return
    }
    nodes.push(r.node)
  })

  // 建立 parentId：前面最近、深度少一層的人
  let stack = [] // 每層最近節點
  const roots = []
  for (const node of nodes) {
    while (stack.length > node.depth + 1) stack.pop()
    if (node.depth === 0) {
      node.parentId = null
      roots.push(node.id)
      stack = [node]
    } else {
      if (node.depth > stack.length) {
        // 深度跳太多：沒有對應父層，視為異常但保留
        errors.push(`${node.id} ${node.name} 深度 ${node.depth} 找不到父層（跳層）`)
        node.parentId = stack.length ? stack[stack.length - 1].id : null
        stack.push(node)
      } else {
        node.parentId = stack[node.depth - 1] ? stack[node.depth - 1].id : null
        stack.length = node.depth
        stack.push(node)
      }
    }
  }
  return { nodes, errors, roots }
}