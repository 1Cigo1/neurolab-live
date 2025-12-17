import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- 1. ELEKTRON (ENERJİ TOPU) ---
const Electron = ({ start, end, speed, offset }) => {
  const meshRef = useRef();
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const t = (time * speed + offset) % 1; 
    meshRef.current.position.lerpVectors(startVec, endVec, t);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.2, 8, 8]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
  );
};

// --- 2. NÖRON (YILDIZ) ---
const Neuron = ({ position, isActive, isInput, isOutput }) => {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    
    // Yüzen efekt
    meshRef.current.position.y += Math.sin(time + position[0]) * 0.005;
    meshRef.current.position.z += Math.cos(time + position[1]) * 0.005;

    // Nabız efekti
    const scale = (isActive ? 2.5 : 1.8) + Math.sin(time * 3) * 0.2;
    meshRef.current.scale.setScalar(scale);
    meshRef.current.rotation.y += 0.01;
  });

  let color = "#ffffff"; 
  if (isActive) color = "#00ff00"; 
  else if (isInput) color = "#00aaff"; 
  else if (isOutput) color = "#ff0055"; 

  return (
    <mesh ref={meshRef} position={position}>
      <dodecahedronGeometry args={[0.5, 0]} /> 
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        emissiveIntensity={isActive ? 3 : 0.8}
        roughness={0.2} metalness={0.8}
      />
    </mesh>
  );
};

// --- 3. BAĞLANTI (GÜNCELLENDİ: ARTIK KOPMA YOK) ---
const Connection = ({ start, end, weight }) => {
  if (!start || !end) return null;

  // Ağırlık verisi var mı kontrol et
  const hasWeight = weight !== undefined && weight !== null;
  const intensity = hasWeight ? Math.abs(weight) : 0;
  
  // Varsayılan (Veri yoksa): SİLİK BEYAZ (Hayalet Çizgi)
  let linkColor = '#ffffff'; 
  let opacity = 0.15;        
  let lineWidth = 1;

  // Veri Varsa: RENKLENİR
  if (hasWeight) {
    linkColor = weight > 0 ? '#00ff88' : '#ff0055';
    opacity = 0.6; // Daha belirgin
    lineWidth = 2;
  }

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([...start, ...end])} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial 
          color={linkColor} 
          transparent 
          opacity={opacity} 
          linewidth={lineWidth} 
        />
      </line>

      {/* Elektron sadece veri varsa ve bağlantı güçlüyse aksın */}
      {hasWeight && intensity > 0.1 && (
        <Electron start={start} end={end} speed={intensity * 2} offset={Math.random()} />
      )}
    </group>
  );
};

// --- ANA BİLEŞEN ---
const NeuralNetwork = ({ architecture, weights, manualInput }) => {
  if (!architecture || architecture.length === 0) return null;

  const layers = useMemo(() => {
    const computedLayers = [];
    const totalLayers = architecture.length;
    
    // --- SONSUZ BÜYÜME MATEMATİĞİ ---
    // Katman sayısı arttıkça evrenin çapı da büyüsün.
    // Her katman için 15 birim alan açıyoruz. (5 katman -> 75 birim, 20 katman -> 300 birim)
    const universeSize = Math.max(60, totalLayers * 20); 

    architecture.forEach((neuronCount, layerIndex) => {
      const layerNeurons = [];
      const isInput = layerIndex === 0;
      const isOutput = layerIndex === totalLayers - 1;

      for (let i = 0; i < neuronCount; i++) {
        let x, y, z;

        if (isInput) {
          // Girişler: Evrenin en sol ucuna gitsin
          x = -universeSize / 1.5; 
          y = (i - (neuronCount - 1) / 2) * 8; 
          z = 0;
        } 
        else if (isOutput) {
          // Çıkışlar: Evrenin en sağ ucuna gitsin
          x = universeSize / 1.5;
          y = (i - (neuronCount - 1) / 2) * 15;
          z = 0;
        } 
        else {
          // ARA KATMANLAR: Evrenin büyüklüğüne göre rastgele dağılsın
          // universeSize ne kadar büyükse, nöronlar o kadar uzağa saçılır.
          x = (Math.random() - 0.5) * universeSize; 
          
          // Y ve Z de büyüsün (Tam küresel büyüme)
          const spread = universeSize * 0.6; 
          y = (Math.random() - 0.5) * spread;
          z = (Math.random() - 0.5) * spread;
        }

        layerNeurons.push({ 
          id: `${layerIndex}-${i}`, 
          position: [x, y, z],
          isInput,
          isOutput
        });
      }
      computedLayers.push(layerNeurons);
    });
    return computedLayers;
  }, [architecture]); // architecture değişince yeniden hesapla

  return (
    <group>
      {/* Nöronları Çiz */}
      {layers.map((layer, layerIndex) => 
        layer.map((neuron, neuronIndex) => {
          let isActive = false;
          if (layerIndex === 0 && manualInput && manualInput.length > neuronIndex) {
             isActive = manualInput[neuronIndex] === 1;
          }
          return (
            <Neuron 
              key={neuron.id} 
              position={neuron.position} 
              isActive={isActive} 
              isInput={neuron.isInput}
              isOutput={neuron.isOutput}
            />
          )
        })
      )}

      {/* --- KRİTİK DÜZELTME: ZORLA BAĞLANTI DÖNGÜSÜ --- 
          Eskiden 'weights.map' kullanıyorduk, veri yoksa döngüye girmiyordu.
          Şimdi 'layers.map' kullanıyoruz. Nöron varsa çizgi de vardır!
      */}
      {layers.slice(0, -1).map((currentLayer, layerIndex) => {
        const nextLayer = layers[layerIndex + 1];
        
        return currentLayer.map((startNeuron, fromIndex) => {
          return nextLayer.map((endNeuron, toIndex) => {
             
             // Ağırlığı güvenli şekilde çekmeye çalış
             let weight = undefined;
             if (weights && weights[layerIndex] && weights[layerIndex][fromIndex]) {
               weight = weights[layerIndex][fromIndex][toIndex];
             }

             // Connection bileşenine 'weight' undefined olsa bile gönderiyoruz.
             // O kendi içinde "weight yoksa beyaz çiz" diyecek.
             return (
               <Connection 
                 key={`${startNeuron.id}-${endNeuron.id}`}
                 start={startNeuron.position}
                 end={endNeuron.position}
                 weight={weight}
               />
             )
          })
        })
      })}
    </group>
  );
};

export default NeuralNetwork;