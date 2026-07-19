<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'

interface SyncPath {
  id: number
  from: string
  to: string
  unknown?: string
  syncmod: string
  rename: boolean
  enabled: boolean
}

const loading = ref(false)
const items = ref<SyncPath[]>([])
const showEdit = ref(false)
const editing = ref({ from: '', to: '', unknown: '', syncmod: 'link', rename: true, enabled: true, id: 0 })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; detail: SyncPath[] }>('get_directorysync', {})
    if (res.code === 0) items.value = res.detail || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

const syncModeOptions = [
  { value: 'link', label: '硬链接' },
  { value: 'softlink', label: '软链接' },
  { value: 'copy', label: '复制' },
  { value: 'move', label: '移动' },
  { value: 'rclone', label: 'Rclone' },
  { value: 'rclonecopy', label: 'Rclone复制' },
]

function onAdd() {
  editing.value = { id: 0, from: '', to: '', unknown: '', syncmod: 'link', rename: true, enabled: true }
  showEdit.value = true
}

function onEdit(item: SyncPath) {
  editing.value = { ...item }
  showEdit.value = true
}

async function onSave() {
  if (!editing.value.from || !editing.value.to) { showToast('请填写完整'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('add_or_edit_sync_path', editing.value)
    if (res.code === 0) { showToast('保存成功'); showEdit.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}

async function onDelete(item: SyncPath) {
  const ok = await showConfirmDialog({ title: '删除', message: '确认删除该同步规则？' }).catch(() => false)
  if (!ok) return
  try {
    await doAction('delete_sync_path', { id: item.id })
    showToast('删除成功'); load()
  } catch { showToast('删除失败') }
}

async function onToggle(item: SyncPath) {
  try {
    await doAction('check_sync_path', { id: item.id, enabled: !item.enabled })
    item.enabled = !item.enabled
  } catch { showToast('操作失败') }
}
</script>

<template>
  <div class="directory-sync page">
    <div style="padding:8px 12px">
      <van-button block type="primary" icon="plus" @click="onAdd">新增同步目录</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="items.length === 0" description="暂无目录同步规则" />

    <van-cell-group v-else inset style="margin:12px">
      <van-cell v-for="item in items" :key="item.id">
        <template #title>
          <div style="font-weight:600">{{ item.from }}</div>
          <div style="font-size:12px;color:#969799">→ {{ item.to }}</div>
        </template>
        <template #label>
          <van-tag size="small">{{ syncModeOptions.find(o => o.value === item.syncmod)?.label || item.syncmod }}</van-tag>
          <van-tag v-if="item.rename" size="small" type="primary">识别</van-tag>
        </template>
        <template #right-icon>
          <div style="display:flex;align-items:center;gap:4px">
            <van-switch :model-value="item.enabled" size="20" @change="onToggle(item)" />
            <van-icon name="edit" style="font-size:16px;color:#1989fa" @click="onEdit(item)" />
            <van-icon name="delete" style="font-size:16px;color:#ee0a24" @click="onDelete(item)" />
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <van-popup v-model:show="showEdit" position="bottom" round :style="{ height: '65%' }" closeable title="同步目录">
      <van-form @submit="onSave" style="padding:16px">
        <van-field v-model="editing.from" label="源目录" :rules="[{ required: true }]" />
        <van-field v-model="editing.to" label="目标目录" :rules="[{ required: true }]" />
        <van-field v-model="editing.unknown" label="未识别目录" placeholder="可选" />
        <van-field name="syncmod" label="同步方式">
          <template #input>
            <van-radio-group v-model="editing.syncmod" direction="horizontal">
              <van-radio v-for="o in syncModeOptions" :key="o.value" :name="o.value" shape="square">{{ o.label }}</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field name="rename" label="重命名">
          <template #input><van-switch v-model="editing.rename" /></template>
        </van-field>
        <van-field name="enabled" label="启用">
          <template #input><van-switch v-model="editing.enabled" /></template>
        </van-field>
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">保存</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>
