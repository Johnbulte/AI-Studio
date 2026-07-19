export type AppPage = 'dashboard' | 'chat' | 'image' | 'video' | 'music' | 'membership' | 'projects' | 'settings'

export const navigationItems = [
  { page: 'dashboard', label: '创作工作台', nodeId: '26:773' },
  { page: 'chat', label: 'AI 对话', nodeId: '27:2094' },
  { page: 'image', label: 'AI 图片', nodeId: '29:2557' },
  { page: 'video', label: 'AI 视频', nodeId: '30:3867' },
  { page: 'music', label: 'AI 音乐', nodeId: '32:4671' },
  { page: 'membership', label: '会员', nodeId: '34:6875' },
  { page: 'projects', label: '项目', nodeId: '35:7974' },
] as const satisfies readonly { page: AppPage; label: string; nodeId: string }[]

export function pageForLabel(label: string): AppPage | undefined {
  return navigationItems.find((item) => item.label === label)?.page
}
