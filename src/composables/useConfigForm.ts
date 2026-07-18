import { ref, type Ref } from 'vue'
import { getConfig, updateConfig, type AppConfig } from '@/api/config'
import { useModalStore } from '@/stores/modal'

export function useConfigForm() {
  const config = ref<AppConfig>({}) as Ref<AppConfig>
  const loading = ref(false)
  const saving = ref(false)
  const modal = useModalStore()

  async function load() {
    loading.value = true
    try {
      const res = await getConfig()
      if (res.code === 0) {
        config.value = res.config || {}
      }
    } catch {
      modal.error('加载配置失败')
    } finally {
      loading.value = false
    }
  }

  async function save(items: Record<string, unknown>, test = false): Promise<boolean> {
    saving.value = true
    try {
      const res = await updateConfig(items, test)
      if (res.code === 0) {
        if (!test) modal.success('保存成功')
        return true
      }
      modal.error(res.msg || '保存失败')
      return false
    } catch {
      modal.error('保存失败')
      return false
    } finally {
      saving.value = false
    }
  }

  return { config, loading, saving, load, save }
}
