<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getDownloading, ptStart, ptStop, ptRemove, type DownloadTask } from '@/api/download'
import AddDownloadDialog from '@/components/AddDownloadDialog.vue'

const loading = ref(false)
const refreshing = ref(false)
const items = ref<DownloadTask[]>([])
const showAdd = ref(false)

onMounted(load)

async function load() {
  try {
    const res = await getDownloading()
    if (res.code === 0) items.value = res.result || []
  } catch { showToast('加载失败') }
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

function stateInfo(state: string) {
  switch (state) {
    case 'downloading': return { label: '下载中', type: 'primary' as const }
    case 'paused': return { label: '已暂停', type: 'warning' as const }
    case 'seeding': return { label: '做种中', type: 'success' as const }
    case 'completed': return { label: '已完成', type: 'default' as const }
    default: return { label: state, type: 'default' as const }
  }
}

async function onStart(item: DownloadTask) {
  try { await ptStart(item.id); showToast('已开始'); load() }
  catch { showToast('操作失败') }
}

async function onPause(item: DownloadTask) {
  try { await ptStop(item.id); showToast('已暂停'); load() }
  catch { showToast('操作失败') }
}

async function onRemove(item: DownloadTask) {
  const ok = await showConfirmDialog({ title: '删除任务', message: `确认删除「${item.name}」？`, confirmButtonText: '确定', cancelButtonText: '取消' }).then(() => true).catch(() => false)
  if (!ok) return
  try {
    const res = await ptRemove(item.id)
    if (res.retcode === 0) { showToast('已删除'); load() }
    else showToast(res.retmsg || '删除失败')
  } catch { showToast('删除失败') }
}
</script>

<template>
  <div class="downloading page">
    <div style="padding: 8px 12px">
      <van-button  block type="primary" icon="plus" @click="showAdd = true">新增下载</van-button>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-empty v-if="!loading && items.length === 0" description="暂无正在下载的任务" />
      <div v-else class="card-list">
        <div v-for="item in items" :key="item.id" class="task-card">
          <div class="task-header">
            <div class="task-title">{{ item.title || item.name }}</div>
            <van-tag size="small" :type="stateInfo(item.state).type">{{ stateInfo(item.state).label }}</van-tag>
          </div>
          <div v-if="item.speed" class="task-speed">{{ item.speed }}</div>
          <van-progress :percentage="Math.round(item.progress)" :stroke-width="5" :show-pivot="false" style="margin: 4px 0" />
          <div class="task-actions">
            <van-button v-if="item.state === 'paused'" size="small" plain type="primary" icon="play" @click="onStart(item)">开始</van-button>
            <van-button v-else-if="item.state === 'downloading'" size="small" plain type="warning" icon="pause" @click="onPause(item)">暂停</van-button>
            <van-button size="small" plain type="danger" icon="delete" @click="onRemove(item)">删除</van-button>
          </div>
        </div>
      </div>
    </van-pull-refresh>

    <AddDownloadDialog
      v-model="showAdd"
      mode="manual"
      @success="showAdd = false; load()"
      @error="showToast($event)"
    />
  </div>
</template>

<style scoped>
.card-list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-card {
  backg: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.task-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.task-speed {
  font-size: 12px;
  color: #969799;
  margin-top: 2px;
}
.task-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
