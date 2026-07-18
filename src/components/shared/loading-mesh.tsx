'use client'
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import type * as THREE from 'three'

function SpinnerMesh() {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    meshRef.current.rotation.x += 0.01
    meshRef.current.rotation.y += 0.015
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.08
    meshRef.current.scale.set(scale, scale, scale)

    if (matRef.current) {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      const targetColor = isDark ? '#818cf8' : '#3b82f6'
      const targetEmissive = isDark ? '#818cf8' : '#3b82f6'
      const targetEmissiveIntensity = isDark ? 0.9 : 0.6
      const targetOpacity = isDark ? 0.95 : 0.9
      const lerp = (a: string, b: string, t: number) => {
        const ac = a.match(/\w\w/g)!.map(c => parseInt(c, 16))
        const bc = b.match(/\w\w/g)!.map(c => parseInt(c, 16))
        return `#${ac.map((c, i) => Math.round(c + (bc[i] - c) * t).toString(16).padStart(2, '0')).join('')}`
      }
      const t = 0.05
      matRef.current.color.set(lerp(matRef.current.color.getHexString(), targetColor.slice(1), t))
      matRef.current.emissive.set(lerp(matRef.current.emissive.getHexString(), targetEmissive.slice(1), t))
      matRef.current.emissiveIntensity += (targetEmissiveIntensity - matRef.current.emissiveIntensity) * t
      matRef.current.opacity += (targetOpacity - matRef.current.opacity) * t
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.5, 0]} />
      <meshPhysicalMaterial
        ref={matRef}
        color="#3b82f6"
        emissive="#3b82f6"
        emissiveIntensity={0.6}
        metalness={0.3}
        roughness={0.15}
        transmission={0.3}
        thickness={0.4}
        transparent
        opacity={0.9}
        wireframe={false}
      />
    </mesh>
  )
}

export default function LoadingMesh({ size = 40 }: { size?: number }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 2.5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: size, height: size, display: 'inline-block' }}
    >
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} intensity={1.2} />
      <pointLight position={[0, 0, 2]} intensity={0.6} color="#60a5fa" />
      <SpinnerMesh />
    </Canvas>
  )
}
