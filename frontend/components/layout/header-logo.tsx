'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export function HeaderLogo() {
  const pathname = usePathname()

  function handleClick(e: React.MouseEvent) {
    if (pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <Link href="/" onClick={handleClick} aria-label="Vault home">
      <Logo size="md" showWordmark />
    </Link>
  )
}
