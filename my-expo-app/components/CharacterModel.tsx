import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { OrbitControls, useGLTF } from '@react-three/drei/native';
import * as THREE from 'three';

// Suppress Expo GL pixelStorei warning (known limitation in Expo GL)
const originalLog = console.log;
const originalWarn = console.warn;

console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('EXGL') && args[0].includes('pixelStorei')) {
    return; // Suppress this specific log
  }
  originalLog(...args);
};

console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('EXGL') && args[0].includes('pixelStorei')) {
    return; // Suppress this specific warning
  }
  originalWarn(...args);
};

const Model = ({ onSelectBodyPart }) => {
  const { scene } = useGLTF(require('../assets/character.glb'));
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // Remove ALL texture types to avoid pixelStorei issues in Expo GL
        const texturesToRemove = [
          'map', 'normalMap', 'roughnessMap', 'metalnessMap', 
          'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap',
          'alphaMap', 'lightMap', 'envMap'
        ];
        
        texturesToRemove.forEach(texType => {
          if (child.material[texType]) {
            child.material[texType].dispose();
            child.material[texType] = null;
          }
        });
        
        // Ensure material updates
        child.material.needsUpdate = true;
      }
    });
  }, [scene]);

  const handleClick = (event) => {
    const { intersections } = event;
    if (intersections.length > 0) {
      const selectedObject = intersections[0].object;
      let parent = selectedObject;
      while (parent) {
        if (parent.name) {
          onSelectBodyPart(parent.name);
          return;
        }
        parent = parent.parent;
      }
    }
  };

  return <primitive object={scene} onClick={handleClick} scale={1.5} />;
};

const CharacterModel = ({ onSelectBodyPart }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      gl={{ 
        antialias: false, 
        powerPreference: 'high-performance',
        alpha: true
      }}
      style={{ touchAction: 'none' }}
    >
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <pointLight position={[-10, -10, -10]} />
      <Model onSelectBodyPart={onSelectBodyPart} />
      <OrbitControls 
        enablePan={false} 
        enableZoom={false} 
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={1.2}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.5}
        makeDefault
      />
    </Canvas>
  );
};

export default CharacterModel;
