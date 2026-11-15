import { useEffect, useRef } from 'react'
import { cardImages, sections } from '../data/portfolio'
import { mountPortfolio } from './portfolioEngine'

export default function Portfolio({ web = false }) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const captionRef = useRef(null)
  const hintRef = useRef(null)
  const titleRef = useRef(null)
  const subRef = useRef(null)
  const infoRef = useRef(null)
  const backRef = useRef(null)
  const copyRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const stop = mountPortfolio({
      root,
      stage: stageRef.current,
      captionEl: captionRef.current,
      hintEl: hintRef.current,
      titleEl: titleRef.current,
      subEl: subRef.current,
      infoEl: infoRef.current,
      backBtn: backRef.current,
      copyBtn: copyRef.current,
    }, sections, cardImages, { web })

    return stop
  }, [web])

  return (
    <div ref={rootRef} className={web ? 'pocket' : 'pocket mode-card'}>
      <div id="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p id="brand">
        Desiger
        <br />
        Sooyoun Jo :)
      </p>
      <section id="info" ref={infoRef} aria-live="polite" />
      <button
        id="back"
        ref={backRef}
        type="button"
        aria-label="명함 화면으로 돌아가기"
        tabIndex={-1}
      >
        Back
      </button>
      <div id="stage" ref={stageRef} />
      <div id="titleWrap" aria-live="polite">
        <h1 id="title" ref={titleRef} />
        <p id="sub" ref={subRef} />
      </div>
      <footer>
        <button id="copy" ref={copyRef} type="button" aria-label="@soon_soon_ac 복사">
          @soon_soon_ac
        </button>
        <p id="caption" ref={captionRef} aria-live="polite">
          &nbsp;
        </p>
        <p id="hint" ref={hintRef}>카드를 탭해서 뒤집어보세요</p>
      </footer>
    </div>
  )
}
