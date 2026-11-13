import Head from 'next/head'

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>소개 · SOOYOUN</title>
      </Head>
      <article className="page">
        <p className="eyebrow">소개</p>
        <h1>
          정적인 페이지 위에
          <br />
          <em>살아 있는 장면</em>
        </h1>
        <div className="prose">
          <p>
            이 사이트는 Next.js 페이지 라우터와 React로 구성되어 있고, 모든 화면의
            바닥에는 Three.js 캔버스가 깔려 있습니다. 라우트가 바뀌어도 장면은
            이어집니다.
          </p>
          <p>
            조각, 고리, 입자는 별도의 모델 파일 없이 코드로 만들어집니다. 조명과
            재질만 바꿔도 분위기를 바꿀 수 있는 출발점입니다.
          </p>
        </div>
        <dl className="facts">
          <div>
            <dt>스택</dt>
            <dd>Next.js · React · Three.js</dd>
          </div>
          <div>
            <dt>라우터</dt>
            <dd>Pages Router</dd>
          </div>
          <div>
            <dt>언어</dt>
            <dd>JavaScript</dd>
          </div>
        </dl>
      </article>
    </>
  )
}
