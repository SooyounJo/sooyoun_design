import Head from 'next/head'

export default function QrPage() {
  return (
    <>
      <Head>
        <title>QR</title>
      </Head>
      <main className="qr-page">
        <img src="/qr.png" alt="QR 코드" />
      </main>
    </>
  )
}
