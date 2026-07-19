<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog, showDialog } from 'vant'
import { doAction } from '@/api/request'

interface FilterRule {
  id: number
  rule_name: string
  rule_pri: number
  rule_include: string
  rule_exclude: string
  rule_sizelimit: string
  rule_free: string
}

interface FilterGroup {
  id: number
  name: string
  is_default: boolean
  rules: FilterRule[]
}

const loading = ref(false)
const groups = ref<FilterGroup[]>([])
const showEditGroup = ref(false)
const showEditRule = ref(false)
const editingGroup = ref({ id: 0, name: '', is_default: false })
const editingRule = ref<Partial<FilterRule>>({})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; ruleGroups?: FilterGroup[]; detail?: FilterGroup[] }>('get_filterrules', {})
    if (res.code === 0) groups.value = res.ruleGroups || res.detail || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAddGroup() {
  editingGroup.value = { id: 0, name: '', is_default: false }
  showEditGroup.value = true
}

async function onSaveGroup() {
  if (!editingGroup.value.name) { showToast('请输入组名'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('add_filtergroup', editingGroup.value)
    if (res.code === 0) { showToast('创建成功'); showEditGroup.value = false; load() }
    else showToast(res.msg || '创建失败')
  } catch { showToast('创建失败') }
}

async function onDeleteGroup(g: FilterGroup) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${g.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    await doAction('del_filtergroup', { id: g.id })
    showToast('删除成功'); load()
  } catch { showToast('删除失败') }
}

async function onSetDefault(g: FilterGroup) {
  try {
    await doAction('set_default_filtergroup', { id: g.id })
    showToast('设置成功'); load()
  } catch { showToast('设置失败') }
}

function onAddRule(group: FilterGroup) {
  editingRule.value = { id: 0, rule_name: '', rule_pri: 1, rule_include: '', rule_exclude: '', rule_sizelimit: '', rule_free: '' }
  showEditRule.value = true
}

async function onSaveRule() {
  if (!editingRule.value.rule_name) { showToast('请输入规则名称'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('add_filterrule', editingRule.value)
    if (res.code === 0) { showToast('保存成功'); showEditRule.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}
</script>

<template>
  <div class="filter-rule page">
    <div style="padding:8px 12px">
      <van-button block type="primary" icon="plus" @click="onAddGroup">新增规则组</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="groups.length === 0" description="暂无过滤规则" />

    <div v-else style="padding:0 12px 12px;display:flex;flex-direction:column;gap:12px">
      <van-card v-for="g in groups" :key="g.id">
        <template #title>
          {{ g.name }}
          <van-tag v-if="g.is_default" size="small" type="primary" style="margin-left:4px">默认</van-tag>
        </template>
        <template #tags>
          <van-tag v-for="r in g.rules" :key="r.id" size="small" style="margin:2px">{{ r.rule_name }}</van-tag>
          <van-tag size="small" type="primary" style="cursor:pointer" @click="onAddRule(g)">+</van-tag>
        </template>
        <template #footer>
          <van-button v-if="!g.is_default" size="small" plain @click="onSetDefault(g)">设为默认</van-button>
          <van-button size="small" plain type="danger" @click="onDeleteGroup(g)">删除组</van-button>
        </template>
      </van-card>
    </div>

    <van-popup v-model:show="showEditGroup" position="bottom" round :style="{ height: '35%' }" closeable title="规则组">
      <van-form @submit="onSaveGroup" style="padding:16px">
        <van-field v-model="editingGroup.name" label="组名" :rules="[{ required: true }]" />
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">创建</van-button></div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="showEditRule" position="bottom" round :style="{ height: '80%' }" closeable title="过滤规则">
      <van-form @submit="onSaveRule" style="padding:16px">
        <van-field v-model="editingRule.rule_name" label="规则名" :rules="[{ required: true }]" />
        <van-field v-model="editingRule.rule_pri" label="优先级(1-20)" type="number" />
        <van-field v-model="editingRule.rule_include" label="包含词" type="textarea" :rows="3" placeholder="每行一个" />
        <van-field v-model="editingRule.rule_exclude" label="排除词" type="textarea" :rows="3" placeholder="每行一个" />
        <van-field v-model="editingRule.rule_sizelimit" label="大小限制(GB)" placeholder="例: 5-50" />
        <van-field name="rule_free" label="促销">
          <template #input>
            <van-radio-group v-model="editingRule.rule_free" direction="horizontal">
              <van-radio name="" shape="square">不限</van-radio>
              <van-radio name="FREE" shape="square">免费</van-radio>
              <van-radio name="2XFREE" shape="square">2x免费</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">保存</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>
