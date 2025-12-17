import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

// Tekil Nöron Bileşeni
const Neuron = ({ position, isActive }) => {
  const meshRef = useRef();

  useFrame((state) => {
    // Eğer aktifse (butona basıldıysa) parlasın, değilse yavaşça yanıp sönsün
    const time = state.clock.getElapsedTime();
    const scale = isActive ? 1.5 : 1 + Math.sin(time * 2) * 0.1;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial 
        color={isActive ? "#00ff00" : "#00f3ff"} // Aktifse YEŞİL, değilse MAVİ
        emissive={isActive ? "#00ff00" : "#00f3ff"}
        emissiveIntensity={isActive ? 2 : 0.5} 
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};

// Bağlantı Çizgileri (Synapse)
const Connection = ({ start, end, weight }) => {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  const lineWidth = Math.abs(weight) * 0.5; 
  const color = weight > 0 ? '#00ff88' : '#ff0055'; 

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array([...start, ...end])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.6} linewidth={lineWidth} />
    </line>
  );
};

// Ana Bileşen
const NeuralNetwork = ({ architecture, weights, manualInput }) => {
  
  // Katmanları ve Nöronları Hesapla
  const layers = useMemo(() => {
    const computedLayers = [];
    architecture.forEach((neuronCount, layerIndex) => {
      const layerNeurons = [];
      for (let i = 0; i < neuronCount; i++) {
        // Nöronları 3D uzayda hizala
        const x = (layerIndex - (architecture.length - 1) / 2) * 4;
        const y = (i - (neuronCount - 1) / 2) * 2;
        layerNeurons.push({ id: `${layerIndex}-${i}`, position: [x, y, 0] });
      }
      computedLayers.push(layerNeurons);
    });
    return computedLayers;
  }, [architecture]);

  return (
    <group>
      {/* Nöronları Çiz */}
      {layers.map((layer, layerIndex) => 
        layer.map((neuron, neuronIndex) => {
          
          // GÖRSELLEŞTİRME MANTIĞI:
          // Eğer 1. katmansa (Giriş katmanı) VE manualInput varsa kontrol et
          let isActive = false;
          if (layerIndex === 0 && manualInput) {
             // manualInput[0] -> ilk nöronu, manualInput[1] -> ikinci nöronu yakar
             isActive = manualInput[neuronIndex] === 1;
          }

          return (
            <group key={neuron.id}>
              <Neuron 
                position={neuron.position} 
                isActive={isActive} 
              />
              {/* Nöronun üzerine değerini yazabiliriz (Opsiyonel) */}
              {layerIndex === 0 && (
                <Text 
                  position={[neuron.position[0], neuron.position[1] - 0.5, 0]} 
                  fontSize={0.3} 
                  color="white"
                >
                  {manualInput ? manualInput[neuronIndex] : ""}
                </Text>
              )}
            </group>
          )
        })
      )}

      {/* Bağlantıları Çiz */}
      {weights.map((layerWeights, layerIndex) => 
        layerWeights.map((neuronWeights, prevNeuronIndex) => 
          neuronWeights.map((weight, currentNeuronIndex) => {
             const startNeuron = layers[layerIndex][prevNeuronIndex];
             const endNeuron = layers[layerIndex + 1][currentNeuronIndex];
             if(!startNeuron || !endNeuron) return null;
             
             return (
               <Connection 
                 key={`${startNeuron.id}-${endNeuron.id}`}
                 start={startNeuron.position}
                 end={endNeuron.position}
                 weight={weight}
               />
             )
          })
        )
      )}
    </group>
  );
};

export default NeuralNetwork;