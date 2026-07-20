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
      <div class="brand-panel">
        <div class="login-logo">
          <div class="logo-icon">
            <van-icon name="tv-o" size="30" color="#fff" />
          </div>
          <div class="logo-text">
            <h1>NAStool</h1>
            <p class="login-subtitle">智能媒体管理平台</p>
          </div>
        </div>
        <div class="brand-extra">
          <p class="brand-slogan">一站式 NAS 媒体管理</p>
          <ul class="brand-features">
            <li><van-icon name="play-circle-o" /> 影音订阅与下载</li>
            <li><van-icon name="exchange" /> 自动整理与重命名</li>
            <li><van-icon name="bell" /> 实时消息通知</li>
          </ul>
        </div>
      </div>

      <div class="form-panel">
        <h2 class="form-title">登录账号</h2>
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
  </div>
</template>

<style scoped>
/* ========== 基础布局（手机竖屏优先） ========== */
.login-page {
  position: relative;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  padding:
    calc(20px + env(safe-area-inset-top, 0px))
    calc(20px + env(safe-area-inset-right, 0px))
    calc(20px + env(safe-area-inset-bottom, 0px))
    calc(20px + env(safe-area-inset-left, 0px));
  overflow-y: auto;
  background-color: #16213e;
}

/* 背景压暗层，提升卡片可读性 */
.login-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, rgba(10, 14, 30, 0.15) 0%, rgba(10, 14, 30, 0.45) 100%);
  pointer-events: none;
}

.login-box {
  position: relative;
  margin: auto;
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 22px;
  padding: clamp(28px, 7vw, 40px) clamp(22px, 6vw, 32px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
  animation: box-in 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.login-box.is-glass {
  background: rgba(255, 255, 255, 0.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.45);
}

@keyframes box-in {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ========== 品牌区 ========== */
.login-logo {
  text-align: center;
  margin-bottom: clamp(20px, 5vw, 32px);
}
.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 17px;
  background: linear-gradient(135deg, var(--van-primary-color), #409eff);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.35);
  margin-bottom: 12px;
}
.login-logo h1 {
  margin: 0;
  font-size: clamp(24px, 6vw, 28px);
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

/* 宽屏分栏时才展示的扩展品牌内容 */
.brand-extra {
  display: none;
}
.form-title {
  display: none;
}

/* ========== 表单区 ========== */
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
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
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
  min-width: 0;
  padding: 12px 0;
  background: transparent;
}
.field-wrapper :deep(.van-field__body) {
  background: transparent;
}
.field-wrapper :deep(.van-field__control) {
  font-size: 16px;
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
  --van-button-primary-background: linear-gradient(135deg, var(--van-primary-color), #409eff);
  --van-button-primary-border-color: transparent;
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.35);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ========== 平板竖屏 ========== */
@media (min-width: 768px) {
  .login-box {
    max-width: 440px;
    padding: 44px 40px;
  }
  .logo-icon {
    width: 68px;
    height: 68px;
    border-radius: 19px;
  }
  .login-logo h1 {
    font-size: 30px;
  }
  .login-subtitle {
    font-size: 14px;
  }
  .login-btn {
    height: 48px;
    font-size: 17px;
  }
}

/* ========== 宽屏横屏（平板横屏 / 桌面）：左右分栏 ========== */
@media (min-width: 1024px) and (orientation: landscape) {
  .login-box {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    max-width: 860px;
    padding: 0;
    overflow: hidden;
  }
  .brand-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 36px;
    padding: 56px 48px;
    background: linear-gradient(150deg, rgba(25, 137, 250, 0.88), rgba(15, 52, 96, 0.88));
  }
  .login-logo {
    text-align: left;
    margin-bottom: 0;
  }
  .login-logo h1 {
    background: none;
    -webkit-text-fill-color: #fff;
    color: #fff;
    font-size: 34px;
  }
  .login-subtitle {
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
  }
  .brand-extra {
    display: block;
  }
  .brand-slogan {
    margin: 0 0 20px;
    font-size: 22px;
    font-weight: 600;
    color: #fff;
    line-height: 1.5;
  }
  .brand-features {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .brand-features li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
  }
  .brand-features .van-icon {
    font-size: 18px;
  }
  .form-panel {
    padding: 56px 48px;
    background: rgba(255, 255, 255, 0.78);
  }
  .form-title {
    display: block;
    margin: 0 0 24px;
    font-size: 22px;
    font-weight: 600;
    color: #323233;
  }
}

/* ========== 手机横屏（矮高度）：紧凑模式 ========== */
@media (orientation: landscape) and (max-height: 600px) and (max-width: 1023.98px) {
  .login-page {
    padding:
      calc(12px + env(safe-area-inset-top, 0px))
      calc(16px + env(safe-area-inset-right, 0px))
      calc(12px + env(safe-area-inset-bottom, 0px))
      calc(16px + env(safe-area-inset-left, 0px));
  }
  .login-box {
    max-width: 580px;
    padding: 20px 24px;
    border-radius: 18px;
  }
  .login-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    margin-bottom: 16px;
  }
  .logo-icon {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    margin-bottom: 0;
  }
  .logo-icon :deep(.van-icon) {
    font-size: 22px !important;
  }
  .login-logo h1 {
    font-size: 20px;
  }
  .login-subtitle {
    margin-top: 2px;
    font-size: 12px;
  }
  .field-group {
    flex-direction: row;
    gap: 12px;
    margin-bottom: 12px;
  }
  .field-wrapper {
    flex: 1 1 0;
    min-width: 0;
  }
  .options-row {
    margin-bottom: 12px;
  }
  .error-msg {
    padding: 8px 12px;
    margin-bottom: 12px;
  }
  .login-btn {
    height: 42px;
    font-size: 15px;
  }
}

/* ========== 小屏手机（窄屏） ========== */
@media (max-width: 360px) {
  .login-page {
    padding: 14px;
  }
  .login-box {
    padding: 24px 18px;
    border-radius: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-box {
    animation: none;
  }
}
</style>
