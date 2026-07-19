<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { useModalStore } from '@/stores/modal'
import { testConnection, getSystemConfig, setSystemConfig } from '@/api/config'

interface FieldDef {
  id: string
  required?: boolean
  title: string
  type: 'text' | 'password' | 'switch'
  placeholder?: string
}
interface DownloaderDef {
  type: string
  name: string
  img: string
  testCommand: string
  config: Record<string, FieldDef>
}

const DOWNLOADERS: DownloaderDef[] = [
  {
    type: 'qbittorrent', name: 'Qbittorrent', img: 'qbittorrent.png', testCommand: 'app.downloader.client.qbittorrent|Qbittorrent',
    config: {
      qbhost: { id: 'qbittorrent.qbhost', required: true, title: 'IP地址', type: 'text', placeholder: '127.0.0.1' },
      qbport: { id: 'qbittorrent.qbport', required: true, title: '端口', type: 'text', placeholder: '8080' },
      qbusername: { id: 'qbittorrent.qbusername', required: true, title: '用户名', type: 'text', placeholder: 'admin' },
      qbpassword: { id: 'qbittorrent.qbpassword', required: false, title: '密码', type: 'password', placeholder: 'adminadmin' },
      force_upload: { id: 'qbittorrent.force_upload', required: false, title: '自动强制作种', type: 'switch' },
      auto_management: { id: 'qbittorrent.auto_management', required: false, title: '自动管理模式', type: 'switch' }
    }
  },
  {
    type: 'transmission', name: 'Transmission', img: 'transmission.png', testCommand: 'app.downloader.client.transmission|Transmission',
    config: {
      trhost: { id: 'transmission.trhost', required: true, title: 'IP地址', type: 'text', placeholder: '127.0.0.1' },
      trport: { id: 'transmission.trport', required: true, title: '端口', type: 'text', placeholder: '9091' },
      trusername: { id: 'transmission.trusername', required: true, title: '用户名', type: 'text', placeholder: 'admin' },
      trpassword: { id: 'transmission.trpassword', required: false, title: '密码', type: 'password' }
    }
  },
  {
    type: 'client115', name: '115网盘', img: '115.jpg', testCommand: 'app.downloader.client.client115|Client115',
    config: {
      cookie: { id: 'client115.cookie', required: true, title: 'Cookie', type: 'text', placeholder: 'USERSESSIONID=xxx;...' }
    }
  },
  {
    type: 'aria2', name: 'Aria2', img: 'aria2.png', testCommand: 'app.downloader.client.aria2|Aria2',
    config: {
      host: { id: 'aria2.host', required: true, title: 'IP地址', type: 'text', placeholder: '127.0.0.1' },
      port: { id: 'aria2.port', required: true, title: '端口', type: 'text', placeholder: '6800' },
      secret: { id: 'aria2.secret', required: true, title: '令牌', type: 'text' }
    }
  },
  {
    type: 'pikpak', name: 'PikPak', img: 'pikpak.png', testCommand: 'app.downloader.client.pikpak|PikPak',
    config: {
      username: { id: 'pikpak.username', required: true, title: '用户名', type: 'text' },
      password: { id: 'pikpak.password', required: true, title: '密码', type: 'password' },
      proxy: { id: 'pikpak.proxy', required: false, title: '代理', type: 'text', placeholder: '127.0.0.1:7890' }
    }
  }
]

const { config, loading, load, save } = useConfigForm()
const modal = useModalStore()

const dialogVisible = ref(false)
const current = ref<DownloaderDef | null>(null)
const formValues = reactive<Record<string, unknown>>({})
const saving = ref(false)
const testing = ref(false)

const dirVisible = ref(false)
const dirList = ref<Array<{ type: string; category: string; save_path: string; container_path: string; label: string }>>([])

const speedVisible = ref(false)
const speedLoading = ref(false)
const speedSaving = ref(false)
const speedForm = reactive({
  qb_upload: '', qb_download: '', tr_upload: '', tr_download: '',
  ipv4: '', ipv6: '', bandwidth: '', residual_ratio: '', allocation: ''
})

onMounted(loadData)

async function loadData() {
  await load()
  syncConfig()
}

function getCfg(path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = config.value
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function activeType(): string {
  const pt = config.value.pt as Record<string, unknown> | undefined
  return (pt?.pt_client as string) || ''
}

function syncConfig() {
  dirList.value = (getCfg('downloaddir') as typeof dirList.value) || []
}

function openDownloader(d: DownloaderDef) {
  current.value = d
  for (const [key, f] of Object.entries(d.config)) {
    const v = getCfg(f.id)
    if (f.type === 'switch') formValues[key] = !!v
    else formValues[key] = v ?? ''
  }
  dialogVisible.value = true
}

function buildItems(): Record<string, unknown> {
  if (!current.value) return {}
  const items: Record<string, unknown> = { 'pt.pt_client': current.value.type }
  for (const [key, f] of Object.entries(current.value.config)) {
    items[f.id] = formValues[key]
  }
  return items
}

async function handleSave() {
  saving.value = true
  try {
    const ok = await save(buildItems())
    if (ok) dialogVisible.value = false
  } finally {
    saving.value = false
  }
}

async function handleTest() {
  testing.value = true
  try {
    const applied = await save(buildItems(), true)
    if (!applied) return
    const res = await testConnection(current.value!.testCommand)
    if (res.code === 0) modal.success('测试成功')
    else modal.error(res.msg || '测试失败')
  } finally {
    testing.value = false
  }
}

function openDir() {
  syncConfig()
  dirVisible.value = true
}

function addDir() {
  dirList.value.push({ type: '', category: '', save_path: '', container_path: '', label: '' })
}

function removeDir(idx: number) {
  dirList.value.splice(idx, 1)
}

async function saveDir() {
  const ok = await save({ downloaddir: dirList.value })
  if (ok) dirVisible.value = false
}

async function openSpeed() {
  speedVisible.value = true
  speedLoading.value = true
  try {
    const res = await getSystemConfig('SpeedLimit')
    if (res.code === 0 && res.value) {
      const v = res.value as Record<string, string>
      Object.keys(speedForm).forEach((k) => {
        speedForm[k as keyof typeof speedForm] = v[k] || ''
      })
    }
  } finally {
    speedLoading.value = false
  }
}

async function saveSpeed() {
  speedSaving.value = true
  try {
    const res = await setSystemConfig('SpeedLimit', { ...speedForm })
    if (res.code === 0) {
      modal.success('保存成功')
      speedVisible.value = false
    } else {
      modal.error(res.msg || '保存失败')
    }
  } finally {
    speedSaving.value = false
  }
}
</script>

<template>
  <div class="downloader page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <template v-else>
      <div class="section-title">选择下载器</div>
      <div class="dl-grid">
        <div
          v-for="d in DOWNLOADERS"
          :key="d.type"
          class="dl-card"
          :class="{ active: activeType() === d.type }"
          @click="openDownloader(d)"
        >
          <div class="dl-icon">
            <img :src="`/static/img/${d.img}`" :alt="d.name" />
          </div>
          <div class="dl-name">{{ d.name }}</div>
          <van-tag v-if="activeType() === d.type" type="success" size="small">默认</van-tag>
          <span v-else class="dl-hint">配置</span>
        </div>
      </div>

      <div class="action-bar">
        <van-button size="small" icon="folder-o" @click="openDir">下载目录</van-button>
        <van-button size="small" icon="clock-o" @click="openSpeed">播放限速</van-button>
      </div>
    </template>

    <van-popup v-model:show="dialogVisible" position="bottom" :style="{ height: '80%' }" closeable :title="current?.name || '下载器配置'">
      <van-form @submit="handleSave" style="padding:12px 16px 24px">
        <template v-for="[key, f] in Object.entries(current?.config || {})" :key="f.id">
          <van-field v-if="f.type !== 'switch'" v-model="formValues[key]" :label="f.title" :type="f.type === 'password' ? 'password' : 'text'" :placeholder="f.placeholder" :rules="f.required ? [{ required: true, message: `请填写${f.title}` }] : []" />
          <van-field v-else :name="key" :label="f.title">
            <template #input><van-switch v-model="formValues[key]" /></template>
          </van-field>
        </template>
        <div style="margin-top:16px;display:flex;gap:8px">
          <van-button plain type="default" style="flex:1" :loading="testing" @click="handleTest">测试</van-button>
          <van-button type="primary" style="flex:2" native-type="submit" :loading="saving">保存</van-button>
        </div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="dirVisible" position="bottom" :style="{ height: '80%' }" closeable title="下载目录配置">
      <div style="padding:12px 16px 24px;overflow-y:auto;max-height:calc(100% - 50px)">
        <div class="dir-help">根据类型及二级分类自动选择下载目录；二级分类来自基础设置中的二级分类策略</div>
        <div v-for="(d, idx) in dirList" :key="idx" class="dir-row">
          <div class="dir-fields">
            <van-field v-model="d.type" label="类型" placeholder="电影/电视剧/动漫" clearable />
            <van-field v-model="d.category" label="二级分类" placeholder="可选" clearable />
            <van-field v-model="d.save_path" label="下载保存目录" placeholder="/downloads" clearable />
            <van-field v-model="d.container_path" label="访问目录" placeholder="可选" clearable />
            <van-field v-model="d.label" label="分类标签" placeholder="可选" clearable />
          </div>
          <van-icon name="delete" class="dir-remove" @click="removeDir(idx)" />
        </div>
        <van-button size="small" icon="plus" @click="addDir" style="margin-top:8px">增加目录</van-button>
        <van-button block type="primary" style="margin-top:12px" @click="saveDir">保存目录配置</van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="speedVisible" position="bottom" :style="{ height: '80%' }" closeable title="播放限速设置">
      <van-loading v-if="speedLoading" size="20" style="padding:40px;text-align:center" />
      <van-form v-else @submit="saveSpeed" style="padding:12px 16px 24px;overflow-y:auto;max-height:calc(100% - 50px)">
        <div class="speed-section-label">Qbittorrent / Transmission</div>
        <van-field v-model="speedForm.qb_upload" label="Qb上传限速" placeholder="KB/s, 0或留空不启用" />
        <van-field v-model="speedForm.qb_download" label="Qb下载限速" placeholder="KB/s, 0或留空不启用" />
        <van-field v-model="speedForm.tr_upload" label="Tr上传限速" placeholder="KB/s, 0或留空不启用" />
        <van-field v-model="speedForm.tr_download" label="Tr下载限速" placeholder="KB/s, 0或留空不启用" />

        <div class="speed-section-label">不限速源地址</div>
        <van-field v-model="speedForm.ipv4" label="IPv4" placeholder="0.0.0.0/0" />
        <van-field v-model="speedForm.ipv6" label="IPv6" placeholder="::/0" />

        <div class="speed-section-label">自动限速设置</div>
        <van-field v-model="speedForm.bandwidth" label="上行带宽" placeholder="Mbps" />
        <van-field v-model="speedForm.residual_ratio" label="剩余比例" placeholder="0.5" />
        <van-field v-model="speedForm.allocation" label="分配比例" placeholder="1:1" />

        <van-button block type="primary" style="margin-top:16px" native-type="submit" :loading="speedSaving">保存限速设置</van-button>
      </van-form>
    </van-popup>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 15px;
  font-weight: 600;
  padding: 12px 12px 8px;
}

.dl-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 0 12px 12px;
}

.dl-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px 10px;
  background: #fff;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.dl-card.active {
  border-color: var(--van-primary-color, #1989fa);
}

.dl-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--van-background-2, #f7f8fa);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dl-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dl-name {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.dl-hint {
  font-size: 11px;
  color: var(--van-text-color-3, #999);
}

.action-bar {
  display: flex;
  gap: 8px;
  padding: 0 12px 12px;
}

.dir-help {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
  margin-bottom: 12px;
  line-height: 1.5;
}

.dir-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--van-border-color, #eee);
}

.dir-fields {
  flex: 1;
  min-width: 0;
}

.dir-remove {
  flex-shrink: 0;
  color: var(--van-danger-color, #ee0a24);
  font-size: 20px;
  padding: 8px;
  margin-top: 32px;
}

.speed-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--van-primary-color, #1989fa);
  padding: 12px 0 4px;
  border-bottom: 1px solid var(--van-border-color, #eee);
  margin-bottom: 4px;
}
</style>
