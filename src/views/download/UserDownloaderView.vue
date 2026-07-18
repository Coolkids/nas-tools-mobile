<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'

interface UserDownloader {
  id?: number
  name: string
  type: string
  enabled: boolean
  host: string
  [key: string]: unknown
}

const loading = ref(false)
const items = ref<UserDownloader[]>([])
const showEdit = ref(false)
const editing = ref<Partial<UserDownloader>>({})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; detail: UserDownloader[] }>('get_user_downloaders', {})
    if (res.code === 0) items.value = res.detail || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAdd() {
  editing.value = { name: '', type: 'qbittorrent', enabled: true, host: '' }
  showEdit.value = true
}

function onEdit(item: UserDownloader) {
  editing.value = { ...item }
  showEdit.value = true
}

async function onSave() {
  if (!editing.value.name) { showToast('请输入名称'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('save_user_downloader', editing.value)
    if (res.code === 0) { showToast('保存成功'); showEdit.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}

async function onDelete(item: UserDownloader) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await doAction<{ code: number; msg?: string }>('delete_user_downloader', { id: item.id })
    if (res.code === 0) { showToast('删除成功'); load() }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}
</script>

<template>
  <div class="user-downloader page">
    <div style="padding:8px 12px">
      <van-button round block type="primary" icon="plus" @click="onAdd">新增下载器</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="items.length === 0" description="暂无自定义下载器" />

    <van-cell-group v-else inset style="margin:12px">
      <van-cell v-for="item in items" :key="item.id" :title="item.name" :label="item.type + ' | ' + item.host" is-link @click="onEdit(item)">
        <template #value>
          <van-tag :type="item.enabled ? 'success' : 'danger'" size="small">{{ item.enabled ? '启用' : '禁用' }}</van-tag>
          <van-icon name="delete" style="color:#ee0a24;margin-left:8px;font-size:16px" @click.stop="onDelete(item)" />
        </template>
      </van-cell>
    </van-cell-group>

    <van-popup v-model:show="showEdit" position="bottom" round :style="{ height: '60%' }" closeable title="下载器">
      <van-form @submit="onSave" style="padding:16px">
        <van-field v-model="editing.name" label="名称" placeholder="请输入" :rules="[{ required: true }]" />
        <van-field name="type" label="类型">
          <template #input>
            <van-radio-group v-model="editing.type" direction="horizontal">
              <van-radio name="qbittorrent" shape="square">Qbittorrent</van-radio>
              <van-radio name="transmission" shape="square">Transmission</van-radio>
              <van-radio name="aria2" shape="square">Aria2</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="editing.host" label="地址" placeholder="http://host:port" />
        <van-field name="enabled" label="启用">
          <template #input><van-switch v-model="editing.enabled!" /></template>
        </van-field>
        <div style="margin-top:16px">
          <van-button round block type="primary" native-type="submit">保存</van-button>
        </div>
      </van-form>
    </van-popup>
  </div>
</template>
