<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'
import { proxyDoubanImage } from '@/api/discovery'

interface CustomWord {
  id: number
  replaced: string
  replace: string
  front: string
  back: string
  offset: string
  regex: number
  season: number
  type: number
  enabled: number
  help: string
  [key: string]: unknown
}

interface WordGroup {
  id: number
  name: string
  type: number
  seasons: number
  link?: string
  IMAGE: string
  words: CustomWord[]
  [key: string]: unknown
}

interface ImportGroup {
  id: number
  name: string
  link?: string
  words: CustomWord[]
}

const modal = useModalStore()
const loading = ref(false)
const groups = ref<WordGroup[]>([])
const expandedGroups = ref<Set<number>>(new Set())
const selectedIds = ref<Set<string>>(new Set())

const WORD_TYPES = [
  { value: 1, label: '屏蔽' },
  { value: 2, label: '替换' },
  { value: 3, label: '替换+集偏移' },
  { value: 4, label: '集偏移' }
]

const SEASON_OPTIONS = [
  { text: '全部季', value: -1 },
  ...Array.from({ length: 30 }, (_, i) => ({ text: `第${i + 1}季`, value: i + 1 }))
]

const GROUP_TYPE_OPTIONS = [
  { text: '电影', value: 'movie' },
  { text: '电视剧', value: 'tv' }
]

function toggleGroup(id: number) {
  const s = new Set(expandedGroups.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedGroups.value = s
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; result: WordGroup[] }>('get_customwords', {})
    if (res.code === 0) {
      groups.value = res.result || []
    }
  } catch { modal.error('加载失败') }
  finally { loading.value = false }
}

const selectedCount = computed(() => selectedIds.value.size)

function toggleSelect(key: string) {
  const s = new Set(selectedIds.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  selectedIds.value = s
}

function selectGroupAll(group: WordGroup, checked: boolean) {
  const s = new Set(selectedIds.value)
  for (const w of group.words) {
    const key = `${group.id}_${w.id}`
    if (checked) s.add(key)
    else s.delete(key)
  }
  selectedIds.value = s
}

function groupSelectedCount(group: WordGroup): number {
  let n = 0
  for (const w of group.words) {
    if (selectedIds.value.has(`${group.id}_${w.id}`)) n++
  }
  return n
}

const editVisible = ref(false)
const editTitle = ref('新增识别词')
const form = reactive({
  id: '',
  gid: '',
  group_type: 1,
  new_replaced: '',
  new_replace: '',
  new_front: '',
  new_back: '',
  new_offset: '',
  new_help: '',
  season: -1,
  type: 1,
  enabled: 1,
  regex: 1
})

const showWordTypePicker = ref(false)
const showSeasonPicker = ref(false)
const showGroupTypePicker = ref(false)

const seasonFieldText = computed(() => {
  return SEASON_OPTIONS.find(o => o.value === form.season)?.text || '全部季'
})

function resetForm() {
  form.id = ''
  form.gid = ''
  form.group_type = 1
  form.new_replaced = ''
  form.new_replace = ''
  form.new_front = ''
  form.new_back = ''
  form.new_offset = ''
  form.new_help = ''
  form.season = -1
  form.type = 1
  form.enabled = 1
  form.regex = 1
}

function openAdd(group: WordGroup) {
  editTitle.value = '新增识别词'
  resetForm()
  form.gid = String(group.id)
  form.group_type = group.type
  editVisible.value = true
}

async function openEdit(word: CustomWord, group: WordGroup) {
  editTitle.value = '编辑识别词'
  try {
    const res = await doAction<{ code: number; data: CustomWord }>('get_custom_word', { wid: word.id })
    if (res.code === 0 && res.data) {
      const w = res.data
      form.id = String(word.id)
      form.gid = String(group.id)
      form.group_type = group.type
      form.new_replaced = w.replaced || ''
      form.new_replace = w.replace || ''
      form.new_front = w.front || ''
      form.new_back = w.back || ''
      form.new_offset = w.offset || ''
      form.new_help = w.help || ''
      form.season = group.type === 1 ? -1 : (w.season ?? -1)
      form.type = w.type || 1
      form.enabled = w.enabled ?? 1
      form.regex = w.regex ?? 1
      editVisible.value = true
    } else {
      modal.error(res.msg || '获取识别词详情失败')
    }
  } catch { modal.error('获取识别词详情失败') }
}

async function submitWord() {
  if (form.type === 1 && !form.new_replaced) return modal.warning('请填写被替换词')
  if ((form.type === 2 || form.type === 3) && (!form.new_replaced || !form.new_replace)) return modal.warning('请填写被替换词和替换词')
  if ((form.type === 3 || form.type === 4) && (!form.new_front || !form.new_back || !form.new_offset)) return modal.warning('请填写定位词和偏移集数')
  try {
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(form)) {
      payload[k] = String(v)
    }
    const res = await doAction<{ code: number; msg?: string }>('add_or_edit_custom_word', payload)
    if (res.code === 0) {
      modal.success('保存成功')
      editVisible.value = false
      load()
    } else {
      modal.error(res.msg || '保存失败')
    }
  } catch { modal.error('保存失败') }
}

async function deleteWord(word: CustomWord) {
  const ok = await modal.confirm(`确认删除识别词「${word.replaced || word.front}」？`)
  if (!ok) return
  const res = await doAction<{ code: number; msg?: string }>('delete_custom_word', { id: word.id })
  if (res.code === 0) {
    modal.success('删除成功')
    load()
  } else {
    modal.error(res.msg || '删除失败')
  }
}

async function deleteGroup(group: WordGroup) {
  const ok = await modal.confirm('组内识别词将被同步删除，是否确认？')
  if (!ok) return
  const res = await doAction<{ code: number; msg?: string }>('delete_custom_word_group', { gid: group.id })
  if (res.code === 0) {
    modal.success('删除成功')
    load()
  } else {
    modal.error(res.msg || '删除失败')
  }
}

const groupVisible = ref(false)
const groupForm = reactive({ tmdb_id: '', tmdb_type: 'tv' })

async function addGroup() {
  if (!groupForm.tmdb_id || isNaN(Number(groupForm.tmdb_id))) return modal.warning('请填写有效的 TMDB ID')
  const res = await doAction<{ code: number; msg?: string }>('add_custom_word_group', { ...groupForm })
  if (res.code === 0) {
    modal.success('新增成功')
    groupVisible.value = false
    groupForm.tmdb_id = ''
    load()
  } else {
    modal.error(res.msg || '新增失败')
  }
}

async function batchCheck(flag: 'enable' | 'disable') {
  if (selectedCount.value === 0) return modal.warning('请先选择识别词')
  const ids = Array.from(selectedIds.value)
  const res = await doAction<{ code: number; msg?: string }>('check_custom_words', { flag, ids_info: ids })
  if (res.code === 0) {
    modal.success('操作成功')
    selectedIds.value = new Set()
    load()
  } else {
    modal.error(res.msg || '操作失败')
  }
}

const exportNoteVisible = ref(false)
const exportNote = ref('')
const exportIdsInfo = ref('')
const exportCodeVisible = ref(false)
const exportCode = ref('')

function openExport() {
  if (selectedCount.value === 0) return modal.warning('请先选择识别词')
  exportIdsInfo.value = Array.from(selectedIds.value).join('@')
  exportNote.value = ''
  exportNoteVisible.value = true
}

async function doExport() {
  if (!exportNote.value) return modal.warning('请填写分享备注')
  exportNoteVisible.value = false
  const res = await doAction<{ code: number; string?: string; msg?: string }>('export_custom_words', {
    note: exportNote.value,
    ids_info: exportIdsInfo.value
  })
  if (res.code === 0) {
    exportCode.value = (res as any).string || ''
    exportCodeVisible.value = true
  } else {
    modal.error(res.msg || '导出失败')
  }
}

async function copyExport() {
  try {
    await navigator.clipboard.writeText(exportCode.value)
    modal.success('已复制到剪贴板')
  } catch {
    modal.error('复制失败')
  }
}

const importCodeVisible = ref(false)
const importCode = ref('')
const importAnalyseVisible = ref(false)
const importAnalyseNote = ref('')
const importAnalyseGroups = ref<ImportGroup[]>([])
const importAnalyseSelected = ref<Set<string>>(new Set())
const importAnalysing = ref(false)
const importSaving = ref(false)

function openImportCode() {
  importCode.value = ''
  importCodeVisible.value = true
}

async function analyseImport() {
  if (!importCode.value) return modal.warning('请粘贴分享代码')
  importAnalysing.value = true
  try {
    const res = await doAction<{ code: number; note_string?: string; groups?: ImportGroup[]; msg?: string }>(
      'analyse_import_custom_words_code',
      { import_code: importCode.value }
    )
    if (res.code === 0) {
      importAnalyseNote.value = res.note_string || ''
      const rawGroups = res.groups || []
      importAnalyseGroups.value = rawGroups.map(g => ({
        ...g,
        words: Array.isArray(g.words) ? g.words : Object.values(g.words || {})
      }))
      importAnalyseSelected.value = new Set()
      importCodeVisible.value = false
      importAnalyseVisible.value = true
    } else {
      modal.error(res.msg || '解析失败')
    }
  } catch { modal.error('解析失败') }
  finally { importAnalysing.value = false }
}

function toggleImportSelect(key: string) {
  const s = new Set(importAnalyseSelected.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  importAnalyseSelected.value = s
}

function selectImportGroupAll(group: ImportGroup, checked: boolean) {
  const s = new Set(importAnalyseSelected.value)
  for (const w of group.words) {
    const key = `${group.id}_${w.id}`
    if (checked) s.add(key)
    else s.delete(key)
  }
  importAnalyseSelected.value = s
}

async function doImport() {
  if (importAnalyseSelected.value.size === 0) return modal.warning('请选择要导入的识别词')
  importSaving.value = true
  try {
    const ids_info = Array.from(importAnalyseSelected.value)
    const res = await doAction<{ code: number; msg?: string }>('import_custom_words', {
      import_code: importCode.value,
      ids_info
    })
    if (res.code === 0) {
      modal.success('导入成功')
      importAnalyseVisible.value = false
      importCode.value = ''
      importAnalyseGroups.value = []
      importAnalyseSelected.value = new Set()
      load()
    } else {
      modal.error(res.msg || '导入失败')
    }
  } catch { modal.error('导入失败') }
  finally { importSaving.value = false }
}

function seasonLabel(s: number): string {
  if (s === -1) return '全部季'
  if (s === -2) return ''
  return `第${s}季`
}

function wordTypeLabel(t: number): string {
  return WORD_TYPES.find(w => w.value === t)?.label || ''
}
</script>

<template>
  <div class="custom-words page">
    <!-- 工具栏 -->
    <div class="toolbar-card">
      <div class="toolbar-row">
        <van-button size="small" plain hairline type="primary" icon="plus" @click="groupVisible = true">新增组</van-button>
        <van-button size="small" plain hairline icon="down" @click="openImportCode">导入</van-button>
        <span class="toolbar-spacer" />
        <van-button size="small" plain hairline icon="replay" @click="load">刷新</van-button>
      </div>
      <div class="toolbar-row batch-row">
        <span class="batch-count">已选 {{ selectedCount }} 项</span>
        <van-button size="small" plain hairline type="success" :disabled="selectedCount === 0" @click="batchCheck('enable')">启用</van-button>
        <van-button size="small" plain hairline type="warning" :disabled="selectedCount === 0" @click="batchCheck('disable')">停用</van-button>
        <van-button size="small" plain hairline type="primary" icon="upgrade" :disabled="selectedCount === 0" @click="openExport">导出</van-button>
      </div>
    </div>

    <van-loading v-if="loading" size="24" class="page-loading" />
    <van-empty v-else-if="groups.length === 0" description="未配置任何识别词组" />

    <div v-else class="group-list">
      <div v-for="group in groups" :key="group.id" class="group-card">
        <div class="group-header" @click="toggleGroup(group.id)">
          <div class="group-poster-wrap">
            <img
              v-if="group.image"
              :src="proxyDoubanImage(group.image)"
              class="group-poster"
              alt="poster"
            />
            <div v-else class="group-icon" :class="group.type === 1 ? 'movie' : 'tv'">
              <van-icon :name="group.type === 1 ? 'video-o' : 'play-circle-o'" size="18" />
            </div>
          </div>
          <div class="group-info">
            <a v-if="group.link" :href="group.link" target="_blank" class="group-name" @click.stop>{{ group.name }}</a>
            <span v-else class="group-name">{{ group.name }}</span>
            <div class="group-sub">
              <span class="group-sub-type" :class="group.type === 1 ? 'movie' : 'tv'">{{ group.type === 1 ? '电影' : '电视剧' }}</span>
              <span>{{ group.words.length }} 条</span>
            </div>
          </div>
          <van-icon name="arrow-down" class="group-arrow" :class="{ expanded: expandedGroups.has(group.id) }" />
        </div>

        <div v-if="expandedGroups.has(group.id)" class="group-body">
          <div class="select-all-row">
            <van-checkbox
              :model-value="group.words.length > 0 && group.words.every(w => selectedIds.has(`${group.id}_${w.id}`))"
              @update:model-value="(v: boolean) => selectGroupAll(group, v)"
            >全选</van-checkbox>
            <span v-if="groupSelectedCount(group) > 0" class="selected-hint">
              已选 {{ groupSelectedCount(group) }} / {{ group.words.length }}
            </span>
          </div>

          <div
            v-for="w in group.words" :key="w.id"
            class="word-card" :class="{ selected: selectedIds.has(`${group.id}_${w.id}`) }"
          >
            <van-checkbox
              :model-value="selectedIds.has(`${group.id}_${w.id}`)"
              @update:model-value="() => toggleSelect(`${group.id}_${w.id}`)"
              class="word-checkbox"
            />
            <div class="word-content" @click="openEdit(w, group)">
              <div class="word-tags">
                <span class="mini-tag" :class="w.enabled ? 'on' : 'off'">{{ w.enabled ? '启用' : '停用' }}</span>
                <span class="mini-tag type">{{ wordTypeLabel(w.type) }}</span>
                <span v-if="w.regex" class="mini-tag regex">RegEx</span>
                <span v-if="w.season !== -2" class="mini-tag season">{{ seasonLabel(w.season) }}</span>
              </div>
              <div class="word-fields">
                <div v-if="w.replaced" class="word-field">
                  <span class="wf-label">被替换</span><span class="wf-value">{{ w.replaced }}</span>
                </div>
                <div v-if="w.replace" class="word-field">
                  <span class="wf-label">替换为</span><span class="wf-value">{{ w.replace }}</span>
                </div>
                <div v-if="w.front" class="word-field">
                  <span class="wf-label">前定位</span><span class="wf-value">{{ w.front }}</span>
                </div>
                <div v-if="w.back" class="word-field">
                  <span class="wf-label">后定位</span><span class="wf-value">{{ w.back }}</span>
                </div>
                <div v-if="w.offset" class="word-field">
                  <span class="wf-label">偏移</span><span class="wf-value">{{ w.offset }}</span>
                </div>
              </div>
              <div v-if="w.help" class="word-help">{{ w.help }}</div>
            </div>
            <div class="word-delete" @click="deleteWord(w)">
              <van-icon name="delete-o" size="15" />
            </div>
          </div>

          <div class="group-actions">
            <van-button size="small" plain hairline type="primary" icon="plus" @click="openAdd(group)">新增识别词</van-button>
            <van-button v-if="group.id !== -1" size="small" plain hairline type="danger" icon="delete-o" @click="deleteGroup(group)">删除组</van-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑识别词 -->
    <van-popup v-model:show="editVisible" position="bottom" round teleport="body" class="sheet sheet-tall">
      <van-form class="sheet-form" @submit="submitWord">
        <div class="sheet-header">
          <span class="sheet-title">{{ editTitle }}</span>
          <van-icon name="cross" class="sheet-close" @click="editVisible = false" />
        </div>
        <div class="sheet-body">
          <div class="section-label">识别词</div>
          <van-cell-group inset class="form-group">
            <van-field
              label="类型" is-link readonly
              :model-value="wordTypeLabel(form.type)"
              placeholder="请选择"
              @click="showWordTypePicker = true"
            />
            <van-field
              v-if="form.type !== 4"
              v-model="form.new_replaced"
              label="被替换词"
              placeholder="被替换的文本"
              :rules="form.type !== 4 ? [{ required: true, message: '请填写被替换词' }] : []"
            />
            <van-field
              v-if="form.type === 2 || form.type === 3"
              v-model="form.new_replace"
              label="替换词"
              placeholder="替换为"
              :rules="(form.type === 2 || form.type === 3) ? [{ required: true, message: '请填写替换词' }] : []"
            />
          </van-cell-group>

          <template v-if="form.type === 3 || form.type === 4">
            <div class="section-label">集偏移</div>
            <van-cell-group inset class="form-group">
              <van-field v-model="form.new_front" label="前定位词" placeholder="如 第" />
              <van-field v-model="form.new_back" label="后定位词" placeholder="如 話" />
              <van-field v-model="form.new_offset" label="偏移集数" placeholder="如 -10" />
            </van-cell-group>
          </template>

          <div class="section-label">选项</div>
          <van-cell-group inset class="form-group">
            <van-cell title="使用正则">
              <template #right-icon>
                <van-switch v-model="form.regex" :active-value="1" :inactive-value="0" size="20px" />
              </template>
            </van-cell>
            <van-field
              v-if="form.group_type === 2"
              label="季" is-link readonly
              :model-value="seasonFieldText"
              placeholder="请选择"
              @click="showSeasonPicker = true"
            />
            <van-cell title="启用状态">
              <template #right-icon>
                <van-switch v-model="form.enabled" :active-value="1" :inactive-value="0" size="20px" />
              </template>
            </van-cell>
            <van-field v-model="form.new_help" label="备注" placeholder="备注说明" />
          </van-cell-group>
        </div>
        <div class="sheet-footer">
          <van-button block round type="primary" native-type="submit">保存</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 类型选择器 -->
    <van-popup v-model:show="showWordTypePicker" position="bottom" round teleport="body">
      <van-picker
        title="选择类型"
        :columns="WORD_TYPES.map(t => ({ text: t.label, value: t.value }))"
        :default-index="WORD_TYPES.findIndex(t => t.value === form.type)"
        @confirm="({ selectedOptions }) => { form.type = selectedOptions[0].value; showWordTypePicker = false }"
        @cancel="showWordTypePicker = false"
      />
    </van-popup>

    <!-- 季选择器 -->
    <van-popup v-model:show="showSeasonPicker" position="bottom" round teleport="body">
      <van-picker
        title="选择季"
        :columns="SEASON_OPTIONS"
        :default-index="Math.max(0, SEASON_OPTIONS.findIndex(s => s.value === form.season))"
        @confirm="({ selectedOptions }) => { form.season = selectedOptions[0].value; showSeasonPicker = false }"
        @cancel="showSeasonPicker = false"
      />
    </van-popup>

    <!-- 新增识别词组 -->
    <van-popup v-model:show="groupVisible" position="bottom" round teleport="body" class="sheet">
      <van-form class="sheet-form" @submit="addGroup">
        <div class="sheet-header">
          <span class="sheet-title">新增识别词组</span>
          <van-icon name="cross" class="sheet-close" @click="groupVisible = false" />
        </div>
        <div class="sheet-body">
          <div class="sheet-tip">根据 TMDB ID 创建识别词组，用于该媒体的自定义识别规则</div>
          <van-cell-group inset class="form-group">
            <van-field
              v-model="groupForm.tmdb_id"
              label="TMDB ID"
              placeholder="TMDB 的编号"
              type="number"
              :rules="[{ required: true, message: '请填写TMDB ID' }]"
            />
            <van-field
              label="类型" is-link readonly
              :model-value="GROUP_TYPE_OPTIONS.find(o => o.value === groupForm.tmdb_type)?.text"
              placeholder="请选择"
              @click="showGroupTypePicker = true"
            />
          </van-cell-group>
        </div>
        <div class="sheet-footer">
          <van-button block round type="primary" native-type="submit">确定</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 组类型选择器 -->
    <van-popup v-model:show="showGroupTypePicker" position="bottom" round teleport="body">
      <van-picker
        title="选择类型"
        :columns="GROUP_TYPE_OPTIONS"
        :default-index="GROUP_TYPE_OPTIONS.findIndex(o => o.value === groupForm.tmdb_type)"
        @confirm="({ selectedOptions }) => { groupForm.tmdb_type = selectedOptions[0].value; showGroupTypePicker = false }"
        @cancel="showGroupTypePicker = false"
      />
    </van-popup>

    <!-- 导出：填写分享备注 -->
    <van-popup v-model:show="exportNoteVisible" position="bottom" round teleport="body" class="sheet">
      <van-form class="sheet-form" @submit="doExport">
        <div class="sheet-header">
          <span class="sheet-title">导出自定义识别词</span>
          <van-icon name="cross" class="sheet-close" @click="exportNoteVisible = false" />
        </div>
        <div class="sheet-body">
          <div class="sheet-tip">已选 {{ selectedCount }} 项识别词，导出后生成分享代码</div>
          <van-cell-group inset class="form-group">
            <van-field
              v-model="exportNote"
              label="分享备注"
              type="textarea"
              rows="4"
              autosize
              placeholder="应用的资源标题/文件名/站点等"
              :rules="[{ required: true, message: '请填写分享备注' }]"
            />
          </van-cell-group>
        </div>
        <div class="sheet-footer">
          <van-button block round type="primary" native-type="submit">生成分享代码</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 导出：分享代码 -->
    <van-popup v-model:show="exportCodeVisible" position="bottom" round teleport="body" class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">分享代码</span>
        <van-icon name="cross" class="sheet-close" @click="exportCodeVisible = false" />
      </div>
      <div class="sheet-body">
        <div class="sheet-tip">将下方代码分享给其他用户，对方可通过「导入」使用</div>
        <pre class="code-block">{{ exportCode }}</pre>
      </div>
      <div class="sheet-footer">
        <van-button block round type="primary" @click="copyExport">复制分享代码</van-button>
      </div>
    </van-popup>

    <!-- 导入：粘贴分享代码 -->
    <van-popup v-model:show="importCodeVisible" position="bottom" round teleport="body" class="sheet">
      <van-form class="sheet-form" @submit="analyseImport">
        <div class="sheet-header">
          <span class="sheet-title">导入自定义识别词</span>
          <van-icon name="cross" class="sheet-close" @click="importCodeVisible = false" />
        </div>
        <div class="sheet-body">
          <div class="sheet-tip">粘贴其他用户分享的识别词代码，解析后可选择导入</div>
          <van-cell-group inset class="form-group">
            <van-field
              v-model="importCode"
              label="分享代码"
              type="textarea"
              rows="6"
              placeholder="在此处粘贴分享的规则内容"
              :rules="[{ required: true, message: '请粘贴分享代码' }]"
            />
          </van-cell-group>
        </div>
        <div class="sheet-footer">
          <van-button block round type="primary" native-type="submit" :loading="importAnalysing">解析分享代码</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 导入：解析结果选择 -->
    <van-popup v-model:show="importAnalyseVisible" position="bottom" round teleport="body" class="sheet sheet-tall">
      <div class="sheet-header">
        <span class="sheet-title">选择导入识别词</span>
        <van-icon name="cross" class="sheet-close" @click="importAnalyseVisible = false" />
      </div>
      <div class="sheet-body">
        <div v-if="importAnalyseNote" class="import-note">
          <div class="import-note-label">应用说明</div>
          <pre class="import-note-text">{{ importAnalyseNote }}</pre>
        </div>
        <div v-for="g in importAnalyseGroups" :key="g.id" class="group-card import-group-card">
          <div class="import-group-header">
            <a v-if="g.link" :href="g.link" target="_blank" class="import-group-name">{{ g.name }}</a>
            <span v-else class="import-group-name">{{ g.name }}</span>
            <van-checkbox
              :model-value="g.words.length > 0 && g.words.every(w => importAnalyseSelected.has(`${g.id}_${w.id}`))"
              @update:model-value="(v: boolean) => selectImportGroupAll(g, v)"
            >全选</van-checkbox>
          </div>
          <div
            v-for="w in g.words" :key="w.id"
            class="word-card" :class="{ selected: importAnalyseSelected.has(`${g.id}_${w.id}`) }"
            @click="toggleImportSelect(`${g.id}_${w.id}`)"
          >
            <van-checkbox
              :model-value="importAnalyseSelected.has(`${g.id}_${w.id}`)"
              class="word-checkbox word-checkbox-static"
            />
            <div class="word-content">
              <div class="word-tags">
                <span v-if="w.regex" class="mini-tag regex">RegEx</span>
                <span v-if="w.season === -1" class="mini-tag season">全部季</span>
                <span v-else-if="w.season !== -2" class="mini-tag season">第{{ w.season }}季</span>
              </div>
              <div class="word-fields">
                <div v-if="w.replaced" class="word-field">
                  <span class="wf-label">被替换</span><span class="wf-value">{{ w.replaced }}</span>
                </div>
                <div v-if="w.replace" class="word-field">
                  <span class="wf-label">替换为</span><span class="wf-value">{{ w.replace }}</span>
                </div>
                <div v-if="w.front" class="word-field">
                  <span class="wf-label">前定位</span><span class="wf-value">{{ w.front }}</span>
                </div>
                <div v-if="w.back" class="word-field">
                  <span class="wf-label">后定位</span><span class="wf-value">{{ w.back }}</span>
                </div>
                <div v-if="w.offset" class="word-field">
                  <span class="wf-label">偏移</span><span class="wf-value">{{ w.offset }}</span>
                </div>
              </div>
              <div v-if="w.help" class="word-help">{{ w.help }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="sheet-footer">
        <span class="import-count">已选 {{ importAnalyseSelected.size }} 项</span>
        <van-button round type="primary" class="grow" :loading="importSaving" @click="doImport">确认导入</van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.custom-words {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---- 工具栏 ---- */
.toolbar-card {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(100, 101, 102, 0.08);
  overflow: hidden;
}
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}
.toolbar-row + .toolbar-row { border-top: 1px solid #f2f3f5; }
.toolbar-spacer { flex: 1; }
.batch-row { padding-top: 8px; padding-bottom: 8px; }
.batch-count { flex: 1; font-size: 12px; color: #969799; }
.page-loading { display: block; margin: 60px auto; }

/* ---- 识别词组 ---- */
.group-list {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.group-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(100, 101, 102, 0.08);
  overflow: hidden;
}
.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}
.group-header:active { background: #f7f8fa; }
.group-poster-wrap {
  flex-shrink: 0;
}
.group-poster {
  width: 48px;
  height: 68px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.group-icon {
  width: 48px;
  height: 68px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.group-icon.movie { background: #e8f2ff; color: #1989fa; }
.group-icon.tv { background: #fff3e8; color: #ff976a; }
.group-info { flex: 1; min-width: 0; }
.group-name {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  text-decoration: none;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
a.group-name { color: var(--van-primary-color); }
.group-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 11px;
  color: #969799;
}
.group-sub-type.movie { color: #1989fa; }
.group-sub-type.tv { color: #ff976a; }
.group-arrow {
  color: #c8c9cc;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.group-arrow.expanded { transform: rotate(180deg); }
.group-body {
  border-top: 1px solid #f2f3f5;
  padding: 8px 12px 12px;
}
.select-all-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0 8px;
}
.selected-hint { font-size: 11px; color: #969799; }
.group-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 4px;
}

/* ---- 识别词条目 ---- */
.word-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f7f8fa;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 8px;
}
.word-card.selected { background: #e8f2ff; border-color: #c9e0fa; }
.word-checkbox { flex-shrink: 0; margin-top: 2px; }
.word-checkbox-static { pointer-events: none; }
.word-content { flex: 1; min-width: 0; cursor: pointer; }
.word-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.mini-tag {
  font-size: 10px;
  border-radius: 4px;
  padding: 2px 6px;
  line-height: 1.4;
}
.mini-tag.on { background: #e8f8ef; color: #07c160; }
.mini-tag.off { background: #fdeeee; color: #ee0a24; }
.mini-tag.type { background: #e8f2ff; color: #1989fa; }
.mini-tag.regex { background: #f3eafd; color: #7232dd; }
.mini-tag.season { background: #fff3e8; color: #ff976a; }
.word-fields { display: flex; flex-direction: column; gap: 4px; }
.word-field { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; min-width: 0; }
.wf-label {
  flex-shrink: 0;
  font-size: 10px;
  color: #969799;
  background: #fff;
  border: 1px solid #ebedf0;
  border-radius: 4px;
  padding: 1px 5px;
  line-height: 1.5;
}
.wf-value { color: #323233; word-break: break-all; line-height: 1.5; }
.word-help {
  font-size: 11px;
  color: #969799;
  font-style: italic;
  margin-top: 6px;
  word-break: break-all;
}
.word-delete {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  color: #ee0a24;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(100, 101, 102, 0.12);
  cursor: pointer;
}
.word-delete:active { background: #fdeeee; }

/* ---- 底部弹层通用 ---- */
.sheet {
  max-width: 640px;
  right: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
.sheet-tall { height: 88vh; height: 88dvh; }
.sheet-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.sheet-header {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 44px 12px;
  border-bottom: 1px solid #f2f3f5;
  background: #fff;
}
.sheet-title { font-size: 16px; font-weight: 600; color: #323233; }
.sheet-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #969799;
  background: #f2f3f5;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
}
.sheet-close:active { background: #e8eaee; }
.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
  background: #f7f8fa;
}
.sheet-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f2f3f5;
}
.sheet-footer .grow { flex: 1; }
.sheet-tip {
  font-size: 12px;
  color: #969799;
  margin: 0 4px 10px;
  word-break: break-all;
  line-height: 1.5;
}
.section-label {
  font-size: 12px;
  color: #969799;
  font-weight: 500;
  margin: 2px 4px 8px;
}
.form-group { margin: 0 0 14px; border-radius: 12px; overflow: hidden; }

/* ---- 分享代码 ---- */
.code-block {
  margin: 0;
  background: #2b2f36;
  color: #e6edf3;
  padding: 14px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 46vh;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* ---- 导入 ---- */
.import-note {
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.import-note-label {
  font-size: 12px;
  font-weight: 600;
  color: #969799;
  margin-bottom: 4px;
}
.import-note-text {
  margin: 0;
  font-size: 12px;
  color: #646566;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}
.import-group-card { margin-bottom: 10px; }
.import-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f2f3f5;
}
.import-group-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--van-primary-color);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.import-group-card .word-card { margin: 8px 12px 0; }
.import-group-card .word-card:last-child { margin-bottom: 12px; }
.import-count { font-size: 12px; color: #969799; flex-shrink: 0; }
</style>
