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
</script>

<template>
  <div class="history page">
    <van-search v-model="keyword" placeholder="搜索历史..." @search="onSearch" />

    <van-empty v-if="!loading && items.length === 0" description="暂无转移历史" />

    <div v-else class="list">
      <van-cell-group>
        <van-cell
          v-for="item in items" :key="item.ID"
          :title="`${item.TITLE} (${item.YEAR || ''})`"
          :label="`${item.SOURCE_PATH || ''} → ${item.DEST_PATH || ''} | ${item.DATE || ''}`"
        >
          <template #right-icon>
            <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click="onDelete(item)" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>

<style scoped>
.list { padding: 0 12px; }
</style>
