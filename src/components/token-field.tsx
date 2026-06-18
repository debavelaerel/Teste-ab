'use client'
import { useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  value: string | undefined
}

export function TokenField({ value }: Props) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!value) {
    return <span className="text-xs text-muted-foreground">(não configurado)</span>
  }

  const masked =
    value.length <= 8
      ? '•'.repeat(value.length)
      : value.slice(0, 4) + '•'.repeat(value.length - 8) + value.slice(-4)

  const token = value

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
        {revealed ? value : masked}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setRevealed(v => !v)}
        title={revealed ? 'Ocultar' : 'Mostrar'}
        className="text-muted-foreground hover:text-foreground"
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        title="Copiar"
        className="text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  )
}
