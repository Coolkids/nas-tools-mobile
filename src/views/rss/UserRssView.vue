<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog, showDialog } from 'vant'
import { getUserRssTasks, deleteUserRssTask, runUserRss, type UserRssTask } from '@/api/rss'

const loading = ref(false)
const items = ref<UserRssTask[]>([])

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getUserRssTasks()
    if (res.code === 0) {
      const d = res.detail
      items.value = Array.isArray(d) ? d : d ? [d] : []
    } else showToast(res.msg || '加载失败')
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function stateColor(state: string) {
  switch (state) {
    case 'R': return 'success'
    case 'P': return 'warning'
    default: return 'danger'
  }
}

function stateText(state: string) {
  switch (state) {
    case 'R': return '运行中'
    case 'P': return '已暂停'
    default: return '停止'
  }
}

function usesText(uses: string) {
  return uses === 'D' ? '下载' : '订阅'
}

async function onAction(item: UserRssTask) {
  const action = await new Promise<string>((resolve) => {
    showDialog({
      title: item.name,
      message: '选择操作',
      showCancelButton: true,
      confirmButtonText: '运行',
      cancelButtonText: '删除',
    }).then(() => resolve('run')).catch(() => resolve('delete'))
  })
  if (action === 'run') {
    try { await runUserRss(item.id); showToast('运行成功'); load() }
    catch { showToast('运行失败') }
  } else if (action === 'delete') {
    const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.name}」？` }).catch(() => false)
    if (!ok) return
    try { await deleteUserRssTask(item.id); showToast('删除成功'); load() }
    catch { showToast('删除失败') }
  }
}
</script>

<template>
  <div class="user-rss page">
    <van-empty v-if="!loading && items.length === 0" description="暂无自定义订阅" />
    <div v-else class="list">
      <van-cell-group inset style="margin:12px">
        <van-cell
          v-for="item in items" :key="item.id"
          :title="item.name"
          :label="item.address"
          is-link
          @click="onAction(item)"
        >
          <template #value>
            <van-tag :type="stateColor(item.state)" size="small">{{ stateText(item.state) }}</van-tag>
          </template>
        </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>
