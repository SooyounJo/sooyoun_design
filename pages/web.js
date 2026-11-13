import Head from 'next/head'
import dynamic from 'next/dynamic'

const Portfolio = dynamic(() => import('../components/Portfolio'), { ssr: false })

export default function WebPage() {
  return (
    <>
      <Head>
        <title>Web</title>
      </Head>
      <Portfolio web />
    </>
  )
}
