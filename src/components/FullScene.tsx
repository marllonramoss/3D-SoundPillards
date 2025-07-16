'use client'

import React, { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, ContactShadows, useTexture } from '@react-three/drei'
import * as THREE from 'three'

type Props = {}

function PillardModel({ scale = 1, phaseOffset = 0 }: { scale?: number, phaseOffset?: number }) {
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
    // Anima o Cylinder subindo e descendo com efeito de onda
    if (cylinderRef.current) {
      cylinderRef.current.position.y = 1.0 + Math.sin(state.clock.elapsedTime * 4 + phaseOffset) * 1.2
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

function PillardsOnSphere({ radius = 2, count = 200 }) {
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
    <>
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
        return (
          <group key={i} position={pos as [number, number, number]} quaternion={quaternion}>
            <PillardModel scale={0.2} phaseOffset={angle * 2} />
          </group>
        )
      })}
    </>
  )
}

export default function FullScene({}: Props) {
  return (
    <div className="w-full h-screen" style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{ 
          position: [0, 0, 8],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
      >
        {/* Instancia vários Pillards na superfície de uma esfera */}
        <PillardsOnSphere radius={2} count={150} />
        {/* Floor */}
        <FloorModel />
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