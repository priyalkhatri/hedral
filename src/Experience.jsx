import React, { useState, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function Experience() {
  const [uploadedModel, setUploadedModel] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(0.02);
  const [meshRotation, setMeshRotation] = useState({ y: 0 });
  const [selectedMeshes, setSelectedMeshes] = useState([]);
  const [materialColor, setMaterialColor] = useState("#ffffff");
  const [animationStartedMap, setAnimationStartedMap] = useState(new Map());

  const modelRef = useRef();

  const { camera } = useThree();

  useEffect(() => {
    if (isAnimating) {
      let newMap = new Map(animationStartedMap);
      selectedMeshes.forEach((mesh) => newMap.set(mesh.uuid, true));
      setAnimationStartedMap(newMap);
    }
  }, [isAnimating, selectedMeshes, animationStartedMap]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedModel(url);
  };

  useEffect(() => {
    if (uploadedModel && modelRef.current) {
      // After the model is loaded, adjust its position
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      camera.position.set(
        center.x - 1,
        center.y + size.y * -Math.PI * 0.5,
        center.z + size.z
      );

      modelRef.current.rotation.set(0, 0, 0);
      camera.lookAt(center);
      modelRef.current.position.set(-center.x, -center.y, -center.z);

      camera.updateProjectionMatrix();
    }
  }, [uploadedModel, modelRef]);

  useEffect(() => {
    const toggleAnimation = (event) => {
      if (event.code === "Space") {
        setIsAnimating(!isAnimating);
        setShowControls(!showControls);
        // Toggle controls visibility with the space bar
      }
    };

    window.addEventListener("keydown", toggleAnimation);
    setShowControls(true);

    return () => {
      window.removeEventListener("keydown", toggleAnimation);
      setShowControls(true);
    };
  }, [isAnimating, showControls]);

  const Model = () => {
    const { scene } = useGLTF(uploadedModel);
    const outlineRefs = useRef(new Map());

    const handleClick = (node) => {
      const index = selectedMeshes.indexOf(node);
      if (index !== -1) {
        setSelectedMeshes(selectedMeshes.filter((mesh) => mesh !== node));
        node.material.color.setHex(0xffffff); // Reset color if deselected
      } else {
        setSelectedMeshes([...selectedMeshes, node]);
        node.material.color.setHex(parseInt(materialColor.slice(1), 16)); // Set to selected color
      }
    };

    useEffect(() => {
      // Apply color to all newly selected meshes
      selectedMeshes.forEach((mesh) => {
        mesh.material.color.setHex(parseInt(materialColor.slice(1), 16));
      });
    }, [selectedMeshes, materialColor]);

    const traverseChildren = (node, elements) => {
      if (node.isMesh) {
        const isSelected = selectedMeshes.includes(node);
        const hasAnimationStarted = animationStartedMap.get(node.uuid);
        const outlineMesh = (
          <mesh
            ref={(el) => {
              if (el) outlineRefs.current.set(node.uuid, el);
              else outlineRefs.current.delete(node.uuid);
            }}
            geometry={node.geometry}
            scale={[1.05, 1.05, 1.05]}
            material={
              new THREE.MeshBasicMaterial({
                color: 0x87008c,
                depthWrite: false,
                side: THREE.BackSide,
                visible: isSelected && !hasAnimationStarted,
              })
            }
          />
        );

        elements.push(
          <group key={node.uuid}>
            <mesh
              geometry={node.geometry}
              material={node.material.clone()}
              position={node.position.toArray()}
              quaternion={node.quaternion.toArray()}
              onClick={() => handleClick(node)}
            />
            {outlineMesh}
          </group>
        );
      }
      node.children.forEach((child) => traverseChildren(child, elements));
    };

    useFrame(() => {
      selectedMeshes.forEach((mesh) => {
        if (isAnimating) {
          mesh.rotation.z += rotationSpeed;
          mesh.updateMatrix();
          setMeshRotation({ ...meshRotation });
        }
      });
    });

    let elements = [];
    traverseChildren(scene, elements);
    return (
      <group ref={modelRef} scale={0.1}>
        {elements}
      </group>
    );
  };

  const RobotModel = () => {
    const { scene, animations } = useGLTF("robot_playground.glb");
    const groupRef = useRef(); // Create a ref for the group

    // Initialize and control animations
    const { ref, actions } = useAnimations(animations, groupRef);

    useEffect(() => {
      // Calculate the bounding box and center the model
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x += scene.position.x - center.x;
      scene.position.y += scene.position.y - center.y / 2;
      scene.position.z += scene.position.z - center.z;

      // Play all animations when the component mounts
      Object.values(actions).forEach((action) => {
        if (action && typeof action.play === "function") {
          action.play();
        }
      });

      return () => {
        // Stop all animations when the component unmounts
        Object.values(actions).forEach((action) => {
          if (action && typeof action.stop === "function") {
            action.stop();
          }
        });
      };
    }, [actions, scene]); // Include actions and scene in the dependency array

    // Use the ref for the primitive to tie the animations to the actual mesh
    return <primitive scale={2} ref={groupRef} object={scene} />;
  };

  return (
    <>
      {!uploadedModel && (
        <>
          <RobotModel />
          <OrbitControls makeDefault />
          <directionalLight
            position={[1, 2, 3]}
            intensity={4.5}
            castShadow
            shadow-normalBias={0.04}
          />
          <ambientLight intensity={1.5} />
          <Html className="upload-screen" center>
            <p className="main-title">Space to visualize your models</p>
            <div className="upload-button">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".gltf,.glb"
                id="model"
              />
              <label for="model">Launch Your Model</label>
            </div>
          </Html>
        </>
      )}
      {uploadedModel && (
        <>
          <OrbitControls makeDefault />
          <directionalLight
            position={[1, 2, 3]}
            intensity={4.5}
            castShadow
            shadow-normalBias={0.04}
          />
          <ambientLight intensity={1.5} />

          <Model />
        </>
      )}
      {uploadedModel && showControls && (
        <Html center position={[0, 300, 0]}>
          <div className="controls">
            <div className="controls-btns">
              <button onClick={() => setIsAnimating(true)}>
                Start Animation
              </button>
              <button onClick={() => setIsAnimating(false)}>
                Stop Animation
              </button>
            </div>
            <label className="speed-control">
              Rotation Speed:
              <input
                type="range"
                min="0.01"
                max="0.1"
                step="0.01"
                value={rotationSpeed}
                onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
              />
              {rotationSpeed.toFixed(2)}
            </label>
            <label className="material-control">
              Material Color:
              <input
                type="color"
                value={materialColor}
                onChange={(e) => setMaterialColor(e.target.value)}
              />
            </label>
          </div>
        </Html>
      )}
    </>
  );
}
