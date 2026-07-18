'use client'
import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Sparkles, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import type * as THREE from 'three'

const lerpColor = (a: string, b: string, t: number) => {
  const ac = a.match(/\w\w/g)!.map(c => parseInt(c, 16))
  const bc = b.match(/\w\w/g)!.map(c => parseInt(c, 16))
  return `#${ac.map((c, i) => Math.round(c + (bc[i] - c) * t).toString(16).padStart(2, '0')).join('')}`
}

const isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

function LogoMesh() {
  const groupRef = useRef<THREE.Group>(null)
  const knotRef = useRef<THREE.Mesh>(null)
  const knotMatRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const ringMatRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const { pointer } = useThree()

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x += (pointer.x * 0.3 - groupRef.current.position.x) * 0.05
      groupRef.current.position.y += (-pointer.y * 0.3 - groupRef.current.position.y) * 0.05
    }
    if (knotRef.current) {
      knotRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
      knotRef.current.rotation.y += 0.005
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.2
    }
    const dark = isDarkTheme()
    const t = 0.05
    if (knotMatRef.current) {
      const knotColor = dark ? '#818cf8' : '#3b82f6'
      const knotEmissive = dark ? '#818cf8' : '#3b82f6'
      const knotEI = dark ? 0.4 : 0.15
      knotMatRef.current.color.set(lerpColor(knotMatRef.current.color.getHexString(), knotColor.slice(1), t))
      knotMatRef.current.emissive.set(lerpColor(knotMatRef.current.emissive.getHexString(), knotEmissive.slice(1), t))
      knotMatRef.current.emissiveIntensity += (knotEI - knotMatRef.current.emissiveIntensity) * t
    }
    if (ringMatRef.current) {
      const ringColor = dark ? '#c084fc' : '#a855f7'
      const ringEmissive = dark ? '#c084fc' : '#a855f7'
      const ringEI = dark ? 0.6 : 0.3
      const ringOpacity = dark ? 0.8 : 0.6
      ringMatRef.current.color.set(lerpColor(ringMatRef.current.color.getHexString(), ringColor.slice(1), t))
      ringMatRef.current.emissive.set(lerpColor(ringMatRef.current.emissive.getHexString(), ringEmissive.slice(1), t))
      ringMatRef.current.emissiveIntensity += (ringEI - ringMatRef.current.emissiveIntensity) * t
      ringMatRef.current.opacity += (ringOpacity - ringMatRef.current.opacity) * t
    }
  })

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <group ref={groupRef}>
        <mesh ref={knotRef}>
          <torusKnotGeometry args={[0.6, 0.25, 128, 24]} />
          <meshPhysicalMaterial
            ref={knotMatRef}
            color="#3b82f6"
            metalness={0.1}
            roughness={0.05}
            transmission={0.7}
            thickness={0.6}
            transparent
            opacity={0.92}
            clearcoat={0.4}
            emissive="#3b82f6"
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh ref={ringRef}>
          <torusGeometry args={[1.0, 0.03, 32, 64]} />
          <meshPhysicalMaterial
            ref={ringMatRef}
            color="#a855f7"
            metalness={0.5}
            roughness={0.1}
            transparent
            opacity={0.6}
            emissive="#a855f7"
            emissiveIntensity={0.3}
          />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => (
          <OrbitingParticle key={i} index={i} count={6} />
        ))}
      </group>
    </Float>
  )
}

function OrbitingParticle({ index, count }: { index: number; count: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const angle = (index / count) * Math.PI * 2
  const radius = 1.0

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime * 0.3 + angle
    meshRef.current.position.x = Math.cos(t) * radius
    meshRef.current.position.z = Math.sin(t) * radius
    meshRef.current.position.y = Math.sin(t * 0.7) * 0.3
    meshRef.current.rotation.x += 0.02
    meshRef.current.rotation.y += 0.03
    if (matRef.current) {
      const dark = isDarkTheme()
      const lerpT = 0.05
      const targetColor = dark ? '#a5b4fc' : '#60a5fa'
      const targetEmissive = dark ? '#a5b4fc' : '#60a5fa'
      const targetEI = dark ? 0.7 : 0.4
      matRef.current.color.set(lerpColor(matRef.current.color.getHexString(), targetColor.slice(1), lerpT))
      matRef.current.emissive.set(lerpColor(matRef.current.emissive.getHexString(), targetEmissive.slice(1), lerpT))
      matRef.current.emissiveIntensity += (targetEI - matRef.current.emissiveIntensity) * lerpT
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.07, 0]} />
      <meshPhysicalMaterial
        ref={matRef}
        color="#60a5fa"
        metalness={0.8}
        roughness={0.1}
        emissive="#60a5fa"
        emissiveIntensity={0.4}
      />
    </mesh>
  )
}

function SceneLights() {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const dirRef = useRef<THREE.DirectionalLight>(null)
  const pointRef = useRef<THREE.PointLight>(null)

  useFrame(() => {
    const dark = isDarkTheme()
    const t = 0.05
    if (ambientRef.current) {
      const target = dark ? 0.5 : 0.3
      ambientRef.current.intensity += (target - ambientRef.current.intensity) * t
    }
    if (dirRef.current) {
      const target = dark ? 2.0 : 1.5
      dirRef.current.intensity += (target - dirRef.current.intensity) * t
    }
    if (pointRef.current) {
      const target = dark ? 1.2 : 0.8
      pointRef.current.intensity += (target - pointRef.current.intensity) * t
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.3} />
      <directionalLight ref={dirRef} position={[5, 5, 5]} intensity={1.5} />
      <directionalLight position={[-4, 2, -4]} intensity={0.6} color="#3b82f6" />
      <pointLight ref={pointRef} position={[0, 0, 4]} intensity={0.8} color="#a855f7" />
    </>
  )
}

function SceneSparkles() {
  const sparklesRef = useRef<any>(null)

  useFrame(() => {
    const dark = isDarkTheme()
    const t = 0.05
    if (sparklesRef.current) {
      const targetOpacity = dark ? 0.45 : 0.25
      sparklesRef.current.opacity += (targetOpacity - (sparklesRef.current.opacity || 0.25)) * t
    }
  })

  return <Sparkles ref={sparklesRef} count={25} scale={8} size={0.6} speed={0.2} opacity={0.25} color="#3b82f6" />
}

export default function LoginScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    >
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <SceneLights />
      <LogoMesh />
      <SceneSparkles />
    </Canvas>
  )
}
