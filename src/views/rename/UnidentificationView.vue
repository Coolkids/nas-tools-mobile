<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getUnknownList, delUnknownPath, renameUdf, type UnknownItem, type TransferMode, type ManualMediaType } from '@/api/rename'

const loading = ref(false)
const items = ref<UnknownItem[]>([])
const showForm = ref(false)
const formItem = ref<UnknownItem | null>(null)
const form = ref({ inpath: '', syncmod: 'copy' as TransferMode, type: 'movie' as ManualMediaType, tmdbid: '' })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getUnknownList()
    if (res.code === 0) items.value = res.items || []
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function onRename(item: UnknownItem) {
  formItem.value = item
  form.value = { inpath: item.path, syncmod: 'copy', type: 'movie', tmdbid: '' }
  showForm.value = true
}

async function onSubmit() {
  try {
    const res = await renameUdf({ ...form.value })
    if (res.retcode === 0) { showToast('识别成功'); showForm.value = false; load() }
    else showToast(res.retmsg || '识别失败')
  } catch { showToast('识别失败') }
}

async function onDelete(id: number) {
  const ok = await showConfirmDialog({ title: '删除', message: '确认删除此路径？' }).catch(() => false)
  if (!ok) return
  try { await delUnknownPath(id); showToast('删除成功'); load() }
  catch { showToast('删除失败') }
}

function syncModeLabel(m: string) {
  const map: Record<string, string> = { copy: '复制', link: '硬链接', move: '移动', softlink: '软链接' }
  return map[m] || m
}
</script>

<template>
  <div class="unid page">
    <van-loading v-if="loading && items.length === 0" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="items.length === 0" description="暂无未识别文件" />

    <div v-else class="list">
      <div v-for="item in items" :key="item.id" class="unid-card">
        <div class="card-body" @click="onRename(item)">
          <div class="card-left">
            <van-icon name="description-o" class="file-icon" />
          </div>
          <div class="card-content">
            <div class="file-name">{{ item.name }}</div>
            <div class="file-path" :title="item.path">{{ item.path }}</div>
            <div class="tags-row">
              <van-tag v-if="item.rmt_mode" size="small" plain type="info">{{ syncModeLabel(item.rmt_mode) }}</van-tag>
              <van-tag v-if="item.sync_mode" size="small" plain type="primary">{{ syncModeLabel(item.sync_mode) }}</van-tag>
            </div>
          </div>
        </div>
        <div class="card-actions">
          <van-button size="small" plain type="primary" @click="onRename(item)">识别</van-button>
          <van-button size="small" plain type="danger" @click="onDelete(item.id)">删除</van-button>
        </div>
      </div>
    </div>

    <van-popup v-model:show="showForm" position="bottom" round :style="{ height: '60%' }">
      <div style="padding:16px">
        <div style="font-size:16px;font-weight:600;margin-bottom:12px">手动识别</div>
        <van-form @submit="onSubmit">
          <van-field v-model="form.inpath" label="路径" readonly input-align="right" />
          <van-field label="转移方式">
            <template #input>
              <van-radio-group v-model="form.syncmod" direction="horizontal">
                <van-radio name="copy" shape="square">复制</van-radio>
                <van-radio name="link" shape="square">硬链接</van-radio>
                <van-radio name="move" shape="square">移动</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field label="类型">
            <template #input>
              <van-radio-group v-model="form.type" direction="horizontal">
                <van-radio name="movie" shape="square">电影</van-radio>
                <van-radio name="tv" shape="square">电视剧</van-radio>
                <van-radio name="anime" shape="square">动漫</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <div style="margin-top:20px">
            <van-button block type="primary" native-type="submit">执行识别</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.unid-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  overflow: hidden;
}
.card-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 0;
  cursor: pointer;
}
.card-left {
  flex-shrink: 0;
}
.file-icon {
  font-size: 24px;
  color: #1989fa;
}
.card-content {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-path {
  font-size: 12px;
  color: #969799;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.card-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px 12px;
  justify-content: flex-end;
}
</style>
