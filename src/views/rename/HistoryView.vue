<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getTransferHistory, deleteHistory, type TransferHistoryItem } from '@/api/rename'
import { mediaDetail } from '@/api/discovery'
import { rmtModeLabel } from '@/utils/rmtMode'

const loading = ref(false)
const moreLoading = ref(false)
const hasMore = ref(true)
const items = ref<TransferHistoryItem[]>([])
const page = ref(1)
const keyword = ref('')
const total = ref(0)
// TMDBID -> 海报URL，空字符串表示已查询但无海报
const posters = ref<Record<string, string>>({})

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

async function onDelete(item: TransferHistoryItem) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.TITLE}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteHistory('del_source', [item.ID])
    if (res.code === 0) { showToast('删除成功'); load(1) }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

</script>

<template>
  <div class="history page">
    <van-search v-model="keyword" placeholder="搜索片名..." @search="onSearch" />

    <van-loading v-if="loading && items.length === 0" size="20" style="padding:40px;text-align:center" />

    <van-empty v-else-if="items.length === 0" description="暂无转移历史" />

    <div v-else class="list">
      <div v-for="item in items" :key="item.ID" class="history-card">
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
                {{ item.TITLE }}
                <span v-if="item.YEAR" class="year">({{ item.YEAR }})</span>
              </div>
              <van-icon name="delete" class="delete-icon" @click="onDelete(item)" />
            </div>

            <div class="tags-row">
              <van-tag v-if="item.TYPE === '电影'" size="small" type="primary">电影</van-tag>
              <van-tag v-else-if="item.TYPE === '电视剧'" size="small" type="success">电视剧</van-tag>
              <van-tag v-else-if="item.TYPE === '动漫'" size="small" type="warning">动漫</van-tag>
              <van-tag v-if="item.CATEGORY" size="small" plain>{{ item.CATEGORY }}</van-tag>
              <van-tag v-if="item.SEASON_EPISODE" size="small" plain type="warning">{{ item.SEASON_EPISODE }}</van-tag>
              <van-tag v-if="item.RMT_MODE" size="small" plain type="info">{{ rmtModeLabel(item.RMT_MODE) }}</van-tag>
            </div>

            <div class="path-row">
              <div class="path-item">
                <van-icon name="location-o" />
                <span class="path-text" :title="item.SOURCE_PATH">{{ item.SOURCE_PATH }}</span>
              </div>
              <van-icon name="arrow-down" class="path-arrow" />
              <div class="path-item">
                <van-icon name="flag-o" />
                <span class="path-text" :title="item.DEST_PATH">{{ item.DEST_PATH }}</span>
              </div>
            </div>

            <div v-if="item.SOURCE_FILENAME" class="file-row">
              <van-icon name="description-o" />
              <span class="file-text" :title="item.SOURCE_FILENAME">{{ item.SOURCE_FILENAME }}</span>
              <van-icon name="arrow" class="file-arrow" />
              <span class="file-text" :title="item.DEST_FILENAME">{{ item.DEST_FILENAME }}</span>
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
  </div>
</template>

<style scoped>
.list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history-card {
  background: #fff;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
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
.year {
  font-weight: 400;
  color: #969799;
  font-size: 12px;
}
.delete-icon {
  font-size: 18px;
  color: #ee0a24;
  flex-shrink: 0;
  padding: 4px;
  cursor: pointer;
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.path-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.path-item {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.path-item .van-icon {
  font-size: 14px;
  color: #969799;
  flex-shrink: 0;
}
.path-text {
  font-size: 12px;
  color: #646566;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.path-arrow {
  font-size: 16px;
  color: #c8c9cc;
  flex-shrink: 0;
}
.file-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 12px;
  color: #969799;
}
.file-row .van-icon {
  font-size: 13px;
  flex-shrink: 0;
}
.file-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.file-arrow {
  font-size: 12px;
  color: #c8c9cc;
  flex-shrink: 0;
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
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: #c8c9cc;
}
</style>
