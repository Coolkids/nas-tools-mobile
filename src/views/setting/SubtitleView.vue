<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfigForm } from '@/composables/useConfigForm'

type SubType = 'opensubtitles' | 'chinesesubfinder'

interface ServerType {
  type: SubType
  name: string
  img: string
}

const SERVERS: ServerType[] = [
  { type: 'opensubtitles', name: 'OpenSubtitles', img: 'opensubtitles.png' },
  { type: 'chinesesubfinder', name: 'ChineseSubFinder', img: 'chinesesubfinder.png' }
]

const { config, loading, load, save } = useConfigForm()

const dialogVisible = ref(false)
const currentType = ref<SubType | null>(null)
const form = reactive({
  enable: false,
  host: '',
  api_key: '',
  local_path: '',
  remote_path: ''
})

const saving = ref(false)

const activeServer = computed(() => {
  const sub = config.value.subtitle as Record<string, unknown> | undefined
  return sub?.server as string | undefined
})

function openDialog(type: SubType) {
  currentType.value = type
  const sub = config.value.subtitle as Record<string, Record<string, unknown>> | undefined
  if (type === 'opensubtitles') {
    form.enable = Boolean(sub?.opensubtitles?.enable)
  } else {
    const csf = sub?.chinesesubfinder || {}
    form.host = (csf.host as string) || ''
    form.api_key = (csf.api_key as string) || ''
    form.local_path = (csf.local_path as string) || ''
    form.remote_path = (csf.remote_path as string) || ''
  }
  dialogVisible.value = true
}

function buildItems(): Record<string, unknown> {
  const items: Record<string, unknown> = { 'subtitle.server': currentType.value }
  if (currentType.value === 'opensubtitles') {
    items['subtitle.opensubtitles.enable'] = form.enable
  } else {
    items['subtitle.chinesesubfinder.host'] = form.host
    items['subtitle.chinesesubfinder.api_key'] = form.api_key
    items['subtitle.chinesesubfinder.local_path'] = form.local_path
    items['subtitle.chinesesubfinder.remote_path'] = form.remote_path
  }
  return items
}

async function handleSave() {
  saving.value = true
  try {
    const ok = await save(buildItems())
    if (ok) dialogVisible.value = false
  } finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <div class="subtitle page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <template v-else>
      <div class="section-title">选择字幕服务</div>
      <div class="server-grid">
        <div
          v-for="s in SERVERS"
          :key="s.type"
          class="server-card"
          :class="{ active: activeServer === s.type }"
          @click="openDialog(s.type)"
        >
          <div class="server-icon">
            <img :src="`/static/img/${s.img}`" :alt="s.name" />
          </div>
          <div class="server-name">{{ s.name }}</div>
          <van-tag v-if="activeServer === s.type" type="success" size="small">使用中</van-tag>
          <span v-else class="server-hint">点击配置</span>
        </div>
      </div>

      <van-popup v-model:show="dialogVisible" position="bottom" :style="{ height: '65%' }" closeable :title="currentType === 'opensubtitles' ? 'OpenSubtitles' : 'ChineseSubFinder'">
        <van-form @submit="handleSave" style="padding:12px 16px 24px">
          <template v-if="currentType === 'opensubtitles'">
            <van-field name="enable" label="开启字幕下载">
              <template #input>
                <van-switch v-model="form.enable" />
              </template>
            </van-field>
          </template>
          <template v-else>
            <van-field v-model="form.host" label="服务器地址" placeholder="http://127.0.0.1:19035" />
            <van-field v-model="form.api_key" label="Api Key" placeholder="在ChineseSubFinder中生成" />
            <van-field v-model="form.local_path" label="本地路径" placeholder="可选" />
            <van-field v-model="form.remote_path" label="远程路径" placeholder="可选" />
          </template>
          <div style="margin-top:16px">
            <van-button block type="primary" native-type="submit" :loading="saving">保存</van-button>
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
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.server-card.active {
  border-color: var(--van-primary-color, #1989fa);
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

/* 手机竖屏：竖向列表展示；横屏及平板保持方块网格 */
@media (max-width: 767px) and (orientation: portrait) {
  .server-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .server-card {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }

  .server-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .server-name {
    flex: 1;
    text-align: left;
    font-size: 14px;
  }
}
</style>
