import { defineStore } from 'pinia'
import { showToast, showConfirmDialog, showDialog, showLoadingToast, closeToast } from 'vant'

interface ModalState {
  loading: boolean
  loadingText: string
  progressVisible: boolean
  progressValue: number
  progressText: string
}

export const useModalStore = defineStore('modal', {
  state: (): ModalState => ({
    loading: false,
    loadingText: '',
    progressVisible: false,
    progressValue: 0,
    progressText: ''
  }),
  actions: {
    showLoading(text = '处理中...') {
      this.loading = true
      this.loadingText = text
      showLoadingToast({
        message: text,
        forbidClick: true,
        duration: 0
      })
    },
    hideLoading() {
      this.loading = false
      this.loadingText = ''
      closeToast()
    },
    showProgress(text = '') {
      this.progressVisible = true
      this.progressValue = 0
      this.progressText = text
    },
    setProgress(value: number, text?: string) {
      this.progressValue = Math.max(0, Math.min(100, value))
      if (text !== undefined) this.progressText = text
    },
    hideProgress() {
      this.progressVisible = false
      this.progressValue = 0
      this.progressText = ''
    },
    success(msg: string) {
      showToast({ message: msg, type: 'success' })
    },
    error(msg: string) {
      showToast({ message: msg, type: 'fail' })
    },
    warning(msg: string) {
      showToast({ message: msg, type: 'warning' })
    },
    info(msg: string) {
      showToast(msg)
    },
    async confirm(msg: string, title = '确认操作'): Promise<boolean> {
      try {
        await showConfirmDialog({ title, message: msg, confirmButtonText: '确定', cancelButtonText: '取消' })
        return true
      } catch {
        return false
      }
    },
    async alert(msg: string, title = '提示'): Promise<void> {
      await showDialog({ title, message: msg })
    }
  }
})
