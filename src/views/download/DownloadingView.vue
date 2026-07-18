<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getDownloading, ptStart, ptStop, ptRemove, type DownloadTask } from '@/api/download'

const loading = ref(false)
const items = ref<DownloadTask[]>([])

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getDownloading()
    if (res.code === 0) items.value = res.result || []
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function stateColor(state: string) {
  if (state === 'downloading') return 'primary'
  if (state === 'paused') return 'warning'
  return 'default'
}

async function onAction(item: DownloadTask) {
  const actions: any[] = []
  if (item.state === 'paused') actions.push({ name: '开始' })
  else actions.push({ name: '暂停' })
  actions.push({ name: '删除', color: '#ee0a24' })

  const action = await new Promise<any>((resolve) => {
    showConfirmDialog({ title: '操作', message: `确认操作「${item.name}」？`, confirmButtonText: '确定', cancelButtonText: '取消' }).then(() => resolve(true)).catch(() => resolve(false))
  })
  if (!action) return

  try {
    if (item.state === 'paused') await ptStart(item.id)
    else await ptStop(item.id)
    showToast('操作成功')
    load()
  } catch { showToast('操作失败') }
}
</script>

<template>
  <div class="downloading page">
    <van-empty v-if="!loading && items.length === 0" description="暂无正在下载的任务" />
    <div v-else class="list">
      <van-cell-group inset style="margin:12px">
        <van-cell
          v-for="item in items" :key="item.id"
          :title="item.title || item.name"
          @click="onAction(item)"
        >
          <template #label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <van-tag :type="stateColor(item.state)">{{ item.state }}</van-tag>
              <span style="font-size:12px;color:#969799">{{ item.speed }}</span>
            </div>
            <van-progress :percentage="Math.round(item.progress)" :stroke-width="4" :show-pivot="false" style="margin-top:4px" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>
