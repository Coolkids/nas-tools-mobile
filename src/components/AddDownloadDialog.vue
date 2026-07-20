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
const uploadingNames = ref<string[]>([])
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
  uploadingNames.value = []
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
      uploadingNames.value.push(file.name)
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
      const files = activeTab.value === 'torrent' ? uploadingNames.value.map(n => ({ upload: { filename: n } })) : []
      if (files.length === 0 && magnets.length === 0) { emit('error', '请上传种子文件或填写磁力链接'); return }
      const res = await downloadTorrent({ files, magnets, dl_dir: form.dl_dir, dl_setting: form.dl_setting })
      if (res.code === 0) { visible.value = false; emit('success') }
      else emit('error', res.msg || '添加下载失败')
    }
  } finally { submitting.value = false }
}
</script>

<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :style="{ height: mode === 'manual' ? '70%' : 'auto' }"
    closeable
    class="download-dialog"
  >
    <div class="dialog-container">
      <div class="dialog-header">{{ title || '添加下载' }}</div>

      <van-form class="dialog-form" @submit="submit">
        <div class="form-body">
          <div class="group-title">下载选项</div>
          <van-cell-group inset>
            <van-field v-model="dlSettingText" is-link readonly name="dl_setting" label="下载设置" placeholder="请选择" @click="showDlSettingPicker = true" />
            <van-field v-model="dlDirText" is-link readonly name="dl_dir" label="保存目录" placeholder="请选择" @click="showDlDirPicker = true" />
          </van-cell-group>

          <template v-if="mode === 'manual'">
            <div class="group-title">下载方式</div>
            <div class="segmented">
              <div class="segmented-item" :class="{ 'segmented-item--active': activeTab === 'torrent' }" @click="activeTab = 'torrent'">种子文件</div>
              <div class="segmented-item" :class="{ 'segmented-item--active': activeTab === 'magnet' }" @click="activeTab = 'magnet'">磁力链接</div>
            </div>

            <van-cell-group inset class="manual-group">
              <div v-if="activeTab === 'torrent'" class="upload-area">
                <van-uploader :after-read="(r: any) => onUpload(r.file)" accept=".torrent" multiple>
                  <div class="upload-trigger">
                    <van-icon name="plus" size="22" />
                    <span class="upload-text">点击上传种子文件</span>
                    <span class="upload-hint">支持 .torrent，可多选</span>
                  </div>
                </van-uploader>
                <div v-if="uploadingNames.length" class="uploaded-list">
                  <div v-for="n in uploadingNames" :key="n" class="uploaded-item">
                    <van-icon name="description" class="uploaded-icon" />
                    <span class="uploaded-name">{{ n }}</span>
                  </div>
                </div>
              </div>
              <van-field
                v-else
                v-model="form.magnets"
                type="textarea"
                :rows="5"
                placeholder="magnet:?xt=urn:btih:xxx，换行添加多个"
              />
            </van-cell-group>
          </template>
        </div>

        <div class="form-footer">
          <van-button class="footer-btn" round type="primary" native-type="submit" :loading="submitting">下载</van-button>
        </div>
      </van-form>
    </div>

    <van-popup v-model:show="showDlSettingPicker" position="bottom" round>
      <van-picker :columns="dlSettingColumns" @confirm="({ selectedOptions }: any) => { form.dl_setting = selectedOptions[0].value; showDlSettingPicker = false; onDownloadSettingChange(selectedOptions[0].value) }" @cancel="showDlSettingPicker = false" />
    </van-popup>
    <van-popup v-model:show="showDlDirPicker" position="bottom" round>
      <van-picker :columns="dlDirColumns" @confirm="({ selectedOptions }: any) => { form.dl_dir = selectedOptions[0].value; showDlDirPicker = false }" @cancel="showDlDirPicker = false" />
    </van-popup>
  </van-popup>
</template>

<style scoped>
.dialog-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;
}

.dialog-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 44px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.dialog-form {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.form-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 12px;
}

.group-title {
  margin: 8px 24px 8px;
  font-size: 13px;
  color: #969799;
}

/* 下载方式分段选择器 */
.segmented {
  display: flex;
  margin: 0 16px 12px;
  padding: 3px;
  background: #e8e9eb;
  border-radius: 10px;
}

.segmented-item {
  flex: 1;
  padding: 7px 0;
  text-align: center;
  font-size: 14px;
  color: #646566;
  border-radius: 8px;
  transition: all 0.2s;
}

.segmented-item--active {
  background: #fff;
  color: var(--van-primary-color, #1989fa);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

/* 上传区域 */
.manual-group {
  margin-top: 0;
}

.upload-area {
  padding: 12px 16px;
}

.upload-area :deep(.van-uploader__wrapper) {
  width: 100%;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 24px 0;
  border: 1px dashed #dcdee0;
  border-radius: 8px;
  background: #fafbfc;
  color: #969799;
}

.upload-text {
  font-size: 14px;
  color: #646566;
}

.upload-hint {
  font-size: 12px;
}

.uploaded-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.uploaded-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f2f3f5;
  border-radius: 6px;
  font-size: 13px;
  color: #646566;
}

.uploaded-icon {
  flex-shrink: 0;
  color: #969799;
}

.uploaded-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部按钮 */
.form-footer {
  flex-shrink: 0;
  display: flex;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f2f3f5;
}

.footer-btn {
  flex: 1;
}
</style>
