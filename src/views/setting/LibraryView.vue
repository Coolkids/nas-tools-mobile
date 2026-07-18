<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { doAction } from '@/api/request'

const { config, loading: cfgLoading, load: loadCfg } = useConfigForm()
const loading = ref(true)

const paths = reactive({
  media_movie_path: [] as string[],
  media_tv_path: [] as string[],
  media_anime_path: [] as string[],
  media_unknown_path: [] as string[],
})

const newPaths = reactive({
  movie: '', tv: '', anime: '', unknown: ''
})

onMounted(async () => {
  await loadCfg()
  if (config.value) {
    const c = config.value
    const mp = c.media?.movie_path
    paths.media_movie_path = Array.isArray(mp) ? mp as string[] : mp ? [String(mp)] : []
    const tp = c.media?.tv_path
    paths.media_tv_path = Array.isArray(tp) ? tp as string[] : tp ? [String(tp)] : []
    const ap = c.media?.anime_path
    paths.media_anime_path = Array.isArray(ap) ? ap as string[] : ap ? [String(ap)] : []
    const up = c.media?.unknown_path
    paths.media_unknown_path = Array.isArray(up) ? up as string[] : up ? [String(up)] : []
  }
  loading.value = false
})

async function addPath(key: string, value: string) {
  if (!value) { showToast('请输入路径'); return }
  try {
    const res = await doAction<{ code: number }>('update_directory', { oper: 'add', key, value })
    if (res.code === 0) {
      (paths as Record<string, string[]>)[key].push(value)
      showToast('添加成功')
    } else showToast('添加失败')
  } catch { showToast('添加失败') }
}

async function removePath(key: string, value: string) {
  try {
    const res = await doAction<{ code: number }>('update_directory', { oper: 'sub', key, value })
    if (res.code === 0) {
      const arr = (paths as Record<string, string[]>)[key]
      const idx = arr.indexOf(value)
      if (idx > -1) arr.splice(idx, 1)
      showToast('删除成功')
    } else showToast('删除失败')
  } catch { showToast('删除失败') }
}
</script>

<template>
  <div class="library page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <div v-else style="padding:12px">
      <van-cell-group inset v-for="(items, key) in {
        'media.movie_path': paths.media_movie_path,
        'media.tv_path': paths.media_tv_path,
        'media.anime_path': paths.media_anime_path,
        'media.unknown_path': paths.media_unknown_path,
      }" :key="key" :style="{ marginTop: key !== 'media.movie_path' ? '12px' : '0' }">
        <van-cell :title="{
          'media.movie_path': '电影目录',
          'media.tv_path': '电视剧目录',
          'media.anime_path': '动漫目录',
          'media.unknown_path': '未识别目录',
        }[key]" />
        <van-cell v-for="p in items" :key="p" :title="p">
          <template #right-icon>
            <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click="removePath(key, p)" />
          </template>
        </van-cell>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 16px">
          <van-field :model-value="newPaths[key.replace('media.', '')]" @update:model-value="(v: string) => newPaths[key.replace('media.', '') as keyof typeof newPaths] = v" placeholder="输入目录路径" style="flex:1" />
          <van-button size="small" type="primary" @click="addPath(key, newPaths[key.replace('media.', '') as keyof typeof newPaths])">添加</van-button>
        </div>
      </van-cell-group>
    </div>
  </div>
</template>
