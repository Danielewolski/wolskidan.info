/* WOLSKI — Links
 * 1. Scena 3D a livelli (WebGL): sfondo ricostruito + fighter ritagliati, ognuno con la sua
 *    mappa di profondità. Il nome sta in mezzo, in HTML: i fighter gli passano davanti.
 * 2. Animazione d'ingresso con GSAP + SplitText
 * 3. Grana pellicola e scintille al click
 */
;(() => {
  const root = document.documentElement
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ASSETS = {
    bg: 'assets/bg.webp',
    bgDepth: 'assets/bg-depth.webp',
    fg: 'assets/fg.webp',
    fgDepth: 'assets/fg-depth.webp',
  }
  const FALLBACK = 'assets/wolski-3d.webp'
  const FOCUS = [0.38, 0.5] // punto della foto da tenere al centro su schermi verticali (0-1)
  const STRENGTH = 0.06 // ampiezza del movimento 3D
  const FOCUS_DEPTH = 0.45 // profondità che resta ferma (il piano del nome)

  document.getElementById('year').textContent = new Date().getFullYear()

  /* ─── 1. Scena 3D ────────────────────────────────────────── */

  const VERTEX = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `

  // Ogni pixel si sposta in proporzione alla sua distanza dal piano di fuoco:
  // lo sfondo (lontano) va da una parte, i fighter (vicini) dall'altra.
  // Tre passaggi di ricerca sulla mappa riducono gli strappi ai bordi.
  const FRAGMENT = `
    precision mediump float;
    uniform sampler2D uImage;
    uniform sampler2D uDepth;
    uniform vec2 uRes;
    uniform float uImgAspect;
    uniform vec2 uFocus;
    uniform vec2 uPointer;
    uniform float uStrength;
    uniform float uFocusDepth;
    uniform float uZoom;
    uniform float uReveal;
    uniform float uAlphaLayer;
    varying vec2 vUv;

    vec2 coverUv(vec2 uv) {
      float screenAspect = uRes.x / uRes.y;
      vec2 scale = vec2(1.0);
      if (screenAspect > uImgAspect) scale.y = uImgAspect / screenAspect;
      else scale.x = screenAspect / uImgAspect;
      scale /= uZoom;
      vec2 halfScale = scale * 0.5;
      vec2 center = clamp(uFocus, halfScale, 1.0 - halfScale);
      return center + (uv - 0.5) * scale;
    }

    void main() {
      vec2 uv = coverUv(vUv);
      vec2 offset = vec2(0.0);
      for (int i = 0; i < 3; i++) {
        float d = texture2D(uDepth, uv + offset).r;
        offset = -uPointer * (d - uFocusDepth) * uStrength;
      }
      vec4 tex = texture2D(uImage, uv + offset);
      vec3 col = tex.rgb;

      // grading: un po' più di contrasto e luci calde
      col = mix(col, smoothstep(0.0, 1.0, col), 0.5) * 1.12;
      col = mix(col, col * vec3(1.06, 0.98, 0.94), 0.6);

      // vignetta
      vec2 v = vUv - 0.5;
      col *= 1.0 - dot(v, v) * 0.8;

      if (uAlphaLayer > 0.5) {
        float a = tex.a * uReveal;
        gl_FragColor = vec4(col * a, a); // alpha premoltiplicata
      } else {
        gl_FragColor = vec4(col * uReveal, 1.0);
      }
    }
  `

  // valori animati da GSAP durante l'ingresso
  const scene = { bgReveal: 0, fgReveal: 0, fgPop: 0 }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    return shader
  }

  /** Crea un livello WebGL su un canvas: immagine + mappa di profondità. */
  function createLayer(canvas, img, depth, transparent) {
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: transparent,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL non disponibile')

    const program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    gl.useProgram(program)

    // due triangoli che coprono tutto il canvas
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const upload = (image, unit, format) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    upload(img, 0, transparent ? gl.RGBA : gl.RGB)
    upload(depth, 1, gl.RGB)

    const u = (name) => gl.getUniformLocation(program, name)
    gl.uniform1i(u('uImage'), 0)
    gl.uniform1i(u('uDepth'), 1)
    gl.uniform1f(u('uImgAspect'), img.width / img.height)
    gl.uniform2f(u('uFocus'), FOCUS[0], FOCUS[1])
    gl.uniform1f(u('uStrength'), STRENGTH)
    gl.uniform1f(u('uFocusDepth'), FOCUS_DEPTH)
    gl.uniform1f(u('uAlphaLayer'), transparent ? 1 : 0)
    if (transparent) gl.clearColor(0, 0, 0, 0)

    const uni = { res: u('uRes'), pointer: u('uPointer'), zoom: u('uZoom'), reveal: u('uReveal') }

    return {
      resize(dpr) {
        canvas.width = Math.round(canvas.clientWidth * dpr)
        canvas.height = Math.round(canvas.clientHeight * dpr)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform2f(uni.res, canvas.width, canvas.height)
      },
      draw(px, py, zoom, reveal) {
        if (transparent) gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform2f(uni.pointer, px, py)
        gl.uniform1f(uni.zoom, zoom)
        gl.uniform1f(uni.reveal, reveal)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      },
    }
  }

  async function initScene() {
    // aperta con doppio clic (file://): il browser blocca le immagini normali in WebGL,
    // quindi usiamo la copia in base64 di assets/inline-assets.js
    let src = ASSETS
    if (location.protocol === 'file:') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'assets/inline-assets.js'
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
      src = window.WOLSKI_ASSETS
    }

    const [bg, bgDepth, fg, fgDepth] = await Promise.all([
      loadImage(src.bg),
      loadImage(src.bgDepth),
      loadImage(src.fg),
      loadImage(src.fgDepth),
    ])
    const layers = {
      bg: createLayer(document.getElementById('layer-bg'), bg, bgDepth, false),
      fg: createLayer(document.getElementById('layer-fg'), fg, fgDepth, true),
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      layers.bg.resize(dpr)
      layers.fg.resize(dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // input: mouse su desktop, giroscopio su telefono
    const target = { x: 0, y: 0 }
    const pointer = { x: 0, y: 0 }
    let lastInput = 0

    if (!reduceMotion) {
      window.addEventListener(
        'pointermove',
        (e) => {
          if (e.pointerType !== 'mouse') return
          target.x = (e.clientX / window.innerWidth) * 2 - 1
          target.y = -((e.clientY / window.innerHeight) * 2 - 1)
          lastInput = performance.now()
        },
        { passive: true },
      )
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null || e.beta == null) return
        target.x = Math.max(-1, Math.min(1, e.gamma / 25))
        target.y = -Math.max(-1, Math.min(1, (e.beta - 45) / 25))
        lastInput = performance.now()
      })
    }

    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      // senza input per 2,5 secondi: leggera oscillazione automatica, così il 3D si vede sempre
      if (!reduceMotion && now - lastInput > 2500) {
        const t = now / 1000
        target.x = Math.sin(t * 0.5) * 0.6
        target.y = Math.sin(t * 0.33) * 0.35
      }
      const k = 1 - Math.exp(-dt * 4)
      pointer.x += (target.x - pointer.x) * k
      pointer.y += (target.y - pointer.y) * k

      const base = 1.08
      layers.bg.draw(pointer.x, pointer.y, base + (1 - scene.bgReveal) * 0.12, scene.bgReveal)
      // i fighter entrano "saltando" verso lo spettatore
      layers.fg.draw(pointer.x, pointer.y, base + (1 - scene.fgPop) * 0.3, scene.fgReveal)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  /* ─── Giroscopio su iPhone: serve un tocco per chiedere il permesso ── */

  const gyroBtn = document.getElementById('gyro-btn')
  const hint = document.getElementById('hint')
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (reduceMotion) hint.textContent = ''
  if (!reduceMotion && isTouch && typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
    gyroBtn.hidden = false
    hint.hidden = true
    gyroBtn.addEventListener('click', async () => {
      try {
        await DeviceOrientationEvent.requestPermission()
      } finally {
        gyroBtn.hidden = true
      }
    })
  }

  /* ─── 2. Ingresso ────────────────────────────────────────── */

  let introStarted = false
  function intro() {
    if (introStarted) return
    introStarted = true

    if (!window.gsap || reduceMotion) {
      Object.assign(scene, { bgReveal: 1, fgReveal: 1, fgPop: 1 })
      root.classList.remove('is-loading')
      return
    }

    gsap.registerPlugin(SplitText)
    const split = SplitText.create('[data-name]', { type: 'chars', mask: 'chars' })
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
    tl.to(scene, { bgReveal: 1, duration: 2.2, ease: 'expo.out' }, 0)
      .from(split.chars, { yPercent: 110, duration: 1.2, stagger: 0.06 }, 0.35)
      .to(scene, { fgReveal: 1, duration: 0.5, ease: 'power2.out' }, 0.55)
      .to(scene, { fgPop: 1, duration: 1.6, ease: 'expo.out' }, 0.55)
      .from('[data-fade]', { y: 20, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.9)
      .from('[data-link]', { y: 40, autoAlpha: 0, duration: 1, stagger: 0.08 }, 1)
    root.classList.remove('is-loading')
  }

  // parte quando la scena è pronta (o subito se WebGL non c'è), al massimo dopo 4 secondi
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()
  initScene()
    .catch((err) => {
      console.warn('[3D] uso la foto normale:', err.message)
      const img = document.querySelector('.scene-fallback')
      img.src = FALLBACK
      root.classList.add('no-webgl')
    })
    .finally(() => fontsReady.then(intro))
  setTimeout(intro, 4000)

  /* ─── 3a. Grana pellicola ────────────────────────────────── */

  const grain = document.querySelector('.grain')
  const tile = document.createElement('canvas')
  tile.width = tile.height = 256
  const tctx = tile.getContext('2d')
  const data = tctx.createImageData(256, 256)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 128 + (Math.random() + Math.random() - 1) * 140
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  tctx.putImageData(data, 0, 0)
  grain.style.backgroundImage = `url(${tile.toDataURL()})`
  if (!reduceMotion) {
    setInterval(() => {
      grain.style.backgroundPosition = `${(Math.random() * 256) | 0}px ${(Math.random() * 256) | 0}px`
    }, 1000 / 18)
  }

  /* ─── 3b. Scintille rosse al click ───────────────────────── */

  const sparks = document.querySelector('.sparks')
  const sctx = sparks.getContext('2d')
  const list = []
  let sparkRaf = null
  const sizeSparks = () => {
    sparks.width = window.innerWidth
    sparks.height = window.innerHeight
  }
  sizeSparks()
  window.addEventListener('resize', sizeSparks)

  const DURATION = 450
  const drawSparks = (now) => {
    sctx.clearRect(0, 0, sparks.width, sparks.height)
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      const t = (now - s.start) / DURATION
      if (t >= 1) {
        list.splice(i, 1)
        continue
      }
      const eased = t * (2 - t)
      const dist = eased * 22
      const len = 12 * (1 - eased)
      sctx.strokeStyle = '#e10600'
      sctx.lineWidth = 2
      sctx.beginPath()
      sctx.moveTo(s.x + dist * Math.cos(s.a), s.y + dist * Math.sin(s.a))
      sctx.lineTo(s.x + (dist + len) * Math.cos(s.a), s.y + (dist + len) * Math.sin(s.a))
      sctx.stroke()
    }
    sparkRaf = list.length ? requestAnimationFrame(drawSparks) : null
  }

  window.addEventListener('click', (e) => {
    const start = performance.now()
    for (let i = 0; i < 10; i++) list.push({ x: e.clientX, y: e.clientY, a: (Math.PI * 2 * i) / 10, start })
    if (!sparkRaf) sparkRaf = requestAnimationFrame(drawSparks)
  })
})()
