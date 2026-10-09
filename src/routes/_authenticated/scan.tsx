import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseAssetCode } from "@/lib/qr";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan Equipment | AssetCareConnect" }] }),
  component: ScanPage,
});

type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

function createDetector(): Detector | null {
  const Ctor = (
    window as unknown as {
      BarcodeDetector?: new (o: { formats: string[] }) => Detector;
    }
  ).BarcodeDetector;
  try {
    return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [unrecognized, setUnrecognized] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const open = useCallback(
    (assetId: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (navigator.vibrate) navigator.vibrate(60);
      void navigate({ to: "/assets/$assetId", params: { assetId } });
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const detector = createDetector();

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Type or paste the code below instead.");
        setStarting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStarting(false);
        const canvas = (canvasRef.current ??= document.createElement("canvas"));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (cancelled || doneRef.current) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            let value: string | null = null;
            try {
              if (detector) {
                value = (await detector.detect(video))[0]?.rawValue ?? null;
              } else if (ctx) {
                const scale = Math.min(1, 640 / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                value = jsQR(img.data, img.width, img.height)?.data ?? null;
              }
            } catch {
              /* a bad frame is not fatal; try the next one */
            }
            if (value) {
              const id = parseAssetCode(value);
              if (id) return open(id);
              setUnrecognized(value.slice(0, 120));
            }
          }
          timer = window.setTimeout(tick, 200);
        };
        void tick();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission was blocked. Allow camera access for this site in your browser settings, then reload."
            : "Couldn't start the camera. Type or paste the code below instead.",
        );
        setStarting(false);
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const id = parseAssetCode(manual);
    if (id) open(id);
    else setUnrecognized(manual.trim().slice(0, 120) || "(empty)");
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Scan equipment</h1>
        <p className="text-sm text-muted-foreground">
          Point the camera at the QR label on a machine to open its record.
        </p>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        {!error && (
          <div
            className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            aria-hidden="true"
          />
        )}
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
            <Camera className="size-5" aria-hidden="true" /> Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white">
            <CameraOff className="size-8" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>

      {unrecognized && (
        <p role="status" className="rounded-md bg-amber-500/15 p-3 text-sm">
          That code isn't one of our equipment labels:{" "}
          <span className="font-mono">{unrecognized}</span>
        </p>
      )}

      <form onSubmit={submitManual} className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Paste a label link or asset id"
          aria-label="Label link or asset id"
        />
        <Button type="submit" variant="outline">
          <Keyboard className="mr-1.5 size-4" aria-hidden="true" /> Open
        </Button>
      </form>
    </div>
  );
}
