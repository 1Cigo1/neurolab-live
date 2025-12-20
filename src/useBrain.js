import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

export const useBrain = (architecture) => {
  const [weights, setWeights] = useState([]); 
  const [loss, setLoss] = useState(null); 
  const [isTraining, setIsTraining] = useState(false);
  const [predictions, setPredictions] = useState([]); 

  const modelRef = useRef(null);

  useEffect(() => {
    // Eski modeli temizle (Memory Leak önlemi)
    if(modelRef.current) modelRef.current.dispose();

    const model = tf.sequential();
    
    architecture.forEach((neuronCount, index) => {
      // Giriş katmanını (0. index) atlıyoruz, o sadece veri tutucudur
      if (index === 0) return; 
      
      const prevNeurons = architecture[index - 1];

      model.add(tf.layers.dense({
        units: neuronCount,
        inputShape: index === 1 ? [prevNeurons] : undefined,
        
        // --- KRİTİK DEĞİŞİKLİK BURADA ---
        // Çıkış katmanı (Sonuncusu) her zaman 'sigmoid' (0 ile 1 arası sonuç için) olmalı.
        // Ama ara katmanları 'relu' yerine 'tanh' yaptık. 
        // 'tanh' bu tarz küçük ağlarda nöronların ölmesini engeller ve 0.5 sorununu çözer.
        activation: index === architecture.length - 1 ? 'sigmoid' : 'tanh',
        
        useBias: true,
        
        // 'tanh' için en iyi başlangıç ağırlığı 'glorotNormal'dir.
        // Bu, ağırlıkların baştan dengeli dağılmasını sağlar.
        kernelInitializer: 'glorotNormal' 
      }));
    });

    // Optimizer'ı biraz daha agresif yaptım (0.03 -> 0.1)
    // Bu sayede takılmadan hızlıca öğrenir.
    model.compile({ 
        optimizer: tf.train.adam(0.05), 
        loss: 'meanSquaredError' 
    });
    
    modelRef.current = model;
    
    extractData(model);
    runPrediction(model);

  }, [architecture]);

  const extractData = async (model) => {
    const newWeights = [];
    for (let i = 0; i < model.layers.length; i++) {
      const layer = model.layers[i];
      const wTensor = layer.getWeights()[0]; 
      if(wTensor) {
        const wData = await wTensor.array(); 
        newWeights.push(wData);
      }
    }
    setWeights(newWeights);
  };

  const runPrediction = async (model) => {
    const xs = tf.tensor2d([[0,0], [0,1], [1,0], [1,1]]);
    const predsTensor = model.predict(xs);
    const predsData = await predsTensor.data(); 
    setPredictions(Array.from(predsData));
    xs.dispose(); predsTensor.dispose();
  };

  const train = async (learningRate, selectedTargets, onLog) => {
    if(!modelRef.current) return;
    setIsTraining(true);

    if(onLog) onLog(`⚡ SİSTEM BAŞLATILIYOR... LR: ${learningRate}`);

    const xs = tf.tensor2d([[0,0], [0,1], [1,0], [1,1]]);
    const ys = tf.tensor2d(selectedTargets.map(t => [t])); 

    // Kullanıcının seçtiği hızı uygula
    modelRef.current.compile({ 
      optimizer: tf.train.adam(parseFloat(learningRate)), 
      loss: 'meanSquaredError' 
    });

    // Döngüyü artırdım ki daha kararlı öğrensin
    const totalEpochs = 60;

    for (let i = 0; i < totalEpochs; i++) { 
      // shuffle: true -> Verileri karıştırarak ezberi bozar
      const h = await modelRef.current.fit(xs, ys, { epochs: 1, shuffle: true });
      const currentLoss = h.history.loss[0].toFixed(5);
      
      setLoss(currentLoss);
      
      if (i % 5 === 0) { 
        await extractData(modelRef.current);
        await runPrediction(modelRef.current);
        
        let message = `Epoch ${i}/${totalEpochs} >> Hata: ${currentLoss}`;
        if (i === 0) message = `🚀 İLK TUR: Ağırlıklar dengeleniyor...`;
        else if (currentLoss > 0.24 && currentLoss < 0.26) message = `⚠️ DİKKAT: Kararsız Bölge (0.50)`;
        else if (currentLoss < 0.1) message = `✅ BAŞARILI: Çözüme yaklaşıldı.`;
        
        if(onLog) onLog(message);
        await new Promise(r => setTimeout(r, 10)); 
      }
    }
    
    if(onLog) onLog(`🏁 EĞİTİM BİTTİ. Son Hata: ${loss}`);
    
    await extractData(modelRef.current);
    await runPrediction(modelRef.current);

    setIsTraining(false);
    xs.dispose(); ys.dispose(); 
  };

  return { weights, loss, isTraining, predictions, train };
};