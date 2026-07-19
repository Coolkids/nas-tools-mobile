<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'
import { useModalStore } from '@/stores/modal'

interface FieldDef {
  id: string
  required?: boolean
  title: string
  type: 'text' | 'password' | 'switch' | 'select'
  placeholder?: string
  default?: string
  options?: Record<string, string>
}
interface ChannelDef {
  id: string
  name: string
  img?: string
  search_type?: boolean
  config: Record<string, FieldDef>
}

const CHANNEL_IMG: Record<string, string> = {
  telegram: 'telegram.png', wechat: 'wechat.png', serverchan: 'serverchan.png',
  bark: 'bark.webp', pushdeer: 'pushdeer.png', pushplus: 'pushplus.jpg',
  iyuu: 'iyuu.png', slack: 'slack.png', gotify: 'gotify.png',
  chanify: 'chanify.png', synologychat: 'synologychat.png'
}

function channelImg(id: string): string {
  return CHANNEL_IMG[id] ? `/static/img/${CHANNEL_IMG[id]}` : ''
}

interface MessageClient {
  id: number
  name: string
  type: string
  config: Record<string, unknown>
  switchs: string[]
  interactive: number
  enabled: number
}

const SWITCHS = [
  { id: 'download_start', name: '新增下载' },
  { id: 'download_fail', name: '下载失败' },
  { id: 'transfer_finished', name: '入库完成' },
  { id: 'transfer_fail', name: '入库失败' },
  { id: 'rss_added', name: '新增订阅' },
  { id: 'rss_finished', name: '订阅完成' },
  { id: 'site_signin', name: '站点签到' },
  { id: 'site_message', name: '站点消息' },
  { id: 'brushtask_added', name: '刷流下种' },
  { id: 'brushtask_remove', name: '刷流删种' },
  { id: 'mediaserver_message', name: '媒体服务' },
  { id: 'custom_message', name: '自定义消息' }
]

const CHANNELS: ChannelDef[] = [
  {
    id: 'telegram', name: 'Telegram', search_type: true,
    config: {
      token: { id: 'telegram_token', required: true, title: 'Bot Token', type: 'text' },
      chat_id: { id: 'telegram_chat_id', required: true, title: 'Chat ID', type: 'text' },
      user_ids: { id: 'telegram_user_ids', required: false, title: 'User IDs', type: 'text', placeholder: '使用,分隔多个Id' },
      admin_ids: { id: 'telegram_admin_ids', required: false, title: 'Admin IDs', type: 'text', placeholder: '使用,分隔多个Id' },
      webhook: { id: 'telegram_webhook', required: false, title: 'Webhook', type: 'switch' }
    }
  },
  {
    id: 'wechat', name: '微信', search_type: true,
    config: {
      corpid: { id: 'wechat_corpid', required: true, title: '企业ID', type: 'text' },
      corpsecret: { id: 'wechat_corpsecret', required: true, title: '应用Secret', type: 'text' },
      agentid: { id: 'wechat_agentid', required: true, title: '应用ID', type: 'text' },
      default_proxy: { id: 'wechat_default_proxy', required: false, title: '消息推送代理', type: 'text', placeholder: 'https://wechat.nastool.cn' },
      token: { id: 'wechat_token', required: false, title: 'Token', type: 'text', placeholder: 'API接收消息Token' },
      encodingAESKey: { id: 'wechat_encodingAESKey', required: false, title: 'EncodingAESKey', type: 'text' }
    }
  },
  {
    id: 'serverchan', name: 'Server酱',
    config: {
      sckey: { id: 'serverchan_sckey', required: true, title: 'SCKEY', type: 'text', placeholder: 'SCT...' }
    }
  },
  {
    id: 'bark', name: 'Bark',
    config: {
      server: { id: 'bark_server', required: true, title: '服务器地址', type: 'text', placeholder: 'https://api.day.app', default: 'https://api.day.app' },
      apikey: { id: 'bark_apikey', required: true, title: 'API Key', type: 'text' },
      params: { id: 'bark_params', required: false, title: '附加参数', type: 'text', placeholder: 'group=xxx&sound=xxx' }
    }
  },
  {
    id: 'pushdeer', name: 'PushDeer',
    config: {
      server: { id: 'pushdeer_server', required: true, title: '服务器地址', type: 'text', placeholder: 'https://api2.pushdeer.com', default: 'https://api2.pushdeer.com' },
      apikey: { id: 'pushdeer_apikey', required: true, title: 'API Key', type: 'text' }
    }
  },
  {
    id: 'pushplus', name: 'PushPlus',
    config: {
      token: { id: 'pushplus_token', required: true, title: 'Token', type: 'text' },
      channel: { id: 'pushplus_channel', required: true, title: '推送渠道', type: 'select', options: { wechat: '微信', mail: '邮箱', webhook: '第三方Webhook' }, default: 'wechat' },
      topic: { id: 'pushplus_topic', required: false, title: '群组编码', type: 'text' },
      webhook: { id: 'pushplus_webhook', required: false, title: 'Webhook编码', type: 'text' }
    }
  },
  {
    id: 'iyuu', name: '爱语飞飞',
    config: {
      token: { id: 'iyuumsg_token', required: true, title: '令牌Token', type: 'text', placeholder: '登录https://iyuu.cn获取' }
    }
  },
  {
    id: 'slack', name: 'Slack', search_type: true,
    config: {
      bot_token: { id: 'slack_bot_token', required: true, title: 'Bot User OAuth Token', type: 'text', placeholder: 'xoxb-...' },
      app_token: { id: 'slack_app_token', required: true, title: 'App-Level Token', type: 'text', placeholder: 'xapp-...' },
      channel: { id: 'slack_channel', required: false, title: '频道名称', type: 'text', placeholder: '全体' }
    }
  },
  {
    id: 'gotify', name: 'Gotify',
    config: {
      server: { id: 'gotify_server', required: true, title: '服务器地址', type: 'text', placeholder: 'http://localhost:8800' },
      token: { id: 'gotify_token', required: true, title: '令牌Token', type: 'text' },
      priority: { id: 'gotify_priority', required: false, title: '消息Priority', type: 'text', placeholder: '8' }
    }
  },
  {
    id: 'chanify', name: 'Chanify',
    config: {
      server: { id: 'chanify_server', required: true, title: '服务器地址', type: 'text', placeholder: 'https://api.chanify.net', default: 'https://api.chanify.net' },
      token: { id: 'chanify_token', required: true, title: '令牌', type: 'text' }
    }
  },
  {
    id: 'synologychat', name: 'Synology Chat', search_type: true,
    config: {
      webhook_url: { id: 'synologychat_webhook_url', required: true, title: '机器人传入URL', type: 'text', placeholder: 'https://xxx/webapi/entry.cgi?api=xxx' },
      token: { id: 'synologychat_token', required: true, title: '令牌', type: 'text' }
    }
  }
]

const modal = useModalStore()
const list = ref<MessageClient[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const saving = ref(false)
const testing = ref(false)
const form = reactive({
  cid: '',
  name: '',
  type: CHANNELS[0].id,
  enabled: 1,
  interactive: 1,
  switchs: SWITCHS.map(s => s.id),
  config: {} as Record<string, unknown>
})

const customVisible = ref(false)
const customSending = ref(false)
const customForm = reactive({ title: '', text: '', image: '' })

const currentChannel = computed(() => CHANNELS.find(c => c.id === form.type) || CHANNELS[0])

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; detail: Record<string, MessageClient> }>('get_message_client', {})
    if (res.code === 0 && res.detail) {
      list.value = Object.values(res.detail)
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function channelName(type: string) {
  return CHANNELS.find(c => c.id === type)?.name || type
}

function switchNames(switchs: string[]) {
  return switchs.map(s => SWITCHS.find(sw => sw.id === s)?.name || s)
}

function resetConfigFields() {
  const cfg: Record<string, unknown> = {}
  for (const [key, f] of Object.entries(currentChannel.value.config)) {
    if (f.type === 'switch') cfg[key] = !!f.default
    else cfg[key] = f.default || ''
  }
  form.config = cfg
}

function openAdd() {
  form.cid = ''
  form.name = ''
  form.type = CHANNELS[0].id
  form.enabled = 1
  form.interactive = 1
  form.switchs = SWITCHS.map(s => s.id)
  resetConfigFields()
  dialogVisible.value = true
}

function openEdit(row: MessageClient) {
  form.cid = String(row.id)
  form.name = row.name
  form.type = row.type
  form.enabled = row.enabled
  form.interactive = row.interactive
  form.switchs = row.switchs && row.switchs.length ? [...row.switchs] : SWITCHS.map(s => s.id)
  const cfg: Record<string, unknown> = {}
  const ch = CHANNELS.find(c => c.id === row.type)
  if (ch) {
    for (const [key, f] of Object.entries(ch.config)) {
      const v = row.config?.[key]
      if (f.type === 'switch') cfg[key] = !!v
      else cfg[key] = v ?? f.default ?? ''
    }
  }
  form.config = cfg
  dialogVisible.value = true
}

function onTypeChange() {
  resetConfigFields()
}

function buildParams() {
  const configObj: Record<string, unknown> = {}
  for (const [key, f] of Object.entries(currentChannel.value.config)) {
    if (f.type === 'switch') configObj[key] = form.config[key] ? 1 : 0
    else configObj[key] = form.config[key] ?? ''
  }
  return {
    cid: form.cid,
    name: form.name,
    type: form.type,
    config: JSON.stringify(configObj),
    switchs: form.switchs,
    enabled: form.enabled,
    interactive: form.interactive
  }
}

function selectAllSwitchs(flag: boolean) {
  form.switchs = flag ? SWITCHS.map(s => s.id) : []
}

function invertSwitchs() {
  form.switchs = SWITCHS.filter(s => !form.switchs.includes(s.id)).map(s => s.id)
}

async function submit() {
  if (!form.name) { modal.warning('名称不能为空'); return }
  for (const [, f] of Object.entries(currentChannel.value.config)) {
    if (f.required && f.type !== 'switch') {
      const key = Object.entries(currentChannel.value.config).find(([, v]) => v.id === f.id)?.[0]
      if (key && !form.config[key]) { modal.warning(`${f.title}不能为空`); return }
    }
  }
  saving.value = true
  try {
    const res = await doAction<{ code: number; msg?: string }>('update_message_client', buildParams())
    if (res.code === 0) {
      dialogVisible.value = false
      modal.success('保存成功')
      load()
    } else {
      modal.error(res.msg || '保存失败')
    }
  } catch { modal.error('保存失败') }
  finally { saving.value = false }
}

async function test() {
  testing.value = true
  try {
    const res = await doAction<{ code: number; msg?: string }>('test_message_client', buildParams())
    if (res.code === 0) modal.success('测试成功')
    else modal.error('测试失败')
  } finally { testing.value = false }
}

async function toggle(row: MessageClient, flag: 'interactive' | 'enable', checked: boolean) {
  const res = await doAction<{ code: number }>('check_message_client', {
    flag, cid: row.id, checked, type: row.type
  })
  if (res.code === 0) {
    if (flag === 'interactive') row.interactive = checked ? 1 : 0
    else row.enabled = checked ? 1 : 0
    load()
  }
}

async function remove(row: MessageClient) {
  const ok = await modal.confirm(`确认删除消息服务「${row.name}」？`)
  if (!ok) return
  const res = await doAction<{ code: number }>('delete_message_client', { cid: row.id })
  if (res.code === 0) {
    modal.success('删除成功')
    load()
  }
}

function openCustom() {
  customForm.title = ''
  customForm.text = ''
  customForm.image = ''
  customVisible.value = true
}

async function sendCustom() {
  if (!customForm.title) { modal.warning('标题不能为空'); return }
  customSending.value = true
  try {
    const res = await doAction<{ code: number; msg?: string }>('send_custom_message', {
      title: customForm.title, text: customForm.text, image: customForm.image
    })
    if (res.code === 0) {
      modal.success('自定义消息已发送')
      customVisible.value = false
    }
  } finally { customSending.value = false }
}
</script>

<template>
  <div class="notification page">
    <div class="toolbar">
      <van-button size="small" icon="friends-o" @click="openCustom">自定义消息</van-button>
      <van-button size="small" type="primary" icon="plus" @click="openAdd">新增通知</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="list.length === 0" description="暂无通知渠道" />

    <div v-else class="list">
      <div v-for="row in list" :key="row.id" class="item">
        <div class="item-head" @click="openEdit(row)">
          <img v-if="channelImg(row.type)" class="item-icon" :src="channelImg(row.type)" :alt="channelName(row.type)" />
          <div class="item-info">
            <div class="item-name">{{ row.name }}</div>
            <div class="item-type">{{ channelName(row.type) }}</div>
          </div>
        </div>
        <div class="item-switchs">
          <van-tag v-for="s in switchNames(row.switchs)" :key="s" size="small" plain class="item-tag">{{ s }}</van-tag>
        </div>
        <div class="item-actions">
          <label class="item-toggle-label">
            <span>交互</span>
            <van-switch
              v-if="CHANNELS.find(c => c.id === row.type)?.search_type"
              :model-value="row.interactive === 1"
              size="20"
              @change="(v: boolean) => toggle(row, 'interactive', v)"
            />
          </label>
          <label class="item-toggle-label">
            <span>启用</span>
            <van-switch
              :model-value="row.enabled === 1"
              size="20"
              @change="(v: boolean) => toggle(row, 'enable', v)"
            />
          </label>
          <van-icon name="delete" class="item-delete" @click="remove(row)" />
        </div>
      </div>
    </div>

    <van-popup v-model:show="dialogVisible" position="bottom" :style="{ height: '92%' }" closeable :title="form.cid ? '编辑消息通知' : '新增消息通知'">
      <div style="padding:4px 16px 24px;overflow-y:auto;max-height:calc(100% - 50px)">
        <van-form @submit="submit">
          <van-field v-model="form.name" label="名称" placeholder="别名" :rules="[{ required: true, message: '名称不能为空' }]" />

          <van-field name="enabled" label="状态">
            <template #input>
              <van-radio-group v-model="form.enabled" direction="horizontal">
                <van-radio :name="1" shape="square">启用</van-radio>
                <van-radio :name="0" shape="square">停用</van-radio>
              </van-radio-group>
            </template>
          </van-field>

          <van-field v-if="currentChannel.search_type" name="interactive" label="交互">
            <template #input>
              <van-radio-group v-model="form.interactive" direction="horizontal">
                <van-radio :name="1" shape="square">是</van-radio>
                <van-radio :name="0" shape="square">否</van-radio>
              </van-radio-group>
            </template>
          </van-field>

          <van-field name="type" label="类型">
            <template #input>
              <div class="channel-grid">
                <label
                  v-for="c in CHANNELS"
                  :key="c.id"
                  class="channel-item"
                  :class="{ active: form.type === c.id }"
                >
                  <input class="channel-radio" type="radio" name="channel_type" :value="c.id" @change="onTypeChange" v-model="form.type" />
                  <img v-if="channelImg(c.id)" class="channel-icon" :src="channelImg(c.id)" :alt="c.name" />
                  <span class="channel-label">{{ c.name }}</span>
                </label>
              </div>
            </template>
          </van-field>

          <template v-for="[key, f] in Object.entries(currentChannel.config)" :key="f.id">
            <van-field v-if="f.type === 'switch'" :name="key" :label="f.title">
              <template #input><van-switch v-model="form.config[key]" /></template>
            </van-field>
            <van-field v-else-if="f.type === 'select'" :name="key" :label="f.title">
              <template #input>
                <van-radio-group v-model="form.config[key]" direction="horizontal">
                  <van-radio v-for="(lbl, val) in f.options" :key="val" :name="val" shape="square">{{ lbl }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field v-else v-model="form.config[key]" :label="f.title" :type="f.type === 'password' ? 'password' : 'text'" :placeholder="f.placeholder" :rules="f.required ? [{ required: true, message: `请填写${f.title}` }] : []" />
          </template>

          <div class="push-head">
            <span class="push-title">推送设置</span>
            <div class="push-actions">
              <van-button size="small" type="default" @click="selectAllSwitchs(true)">全选</van-button>
              <van-button size="small" type="default" @click="selectAllSwitchs(false)">全不选</van-button>
              <van-button size="small" type="default" @click="invertSwitchs">反选</van-button>
            </div>
          </div>
          <van-checkbox-group v-model="form.switchs" class="switch-group">
            <van-checkbox v-for="s in SWITCHS" :key="s.id" :name="s.id" shape="square" class="switch-item">{{ s.name }}</van-checkbox>
          </van-checkbox-group>

          <div style="margin-top:16px;display:flex;gap:8px">
            <van-button plain type="default" style="flex:1" :loading="testing" @click="test">测试</van-button>
            <van-button type="primary" style="flex:2" native-type="submit" :loading="saving">保存</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <van-popup v-model:show="customVisible" position="center" :style="{ width: '85%' }" closeable title="发送自定义消息">
      <van-form @submit="sendCustom" style="padding:16px">
        <van-field v-model="customForm.title" label="标题" :rules="[{ required: true, message: '请输入标题' }]" />
        <van-field v-model="customForm.image" label="图片" placeholder="图片URL" />
        <van-field v-model="customForm.text" label="内容" type="textarea" rows="3" />
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit" :loading="customSending">发送</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  flex-wrap: wrap;
}

.list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.item-head {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.item-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: contain;
  background: var(--van-background-2, #f7f8fa);
  flex-shrink: 0;
  padding: 4px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  font-size: 14px;
}

.item-type {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
}

.item-switchs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 0 0;
}

.item-tag {
  font-size: 11px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--van-border-color, #eee);
  margin-top: 8px;
}

.item-toggle-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--van-text-color-2, #666);
}

.item-delete {
  margin-left: auto;
  color: var(--van-danger-color, #ee0a24);
  font-size: 18px;
}

.channel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.channel-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid var(--van-border-color, #eee);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}

.channel-item.active {
  border-color: var(--van-primary-color, #1989fa);
  background: var(--van-primary-color-light, #f0f5ff);
}

.channel-radio {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.channel-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.channel-label {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.push-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-top: 8px;
  border-top: 1px solid var(--van-border-color, #eee);
}

.push-title {
  font-size: 13px;
  font-weight: 600;
}

.push-actions {
  display: flex;
  gap: 4px;
}

.push-actions .van-button {
  font-size: 11px;
  padding: 0 8px;
  height: 28px;
  line-height: 28px;
}

.switch-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

.switch-item {
  margin: 0;
  font-size: 12px;
}
</style>
