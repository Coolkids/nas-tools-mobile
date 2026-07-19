<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfigForm } from '@/composables/useConfigForm'
import { useModalStore } from '@/stores/modal'
import { testConnection } from '@/api/config'

type ServerKeyType = 'emby' | 'jellyfin' | 'plex'

interface ServerField {
  key: string; label: string; placeholder?: string; inputType?: 'text' | 'password'; required?: boolean
}

interface ServerType {
  type: ServerKeyType; name: string; img: string; testCommand: string; fields: ServerField[]
}

const SERVERS: ServerType[] = [
  {
    type: 'emby', name: 'Emby', img: 'emby.png', testCommand: 'app.mediaserver.client.emby|Emby',
    fields: [
      { key: 'host', label: '服务器地址', placeholder: 'http://127.0.0.1:8096', required: true },
      { key: 'api_key', label: 'Api Key', required: true }
    ]
  },
  {
    type: 'jellyfin', name: 'Jellyfin', img: 'jellyfin.jpg', testCommand: 'app.mediaserver.client.jellyfin|Jellyfin',
    fields: [
      { key: 'host', label: '服务器地址', placeholder: 'http://127.0.0.1:8096', required: true },
      { key: 'api_key', label: 'Api Key', required: true }
    ]
  },
  {
    type: 'plex', name: 'Plex', img: 'plex.png', testCommand: 'app.mediaserver.client.plex|Plex',
    fields: [
      { key: 'host', label: '服务器地址', placeholder: 'http://127.0.0.1:32400', required: true },
      { key: 'token', label: 'X-Plex-Token' },
      { key: 'servername', label: '服务器名称' },
      { key: 'username', label: '用户名' },
      { key: 'password', label: '密码', inputType: 'password' }
    ]
  }
]

const modal = useModalStore()
const { config, loading, load, save } = useConfigForm()

const dialogVisible = ref(false)
const currentServer = ref<ServerType | null>(null)
const form = reactive<Record<string, string>>({})
const testing = ref(false)
const saving = ref(false)

const activeType = computed(() => {
  const media = config.value.media as Record<string, unknown> | undefined
  return media?.media_server as string | undefined
})

function serverConfig(type: string): Record<string, unknown> | undefined {
  return config.value[type] as Record<string, unknown> | undefined
}

function openDialog(server: ServerType) {
  currentServer.value = server
  const cfg = serverConfig(server.type) || {}
  server.fields.forEach(f => { form[f.key] = (cfg[f.key] as string) || '' })
  dialogVisible.value = true
}

function buildItems(): Record<string, unknown> {
  const items: Record<string, unknown> = { 'media.media_server': currentServer.value!.type }
  currentServer.value!.fields.forEach(f => { items[`${currentServer.value!.type}.${f.key}`] = form[f.key] ?? '' })
  return items
}

async function handleSave() {
  saving.value = true
  try {
    const ok = await save(buildItems())
    if (ok) dialogVisible.value = false
  } finally { saving.value = false }
}

async function handleTest() {
  testing.value = true
  try {
    const applied = await save(buildItems(), true)
    if (!applied) return
    const res = await testConnection(currentServer.value!.testCommand)
    if (res.code === 0) modal.success('测试成功')
    else modal.error(res.msg || '测试失败')
  } finally { testing.value = false }
}

onMounted(load)
</script>

<template>
  <div class="media-server page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <template v-else>
      <div class="section-title">选择媒体服务器</div>
      <div class="server-grid">
        <div v-for="s in SERVERS" :key="s.type" class="server-card" @click="openDialog(s)">
          <div class="server-icon">
            <img :src="`/static/img/${s.img}`" :alt="s.name" />
          </div>
          <div class="server-name">{{ s.name }}</div>
          <van-tag v-if="activeType === s.type" type="success" size="small">使用中</van-tag>
          <span v-else class="server-hint">点击配置</span>
        </div>
      </div>

      <van-popup v-model:show="dialogVisible" position="bottom" :style="{ height: '65%' }" closeable :title="currentServer?.name">
        <van-form @submit="handleSave" style="padding:12px 16px 24px">
          <van-field
            v-for="f in currentServer?.fields || []"
            :key="f.key"
            v-model="form[f.key]"
            :label="f.label"
            :type="f.inputType || 'text'"
            :placeholder="f.placeholder"
            :rules="f.required ? [{ required: true, message: `请填写${f.label}` }] : []"
          />
          <div style="margin-top:16px;display:flex;gap:8px">
            <van-button plain type="default" style="flex:1" :loading="testing" @click="handleTest">测试</van-button>
            <van-button type="primary" style="flex:2" native-type="submit" :loading="saving">保存</van-button>
          </div>
        </van-form>
      </van-popup>
    </template>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 15px;
  font-weight: 600;
  padding: 12px 12px 8px;
}

.server-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 0 12px 12px;
}

.server-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px 10px;
  background: #fff;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.server-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--van-background-2, #f7f8fa);
  display: flex;
  align-items: center;
  justify-content: center;
}

.server-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.server-name {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.server-hint {
  font-size: 11px;
  color: var(--van-text-color-3, #999);
}
</style>
