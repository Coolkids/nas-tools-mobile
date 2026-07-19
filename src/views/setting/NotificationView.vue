<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'

interface MessageClient {
  id: number
  name: string
  type: string
  enabled: boolean
  interactive: boolean
  config: Record<string, unknown>
  switches?: Record<string, boolean>
}

const loading = ref(false)
const items = ref<MessageClient[]>([])
const showEdit = ref(false)
const editing = ref<Partial<MessageClient>>({})
const showSwitches = ref(false)

const channelTypes = [
  'telegram', 'wechat', 'serverchan', 'bark', 'pushdeer',
  'pushplus', 'iyuu', 'slack', 'gotify', 'chanify', 'synology'
]

const notifyEvents = [
  'download_start', 'download_fail', 'transfer_finished', 'transfer_fail',
  'rss_added', 'rss_finished', 'site_signin', 'site_message',
  'brushtask_added', 'brushtask_remove', 'mediaserver_message', 'custom_message'
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; detail: MessageClient[] }>('get_message_client', {})
    if (res.code === 0) items.value = res.detail || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAdd() {
  editing.value = { id: 0, name: '', type: 'telegram', enabled: true, interactive: false, config: {}, switches: {} }
  showEdit.value = true
}

function onEdit(item: MessageClient) {
  editing.value = { ...item, config: { ...item.config }, switches: { ...item.switches } }
  showEdit.value = true
}

function channelLabel(type: string) {
  const map: Record<string, string> = { telegram: 'Telegram', wechat: '企业微信', serverchan: 'Server酱', bark: 'Bark', pushdeer: 'PushDeer', pushplus: 'PushPlus', iyuu: 'iYuu', slack: 'Slack', gotify: 'Gotify', chanify: 'Chanify', synology: 'Synology Chat' }
  return map[type] || type
}

async function onSave() {
  if (!editing.value.name) { showToast('请输入名称'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('update_message_client', editing.value)
    if (res.code === 0) { showToast('保存成功'); showEdit.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}

async function onTest() {
  try {
    const res = await doAction<{ code: number; msg?: string }>('test_message_client', { id: editing.value.id })
    if (res.code === 0) showToast('测试通过')
    else showToast(res.msg || '测试失败')
  } catch { showToast('测试失败') }
}

async function onDelete(item: MessageClient) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    await doAction('delete_message_client', { id: item.id })
    showToast('删除成功'); load()
  } catch { showToast('删除失败') }
}

function toggleSwitch(name: string) {
  if (!editing.value.switches) editing.value.switches = {}
  editing.value.switches[name] = !editing.value.switches[name]
}
</script>

<template>
  <div class="notification page">
    <div style="padding:8px 12px">
      <van-button block type="primary" icon="plus" @click="onAdd">新增通知渠道</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="items.length === 0" description="暂无通知渠道" />

    <van-cell-group v-else inset style="margin:12px">
      <van-cell v-for="item in items" :key="item.id" is-link @click="onEdit(item)">
        <template #title>
          <div style="font-weight:600">{{ item.name }}</div>
          <div style="font-size:12px;color:#969799">{{ channelLabel(item.type) }}</div>
        </template>
        <template #value>
          <van-tag :type="item.enabled ? 'success' : 'danger'" size="small">{{ item.enabled ? '启用' : '禁用' }}</van-tag>
          <van-icon name="delete" style="color:#ee0a24;margin-left:8px;font-size:16px" @click.stop="onDelete(item)" />
        </template>
      </van-cell>
    </van-cell-group>

    <van-popup v-model:show="showEdit" position="bottom" round :style="{ height: '90%' }" closeable :title="editing.id ? '编辑' : '新增'">
      <van-form @submit="onSave" style="padding:16px">
        <van-field v-model="editing.name" label="名称" :rules="[{ required: true }]" />
        <van-field name="type" label="类型">
          <template #input>
            <van-radio-group v-model="editing.type" direction="horizontal">
              <van-radio v-for="t in channelTypes" :key="t" :name="t" shape="square">{{ channelLabel(t) }}</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field name="enabled" label="启用">
          <template #input><van-switch v-model="editing.enabled!" /></template>
        </van-field>
        <van-field name="interactive" label="交互">
          <template #input><van-switch v-model="editing.interactive!" /></template>
        </van-field>

        <van-field v-if="editing.type === 'telegram'" v-model="editing.config!.token" label="Token" />
        <van-field v-if="editing.type === 'telegram'" v-model="editing.config!.chat_id" label="Chat ID" />
        <van-field v-if="editing.type === 'wechat'" v-model="editing.config!.corpid" label="CorpID" />
        <van-field v-if="editing.type === 'wechat'" v-model="editing.config!.corpsecret" label="CorpSecret" />
        <van-field v-if="editing.type === 'wechat'" v-model="editing.config!.agentid" label="AgentID" />
        <van-field v-if="editing.type === 'serverchan'" v-model="editing.config!.sckey" label="SendKey" />
        <van-field v-if="editing.type === 'bark'" v-model="editing.config!.server" label="Server" />
        <van-field v-if="editing.type === 'bark'" v-model="editing.config!.apikey" label="API Key" />
        <van-field v-if="editing.type === 'pushdeer'" v-model="editing.config!.server" label="Server" />
        <van-field v-if="editing.type === 'pushdeer'" v-model="editing.config!.apikey" label="API Key" />
        <van-field v-if="editing.type === 'pushplus'" v-model="editing.config!.token" label="Token" />
        <van-field v-if="editing.type === 'iyuu'" v-model="editing.config!.token" label="Token" />
        <van-field v-if="editing.type === 'slack'" v-model="editing.config!.bot_token" label="Bot Token" />
        <van-field v-if="editing.type === 'slack'" v-model="editing.config!.channel" label="Channel" />
        <van-field v-if="editing.type === 'gotify'" v-model="editing.config!.server" label="Server" />
        <van-field v-if="editing.type === 'gotify'" v-model="editing.config!.token" label="Token" />
        <van-field v-if="editing.type === 'chanify'" v-model="editing.config!.server" label="Server" />
        <van-field v-if="editing.type === 'chanify'" v-model="editing.config!.token" label="Token" />
        <van-field v-if="editing.type === 'synology'" v-model="editing.config!.webhook_url" label="Webhook URL" />

        <van-cell title="通知事件" is-link @click="showSwitches = !showSwitches" />
        <div v-if="showSwitches" style="padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:8px">
          <van-checkbox v-for="evt in notifyEvents" :key="evt" :model-value="editing.switches?.[evt]" shape="square" @click="toggleSwitch(evt)">{{ evt }}</van-checkbox>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px">
          <van-button block plain @click="onTest">测试</van-button>
          <van-button block type="primary" native-type="submit">保存</van-button>
        </div>
      </van-form>
    </van-popup>
  </div>
</template>
