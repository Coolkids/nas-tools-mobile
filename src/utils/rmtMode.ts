/**
 * 转移模式枚举，与后端 ModuleConf.RMT_MODES 对应
 * 后端历史记录接口的 RMT_MODE 字段返回的是 value 编码，展示时需映射为 label
 */
export const RMT_MODES = [
  { value: 'copy', label: '复制' },
  { value: 'link', label: '硬链接' },
  { value: 'softlink', label: '软链接' },
  { value: 'move', label: '移动' },
  { value: 'rclonecopy', label: 'Rclone复制' },
  { value: 'rclone', label: 'Rclone移动' },
  { value: 'miniocopy', label: 'Minio复制' },
  { value: 'minio', label: 'Minio移动' }
] as const

export type RmtMode = (typeof RMT_MODES)[number]['value']

const RMT_MODE_LABELS: Record<string, string> = Object.fromEntries(
  RMT_MODES.map(m => [m.value, m.label])
)

/** 转移模式编码转中文标签，未匹配时原样返回 */
export function rmtModeLabel(value?: string | null): string {
  if (!value) return ''
  return RMT_MODE_LABELS[value] ?? value
}
