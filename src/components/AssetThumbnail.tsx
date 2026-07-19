type AssetThumbnailProps = {
  name: string
  category: string
  tone: 'lilac' | 'coral' | 'cyan' | 'gold'
}

export function AssetThumbnail({ name, category, tone }: AssetThumbnailProps) {
  return <article className={`asset-thumbnail tone-${tone}`}>
    <div aria-label={name} className="asset-preview" role="img"><span /><i /></div>
    <strong>{name}</strong>
    <small>{category}</small>
  </article>
}
