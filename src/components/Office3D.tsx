import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Text, MeshDistortMaterial, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Citizen } from '../types';
import { Loader2 } from 'lucide-react';

interface Office3DProps {
  citizens: Citizen[];
}

const Desk = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Table Top */}
    <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
      <boxGeometry args={[2, 0.1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.2} />
    </mesh>
    {/* Legs */}
    <mesh position={[-0.9, 0.35, -0.4]} castShadow>
      <boxGeometry args={[0.05, 0.7, 0.05]} />
      <meshStandardMaterial color="#94a3b8" />
    </mesh>
    <mesh position={[0.9, 0.35, -0.4]} castShadow>
      <boxGeometry args={[0.05, 0.7, 0.05]} />
      <meshStandardMaterial color="#94a3b8" />
    </mesh>
    <mesh position={[-0.9, 0.35, 0.4]} castShadow>
      <boxGeometry args={[0.05, 0.7, 0.05]} />
      <meshStandardMaterial color="#94a3b8" />
    </mesh>
    <mesh position={[0.9, 0.35, 0.4]} castShadow>
      <boxGeometry args={[0.05, 0.7, 0.05]} />
      <meshStandardMaterial color="#94a3b8" />
    </mesh>
    {/* Laptop */}
    <mesh position={[0, 0.76, 0]} castShadow>
      <boxGeometry args={[0.4, 0.02, 0.3]} />
      <meshStandardMaterial color="#334155" />
    </mesh>
    <mesh position={[0, 0.85, -0.15]} rotation={[-Math.PI / 4, 0, 0]} castShadow>
      <boxGeometry args={[0.4, 0.3, 0.02]} />
      <meshStandardMaterial color="#1e293b" emissive="#6366f1" emissiveIntensity={0.5} />
    </mesh>
  </group>
);

const Avatar = ({ citizen, position }: { citizen: Citizen, position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 2) * 0.1;
      meshRef.current.rotation.y += 0.01;
    }
  });

  const color = citizen.status === 'available' ? '#10b981' : citizen.status === 'busy' ? '#f59e0b' : '#64748b';

  return (
    <group position={position}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh ref={meshRef} castShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
        </mesh>
        <Text
          position={[0, 0.6, 0]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {citizen.name}
        </Text>
      </Float>
    </group>
  );
};

const OfficeScene = ({ citizens }: Office3DProps) => {
  return (
    <>
      <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={45} />
      <OrbitControls 
        enablePan={true} 
        maxPolarAngle={Math.PI / 2.1} 
        minDistance={2} 
        maxDistance={50}
      />
      
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={2} />
      <directionalLight position={[-10, 10, -10]} intensity={1} />

      {/* Debug Cube */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="indigo" />
      </mesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Grid */}
      <gridHelper args={[40, 40, '#475569', '#334155']} position={[0, 0, 0]} />

      {/* Furniture */}
      <Desk position={[-5, 0, -5]} />
      <Desk position={[5, 0, -5]} />
      <Desk position={[-5, 0, 5]} />
      <Desk position={[5, 0, 5]} />

      {/* Citizens */}
      {citizens && citizens.length > 0 ? citizens.map((citizen, index) => {
        const angle = (index / citizens.length) * Math.PI * 2;
        const radius = 8;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <Avatar 
            key={citizen.id} 
            citizen={citizen} 
            position={[x, 1.5, z]} 
          />
        );
      }) : (
        <Text position={[0, 3, 0]} fontSize={0.5} color="white">
          Waiting for Citizens...
        </Text>
      )}
    </>
  );
};

const Office3D: React.FC<Office3DProps> = ({ citizens }) => {
  return (
    <div className="w-full h-full min-h-[600px] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-800 relative">
      <Canvas 
        shadows 
        camera={{ position: [12, 12, 12], fov: 45 }}
        style={{ background: '#0f172a' }}
      >
        <Suspense fallback={
          <Html center>
            <div className="flex flex-col items-center gap-4 w-64">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Initializing 3D Environment...</p>
            </div>
          </Html>
        }>
          <OfficeScene citizens={citizens} />
        </Suspense>
      </Canvas>
      
      <div className="absolute top-8 left-8 pointer-events-none z-10">
        <div className="bg-slate-800/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3D Miniverse Active</p>
          </div>
          <p className="text-xs text-slate-300 font-medium">Orbit: Left Click • Zoom: Scroll • Pan: Right Click</p>
        </div>
      </div>
    </div>
  );
};

export default Office3D;
