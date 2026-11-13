import Head from 'next/head'
import dynamic from 'next/dynamic'

const Portfolio = dynamic(() => import('../components/Portfolio'), { ssr: false })

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Pocket — 포트폴리오</title>
        <meta name="description" content="Sooyoun Jo 포트폴리오" />
      </Head>
      <Portfolio />
    </>
  )
}
