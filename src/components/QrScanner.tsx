import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser/esm/common/IScannerControls';
import { useEffect, useRef, useState } from 'react';

type QrScannerProps = {
  onScan: (code: string) => void;
  onClose: () => void;
};

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (cancelled) return;
          const text = result?.getText()?.trim();
          if (text) {
            try {
              controls.stop();
            } catch {
              // ignore
            }
            onScan(text);
          }
        });
        controlsRef.current = controls;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start camera');
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
      controlsRef.current = null;
    };
  }, [onScan]);

  return (
    <div className="bidi-qr-scanner">
      <div className="bidi-qr-scanner__header">
        <p className="bidi-qr-scanner__title">Scan token QR</p>
        <button type="button" className="bidi-icon-btn" onClick={onClose} aria-label="Close scanner">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="bidi-qr-scanner__video-wrap">
        <video ref={videoRef} className="bidi-qr-scanner__video" playsInline muted />
        {error ? (
          <p className="bidi-qr-scanner__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <p className="bidi-qr-scanner__hint">Point the camera at the token QR code</p>
    </div>
  );
}
