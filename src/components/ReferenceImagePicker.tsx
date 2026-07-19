import { useRef, useState, type ChangeEvent } from 'react'

export type ReferenceImage = {
  id: string
  name: string
  src: string
}

type ReferenceImagePickerProps = {
  addLabel: string
  fileLabel: string
  removeLabel: string
  heading: string
  helper: string
  initialImages?: ReferenceImage[]
  maxFiles?: number
  maxFileSize?: number
  className?: string
  onChange?: (images: ReferenceImage[]) => void
}

const DEFAULT_MAX_FILES = 3
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

const readAsDataUrl = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
  reader.onerror = () => resolve('')
  reader.readAsDataURL(file)
})

const createImageId = (file: File) => `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`

export function ReferenceImagePicker({
  addLabel,
  fileLabel,
  removeLabel,
  heading,
  helper,
  initialImages = [],
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  className = '',
  onChange,
}: ReferenceImagePickerProps) {
  const [images, setImages] = useState<ReferenceImage[]>(initialImages)
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const updateImages = (nextImages: ReferenceImage[]) => {
    setImages(nextImages)
    onChange?.(nextImages)
  }

  const addImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const available = maxFiles - images.length
    const accepted: ReferenceImage[] = []
    let nextMessage = ''

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        nextMessage = '仅支持上传图片文件'
        continue
      }
      if (file.size > maxFileSize) {
        nextMessage = `${file.name} 超过 10MB`
        continue
      }
      if (accepted.length >= available) {
        nextMessage = `最多添加 ${maxFiles} 张${addLabel.replace(/^添加/, '')}`
        continue
      }

      const src = await readAsDataUrl(file)
      if (!src) {
        nextMessage = `${file.name} 读取失败`
        continue
      }
      accepted.push({ id: createImageId(file), name: file.name, src })
    }

    if (accepted.length > 0) updateImages([...images, ...accepted])
    setMessage(nextMessage)
  }

  const removeImage = (id: string) => {
    updateImages(images.filter((image) => image.id !== id))
    setMessage('')
  }

  return (
    <div className={`image-reference-group ${className}`.trim()} aria-label={`${heading}设置`}>
      <div className="image-reference-heading"><label>{heading}</label><span>{helper}</span></div>
      <div className="image-reference-picker">
        {images.map((image) => (
          <div className="image-reference-item" key={image.id}>
            <img src={image.src} alt={`${heading.replace(/（可选）$/, '')} ${image.name}`} />
            <button type="button" aria-label={`${removeLabel} ${image.name}`} onClick={() => removeImage(image.id)}>×</button>
          </div>
        ))}
        <button className="image-reference-add" type="button" aria-label={addLabel} disabled={images.length >= maxFiles} onClick={() => inputRef.current?.click()}><span>＋</span>{addLabel}</button>
      </div>
      <input ref={inputRef} className="image-reference-input" type="file" accept="image/*" multiple aria-label={fileLabel} onChange={addImages} />
      {message && <p className="image-reference-status" role="status">{message}</p>}
    </div>
  )
}
