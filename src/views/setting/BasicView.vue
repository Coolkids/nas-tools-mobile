<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'

const { config, loading, saving, load, save } = useConfigForm()
onMounted(load)

async function onSave(key: string, value: unknown) {
  await save({ [key]: value })
}
</script>

<template>
  <div class="basic page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <div v-else>
      <van-cell-group inset style="margin:12px">
        <van-cell title="基础设置" />
        <van-field
          v-for="(val, key) in config" :key="key"
          :label="key"
          :model-value="JSON.stringify(val)"
          readonly
        />
      </van-cell-group>
    </div>
  </div>
</template>
