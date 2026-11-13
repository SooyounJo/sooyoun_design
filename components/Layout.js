import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'

const Scene = dynamic(() => import('./Scene'), { ssr: false })

const links = [
  { href: '/', label: '홈' },
  { href: '/about', label: '소개' },
  { href: '/work', label: '작업' },
]

export default function Layout({ children }) {
  const { pathname } = useRouter()

  return (
    <>
      <div className="stage" aria-hidden="true">
        <Scene />
      </div>
      <div className="shade" aria-hidden="true" />
      <header className="site-header">
        <Link className="brand" href="/">
          SOOYOUN
        </Link>
        <nav className="nav" aria-label="주요">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span>Three.js 기반</span>
        <span>Next.js · Yarn</span>
      </footer>
    </>
  )
}
