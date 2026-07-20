<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { refreshMessage } from '@/api/system'

const messages = ref<string[]>([])
const lstTime = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

function stopPolling() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

async function loadMessages() {
  try {
    const res = await refreshMessage(lstTime.value)
    if (res.code === 0) {
      lstTime.value = res.lst_time
      if (res.message?.length) {
        messages.value.push(...res.message)
      }
    }
  } catch {
    // ignore
  }
}

function startPolling() {
  stopPolling()
  loadMessages()
  timer = setTimeout(function tick() {
    loadMessages().finally(() => {
      timer = setTimeout(tick, 10000)
    })
  }, 10000)
}

onMounted(() => {
  messages.value = []
  lstTime.value = ''
  startPolling()
})

onUnmounted(stopPolling)
</script>

<template>
  <div class="page" style="padding: 12px">
    <div class="msg-body">
      <div v-if="messages.length === 0" class="msg-empty">
        <div class="msg-empty-icon">📬</div>
        <div class="msg-empty-text">暂无消息</div>
      </div>
      <div v-for="(msg, i) in messages" :key="i" class="msg-item" v-html="msg"></div>
    </div>
  </div>
</template>

<style scoped>
.msg-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #969799;
}
.msg-empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}
.msg-empty-text {
  font-size: 14px;
}
.msg-item {
  padding: 12px;
  border-radius: 8px;
  background: #f7f8fa;
  border-left: 3px solid #1989fa;
  font-size: 13px;
  line-height: 1.6;
  color: #323233;
  word-break: break-word;
}
.msg-item :deep(.time) {
  display: block;
  font-size: 11px;
  color: #969799;
  margin-bottom: 4px;
}
.msg-item :deep(.text) {
  display: block;
}
</style>
