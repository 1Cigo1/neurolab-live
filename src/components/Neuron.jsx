import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const Neuron = ({ position, isActive }) => {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if(meshRef.current) {
        // Hafif nefes alma efekti
        const scale = isActive ? 1.2 : 1;
        meshRef.current.scale.lerp({ x: scale, y: scale, z: scale }, 0.1);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.3, 32, 32]} /> 
      <meshStandardMaterial 
        color={isActive ? "#00ff88" : "#555"} 
        emissive={isActive ? "#00ff88" : "#000"} 
        emissiveIntensity={isActive ? 2 : 0}
      />
    </mesh>
  );
};

export default Neuron;