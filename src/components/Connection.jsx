import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const Connection = ({ start, end, weight }) => {
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...start), 
    new THREE.Vector3(...end)
  ]);

  // Ağırlığa göre renk belirle (Pozitif: Mavi, Negatif: Kırmızı)
  const color = weight > 0 ? '#44aaff' : '#ff4444';
  const opacity = Math.min(Math.abs(weight), 1) * 0.5;

  return (
    <group>
      {/* 1. Sabit Bağlantı Çizgisi */}
      <line geometry={lineGeometry}>
        <lineBasicMaterial 
          color={color} 
          transparent 
          opacity={opacity} 
          linewidth={1} 
        />
      </line>

      {/* 2. Hareket Eden Veri Paketi (Sinyal) */}
      <DataPacket start={start} end={end} color={color} speed={Math.abs(weight) * 2} />
    </group>
  );
};

// İç Bileşen: Hareket eden küçük ışık topu
const DataPacket = ({ start, end, color, speed }) => {
  const meshRef = useRef();
  // 0 ile 1 arasında bir değer (Yolun neresinde?)
  const [progress, setProgress] = useState(Math.random()); 

  useFrame((state, delta) => {
    if (meshRef.current) {
      // İlerlet
      // (speed değeri ne kadar yüksekse o kadar hızlı akar)
      const newProgress = (progress + delta * (0.5 + speed * 0.5)) % 1;
      setProgress(newProgress);

      // Başlangıç ve Bitiş noktaları arasında "Interpolation" yap
      // Yani: start + (end - start) * progress
      const x = start[0] + (end[0] - start[0]) * newProgress;
      const y = start[1] + (end[1] - start[1]) * newProgress;
      const z = start[2] + (end[2] - start[2]) * newProgress;

      meshRef.current.position.set(x, y, z);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.08, 8, 8]} /> {/* Çok küçük bir top */}
      <meshBasicMaterial color={color} />
    </mesh>
  );
};

export default Connection;