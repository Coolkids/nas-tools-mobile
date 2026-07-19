<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { showToast } from 'vant'
import { getDownloadDirs, getDownloadSettings, downloadTorrent, downloadSearchItem, uploadTorrentFile, type DownloadSettingOption } from '@/api/download'

type Mode = 'search' | 'manual'
type ManualSubType = 'torrent' | 'magnet'

const props = defineProps<{
  modelValue: boolean
  mode: Mode
  torrentId?: string | number
  manualType?: ManualSubType
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
  (e: 'error', msg: string): void
}>()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

const downloadSettings = ref<DownloadSettingOption[]>([])
const savePaths = ref<string[]>([])
const form = reactive({ dl_setting: '' as string | number, dl_dir: '', magnets: '' })
const uploadingNames: string[] = []
const submitting = ref(false)
const activeTab = ref(props.manualType || 'torrent')

const showDlSettingPicker = ref(false)
const showDlDirPicker = ref(false)

const dlSettingColumns = computed(() => [{ text: '默认', value: '' }, ...downloadSettings.value.map(d => ({ text: d.name, value: d.id }))])
const dlDirColumns = computed(() => [{ text: '自动', value: '' }, ...savePaths.value.map(p => ({ text: p, value: p }))])

const dlSettingText = computed(() => {
  if (!form.dl_setting) return '默认'
  const found = downloadSettings.value.find(d => d.id === form.dl_setting)
  return found ? found.name : '默认'
})
const dlDirText = computed(() => form.dl_dir || '自动')

watch(() => props.modelValue, async (open) => {
  if (!open) return
  form.dl_setting = ''
  form.dl_dir = ''
  form.magnets = ''
  uploadingNames.length = 0
  activeTab.value = props.manualType || 'torrent'
  await fetchDownloadSettings()
  await fetchSavePaths('')
})

async function fetchDownloadSettings() {
  try { const res = await getDownloadSettings(); if (res.code === 0) downloadSettings.value = res.data || [] }
  catch { downloadSettings.value = [] }
}

async function fetchSavePaths(sid: string | number) {
  if (!sid) { savePaths.value = []; return }
  try { const res = await getDownloadDirs(sid); if (res.code === 0) savePaths.value = res.paths || [] }
  catch { savePaths.value = [] }
}

async function onDownloadSettingChange(val: string | number) {
  form.dl_dir = ''
  await fetchSavePaths(val)
}

async function onUpload(file: File) {
  try {
    const res = await uploadTorrentFile(file)
    if (res.code === 0 && res.filepath) {
      uploadingNames.push(file.name)
      showToast('上传成功')
    } else showToast(res.msg || '上传失败')
  } catch { showToast('上传失败') }
}

async function submit() {
  submitting.value = true
  try {
    if (props.mode === 'search') {
      if (props.torrentId === undefined || props.torrentId === '') { emit('error', '种子 ID 缺失'); return }
      const res = await downloadSearchItem(props.torrentId, form.dl_dir, form.dl_setting)
      if (res.retcode === 0) { visible.value = false; emit('success') }
      else emit('error', res.retmsg || '添加下载失败')
    } else {
      const magnets = activeTab.value === 'magnet' ? form.magnets.split('\n').map(m => m.trim()).filter(Boolean) : []
      const files = activeTab.value === 'torrent' ? uploadingNames.map(n => ({ upload: { filename: n } })) : []
      if (files.length === 0 && magnets.length === 0) { emit('error', '请上传种子文件或填写磁力链接'); return }
      const res = await downloadTorrent({ files, magnets, dl_dir: form.dl_dir, dl_setting: form.dl_setting })
      if (res.code === 0) { visible.value = false; emit('success') }
      else emit('error', res.msg || '添加下载失败')
    }
  } finally { submitting.value = false }
}
</script>

<template>
  <van-popup v-model:show="visible" position="bottom"  :style="{ height: '70%' }" closeable :title="title || '添加下载'">
    <div style="padding: 16px">
      <van-form @submit="submit">
        <van-field v-model="dlSettingText" is-link readonly name="dl_setting" label="下载设置" placeholder="请选择" @click="showDlSettingPicker = true" />
        <van-popup v-model:show="showDlSettingPicker" position="bottom" >
          <van-picker :columns="dlSettingColumns" @confirm="({ selectedOptions }: any) => { form.dl_setting = selectedOptions[0].value; showDlSettingPicker = false; onDownloadSettingChange(selectedOptions[0].value) }" @cancel="showDlSettingPicker = false" style="height: 300px" />
        </van-popup>

        <van-field v-model="dlDirText" is-link readonly name="dl_dir" label="保存目录" placeholder="请选择" @click="showDlDirPicker = true" />
        <van-popup v-model:show="showDlDirPicker" position="bottom" >
          <van-picker :columns="dlDirColumns" @confirm="({ selectedOptions }: any) => { form.dl_dir = selectedOptions[0].value; showDlDirPicker = false }" @cancel="showDlDirPicker = false" style="height: 300px" />
        </van-popup>

        <template v-if="mode === 'manual'">
          <van-tabs v-model:active="activeTab">
            <van-tab name="torrent" title="种子文件">
              <van-uploader :after-read="(r: any) => onUpload(r.file)" accept=".torrent" multiple />
            </van-tab>
            <van-tab name="magnet" title="磁力链接">
              <van-field v-model="form.magnets" type="textarea" :rows="5" placeholder="magnet:?xt=urn:btih:xxx，换行添加多个" />
            </van-tab>
          </van-tabs>
        </template>

        <div style="margin-top: 16px">
          <van-button  block type="primary" native-type="submit" :loading="submitting">下载</van-button>
        </div>
      </van-form>
    </div>
  </van-popup>
</template>
