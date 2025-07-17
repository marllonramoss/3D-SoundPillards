'use client'

import React, { useRef, useEffect, useMemo, useState, useLayoutEffect } from 'react'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, ContactShadows, useTexture, shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { InstancedMesh, Object3D } from 'three'

type Props = {}

// Hook para análise de áudio
function useAudioAnalyser(audioUrl: string, fftSize = 128, playState: 'playing' | 'paused' | 'stopped' = 'stopped') {
  const [frequencies, setFrequencies] = useState<number[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio(audioUrl)
      audio.crossOrigin = 'anonymous'
      audio.loop = true
      audioRef.current = audio
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = ctxRef.current.createMediaElementSource(audio)
      const analyser = ctxRef.current.createAnalyser()
      analyser.fftSize = fftSize
      source.connect(analyser)
      analyser.connect(ctxRef.current.destination)
      analyserRef.current = analyser
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (ctxRef.current) {
        ctxRef.current.close()
        ctxRef.current = null
      }
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current!)
      }
    }
  }, [audioUrl, fftSize])

  useEffect(() => {
    const audio = audioRef.current
    const ctx = ctxRef.current
    if (!audio || !ctx) return
    if (playState === 'playing') {
      ctx.resume()
      audio.play()
      const analyser = analyserRef.current
      if (!analyser) return
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let running = true
      function update() {
        if (!running) return
        if (analyser) {
          analyser.getByteFrequencyData(dataArray)
          setFrequencies(Array.from(dataArray))
        }
        rafRef.current = window.requestAnimationFrame(update)
      }
      update()
      return () => { running = false }
    } else if (playState === 'paused') {
      audio.pause()
      ctx.suspend()
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current!)
      }
    } else if (playState === 'stopped') {
      audio.pause()
      audio.currentTime = 0
      ctx.suspend()
      setFrequencies([])
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current!)
      }
    }
  }, [playState])

  return frequencies
}

function PillardModel({ scale = 1, phaseOffset = 0, freqValue = 0 }: { scale?: number, phaseOffset?: number, freqValue?: number }) {
  const { scene } = useGLTF('pillardFIXEDAGAIN.glb')
  const modelRef = useRef<THREE.Group>(null)

  const bMetal = useTexture('/blackMetal.png')
  const gMetal = useTexture('/greyMetalv2.png')

  // Clona o modelo para cada instância
  const localScene = useMemo(() => scene.clone(true), [scene])

  // Referência para o mesh do Cylinder
  const cylinderRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if ((child.type === 'Mesh' || child instanceof THREE.Mesh) && 'material' in child) {
          const mesh = child as THREE.Mesh
          if (child.name === 'base') {
            mesh.material = new THREE.MeshMatcapMaterial({ matcap: bMetal })
          }
          if (child.name === 'Cylinder') {
            mesh.material = new THREE.MeshMatcapMaterial({ matcap: gMetal })
            cylinderRef.current = mesh
          }
        }
      })
    }
  }, [bMetal, gMetal, localScene])

  useFrame((state) => {
    if (modelRef.current) {
      modelRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
    // Anima o Cylinder de acordo com a frequência (impacto aumentado)
    if (cylinderRef.current) {
      // freqValue: 0-255, normaliza e aplica curva exponencial para mais contraste
      const impact = 3.5;
      const normalized = Math.pow(freqValue / 255, 1.5);
      const freqScale = 1.0 + normalized * impact;
      cylinderRef.current.position.y = freqScale;
    }
  })

  return (
    <primitive
      ref={modelRef}
      object={localScene}
      scale={scale}
      position={[0, 0, 0]}
    />
  )
}

function FloorModel() {
  const { scene } = useGLTF('/floorBaked.glb')
  
  return (
    <primitive 
      object={scene} 
      scale={1}
      position={[0, -4, 0]}
    />
  )
}

function PillardsOnSphere({ radius = 2, count = 200, frequencies = [] }: { radius?: number, count?: number, frequencies?: number[] }) {
  // Gera pontos uniformemente distribuídos na esfera
  const positions = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = []
    const inc = Math.PI * (3 - Math.sqrt(5)) // golden angle
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2 // y vai de 1 a -1
      const r = Math.sqrt(1 - y * y)
      const phi = i * inc
      const x = Math.cos(phi) * r
      const z = Math.sin(phi) * r
      pts.push([x * radius, y * radius, z * radius])
    }
    return pts
  }, [radius, count])

  // Usar o mesmo matcap do Cylinder
  const gMetal = useTexture('/greyMetalv2.png')

  // Ponto de origem da onda (lado direito da esfera)
  const origin = useMemo(() => new THREE.Vector3(radius, 0, 0), [radius])

  return (
    <group position={[0, 0, 0]}>
      
      {/* Esfera sólida com matcap igual ao Cylinder */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshMatcapMaterial matcap={gMetal} />
      </mesh>
      {positions.map((pos, i) => {
        // Calcula a orientação para cada Pillard ficar perpendicular à esfera
        const normal = new THREE.Vector3(...pos).normalize()
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
        // Calcula o ângulo entre o ponto e o topo da esfera
        const posVec = new THREE.Vector3(...pos)
        const angle = origin.angleTo(posVec)
        // Associa cada pillard a uma frequência
        const freqIndex = Math.floor(i / count * (frequencies.length || 1))
        const freqValue = frequencies[freqIndex] || 0
        return (
          <group key={i} position={pos as [number, number, number]} quaternion={quaternion}>
            <PillardModel scale={0.2} phaseOffset={angle * 2} freqValue={freqValue} />
          </group>
        )
      })}
    </group>
  )
}

function SpectrumModel() {
  const { scene } = useGLTF('/Spectrum.glb')
  return (
    <primitive 
      object={scene}
      scale={2}
      position={[0, 0, 0]}
    />
  )
}

// Shader customizado para efeito de onda
const WaveMaterial = shaderMaterial(
  {
    waveY: 0,
    waveThickness: 0.2,
    color: new THREE.Color('#d87fff'),
    uTime: 0,
  },
  // Vertex Shader
  `
    varying float vY;
    varying vec3 vPosition;
    void main() {
      vY = position.y;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    // Simplex Noise 3D (GLSL, Ashima Arts)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod289(i); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 1.0/7.0; // N=7
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,N*N)
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
      vec4 x = x_ *ns.x + ns.y;
      vec4 y = y_ *ns.x + ns.y;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }
    uniform float waveY;
    uniform float waveThickness;
    uniform vec3 color;
    uniform float uTime;
    varying float vY;
    varying vec3 vPosition;
    void main() {
      float t = uTime * 0.7;
      float n1 = snoise(vec3(vPosition.x * 2.0, vPosition.z * 2.0, waveY * 0.5 + t)) * 0.5;
      float n2 = snoise(vec3(vPosition.x * 7.0 + t, vPosition.z * 3.0 - t, waveY * 1.5 - t)) * 0.3;
      float n3 = snoise(vec3(vPosition.x * 13.0 - t, vPosition.z * 11.0 + t, waveY * 2.5 + t)) * 0.2;
      float distortion = n1 + n2 + n3;
      float distortedWaveY = waveY + distortion;
      float inWave = smoothstep(distortedWaveY, distortedWaveY + waveThickness, vY) * (1.0 - smoothstep(distortedWaveY + waveThickness, distortedWaveY + 2.0 * waveThickness, vY));
      if (inWave < 0.1) discard;
      gl_FragColor = vec4(color, inWave * 0.4);
    }
  `
)
extend({ WaveMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      waveMaterial: any
    }
  }
}

function SpectrumWaveEffect() {
  const { scene } = useGLTF('/Spectrum.glb')
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)
  // Encontrar mesh principal
  const mesh = useMemo(() => {
    let found: THREE.Mesh | null = null
    scene.traverse(child => {
      if ((child as THREE.Mesh).isMesh && !found) found = child as THREE.Mesh
    })
    return found as THREE.Mesh | null
  }, [scene])
  // Calcular minY e maxY
  const [minY, maxY] = useMemo(() => {
    if (!mesh || !mesh.geometry) return [0, 1]
    const pos = (mesh.geometry.attributes.position.array as Float32Array)
    let min = Infinity, max = -Infinity
    for (let i = 1; i < pos.length; i += 3) {
      if (pos[i] < min) min = pos[i]
      if (pos[i] > max) max = pos[i]
    }
    return [min, max]
  }, [mesh])
  // Animar a onda
  useFrame((state) => {
    if (materialRef.current) {
      let t = ((state.clock.getElapsedTime() * 1.5) % 1)
      let waveY = minY + (maxY - minY) * t
      materialRef.current.uniforms.waveY.value = waveY
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime()
    }
  })
  if (!mesh) return null
  return (
    <primitive
      object={mesh}
      ref={meshRef}
      scale={3}
      position={[0, -3, 0]}
      visible={true}
    >
      <waveMaterial ref={materialRef} attach="material" waveThickness={0.2} color={new THREE.Color('#d87fff')} />
    </primitive>
  )
}

// Shader cinematográfico para partículas (azul/ciano, glow, fade nas bordas)
const ParticleMaterial = shaderMaterial(
  {
    uColor: new THREE.Color('#ffffff'), // branco
    uTime: 0,
    uAlpha: 0.85,
  },
  // Vertex
  `
    attribute float instanceBrightness;
    varying vec2 vUv;
    varying float vFade;
    varying float vBrightness;
    void main() {
      vUv = uv;
      vBrightness = instanceBrightness;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float dist = length(mvPosition.xyz);
      vFade = 1.0 - smoothstep(5.0, 20.0, dist); // fade com distância
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment
  `
    uniform vec3 uColor;
    uniform float uAlpha;
    varying vec2 vUv;
    varying float vFade;
    varying float vBrightness;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float alpha = smoothstep(1.0, 0.7, d) * uAlpha * vFade * vBrightness;
      if (alpha < 0.01) discard;
      vec3 color = uColor * vBrightness + vec3(0.7, 0.8, 1.0) * (1.0 - d) * 0.15;
      gl_FragColor = vec4(color, alpha);
    }
  `
)
extend({ ParticleMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      particleMaterial: any
    }
  }
}

function Particles({ count = 1000, radius = 12 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<any>(null)
  const dummy = useMemo(() => new Object3D(), [])
  // Distribuição volumétrica alta, começando logo acima do chão (y = -3.8)
  // Agora com brilho aleatório
  const particles = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 2 * radius
      const y = -3.8 + Math.random() * (24.0 + 3.8)
      const z = (Math.random() - 0.5) * 2 * radius
      arr.push({
        x, y, z,
        speed: 0.2 + Math.random() * 0.8,
        offset: Math.random() * 1000,
        scale: 0.01 + Math.random() * 0.02,
        brightness: 0.6 + Math.random() * 0.7 // brilho aleatório entre 0.6 e 1.3
      })
    }
    return arr
  }, [count, radius])

  // Instancia o buffer de brilho ANTES do render
  useLayoutEffect(() => {
    if (!meshRef.current) return
    const brightnessArray = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      brightnessArray[i] = particles[i].brightness
    }
    meshRef.current.geometry.setAttribute('instanceBrightness', new THREE.InstancedBufferAttribute(brightnessArray, 1))
  }, [particles, count])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = particles[i]
      const time = t * p.speed + p.offset
      dummy.position.set(
        p.x + Math.sin(time * 0.5) * 0.5,
        p.y + Math.cos(time * 0.7) * 0.5,
        p.z + Math.sin(time * 0.3) * 0.5
      )
      dummy.scale.setScalar(p.scale + Math.sin(time) * 0.003)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      key={count + '-' + radius} // força atualização
    >
      <sphereGeometry args={[1, 8, 8]} />
      {/* DEBUG: material padrão para testar visualização */}
      <meshBasicMaterial color="#fff" />
    </instancedMesh>
  )
}

export default function FullScene({}: Props) {
  const [audioState, setAudioState] = useState<'stopped' | 'playing' | 'paused'>('stopped')
  const frequencies = useAudioAnalyser('/audio.mp3', 128, audioState)

  let buttonLabel = 'Iniciar Áudio'
  if (audioState === 'playing') buttonLabel = 'Pausar'
  if (audioState === 'paused') buttonLabel = 'Retomar'

  let buttonIcon = null
  if (audioState === 'playing') {
    // Pause icon
    buttonIcon = (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="5" width="5" height="18" rx="2" fill="#fff"/>
        <rect x="17" y="5" width="5" height="18" rx="2" fill="#fff"/>
      </svg>
    )
  } else {
    // Play icon
    buttonIcon = (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="rgba(0,0,0,0.15)"/>
        <polygon points="13,10 24,16 13,22" fill="#fff"/>
      </svg>
    )
  }

  function handleButtonClick() {
    if (audioState === 'stopped') setAudioState('playing')
    else if (audioState === 'playing') setAudioState('paused')
    else if (audioState === 'paused') setAudioState('playing')
  }

  return (
    <div className="w-full h-screen" style={{ width: '100vw', height: '100vh' }}>
      <button
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.0)',
          border: 'none',
          boxShadow: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 0.2s',
        }}
        onClick={handleButtonClick}
        aria-label={audioState === 'playing' ? 'Pausar áudio' : 'Tocar áudio'}
      >
        {buttonIcon}
      </button>
      <Canvas
        camera={{ 
          position: [0, 0, 8],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
      >
        {/* Instancia vários Pillards na superfície de uma esfera */}
        <PillardsOnSphere radius={2} count={150} frequencies={frequencies} />
        {/* Floor */}
        <FloorModel />
        {/* Spectrum Model */}
        <SpectrumWaveEffect />
        {/* Partículas cinematográficas */}
        <Particles count={1000} radius={12} />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  )
}

// Pré-carregar os modelos
useGLTF.preload('/pillardFIXEDAGAIN.glb')
useGLTF.preload('/floorBaked.glb')
useGLTF.preload('/Spectrum.glb')