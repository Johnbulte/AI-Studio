type Navigate = (label: string) => void

const sidebarItems = [
  ['创作工作台', 'nav-workspace.svg'],
  ['AI 对话', 'nav-chat.svg'],
  ['AI 图片', 'nav-image.svg'],
  ['AI 视频', 'nav-video.svg'],
  ['AI 音乐', 'nav-music.svg'],
  ['素材库', 'nav-library.svg'],
  ['项目', 'nav-projects.svg'],
  ['会员', 'nav-membership.svg'],
  ['设置', 'settings.svg'],
] as const

function BrandMark() {
  return (
    <span className="chat-brand-mark" aria-hidden="true">
      <span className="chat-brand-mark-inner">
        <span className="chat-brand-mark-crop">
          <img data-testid="brand-art" src="/figma/chat/brand-art.png" alt="" />
        </span>
      </span>
    </span>
  )
}

export function AppSidebar({ active, onNavigate, onSettings, accountName }: { active: string; onNavigate: Navigate; onSettings: () => void; accountName?: string }) {
  return (
    <aside className="app-sidebar" aria-label="主导航栏">
      <header className="chat-brand"><BrandMark /><strong>AI Studio OS</strong></header>
      <nav className="chat-nav-list" aria-label="主导航">
        {sidebarItems.map(([label, icon], index) => {
          const isActive = label === active
          const isUnavailable = label === '素材库'
          const isSettings = label === '设置'
          return (
            <button
              className={`chat-nav-button ${isActive ? 'is-active' : ''} ${index === 5 ? 'starts-secondary' : ''} ${isSettings ? 'starts-settings' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-pressed={isActive}
              disabled={isUnavailable}
              title={isUnavailable ? `${label}（即将开放）` : label}
              key={label}
              onClick={() => isSettings ? onSettings() : onNavigate(label)}
              type="button"
            >
              <img src={`/figma/dashboard/${icon}`} alt="" />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>
      <section className="chat-account" aria-label="账户与会员额度">
        <div className="chat-account-row">
          <img className="chat-account-avatar" src="/figma/dashboard/avatar.jpg" alt="创意无限头像" />
          <span className="chat-account-name">{accountName || '创意无限'}</span>
          <span className="chat-member-badge">会员</span>
          <img className="chat-account-chevron" src="/figma/dashboard/chevron-right.svg" alt="" />
        </div>
        <div className="chat-quota-row"><span>2450 / 5000</span><button type="button" aria-label="充值积分"><img src="/figma/dashboard/plus-small.svg" alt="" /></button></div>
        <div className="chat-quota-track"><span /></div>
        <footer className="chat-account-actions">
          <button type="button" aria-label="设置" onClick={onSettings}><img src="/figma/dashboard/settings.svg" alt="" /></button>
          <button type="button" aria-label="通知"><img src="/figma/dashboard/notifications.svg" alt="" /></button>
          <button type="button" aria-label="帮助"><img src="/figma/dashboard/help.svg" alt="" /></button>
        </footer>
      </section>
    </aside>
  )
}
