import * as THREE from 'three'

export function mountPortfolio(els, sections, cardImages, options = {}) {
  const startInWeb = !!options.web
  const { root, stage, captionEl, hintEl, titleEl, subEl, infoEl, backBtn, copyBtn } = els
  const CARD_IMG = cardImages
  let rafId = 0
  let cursorRaf = 0
  let observer = null
  let cur = null
  let tapMarkTimer = null
  let alive = true
  const windowListeners = []
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler)
    windowListeners.push(() => target.removeEventListener(type, handler))
  }


  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 섹션 데이터: 나중에 실제 페이지와 연결할 부분
  // 프로젝트 목록 (피그마 '크리에이티브 작업 공간'에서 가져옴). img는 대표 이미지
  let current = 0;

  // 팔레트
  const C = {
    shell:  0xD6D6D3,  // 무광 라이트 그레이 하우징
    cap:    0xE6E6E3,  // 라이트 그레이 키캡
    orange: 0xC8380A,  // 포인트 오렌지 (진하게)
    well:   0x161616,  // 안쪽 블랙 플레이트
    legend: '#707170',
    legendOnOrange: '#F6EDE6',
    dot:    '#FF6A2E'
  };

  // ---------- 렌더러 ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const dom = renderer.domElement
  dom.tabIndex = 0;
  dom.setAttribute('aria-label', '명함. Space로 뒤집기, 뒷면에서 Enter로 웹 보기');
  stage.appendChild(dom);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

  // ---------- 스튜디오 환경광 (소프트박스) ----------
  (function makeEnv() {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x4a4b4a);
    const box = (w, h, color, pos, look) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(...look); env.add(m);
    };
    box(14, 8, 0xffffff, [0, 9, 4], [0, 0, 0]);        // 위쪽 큰 소프트박스
    box(6, 10, 0xd8d8d8, [-9, 2, 4], [0, 0, 0]);       // 왼쪽 필
    box(4, 10, 0x9a9a9a, [9, 1, 2], [0, 0, 0]);        // 오른쪽 약한 필
    box(20, 6, 0x4a4a4a, [0, -8, 0], [0, 0, 0]);       // 바닥 반사
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
  })();

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(-2.5, 5, 9);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.radius = 18;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.02;
  Object.assign(keyLight.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(5, 2, -4); scene.add(rim);

  // ---------- 비드블라스트 질감 (노이즈 범프맵) ----------
  function grainTexture(size, contrast) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const img = x.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (Math.random() - 0.5) * contrast;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // 살짝 뭉개서 알갱이를 둥글게
    x.globalAlpha = 0.5; x.filter = 'blur(0.6px)'; x.drawImage(c, 0, 0); x.filter = 'none';
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }
  const grain = grainTexture(512, 230);

  const matte = (color, rough = 0.62, bump = 0.006) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: rough, metalness: 0, bumpMap: grain, bumpScale: bump, envMapIntensity: 0.7
  });

  // ---------- 지오메트리 헬퍼 ----------
  function rrPath(P, w, h, r, cx = 0, cy = 0) {
    const x = cx - w / 2, y = cy - h / 2;
    P.moveTo(x + r, y);
    P.lineTo(x + w - r, y); P.quadraticCurveTo(x + w, y, x + w, y + r);
    P.lineTo(x + w, y + h - r); P.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    P.lineTo(x + r, y + h); P.quadraticCurveTo(x, y + h, x, y + h - r);
    P.lineTo(x, y + r); P.quadraticCurveTo(x, y, x + r, y);
    return P;
  }
  const extrude = (shape, depth, bevel, segs = 8) => new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 32
  });
  function slab(w, h, r, depth, bevel, segs) {
    const g = extrude(rrPath(new THREE.Shape(), w, h, r), depth, bevel, segs);
    g.center(); return g;
  }
  const shadowy = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  const device = new THREE.Group();   // 하단 키 모듈 (< enter >)
  scene.add(device);

  // ---------- 키 모듈: 실버 프레임 + 블랙 웰 ----------
  const MOD = { w: 4.3, h: 1.62, r: 0.3 };
  const WELL = { w: 3.95, h: 1.2, r: 0.18 };
  const BACK_FRONT = 0.23;   // 안쪽 바닥 z
  const SHELL_FRONT = 0.41;  // 프레임 앞면 z

  // 매끈한 사출 플라스틱: 낮은 거칠기 + 클리어코트, 결은 아주 약하게
  // 비드블라스트 키캡 질감: 오돌톨돌한 모래 알갱이 (범프 + 거칠기 얼룩)
  const pebble = (() => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const small = document.createElement('canvas'); small.width = small.height = 120;
    const sx = small.getContext('2d'), si = sx.createImageData(120, 120);
    for (let i = 0; i < 120 * 120; i++) { const v = 150 + (Math.random() - 0.5) * 170; si.data[i*4] = si.data[i*4+1] = si.data[i*4+2] = v; si.data[i*4+3] = 255; }
    sx.putImageData(si, 0, 0);
    x.imageSmoothingQuality = 'high'; x.drawImage(small, 0, 0, S, S);       // 둥글고 굵은 알갱이
    const fine = x.getImageData(0, 0, S, S), d = fine.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 50; d[i] += n; d[i+1] += n; d[i+2] += n; }
    x.putImageData(fine, 0, 0);                                              // 잔알갱이
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    t.repeat.set(1.1, 1.1); return t;
  })();
  // 무광 플라스틱 + 모래 알갱이 질감
  const glossy = (color, rough) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 1.0, roughnessMap: pebble, metalness: 0,
    bumpMap: pebble, bumpScale: 0.008, envMapIntensity: 0.6
  });
  const shellMat = glossy(0xD2D2CF, 0.34);
  device.add(shadowy(new THREE.Mesh(slab(MOD.w, MOD.h, MOD.r, 0.3, 0.08, 10), shellMat)));
  const frameShape = rrPath(new THREE.Shape(), MOD.w, MOD.h, MOD.r);
  frameShape.holes.push(rrPath(new THREE.Path(), WELL.w, WELL.h, WELL.r));
  const frame = shadowy(new THREE.Mesh(extrude(frameShape, 0.12, 0.06, 8), shellMat));
  frame.position.z = SHELL_FRONT - 0.18;
  device.add(frame);
  const wellMat = glossy(C.well, 0.5);
  const wellFloor = shadowy(new THREE.Mesh(slab(WELL.w + 0.1, WELL.h + 0.1, WELL.r, 0.02, 0, 1), wellMat));
  wellFloor.position.z = BACK_FRONT + 0.01;
  device.add(wellFloor);

  // 위쪽 오렌지 돌기 두 개
  [-1.25, 1.25].forEach(x => {
    const n = shadowy(new THREE.Mesh(slab(0.42, 0.14, 0.07, 0.04, 0.035, 6), glossy(C.orange, 0.3)));
    n.rotation.x = Math.PI / 2;
    n.position.set(x, MOD.h / 2 + 0.1, 0.05);
    device.add(n);
  });

  // ---------- 키캡 (스커트 + 오목한 상단면) ----------
  function legendTexture(text, color, aspect) {
    const c = document.createElement('canvas'); c.width = Math.round(256 * aspect); c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = (text.length === 1 ? '300 120px' : '400 66px') + ' "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.fillText(text, c.width / 2, c.height / 2 + (text.length === 1 ? 8 : 4));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }

  const keys = [];
  const KEY_H = 0.92;
  function makeKey(kind, label, x, w, color, legendColor) {
    const g = new THREE.Group();
    const mat = glossy(color, 0.3);
    const skirt = shadowy(new THREE.Mesh(slab(w, KEY_H, 0.13, 0.12, 0.05, 6), mat));
    skirt.position.z = 0.11;
    const topW = w - 0.2, topH = KEY_H - 0.22;
    const top = shadowy(new THREE.Mesh(slab(topW, topH, 0.17, 0.03, 0.05, 10), mat));
    top.position.z = 0.25;
    const legend = new THREE.Mesh(new THREE.PlaneGeometry(topW, topH),
      new THREE.MeshStandardMaterial({ map: legendTexture(label, legendColor, topW / topH), transparent: true, roughness: 0.6, metalness: 0 }));
    legend.position.z = 0.25 + 0.065 + 0.002;
    g.add(skirt, top, legend);
    g.position.set(x, 0, BACK_FRONT - 0.03);
    g.userData = { kind, baseZ: BACK_FRONT - 0.03, press: 0 };
    [skirt, top, legend].forEach(m => m.userData.key = g);
    device.add(g); keys.push(g);
  }
  // 오렌지 < · 화이트 enter · 오렌지 >
  const gap = 0.07, side = 1.3, mid = 0.92;
  makeKey('prev', '<', -(mid / 2 + gap + side / 2), side, C.orange, C.legendOnOrange);
  makeKey('ok', 'enter', 0, mid, C.cap, C.legend);
  makeKey('next', '>', (mid / 2 + gap + side / 2), side, C.orange, C.legendOnOrange);

  // ---------- 그림자 받는 벽 ----------
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
  wall.position.z = -0.75; wall.receiveShadow = true;
  scene.add(wall);

  let moduleY = -2.5, moduleScale = 1;   // resize에서 화면 하단 중앙으로 계산

  // ---------- 프로젝트 카드 (컨트롤러 위, 좌우로 플립) ----------
  const PW = 3, PH = 3, PR = 0.14, PT = 0.04;
  const PHI = 3 * 400 / 900, GAP_I = 0.06;   // 설명 패널 높이(엔터로 펼침)
  let infoOpen = false;
  const projCard = new THREE.Group();     // 위치/등장
  const projFlip = new THREE.Group();     // 플립 회전
  projCard.add(projFlip);
  scene.add(projCard);
  let projFront = null;
  const projTex = [];
  let projY = 1, projScale = 1, projYB = 1, projScaleB = 1, infoT = 0;
  // 캐러셀: 카드 여러 장이 좌우로 늘어서 있고, 옆으로 갈수록 돌아감
  const projCards = [];
  let carTarget = 0, carPos = 0;
  let projBounce = 0;

  function remapUV(geo, w, h) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
    uv.needsUpdate = true; return geo;
  }
  function roundRectPath(x, X, Y, W, H, R) {
    x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R);
    x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
  }
  // 카드 앞면: 정사각 이미지만 / 설명 패널: 블랙 + Orbit 텍스트 (엔터로 펼침)
  const cardVideos = [], cardVideoTex = [];
  // 가운데 카드의 영상만 재생, 나머지는 멈춘 한 장면으로
  function syncVideos() {
    const live = mode === 'device' || mode === 'toDevice';
    cardVideos.forEach((v, i) => {
      const on = live && i === current;
      if (on && v.paused) { v.currentTime = 0; v.play().catch(() => {}); }
      else if (!on && !v.paused) v.pause();
      if (cardVideoTex[i] && projCards[i]) {
        const want = on ? cardVideoTex[i] : projTex[i];
        const m = projCards[i].userData.face.material;
        if (m.map !== want) m.map = want;
      }
    });
  }
  function projectTexture(pj, idx, img) {
    if (pj.video) {
      // 영상 카드: 음소거 자동재생 + 반복
      const v = document.createElement('video');
      v.src = pj.video; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      v.addEventListener('loadeddata', () => { if (v.paused) v.currentTime = 0.05; });   // 첫 장면을 정지 이미지로
      cardVideos[idx] = v;
      const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      if (!img) return t;
      cardVideoTex[idx] = t;   // 섬네일이 있으면: 평소엔 섬네일, 가운데 오면 영상으로 교체
    }
    const c = document.createElement('canvas'); c.width = c.height = 800;
    const x = c.getContext('2d');
    if (img) x.drawImage(img, 0, 0, 800, 800); else { x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, 800, 800); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  function infoTexture(pj, idx) {
    const W = 900, H = 400, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const pad = 46, kr = 'Orbit, "Apple SD Gothic Neo", sans-serif';
    x.textBaseline = 'alphabetic';
    x.font = `22px ${kr}`; x.fillStyle = 'rgba(255,255,255,0.5)';
    x.fillText(String(idx + 1).padStart(2, '0') + ' / ' + String(sections.length).padStart(2, '0'), pad, 56);
    x.textAlign = 'right'; x.fillText(pj.period, W - pad, 56); x.textAlign = 'left';
    let size = 48; x.font = `${size}px ${kr}`;
    const title = pj.caption + (pj.partner ? ' ' + pj.partner : '');
    while (x.measureText(title).width > W - pad * 2 && size > 30) { size -= 2; x.font = `${size}px ${kr}`; }
    let y = 56 + 22 + size;
    x.fillStyle = '#fff'; x.fillText(title, pad, y);
    if (pj.desc) {
      x.font = `23px ${kr}`; x.fillStyle = 'rgba(255,255,255,0.68)';
      pj.desc.split('\n').forEach(line => { y += 38; x.fillText(line, pad, y, W - pad * 2); });
    }
    x.font = `20px ${kr}`; x.fillStyle = 'rgba(255,255,255,0.45)';
    const foot = [pj.tags.join('  ·  '), pj.role].filter(Boolean).join('   |   ');
    if (foot) x.fillText(foot, pad, H - 40, W - pad * 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  async function buildProjectCard() {
    const imgs = await Promise.all(sections.map(pj => new Promise(res => {
      if (!pj.img) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = pj.img;
    })));
    sections.forEach((pj, i) => projTex[i] = projectTexture(pj, i, imgs[i]));
    const shape = rrPath(new THREE.Shape(), PW, PH, PR);
    const faceGeo = remapUV(new THREE.ShapeGeometry(shape, 20), PW, PH);
    const edgeGeo = extrude(shape, PT, 0, 1);
    const infoGeo = remapUV(new THREE.ShapeGeometry(rrPath(new THREE.Shape(), PW, PHI, PR), 20), PW, PHI);
    const infoTex = i => infoTexture(sections[i], i);
    sections.forEach((pj, i) => {
      const g = new THREE.Group();
      const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: projTex[i], toneMapped: false }));
      face.position.z = PT / 2 + 0.001;
      const back = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ color: 0x151515, toneMapped: false }));
      back.rotation.y = Math.PI; back.position.z = -(PT / 2 + 0.001);
      const edge = new THREE.Mesh(edgeGeo, matte(0xE4E4E1, 0.7, 0.01));
      edge.position.z = -PT / 2;
      [face, back, edge].forEach(m => { m.castShadow = true; g.add(m); });
      // 설명 패널: 닫힘 = 이미지 뒤에 숨어 있음, 열림 = 아래로 내려옴
      const info = new THREE.Mesh(infoGeo, new THREE.MeshBasicMaterial({ map: infoTex(i), toneMapped: false, transparent: true, opacity: 0 }));
      info.position.z = -0.02; info.castShadow = true;
      g.add(info);
      g.userData.face = face; g.userData.info = info; g.userData.it = 0;
      projFlip.add(g); projCards.push(g);
    });
    projFront = projCards[0];
  }

  // =====================================================================
  // 명함 카드
  // =====================================================================
  const CARD_W = 3.0, CARD_H = 3.0 / 0.585, CARD_R = 0.2, CARD_T = 0.03;
  const CW = 1024, CH = Math.round(CW * CARD_H / CARD_W);
  const FONT = '"Space Mono", "Courier New", monospace';

  // 종이 결: 노이즈 + 구불구불한 섬유
  function paperHeight(seed) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, CW, CH);
    const n = document.createElement('canvas'); n.width = CW / 2; n.height = CH / 2;
    const nx = n.getContext('2d'), img = nx.createImageData(n.width, n.height);
    for (let i = 0; i < n.width * n.height; i++) {
      const v = 128 + (Math.random() - 0.5) * 120;
      img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = v; img.data[i*4+3] = 255;
    }
    nx.putImageData(img, 0, 0);
    x.globalAlpha = 0.6; x.drawImage(n, 0, 0, CW, CH);
    x.globalAlpha = 1; x.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const px = Math.random() * CW, py = Math.random() * CH, L = 10 + Math.random() * 28;
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
      x.lineWidth = 1 + Math.random() * 1.2;
      x.beginPath(); x.moveTo(px, py);
      x.bezierCurveTo(px + (Math.random()-0.5)*L*2, py + (Math.random()-0.5)*L*2,
                      px + (Math.random()-0.5)*L*2, py + (Math.random()-0.5)*L*2,
                      px + (Math.random()-0.5)*L, py + (Math.random()-0.5)*L);
      x.stroke();
    }
    return x.getImageData(0, 0, CW, CH).data;
  }

  function drawLines(ctx, lines) {
    lines.forEach(l => {
      ctx.font = `${l.size}px ${FONT}`;
      ctx.textAlign = l.align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(l.text, l.align === 'center' ? CW / 2 : l.x, l.y);
    });
  }
  function measure(l) {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${l.size}px ${FONT}`;
    return c.measureText(l.text).width;
  }

  // 높이맵 → 노멀맵
  function buildFace({ base, ink, inkLines, blindLines }) {
    const paper = paperHeight();
    // 글자 높이 (엠보싱): 흐리게 해서 둥근 턱을 만든다
    const t = document.createElement('canvas'); t.width = CW; t.height = CH;
    const tx = t.getContext('2d');
    tx.fillStyle = '#000'; tx.fillRect(0, 0, CW, CH);
    tx.filter = 'blur(2.2px)'; tx.fillStyle = '#fff';
    drawLines(tx, inkLines.concat(blindLines));
    tx.filter = 'none';
    const text = tx.getImageData(0, 0, CW, CH).data;

    const hgt = new Float32Array(CW * CH);
    for (let i = 0; i < CW * CH; i++) hgt[i] = (paper[i*4] / 255 - 0.5) * 0.35 + (text[i*4] / 255) * 1.0;

    const nc = document.createElement('canvas'); nc.width = CW; nc.height = CH;
    const nx = nc.getContext('2d'), nimg = nx.createImageData(CW, CH), d = nimg.data;
    const S = 4.0;
    for (let y = 0; y < CH; y++) {
      const y0 = Math.max(0, y - 1), y1 = Math.min(CH - 1, y + 1);
      for (let x = 0; x < CW; x++) {
        const x0 = Math.max(0, x - 1), x1 = Math.min(CW - 1, x + 1);
        const dx = (hgt[y*CW + x1] - hgt[y*CW + x0]) * S;
        const dy = (hgt[y1*CW + x] - hgt[y0*CW + x]) * S;
        let nX = -dx, nY = dy, nZ = 1; const len = Math.hypot(nX, nY, nZ);
        const i = (y*CW + x) * 4;
        d[i] = (nX/len*0.5+0.5)*255; d[i+1] = (nY/len*0.5+0.5)*255; d[i+2] = (nZ/len*0.5+0.5)*255; d[i+3] = 255;
      }
    }
    nx.putImageData(nimg, 0, 0);

    // 컬러맵: 종이색 + 약한 얼룩 + 잉크
    const cc = document.createElement('canvas'); cc.width = CW; cc.height = CH;
    const cx = cc.getContext('2d');
    cx.fillStyle = base; cx.fillRect(0, 0, CW, CH);
    if (inkLines.length) { cx.fillStyle = ink; drawLines(cx, inkLines); }

    const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const normalMap = new THREE.CanvasTexture(nc); normalMap.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1, 1), roughness: 0.88, metalness: 0, envMapIntensity: 1.0, toneMapped: false });
  }

  // 레이아웃 (원본 카드 비율 기준)
  const Y = f => Math.round(f * CH);
  const frontBlind = [
    { text: 'Designer',      x: 95, y: Y(0.115), size: 94 },
    { text: 'Sooyoun Jo :)', x: 95, y: Y(0.182), size: 94 },
    { text: 'Hello',                y: Y(0.772), size: 94, align: 'center' },
    { text: 'dus10167@naver.com',   y: Y(0.883), size: 64, align: 'center' }
  ];
  const goWebLine = { text: 'Go Web', y: Y(0.75), size: 104, align: 'center' };
  const backInk = [
    { text: 'Art',         y: Y(0.124), size: 104, align: 'center' },
    { text: '&',           y: Y(0.186), size: 104, align: 'center' },
    { text: 'Interaction', y: Y(0.272), size: 104, align: 'center' },
    { text: '&',           y: Y(0.336), size: 104, align: 'center' },
    { text: 'Tech',        y: Y(0.420), size: 104, align: 'center' },
    { text: 'dus10167@naver.com', y: Y(0.883), size: 66, align: 'center' }
  ];

  const card = new THREE.Group();
  const cardInner = new THREE.Group();   // 뒤집기 회전 전용
  card.add(cardInner);
  scene.add(card);
  let goWebBox = null, cardFront = null, cardBack = null;
  const cardMats = [];

  function uvRemap(geo) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + CARD_W/2) / CARD_W, (pos.getY(i) + CARD_H/2) / CARD_H);
    uv.needsUpdate = true; return geo;
  }

  // 명함 이미지 (원본 그대로)
  const GO_WEB_ENABLED = false;   // 웹(키 모듈+프로젝트) 진입 잠시 꺼둠: true로 바꾸면 다시 켜짐
  const loadTex = src => new Promise(res => {
    new THREE.TextureLoader().load(src, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null));
  });

  async function buildCard() {
    const [fTex, bTex] = await Promise.all([loadTex(CARD_IMG.front), loadTex(CARD_IMG.back)]);
    const faceMat = tex => new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : 0xEE5B2F, toneMapped: false, transparent: true });
    const shape = rrPath(new THREE.Shape(), CARD_W, CARD_H, CARD_R);
    cardFront = new THREE.Mesh(uvRemap(new THREE.ShapeGeometry(shape, 24)), faceMat(fTex));
    cardFront.position.z = CARD_T / 2 + 0.0008;
    cardBack = new THREE.Mesh(uvRemap(new THREE.ShapeGeometry(shape, 24)), faceMat(bTex));
    cardBack.rotation.y = Math.PI; cardBack.position.z = -(CARD_T / 2 + 0.0008);
    const edge = new THREE.Mesh(extrude(shape, CARD_T, 0, 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(0xF4E7E0), roughness: 0.42, transparent: true }));
    edge.position.z = -CARD_T / 2;
    cardMats.push(cardFront.material, cardBack.material, edge.material);
    [cardFront, cardBack, edge].forEach(m => { m.castShadow = true; cardInner.add(m); });
    // 뒷면 이미지에서 Go Web 글자 영역 (비율)
    goWebBox = { x0: 0.26 * CW, x1: 0.76 * CW, y0: 0.66 * CH, y1: 0.79 * CH };
  }

  // 카드용 레이킹 라이트: 엠보싱 그림자를 살림
  const cardLight = new THREE.DirectionalLight(0xffffff, 3.4);
  cardLight.position.set(-6, 7, 3);
  scene.add(cardLight);

  // ---------- 섹션 전환 ----------
  let subTimer = null;
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function renderInfo() {
    const pj = sections[current];
    if (infoOpen) {
      infoEl.innerHTML =
        `<p class="meta"><span>${String(current + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}</span><span>${esc(pj.period || '')}</span></p>` +
        `<h2>${esc(pj.caption)}</h2>` +
        (pj.partner ? `<p class="partner">${esc(pj.partner)}</p>` : '') +
        (pj.desc ? `<p class="desc">${pj.desc.split('\n').map(esc).join('<br>')}</p>` : '') +
        (pj.tags && pj.tags.length ? `<ul class="tags">${pj.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
    }
    infoEl.classList.toggle('open', infoOpen);
    resize();   // 설명 길이에 맞춰 카드 크기 다시 계산
  }
  function setSection(i, dir) {
    const next = (i + sections.length) % sections.length;
    if (dir) { carTarget += -dir; infoOpen = false; renderInfo(); }   // next(dir=-1) → 오른쪽 카드가 가운데로
    current = next;
    root.querySelectorAll('#ambient i').forEach((b, k) => { b.style.backgroundColor = sections[current].glow[k]; });
    titleEl.textContent = sections[current].caption;
    subEl.textContent = '';
  }
  function pressKey(kind) {
    const k = keys.find(k => k.userData.kind === kind);
    if (k) k.userData.press = 1;
    if (kind === 'prev') setSection(current - 1, 1);
    if (kind === 'next') setSection(current + 1, -1);
    if (kind === 'ok') {
      infoOpen = !infoOpen;   // 엔터: 설명 열고 닫기
      renderInfo();
      projBounce = 1;
      // 나중에 여기서 라우팅: location.hash = sections[current].screen.toLowerCase();
    }
  }
  setSection(0);

  // =====================================================================
  // 모드 전환: card ↔ device
  // =====================================================================
  let mode = startInWeb ? 'device' : 'card'; // 'card' | 'toDevice' | 'device' | 'toCard'
  let flipped = false, flipT = 0, backShown = false; // flipT: 0 앞면, 1 뒷면
  let trans = startInWeb ? 1 : 0; // 0 = 카드, 1 = 기기
  const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const easeOutBack = x => { const c1 = 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  // Back 버튼: 기기 화면 → 명함
  backBtn.addEventListener('click', () => backToCard());

  // 이메일 복사
  const EMAIL = 'dus10167@gmail.com';
  let copyTimer = null;
  copyBtn.addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(EMAIL); ok = true; }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = EMAIL; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    copyBtn.textContent = ok ? 'Copied' : EMAIL;
    copyBtn.setAttribute('aria-label', ok ? '이메일 주소를 복사했어요' : '복사하지 못했어요. 주소를 직접 선택해 주세요');
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', '이메일 주소 복사');
    }, 1600);
  });

  // Hello 누르면 :D 가 떨어짐
  const HELLO_BOX = { u0: 0.28, u1: 0.72, v0: 0.69, v1: 0.81 };   // 앞면 이미지 안 Hello 영역 (비율)
  // :D 공: 배경에서 천천히 내려와 부유하다가 10초 뒤 사라짐
  function smileTexture(bg, ink) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    // 구의 +z 정면은 u = 0.25 지점
    x.save(); x.translate(c.width * 0.25, c.height * 0.5); x.rotate(Math.PI / 2);
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 150px "Space Mono", "Courier New", monospace';
    x.fillText(':D', 0, 8);
    x.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  let smileTex = null;
  const ballGeo = new THREE.SphereGeometry(1, 48, 32);
  const balls = [];
  const ballGroup = new THREE.Group();
  scene.add(ballGroup);

  function rainSmiles() {
    tiltHold = reduceMotion ? 0 : 1.8;
    swayDir *= -1;
    zingSound();
    if (!smileTex) smileTex = [smileTexture('#EE5B2F', '#F6EDE8'), smileTexture('#E8DDDC', '#E2552D')];
    const n = reduceMotion ? 5 : 12;
    const colors = Array.from({ length: n }, (_, i) => i % 2);
    for (let i = colors.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = colors[i];
      colors[i] = colors[j];
      colors[j] = swap;
    }
    const camZ = camera.position.z;
    for (let i = 0; i < n; i++) {
      // 크기 세 단계를 섞음: 작은 공 / 중간 / 큰 공
      const tier = i % 3;
      const r = tier === 0 ? 0.28 + Math.random() * 0.2 : tier === 1 ? 0.55 + Math.random() * 0.25 : 0.9 + Math.random() * 0.35;
      const z = -(r + 0.4) - Math.random() * 3.5;   // 항상 카드 뒤
      const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camZ - z);
      const hw = hh * camera.aspect;
      const mat = new THREE.MeshStandardMaterial({
        map: smileTex[colors[i]], roughness: 0.32, metalness: 0,
        envMapIntensity: 0.35, transparent: true, opacity: 1
      });
      const m = new THREE.Mesh(ballGeo, mat);
      m.scale.setScalar(r);
      const sign = Math.random() < 0.5 ? -1 : 1;
      const edgeX = (CARD_W / 2) * (camZ - z) / camZ + r + 0.08;
      const room = Math.max(0, hw - r - edgeX);
      const px = sign * (edgeX + Math.random() * room);
      const pos = new THREE.Vector3(px, hh + r + Math.random() * hh * 0.5, z);
      m.position.copy(pos);
      ballGroup.add(m);
      balls.push({
        m, r, hh, hw, age: 0,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, -(0.5 + Math.random() * 0.4) * hh, 0),
        // 쉬는 높이를 위에서 아래까지 고르게 나눠 줌 (세로 화면에서도 바닥까지)
        restY: (-0.85 + ((i * 7) % n + Math.random()) / n * 1.65) * hh, homeX: px, s: hh / 3,
        ph: Math.random() * Math.PI * 2, rotZ: 0,
        // 공마다 얼굴 방향을 다르게 (옆이나 위아래를 보도록)
        base: new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 2.4))
      });
    }
  }

  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), wobbleE = new THREE.Euler();
  const cardInv = new THREE.Matrix4(), ballLocal = new THREE.Vector3();
  function separateBallsFromCard() {
    if (!balls.length) return;
    card.updateWorldMatrix(true, false);
    cardInv.copy(card.matrixWorld).invert();
    const scale = Math.max(0.001, Math.abs(card.scale.x));
    const hx = CARD_W / 2, hy = CARD_H / 2, hz = CARD_T / 2 + 0.02;
    for (const b of balls) {
      const rad = b.r / scale + 0.04;
      ballLocal.copy(b.m.position).applyMatrix4(cardInv);
      const nearFace = Math.abs(ballLocal.x) <= hx + rad && Math.abs(ballLocal.y) <= hy + rad;
      if (nearFace) {
        const limit = -hz - rad;
        if (ballLocal.z > limit) ballLocal.z = limit;
      } else {
        const qx = Math.max(-hx, Math.min(hx, ballLocal.x));
        const qy = Math.max(-hy, Math.min(hy, ballLocal.y));
        const qz = Math.max(-hz, Math.min(hz, ballLocal.z));
        const ox = ballLocal.x - qx, oy = ballLocal.y - qy, oz = ballLocal.z - qz;
        const dist = Math.hypot(ox, oy, oz);
        if (dist < rad) {
          if (dist < 1e-4 || oz > 0) {
            const side = Math.hypot(ox, oy) || 1;
            const gap = rad - Math.min(dist, rad);
            ballLocal.x += (ox / side) * gap;
            ballLocal.y += (oy / side) * gap;
            if (ballLocal.z > -hz) ballLocal.z = -hz - rad;
          } else {
            const gap = (rad - dist) / dist;
            ballLocal.x += ox * gap;
            ballLocal.y += oy * gap;
            ballLocal.z += oz * gap;
          }
        }
      }
      b.m.position.copy(ballLocal).applyMatrix4(card.matrixWorld);
    }
  }
  const LEAVE_AT = 9.4, FADE_AT = 10, FADE_LEN = 1.8;
  function updateBalls(dt, t) {
    if (!balls.length) return;
    for (const b of balls) {
      b.age += dt;
      if (!b.leftSnd && b.age > LEAVE_AT) {   // 퍼져서 사라지기 시작할 때 한 번
        b.leftSnd = true;
        if (performance.now() - lastWhoosh > 900) { lastWhoosh = performance.now(); whooshSound(); }
      }
      if (mode !== 'card' && b.age < 10) b.age = 10;   // 카드 화면을 떠나면 바로 사라지기 시작
      const p = b.m.position, v = b.vel;
      const leaving = b.age > LEAVE_AT;
      if (leaving) {
        // 화면 중심에서 멀어지는 방향으로 퍼져나감
        let dx = p.x, dy = p.y, L = Math.hypot(dx, dy);
        if (L < 0.05) { dx = Math.cos(b.ph); dy = Math.sin(b.ph); L = 1; }
        const k = Math.min(1, (b.age - LEAVE_AT) / 0.8) * 6 * b.s;
        v.x += dx / L * k * dt; v.y += dy / L * k * dt;
      } else {
        // 부드러운 중력 + 쉬는 높이로 돌아가려는 부력 (물속처럼)
        const below = b.restY - p.y;
        v.y += (below > 0 ? below * 2.2 : -0.9 * b.hh) * dt;   // 위엔 중력, 아래엔 부력 → restY 근처에서 둥둥
      }
      // 물결 같은 흔들림
      v.x += Math.sin(t * 0.7 + b.ph) * 0.35 * b.s * dt;
      v.y += Math.cos(t * 0.9 + b.ph * 1.3) * 0.3 * b.s * dt;
      if (!leaving) {
        v.x += (b.homeX - p.x) * 0.25 * dt;
        // 좌우 벽: 살짝 밀어냄
        const edge = b.hw - b.r;
        if (p.x > edge) v.x -= (p.x - edge) * 4 * dt;
        if (p.x < -edge) v.x -= (p.x + edge) * 4 * dt;
      }
      // 공기 저항 (점성 높게 → 둥둥 뜨는 느낌)
      const drag = Math.exp(-1.4 * dt);
      v.multiplyScalar(drag);
      p.addScaledVector(v, dt);
      v.z = 0;
    }
    // 공끼리 부드럽게 밀어내기
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const A = balls[i], B = balls[j];
      if (A.age > LEAVE_AT || B.age > LEAVE_AT) {
        // 사라지는 동안에는 화면상으로도 안 겹치게 밀어냄 (깊이가 달라도)
        const camZ = camera.position.z;
        const da = camZ - A.m.position.z, db = camZ - B.m.position.z;
        let dx = B.m.position.x / db - A.m.position.x / da, dy = B.m.position.y / db - A.m.position.y / da;
        const d = Math.hypot(dx, dy) || 1e-4, min = (A.r / da + B.r / db) * 1.08;
        if (d < min) {
          dx /= d; dy /= d;
          const push = (min - d) * 0.5;
          A.m.position.x -= dx * push * da * 0.2; A.m.position.y -= dy * push * da * 0.2;
          B.m.position.x += dx * push * db * 0.2; B.m.position.y += dy * push * db * 0.2;
          A.vel.x -= dx * push * da * 3; A.vel.y -= dy * push * da * 3;
          B.vel.x += dx * push * db * 3; B.vel.y += dy * push * db * 3;
        }
        continue;
      }
      tmpV.subVectors(B.m.position, A.m.position);
      tmpV.z *= 0.2;   // 깊이 방향으로는 거의 밀지 않음
      const d = tmpV.length(), min = A.r + B.r;
      if (d > 0.0001 && d < min) {
        tmpV.divideScalar(d);
        const push = (min - d) * 0.5;
        A.m.position.addScaledVector(tmpV, -push); B.m.position.addScaledVector(tmpV, push);
        const rel = tmpV.dot(tmpV.clone().copy(B.vel).sub(A.vel));
        if (rel < 0) { A.vel.addScaledVector(tmpV, rel * 0.5); B.vel.addScaledVector(tmpV, -rel * 0.5); }
      }
    }
    separateBallsFromCard();
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      // 굴러가는 듯한 기울기, 얼굴은 대체로 정면
      b.rotZ += (-b.vel.x * 0.6 - b.rotZ) * Math.min(1, dt * 3);
      wobbleE.set(b.vel.y * 0.4 + Math.sin(t * 0.8 + b.ph) * 0.1,
                  Math.sin(t * 0.5 + b.ph) * 0.3, b.rotZ);
      b.m.quaternion.copy(tmpQ.setFromEuler(wobbleE).multiply(b.base));
      const fade = b.age > FADE_AT ? 1 - (b.age - FADE_AT) / FADE_LEN : 1;
      b.m.material.opacity = Math.max(0, fade);
      if (fade <= 0) { ballGroup.remove(b.m); b.m.material.dispose(); balls.splice(i, 1); }
    }
  }

  function setCardHint() {
    captionEl.textContent = '\u00a0';
    hintEl.textContent = '카드를 탭해서 뒤집어보세요';
  }
  // 부드러운 벨 소리 '덵~': 사인파 몇 개를 격쳐 합성 (외부 파일 없음)
  let actx = null;
  // Hello: 공이 내려올 때 고무공 '퉁·퉁' (낮고 둥근 소리, 공마다 크기 따라 음높이 다름)
  function rubberThump(t0, f, vel) {
    const out = actx.createGain(); out.connect(actx.destination);
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(vel, t0 + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    // 몸통: 눌렸다 펴지듯 음이 빠르게 내려감
    [[1, 'sine', 1], [2, 'triangle', 0.3]].forEach(([mul, type, amp]) => {
      const o = actx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f * 1.9 * mul, t0);
      o.frequency.exponentialRampToValueAtTime(f * mul, t0 + 0.06);
      const g = actx.createGain(); g.gain.value = amp;
      o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.25);
    });
    // 고무 속 공기가 울리는 '텅' 한 결
    const sr = actx.sampleRate, nb = actx.createBuffer(1, Math.floor(sr * 0.05), sr), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 3);
    const ns = actx.createBufferSource(); ns.buffer = nb;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 3;
    const ng = actx.createGain(); ng.gain.value = 0.35;
    ns.connect(bp).connect(ng).connect(out); ns.start(t0);
  }
  // Hello: 공이 내려올 때 '또록또록' (구슬이 하나씩 톡 떨어져 작게 한 번 더 튀는 소리)
  function tokNote(t0, f, vel) {
    // 둥글고 맑은 '톡': 음이 살짝 내려가며 짧게 울림
    [[1, 'sine', 1, 0.09], [2.02, 'triangle', 0.25, 0.04]].forEach(([mul, type, amp, len]) => {
      const o = actx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f * mul * 1.08, t0);
      o.frequency.exponentialRampToValueAtTime(f * mul, t0 + 0.02);
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vel * amp, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + len + 0.02);
    });
  }
  function zingSound() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const base = actx.currentTime + 0.04;
      const n = reduceMotion ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const t0 = base + i * 0.19 + Math.random() * 0.05;
        const f = 1050 + Math.random() * 650;
        const v = 0.2 - i * 0.012;
        tokNote(t0, f, v);
        tokNote(t0 + 0.075, f * 1.12, v * 0.55);
      }
    } catch (_) {}
  }
  // 공이 퍼지며 사라질 때: '사아~' 하는 바람 소리 (높은 음역 노이즈가 내려가며 사라짐)
  let lastWhoosh = 0;
  function whooshSound() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const now = actx.currentTime, dur = 1.5, sr = actx.sampleRate;
      const buf = actx.createBuffer(1, Math.floor(sr * dur), sr), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = actx.createBufferSource(); src.buffer = buf;
      const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(6500, now); bp.frequency.exponentialRampToValueAtTime(2200, now + dur);
      const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.09, now + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp).connect(hp).connect(g).connect(actx.destination);
      src.start(now); src.stop(now + dur);
    } catch (_) {}
  }
  function paperSound() {
    // 종이 넘기는 소리: 짧은 노이즈를 필터로 다듬어 합성 (외부 파일 없음)
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const now = actx.currentTime, dur = 0.24, sr = actx.sampleRate;
      const buf = actx.createBuffer(1, Math.floor(sr * dur), sr), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / d.length;
        const crackle = Math.random() < 0.25 ? 1 : 0.35;              // 종이의 바스락거림
        const flutter = 0.65 + 0.35 * Math.sin(t * 70);               // 펄랙이는 떨림
        d[i] = (Math.random() * 2 - 1) * crackle * flutter * Math.pow(1 - t, 1.6);
      }
      const src = actx.createBufferSource(); src.buffer = buf;
      const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(1800, now); bp.frequency.exponentialRampToValueAtTime(4200, now + dur);
      const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.32, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp).connect(hp).connect(g).connect(actx.destination);
      src.start(now); src.stop(now + dur);
    } catch (_) {}
  }
  function flip() {
    flipped = !flipped;
    tiltHold = 0;
    setCardHint();
    paperSound();
  }
  function goWeb() {
    cardVideos.forEach(v => { v.play().then(() => v.pause()).catch(() => {}); });   // iOS: 사용자 터치 안에서 한 번 깨워둠
    if (mode !== 'card') return;
    mode = 'toDevice';
    root.classList.remove('mode-card');
    backBtn.tabIndex = 0;
    el.setAttribute('aria-label', '포트폴리오. 왼쪽, 오른쪽 화살표로 섹션 이동, Enter로 열기, Esc로 명함으로');
    setSection(current);
  }
  function backToCard() {
    if (mode !== 'device') return;
    mode = 'toCard';
    root.classList.add('mode-card');
    backBtn.tabIndex = -1;
    el.setAttribute('aria-label', '명함. Space로 뒤집기, 뒷면에서 Enter로 웹 보기');
    setCardHint();
  }
  setCardHint();

  // ---------- 입력 ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let dragging = false, sx = 0, sy = 0, moved = 0;
  let greeted = false;
  let rotX = 0, rotY = 0, tRotX = 0, tRotY = 0;
  let tilt = 0, tiltVel = 0, tiltHold = 0, swayDir = -1;
  const el = renderer.domElement;
  if (startInWeb) {
    root.classList.remove('mode-card');
    backBtn.tabIndex = 0;
    el.setAttribute('aria-label', '포트폴리오. 왼쪽, 오른쪽 화살표로 섹션 이동, Enter로 열기, Esc로 명함으로');
  }
  el.addEventListener('pointerdown', e => { dragging = true; moved = 0; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    moved += Math.abs(dx) + Math.abs(dy); sx = e.clientX; sy = e.clientY;
    const lim = mode === 'card' ? 0.5 : 1.2;
    tRotY = Math.max(-lim, Math.min(lim, tRotY + dx * 0.01));
    tRotX = Math.max(-0.6, Math.min(0.6, tRotX + dy * 0.008));
  });
  el.addEventListener('pointerup', e => {
    dragging = false;
    if (moved >= 8) return;
    const rect = el.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (mode === 'card') {
      if (!flipped && flipT < 0.05 && cardFront) {
        const hit = ray.intersectObject(cardFront)[0];
        if (hit) {
          const u = hit.uv.x, vt = 1 - hit.uv.y;
          const onHello = u > HELLO_BOX.u0 && u < HELLO_BOX.u1 && vt > HELLO_BOX.v0 && vt < HELLO_BOX.v1;
          if (!greeted || onHello) { greeted = true; rainSmiles(); return; }
        }
      }
      if (GO_WEB_ENABLED && flipped && flipT > 0.95 && cardBack) {
        const hit = ray.intersectObject(cardBack)[0];
        if (hit) {
          const px = hit.uv.x * CW, py = (1 - hit.uv.y) * CH;
          if (px > goWebBox.x0 && px < goWebBox.x1 && py > goWebBox.y0 && py < goWebBox.y1) { goWeb(); return; }
        }
      }
      flip();
    } else if (mode === 'device') {
      const hit = ray.intersectObjects(keys.flatMap(k => k.children))[0];
      if (hit) pressKey(hit.object.userData.key.userData.kind);
    }
  });
  el.addEventListener('pointercancel', () => { dragging = false; });

  // ---------- 데스크톱: 커스텀 커서로 누를 수 있는 곳을 알려줌 ----------
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function hotZone(clientX, clientY) {
    if (mode !== 'card') return null;
    const rect = el.getBoundingClientRect();
    ptr.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (!flipped && flipT < 0.05 && cardFront) {
      const hit = ray.intersectObject(cardFront)[0];
      if (hit) {
        if (!greeted) return 'hello';
        const u = hit.uv.x, vt = 1 - hit.uv.y;
        if (u > HELLO_BOX.u0 && u < HELLO_BOX.u1 && vt > HELLO_BOX.v0 && vt < HELLO_BOX.v1) return 'hello';
      }
    }
    if (GO_WEB_ENABLED && flipped && flipT > 0.95 && cardBack) {
      const hit = ray.intersectObject(cardBack)[0];
      if (hit) {
        const px = hit.uv.x * CW, py = (1 - hit.uv.y) * CH;
        if (px > goWebBox.x0 && px < goWebBox.x1 && py > goWebBox.y0 && py < goWebBox.y1) return 'goweb';
      }
    }
    return null;
  }
  if (finePointer) {
        cur = document.createElement('div');
    cur.id = 'cursor'; cur.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    cur.appendChild(label);
    root.appendChild(cur);

    let mx = -100, my = -100, cx = -100, cy = -100, scale = 0.14, targetScale = 0.14, overCopy = false;
    listen(window, 'pointermove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.opacity = '1';
      if (dragging) return;
      const zone = overCopy ? 'copy' : hotZone(e.clientX, e.clientY);
      const text = { hello: ':D', goweb: 'Go', copy: '' }[zone];
      targetScale = zone === 'copy' ? 0.5 : zone ? 1 : 0.14;
      if (text !== undefined) label.textContent = text;
      cur.classList.toggle('hot', !!zone && zone !== 'copy');
      if (mode === 'device') {
        ray.setFromCamera(ptr.set(((e.clientX - el.getBoundingClientRect().left) / el.clientWidth) * 2 - 1,
          -((e.clientY - el.getBoundingClientRect().top) / el.clientHeight) * 2 + 1), camera);
        const onKey = ray.intersectObjects(keys.flatMap(k => k.children))[0];
        el.style.cursor = onKey ? 'pointer' : 'grab';
      } else el.style.cursor = '';
    });
    listen(document, 'pointerleave', () => { cur.style.opacity = '0'; });
    copyBtn.addEventListener('pointerenter', () => { overCopy = true; });
    copyBtn.addEventListener('pointerleave', () => { overCopy = false; });
    el.addEventListener('pointerdown', () => { targetScale *= 0.85; });
    (function follow() {
      const k = reduceMotion ? 1 : 0.22;
      cx += (mx - cx) * k; cy += (my - cy) * k;
      scale += (targetScale - scale) * (reduceMotion ? 1 : 0.18);
      cur.style.transform = `translate(${cx}px, ${cy}px) scale(${scale})`;
      cursorRaf = requestAnimationFrame(follow);
    })();
  } else {
    cur = document.createElement('div');
    cur.id = 'cursor';
    cur.className = 'hot';
    cur.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = ':D';
    cur.appendChild(label);
    root.appendChild(cur);
    el.addEventListener('pointerup', e => {
      if (moved >= 8 || mode !== 'card') return;
      cur.style.opacity = '1';
      cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(1)`;
      clearTimeout(tapMarkTimer);
      tapMarkTimer = setTimeout(() => { cur.style.opacity = '0'; }, 5000);
    });
  }
  el.addEventListener('keydown', e => {
    if (mode === 'card') {
      if (e.key === ' ') { e.preventDefault(); flip(); }
      else if (e.key === 'Enter') { e.preventDefault(); (flipped && GO_WEB_ENABLED) ? goWeb() : flip(); }
    } else if (mode === 'device') {
      if (e.key === 'ArrowLeft') pressKey('prev');
      else if (e.key === 'ArrowRight') pressKey('next');
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pressKey('ok'); }
      else if (e.key === 'Escape') backToCard();
    }
  });

  // ---------- 리사이즈 ----------
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const needH = Math.max(7.0, 4.3 / camera.aspect);
    const d = needH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0.1, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // 키 모듈: 화면 하단 중앙
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d, visW = visH * camera.aspect;
    moduleScale = Math.min(1, (visW * 0.72) / MOD.w, (visH * 0.15) / MOD.h);
    moduleY = -visH / 2 + visH * 0.07 + (MOD.h * moduleScale) / 2;
    // 프로젝트 카드: Back 버튼 아래부터 컨트롤러 위까지의 공간 가운데
    const topLimit = visH / 2 - visH * (Math.min(150, 40 + w * 0.26) / Math.max(h, 1));
    const modTop = moduleY + (MOD.h * moduleScale) / 2 + 0.2 * moduleScale + 0.35;
    const room = topLimit - modTop;
    // 카드 이미지 + 아래 설명 영역(px 고정)
    const pxToW = visH / Math.max(h, 1);
    const infoPx = Math.max(120, (infoEl.scrollHeight || 0) + 24);   // 실제 설명 높이만큼만 비움
    const cardH = Math.max(1, Math.min(room - infoPx * pxToW - 0.1, visW * 0.68 * PH / PW));
    projScale = cardH / PH;
    projY = topLimit - 0.05 - cardH / 2;
    // 설명이 닫혀 있을 땐 크게: 카드 영역 전체를 사용
    const cardHB = Math.max(cardH, Math.min(room * 0.92, visW * 0.8 * PH / PW));
    projScaleB = cardHB / PH;
    projYB = (topLimit + modTop) / 2;
    const rect = stage.getBoundingClientRect();
    const imgBottomPx = rect.top + (visH / 2 - (projY - cardH / 2)) / visH * h;
    infoEl.style.top = `${imgBottomPx + 22}px`;
    infoEl.style.width = `${Math.max(280, PW * projScale / visW * w)}px`;   // 카드 폭에 맞춤
    placeCopy();
  }
  // Copy 버튼: 카드 아래 끝과 화면 아래 끝의 중간
  function placeCopy() {
    const p = new THREE.Vector3(0, -CARD_H / 2, 0).project(camera);
    const rect = stage.getBoundingClientRect();
    const cardBottom = rect.top + (1 - p.y) / 2 * rect.height;
    // 카드 아래 끝과 화면 아래 끝의 중간, 단 카드와 최소 36px 띄움
    copyBtn.style.top = `${Math.max((cardBottom + window.innerHeight) / 2, cardBottom + 36)}px`;
  }
  observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  // ---------- 루프 ----------
  const clock = new THREE.Clock();
  function tick() {
    const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), dtT = Math.min(rawDt, 0.1), t = clock.elapsedTime;
    const idle = reduceMotion ? 0 : 1;
    if (!dragging) { tRotY *= 0.92; tRotX *= 0.92; }
    rotX += (tRotX - rotX) * 0.14; rotY += (tRotY - rotY) * 0.14;

    // 전환 진행: 카드가 뒤로 눕듯 사라지고, 키 모듈이 아래에서 탄력 있게 올라옴
    const speed = reduceMotion ? 4 : 0.75;
    if (mode === 'toDevice') { trans = Math.min(1, trans + dtT * speed); if (trans === 1) mode = 'device'; }
    if (mode === 'toCard')   { trans = Math.max(0, trans - dtT * speed); if (trans === 0) mode = 'card'; }
    // 순차 전환: 명함이 완전히 사라진 뒤(0~0.45) 다음 요소가 나타남(0.5~1)
    const cOut = ease(Math.min(1, trans / 0.45));
    const dRaw = Math.max(0, Math.min(1, (trans - 0.5) / 0.5));
    const dIn = mode === 'toCard' ? ease(dRaw) : easeOutBack(dRaw);

    // 카드
    flipT += ((flipped ? 1 : 0) - flipT) * Math.min(1, dt * 7);
    const showBack = flipT > 0.55;
    if (showBack !== backShown) {
      backShown = showBack;
      root.classList.toggle('show-back', showBack);
    }
    card.visible = cOut < 0.999;
    const lift = Math.sin(flipT * Math.PI) * 0.6;
    cardInner.rotation.y = flipT * Math.PI;
    card.position.set(0, Math.sin(t * 0.9) * 0.04 * idle + cOut * 0.9, lift - cOut * 1.2);
    tiltHold = Math.max(0, tiltHold - dt);
    const tiltTarget = tiltHold > 0 ? 1 : 0;
    tiltVel += ((tiltTarget - tilt) * 38 - tiltVel * 7.5) * dt;
    tilt += tiltVel * dt;
    const side = swayDir;
    card.rotation.set(rotX * (1 - cOut) + Math.sin(t * 0.6) * 0.03 * idle - cOut * 0.9 + tilt * 0.62,
                      rotY * (1 - cOut) + Math.sin(t * 0.4) * 0.05 * idle + tilt * 0.75 * side,
                      tilt * 0.28 * side);
    card.scale.setScalar(1 - cOut * 0.15);
    cardMats.forEach(m => {
      const fade = cOut > 0.001;
      m.opacity = 1 - cOut;
      if (m.transparent !== fade) { m.transparent = fade; m.needsUpdate = true; }
      m.depthWrite = !fade;
    });
    const breathPeriod = 7.2;
    const breathPhase = (t % breathPeriod) / breathPeriod;
    const breathWindow = 0.38;
    const breathHump = breathPhase < breathWindow ? Math.sin((breathPhase / breathWindow) * Math.PI) : 0;
    const breathGain = 1 + 0.22 * breathHump * idle * (1 - Math.min(1, cOut));
    cardMats.forEach(m => { if (m.map) m.color.setRGB(breathGain, breathGain, breathGain); });
    cardLight.intensity = 3.4 * (1 - cOut) * (1 + 0.12 * breathHump * idle);

    // 키 모듈
    device.visible = dRaw > 0.001;
    wall.visible = device.visible;
    device.rotation.set(rotX * 0.4 + Math.sin(t * 0.7) * 0.015 * idle,
                        rotY * 0.5 + Math.sin(t * 0.45) * 0.04 * idle, 0);
    device.position.y = moduleY + Math.sin(t * 1.0) * 0.03 * idle - (1 - dIn) * 3;
    device.scale.setScalar(moduleScale * (0.9 + 0.1 * dIn));

    // 프로젝트 카드: 모듈보다 살짝 늦게 올라오고, 좌우로 플립
    const pIn = mode === 'toCard' ? ease(Math.max(0, (trans - 0.55) / 0.45)) : easeOutBack(Math.max(0, Math.min(1, (trans - 0.55) / 0.45)));
    projCard.visible = pIn > 0.001 && !!projFront;
    infoT += ((infoOpen ? 1 : 0) - infoT) * Math.min(1, dt * (reduceMotion ? 20 : 7));
    const eI = ease(infoT), pY = projYB + (projY - projYB) * eI, pS = projScaleB + (projScale - projScaleB) * eI;
    projCard.position.set(0, pY - (1 - pIn) * 2.2 + Math.sin(t * 0.9 + 1) * 0.03 * idle, 0);
    projCard.scale.setScalar(pS * (0.85 + 0.15 * pIn));
    projCard.rotation.set(rotX * 0.5 + Math.sin(t * 0.6) * 0.02 * idle, rotY * 0.6 + Math.sin(t * 0.4) * 0.04 * idle, 0);
    // 캐러셀 위치: 부드럽게 따라감, 무한 반복
    carPos += (carTarget - carPos) * Math.min(1, dt * (reduceMotion ? 20 : 5.5));
    const N = projCards.length;
    projCards.forEach((g, i) => {
      let o = ((i - carPos) % N + N) % N; if (o > N / 2) o -= N;   // -N/2..N/2
      const a = Math.max(-1.6, Math.min(1.6, o));
      const absO = Math.abs(o);
      g.visible = absO < 2.6;
      g.position.set(Math.sign(o) * (Math.min(absO, 1) * 2.55 + Math.max(0, absO - 1) * 1.1), 0, -Math.min(absO, 2) * 1.4);
      g.rotation.y = -a * 0.72;                       // 옆으로 갈수록 안쪽으로 돌아감
      g.scale.setScalar(1 - Math.min(absO, 2) * 0.08);
      g.userData.face.material.color.setScalar(1 - Math.min(absO, 1.5) * 0.38);
      g.userData.info.visible = false;   // 설명은 HTML로 카드 아래에 표시
    });
    projBounce = Math.max(0, projBounce - dt * 4);
    projFlip.scale.setScalar(1 - Math.sin(projBounce * Math.PI) * 0.03);
    keyLight.intensity = 1.5 * Math.max(0.25, Math.min(1, dIn));

    keys.forEach(k => {
      k.userData.press = Math.max(0, k.userData.press - dt * 6);
      k.position.z = k.userData.baseZ - Math.sin(k.userData.press * Math.PI) * 0.08;
    });
    updateBalls(dt, t);
    syncVideos();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  // 폰트를 기다렸다가 카드 텍스처를 굽는다
  const fontReady = document.fonts ? Promise.race([
    Promise.all([document.fonts.load(`104px ${FONT}`), document.fonts.load('16px Orbit')]), new Promise(r => setTimeout(r, 2500))
  ]) : Promise.resolve();
  fontReady.then(() => {
    if (alive) return buildCard()
  }).then(() => {
    if (alive) return buildProjectCard()
  }).then(() => {
    if (alive) tick()
  }).catch((error) => {
    console.error(error)
  })


  return () => {
    alive = false
    cancelAnimationFrame(rafId)
    cancelAnimationFrame(cursorRaf)
    clearTimeout(tapMarkTimer)
    if (observer) observer.disconnect()
    windowListeners.forEach((off) => off())
    cardVideos.forEach((video) => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    })
    if (cur) cur.remove()
    if (actx && actx.close) actx.close()
    dom.remove()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
