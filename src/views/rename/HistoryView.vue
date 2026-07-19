<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getTransferHistory, deleteHistory, type TransferHistoryItem } from '@/api/rename'

const loading = ref(false)
const items = ref<TransferHistoryItem[]>([])
const page = ref(1)
const keyword = ref('')
const total = ref(0)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getTransferHistory({ page: page.value, keyword: keyword.value })
    if (res.code === 0) {
      items.value = res.result || []
      total.value = res.total || 0
    }
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function onSearch() {
  page.value = 1
  load()
}

async function onDelete(item: TransferHistoryItem) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.TITLE}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteHistory('del_source', [item.ID])
    if (res.code === 0) { showToast('删除成功'); load() }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

function modeLabel(mode: string) {
  const map: Record<string, string> = { COPY: '复制', MOVE: '移动', LINK: '硬链接', SOFTLINK: '软链接' }
  return map[mode] || mode
}
</script>

<template>
  <div class="history page">
    <van-search v-model="keyword" placeholder="搜索片名..." @search="onSearch" />

    <van-loading v-if="loading && items.length === 0" size="20" style="padding:40px;text-align:center" />

    <van-empty v-else-if="items.length === 0" description="暂无转移历史" />

    <div v-else class="list">
      <div v-for="item in items" :key="item.ID" class="history-card">
        <div class="card-header">
          <div class="card-title">
            {{ item.TITLE }}
            <span v-if="item.YEAR" class="year">({{ item.YEAR }})</span>
          </div>
          <van-icon name="delete" class="delete-icon" @click="onDelete(item)" />
        </div>

        <div class="tags-row">
          <van-tag v-if="item.TYPE === 'TV'" size="small" type="success">电视剧</van-tag>
          <van-tag v-else size="small" type="primary">电影</van-tag>
          <van-tag v-if="item.CATEGORY" size="small" plain>{{ item.CATEGORY }}</van-tag>
          <van-tag v-if="item.SEASON_EPISODE" size="small" plain type="warning">{{ item.SEASON_EPISODE }}</van-tag>
          <van-tag v-if="item.MODE" size="small" plain type="info">{{ modeLabel(item.MODE) }}</van-tag>
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
          <span v-if="item.SYNC_MODE || item.RMT_MODE" class="mode-text">
            {{ item.SYNC_MODE === 'copy' ? '同步复制' : item.SYNC_MODE === 'link' ? '同步硬链' : '' }}
            {{ item.RMT_MODE === 'COPY' ? '传输复制' : item.RMT_MODE === 'MOVE' ? '传输移动' : '' }}
          </span>
        </div>
      </div>
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
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
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
}
.date-text {
  color: #969799;
}
.mode-text {
  color: #646566;
}
</style>
