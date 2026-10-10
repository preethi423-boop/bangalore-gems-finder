import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { upiUri } from "@/lib/upi";
export function UpiPreview({ id, name, amount, plan }: { id: string; name: string; amount: number; plan: string }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setImage(""); setError(false);
    try {
      QRCode.toDataURL(upiUri(id, name, amount, plan), { width: 240, margin: 2 }).then(value => { if (active) setImage(value); }).catch(() => { if (active) setError(true); });
    } catch { setError(true); }
    return () => { active = false; };
  }, [id, name, amount, plan]);
  return <div className="space-y-2">{image ? <img src={image} width={240} height={240} className="max-w-full" alt={`${plan} UPI QR preview`} /> : <p className="text-sm text-muted-foreground">{error ? "Enter a valid UPI account and price." : "Generating QR…"}</p>}<p className="break-words text-sm">{name} · {id}</p><p className="text-xs text-muted-foreground">Admin preview only. Transfers do not activate subscriptions until payment verification is connected.</p></div>;
}