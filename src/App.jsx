import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Info, RotateCcw, Layers, Box, MoveRight, Sliders, Calculator, GraduationCap, CheckCircle, XCircle, ArrowRight, PenTool, Eye } from 'lucide-react';

// --- Crystal System Definitions ---
const CRYSTAL_SYSTEMS = {
  'Simple Cubic': { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90, type: 'SC' },
  'Tetragonal': { a: 1, b: 1, c: 1.5, alpha: 90, beta: 90, gamma: 90, type: 'Primitive' },
  'Orthorhombic': { a: 0.8, b: 1, c: 1.5, alpha: 90, beta: 90, gamma: 90, type: 'Primitive' },
  'Rhombohedral': { a: 1, b: 1, c: 1, alpha: 75, beta: 75, gamma: 75, type: 'Primitive' },
  'Hexagonal': { a: 1, b: 1, c: 1.633, alpha: 90, beta: 90, gamma: 120, type: 'Primitive' },
  'Hexagonal (4-Index)': { a: 1, b: 1, c: 1.633, alpha: 90, beta: 90, gamma: 120, type: 'Primitive' },
  'Monoclinic': { a: 1, b: 1.2, c: 0.8, alpha: 90, beta: 105, gamma: 90, type: 'Primitive' },
  'Triclinic': { a: 1, b: 1.2, c: 1.4, alpha: 75, beta: 60, gamma: 80, type: 'Primitive' }
};

// --- Math Helpers ---

const degToRad = (deg) => deg * (Math.PI / 180);

const gcd = (a, b) => b ? gcd(b, a % b) : a;

const getLCM = (arr) => {
    const absVals = arr.map(Math.abs).filter(v => v > 0);
    if (absVals.length === 0) return 1;
    const _gcd = (a, b) => b ? _gcd(b, a % b) : a;
    const lcm = (a, b) => (a * b) / _gcd(a, b);
    return absVals.reduce(lcm);
};

const toFraction = (decimal) => {
  if (!isFinite(decimal)) return "∞";
  if (Math.abs(decimal) < 1e-6) return "0"; 
  
  let isNeg = decimal < 0;
  decimal = Math.abs(decimal);
  
  const tolerance = 1.0E-6;
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = decimal;
  do {
      let a = Math.floor(b);
      let aux = h1; h1 = a * h1 + h2; h2 = aux;
      aux = k1; k1 = a * k1 + k2; k2 = aux;
      if (b - a < 1e-10) break; 
      b = 1 / (b - a);
  } while (Math.abs(decimal - h1 / k1) > decimal * tolerance);
  
  if (isNeg) h1 = -h1;
  
  if (k1 === 1) return `${h1}`;
  if (k1 === -1) return `${-h1}`;
  return `${h1}/${k1}`;
};

const Overbar = ({ val }) => {
  const num = parseInt(val);
  if (isNaN(num)) return null;
  if (num < 0) return <span className="inline-block relative"><span className="absolute top-0 left-0 w-full border-t border-current h-0 mt-0.5"></span>{Math.abs(num)}</span>;
  return <span>{num}</span>;
};

const formatIntercept = (index, shift = 0) => {
  if (index === 0) return "∞";
  let num = 1 + shift * index;
  let den = index;
  if (num === 0) return "0";
  let g = gcd(Math.abs(num), Math.abs(den));
  num /= g; den /= g;
  if (den < 0) { num = -num; den = -den; }
  if (den === 1) return `${num}`;
  return `${num}/${den}`;
};

const getParamLabel = (key) => {
  if (key === 'alpha') return 'α';
  if (key === 'beta') return 'β';
  if (key === 'gamma') return 'γ';
  return key;
};

// --- 3D Text Helper ---
const createTextSprite = (message, color = '#ffffff') => {
  const fontFace = 'Arial';
  const fontSize = 70;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  context.font = `Bold ${fontSize}px ${fontFace}`;
  const metrics = context.measureText(message);
  canvas.width = metrics.width + 20;
  canvas.height = fontSize + 20;
  
  context.font = `Bold ${fontSize}px ${fontFace}`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width * 0.0025, canvas.height * 0.0025, 1);
  return sprite;
};

const calculateBasisVectors = (a, b, c, alpha, beta, gamma) => {
  const ar = degToRad(alpha), br = degToRad(beta), gr = degToRad(gamma);
  const v_a0 = new THREE.Vector3(a, 0, 0);
  const v_b0 = new THREE.Vector3(b * Math.cos(gr), b * Math.sin(gr), 0);
  const cx = c * Math.cos(br);
  const cy = (c * Math.cos(ar) - cx * Math.cos(gr)) / Math.sin(gr);
  const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy));
  const v_c0 = new THREE.Vector3(cx, cy, cz);
  const transform = (v) => new THREE.Vector3(v.x, v.z, -v.y);
  let va = transform(v_a0), vb = transform(v_b0), vc = transform(v_c0);
  const euler = new THREE.Euler(0, -120 * (Math.PI / 180), 0, 'XYZ');
  va.applyEuler(euler); vb.applyEuler(euler); vc.applyEuler(euler);
  return { va, vb, vc };
};

const toCartesian = (fractional, basis) => {
  const v = new THREE.Vector3();
  v.addScaledVector(basis.va, fractional.x);
  v.addScaledVector(basis.vb, fractional.y);
  v.addScaledVector(basis.vc, fractional.z);
  return v;
};

// --- Plane Logic ---
const getPlaneConstant = (h, k, l, isHexagonal) => {
  if (isHexagonal) return (l < 0) ? 1 + l : 1;
  let w = 1;
  if (h < 0) w += h; if (k < 0) w += k; if (l < 0) w += l;
  return w;
};

const getFractionalIntersections = (h, k, l, isHexagonal) => {
  if (h === 0 && k === 0 && l === 0) return [];
  const points = [];
  const eps = 1e-5;
  const W = getPlaneConstant(h, k, l, isHexagonal);

  const addPoint = (x, y, z) => {
    let inside = false;
    if (isHexagonal) {
        if (z >= -eps && z <= 1 + eps) inside = true;
    } else {
        if (x >= -eps && x <= 1 + eps && y >= -eps && y <= 1 + eps && z >= -eps && z <= 1 + eps) inside = true;
    }
    if (inside && !points.some(p => Math.abs(p.x - x) < eps && Math.abs(p.y - y) < eps && Math.abs(p.z - z) < eps)) {
      points.push(new THREE.Vector3(x, y, z));
    }
  };

  if (isHexagonal) {
      const hexBase = [
          new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1),
          new THREE.Vector2(-1, 0), new THREE.Vector2(-1, -1), new THREE.Vector2(0, -1)
      ];
      if (l !== 0) { hexBase.forEach(v => { addPoint(v.x, v.y, (W - h*v.x - k*v.y) / l); }); }
      [0, 1].forEach(zPlane => {
          for(let i=0; i<6; i++) {
              const v1 = hexBase[i], v2 = hexBase[(i+1)%6];
              const denom = h*(v2.x - v1.x) + k*(v2.y - v1.y);
              if (Math.abs(denom) > eps) {
                  const t = (W - l*zPlane - h*v1.x - k*v1.y) / denom;
                  if (t >= -eps && t <= 1 + eps) addPoint(v1.x + t*(v2.x - v1.x), v1.y + t*(v2.y - v1.y), zPlane);
              }
          }
      });
  } else {
      if (h !== 0) { addPoint((W - k*0 - l*0)/h, 0, 0); addPoint((W - k*1 - l*0)/h, 1, 0); addPoint((W - k*0 - l*1)/h, 0, 1); addPoint((W - k*1 - l*1)/h, 1, 1); }
      if (k !== 0) { addPoint(0, (W - h*0 - l*0)/k, 0); addPoint(1, (W - h*1 - l*0)/k, 0); addPoint(0, (W - h*0 - l*1)/k, 1); addPoint(1, (W - h*1 - l*1)/k, 1); }
      if (l !== 0) { addPoint(0, 0, (W - h*0 - k*0)/l); addPoint(1, 0, (W - h*1 - k*0)/l); addPoint(0, 1, (W - h*0 - k*1)/l); addPoint(1, 1, (W - h*1 - k*1)/l); }
  }
  return points;
};

const getLatticePointsFractional = (type, isHexagonal) => {
  const points = [];
  if (isHexagonal) {
      const hexBase = [
          new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1),
          new THREE.Vector2(-1, 0), new THREE.Vector2(-1, -1), new THREE.Vector2(0, -1),
          new THREE.Vector2(0, 0)
      ];
      hexBase.forEach(v => { points.push(new THREE.Vector3(v.x, v.y, 0)); points.push(new THREE.Vector3(v.x, v.y, 1)); });
  } else {
      for (let x = 0; x <= 1; x++) for (let y = 0; y <= 1; y++) for (let z = 0; z <= 1; z++) points.push(new THREE.Vector3(x, y, z));
  }
  return points;
};

const clipVector = (start, dir, isHexagonal) => {
    let tExit = Infinity;
    const check = (p, d, min, max) => {
        if (d > 0) { const t = (max - p) / d; if (t > 0.0001) tExit = Math.min(tExit, t); } 
        else if (d < 0) { const t = (min - p) / d; if (t > 0.0001) tExit = Math.min(tExit, t); }
    };
    if (isHexagonal) {
        check(start.z, dir.z, 0, 1);
        check(start.x, dir.x, -1, 1);
        check(start.y, dir.y, -1, 1);
        check(start.y - start.x, dir.y - dir.x, -1, 1);
    } else {
        check(start.x, dir.x, 0, 1); check(start.y, dir.y, 0, 1); check(start.z, dir.z, 0, 1);
    }
    return tExit === Infinity ? null : tExit;
};

const getSystemConstraints = (systemName) => {
  const sys = systemName.replace(' (4-Index)', '');
  switch(sys) {
    case 'Simple Cubic': return { lengths: 'a = b = c', angles: 'α = β = γ = 90°' };
    case 'Tetragonal': return { lengths: 'a = b ≠ c', angles: 'α = β = γ = 90°' };
    case 'Orthorhombic': return { lengths: 'a ≠ b ≠ c', angles: 'α = β = γ = 90°' };
    case 'Rhombohedral': return { lengths: 'a = b = c', angles: 'α = β = γ ≠ 90°' };
    case 'Hexagonal': return { lengths: 'a = b ≠ c', angles: 'α = β = 90°, γ = 120°' };
    case 'Monoclinic': return { lengths: 'a ≠ b ≠ c', angles: 'α = γ = 90° ≠ β' };
    case 'Triclinic': return { lengths: 'a ≠ b ≠ c', angles: 'α ≠ β ≠ γ ≠ 90°' };
    default: return { lengths: '', angles: '' };
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('visualizer');
  const [quizTab, setQuizTab] = useState('identify'); 

  // Visualizer State
  const [mode, setMode] = useState('plane');
  const [indices, setIndices] = useState({ h: 1, k: 1, l: 1 });
  const [direction, setDirection] = useState({ u: 1, v: 1, w: 1 });
  const [opacity, setOpacity] = useState(0.6);
  const [showVertices, setShowVertices] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState('Simple Cubic');
  const [latticeParams, setLatticeParams] = useState(CRYSTAL_SYSTEMS['Simple Cubic']);
  
  // Quiz State
  const [quizState, setQuizState] = useState({
    system: 'Simple Cubic',
    target: { h: 1, k: 1, l: 1 }, 
    userInput: { v1: '', v2: '', v3: '', v4: '' }, 
    feedback: null,
    message: ''
  });

  // Custom Draw Quiz State: Freely selected Fractional Coordinates
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [partitions, setPartitions] = useState({ h: 1, k: 1, l: 1, i: 1 });
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const groupsRef = useRef({});
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);

  const appStateRef = useRef({ activeTab, quizTab, isFourIndex: false });
  const isQuiz = activeTab === 'quiz';
  const currentSystemName = isQuiz ? quizState.system : selectedSystem;
  const isFourIndex = currentSystemName === 'Hexagonal (4-Index)';
  const currentParams = isQuiz ? CRYSTAL_SYSTEMS[currentSystemName] : latticeParams;
  const currentMode = isQuiz ? 'plane' : mode;

  const constraints = getSystemConstraints(selectedSystem);
  const sysShort = selectedSystem.replace(' (4-Index)', '');

  useEffect(() => {
    appStateRef.current = { activeTab, quizTab, isFourIndex };
  }, [activeTab, quizTab, isFourIndex]);

  // --- Quiz Generator ---
  const generateQuiz = (overrideTab = null) => {
    const systems = Object.keys(CRYSTAL_SYSTEMS);
    const randSystem = systems[Math.floor(Math.random() * systems.length)];
    const isHex = randSystem === 'Hexagonal (4-Index)';
    
    let h, k, l, iVal;
    do {
      h = Math.floor(Math.random() * 7) - 3;
      k = Math.floor(Math.random() * 7) - 3;
      l = Math.floor(Math.random() * 7) - 3;
      iVal = -(h + k);
      // Removed the logic that avoids 0s, freely allow them to test student's parallel placement
    } while ((h === 0 && k === 0 && l === 0) || getLCM(isHex ? [h, k, iVal, l] : [h, k, l]) > 6);

    setQuizState(prev => ({
      system: randSystem,
      target: { h, k, l },
      userInput: { v1: '', v2: '', v3: '', v4: '' },
      feedback: null,
      message: ''
    }));
    
    setSelectedPoints([]);
    setPartitions({ h: 1, k: 1, l: 1, i: 1 });
    setIsShowingAnswer(false);
  };

  useEffect(() => {
    if (isQuiz && !quizState.feedback) generateQuiz();
  }, [activeTab]);

  const checkIdentifyAnswer = () => {
    const { target, userInput, system } = quizState;
    const isHex4 = system === 'Hexagonal (4-Index)';
    const u1 = parseInt(userInput.v1), u2 = parseInt(userInput.v2), u3 = parseInt(userInput.v3), u4 = parseInt(userInput.v4); 
    
    if (isNaN(u1) || isNaN(u2) || isNaN(u3) || (isHex4 && isNaN(u4))) {
      setQuizState(prev => ({ ...prev, feedback: 'invalid', message: 'Please enter valid integers.' }));
      return;
    }

    let correct = false;
    let ansStr = "";

    if (isHex4) {
      const correctI = -(target.h + target.k);
      if ((u1 === target.h && u2 === target.k && u3 === correctI && u4 === target.l) || (u1 === -target.h && u2 === -target.k && u3 === -correctI && u4 === -target.l)) correct = true;
      ansStr = `(${target.h} ${target.k} ${correctI} ${target.l})`;
    } else {
      if ((u1 === target.h && u2 === target.k && u3 === target.l) || (u1 === -target.h && u2 === -target.k && u3 === -target.l)) correct = true;
      ansStr = `(${target.h} ${target.k} ${target.l})`;
    }

    if (correct) {
      setQuizState(prev => ({ ...prev, feedback: 'correct', message: 'Correct! Well done.' }));
      setTimeout(() => { setQuizState(p => ({...p, feedback: null, message: ''})); generateQuiz(); }, 1500);
    } else {
      setQuizState(prev => ({ ...prev, feedback: 'incorrect', message: `Incorrect. Correct answer: ${ansStr}. Loading next...` }));
      setTimeout(() => { setQuizState(p => ({...p, feedback: null, message: ''})); generateQuiz(); }, 3000);
    }
  };

  const checkDrawAnswer = () => {
    const { target } = quizState;
    
    if (selectedPoints.length < 3) {
        setQuizState(p => ({...p, feedback: 'invalid', message: 'Please select at least 3 points to define a plane.'}));
        return;
    }

    // Step 1: Extract 3 non-collinear points to find the Fractional Normal of the custom plane
    let p0 = selectedPoints[0], p1, p2;
    let normalFrac = new THREE.Vector3();
    
    for (let i = 1; i < selectedPoints.length; i++) {
        for (let j = i + 1; j < selectedPoints.length; j++) {
            const v1 = new THREE.Vector3().subVectors(selectedPoints[i], p0);
            const v2 = new THREE.Vector3().subVectors(selectedPoints[j], p0);
            normalFrac.crossVectors(v1, v2);
            if (normalFrac.lengthSq() > 1e-6) {
                p1 = selectedPoints[i];
                p2 = selectedPoints[j];
                break;
            }
        }
        if (p1) break;
    }

    if (!p1) {
        setQuizState(p => ({...p, feedback: 'invalid', message: 'Points are collinear. Choose non-collinear points.'}));
        return;
    }

    // Step 2: Verify all selected points actually lie on this plane (coplanar check)
    let coplanar = true;
    for (let p of selectedPoints) {
        const v = new THREE.Vector3().subVectors(p, p0);
        if (Math.abs(v.dot(normalFrac)) > 1e-4) {
            coplanar = false;
            break;
        }
    }

    if (!coplanar) {
        setQuizState(p => ({...p, feedback: 'incorrect', message: 'Your selected points are not on a single flat plane!'}));
        return;
    }

    // Step 3: Check if the fractional normal is perfectly parallel to the Target Miller Indices
    const targetVec = new THREE.Vector3(target.h, target.k, target.l);
    const cross = new THREE.Vector3().crossVectors(normalFrac, targetVec);
    
    if (cross.lengthSq() < 1e-4) {
        setQuizState(p => ({...p, feedback: 'correct', message: 'Excellent! Your points form a perfect parallel plane.'}));
        setTimeout(() => { setQuizState(p => ({...p, feedback: null, message: ''})); generateQuiz(); }, 2500);
    } else {
        setQuizState(p => ({...p, feedback: 'incorrect', message: 'Incorrect plane angle. Keep trying!'}));
        setTimeout(() => { setQuizState(p => ({...p, feedback: null, message: ''})); }, 3000);
    }
  };

  const showDrawAnswer = () => {
    setIsShowingAnswer(true);
    setQuizState(p => ({...p, feedback: 'correct', message: 'Here is the mathematically exact plane.'}));
  };

  // --- Handlers (Visualizer) ---
  useEffect(() => {
    if (!isQuiz && CRYSTAL_SYSTEMS[selectedSystem]) setLatticeParams({ ...CRYSTAL_SYSTEMS[selectedSystem] });
  }, [selectedSystem, isQuiz]);

  const reset = () => {
    setIndices({ h: 1, k: 1, l: 1 });
    setDirection({ u: 1, v: 1, w: 1 });
    setAutoRotate(false);
    setSelectedSystem('Simple Cubic');
    setLatticeParams(CRYSTAL_SYSTEMS['Simple Cubic']);
  };

  const handleParamChange = (key, value) => {
    if (isQuiz) return;
    const val = parseFloat(value);
    
    setLatticeParams(prev => {
      const next = { ...prev, [key]: val };
      const sys = selectedSystem.replace(' (4-Index)', ''); 
      if (['Simple Cubic', 'Rhombohedral'].includes(sys)) { if (key === 'a') { next.b = val; next.c = val; } } 
      else if (['Tetragonal', 'Hexagonal'].includes(sys)) { if (key === 'a') { next.b = val; } }
      if (sys === 'Rhombohedral') { if (key === 'alpha') { next.beta = val; next.gamma = val; } }

      const EPSILON = 0.05, ANGLE_EPSILON = 1.0; 
      let isInvalid = false;

      if (['Tetragonal', 'Hexagonal'].includes(sys)) { if (Math.abs(next.a - next.c) < EPSILON) isInvalid = true; }
      else if (['Orthorhombic', 'Monoclinic', 'Triclinic'].includes(sys)) { if (Math.abs(next.a - next.b) < EPSILON || Math.abs(next.b - next.c) < EPSILON || Math.abs(next.a - next.c) < EPSILON) isInvalid = true; }

      if (sys === 'Rhombohedral') { if (Math.abs(next.alpha - 90) < ANGLE_EPSILON) isInvalid = true; }
      else if (sys === 'Monoclinic') { if (Math.abs(next.beta - 90) < ANGLE_EPSILON) isInvalid = true; }
      else if (sys === 'Triclinic') {
         if (Math.abs(next.alpha - 90) < ANGLE_EPSILON || Math.abs(next.beta - 90) < ANGLE_EPSILON || Math.abs(next.gamma - 90) < ANGLE_EPSILON) isInvalid = true;
         if (Math.abs(next.alpha - next.beta) < ANGLE_EPSILON || Math.abs(next.beta - next.gamma) < ANGLE_EPSILON || Math.abs(next.alpha - next.gamma) < ANGLE_EPSILON) isInvalid = true;
      }
      return isInvalid ? prev : next;
    });
  };

  const handleIndexChange = (type, axis, val) => {
    const num = parseInt(val);
    if (!isNaN(num)) {
      if (type === 'plane') setIndices(prev => ({ ...prev, [axis]: num }));
      else setDirection(prev => ({ ...prev, [axis]: num }));
    }
  };

  // --- Three.js Scene Setup ---
  useEffect(() => {
    if (!mountRef.current) return;
    while(mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(4, 3, 5); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    const mainGroup = new THREE.Group();
    mainGroup.position.set(0, -0.5, 0); 
    scene.add(mainGroup);

    groupsRef.current = {
      axes: new THREE.Group(),
      cell: new THREE.Group(),
      lattice: new THREE.Group(),
      plane: new THREE.Group(),
      direction: new THREE.Group(),
      labels: new THREE.Group(),
      ticks: new THREE.Group() 
    };
    Object.values(groupsRef.current).forEach(g => mainGroup.add(g));

    // Raycaster for placing exact interactive points
    const handleCanvasClick = (event) => {
        const { activeTab, quizTab } = appStateRef.current;
        if (activeTab !== 'quiz' || quizTab !== 'draw') return;
        
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(groupsRef.current.ticks.children);
        const hitIntersect = intersects.find(i => i.object.userData && i.object.userData.isTick);
        
        if (hitIntersect) {
           const hitPos = hitIntersect.object.userData.fracPos;
           setSelectedPoints(prev => {
               // Toggle logic: If point is already picked, unpick it. Otherwise add it.
               const exists = prev.find(p => p.distanceTo(hitPos) < 0.001);
               if (exists) return prev.filter(p => p !== exists);
               return [...prev, hitPos];
           });
        }
    };
    renderer.domElement.addEventListener('pointerdown', handleCanvasClick);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handleCanvasClick);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // --- Update Scene ---
  useEffect(() => {
    if (!sceneRef.current || !currentParams) return;
    
    Object.values(groupsRef.current).forEach(g => {
        while(g.children.length > 0) g.remove(g.children[0]);
    });

    const { a, b, c, alpha, beta, gamma, type } = currentParams;
    const basis = calculateBasisVectors(a, b, c, alpha, beta, gamma);

    // Axes
    const addArrow = (dir, color) => {
      const arrow = new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(0,0,0), dir.length() + 0.5, color);
      groupsRef.current.axes.add(arrow);
    };
    addArrow(basis.va, 0xff5555); 
    addArrow(basis.vb, 0x55ff55); 
    addArrow(basis.vc, 0x5555ff); 
    if (isFourIndex) {
      const va3 = new THREE.Vector3().sub(basis.va).sub(basis.vb);
      addArrow(va3, 0xffff00); 
    }

    // Unit Cell
    if (isFourIndex) {
      const base = [new THREE.Vector3(1,0,0), new THREE.Vector3(1,1,0), new THREE.Vector3(0,1,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(-1,-1,0), new THREE.Vector3(0,-1,0)];
      const bottom = base.map(v => toCartesian(v, basis));
      const top = base.map(v => toCartesian(new THREE.Vector3(v.x, v.y, 1), basis));
      const points = [];
      for(let i=0; i<6; i++) {
          points.push(bottom[i], bottom[(i+1)%6]);
          points.push(top[i], top[(i+1)%6]);
          points.push(bottom[i], top[i]);
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x666666 });
      groupsRef.current.cell.add(new THREE.LineSegments(geometry, material));
    } else {
      const cornersFractional = [new THREE.Vector3(0,0,0), new THREE.Vector3(1,0,0), new THREE.Vector3(1,1,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(1,0,1), new THREE.Vector3(1,1,1), new THREE.Vector3(0,1,1)];
      const cornersCartesian = cornersFractional.map(p => toCartesian(p, basis));
      const edges = [[0,1], [1,2], [2,3], [3,0], [4,5], [5,6], [6,7], [7,4], [0,4], [1,5], [2,6], [3,7]];
      const points = [];
      edges.forEach(pair => { points.push(cornersCartesian[pair[0]]); points.push(cornersCartesian[pair[1]]); });
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x666666 });
      groupsRef.current.cell.add(new THREE.LineSegments(geometry, material));
    }

    // Lattice Atoms
    const fractionalPoints = getLatticePointsFractional(type, isFourIndex);
    const atomGeom = new THREE.SphereGeometry(0.05, 16, 16);
    const atomMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3, metalness: 0.8 });
    const originAtom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x333333 }));
    groupsRef.current.lattice.add(originAtom);
    fractionalPoints.forEach(fp => {
      if (fp.length() > 0.001) { 
        const mesh = new THREE.Mesh(atomGeom, atomMat);
        mesh.position.copy(toCartesian(fp, basis));
        groupsRef.current.lattice.add(mesh);
      }
    });

    let drawH = null, drawK = null, drawL = null;
    let shouldDrawPlane = false;
    let planeColor = 0x3b82f6; 

    if (activeTab === 'visualizer' && mode === 'plane') {
        drawH = indices.h; drawK = indices.k; drawL = indices.l;
        shouldDrawPlane = true;
    } else if (activeTab === 'quiz') {
        if (quizTab === 'identify') {
            drawH = quizState.target.h; drawK = quizState.target.k; drawL = quizState.target.l;
            shouldDrawPlane = true;
        } else if (quizTab === 'draw') {
            if (isShowingAnswer) {
                // Instantly swap to mathematically exact target plane
                drawH = quizState.target.h; drawK = quizState.target.k; drawL = quizState.target.l;
                shouldDrawPlane = true;
                planeColor = 0x10b981; 
            } else {
                // Explicitly Connect the points the user actually clicked!
                const points = selectedPoints.map(p => toCartesian(p, basis));

                // Drop visually mapped spheres perfectly on top of the coordinates they tapped
                if (points.length > 0) {
                    const sphereGeom = new THREE.SphereGeometry(0.06, 16, 16);
                    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x005500 });
                    points.forEach(p => {
                        const s = new THREE.Mesh(sphereGeom, sphereMat);
                        s.position.copy(p);
                        groupsRef.current.plane.add(s);
                    });
                }

                // If enough nodes exist, stitch them physically into a custom plane
                if (points.length >= 3) {
                    let p0 = points[0], p1, p2;
                    let normal = new THREE.Vector3();
                    for (let i = 1; i < points.length; i++) {
                        for (let j = i + 1; j < points.length; j++) {
                            const v1 = new THREE.Vector3().subVectors(points[i], p0);
                            const v2 = new THREE.Vector3().subVectors(points[j], p0);
                            normal.crossVectors(v1, v2);
                            if (normal.lengthSq() > 1e-6) {
                                p1 = points[i]; p2 = points[j];
                                break;
                            }
                        }
                        if (p1) break;
                    }
                    
                    if (p1) {
                        const center = new THREE.Vector3();
                        points.forEach(p => center.add(p));
                        center.divideScalar(points.length);
                        
                        normal.normalize();
                        const ref = new THREE.Vector3().subVectors(points[0], center).normalize();
                        const refPerp = new THREE.Vector3().crossVectors(normal, ref).normalize();

                        points.sort((a, b) => {
                          const vecA = new THREE.Vector3().subVectors(a, center);
                          const vecB = new THREE.Vector3().subVectors(b, center);
                          return Math.atan2(vecA.dot(refPerp), vecA.dot(ref)) - Math.atan2(vecB.dot(refPerp), vecB.dot(ref));
                        });

                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        const triIndices = [];
                        for (let j = 1; j < points.length - 1; j++) triIndices.push(0, j, j + 1);
                        geometry.setIndex(triIndices);
                        geometry.computeVertexNormals();
                        const planeMat = new THREE.MeshStandardMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: opacity, metalness: 0.2, roughness: 0.1 });
                        groupsRef.current.plane.add(new THREE.Mesh(geometry, planeMat));
                        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
                        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
                        groupsRef.current.plane.add(new THREE.LineLoop(lineGeom, lineMat));
                    }
                }
            }
        }
    }

    // Common mathematically-exact plane fallback
    if (shouldDrawPlane) {
      const intersections = getFractionalIntersections(drawH, drawK, drawL, isFourIndex);
      if (intersections.length >= 3) {
        const cartesianPoints = intersections.map(p => toCartesian(p, basis));
        const center = new THREE.Vector3();
        cartesianPoints.forEach(p => center.add(p));
        center.divideScalar(cartesianPoints.length);
        const ref = new THREE.Vector3().subVectors(cartesianPoints[0], center).normalize();
        const normal = new THREE.Vector3().crossVectors(
           new THREE.Vector3().subVectors(cartesianPoints[1], cartesianPoints[0]),
           new THREE.Vector3().subVectors(cartesianPoints[2], cartesianPoints[0])
        ).normalize();
        const refPerp = new THREE.Vector3().crossVectors(normal, ref).normalize();

        cartesianPoints.sort((a, b) => {
          const vecA = new THREE.Vector3().subVectors(a, center);
          const vecB = new THREE.Vector3().subVectors(b, center);
          return Math.atan2(vecA.dot(refPerp), vecA.dot(ref)) - Math.atan2(vecB.dot(refPerp), vecB.dot(ref));
        });

        const geometry = new THREE.BufferGeometry().setFromPoints(cartesianPoints);
        const triIndices = [];
        for (let i = 1; i < cartesianPoints.length - 1; i++) triIndices.push(0, i, i + 1);
        geometry.setIndex(triIndices);
        geometry.computeVertexNormals();
        const planeMat = new THREE.MeshStandardMaterial({ color: planeColor, side: THREE.DoubleSide, transparent: true, opacity: opacity, metalness: 0.2, roughness: 0.1 });
        groupsRef.current.plane.add(new THREE.Mesh(geometry, planeMat));
        const lineGeom = new THREE.BufferGeometry().setFromPoints(cartesianPoints);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        groupsRef.current.plane.add(new THREE.LineLoop(lineGeom, lineMat));

        if (showVertices) {
           const sphereGeom = new THREE.SphereGeometry(0.03, 16, 16);
           const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff });
           cartesianPoints.forEach(p => {
             const s = new THREE.Mesh(sphereGeom, sphereMat);
             s.position.copy(p);
             groupsRef.current.plane.add(s);
           });
        }
      }
    }

    const shouldShowLabels = (activeTab === 'visualizer' && mode === 'plane' && showLabels) || (activeTab === 'quiz' && quizTab === 'identify');

    if (shouldShowLabels) {
        const labelColor = '#fbbf24'; 
        let targetH = activeTab === 'quiz' ? quizState.target.h : indices.h;
        let targetK = activeTab === 'quiz' ? quizState.target.k : indices.k;
        let targetL = activeTab === 'quiz' ? quizState.target.l : indices.l;

        let sx = 0, sy = 0, sz = 0;
        if (isFourIndex) { if (targetL < 0) sz = 1; } 
        else { if (targetH < 0) sx = 1; if (targetK < 0) sy = 1; if (targetL < 0) sz = 1; }
        const shiftedOriginFrac = new THREE.Vector3(sx, sy, sz);
        
        const addLabel = (index, axisFracStep, defaultName, shift) => {
           if (index !== 0) {
              const step = 1.0 / index;
              const absoluteFrac = shiftedOriginFrac.clone().add(axisFracStep.clone().multiplyScalar(step));
              let textStr = `${formatIntercept(index, shift)} ${defaultName}`;

              if (formatIntercept(index, shift) === "0") {
                  const eps = 0.01;
                  if (Math.abs(absoluteFrac.x) < eps && Math.abs(absoluteFrac.y - 1) < eps && Math.abs(absoluteFrac.z) < eps) textStr = isFourIndex ? "1 a₂" : "1 b";
                  else if (Math.abs(absoluteFrac.y) < eps && Math.abs(absoluteFrac.x - 1) < eps && Math.abs(absoluteFrac.z) < eps) textStr = isFourIndex ? "1 a₁" : "1 a";
                  else if (Math.abs(absoluteFrac.x) < eps && Math.abs(absoluteFrac.y) < eps && Math.abs(absoluteFrac.z - 1) < eps) textStr = "1 c";
              }

              if (Math.abs(step) <= 2.5) {
                 const pos = toCartesian(absoluteFrac, basis);
                 pos.add(new THREE.Vector3(0, 0.15, 0)); 
                 const sprite = createTextSprite(textStr, labelColor);
                 sprite.position.copy(pos);
                 groupsRef.current.labels.add(sprite);
              }
           }
        };

        addLabel(targetH, new THREE.Vector3(1, 0, 0), isFourIndex ? 'a₁' : 'a', sx);
        addLabel(targetK, new THREE.Vector3(0, 1, 0), isFourIndex ? 'a₂' : 'b', sy);
        addLabel(targetL, new THREE.Vector3(0, 0, 1), 'c', sz);
        if (isFourIndex) addLabel(-(targetH+targetK), new THREE.Vector3(-1, -1, 0), 'a₃', 0);
    }

    // DRAW MODE FULL CELL TICK GENERATION (Hidden cleanly if answer is actively showing)
    if (activeTab === 'quiz' && quizTab === 'draw' && !isShowingAnswer) {
        const edgesData = [];
        if (isFourIndex) {
            for (let z of [0, 1]) {
                edgesData.push({ name: 'h', start: new THREE.Vector3(-1, 0, z), dir: new THREE.Vector3(2, 0, 0), color: 0xff5555 });
                edgesData.push({ name: 'k', start: new THREE.Vector3(0, -1, z), dir: new THREE.Vector3(0, 2, 0), color: 0x55ff55 });
                edgesData.push({ name: 'i', start: new THREE.Vector3(1, 1, z), dir: new THREE.Vector3(-2, -2, 0), color: 0xffff00 });
            }
            const hexBase = [ new THREE.Vector3(1,0,0), new THREE.Vector3(1,1,0), new THREE.Vector3(0,1,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(-1,-1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,0) ];
            hexBase.forEach(v => { edgesData.push({ name: 'l', start: new THREE.Vector3(v.x, v.y, 0), dir: new THREE.Vector3(0, 0, 1), color: 0x5555ff }); });
        } else {
            [0,1].forEach(y => [0,1].forEach(z => edgesData.push({ name: 'h', start: new THREE.Vector3(0, y, z), dir: new THREE.Vector3(1, 0, 0), color: 0xff5555 })));
            [0,1].forEach(x => [0,1].forEach(z => edgesData.push({ name: 'k', start: new THREE.Vector3(x, 0, z), dir: new THREE.Vector3(0, 1, 0), color: 0x55ff55 })));
            [0,1].forEach(x => [0,1].forEach(y => edgesData.push({ name: 'l', start: new THREE.Vector3(x, y, 0), dir: new THREE.Vector3(0, 0, 1), color: 0x5555ff })));
        }

        const normalTick = new THREE.SphereGeometry(0.06, 16, 16);
        const highlightTick = new THREE.SphereGeometry(0.10, 16, 16);
        const renderedNodes = [];

        edgesData.forEach(edge => {
            const parts = partitions[edge.name] || 1;
            // Radial basal edges on Hex span twice the distance (-1 to 1) so they get double steps
            const steps = (isFourIndex && ['h','k','i'].includes(edge.name)) ? parts * 2 : parts;
            
            const linePoints = [
                toCartesian(edge.start, basis),
                toCartesian(edge.start.clone().add(edge.dir), basis)
            ];
            const lineMat = new THREE.LineBasicMaterial({ color: edge.color, transparent: true, opacity: 0.3 });
            groupsRef.current.ticks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), lineMat));

            for (let s = 0; s <= steps; s++) {
                const absoluteFrac = edge.start.clone().add(edge.dir.clone().multiplyScalar(s / steps));
                
                // Prevent creating duplicate nodes exactly at corners
                const roundedFrac = new THREE.Vector3(
                    Math.round(absoluteFrac.x * 100) / 100,
                    Math.round(absoluteFrac.y * 100) / 100,
                    Math.round(absoluteFrac.z * 100) / 100
                );
                
                if (!renderedNodes.some(n => n.distanceTo(roundedFrac) < 0.001)) {
                    renderedNodes.push(roundedFrac);
                    const cartPos = toCartesian(absoluteFrac, basis);
                    const isSelected = selectedPoints.some(p => p.distanceTo(absoluteFrac) < 0.001);
                    
                    const mat = new THREE.MeshStandardMaterial({ 
                        color: isSelected ? 0x10b981 : edge.color, 
                        emissive: isSelected ? 0x005500 : 0x000000,
                        roughness: 0.2
                    });
                    
                    const mesh = new THREE.Mesh(isSelected ? highlightTick : normalTick, mat);
                    mesh.position.copy(cartPos);
                    mesh.userData = { isTick: true, fracPos: absoluteFrac };
                    groupsRef.current.ticks.add(mesh);
                }
            }
        });
    }

    if (activeTab === 'visualizer' && mode === 'direction') {
      let vecFractional;
      const startPoint = toCartesian(new THREE.Vector3(0,0,0), basis);
      
      const u = direction.u, v = direction.v, w = direction.w;

      if (isFourIndex) { const t = -(u + v); vecFractional = new THREE.Vector3(u - t, v - t, w); } 
      else vecFractional = new THREE.Vector3(u, v, w);
      
      const vector = toCartesian(vecFractional, basis);
      
      let startFractional = new THREE.Vector3(0,0,0);
      if (isFourIndex) { if (w < 0) startFractional.z = 1; } 
      else { if (u < 0) startFractional.x = 1; if (v < 0) startFractional.y = 1; if (w < 0) startFractional.z = 1; }
      const actualStartPoint = toCartesian(startFractional, basis);

      const tExit = clipVector(startFractional, vecFractional, isFourIndex);
      
      if (tExit !== null && tExit > 0) {
        const drawEnd = new THREE.Vector3().copy(actualStartPoint).add(vector.clone().multiplyScalar(tExit));
        const length = actualStartPoint.distanceTo(drawEnd);
        if (length > 0.001) {
             const dirNorm = vector.clone().normalize();
             const arrowHelper = new THREE.ArrowHelper(dirNorm, actualStartPoint, length, 0xff00ff, 0.3, 0.15); 
             groupsRef.current.direction.add(arrowHelper);
             const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xaa00aa }));
             tip.position.copy(drawEnd);
             groupsRef.current.direction.add(tip);
        }
      }
    }

  }, [indices, direction, opacity, showVertices, selectedSystem, mode, latticeParams, activeTab, quizTab, quizState, partitions, selectedPoints, isShowingAnswer, showLabels]);

  useEffect(() => { if (controlsRef.current) controlsRef.current.autoRotate = autoRotate; }, [autoRotate]);

  return (
    <div className="flex flex-col md:flex-row w-full h-screen bg-gray-950 text-gray-200 overflow-hidden font-sans">
      
      <div className="flex-grow h-[60vh] md:h-auto relative bg-gradient-to-br from-gray-900 to-black cursor-crosshair">
        <div ref={mountRef} className="w-full h-full" />
        <div className="absolute top-6 left-6 bg-gray-900/80 backdrop-blur-sm p-6 rounded-xl border border-gray-700 pointer-events-none select-none shadow-lg">
          {isFourIndex ? (
             <>
                <div className="flex items-center gap-4 mb-3"><div className="w-5 h-5 bg-red-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">a₁</span></div>
                <div className="flex items-center gap-4 mb-3"><div className="w-5 h-5 bg-green-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">a₂</span></div>
                <div className="flex items-center gap-4 mb-3"><div className="w-5 h-5 bg-yellow-400 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">a₃</span></div>
                <div className="flex items-center gap-4"><div className="w-5 h-5 bg-blue-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">c</span></div>
             </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3"><div className="w-5 h-5 bg-red-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">a</span></div>
              <div className="flex items-center gap-4 mb-3"><div className="w-5 h-5 bg-green-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">b</span></div>
              <div className="flex items-center gap-4"><div className="w-5 h-5 bg-blue-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">c</span></div>
            </>
          )}
          {currentMode === 'direction' && (
             <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-600">
               <div className="w-5 h-5 bg-fuchsia-500 rounded-full"></div><span className="text-lg text-gray-200 font-mono font-bold">Vector</span>
             </div>
          )}
        </div>

        {activeTab === 'quiz' && quizTab === 'draw' && !isShowingAnswer && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur px-8 py-4 rounded-full border-2 border-gray-700 text-lg font-bold text-emerald-400 pointer-events-none shadow-2xl whitespace-nowrap tracking-wide">
                Click any points on the grid to construct planes
            </div>
        )}
      </div>

      <div className="w-full md:w-80 bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto z-10 shadow-xl">
        
        <div>
          <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2"><Layers className="w-5 h-5" /> Miller Visualizer</h1>
        </div>

        <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
           <button onClick={() => setActiveTab('visualizer')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab==='visualizer'?'bg-blue-600 text-white':'text-gray-400'}`}>Visualize</button>
           <button onClick={() => setActiveTab('quiz')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab==='quiz'?'bg-green-600 text-white':'text-gray-400'}`}>Quiz</button>
        </div>

        {activeTab === 'visualizer' && (
        <>
            <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
              <button onClick={() => setMode('plane')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${mode === 'plane' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Plane</button>
              <button onClick={() => setMode('direction')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${mode === 'direction' ? 'bg-fuchsia-600 text-white' : 'text-gray-400'}`}>Direction</button>
            </div>

            <div className="space-y-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
               <h3 className="text-sm font-semibold uppercase text-gray-400">{isFourIndex ? 'Indices (4-Index)' : 'Indices (3-Index)'}</h3>
               <div className="flex flex-col gap-3">
                 {['h', 'k', 'u', 'v'].filter(k => mode==='plane' ? ['h','k'].includes(k) : ['u','v'].includes(k)).map((axis) => (
                   <div key={axis} className="flex items-center gap-3">
                      <label className="w-4 font-mono font-bold text-gray-400 text-xs">{axis}</label>
                      <input type="range" min="-6" max="6" step="1" value={mode==='plane' ? indices[axis] : direction[axis]} onChange={(e) => handleIndexChange(mode, axis, e.target.value)} className="flex-grow h-2 bg-gray-700 rounded-lg cursor-pointer accent-blue-500"/>
                      <span className="w-4 text-right font-mono text-xs text-gray-300"><Overbar val={mode==='plane' ? indices[axis] : direction[axis]} /></span>
                   </div>
                 ))}
                 {isFourIndex && (
                   <div className="flex items-center gap-3">
                      <label className="w-4 font-mono font-bold text-yellow-500 text-xs">{mode==='plane'?'i':'t'}</label>
                      <div className="flex-grow h-6 bg-gray-800 rounded border border-gray-700 flex items-center px-2 text-xs text-gray-400 italic">
                        <Overbar val={-( (mode==='plane'?indices.h:direction.u) + (mode==='plane'?indices.k:direction.v) )} />
                      </div>
                   </div>
                 )}
                 {['l', 'w'].filter(k => mode==='plane' ? k==='l' : k==='w').map((axis) => (
                   <div key={axis} className="flex items-center gap-3">
                      <label className="w-4 font-mono font-bold text-gray-400 text-xs">{axis}</label>
                      <input type="range" min="-6" max="6" step="1" value={mode==='plane' ? indices[axis==='l'?'l':'l'] : direction[axis==='w'?'w':'w']} onChange={(e) => handleIndexChange(mode, axis, e.target.value)} className="flex-grow h-2 bg-gray-700 rounded-lg cursor-pointer accent-blue-500"/>
                      <span className="w-4 text-right font-mono text-xs text-gray-300"><Overbar val={mode==='plane' ? indices[axis==='l'?'l':'l'] : direction[axis==='w'?'w':'w']} /></span>
                   </div>
                 ))}
               </div>
            </div>

            <div className="space-y-2">
               <h3 className="text-xs font-semibold uppercase text-gray-400">System</h3>
               <select value={selectedSystem} onChange={(e) => setSelectedSystem(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg p-2 cursor-pointer">
                  {Object.keys(CRYSTAL_SYSTEMS).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            
            <div className="space-y-4 bg-gray-800/30 p-3 rounded-xl border border-gray-700/50">
               <div className="flex justify-between items-center">
                 <h3 className="text-xs font-semibold uppercase text-gray-400">Lattice Params</h3>
               </div>
               
               <div className="bg-gray-800/50 p-3 rounded border border-gray-700/50 text-sm font-mono text-gray-300 flex flex-col gap-2 shadow-inner">
                 <div className="flex items-center gap-3"><Calculator className="w-4 h-4 text-blue-400"/> <span>{constraints.lengths}</span></div>
                 <div className="flex items-center gap-3"><Calculator className="w-4 h-4 text-green-400"/> <span>{constraints.angles}</span></div>
               </div>

               <div className="grid grid-cols-1 gap-1">
                {['a', 'b', 'c'].map(p => {
                  const sys = sysShort;
                  const isCubic = ['Simple Cubic', 'Rhombohedral'].includes(sys);
                  const isTetraHex = ['Tetragonal', 'Hexagonal'].includes(sys);
                  const isDisabled = (p === 'b' && (isCubic || isTetraHex)) || (p === 'c' && isCubic);
                  return (
                  <div key={p} className={`flex items-center gap-2 ${isDisabled ? 'opacity-50' : ''}`}>
                     <label className="w-4 text-xs font-mono text-gray-500">{p}</label>
                     <input type="range" min="0.5" max="2.5" step="0.1" value={latticeParams[p]} disabled={isDisabled} onChange={(e) => handleParamChange(p, e.target.value)} className="flex-grow h-1 bg-gray-700 rounded-lg accent-blue-500"/>
                     <span className="w-8 text-right font-mono text-xs text-blue-300">{latticeParams[p].toFixed(1)}</span>
                  </div>
                  );
                })}
                <div className="w-full h-px bg-gray-700 my-1"></div>
                {['alpha', 'beta', 'gamma'].map(p => {
                  const sys = sysShort;
                  let isAngleDisabled = false;
                  if (sys !== 'Triclinic' && sys !== 'Monoclinic' && sys !== 'Rhombohedral') isAngleDisabled = true;
                  if (sys === 'Monoclinic' && (p === 'alpha' || p === 'gamma')) isAngleDisabled = true;
                  if (sys === 'Rhombohedral' && (p === 'beta' || p === 'gamma')) isAngleDisabled = true;
                  return (
                  <div key={p} className={`flex items-center gap-2 ${isAngleDisabled ? 'opacity-50' : ''}`}>
                     <label className="w-4 text-xs font-mono text-gray-500">{getParamLabel(p)}</label>
                     <input type="range" min="60" max="120" step="1" value={latticeParams[p]} disabled={isAngleDisabled} onChange={(e) => handleParamChange(p, e.target.value)} className="flex-grow h-1 bg-gray-700 rounded-lg accent-green-500"/>
                     <span className="w-8 text-right font-mono text-xs text-green-300">{Math.round(latticeParams[p])}°</span>
                  </div>
                  );
                })}
               </div>
            </div>
            
            <div className="space-y-2">
               <button onClick={() => setShowLabels(!showLabels)} className="flex items-center justify-between w-full p-2 rounded hover:bg-gray-800 transition-colors">
                 <span className="text-xs text-gray-300">Show Labels</span>
                 <div className={`w-8 h-4 rounded-full relative transition-colors ${showLabels ? 'bg-blue-600' : 'bg-gray-700'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showLabels ? 'left-4.5' : 'left-0.5'}`} /></div>
               </button>
               <button onClick={() => setAutoRotate(!autoRotate)} className="flex items-center justify-between w-full p-2 rounded hover:bg-gray-800 transition-colors">
                 <span className="text-xs text-gray-300">Auto Rotate</span>
                 <div className={`w-8 h-4 rounded-full relative transition-colors ${autoRotate ? 'bg-blue-600' : 'bg-gray-700'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${autoRotate ? 'left-4.5' : 'left-0.5'}`} /></div>
               </button>
            </div>
          </>
        )}

        {activeTab === 'quiz' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             
             <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
                <button onClick={() => { setQuizTab('identify'); generateQuiz('identify'); }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${quizTab==='identify'?'bg-gray-600 text-white':'text-gray-400'}`}>Identify</button>
                <button onClick={() => { setQuizTab('draw'); generateQuiz('draw'); }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${quizTab==='draw'?'bg-gray-600 text-white':'text-gray-400'}`}>Draw Plane</button>
             </div>

             {quizTab === 'identify' && (
             <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><GraduationCap className="w-24 h-24 text-white"/></div>
                <div className="relative z-10">
                   <div className="flex justify-between items-start mb-4">
                     <span className="bg-blue-900/50 text-blue-300 text-xs font-bold px-2 py-1 rounded border border-blue-800/50 uppercase tracking-wide">{quizState.system}</span>
                   </div>
                   <h3 className="text-sm text-gray-400 tracking-wider font-bold mb-2"><span className="uppercase">Identify</span> {isFourIndex ? '(h k i l)' : '(h k l)'}</h3>
                   <div className="bg-black/30 p-3 rounded-lg border border-gray-700/50 mb-4">
                       <p className="text-xs text-gray-400 italic text-center">Rotate the model to read the intercept labels!</p>
                   </div>
                   <div className="flex gap-2 mb-4">
                      <input type="text" placeholder="h" value={quizState.userInput.v1} onChange={(e) => setQuizState(p => ({...p, userInput: {...p.userInput, v1: e.target.value}}))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-white font-mono focus:border-blue-500 focus:outline-none"/>
                      <input type="text" placeholder="k" value={quizState.userInput.v2} onChange={(e) => setQuizState(p => ({...p, userInput: {...p.userInput, v2: e.target.value}}))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-white font-mono focus:border-blue-500 focus:outline-none"/>
                      {isFourIndex && <input type="text" placeholder="i" value={quizState.userInput.v3} onChange={(e) => setQuizState(p => ({...p, userInput: {...p.userInput, v3: e.target.value}}))} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-yellow-500 font-mono focus:border-yellow-500 focus:outline-none"/>}
                      <input type="text" placeholder="l" onChange={(e) => setQuizState(p => ({...p, userInput: {...p.userInput, [isFourIndex ? 'v4' : 'v3']: e.target.value}}))} value={isFourIndex ? quizState.userInput.v4 : quizState.userInput.v3} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-white font-mono focus:border-blue-500 focus:outline-none"/>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={checkIdentifyAnswer} disabled={quizState.feedback === 'correct'} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors text-sm">Submit</button>
                     <button onClick={() => generateQuiz('identify')} className="px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"><ArrowRight className="w-4 h-4" /></button>
                   </div>
                </div>
             </div>
             )}

             {quizTab === 'draw' && (
             <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><PenTool className="w-24 h-24 text-emerald-500"/></div>
                <div className="relative z-10">
                   <div className="flex justify-between items-start mb-4">
                     <span className="bg-emerald-900/50 text-emerald-300 text-xs font-bold px-2 py-1 rounded border border-emerald-800/50 uppercase tracking-wide">{quizState.system}</span>
                   </div>
                   
                   <h3 className="text-sm text-gray-400 uppercase tracking-wider font-bold mb-2">Draw Plane <span className="text-emerald-400 font-mono">({quizState.target.h} {quizState.target.k} {isFourIndex ? -(quizState.target.h + quizState.target.k) + ' ' : ''}{quizState.target.l})</span></h3>
                   
                   <div className="bg-black/30 p-2 rounded-lg border border-gray-700/50 mb-4 space-y-3">
                        {['h', 'k', isFourIndex?'i':null, 'l'].filter(Boolean).map(axis => {
                            const axisLabel = isFourIndex 
                                ? (axis === 'h' ? 'a₁' : axis === 'k' ? 'a₂' : axis === 'i' ? 'a₃' : 'c')
                                : (axis === 'h' ? 'a' : axis === 'k' ? 'b' : 'c');
                                
                            return (
                            <div key={axis} className="bg-gray-800/50 p-2 rounded border border-gray-700/50 shadow-inner">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                                        <span className="text-emerald-400 font-mono text-xs lowercase">{axisLabel}</span> <span className="uppercase">Partitions</span>
                                    </label>
                                    <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">{partitions[axis]}</span>
                                </div>
                                <input 
                                   type="range" min="1" max="6" step="1" 
                                   value={partitions[axis]} 
                                   onChange={(e) => {
                                       setPartitions(p => ({...p, [axis]: parseInt(e.target.value)}));
                                       setSelectedPoints([]); 
                                   }} 
                                   className="w-full h-1 bg-gray-700 rounded-lg cursor-pointer accent-emerald-500" 
                                />
                            </div>
                        )})}
                        
                        <div className="flex justify-between items-center px-2 pt-2 border-t border-gray-700/50">
                            <span className="text-xs font-semibold text-gray-400 uppercase">Points Selected:</span>
                            <span className={`text-sm font-bold font-mono ${selectedPoints.length >= 3 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {selectedPoints.length} <span className="text-[10px] text-gray-500 font-sans">/ 3 min</span>
                            </span>
                        </div>
                   </div>

                   <div className="flex gap-2 mt-4">
                     <button onClick={checkDrawAnswer} disabled={quizState.feedback === 'correct' || isShowingAnswer} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors text-xs">Submit Shape</button>
                     <button onClick={showDrawAnswer} disabled={quizState.feedback === 'correct' || isShowingAnswer} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors text-xs flex items-center justify-center gap-1"><Eye className="w-3 h-3" /> Answer</button>
                     <button onClick={() => generateQuiz('draw')} className="px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"><ArrowRight className="w-4 h-4" /></button>
                   </div>
                </div>
             </div>
             )}

             {quizState.feedback && (
                <div className={`p-3 rounded-lg border flex items-start gap-3 ${quizState.feedback === 'correct' ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                   {quizState.feedback === 'correct' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                   <div className="text-xs leading-relaxed">{quizState.message}</div>
                </div>
             )}
          </div>
        )}

        <button onClick={reset} className="flex items-center justify-center gap-2 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all font-medium text-sm mt-auto">
          <RotateCcw className="w-4 h-4" /> Reset View
        </button>

      </div>
    </div>
  );
}