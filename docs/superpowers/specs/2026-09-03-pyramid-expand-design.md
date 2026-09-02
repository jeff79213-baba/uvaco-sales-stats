# 設計規格：金字塔可展開第一代 + 去除重複 + 後台個人業績編輯
日期：2026-09-03
狀態：已定案（使用者指示「寫規格 直接實作」）

---

## 一、需求背景
1. 進入頁面整個金字塔拉得太長，需一直往下滾才看得到下面。
2. 使用者要：進入頁面只看到「根（林莉雯）＋第一代（01 成員）」，點某第一代才往下展開該人的後代。
3. 中間沒有業績/到期的隔代節點，不要佔一整格。
4. 樹狀圖出現重複的組織（某些節點被重複畫出）。
5. 後台要能更改個人業績（修正輸入錯誤）——此功能已於先前實作（autocomplete 選人＋單人存入），本次需確認與修正既有缺陷。

---

## 二、功能規格

### A. 金字塔：受控展開（預設根＋第一代，點開往下）

**狀態**
- 新增 `state.expandedId`（單一展開中第一代成員的 id，預設 null）。
- 一次只展開一個 01；點開另一個 → 切換；再點同一個 → 收起（null）。

**`renderPyramid()` 重構**
- roots 組裝（第 210-212 行）改為：**根＋全部 depth-1**（不再混入 activeOrPath）。
  ```js
  const allDepth1 = [...byId.keys()].filter(id => byId.get(id).depth === 1)
  const roots = allDepth1
  ```
- `renderNode(id, isRoot)` 遞迴時，**只有「展開中節點」才往下畫子樹**：
  - 若 `n.id === state.expandedId`：往下畫 `kids`（維持 `active || childHasActive` 的 `subtreeVisible` 過濾），被動祖先為小點。
  - 否則（第一代未展開）：不畫 `kids`。
  - 根（depth 0）預設畫出所有 depth-1 孩子（因為 roots 就是全 depth-1，根是容器，不需 hidden）。

**節點樣式（配合「不佔一整格」）**
- 第一代（01）卡：**小窄卡** `card firstgen`（姓名＋原職，有業績時顯示數字 + 展開箭頭 ▸/▾）。
- 展開後的有感節點：小窄卡 `card`（代數＋姓名＋原職＋個人業績或到期月）。
- 被動中間節點：小圓點 `.dot`（維持，且 `.children` 間距壓縮，`gap` 縮小、`margin/padding` 縮小）。

**展開切換**
- 01 卡 click → `state.expandedId = (state.expandedId === id) ? null : id` → `renderPyramid()`。
- 卡上加 `data-expanded`／class 標示目前展開哪個。

### B. 去除樹狀重複組織
- 避免同節點被 `activeOrPath` 與 `allDepth1` 重複加入 roots（改用單一來源 `allDepth1`）。
- 在 `renderNode` 遞迴時以 `Set` 追蹤已訪問節點，拒絕重複渲染同一 id（防 hanging/重複 parentId 造成的重複）。
- `state.members` 中 id 為 `null` 的雜訊節點已於先前過濾（`if (!id) continue`），本次於遞迴亦加保護。

### C. 後台個人業績編輯（修正既有缺陷）
- 修正 `renderAll()`（第 99 行）與月份切換（第 296 行）呼叫已刪除的 `renderSalesEditor()` 造成的 ReferenceError：
  - 將 `renderSalesEditor()` 改為 `renderSuggestions()`（自動重新對齊建議清單）。
- 既有 autocomplete 選人＋單人存入（`showManualCard`/`saveManual`）保留，作為「更改個人業績」功能。

---

## 三、驗收條件（重點）
1. 進入頁面金字塔只顯示根＋所有第一代；不再往下長。
2. 點某第一代卡 → 該人在原樹下方展開有感子樹（有業績/到期者為小卡，隔代為小點）；其他第一代不展開。
3. 再點同一張卡收起；點另一張切換。
4. 無重複的組織節點。
5. 後台輸入姓氏/編號 → 建議清單 → 選人 → 存入個人業績成功，且月份切換不再報錯。
6. 22 個單元測試全過。

---

## 四、已確認決策
- 預設只顯示根＋第一代。
- 點第一代才往下展開（原樹往下）。
- 被動隔代＝小圓點（不佔一整格）。
- 有感節點＝小窄卡一排。
- 一次只展開一個。
