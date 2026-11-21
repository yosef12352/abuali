import { useEffect, useRef, useState } from "react";

/** Abu Ali Chat media composer. File names are never rendered in the UI. */
type Props = {
  onSend: (file: File, caption: string) => Promise<void>;
  accept?: string;
};
export default function MediaComposer({ onSend, accept = "image/*,video/*" }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setUrl(""); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const cancel = () => {
    if (sending) return;
    setFile(null); setCaption(""); setError("");
    if (picker.current) picker.current.value = "";
  };
  async function send() {
    if (!file || sending) return;
    setSending(true); setError("");
    try {
      await onSend(file, caption.trim()); // Only show success after upload + DB insert succeed.
      cancelAfterSuccess();
      setToast("تم الإرسال");
    } catch {
      setError("تعذّر الإرسال. حاول مرة ثانية.");
    } finally {
      setSending(false);
    }
  }
  function cancelAfterSuccess() {
    setFile(null); setCaption("");
    if (picker.current) picker.current.value = "";
  }
  return (
    <div dir="rtl" lang="ar">
      <input ref={picker} type="file" accept={accept} hidden
        onChange={e => { const next = e.target.files?.[0]; if (next) { setFile(next); setError(""); } }} />
      <button type="button" onClick={() => picker.current?.click()}>فتح معرض الجهاز</button>
      {file && (
        <div role="dialog" aria-modal="true" aria-label="معاينة قبل الإرسال"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#101b20", color: "white", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: 20 }}>
          {file.type.startsWith("image/") ? <img src={url} alt="معاينة الصورة" style={{ maxHeight: "65vh", objectFit: "contain" }} /> :
           file.type.startsWith("video/") ? <video src={url} controls playsInline style={{ maxHeight: "65vh" }} /> :
           <p>ملف جاهز للإرسال</p>}
          <input aria-label="تعليق اختياري" placeholder="إضافة تعليق..." value={caption}
            onChange={e => setCaption(e.target.value)} maxLength={2000} />
          {error && <p role="alert">{error}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" disabled={sending} onClick={cancel}>إلغاء</button>
            <button type="button" disabled={sending} onClick={send}>{sending ? "جارٍ الإرسال..." : "إرسال"}</button>
          </div>
        </div>
      )}
      {toast && <div role="status" style={{ position: "fixed", bottom: 85, left: "50%", transform: "translateX(-50%)", background: "#203b32", color: "#fff", padding: "10px 20px", borderRadius: 18, zIndex: 1100 }}>{toast}</div>}
    </div>
  );
}
