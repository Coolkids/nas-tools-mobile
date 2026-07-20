<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'
import { useModalStore } from '@/stores/modal'

interface FilterRule {
  id: number
  group: number
  name: string
  pri: number
  include: string | string[]
  exclude: string | string[]
  size: string
  free: string
  free_text: string
}

interface RuleGroup {
  id: number
  name: string
  default?: string
  rules: FilterRule[]
}

interface InitRuleGroup {
  id: number
  name: string
  rules: Array<{ name: string; include: string | string[]; exclude: string | string[] }>
  sql?: string[]
}

const modal = useModalStore()

const groups = ref<RuleGroup[]>([])
const initGroups = ref<InitRuleGroup[]>([])
const loading = ref(false)
const expandedGroups = ref<Set<number>>(new Set())

function toggleGroup(id: number) {
  const s = new Set(expandedGroups.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedGroups.value = s
}

const FREE_OPTIONS = [
  { value: '', label: '全部' },
  { value: '1.0 1.0', label: '普通' },
  { value: '1.0 0.0', label: '免费' },
  { value: '2.0 0.0', label: '2X免费' }
]

const PRI_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

function splitArr(v: string | string[] | undefined): string[] {
  if (!v) return []
  const arr = Array.isArray(v) ? v : [v]
  const result: string[] = []
  for (const item of arr) {
    for (const line of item.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) result.push(trimmed)
    }
  }
  return result
}

const FREE_TEXT_MAP: Record<string, string> = {
  '': '',
  '1.0 1.0': '普通',
  '1.0 0.0': '免费',
  '2.0 0.0': '2X免费'
}

function freeText(v: string): string {
  return FREE_TEXT_MAP[v] || ''
}

const ruleDialog = ref(false)
const ruleSaving = ref(false)
const ruleForm = reactive({
  rule_id: '' as string | number,
  group_id: '' as string | number,
  group_name: '',
  rule_name: '',
  rule_pri: 1,
  rule_include: '',
  rule_exclude: '',
  rule_sizelimit: '',
  rule_free: ''
})

const groupDialog = ref(false)
const groupSaving = ref(false)
const groupForm = reactive({ name: '', default: false })

const shareVisible = ref(false)
const shareContent = ref('')

const importVisible = ref(false)
const importSaving = ref(false)
const importContent = ref('')

const restoreVisible = ref(false)
const restoreSaving = ref(false)
const restoreSelected = ref<number[]>([])

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; ruleGroups: RuleGroup[]; initRules: InitRuleGroup[] }>('get_filterrules', {})
    if (res.code === 0) {
      groups.value = res.ruleGroups || []
      initGroups.value = res.initRules || []
    }
  } finally {
    loading.value = false
  }
}

function applyTemplate(rule: InitRuleGroup['rules'][0]) {
  ruleForm.rule_name = rule.name
  const inc = Array.isArray(rule.include) ? rule.include : (rule.include ? [rule.include] : [])
  const exc = Array.isArray(rule.exclude) ? rule.exclude : (rule.exclude ? [rule.exclude] : [])
  ruleForm.rule_include = inc.join('\n')
  ruleForm.rule_exclude = exc.join('\n')
  modal.success('已应用模板，请根据实际情况调整')
}

function openAddRule(group: RuleGroup) {
  ruleForm.rule_id = ''
  ruleForm.group_id = group.id
  ruleForm.group_name = group.name
  ruleForm.rule_name = ''
  ruleForm.rule_pri = 1
  ruleForm.rule_include = ''
  ruleForm.rule_exclude = ''
  ruleForm.rule_sizelimit = ''
  ruleForm.rule_free = ''
  ruleDialog.value = true
}

async function openEditRule(group: RuleGroup, rule: FilterRule) {
  ruleForm.group_id = group.id
  ruleForm.group_name = group.name
  const res = await doAction<{ code: number; info: FilterRule }>('filterrule_detail', {
    ruleid: rule.id,
    groupid: group.id
  })
  if (res.code === 0 && res.info) {
    const info = res.info
    ruleForm.rule_id = info.id
    ruleForm.rule_name = info.name
    ruleForm.rule_pri = info.pri || 1
    const inc = Array.isArray(info.include) ? info.include : (info.include ? [info.include] : [])
    const exc = Array.isArray(info.exclude) ? info.exclude : (info.exclude ? [info.exclude] : [])
    ruleForm.rule_include = inc.join('\n')
    ruleForm.rule_exclude = exc.join('\n')
    ruleForm.rule_sizelimit = info.size || ''
    ruleForm.rule_free = info.free || ''
    ruleDialog.value = true
  }
}

async function submitRule() {
  if (!ruleForm.rule_name) {
    modal.warning('规则名称不能为空')
    return
  }
  if (ruleForm.rule_sizelimit && !/^[0-9,]*$/.test(ruleForm.rule_sizelimit)) {
    modal.warning('大小限制只能包含数字和逗号')
    return
  }
  ruleSaving.value = true
  try {
    const res = await doAction<{ code: number; msg?: string }>('add_filterrule', {
      rule_id: ruleForm.rule_id,
      group_id: ruleForm.group_id,
      rule_name: ruleForm.rule_name,
      rule_pri: ruleForm.rule_pri,
      rule_include: ruleForm.rule_include,
      rule_exclude: ruleForm.rule_exclude,
      rule_sizelimit: ruleForm.rule_sizelimit,
      rule_free: ruleForm.rule_free
    })
    if (res.code === 0) {
      ruleDialog.value = false
      modal.success('保存成功')
      load()
    } else {
      modal.error(res.msg || '保存失败')
    }
  } finally {
    ruleSaving.value = false
  }
}

async function deleteRule(rule: FilterRule) {
  const ok = await modal.confirm(`确认删除规则「${rule.name}」？`)
  if (!ok) return
  await doAction('del_filterrule', { id: rule.id })
  modal.success('删除成功')
  ruleDialog.value = false
  load()
}

function openAddGroup() {
  groupForm.name = ''
  groupForm.default = false
  groupDialog.value = true
}

async function submitGroup() {
  if (!groupForm.name) {
    modal.warning('规则组名称不能为空')
    return
  }
  groupSaving.value = true
  try {
    const res = await doAction<{ code: number; msg?: string }>('add_filtergroup', {
      name: groupForm.name,
      default: groupForm.default ? 'Y' : 'N'
    })
    if (res.code === 0) {
      groupDialog.value = false
      modal.success('新增成功')
      load()
    } else {
      modal.error(res.msg || '新增失败')
    }
  } finally {
    groupSaving.value = false
  }
}

async function deleteGroup(group: RuleGroup) {
  const ok = await modal.confirm(`删除规则组后，该组下所有规则将同时被删除，是否确认删除「${group.name}」？`)
  if (!ok) return
  await doAction('del_filtergroup', { id: group.id })
  modal.success('删除成功')
  load()
}

async function setDefault(group: { id: number }) {
  await doAction('set_default_filtergroup', { id: group.id })
  modal.success('设置成功')
  load()
}

async function shareGroup(group: RuleGroup) {
  const res = await doAction<{ code: number; string?: string; msg?: string }>('share_filtergroup', { id: group.id })
  if (res.code === 0) {
    shareContent.value = res.string || ''
    shareVisible.value = true
  } else {
    modal.error(`无法生成分享：${res.msg || ''}`)
  }
}

function openImport() {
  importContent.value = ''
  importVisible.value = true
}

async function submitImport() {
  if (!importContent.value) {
    modal.warning('请粘贴规则内容')
    return
  }
  importSaving.value = true
  try {
    const res = await doAction<{ code: number; msg?: string }>('import_filtergroup', { content: importContent.value })
    if (res.code === 0) {
      importVisible.value = false
      modal.success('导入成功')
      load()
    } else {
      modal.error(`规则导入失败：${res.msg || ''}`)
    }
  } finally {
    importSaving.value = false
  }
}

function openRestore() {
  restoreSelected.value = []
  restoreVisible.value = true
}

async function submitRestore() {
  if (restoreSelected.value.length === 0) {
    modal.warning('请选择要恢复的规则组')
    return
  }
  restoreSaving.value = true
  try {
    const res = await doAction<{ code: number }>('restore_filtergroup', {
      groupids: restoreSelected.value,
      init_rulegroups: initGroups.value
    })
    if (res.code === 0) {
      restoreVisible.value = false
      modal.success('恢复成功')
      load()
    }
  } finally {
    restoreSaving.value = false
  }
}
</script>

<template>
  <div class="filter-rule page">
    <div class="toolbar">
      <van-button v-if="initGroups.length" size="small" icon="replay" @click="openRestore">恢复</van-button>
      <van-button size="small" icon="downloader" @click="openImport">导入</van-button>
      <van-button size="small" type="primary" icon="plus" @click="openAddGroup">新增</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <template v-else>
      <div v-if="initGroups.length" class="section-header">
        <span class="section-title">内置规则</span>
        <van-tag size="small" plain type="default">不可编辑</van-tag>
      </div>
      <div v-if="initGroups.length" class="group-list">
        <div v-for="g in initGroups" :key="g.id" class="group-card">
          <div class="group-header" @click="toggleGroup(g.id)">
            <van-icon :name="expandedGroups.has(g.id) ? 'arrow-down' : 'arrow'" class="collapse-icon" />
            <span class="group-name">{{ g.name }}</span>
            <van-tag size="small" type="default">内置</van-tag>
            <div class="group-spacer" />
            <van-button v-if="g.default !== 'Y'" size="mini" plain @click.stop="setDefault(g)">设默认</van-button>
          </div>
          <div v-show="expandedGroups.has(g.id)" class="group-body">
            <div v-if="g.rules && g.rules.length" class="rule-list">
              <div v-for="(r, i) in g.rules" :key="i" class="rule-item rule-item-readonly">
                <div class="rule-name">{{ r.name }}</div>
                <div class="rule-tags">
                  <van-tag v-for="(inc, i) in splitArr(r.include)" :key="'i' + i" size="small" type="success" class="rule-tag">包含 {{ inc }}</van-tag>
                  <van-tag v-for="(exc, i) in splitArr(r.exclude)" :key="'e' + i" size="small" type="danger" class="rule-tag">排除 {{ exc }}</van-tag>
                </div>
              </div>
            </div>
            <van-empty v-else description="无规则" />
          </div>
        </div>
      </div>

      <div v-if="groups.length" class="section-header">
        <span class="section-title">自定义规则</span>
      </div>
      <div v-if="groups.length === 0 && initGroups.length === 0" class="empty-state">
        <van-empty description="没有配置任何规则，请点击新增按钮" />
      </div>
      <div class="group-list">
        <div v-for="g in groups" :key="g.id" class="group-card">
          <div class="group-header" @click="toggleGroup(g.id)">
            <van-icon :name="expandedGroups.has(g.id) ? 'arrow-down' : 'arrow'" class="collapse-icon" />
            <van-icon v-if="g.default === 'Y'" name="star" class="default-icon" />
            <span class="group-name">{{ g.name }}</span>
            <van-tag v-if="g.default === 'Y'" size="small" type="success">默认</van-tag>
            <div class="group-spacer" />
            <van-button size="mini" plain icon="share-o" @click.stop="shareGroup(g)" />
            <van-button v-if="g.default !== 'Y'" size="mini" plain icon="star-o" @click.stop="setDefault(g)" />
            <van-button size="mini" plain icon="plus" type="primary" @click.stop="openAddRule(g)" />
            <van-button size="mini" plain icon="delete" type="danger" @click.stop="deleteGroup(g)" />
          </div>
          <div v-show="expandedGroups.has(g.id)" class="group-body">
            <div v-if="g.rules && g.rules.length" class="rule-list">
              <div
                v-for="r in g.rules"
                :key="r.id"
                class="rule-item"
                @click="openEditRule(g, r)"
              >
                <div class="rule-name">{{ r.name }}</div>
                <div class="rule-tags">
                  <van-tag v-if="r.pri && r.pri !== 1" size="small" plain class="rule-tag">优先级 {{ r.pri }}</van-tag>
                  <van-tag v-if="freeText(r.free)" size="small" type="default" class="rule-tag">促销 {{ freeText(r.free) }}</van-tag>
                  <van-tag v-for="(inc, i) in splitArr(r.include)" :key="'i' + i" size="small" type="success" class="rule-tag">包含 {{ inc }}</van-tag>
                  <van-tag v-for="(exc, i) in splitArr(r.exclude)" :key="'e' + i" size="small" type="danger" class="rule-tag">排除 {{ exc }}</van-tag>
                  <van-tag v-if="r.size" size="small" type="warning" class="rule-tag">大小 {{ r.size }} GB</van-tag>
                </div>
              </div>
            </div>
            <van-empty v-else description="没有规则，请点击增加规则" />
          </div>
        </div>
      </div>
    </template>

    <van-popup v-model:show="ruleDialog" position="bottom" round :style="{ maxHeight: '90vh' }" closeable>
      <div class="popup-body">
        <div class="popup-title">{{ ruleForm.rule_id ? '编辑规则' : '新增规则' }} · {{ ruleForm.group_name }}</div>
        <van-form @submit="submitRule">
          <van-cell-group inset>
            <van-field v-model="ruleForm.rule_name" label="规则名称" placeholder="自定义规则名称"
              :rules="[{ required: true, message: '请输入规则名称' }]" />
            <van-field name="rule_pri" label="优先级">
              <template #input>
                <van-radio-group v-model="ruleForm.rule_pri" direction="horizontal" class="pri-group">
                  <van-radio v-for="n in PRI_OPTIONS" :key="n" :name="n" shape="square">{{ n }}</van-radio>
                </van-radio-group>
              </template>
              <template #extra>
                <div class="field-hint">数值越小优先级越高</div>
              </template>
            </van-field>
            <van-field v-model="ruleForm.rule_include" label="包含规则" type="textarea" :rows="4" placeholder="必须包含的关键字或正则表达式，每行一个" />
            <van-field v-model="ruleForm.rule_exclude" label="排除规则" type="textarea" :rows="4" placeholder="不能包含的关键字或正则表达式，每行一个" />
            <van-field v-model="ruleForm.rule_sizelimit" label="大小限制(GB)" placeholder="单个数字或范围，如 5-50" />
            <van-field name="rule_free" label="促销">
              <template #input>
                <van-radio-group v-model="ruleForm.rule_free" direction="horizontal">
                  <van-radio v-for="f in FREE_OPTIONS" :key="f.value" :name="f.value" shape="square">{{ f.label }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>
          </van-cell-group>

          <div v-if="initGroups.length" class="template-section">
            <div class="template-title">规则模板</div>
            <div v-for="g in initGroups" :key="g.id" class="template-group">
              <details>
                <summary class="template-summary">模板-{{ g.name }}</summary>
                <div class="template-rules">
                  <van-button
                    v-for="(r, i) in g.rules"
                    :key="i"
                    size="small"
                    plain
                    class="template-btn"
                    @click="applyTemplate(r)"
                  >{{ r.name }}</van-button>
                </div>
              </details>
            </div>
          </div>

          <div class="popup-actions">
            <van-button v-if="ruleForm.rule_id" type="danger" icon="delete" @click="deleteRule({ id: ruleForm.rule_id as number, name: ruleForm.rule_name } as FilterRule)" />
            <van-button type="primary" native-type="submit" :loading="ruleSaving" style="flex:1">{{ ruleForm.rule_id ? '修改' : '新增' }}</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <van-popup v-model:show="groupDialog" position="bottom" round :style="{ maxHeight: '50vh' }" closeable>
      <div class="popup-body">
        <div class="popup-title">新增规则组</div>
        <van-form @submit="submitGroup">
          <van-cell-group inset>
            <van-field v-model="groupForm.name" label="规则组名称" placeholder="别名"
              :rules="[{ required: true, message: '请输入组名称' }]" />
            <van-field name="default" label="设为默认">
              <template #input>
                <van-switch v-model="groupForm.default" />
              </template>
              <template #extra>
                <div class="field-hint">在未指定规则组的场景下默认使用</div>
              </template>
            </van-field>
          </van-cell-group>
          <div class="popup-actions">
            <van-button type="primary" native-type="submit" :loading="groupSaving" block>新增</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <van-popup v-model:show="shareVisible" position="bottom" round :style="{ maxHeight: '70vh' }" closeable>
      <div class="popup-body">
        <div class="popup-title">规则分享</div>
        <pre class="share-content">{{ shareContent }}</pre>
        <div class="popup-actions">
          <van-button block @click="shareVisible = false">关闭</van-button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="importVisible" position="bottom" round :style="{ maxHeight: '70vh' }" closeable>
      <div class="popup-body">
        <div class="popup-title">规则导入</div>
        <van-form @submit="submitImport">
          <van-cell-group inset>
            <van-field v-model="importContent" label="规则内容" type="textarea" :rows="6" placeholder="在此处粘贴分享的规则内容" />
          </van-cell-group>
          <div class="popup-actions">
            <van-button type="primary" native-type="submit" :loading="importSaving" block>导入</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <van-popup v-model:show="restoreVisible" position="bottom" round :style="{ maxHeight: '60vh' }" closeable>
      <div class="popup-body">
        <div class="popup-title">恢复初始规则</div>
        <van-checkbox-group v-model="restoreSelected" class="restore-group">
          <van-checkbox v-for="g in initGroups" :key="g.id" :name="g.id" shape="square" class="restore-item">{{ g.name }}</van-checkbox>
        </van-checkbox-group>
        <div class="popup-actions">
          <van-button type="primary" :loading="restoreSaving" block @click="submitRestore">恢复</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 8px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
}

.group-list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-card {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  cursor: pointer;
  user-select: none;
}

.collapse-icon {
  font-size: 14px;
  color: #969799;
  flex-shrink: 0;
}

.default-icon {
  color: var(--van-orange, #ff976a);
  font-size: 14px;
  flex-shrink: 0;
}

.group-name {
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.group-spacer {
  flex: 1;
  min-width: 4px;
}

.group-header .van-button--mini {
  height: 24px;
  padding: 0 6px;
  font-size: 11px;
}

.group-body {
  border-top: 1px solid var(--van-border-color, #f0f0f0);
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.rule-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--van-border-color, #f0f0f0);
}

.rule-item:last-child {
  border-bottom: none;
}

.rule-item-readonly {
  cursor: default;
  opacity: 0.9;
}

.rule-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--van-text-color, #323233);
}

.rule-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rule-tag {
  font-size: 11px;
}

.empty-state {
  padding-top: 20px;
}

.popup-body {
  padding: 20px 0 28px;
}

.popup-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0 16px 16px;
}

.popup-actions {
  display: flex;
  gap: 8px;
  padding: 16px 16px 0;
}

.field-hint {
  font-size: 11px;
  color: #969799;
  margin-top: 2px;
}

.pri-group {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.pri-group .van-radio {
  font-size: 12px;
}

.template-section {
  padding: 16px 16px 0;
}

.template-title {
  font-size: 13px;
  font-weight: 600;
  color: #969799;
  margin-bottom: 8px;
}

.template-group {
  margin-bottom: 6px;
}

.template-summary {
  font-size: 13px;
  cursor: pointer;
  color: var(--van-primary-color, #1989fa);
  padding: 4px 0;
}

.template-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  padding-left: 12px;
}

.template-btn {
  font-size: 12px;
}

.share-content {
  background: var(--van-background-2, #f7f8fa);
  padding: 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  margin: 0 16px;
}

.restore-group {
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.restore-item {
  padding: 8px 0;
  font-size: 14px;
}
</style>
