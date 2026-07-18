<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'

defineProps<{
  text: string
}>()
</script>

<template>
  <van-icon
    name="question-o"
    class="help-tip"
    :title="text"
    @click.stop="showToast(text)"
  />
</template>

<style scoped>
.help-tip {
  margin-left: 4px;
  color: #969799;
  cursor: help;
  vertical-align: middle;
  font-size: 14px;
}
</style>
