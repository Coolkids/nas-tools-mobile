<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog, showDialog } from 'vant'
import {
  getTorrentRemoveTasks,
  getTorrentRemoveTask,
  updateTorrentRemoveTask,
  deleteTorrentRemoveTask,
  getRemoveTorrents,
  autoRemoveTorrents,
  type TorrentRemoveTask
} from '@/api/download'

const loading = ref(false)
const tasks = ref<TorrentRemoveTask[]>([])
const showForm = ref(false)
const editing = ref(false)
const saving = ref(false)
const previewLoading = ref('')

const form = ref({
  tid: '',
  name: '',
  downloader: 'Qb',
  action: '1',
  interval: '',
  enabled: '0',
  samedata: '0',
  onlynastool: '1',
  ratio: '',
  seeding_time: '',
  upload_avs: '',
  size: '',
  tags: '',
  savepath_key: '',
  tracker_key: '',
  qb_category: '',
  qb_state: '',
  tr_state: '',
  tr_error_key: ''
})

const actionOptions = [
  { value: '1', label: '暂停种子' },
  { value: '2', label: '删除种子' },
  { value: '3', label: '删除种子及文件' }
]

onMounted(loadTasks)

async function loadTasks() {
  loading.value = true
  try {
    const res = await getTorrentRemoveTasks()
    if (res.code === 0) {
      const list = res.result || {}
      tasks.value = Object.values(list)
    }
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAdd() {
  editing.value = false
  form.value = {
    tid: '', name: '', downloader: 'Qb', action: '1', interval: '',
    enabled: '0', samedata: '0', onlynastool: '1',
    ratio: '', seeding_time: '', upload_avs: '', size: '',
    tags: '', savepath_key: '', tracker_key: '',
    qb_category: '', qb_state: '', tr_state: '', tr_error_key: ''
  }
  showForm.value = true
}

async function onEdit(tid: string) {
  try {
    const res = await getTorrentRemoveTask(tid)
    if (res.code === 0 && res.detail) {
      const d = res.detail
      form.value = {
        tid: d.id,
        name: d.name,
        downloader: d.downloader,
        action: String(d.action),
        interval: String(d.interval),
        enabled: d.enabled ? '1' : '0',
        samedata: d.samedata ? '1' : '0',
        onlynastool: d.onlynastool ? '1' : '0',
        ratio: d.config.ratio ? String(d.config.ratio) : '',
        seeding_time: d.config.seeding_time ? String(d.config.seeding_time) : '',
        upload_avs: d.config.upload_avs ? String(d.config.upload_avs) : '',
        size: d.config.size?.length ? `${d.config.size[0]}-${d.config.size[1]}` : '',
        tags: d.config.tags?.join(';') || '',
        savepath_key: d.config.savepath_key || '',
        tracker_key: d.config.tracker_key || '',
        qb_category: d.config.qb_category?.join(';') || '',
        qb_state: d.config.qb_state?.join(';') || '',
        tr_state: d.config.tr_state?.join(';') || '',
        tr_error_key: d.config.tr_error_key || ''
      }
      editing.value = true
      showForm.value = true
    } else {
      showToast(res.msg || '获取任务信息失败')
    }
  } catch { showToast('加载失败') }
}

async function onSave() {
  if (!form.value.name.trim()) { showToast('请输入任务名称'); return }
  if (!form.value.interval || isNaN(Number(form.value.interval))) { showToast('请输入有效间隔'); return }
  if (form.value.ratio && isNaN(Number(form.value.ratio))) { showToast('请输入有效分享率'); return }
  if (form.value.seeding_time && isNaN(Number(form.value.seeding_time))) { showToast('请输入有效做种时间'); return }
  if (form.value.upload_avs && isNaN(Number(form.value.upload_avs))) { showToast('请输入有效上传速度'); return }

  saving.value = true
  try {
    const params: Record<string, unknown> = {
      tid: form.value.tid,
      name: form.value.name,
      downloader: form.value.downloader,
      action: form.value.action,
      interval: form.value.interval,
      enabled: form.value.enabled,
      samedata: form.value.samedata,
      onlynastool: form.value.onlynastool,
      ratio: form.value.ratio,
      seeding_time: form.value.seeding_time,
      upload_avs: form.value.upload_avs,
      size: form.value.size,
      tags: form.value.tags,
      savepath_key: form.value.savepath_key,
      tracker_key: form.value.tracker_key,
      qb_category: form.value.qb_category,
      qb_state: form.value.qb_state,
      tr_state: form.value.tr_state,
      tr_error_key: form.value.tr_error_key
    }
    const res = await updateTorrentRemoveTask(params)
    if (res.code === 0) {
      showToast(editing.value ? '保存成功' : '新增成功')
      showForm.value = false
      loadTasks()
    } else {
      showToast(res.msg || '保存失败')
    }
  } catch { showToast('保存失败') }
  finally { saving.value = false }
}

async function onDelete(t: TorrentRemoveTask) {
  const ok = await showConfirmDialog({ title: '删除任务', message: `确认删除删种任务「${t.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteTorrentRemoveTask(t.id)
    if (res.code === 0) { showToast('删除成功'); loadTasks() }
    else showToast('删除失败')
  } catch { showToast('删除失败') }
}

async function onRunNow(tid: string) {
  try {
    const res = await autoRemoveTorrents(tid)
    if (res.code === 0) {
      showDialog({ title: '运行完成', message: '自动删种任务已执行完毕' })
    } else {
      showToast(res.msg || '执行失败')
    }
  } catch { showToast('执行失败') }
}

async function onPreview(t: TorrentRemoveTask) {
  previewLoading.value = t.id
  try {
    const res = await getRemoveTorrents(t.id)
    if (res.code === 0 && res.data?.length) {
      const list = res.data.map((item: { name: string; site: string; size: number }) =>
        `${item.name}\n${item.site || ''}  ${(item.size / 1024 / 1024 / 1024).toFixed(2)} GB`
      ).join('\n\n')
      showDialog({ title: `匹配种子 (${res.data.length})`, message: list })
    } else {
      showDialog({ title: '预览', message: res.msg || '没有匹配的种子' })
    }
  } catch { showToast('预览失败') }
  finally { previewLoading.value = '' }
}

function actionLabel(a: number) {
  return actionOptions.find(o => Number(o.value) === a)?.label || '未知'
}
</script>

<template>
  <div class="torrent-remove page">
    <div class="page-header">
      <span class="page-title">自动删种任务</span>
      <van-button size="small" type="primary" icon="plus" @click="onAdd">新增任务</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <van-empty v-else-if="tasks.length === 0" description="暂无删种任务，点击右上角新增" />

    <div v-else class="task-list">
      <div v-for="t in tasks" :key="t.id" class="task-card">
        <div class="card-header">
          <div class="card-title-row">
            <span class="status-dot" :class="t.enabled ? 'dot-on' : 'dot-off'" />
            <span class="task-name">{{ t.name }}</span>
          </div>
          <div class="card-actions">
            <van-icon name="bolt" class="action-icon" title="立即运行" @click="onRunNow(t.id)" />
            <van-icon name="eye-o" class="action-icon" title="预览" @click="onPreview(t)" />
            <van-icon name="edit" class="action-icon" title="编辑" @click="onEdit(t.id)" />
            <van-icon name="delete" class="action-icon action-danger" title="删除" @click="onDelete(t)" />
          </div>
        </div>

        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">下载器</span>
              <span class="info-value">{{ t.downloader === 'Qb' ? 'Qbittorrent' : 'Transmission' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">动作</span>
              <span class="info-value">{{ actionLabel(t.action) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">间隔</span>
              <span class="info-value">{{ t.interval }} 分钟</span>
            </div>
            <div class="info-item">
              <span class="info-label">状态</span>
              <van-tag :type="t.enabled ? 'success' : 'danger'" size="small">
                {{ t.enabled ? '运行中' : '已停用' }}
              </van-tag>
            </div>
          </div>

          <div class="badges-row">
            <van-tag v-if="t.onlynastool" size="small" plain round>只管理NAStool</van-tag>
            <van-tag v-if="t.samedata" size="small" plain round>处理辅种</van-tag>
          </div>

          <div v-if="t.config.ratio || t.config.seeding_time || t.config.upload_avs || t.config.size" class="conditions">
            <span class="cond-label">删种条件:</span>
            <span v-if="t.config.ratio" class="cond-tag">分享率 ≥ {{ t.config.ratio }}</span>
            <span v-if="t.config.seeding_time" class="cond-tag">做种 ≥ {{ t.config.seeding_time }}h</span>
            <span v-if="t.config.upload_avs" class="cond-tag">上传 ≤ {{ t.config.upload_avs }}KB/s</span>
            <span v-if="t.config.size" class="cond-tag">大小 {{ t.config.size[0] }}-{{ t.config.size[1] }}GB</span>
          </div>

          <div v-if="t.config.tags?.length || t.config.savepath_key || t.config.tracker_key" class="conditions">
            <span class="cond-label">过滤:</span>
            <van-tag v-if="t.config.savepath_key" size="small" plain>{{ t.config.savepath_key }}</van-tag>
            <van-tag v-if="t.config.tracker_key" size="small" plain>{{ t.config.tracker_key }}</van-tag>
            <van-tag v-for="tag in t.config.tags" :key="tag" size="small" plain>{{ tag }}</van-tag>
          </div>

          <div v-if="t.config.qb_category?.length || t.config.qb_state?.length" class="conditions">
            <span class="cond-label">Qb:</span>
            <van-tag v-for="c in t.config.qb_category" :key="c" size="small" plain type="primary">{{ c }}</van-tag>
            <van-tag v-for="s in t.config.qb_state" :key="s" size="small" plain type="warning">{{ s }}</van-tag>
          </div>

          <div v-if="t.config.tr_state?.length || t.config.tr_error_key" class="conditions">
            <span class="cond-label">Tr:</span>
            <van-tag v-for="s in t.config.tr_state" :key="s" size="small" plain type="warning">{{ s }}</van-tag>
            <van-tag v-if="t.config.tr_error_key" size="small" plain type="danger">{{ t.config.tr_error_key }}</van-tag>
          </div>
        </div>

        <div v-if="previewLoading === t.id" class="preview-loading">
          <van-loading size="14" /> 加载中...
        </div>
      </div>
    </div>

    <van-popup v-model:show="showForm" position="bottom" round :style="{ height: '85%' }">
      <div class="form-container">
        <div class="form-header">
          <span class="form-title">{{ editing ? '编辑删种任务' : '新增删种任务' }}</span>
          <van-icon name="close" @click="showForm = false" />
        </div>
        <van-form @submit="onSave">
          <van-cell-group inset>
            <van-field v-model="form.name" label="名称" placeholder="任务名称" clearable
              :rules="[{ required: true, message: '请输入任务名称' }]" />
            <van-field label="下载器">
              <template #input>
                <van-radio-group v-model="form.downloader" direction="horizontal">
                  <van-radio name="Qb" shape="square">Qbittorrent</van-radio>
                  <van-radio name="Tr" shape="square">Transmission</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field label="动作">
              <template #input>
                <van-radio-group v-model="form.action" direction="horizontal">
                  <van-radio v-for="o in actionOptions" :key="o.value" :name="o.value" shape="square">
                    {{ o.label }}
                  </van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field v-model="form.interval" label="运行间隔" placeholder="分钟" type="number" clearable
              :rules="[{ required: true, message: '请输入运行间隔' }]" />
            <van-field label="启用">
              <template #input><van-switch v-model="form.enabled" :active-value="'1'" :inactive-value="'0'" /></template>
            </van-field>
            <van-field label="处理辅种">
              <template #input><van-switch v-model="form.samedata" :active-value="'1'" :inactive-value="'0'" /></template>
            </van-field>
            <van-field label="只管理NAStool">
              <template #input><van-switch v-model="form.onlynastool" :active-value="'1'" :inactive-value="'0'" /></template>
            </van-field>
          </van-cell-group>

          <div class="section-title">删种条件</div>
          <van-cell-group inset>
            <van-field v-model="form.ratio" label="分享率" placeholder="≥ 该值则删除" type="number" clearable />
            <van-field v-model="form.seeding_time" label="做种时间" placeholder="≥ 该小时数则删除" type="number" clearable />
            <van-field v-model="form.upload_avs" label="平均上传速度" placeholder="≤ 该KB/s则删除" type="number" clearable />
            <van-field v-model="form.size" label="种子大小" placeholder="如 1-10 (GB)" clearable />
            <van-field v-model="form.tags" label="标签" placeholder="多个用;分隔" clearable />
          </van-cell-group>

          <div class="section-title">关键词过滤</div>
          <van-cell-group inset>
            <van-field v-model="form.savepath_key" label="保存路径关键词" placeholder="支持正则" clearable />
            <van-field v-model="form.tracker_key" label="Tracker关键词" placeholder="支持正则" clearable />
          </van-cell-group>

          <div v-if="form.downloader === 'Qb'" class="section-title">Qbittorrent 过滤</div>
          <van-cell-group inset v-if="form.downloader === 'Qb'">
            <van-field v-model="form.qb_state" label="种子状态" placeholder="多个用;分隔" clearable />
            <van-field v-model="form.qb_category" label="分类" placeholder="多个用;分隔" clearable />
          </van-cell-group>

          <div v-if="form.downloader === 'Tr'" class="section-title">Transmission 过滤</div>
          <van-cell-group inset v-if="form.downloader === 'Tr'">
            <van-field v-model="form.tr_state" label="种子状态" placeholder="多个用;分隔" clearable />
            <van-field v-model="form.tr_error_key" label="错误信息关键词" placeholder="支持正则" clearable />
          </van-cell-group>

          <div style="padding:16px;margin-bottom:20px">
            <van-button block type="primary" native-type="submit" :loading="saving">
              {{ editing ? '保存修改' : '新增任务' }}
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
}
.task-list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.task-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  overflow: hidden;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f5f5f5;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-on { background: #07c160; }
.dot-off { background: #ee0a24; }
.task-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-actions {
  display: flex;
  gap: 14px;
  flex-shrink: 0;
}
.action-icon {
  font-size: 18px;
  color: #646566;
  cursor: pointer;
}
.action-danger { color: #ee0a24; }
.card-body {
  padding: 10px 12px;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  min-width: 0;
}
.info-label {
  color: #969799;
  flex-shrink: 0;
}
.info-value {
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 8px;
  font-size: 12px;
  align-items: center;
}
.cond-label {
  color: #969799;
  flex-shrink: 0;
}
.cond-tag {
  background: #f5f5f5;
  color: #646566;
  padding: 1px 6px;
  border-radius: 3px;
}
.preview-loading {
  padding: 8px 12px;
  font-size: 12px;
  color: #969799;
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px solid #f5f5f5;
}
.form-container {
  height: 100%;
  overflow-y: auto;
}
.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.form-header .van-icon {
  font-size: 20px;
  color: #969799;
  cursor: pointer;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
  padding: 12px 16px 6px;
}

</style>
