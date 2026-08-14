import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Link } from "../../design-system";

/**
 * Vaste tekengrootte in pixels. Het canvas wordt met CSS uitgerekt naar de
 * beschikbare breedte, maar de PNG die eruit komt is altijd 600×200 — een
 * bestand van hooguit een paar kilobyte, ongeacht het scherm waarop is
 * getekend. Dat houdt de database klein en de pakbon overal identiek.
 */
const BREEDTE = 600;
const HOOGTE = 200;

export interface HandtekeningHandle {
  /** PNG als data-URL, of null wanneer er niets getekend is. */
  exporteer: () => string | null;
  wis: () => void;
}

export const Handtekening = forwardRef<HandtekeningHandle, { label?: string }>(function Handtekening(
  { label = "Handtekening ontvanger" },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tekent = useRef(false);
  const [leeg, setLeeg] = useState(true);

  const context = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return null;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e0e0e";
    return ctx;
  }, []);

  const wis = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    ctx.clearRect(0, 0, BREEDTE, HOOGTE);
    setLeeg(true);
  }, [context]);

  useImperativeHandle(ref, () => ({
    exporteer: () => (leeg ? null : (canvasRef.current?.toDataURL("image/png") ?? null)),
    wis,
  }), [leeg, wis]);

  /**
   * Het scherm kan tussen twee tekenbewegingen van formaat veranderen (draaien,
   * toetsenbord dat opklapt). Omdat het canvas een vaste backing store heeft,
   * blijft de tekening staan; alleen de omrekenfactor verandert, en die lezen
   * we bij elke beweging opnieuw uit getBoundingClientRect.
   */
  function positie(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * BREEDTE,
      y: ((e.clientY - rect.top) / rect.height) * HOOGTE,
    };
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = context();
    if (!ctx) return;
    // Pointer vasthouden zodat een streek die buiten het vak eindigt netjes
    // wordt afgesloten in plaats van halverwege te blijven hangen.
    e.currentTarget.setPointerCapture(e.pointerId);
    tekent.current = true;
    const { x, y } = positie(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Een enkele tik moet ook een stip opleveren.
    ctx.lineTo(x, y);
    ctx.stroke();
    setLeeg(false);
  }

  function beweeg(e: PointerEvent<HTMLCanvasElement>) {
    if (!tekent.current) return;
    const ctx = context();
    if (!ctx) return;
    const { x, y } = positie(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stop(e: PointerEvent<HTMLCanvasElement>) {
    if (!tekent.current) return;
    tekent.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  // Op iOS voorkomt touch-action alleen scrollen; de pull-to-refresh en de
  // tekstselectie-loep hangen aan touchmove en moeten apart geblokkeerd.
  // React zet touch-listeners passief neer, vandaar een handmatige listener.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blokkeer = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchmove", blokkeer, { passive: false });
    return () => canvas.removeEventListener("touchmove", blokkeer);
  }, []);

  return (
    <div className="field-group">
      <div className="product-kiezer__kop">
        <span className="field-group__label">{label}</span>
        {!leeg ? <Link icon={null} onClick={wis}>Wissen</Link> : null}
      </div>
      <div className="handtekening">
        <canvas
          ref={canvasRef}
          width={BREEDTE}
          height={HOOGTE}
          className="handtekening__canvas"
          aria-label={label}
          onPointerDown={start}
          onPointerMove={beweeg}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        {leeg ? <span className="handtekening__hint">Teken hier met je vinger of muis</span> : null}
      </div>
    </div>
  );
});
