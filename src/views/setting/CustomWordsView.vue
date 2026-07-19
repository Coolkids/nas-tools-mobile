<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'

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
    <div class="toolbar">
      <div class="toolbar-left">
        <van-button size="small" icon="replay" @click="load">刷新</van-button>
        <van-button size="small" :disabled="selectedCount===0" @click="batchCheck('enable')">启用</van-button>
        <van-button size="small" :disabled="selectedCount===0" @click="batchCheck('disable')">停用</van-button>
        <van-button size="small" :disabled="selectedCount===0" @click="openExport">导出</van-button>
      </div>
      <div class="toolbar-right">
        <van-button size="small" @click="openImportCode">导入</van-button>
        <van-button size="small" type="primary" icon="plus" @click="groupVisible = true">新增组</van-button>
      </div>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="groups.length === 0" description="未配置任何识别词组" />

    <div v-else class="group-list">
      <div v-for="group in groups" :key="group.id" class="group-card van-hairline--bottom">
        <div class="group-header" @click="toggleGroup(group.id)">
          <van-icon :name="expandedGroups.has(group.id) ? 'arrow-down' : 'arrow'"/>
          <a v-if="group.link" :href="group.link" target="_blank" class="group-name">{{ group.name }}</a>
          <span v-else class="group-name">{{ group.name }}</span>
          <van-tag v-if="group.type === 1" size="small" type="primary" plain>电影</van-tag>
          <van-tag v-else size="small" type="warning" plain>电视剧</van-tag>
          <span class="word-count">{{ group.words.length }}条</span>
        </div>
        <div v-if="expandedGroups.has(group.id)" class="group-body">
          <div class="group-select-all">
            <van-checkbox
              :model-value="group.words.length > 0 && group.words.every(w => selectedIds.has(`${group.id}_${w.id}`))"
              shape="square"
              @update:model-value="(v: boolean) => selectGroupAll(group, v)"
            >全选</van-checkbox>
          </div>
          <div v-for="w in group.words" :key="w.id" class="word-row">
            <van-checkbox
              :model-value="selectedIds.has(`${group.id}_${w.id}`)"
              shape="square"
              @update:model-value="() => toggleSelect(`${group.id}_${w.id}`)"
              class="word-checkbox"
            />
            <div class="word-content" @click="openEdit(w, group)">
              <div class="word-main">
                <van-tag :type="w.enabled ? 'success' : 'danger'" size="small" class="word-status">{{ w.enabled ? '启用' : '停用' }}</van-tag>
                <van-tag size="small" plain class="word-type-tag">{{ wordTypeLabel(w.type) }}</van-tag>
                <van-tag v-if="w.regex" size="small" plain>RegEx</van-tag>
              </div>
              <div class="word-detail">
                <span v-if="w.replaced" class="word-field"><label>被替换:</label>{{ w.replaced }}</span>
                <span v-if="w.replace" class="word-field"><label>替换:</label>{{ w.replace }}</span>
              </div>
              <div v-if="w.front || w.back || w.offset" class="word-detail">
                <span v-if="w.front" class="word-field"><label>前:</label>{{ w.front }}</span>
                <span v-if="w.back" class="word-field"><label>后:</label>{{ w.back }}</span>
                <span v-if="w.offset" class="word-field"><label>偏移:</label>{{ w.offset }}</span>
              </div>
              <div v-if="w.season !== -2 || w.help" class="word-detail">
                <van-tag v-if="w.season !== -2" size="small" type="warning" plain>{{ seasonLabel(w.season) }}</van-tag>
                <span v-if="w.help" class="word-help">{{ w.help }}</span>
              </div>
            </div>
            <van-icon name="delete" class="word-delete" @click="deleteWord(w)" />
          </div>
          <div class="group-actions">
            <van-button size="small" icon="plus" type="primary" plain @click="openAdd(group)">新增识别词</van-button>
            <van-button v-if="group.id !== -1" size="small" plain type="danger" @click="deleteGroup(group)">删除组</van-button>
          </div>
        </div>
      </div>
    </div>

    <van-popup v-model:show="editVisible" position="bottom" :style="{ height: '85%' }" closeable :title="editTitle">
      <van-form @submit="submitWord" style="padding:12px 16px 24px">
        <van-field name="type" label="类型">
          <template #input>
            <van-radio-group v-model="form.type" direction="horizontal" class="type-radio-group">
              <van-radio v-for="t in WORD_TYPES" :key="t.value" :name="t.value" shape="square">{{ t.label }}</van-radio>
            </van-radio-group>
          </template>
        </van-field>

        <van-field v-if="form.type !== 4" v-model="form.new_replaced" label="被替换词" placeholder="被替换的文本" :rules="form.type !== 4 ? [{ required: true, message: '请填写被替换词' }] : []" />
        <van-field v-if="form.type === 2 || form.type === 3" v-model="form.new_replace" label="替换词" placeholder="替换为" :rules="(form.type === 2 || form.type === 3) ? [{ required: true, message: '请填写替换词' }] : []" />

        <template v-if="form.type === 3 || form.type === 4">
          <van-field v-model="form.new_front" label="前定位词" placeholder="如 第" />
          <van-field v-model="form.new_back" label="后定位词" placeholder="如 話" />
          <van-field v-model="form.new_offset" label="偏移集数" placeholder="如 -10" />
        </template>

        <van-field name="regex" label="正则表达式">
          <template #input>
            <van-radio-group v-model="form.regex" direction="horizontal">
              <van-radio :name="1" shape="square">使用</van-radio>
              <van-radio :name="0" shape="square">不使用</van-radio>
            </van-radio-group>
          </template>
        </van-field>

        <van-field v-if="form.group_type === 2" name="season" label="季">
          <template #input>
            <van-radio-group v-model="form.season" direction="horizontal">
              <van-radio :name="-1" shape="square">全部</van-radio>
            </van-radio-group>
          </template>
        </van-field>

        <van-field name="enabled" label="状态">
          <template #input>
            <van-radio-group v-model="form.enabled" direction="horizontal">
              <van-radio :name="1" shape="square">启用</van-radio>
              <van-radio :name="0" shape="square">停用</van-radio>
            </van-radio-group>
          </template>
        </van-field>

        <van-field v-model="form.new_help" label="备注" placeholder="备注说明" />

        <div style="margin-top:16px">
          <van-button block type="primary" native-type="submit">保存</van-button>
        </div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="groupVisible" position="center" :style="{ width: '85%' }" closeable title="新增识别词组">
      <van-form @submit="addGroup" style="padding:16px">
        <van-field v-model="groupForm.tmdb_id" label="TMDB ID" placeholder="TMDB的编号" :rules="[{ required: true, message: '请填写TMDB ID' }]" />
        <van-field name="tmdb_type" label="类型">
          <template #input>
            <van-radio-group v-model="groupForm.tmdb_type" direction="horizontal">
              <van-radio name="movie" shape="square">电影</van-radio>
              <van-radio name="tv" shape="square">电视剧</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">确定</van-button></div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="exportNoteVisible" position="bottom" :style="{ height: '45%' }" closeable title="导出自定义识别词">
      <van-form @submit="doExport" style="padding:16px">
        <van-field v-model="exportNote" label="分享备注" type="textarea" rows="4" placeholder="应用的资源标题/文件名/站点等" :rules="[{ required: true, message: '请填写分享备注' }]" />
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">生成分享代码</van-button></div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="exportCodeVisible" position="center" :style="{ width: '88%', maxHeight: '70%' }" closeable title="导出自定义识别词">
      <div style="padding:16px">
        <pre class="code-block">{{ exportCode }}</pre>
        <van-button block type="primary" style="margin-top:12px" @click="copyExport">复制</van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="importCodeVisible" position="bottom" :style="{ height: '55%' }" closeable title="导入自定义识别词">
      <van-form @submit="analyseImport" style="padding:16px">
        <van-field v-model="importCode" label="分享代码" type="textarea" rows="6" placeholder="在此处粘贴分享的规则内容" :rules="[{ required: true, message: '请粘贴分享代码' }]" />
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit" :loading="importAnalysing">解析分享代码</van-button></div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="importAnalyseVisible" position="bottom" :style="{ height: '85%' }" closeable title="导入自定义识别词">
      <div style="padding:0 16px 24px;overflow-y:auto;max-height:calc(100% - 50px)">
        <div v-if="importAnalyseNote" class="import-note">
          <div class="import-note-label">应用说明</div>
          <pre class="import-note-text">{{ importAnalyseNote }}</pre>
        </div>
        <div v-for="g in importAnalyseGroups" :key="g.id" class="import-group">
          <div class="import-group-header">
            <a v-if="g.link" :href="g.link" target="_blank" class="import-group-name">{{ g.name }}</a>
            <span v-else class="import-group-name">{{ g.name }}</span>
            <van-checkbox
              :model-value="g.words.length > 0 && g.words.every(w => importAnalyseSelected.has(`${g.id}_${w.id}`))"
              shape="square"
              @update:model-value="(v: boolean) => selectImportGroupAll(g, v)"
            />
          </div>
          <div v-for="w in g.words" :key="w.id" class="word-row">
            <van-checkbox
              :model-value="importAnalyseSelected.has(`${g.id}_${w.id}`)"
              shape="square"
              @update:model-value="() => toggleImportSelect(`${g.id}_${w.id}`)"
              class="word-checkbox"
            />
            <div class="word-content">
              <div class="word-main">
                <van-tag v-if="w.regex" size="small" plain>RegEx</van-tag>
              </div>
              <div class="word-detail">
                <span v-if="w.replaced" class="word-field"><label>被替换:</label>{{ w.replaced }}</span>
                <span v-if="w.replace" class="word-field"><label>替换:</label>{{ w.replace }}</span>
              </div>
              <div v-if="w.front || w.back || w.offset" class="word-detail">
                <span v-if="w.front" class="word-field"><label>前:</label>{{ w.front }}</span>
                <span v-if="w.back" class="word-field"><label>后:</label>{{ w.back }}</span>
                <span v-if="w.offset" class="word-field"><label>偏移:</label>{{ w.offset }}</span>
              </div>
              <div v-if="w.season || w.help" class="word-detail">
                <van-tag v-if="w.season === -1" size="small" type="warning" plain>全部</van-tag>
                <van-tag v-else-if="w.season !== -2" size="small" type="warning" plain>第{{ w.season }}季</van-tag>
                <span v-if="w.help" class="word-help">{{ w.help }}</span>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:16px">
          <van-button block type="primary" :loading="importSaving" @click="doImport">导入</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.group-list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
}
.group-card {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}
.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  cursor: pointer;
  user-select: none;
  background: var(--van-background-2, #f7f8fa);
}
.group-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--van-primary-color, #1989fa);
  text-decoration: none;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.word-count {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
  margin-left: auto;
}
.group-body {
  padding: 8px 12px 12px;
}
.group-select-all {
  padding: 4px 0 6px;
}
.word-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--van-border-color, #eee);
}
.word-row:last-child {
  border-bottom: none;
}
.word-checkbox {
  flex-shrink: 0;
  margin-top: 2px;
}
.word-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.word-main {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.word-detail {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--van-text-color-2, #666);
  margin-top: 2px;
}
.word-field label {
  color: var(--van-text-color-3, #999);
  margin-right: 2px;
}
.word-field {
  word-break: break-all;
}
.word-help {
  color: var(--van-text-color-3, #999);
  font-style: italic;
}
.word-delete {
  flex-shrink: 0;
  color: var(--van-danger-color, #ee0a24);
  font-size: 18px;
  padding: 4px;
  margin-top: 2px;
}
.word-status {
  flex-shrink: 0;
}
.word-type-tag {
  flex-shrink: 0;
}
.group-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  flex-wrap: wrap;
}
.type-radio-group {
  flex-wrap: wrap;
  gap: 4px;
}
.code-block {
  background: var(--van-background-2, #f7f8fa);
  padding: 12px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 40vh;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
}
.import-note {
  margin-bottom: 12px;
}
.import-note-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--van-text-color-3, #999);
  margin-bottom: 4px;
}
.import-note-text {
  background: var(--van-background-2, #f7f8fa);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.import-group {
  margin-bottom: 12px;
}
.import-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}
.import-group-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--van-primary-color, #1989fa);
  text-decoration: none;
}
</style>
