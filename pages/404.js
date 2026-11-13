import Head from 'next/head'
import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>페이지를 찾을 수 없습니다 · SOOYOUN</title>
      </Head>
      <section className="page">
        <p className="eyebrow">404</p>
        <h1>
          이 주소에는
          <br />
          <em>장면이 없습니다</em>
        </h1>
        <Link className="button" href="/">
          홈으로
        </Link>
      </section>
    </>
  )
}
