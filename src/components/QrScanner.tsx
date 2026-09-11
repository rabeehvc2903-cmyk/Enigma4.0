import React, { useRef, useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, RefreshCw, X, Upload, AlertCircle, Sparkles, CheckCircle2, ScanLine } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanning, setScanning] = useState<boolean>(true);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && code.data.trim().length > 0) {
          setScanning(false);
          stopCamera();
          try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80);
            }
          } catch {}
          onScanSuccess(code.data.trim());
          return;
        }
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(scanFrame);
  }, [scanning, stopCamera, onScanSuccess]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage('');
    setScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setErrorMessage('Camera access is not supported in this browser. Please upload a QR code image instead.');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      setHasPermission(false);
      const errObj = err as { name?: string; message?: string } | null;
      const errName = errObj?.name || '';
      const errMsg = errObj?.message || '';
      
      console.warn('Camera permission status:', errName, errMsg);

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'AbortError' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('dismissed') ||
        errMsg.toLowerCase().includes('denied')
      ) {
        setErrorMessage('Camera access was dismissed or not granted. Tap "Allow Camera" to retry, or upload a photo of your QR code badge below.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setErrorMessage('No camera was detected on this device. You can upload a photo of your QR code badge instead.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setErrorMessage('Camera is currently in use by another application or tab. Please close other camera apps and retry.');
      } else {
        setErrorMessage('Camera could not be started. You can grant permission to retry or upload your QR badge photo.');
      }
    }
  }, [facingMode, scanFrame, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage('');

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setIsProcessingFile(false);
          setErrorMessage('Could not process image. Please try another image.');
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        setIsProcessingFile(false);

        if (code && code.data && code.data.trim().length > 0) {
          stopCamera();
          onScanSuccess(code.data.trim());
        } else {
          setErrorMessage('No readable QR code found in the selected image. Please ensure the QR code is clear and well-lit.');
        }
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="relative rounded-3xl bg-[#0e101f] border border-purple-500/40 p-4 sm:p-5 shadow-[0_0_30px_rgba(168,85,247,0.25)] space-y-4 overflow-hidden animate-fadeIn">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header controls */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={handleFlipCamera}
          className="p-2 rounded-xl bg-[#181b30] hover:bg-purple-600/20 text-slate-300 hover:text-purple-300 border border-[#292d4a] transition-all cursor-pointer"
          title="Switch Camera (Front/Back)"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-xl bg-[#181b30] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#292d4a] transition-all cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Viewfinder Area */}
      <div className="relative w-full aspect-square sm:aspect-[4/3] rounded-2xl overflow-hidden bg-black border-2 border-purple-500/50 flex items-center justify-center shadow-inner">
        {hasPermission === false && (
          <div className="p-6 text-center space-y-3 max-w-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Camera</span>
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${hasPermission === false ? 'hidden' : 'block'}`}
          muted
          playsInline
        />

        {/* Viewfinder Target & Laser Scanning Line */}
        {hasPermission !== false && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark vignette backdrop around the scan window */}
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-purple-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-fuchsia-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-fuchsia-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-fuchsia-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-fuchsia-400 rounded-br-lg" />

              {/* Animated Laser Scanning Line */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_12px_#e879f9] animate-bounce duration-1000 top-1/2 -translate-y-1/2" />

              <div className="absolute inset-x-0 -bottom-8 text-center">
                <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-sm border border-purple-500/40 tracking-wider">
                  Align ID Card QR Code
                </span>
              </div>
            </div>
          </div>
        )}

        {isProcessingFile && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-purple-300">Reading QR code from image...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message Toast */}
      {errorMessage && hasPermission !== false && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-xs font-medium text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Image Upload Fallback Button */}
      <div className="pt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-4 rounded-xl bg-[#181b30] hover:bg-[#222646] text-purple-300 hover:text-white border border-[#292d4a] hover:border-purple-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
        >
          <Upload className="w-3.5 h-3.5 text-purple-400" />
          <span>Upload QR Code Image / Photo</span>
        </button>
      </div>
    </div>
  );
};
