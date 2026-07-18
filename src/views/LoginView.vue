<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { login } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const username = ref('')
const password = ref('')
const remember = ref(true)
const errorMsg = ref('')
const wallpaper = ref('')

const bgStyle = computed(() => {
  if (wallpaper.value) {
    return {
      backgroundImage: `url(data:image/jpg;base64,${wallpaper.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
  }
})

onMounted(async () => {
  username.value = ''
  password.value = ''
  try {
    const res = await fetch('/wallpaper')
    const data = await res.json()
    if (data.code === 0 && data.wallpaper) wallpaper.value = data.wallpaper
  } catch { /* ignore */ }
})

async function handleLogin() {
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const res = await login(username.value, password.value, remember.value)
    if (res.success) {
      const redirect = (route.query.redirect as string) || '/index'
      router.replace(redirect)
    } else {
      errorMsg.value = res.message || '登录失败'
    }
  } catch {
    errorMsg.value = '网络错误，请确认后端服务已启动'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page" :style="bgStyle">
    <div class="login-box" :class="{ 'is-glass': !!wallpaper }">
      <div class="login-logo">
        <van-icon name="tv-o" size="40" color="var(--van-primary-color)" />
        <h1>NAStool</h1>
      </div>

      <van-form @submit="handleLogin">
        <van-field
          v-model="username"
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          :rules="[{ required: true, message: '请输入用户名' }]"
          left-icon="contact"
        />
        <van-field
          v-model="password"
          type="password"
          name="password"
          label="密码"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
          left-icon="lock"
        />
        <div style="margin: 12px 0">
          <van-checkbox v-model="remember" shape="square">记住我</van-checkbox>
        </div>
        <div v-if="errorMsg" style="color: var(--van-danger-color); font-size: 13px; margin-bottom: 12px;">
          {{ errorMsg }}
        </div>
        <div style="margin: 16px 0">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="loading"
            loading-text="登录中..."
          >
            登录
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.login-box {
  width: 85%;
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 32px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.login-box.is-glass {
  background: rgba(255,255,255,0.5);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.login-logo {
  text-align: center;
  margin-bottom: 24px;
}
.login-logo h1 {
  margin: 12px 0 0;
  font-size: 24px;
  color: #323233;
}
</style>
