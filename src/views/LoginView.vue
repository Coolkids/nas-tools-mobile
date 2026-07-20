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
        <div class="logo-icon">
          <van-icon name="tv-o" size="36" color="var(--van-primary-color)" />
        </div>
        <h1>NAStool</h1>
        <p class="login-subtitle">智能媒体管理平台</p>
      </div>

      <van-form @submit="handleLogin">
        <div class="field-group">
          <div class="field-wrapper">
            <van-icon name="contact" class="field-icon" />
            <van-field
              v-model="username"
              name="username"
              placeholder="请输入用户名"
              :rules="[{ required: true, message: '请输入用户名' }]"
            />
          </div>
          <div class="field-wrapper">
            <van-icon name="lock" class="field-icon" />
            <van-field
              v-model="password"
              type="password"
              name="password"
              placeholder="请输入密码"
              :rules="[{ required: true, message: '请输入密码' }]"
            />
          </div>
        </div>

        <div class="options-row">
          <van-checkbox v-model="remember" shape="square" icon-size="16">记住我</van-checkbox>
        </div>

        <transition name="fade">
          <div v-if="errorMsg" class="error-msg">
            <van-icon name="info-o" size="14" />
            {{ errorMsg }}
          </div>
        </transition>

        <van-button
          round
          block
          type="primary"
          native-type="submit"
          :loading="loading"
          loading-text="登录中..."
          class="login-btn"
        >
          登录
        </van-button>
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
  width: 80%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  padding: 40px 28px 32px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.25);
}
@media (max-width: 400px) {
  .login-box {
    width: 100%;
    min-height: 100vh;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 32px 28px;
    box-shadow: none;
  }
  .login-page {
    padding: 0 16px;
  }
}
.login-box.is-glass {
  background: rgba(255,255,255,0.55);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}
.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--van-primary-color), #409eff);
  box-shadow: 0 6px 20px rgba(64,158,255,0.35);
  margin-bottom: 12px;
}
.logo-icon :deep(.van-icon) {
  color: #fff !important;
}
.login-logo h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--van-primary-color), #409eff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.login-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #969799;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}
.field-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f5f7fa;
  border-radius: 12px;
  padding: 0 14px;
  border: 1.5px solid transparent;
  transition: all 0.25s ease;
}
.field-wrapper:focus-within {
  border-color: var(--van-primary-color);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(64,158,255,0.12);
}
.field-icon {
  flex-shrink: 0;
  font-size: 18px;
  color: #969799;
  transition: color 0.25s ease;
}
.field-wrapper:focus-within .field-icon {
  color: var(--van-primary-color);
}
.field-wrapper :deep(.van-field) {
  flex: 1;
  padding: 12px 0;
  background: transparent;
}
.field-wrapper :deep(.van-field__body) {
  background: transparent;
}
.field-wrapper :deep(.van-field__control) {
  font-size: 15px;
  color: #323233;
}
.field-wrapper :deep(.van-field__control::placeholder) {
  color: #c8c9cc;
}
.field-wrapper :deep(.van-field__error-message) {
  display: none;
}
.field-wrapper :deep(.van-field--error) {
  border-color: var(--van-danger-color);
}

.options-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.options-row :deep(.van-checkbox__label) {
  font-size: 13px;
  color: #646566;
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #fef0f0;
  border-radius: 10px;
  color: var(--van-danger-color);
  font-size: 13px;
  margin-bottom: 16px;
}

.login-btn {
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 23px;
  box-shadow: 0 6px 20px rgba(64,158,255,0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
