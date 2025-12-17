import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Neuron from './Neuron';
import Connection from './Connection';
import * as THREE from 'three';

const NeuralNetwork = ({ architecture , weights}) => {
  const groupRef = useRef();

  // Ağı yavaşça, sanki bir gezegen gibi boşlukta süzülürcesine döndür
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
      groupRef.current.rotation.z += 0.0005;
    }
  });
  
  const layers = useMemo(() => {
    const layerData = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    // Her hesaplamada farklı bir rastgelelik olsun diye bir çekirdek (seed) mantığı
    // Ama React'in render döngüsünde sabit kalsın diye useMemo içindeyiz.
    
    architecture.forEach((neuronCount, layerIndex) => {
      const neurons = [];
      
      // Temel Yarıçap (Yine dışa doğru büyüyor)
      const baseRadius = 3 + (layerIndex * 3.5);

      // KATMAN RASTGELELİĞİ:
      // Her katman uzayda farklı bir açıda dursun ki "tünel" görüntüsü oluşmasın.
      const layerRotation = new THREE.Euler(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      );

      for (let i = 0; i < neuronCount; i++) {
        // 1. Fibonacci Dağılımı (Temel düzgün dağılım)
        const i_normalized = i + 0.5; 
        const phi = Math.acos(1 - 2 * i_normalized / neuronCount);
        const theta = 2 * Math.PI * i_normalized / goldenRatio;

        // 2. ORGANİK BOZULMA (Sizin istediğiniz düzensizlik burada)
        // Her nöron tam küre yüzeyinde olmasın, %20 içeri veya dışarı taşsın.
        const randomRadiusOffset = (Math.random() - 0.5) * (baseRadius * 0.4); 
        const r = baseRadius + randomRadiusOffset;

        // Küresel koordinatları oluştur
        let x = r * Math.sin(phi) * Math.cos(theta);
        let y = r * Math.sin(phi) * Math.sin(theta);
        let z = r * Math.cos(phi);

        // 3. POZİSYON SAPMASI (Jitter)
        // Nöronları biraz sağa sola iteleyelim
        x += (Math.random() - 0.5) * 1.5;
        y += (Math.random() - 0.5) * 1.5;
        z += (Math.random() - 0.5) * 1.5;

        // Katman dönüşünü uygula (Vector3 matematiği)
        const vector = new THREE.Vector3(x, y, z);
        vector.applyEuler(layerRotation); // Bütün katmanı yamuk çevir

        neurons.push({ 
          position: [vector.x, vector.y, vector.z], 
          id: `l${layerIndex}-n${i}` 
        });
      }
      layerData.push(neurons);
    });
    
    return layerData;
  }, [architecture]);

  return (
    <group ref={groupRef}>
      {/* Nöronları Çiz */}
      {layers.map((layer) => 
        layer.map((neuron) => (
          <Neuron 
            key={neuron.id} 
            position={neuron.position} 
            // Şimdilik nöronları rastgele parlatalım (sonra burayı da bağlarız)
            isActive={Math.random() > 0.8} 
          />
        ))
      )}

      {/* Bağlantıları Çiz - KRİTİK KISIM BURASI */}
      {layers.map((layer, layerIndex) => {
        if (layerIndex === layers.length - 1) return null;
        
        const nextLayer = layers[layerIndex + 1];
        
        // TensorFlow'dan gelen ağırlıkları alalım
        // weights[layerIndex] -> O katmanın ağırlık matrisi (2D Array)
        const layerWeights = weights && weights[layerIndex];

        return layer.map((sourceNeuron, sourceIndex) => 
          nextLayer.map((targetNeuron, targetIndex) => {
            
            // Eğer ağırlık verisi geldiyse onu kullan, yoksa 0 olsun
            let w = 0;
            if (layerWeights && layerWeights[sourceIndex] && layerWeights[sourceIndex][targetIndex] !== undefined) {
              w = layerWeights[sourceIndex][targetIndex];
            }

            return (
              <Connection 
                key={`${sourceNeuron.id}-${targetNeuron.id}`}
                start={sourceNeuron.position}
                end={targetNeuron.position}
                weight={w} // ARTIK GERÇEK DEĞER!
              />
            );
          })
        );
      })}
    </group>
  );
};

export default NeuralNetwork;