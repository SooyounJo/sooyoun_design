import Head from 'next/head'

const works = [
  {
    year: '2026',
    title: '빛결',
    text: '표면이 천천히 일렁이는 인터랙티브 조각 스터디.',
  },
  {
    year: '2026',
    title: '여백',
    text: '어두운 공간에 입자만 남겨 깊이를 만드는 배경 장면.',
  },
  {
    year: '2025',
    title: '궤도',
    text: '금속 고리와 작은 위성이 같은 축을 도는 구성.',
  },
]

export default function WorkPage() {
  return (
    <>
      <Head>
        <title>작업 · SOOYOUN</title>
      </Head>
      <section className="page">
        <p className="eyebrow">작업</p>
        <h1>
          장면으로 남은
          <br />
          <em>스터디</em>
        </h1>
        <ul className="work-list">
          {works.map((work) => (
            <li className="card" key={work.title}>
              <span>{work.year}</span>
              <h2>{work.title}</h2>
              <p>{work.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
