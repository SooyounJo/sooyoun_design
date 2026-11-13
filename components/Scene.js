import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function useWindowPointer() {
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (event) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return pointer
}

function useCompact() {
  const compact = useRef(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches
  )

  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)')
    const apply = () => {
      compact.current = query.matches
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return compact
}

function Dust() {
  const points = useRef()
  const positions = useMemo(() => {
    const count = 380
    const array = new Float32Array(count * 3)

    for (let index = 0; index < count; index += 1) {
      const radius = 2.15 + Math.random() * 1.15
      const theta = Math.random() * Math.PI * 2
      array[index * 3] = Math.cos(theta) * radius
      array[index * 3 + 1] = (Math.random() - 0.5) * 1.8
      array[index * 3 + 2] = Math.sin(theta) * radius
    }

    return array
  }, [])

  useFrame((_, delta) => {
    points.current.rotation.y += delta * 0.035
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#f3e7d6"
        size={0.014}
        transparent
        opacity={0.72}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function Sculpture({ pointer, compact }) {
  const group = useRef()
  const knot = useRef()
  const satellite = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const targetX = compact.current ? 0.2 : 1.45
    const targetY = compact.current ? 1.22 : 0.05
    const targetScale = compact.current ? 0.46 : 1

    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX, 0.06)
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY, 0.06)
    group.current.scale.setScalar(
      THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.06)
    )
    group.current.rotation.y = time * 0.12 + pointer.current.x * 0.35
    group.current.rotation.x = pointer.current.y * 0.18
    knot.current.rotation.z = time * 0.18
    satellite.current.position.x = Math.cos(time * 0.7) * 1.78
    satellite.current.position.z = Math.sin(time * 0.7) * 1.78
  })

  return (
    <group
      ref={group}
      position={[compact.current ? 0.2 : 1.45, compact.current ? 1.22 : 0.05, 0]}
      scale={compact.current ? 0.46 : 1}
    >
      <Float speed={1.5} rotationIntensity={0.25} floatIntensity={0.35}>
        <mesh ref={knot}>
          <icosahedronGeometry args={[1.05, 6]} />
          <MeshDistortMaterial
            color="#d7b48a"
            roughness={0.18}
            metalness={0.82}
            distort={0.28}
            speed={1.5}
          />
        </mesh>
      </Float>
      <mesh rotation={[Math.PI / 2.35, 0.2, 0]}>
        <torusGeometry args={[1.72, 0.011, 16, 140]} />
        <meshBasicMaterial color="#f4eadc" transparent opacity={0.55} />
      </mesh>
      <mesh ref={satellite}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial color="#f7f4ee" emissive="#d7b48a" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function Rig({ pointer }) {
  useFrame((state) => {
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      pointer.current.x * 0.28,
      0.04
    )
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      0.15 - pointer.current.y * 0.18,
      0.04
    )
    state.camera.lookAt(0, 0, 0)
  })

  return null
}

export default function Scene() {
  const pointer = useWindowPointer()
  const compact = useCompact()

  return (
    <Canvas
      camera={{ position: [0, 0.1, 6.4], fov: 38 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#090a0e']} />
      <fog attach="fog" args={['#090a0e', 9, 16]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 3.5, 4]} intensity={2.4} color="#fff6ec" />
      <pointLight position={[-3.2, -1.2, 2]} intensity={12} color="#7aa2ff" distance={10} />
      <Dust />
      <Sculpture pointer={pointer} compact={compact} />
      <Rig pointer={pointer} />
    </Canvas>
  )
}
