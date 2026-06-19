'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, FileText, Settings, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Experimentos',
    icon: FlaskConical,
    href: (slug: string) => `/org/${slug}`,
    isActive: (path: string, slug: string) =>
      path === `/org/${slug}` || path.startsWith(`/org/${slug}/experiments`),
  },
  {
    label: 'Eventos',
    icon: Activity,
    href: (slug: string) => `/org/${slug}/events`,
    isActive: (path: string, slug: string) => path.startsWith(`/org/${slug}/events`),
  },
  {
    label: 'Docs',
    icon: FileText,
    href: (slug: string) => `/org/${slug}/docs`,
    isActive: (path: string, slug: string) => path.startsWith(`/org/${slug}/docs`),
  },
  {
    label: 'Configurações',
    icon: Settings,
    href: (slug: string) => `/org/${slug}/settings`,
    isActive: (path: string, slug: string) => path.startsWith(`/org/${slug}/settings`),
  },
]

interface Props {
  orgSlug: string
}

export function SidebarNav({ orgSlug }: Props) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ label, icon: Icon, href, isActive }) => (
        <Link
          key={label}
          href={href(orgSlug)}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            isActive(pathname, orgSlug)
              ? 'bg-primary-subtle text-primary font-medium'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
