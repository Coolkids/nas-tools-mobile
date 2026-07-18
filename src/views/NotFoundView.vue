<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <van-empty
      image="error"
      description="抱歉，页面不存在"
    >
      <van-button round type="primary" size="small" @click="router.push('/index')">返回首页</van-button>
    </van-empty>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
</style>
