<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'

interface CustomWord {
  id: number
  group_id: number
  group_name?: string
  tmdb_id?: string
  tmdb_type?: string
  replaced: string
  replace: string
  front: string
  back: string
  offset: number
  offset_type?: string
  season: number
  enabled: boolean
  regex: string
  [key: string]: unknown
}

interface WordGroup {
  id: number
  name: string
  tmdb_id?: string
  tmdb_type?: string
  note?: string
  words: CustomWord[]
}

const modal = useModalStore()
const loading = ref(false)
const groups = ref<WordGroup[]>([])
const showAddWord = ref(false)
const showAddGroup = ref(false)
const editingWord = ref<Partial<CustomWord>>({})
const editingGroup = ref({ name: '', tmdb_id: '', tmdb_type: 'movie' as const })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; detail: WordGroup[] }>('get_customwords', {})
    if (res.code === 0) groups.value = res.detail || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAddWord(group: WordGroup) {
  editingWord.value = {
    group_id: group.id, group_name: group.name,
    replaced: '', replace: '', front: '', back: '', offset: 0,
    season: 0, enabled: true, regex: '0'
  }
  showAddWord.value = true
}

async function onSaveWord() {
  try {
    const res = await doAction<{ code: number; msg?: string }>('add_or_edit_custom_word', editingWord.value)
    if (res.code === 0) { showToast('保存成功'); showAddWord.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}

async function onDeleteWord(word: CustomWord) {
  const ok = await modal.confirm('确认删除该识别词？')
  if (!ok) return
  try {
    await doAction('delete_custom_word', { id: word.id })
    showToast('删除成功'); load()
  } catch { showToast('删除失败') }
}

async function onAddGroup() {
  editingGroup.value = { name: '', tmdb_id: '', tmdb_type: 'movie' }
  showAddGroup.value = true
}

async function onSaveGroup() {
  if (!editingGroup.value.name) { showToast('请输入组名'); return }
  try {
    await doAction('add_custom_word_group', editingGroup.value)
    showToast('创建成功'); showAddGroup.value = false; load()
  } catch { showToast('创建失败') }
}

async function onDeleteGroup(group: WordGroup) {
  const ok = await modal.confirm(`确认删除分组「${group.name}」？`)
  if (!ok) return
  try {
    await doAction('delete_custom_word_group', { id: group.id })
    showToast('删除成功'); load()
  } catch { showToast('删除失败') }
}

function wordTypeLabel(word: CustomWord) {
  const r = word.replace ? '替换' : ''
  const o = word.offset ? '+偏移' : ''
  return (word.replaced ? '屏蔽 ' : '') + r + o || '替换'
}
</script>

<template>
  <div class="custom-words page">
    <div style="padding:8px 12px">
      <van-button block type="primary" icon="plus" @click="onAddGroup">新增分组</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="groups.length === 0" description="暂无自定义识别词" />

    <div v-else style="padding:0 12px 12px;display:flex;flex-direction:column;gap:12px">
      <van-card v-for="g in groups" :key="g.id" :title="g.name" :desc="g.note || g.tmdb_id ? `TMDB:${g.tmdb_id || ''} ${g.tmdb_type || ''}` : ''">
        <template #tags>
          <div v-for="w in g.words" :key="w.id" style="display:inline-flex;align-items:center;gap:4px;margin:2px">
            <van-tag size="small" closable @close="onDeleteWord(w)">{{ w.replaced || w.replace || wordTypeLabel(w) }}</van-tag>
          </div>
          <van-tag size="small" type="primary" style="cursor:pointer" @click="onAddWord(g)">+</van-tag>
        </template>
        <template #footer>
          <van-button size="small" plain type="danger" @click="onDeleteGroup(g)">删除分组</van-button>
        </template>
      </van-card>
    </div>

    <van-popup v-model:show="showAddWord" position="bottom" round :style="{ height: '70%' }" closeable title="识别词">
      <van-form @submit="onSaveWord" style="padding:16px">
        <van-field name="type" label="类型">
          <template #input>
            <van-radio-group v-model="editingWord.type" direction="horizontal">
              <van-radio name="" shape="square">替换</van-radio>
              <van-radio name="BLOCK" shape="square">屏蔽</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="editingWord.replaced" label="被替换词" placeholder="被替换的文本" />
        <van-field v-model="editingWord.replace" label="替换词" placeholder="替换为" />
        <van-field v-model="editingWord.front" label="定位词-前" placeholder="定位词" />
        <van-field v-model="editingWord.back" label="定位词-后" placeholder="定位词" />
        <van-field v-model="editingWord.offset" label="集偏移" placeholder="0" type="number" />
        <van-field name="season" label="季">
          <template #input>
            <van-stepper v-model="editingWord.season!" min="0" max="99" />
          </template>
        </van-field>
        <van-field name="regex" label="正则">
          <template #input><van-switch v-model="editingWord.regex!" true-value="1" false-value="0" /></template>
        </van-field>
        <van-field name="enabled" label="启用">
          <template #input><van-switch v-model="editingWord.enabled!" /></template>
        </van-field>
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">保存</van-button></div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="showAddGroup" position="bottom" round :style="{ height: '40%' }" closeable title="新增分组">
      <van-form @submit="onSaveGroup" style="padding:16px">
        <van-field v-model="editingGroup.name" label="分组名" :rules="[{ required: true, message: '请输入分组名' }]" />
        <van-field v-model="editingGroup.tmdb_id" label="TMDB ID" placeholder="可选" />
        <van-field name="tmdb_type" label="类型">
          <template #input>
            <van-radio-group v-model="editingGroup.tmdb_type" direction="horizontal">
              <van-radio name="movie" shape="square">电影</van-radio>
              <van-radio name="tv" shape="square">电视剧</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit">创建</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>
