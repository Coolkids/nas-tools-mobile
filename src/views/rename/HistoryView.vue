<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showLoadingToast } from 'vant'
import {
  getTransferHistory,
  deleteHistory,
  reIdentification,
  restoreHistory,
  type TransferHistoryItem
} from '@/api/rename'
import { mediaDetail } from '@/api/discovery'
import { rmtModeLabel } from '@/utils/rmtMode'

type DelFlag = 'del_source' | 'del_dest' | 'del_all'
interface SheetAction {
  name: string
  key: string
  color?: string
}

const router = useRouter()
const loading = ref(false)
const moreLoading = ref(false)
const hasMore = ref(true)
const items = ref<TransferHistoryItem[]>([])
const page = ref(1)
const keyword = ref('')
const total = ref(0)
// TMDBID -> 海报URL，空字符串表示已查询但无海报
const posters = ref<Record<string, string>>({})

// 操作面板：单条操作 或 批量删除
const showActions = ref(false)
const sheetMode = ref<'single' | 'batch-delete'>('single')
const activeItem = ref<TransferHistoryItem | null>(null)

// 批量模式
const batchMode = ref(false)
const selectedIds = ref<number[]>([])

const selectedItems = computed(() => items.value.filter(i => selectedIds.value.includes(i.ID)))
const allSelected = computed(() => items.value.length > 0 && selectedIds.value.length === items.value.length)

const batchDeleteActions: SheetAction[] = [
  { name: '删除源文件', key: 'del_source', color: '#ee0a24' },
  { name: '删除媒体库文件', key: 'del_dest', color: '#ee0a24' },
  { name: '删除源及媒体库文件', key: 'del_all', color: '#ee0a24' }
]

const singleActions = computed<SheetAction[]>(() => {
  const acts: SheetAction[] = [{ name: '重新识别', key: 'reidentify' }]
  if (activeItem.value && isMoveType(activeItem.value)) {
    acts.push({ name: '恢复源文件', key: 'restore' })
  }
  acts.push(...batchDeleteActions)
  return acts
})

onMounted(() => load(1))

async function load(p: number) {
  const append = p > 1
  if (append) moreLoading.value = true
  else loading.value = true
  try {
    const res = await getTransferHistory({ page: p, keyword: keyword.value })
    if (res.code === 0) {
      const list = res.result || []
      items.value = append ? items.value.concat(list) : list
      total.value = res.total || 0
      page.value = p
      hasMore.value = list.length > 0 && items.value.length < total.value
      loadPosters(list)
    }
  } catch { showToast('加载失败') } finally {
    loading.value = false
    moreLoading.value = false
  }
}

function refresh() {
  load(1)
}

function onLoadMore() {
  if (loading.value || moreLoading.value || !hasMore.value) return
  load(page.value + 1)
}

function loadPosters(list: TransferHistoryItem[]) {
  const tasks = list
    .filter(item => item.TMDBID && !(String(item.TMDBID) in posters.value))
    .map(async item => {
      const key = String(item.TMDBID)
      try {
        const res = await mediaDetail(item.TYPE === '电影' ? 'MOV' : 'TV', key)
        posters.value[key] = res.code === 0 && res.data?.image ? res.data.image : ''
      } catch {
        posters.value[key] = ''
      }
    })
  Promise.allSettled(tasks)
}

function posterUrl(item: TransferHistoryItem): string {
  return item.TMDBID ? posters.value[String(item.TMDBID)] || '' : ''
}

function onPosterError(item: TransferHistoryItem) {
  posters.value[String(item.TMDBID)] = ''
}

function onSearch() {
  items.value = []
  hasMore.value = true
  load(1)
}

function isMoveType(row: TransferHistoryItem) {
  return row.RMT_MODE === 'move' || row.MODE === 'move' || row.SYNC_MODE === 'move'
}

function goToFileManager(destPath: string) {
  if (!destPath) return
  router.push({ name: 'mediafile', query: { path: destPath } })
}

function openActions(item: TransferHistoryItem) {
  activeItem.value = item
  sheetMode.value = 'single'
  showActions.value = true
}

function openBatchDelete() {
  if (selectedItems.value.length === 0) { showToast('请先选择记录'); return }
  sheetMode.value = 'batch-delete'
  showActions.value = true
}

function onSheetSelect(action: SheetAction) {
  showActions.value = false
  if (sheetMode.value === 'batch-delete') {
    remove(action.key as DelFlag, selectedItems.value)
    return
  }
  const item = activeItem.value
  if (!item) return
  if (action.key === 'reidentify') reIdentify([item])
  else if (action.key === 'restore') restore(item)
  else remove(action.key as DelFlag, [item])
}

async function reIdentify(rows: TransferHistoryItem[]) {
  if (rows.length === 0) { showToast('请先选择记录'); return }
  showLoadingToast({ message: '重新识别中...', forbidClick: true, duration: 0 })
  try {
    const res = await reIdentification('history', rows.map(r => r.ID))
    if (res.retcode === 0) showToast(res.retmsg || '转移成功')
    else showToast(res.retmsg || '识别失败')
    exitBatch()
    load(1)
  } catch { showToast('识别失败') }
}

async function remove(flag: DelFlag, rows: TransferHistoryItem[]) {
  if (rows.length === 0) { showToast('请先选择记录'); return }
  const label = flag === 'del_all' ? '源文件及媒体库' : flag === 'del_source' ? '源' : '媒体库'
  const name = rows.map(r => `${r.TITLE} (${r.YEAR}) ${r.SEASON_EPISODE || ''}`).join('、')
  const ok = await showConfirmDialog({
    title: '删除确认',
    message: `${name} 对应${label}文件将被同步删除，是否确认？`
  }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteHistory(flag, rows.map(r => r.ID))
    if (res.code === 0) {
      showToast('删除成功')
      exitBatch()
      load(1)
    } else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

async function restore(row: TransferHistoryItem) {
  const ok = await showConfirmDialog({
    title: '恢复',
    message: `确认恢复 ${row.TITLE} (${row.YEAR}) ${row.SEASON_EPISODE || ''} 的源文件？`
  }).catch(() => false)
  if (!ok) return
  showLoadingToast({ message: '恢复中...', forbidClick: true, duration: 0 })
  try {
    const res = await restoreHistory(row.ID)
    if (res.retcode === 0) showToast(res.retmsg || '恢复成功')
    else showToast(res.retmsg || '恢复失败')
    load(1)
  } catch { showToast('恢复失败') }
}

async function batchRestore() {
  const moveRows = selectedItems.value.filter(isMoveType)
  if (moveRows.length === 0) { showToast('所选记录中没有可恢复的移动类型'); return }
  const name = moveRows.map(r => `${r.TITLE} (${r.YEAR}) ${r.SEASON_EPISODE || ''}`).join('、')
  const ok = await showConfirmDialog({
    title: '批量恢复',
    message: `确认恢复以下 ${moveRows.length} 条记录的源文件？\n${name}`
  }).catch(() => false)
  if (!ok) return
  showLoadingToast({ message: '批量恢复中...', forbidClick: true, duration: 0 })
  try {
    for (const row of moveRows) {
      await restoreHistory(row.ID)
    }
    showToast('批量恢复成功')
    exitBatch()
    load(1)
  } catch { showToast('批量恢复失败') }
}

function toggleBatch() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selectedIds.value = []
}

function exitBatch() {
  batchMode.value = false
  selectedIds.value = []
}

function toggleSelect(item: TransferHistoryItem) {
  const idx = selectedIds.value.indexOf(item.ID)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(item.ID)
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : items.value.map(i => i.ID)
}
</script>

<template>
  <div class="history page" :class="{ 'batch-active': batchMode }">
    <van-search v-model="keyword" placeholder="搜索片名..." @search="onSearch" />

    <div class="toolbar">
      <span class="total-text">共 {{ total }} 条</span>
      <div class="toolbar-right">
        <van-button size="small" plain :type="batchMode ? 'warning' : 'primary'" @click="toggleBatch">
          {{ batchMode ? '退出批量' : '批量操作' }}
        </van-button>
        <van-icon name="replay" class="refresh-icon" @click="refresh" />
      </div>
    </div>

    <van-loading v-if="loading && items.length === 0" size="20" style="padding:40px;text-align:center" />

    <van-empty v-else-if="items.length === 0" description="暂无转移历史" />

    <div v-else class="list">
      <div
        v-for="item in items"
        :key="item.ID"
        class="history-card"
        :class="{ selected: batchMode && selectedIds.includes(item.ID) }"
        @click="batchMode && toggleSelect(item)"
      >
        <div class="card-main">
          <div class="poster-wrap">
            <img
              v-if="posterUrl(item)"
              :src="posterUrl(item)"
              class="poster"
              alt="poster"
              @error="onPosterError(item)"
            />
            <div v-else class="poster placeholder">
              <van-icon name="photo-o" size="24" color="#c8c9cc" />
            </div>
          </div>

          <div class="card-content">
            <div class="card-header">
              <div class="card-title">
                <a v-if="item.TMDBID" :href="`https://www.themoviedb.org/${item.TYPE === '电影' ? 'movie' : 'tv'}/${item.TMDBID}`" target="_blank" class="card-title-link">{{ item.TITLE }}</a>
                <span v-else>{{ item.TITLE }}</span>
                <span v-if="item.YEAR" class="year">({{ item.YEAR }})</span>
              </div>
              <van-checkbox
                v-if="batchMode"
                :model-value="selectedIds.includes(item.ID)"
                shape="square"
                class="select-box"
                @click.stop
                @update:model-value="toggleSelect(item)"
              />
              <van-icon v-else name="ellipsis" class="more-icon" @click.stop="openActions(item)" />
            </div>

            <div class="tags-row">
              <van-tag v-if="item.TYPE === '电影'" size="small" type="primary">电影</van-tag>
              <van-tag v-else-if="item.TYPE === '电视剧'" size="small" type="success">电视剧</van-tag>
              <van-tag v-else-if="item.TYPE === '动漫'" size="small" type="warning">动漫</van-tag>
              <van-tag v-if="item.CATEGORY && item.CATEGORY !== item.TYPE" size="small" plain>{{ item.CATEGORY }}</van-tag>
              <van-tag v-if="item.SEASON_EPISODE" size="small" plain type="warning">{{ item.SEASON_EPISODE }}</van-tag>
              <van-tag v-if="item.RMT_MODE" size="small" plain type="info">{{ rmtModeLabel(item.RMT_MODE) }}</van-tag>
            </div>

            <div class="info-block">
              <div v-if="item.SOURCE_PATH" class="info-line">
                <van-icon name="location-o" class="info-icon" />
                <span class="info-text">{{ item.SOURCE_PATH }}</span>
              </div>
              <div v-if="item.DEST_PATH" class="info-line">
                <van-icon name="flag-o" class="info-icon" />
                <span
                  class="info-text dest-path"
                  :class="{ 'dest-link': !!item.DEST_PATH }"
                  @click.stop="goToFileManager(item.DEST_PATH)"
                >{{ item.DEST_PATH }}</span>
              </div>
            </div>

            <div v-if="item.SOURCE_FILENAME || item.DEST_FILENAME" class="info-block">
              <div v-if="item.SOURCE_FILENAME" class="info-line">
                <van-icon name="description-o" class="info-icon" />
                <span class="info-text">{{ item.SOURCE_FILENAME }}</span>
              </div>
              <div v-if="item.DEST_FILENAME" class="info-line">
                <van-icon name="arrow" class="info-icon" />
                <span class="info-text">{{ item.DEST_FILENAME }}</span>
              </div>
            </div>

            <div class="card-footer">
              <span class="date-text">{{ item.DATE || '' }}</span>
              <span class="footer-info">
                <span v-if="item.SOURCE" class="source-text">来自：{{ item.SOURCE }}</span>
                <span v-if="item.RMT_MODE" class="mode-text">转移方式：{{ rmtModeLabel(item.RMT_MODE) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="hasMore" class="load-more" @click="onLoadMore">
        <van-loading v-if="moreLoading" size="14" />
        <span v-else>点击加载更多</span>
      </div>
      <div v-else class="no-more">没有更多了</div>
    </div>

    <van-action-sheet
      v-model:show="showActions"
      :actions="sheetMode === 'batch-delete' ? batchDeleteActions : singleActions"
      :title="sheetMode === 'batch-delete' ? `批量删除（已选 ${selectedIds.length} 条）` : (activeItem?.TITLE || '')"
      cancel-text="取消"
      close-on-click-action
      @select="onSheetSelect"
    />

    <div v-if="batchMode" class="batch-bar">
      <van-checkbox
        :model-value="allSelected"
        shape="square"
        class="all-box"
        @update:model-value="toggleAll"
      >全选</van-checkbox>
      <span class="sel-count">已选 {{ selectedIds.length }}</span>
      <div class="batch-btns">
        <van-button size="small" plain type="primary" @click="reIdentify(selectedItems)">重新识别</van-button>
        <van-button size="small" plain type="warning" @click="batchRestore">恢复</van-button>
        <van-button size="small" plain type="danger" @click="openBatchDelete">删除</van-button>
      </div>
    </div>

    <van-back-top :bottom="batchMode ? 120 : 70" />
  </div>
</template>

<style scoped>
/* 批量模式时给底部操作栏留出空间 */
.batch-active {
  padding-bottom: 72px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px 8px;
}
.total-text {
  font-size: 12px;
  color: #969799;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.refresh-icon {
  font-size: 20px;
  color: #1989fa;
  padding: 4px;
  cursor: pointer;
}
/* 响应式卡片网格：小屏竖屏单列，大屏/横屏自动多列 */
.list {
  padding: 0 12px 12px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 640px) {
  .list {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1000px) {
  .list {
    grid-template-columns: repeat(3, 1fr);
  }
}
.history-card {
  background: #fff;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid transparent;
}
.history-card.selected {
  border-color: #1989fa;
  background: #f0f7ff;
}
.card-main {
  display: flex;
  gap: 10px;
}
.poster-wrap {
  flex-shrink: 0;
}
.poster {
  width: 64px;
  height: 90px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.poster.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  box-shadow: none;
}
.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}
.card-title-link {
  color: var(--van-primary-color);
  text-decoration: none;
}
.card-title-link:active { opacity: 0.7; }
.year {
  font-weight: 400;
  color: #969799;
  font-size: 12px;
}
.more-icon {
  font-size: 18px;
  color: #969799;
  flex-shrink: 0;
  padding: 4px;
  cursor: pointer;
}
.select-box {
  flex-shrink: 0;
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
/* 路径/文件名区域：每行独立展示，自动换行保证完整可见 */
.info-block {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-line {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.info-icon {
  font-size: 14px;
  color: #969799;
  flex-shrink: 0;
  margin-top: 1px;
}
.info-text {
  font-size: 12px;
  color: #646566;
  line-height: 1.4;
  word-break: break-all;
  white-space: normal;
  min-width: 0;
}
.dest-link {
  color: #07c160;
  cursor: pointer;
}
.dest-link:active {
  text-decoration: underline;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f5f5f5;
  font-size: 11px;
  gap: 8px;
}
.date-text {
  color: #969799;
}
.footer-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.source-text {
  color: #969799;
}
.mode-text {
  color: #646566;
}
.load-more {
  grid-column: 1 / -1;
  text-align: center;
  padding: 12px;
  font-size: 13px;
  color: #969799;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.no-more {
  grid-column: 1 / -1;
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: #c8c9cc;
}
/* 底部批量操作栏 */
.batch-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -1px 6px rgba(0,0,0,0.08);
}
.all-box {
  flex-shrink: 0;
}
.sel-count {
  font-size: 12px;
  color: #969799;
  flex-shrink: 0;
}
.batch-btns {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
