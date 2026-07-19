<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'
import { testConnection } from '@/api/config'

type IndexerType = 'builtin' | 'jackett' | 'prowlarr'

interface IndexerItem { id: string; name: string }

interface ExternalServer {
  type: 'jackett' | 'prowlarr'
  name: string
  img: string
  testCommand: string
  fields: { key: string; label: string; placeholder?: string; inputType?: 'text' | 'password'; required?: boolean }[]
}

const EXTERNAL_SERVERS: ExternalServer[] = [
  {
    type: 'jackett', name: 'Jackett', img: 'jackett.png', testCommand: 'app.indexer.client.jackett|Jackett',
    fields: [
      { key: 'host', label: 'Jackett地址', placeholder: 'http://127.0.0.1:9117', required: true },
      { key: 'api_key', label: 'Api Key', required: true },
      { key: 'password', label: '密码', inputType: 'password' }
    ]
  },
  {
    type: 'prowlarr', name: 'Prowlarr', img: 'prowlarr.png', testCommand: 'app.indexer.client.prowlarr|Prowlarr',
    fields: [
      { key: 'host', label: 'Prowlarr地址', placeholder: 'http://127.0.0.1:9696', required: true },
      { key: 'api_key', label: 'Api Key', required: true }
    ]
  }
]

const BUILTIN_IMG = 'indexer.jpg'

const modal = useModalStore()
const { config, loading, load, save } = useConfigForm()
const dialogVisible = ref(false)
const currentType = ref<IndexerType | null>(null)
const currentExternal = ref<ExternalServer | null>(null)

const indexers = ref<IndexerItem[]>([])
const indexersLoading = ref(false)
const selectedSites = ref<string[]>([])
const externalForm = reactive<Record<string, string>>({})
const testing = ref(false)
const saving = ref(false)

const isAllSelected = computed(() =>
  indexers.value.length > 0 && selectedSites.value.length === indexers.value.length
)

function toggleAll(val: boolean) {
  selectedSites.value = val ? indexers.value.map(i => i.id) : []
}

const activeIndexer = computed(() => {
  const pt = config.value.pt as Record<string, unknown> | undefined
  return (pt?.search_indexer as string) || ''
})

function savedSites(): string[] {
  const pt = config.value.pt as Record<string, unknown> | undefined
  return Array.isArray(pt?.indexer_sites) ? (pt.indexer_sites as string[]) : []
}

function externalConfig(type: string): Record<string, unknown> | undefined {
  return config.value[type] as Record<string, unknown> | undefined
}

async function openBuiltin() {
  currentType.value = 'builtin'
  currentExternal.value = null
  selectedSites.value = [...savedSites()]
  if (indexers.value.length === 0) {
    indexersLoading.value = true
    try {
      const res = await doAction<{ code: number; indexers?: IndexerItem[] }>('get_indexers', {})
      if (res.code === 0 && Array.isArray(res.indexers)) indexers.value = res.indexers
    } catch { modal.error('获取索引器列表失败') }
    finally { indexersLoading.value = false }
  }
  dialogVisible.value = true
}

function openExternal(server: ExternalServer) {
  currentType.value = server.type
  currentExternal.value = server
  const cfg = externalConfig(server.type) || {}
  server.fields.forEach(f => { externalForm[f.key] = (cfg[f.key] as string) || '' })
  dialogVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (currentType.value === 'builtin') {
      const ok = await save({ 'pt.search_indexer': 'builtin', 'pt.indexer_sites': selectedSites.value })
      if (ok) { dialogVisible.value = false; await load() }
      return
    }
    if (!currentExternal.value) return
    const items: Record<string, unknown> = { 'pt.search_indexer': currentExternal.value.type }
    currentExternal.value.fields.forEach(f => { items[`${currentExternal.value!.type}.${f.key}`] = externalForm[f.key] ?? '' })
    const ok = await save(items)
    if (ok) { dialogVisible.value = false; await load() }
  } finally { saving.value = false }
}

async function handleTest() {
  if (!currentExternal.value) return
  testing.value = true
  try {
    const items: Record<string, unknown> = { 'pt.search_indexer': currentExternal.value.type }
    currentExternal.value.fields.forEach(f => { items[`${currentExternal.value!.type}.${f.key}`] = externalForm[f.key] ?? '' })
    const applied = await save(items, true)
    if (!applied) return
    const res = await testConnection(currentExternal.value.testCommand)
    if (res.code === 0) modal.success('测试成功')
    else modal.error(res.msg || '测试失败')
  } finally { testing.value = false }
}

onMounted(load)
</script>

<template>
  <div class="indexer page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <template v-else>
      <div class="section-title">选择索引器</div>
      <div class="server-grid">
        <div class="server-card" @click="openBuiltin">
          <div class="server-icon">
            <img :src="`/static/img/${BUILTIN_IMG}`" alt="内建索引器" />
          </div>
          <div class="server-name">内建索引器</div>
          <van-tag v-if="activeIndexer === 'builtin'" type="success" size="small">使用中</van-tag>
          <span v-else class="server-hint">点击配置</span>
        </div>
        <div
          v-for="s in EXTERNAL_SERVERS"
          :key="s.type"
          class="server-card"
          @click="openExternal(s)"
        >
          <div class="server-icon">
            <img :src="`/static/img/${s.img}`" :alt="s.name" />
          </div>
          <div class="server-name">{{ s.name }}</div>
          <van-tag v-if="activeIndexer === s.type" type="success" size="small">使用中</van-tag>
          <span v-else class="server-hint">点击配置</span>
        </div>
      </div>

      <van-popup v-model:show="dialogVisible" position="bottom" :style="{ height: currentType === 'builtin' ? '80%' : '60%' }" closeable :title="currentType === 'builtin' ? '内建索引器' : (currentExternal?.name || '')">
        <!-- builtin -->
        <div v-if="currentType === 'builtin'" style="padding:12px 16px 24px;overflow-y:auto;max-height:calc(100% - 50px)">
          <div class="builtin-header">
            <span class="field-label">索引站点</span>
            <van-checkbox :model-value="isAllSelected" shape="square" @update:model-value="toggleAll">全选</van-checkbox>
          </div>
          <van-loading v-if="indexersLoading" size="16" style="padding:20px;text-align:center" />
          <van-empty v-else-if="indexers.length === 0" description="暂无可用索引站点" />
          <van-checkbox-group v-else v-model="selectedSites" class="site-group">
            <van-checkbox v-for="i in indexers" :key="i.id" :name="i.id" shape="square" class="site-item">{{ i.name }}</van-checkbox>
          </van-checkbox-group>
          <van-button block type="primary" style="margin-top:16px" :loading="saving" @click="handleSave">保存</van-button>
        </div>

        <!-- external -->
        <van-form v-else-if="currentExternal" @submit="handleSave" style="padding:12px 16px 24px">
          <van-field
            v-for="f in currentExternal.fields"
            :key="f.key"
            v-model="externalForm[f.key]"
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

.builtin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
}

.site-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.site-item {
  margin: 0;
}
</style>
