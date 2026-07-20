<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { getLogging, type LogEntry } from '@/api/system'

const logs = ref<LogEntry[]>([])
const paused = ref(false)
const activeSource = ref('')
const logBody = ref<HTMLElement | null>(null)
const showSourcePicker = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const LOG_SOURCES = ['All', 'System', 'Rss', 'Rmt', 'Meta', 'Sync', 'Sites', 'Brush', 'Douban', 'Spider', 'Message', 'Indexer', 'Searcher', 'Subscribe', 'Downloader', 'TorrentRemover']

function stopPolling() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

async function loadLogs() {
  try {
    const res = await getLogging(logs.value.length, activeSource.value)
    if (res.loglist?.length) {
      logs.value.push(...res.loglist)
      await nextTick()
      if (logBody.value) {
        logBody.value.scrollTop = logBody.value.scrollHeight
      }
    }
  } catch {
    // ignore
  }
}

function startPolling() {
  stopPolling()
  loadLogs()
  if (!paused.value) {
    timer = setTimeout(function tick() {
      loadLogs().finally(() => {
        if (!paused.value) {
          timer = setTimeout(tick, 2000)
        }
      })
    }, 2000)
  }
}

function togglePause() {
  paused.value = !paused.value
  if (!paused.value) {
    startPolling()
  } else {
    stopPolling()
  }
}

function selectSource(s: string) {
  showSourcePicker.value = false
  activeSource.value = s === 'All' ? '' : s
  logs.value = []
  startPolling()
}

function levelType(level: string): 'primary' | 'success' | 'warning' | 'danger' | undefined {
  if (level === 'INFO') return 'success'
  if (level === 'WARN') return 'warning'
  if (level === 'ERROR') return 'danger'
  return undefined
}

onMounted(() => {
  logs.value = []
  activeSource.value = ''
  paused.value = false
  startPolling()
})

onUnmounted(stopPolling)
</script>

<template>
  <div class="page" style="padding: 12px">
    <div class="log-toolbar">
      <van-button size="small" plain @click="showSourcePicker = true">
        {{ activeSource || 'All' }}
        <van-icon name="arrow-down" />
      </van-button>
      <van-button size="small" :type="paused ? 'primary' : 'warning'" @click="togglePause">
        {{ paused ? '开始' : '暂停' }}
      </van-button>
    </div>
    <div ref="logBody" class="log-body">
      <div v-for="(log, i) in logs" :key="i" class="log-entry">
        <span class="log-time">{{ log.time }}</span>
        <van-tag :type="levelType(log.level)" size="small" class="log-source">{{ log.source }}</van-tag>
        <span class="log-text">{{ log.text }}</span>
      </div>
      <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
    </div>
    <van-action-sheet
      v-model:show="showSourcePicker"
      :actions="LOG_SOURCES.map(s => ({ name: s }))"
      cancel-text="取消"
      close-on-click-action
      @select="(a: { name: string }) => selectSource(a.name)"
    />
  </div>
</template>

<style scoped>
.log-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.log-body {
  min-height: calc(100vh - 120px);
  overflow-y: auto;
  background: #f7f8fa;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
}
.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 4px;
  border-bottom: 1px solid #ebedf0;
  line-height: 1.5;
}
.log-entry:last-child {
  border-bottom: none;
}
.log-time {
  flex-shrink: 0;
  font-family: monospace;
  color: #969799;
  font-size: 11px;
  min-width: 72px;
}
.log-source {
  flex-shrink: 0;
}
.log-text {
  flex: 1;
  word-break: break-all;
  color: #323233;
}
.log-empty {
  text-align: center;
  color: #969799;
  padding: 40px 0;
}
</style>
