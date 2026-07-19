<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'

interface DownloadSetting {
  id: number
  name: string
  downloader: string
  category: string
  tags: string
  content_layout: string
  is_paused: string
  upload_limit: number
  download_limit: number
  ratio_limit: number
  seeding_time_limit: number
}

const loading = ref(false)
const items = ref<DownloadSetting[]>([])
const showEdit = ref(false)
const editing = ref<Partial<DownloadSetting>>({})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; data: DownloadSetting[] }>('get_download_setting', {})
    if (res.code === 0) items.value = res.data || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAdd() {
  editing.value = { name: '', downloader: 'qbittorrent', category: '', tags: '', content_layout: '', is_paused: '0', upload_limit: 0, download_limit: 0, ratio_limit: 0, seeding_time_limit: 0 }
  showEdit.value = true
}

function onEdit(item: DownloadSetting) {
  editing.value = { ...item }
  showEdit.value = true
}

async function onSave() {
  if (!editing.value.name) { showToast('请输入名称'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('update_download_setting', editing.value)
    if (res.code === 0) { showToast('保存成功'); showEdit.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}

async function onDelete(item: DownloadSetting) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    await doAction('delete_download_setting', { id: item.id })
    showToast('删除成功'); load()
  } catch { showToast('删除失败') }
}
</script>

<template>
  <div class="download-setting page">
    <div style="padding:8px 12px">
      <van-button block type="primary" icon="plus" @click="onAdd">新增下载设置</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="items.length === 0" description="暂无下载设置" />

    <van-cell-group v-else inset style="margin:12px">
      <van-cell v-for="item in items" :key="item.id" is-link @click="onEdit(item)">
        <template #title>
          <div style="font-weight:600">{{ item.name }}</div>
          <div style="font-size:12px;color:#969799">
            {{ item.downloader }} | {{ item.category || '无分类' }}
            <template v-if="item.ratio_limit"> | 分享率 {{ item.ratio_limit }}</template>
          </div>
        </template>
        <template #right-icon>
          <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click.stop="onDelete(item)" />
        </template>
      </van-cell>
    </van-cell-group>

    <van-popup v-model:show="showEdit" position="bottom" round :style="{ height: '80%' }" closeable title="下载设置">
      <van-form @submit="onSave" style="padding:16px">
        <van-field v-model="editing.name" label="名称" :rules="[{ required: true }]" />
        <van-field name="downloader" label="下载器">
          <template #input>
            <van-radio-group v-model="editing.downloader" direction="horizontal">
              <van-radio name="qbittorrent" shape="square">Qbittorrent</van-radio>
              <van-radio name="transmission" shape="square">Transmission</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="editing.category" label="分类" placeholder="Qbittorrent 分类" />
        <van-field v-model="editing.tags" label="标签" placeholder="分号分隔多个标签" />
        <van-field name="content_layout" label="内容布局">
          <template #input>
            <van-radio-group v-model="editing.content_layout" direction="horizontal">
              <van-radio name="" shape="square">默认</van-radio>
              <van-radio name="ORIGINAL" shape="square">原始</van-radio>
              <van-radio name="SUBFOLDER" shape="square">子文件夹</van-radio>
              <van-radio name="NO_SUBFOLDER" shape="square">无子文件夹</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field name="is_paused" label="暂停状态">
          <template #input>
            <van-radio-group v-model="editing.is_paused" direction="horizontal">
              <van-radio name="0" shape="square">开始下载</van-radio>
              <van-radio name="1" shape="square">暂停</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="editing.upload_limit" label="上传限速(KB/s)" type="number" />
        <van-field v-model="editing.download_limit" label="下载限速(KB/s)" type="number" />
        <van-field v-model="editing.ratio_limit" label="分享率限制" type="number" />
        <van-field v-model="editing.seeding_time_limit" label="做种时间(分钟)" type="number" />
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">保存</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>
