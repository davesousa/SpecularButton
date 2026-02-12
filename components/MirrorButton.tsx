
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

interface Props {
  externalTrigger?: number;
  onAuraDetected?: (color: string, mood: string) => void;
}

const MirrorButton: React.FC<Props> = ({ externalTrigger, onAuraDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const debugVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [auraColor, setAuraColor] = useState<string>("rgba(37, 99, 235, 0.4)");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);

  // Smooth Tracking State (Internal refs for physics)
  const faceLandmarker = useRef<FaceLandmarker | null>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [proximity, setProximity] = useState(1); 

  // Refs for lerping
  const targetRotation = useRef({ x: 0, y: 0, z: 0 });
  const currentRotation = useRef({ x: 0, y: 0, z: 0 });
  const targetProximity = useRef(1);
  const currentProximity = useRef(1);

  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState({
    fps: 0,
    bbox: { x: 0, y: 0, w: 0, h: 0 },
    pose: { pitch: 0, yaw: 0, roll: 0 }
  });
  const [debugPos, setDebugPos] = useState({ x: 20, y: 20 });
  const isDragging = useRef(false);
  const lastFrameTime = useRef(performance.now());
  const frames = useRef(0);

  const initFaceTracking = async () => {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      faceLandmarker.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "CPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      setIsModelLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("Tracker Error");
    }
  };

  const setupCamera = useCallback(async () => {
    setErrorMsg("");
    setHasPermission(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      setHasPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setHasPermission(false);
      setErrorMsg(err.name === 'NotAllowedError' ? "Denied" : "Error");
    }
  }, []);

  // Sync stream to debug video
  useEffect(() => {
    if (showDebug && debugVideoRef.current && streamRef.current) {
      debugVideoRef.current.srcObject = streamRef.current;
      debugVideoRef.current.play().catch(console.error);
    }
  }, [showDebug, hasPermission]);

  useEffect(() => {
    let animationFrameId: number;
    
    const predict = () => {
      const now = performance.now();
      frames.current++;
      
      // Update FPS every second
      if (now - lastFrameTime.current >= 1000) {
        const currentFps = frames.current;
        setDebugData(prev => ({ ...prev, fps: currentFps }));
        frames.current = 0;
        lastFrameTime.current = now;
      }

      if (videoRef.current && faceLandmarker.current && videoRef.current.readyState >= 2) {
        const results = faceLandmarker.current.detectForVideo(videoRef.current, now);
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          
          let minX = 1, minY = 1, maxX = 0, maxY = 0;
          landmarks.forEach(pt => {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
          });

          const nose = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          const chin = landmarks[152];
          
          const yaw = (nose.x - 0.5) * -18; 
          const pitch = (nose.y - 0.5) * 18; 
          const roll = (leftEye.y - rightEye.y) * 15;

          const faceWidth = maxX - minX;
          targetProximity.current = Math.min(1.05, Math.max(0.98, 1 + (faceWidth - 0.3) * 0.2));

          targetRotation.current = { x: pitch, y: yaw, z: roll };
          
          const bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
          
          // Update pose in state for UI display
          setDebugData(prev => ({ 
            ...prev, 
            bbox,
            pose: { pitch, yaw, roll } 
          }));

          if (showDebug && debugCanvasRef.current) {
            const ctx = debugCanvasRef.current.getContext('2d');
            if (ctx) {
              const { width, height } = debugCanvasRef.current;
              ctx.clearRect(0, 0, width, height);
              
              // Draw Bounding Box
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 2;
              ctx.strokeRect(bbox.x * width, bbox.y * height, bbox.w * width, bbox.h * height);
              
              // Draw Landmark Dots (Eyes, Nose, Chin)
              ctx.fillStyle = '#00ff00';
              [nose, leftEye, rightEye, chin].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x * width, pt.y * height, 3, 0, Math.PI * 2);
                ctx.fill();
              });
            }
          }
        } else {
          targetRotation.current = { x: 0, y: 0, z: 0 };
          targetProximity.current = 1;
          
          // Clear debug canvas if no face
          if (showDebug && debugCanvasRef.current) {
            const ctx = debugCanvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, debugCanvasRef.current.width, debugCanvasRef.current.height);
          }
        }

        const smoothing = 0.08; 
        currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * smoothing;
        currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * smoothing;
        currentRotation.current.z += (targetRotation.current.z - currentRotation.current.z) * smoothing;
        currentProximity.current += (targetProximity.current - currentProximity.current) * smoothing;

        setRotation({ ...currentRotation.current });
        setProximity(currentProximity.current);
        setTranslation({ 
          x: currentRotation.current.y * 1.5, 
          y: -currentRotation.current.x * 1.5 
        });
      }
      animationFrameId = requestAnimationFrame(predict);
    };

    predict();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isModelLoading, showDebug]);

  const analyzeAura = async () => {
    if (!videoRef.current || !hasPermission || isAnalyzing) return;
    setIsAnalyzing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ inlineData: { data: base64Image, mimeType: "image/jpeg" } }, { text: "What is the vibe/aura here? Return JSON with hex 'color' and 'mood'." }] }],
          config: { responseMimeType: "application/json" }
        });
        const result = JSON.parse(response.text || "{}");
        if (result.color) {
          setAuraColor(`${result.color}66`);
          onAuraDetected?.(result.color, result.mood);
        }
      } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
    }
  };

  useEffect(() => {
    initFaceTracking();
    if (externalTrigger && externalTrigger > 0) setupCamera();
  }, [externalTrigger, setupCamera]);

  useEffect(() => {
    setupCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      faceLandmarker.current?.close();
    };
  }, [setupCamera]);

  return (
    <div ref={containerRef} className="relative flex flex-col items-center perspective-[1500px]">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* 3D Dynamic Shadow - Extremely Subtle */}
      <div 
        className="absolute top-[93%] left-1/2 -translate-x-1/2 pointer-events-none z-0"
        style={{
          transform: `translateX(calc(-50% + ${-translation.x}px)) translateY(${translation.y}px) scale(${proximity})`,
          filter: `blur(${12 + Math.abs(translation.y / 3)}px)`,
          opacity: hasPermission ? 0.15 * proximity : 0
        }}
      >
         <div className="w-72 h-4 rounded-[100%] bg-slate-950 transition-opacity duration-700" />
      </div>

      <button
        onMouseDown={() => { setIsPressed(true); analyzeAura(); }}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onClick={() => hasPermission === false && setupCamera()}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg) scale(${proximity}) ${isPressed ? 'translateZ(-10px)' : 'translateZ(30px)'}`,
          transformStyle: 'preserve-3d'
        }}
        className={`
          relative w-72 h-16 md:w-96 md:h-20 
          rounded-full overflow-hidden
          transition-transform duration-[60ms] linear
          border-t-[1.5px] border-l-[1.5px] border-white/70
          border-r-[0.5px] border-b-[0.5px] border-slate-400/10
          bg-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]
          focus:outline-none backdrop-blur-3xl
        `}
      >
        <div className="absolute inset-0 transition-colors duration-1000 z-0" style={{ backgroundColor: auraColor }} />
        
        {/* Reflection Media - Zoom dampened for subtlety */}
        <div className={`absolute inset-0 transition-opacity duration-1000 z-10 ${hasPermission ? 'opacity-90' : 'opacity-0'}`}>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ 
              filter: `brightness(1.05) contrast(1.05) blur(${isPressed ? '12px' : '2px'})`,
              transform: `scaleX(-1) scale(${1.05 * proximity})`
            }}
          />
        </div>

        {/* Optical Glass Depth Layer */}
        <div className="absolute inset-0 z-20 pointer-events-none" style={{ transform: 'translateZ(10px)' }}>
          <div className="absolute inset-0 rounded-full shadow-[inset_0_15px_30px_-5px_rgba(255,255,255,0.7),inset_0_-10px_20px_rgba(0,0,0,0.1)]" />
        </div>

        {/* Specular Highlights - Movement range significantly reduced */}
        <div className="absolute inset-0 z-30 pointer-events-none" style={{ transform: 'translateZ(20px)' }}>
          <div 
            className="absolute -inset-[200%] rotate-[15deg] transition-transform duration-0"
            style={{ 
              transform: `translateX(${-rotation.y * 2}%) translateY(${-rotation.x * 1.5}%)`,
              background: 'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0) 42%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 58%, transparent 100%)'
            }} 
          />
          <div className="absolute inset-0 rounded-full border-[1.2px] border-white/20 mix-blend-overlay" />
        </div>

        <div className="relative z-40 flex items-center justify-center w-full h-full" style={{ transform: 'translateZ(40px)' }}>
            <span className={`
                tracking-[0.9em] uppercase text-[11px]
                transition-all duration-300
                ${isPressed ? 'font-black scale-[0.9] text-white' : 'font-bold scale-100 text-slate-900/80'}
            `}
            style={{
                textShadow: isPressed 
                    ? '0 -1px 1px rgba(0,0,0,0.3), 0 1px 1px rgba(255,255,255,0.3)' 
                    : '0 1px 1px rgba(255,255,255,0.8), 0 -1px 1px rgba(0,0,0,0.15)',
                filter: isPressed ? 'brightness(1.2)' : 'none'
            }}>
                {isModelLoading ? 'Booting...' : isAnalyzing ? 'Scanning...' : hasPermission ? 'Reflect' : 'Connect'}
            </span>
        </div>
      </button>

      {/* Debug Toggle Button */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed bottom-6 right-6 w-11 h-11 bg-white/20 hover:bg-white/40 backdrop-blur-xl rounded-full border border-white/40 flex items-center justify-center shadow-lg transition-all active:scale-90 z-[100]"
        title="Toggle Debug"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${showDebug ? 'text-blue-600' : 'text-slate-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M18 13h4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
        </svg>
      </button>

      {/* Draggable Debug Window */}
      {showDebug && (
        <div 
          className="fixed z-[99] bg-slate-950/95 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ 
            right: debugPos.x, 
            bottom: debugPos.y, 
            width: '320px', 
            height: '420px',
            resize: 'both',
            minWidth: '280px',
            minHeight: '350px'
          }}
        >
          <div 
            className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between cursor-move select-none"
            onMouseDown={(e) => {
               isDragging.current = true;
               const startX = e.clientX;
               const startY = e.clientY;
               const initialX = debugPos.x;
               const initialY = debugPos.y;
               const onMove = (me: MouseEvent) => {
                 if(!isDragging.current) return;
                 setDebugPos({ x: initialX - (me.clientX - startX), y: initialY - (me.clientY - startY) });
               };
               const onUp = () => {
                 isDragging.current = false;
                 window.removeEventListener('mousemove', onMove);
                 window.removeEventListener('mouseup', onUp);
               };
               window.addEventListener('mousemove', onMove);
               window.addEventListener('mouseup', onUp);
            }}
          >
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-bold text-white/70 tracking-widest uppercase">Optical Engine</span>
            </div>
            <button onClick={() => setShowDebug(false)} className="text-white/30 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="relative flex-1 bg-black overflow-hidden">
            {hasPermission ? (
              <>
                <video 
                  ref={debugVideoRef} 
                  autoPlay playsInline muted 
                  className="w-full h-full object-cover opacity-80 scale-x-[-1]" 
                />
                <canvas 
                  ref={debugCanvasRef} 
                  width={640} height={480}
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
                />
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-2 opacity-20">
                <span className="text-[9px] uppercase font-black tracking-widest">Feed Offline</span>
              </div>
            )}
          </div>

          <div className="p-4 bg-black/40 grid grid-cols-2 gap-4 border-t border-white/5 font-mono">
            <div>
              <p className="text-[7px] text-white/30 uppercase font-bold mb-1">Compute</p>
              <p className="text-xs text-green-500">{debugData.fps} <span className="text-[8px] opacity-40">fps</span></p>
            </div>
            <div className="text-right">
              <p className="text-[7px] text-white/30 uppercase font-bold mb-1">Scale</p>
              <p className="text-xs text-blue-400">{proximity.toFixed(3)}</p>
            </div>
            <div className="col-span-2 border-t border-white/5 pt-2">
              <p className="text-[7px] text-white/30 uppercase font-bold mb-1">Euler Angles</p>
              <div className="grid grid-cols-3 text-[9px] text-white/80">
                <div>P: {debugData.pose.pitch.toFixed(1)}°</div>
                <div>Y: {debugData.pose.yaw.toFixed(1)}°</div>
                <div>R: {debugData.pose.roll.toFixed(1)}°</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MirrorButton;
