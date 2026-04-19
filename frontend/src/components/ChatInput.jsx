import { useRef, useState } from "react";
import FileChip from "./FileChip";

const ALLOWED_IMG = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(file);
  });
}

export default function ChatInput({
  onSend,
  disabled,
  attachIds,
  onRemoveAttach,
  onReceiptImages,
}) {
  const [text, setText] = useState("");
  const receiptFileRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="shrink-0 border-t border-slate-200/60 bg-gradient-to-t from-slate-100/90 via-[#F9FAFB] to-[#F9FAFB] px-4 pb-6 pt-3">
      <div className="mx-auto max-w-3xl">
        {attachIds?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachIds.map((id) => (
              <FileChip key={id} id={id} onRemove={() => onRemoveAttach(id)} />
            ))}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.1)]"
        >
          <div className="flex gap-3">
            <span
              className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"
              aria-hidden
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </span>
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask me anything…"
              disabled={disabled}
              className="max-h-40 min-h-[48px] w-full resize-none border-0 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <label className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">Source</span>
              <select
                disabled={disabled}
                className="max-w-[11rem] cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 disabled:opacity-50"
                defaultValue="gmail"
              >
                <option value="drive">Drive (sample files)</option>
                <option value="gmail">Gmail</option>
                <option value="calendar">Calendar</option>
              </select>
            </label>
            <div className="flex items-center gap-1">
              <input
                ref={receiptFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={async (e) => {
                  const input = e.target;
                  const files = input.files;
                  if (!files?.length || !onReceiptImages || disabled) {
                    input.value = "";
                    return;
                  }
                  const items = [];
                  for (const f of files) {
                    if (!ALLOWED_IMG.has(f.type)) continue;
                    try {
                      const data_base64 = await readFileBase64(f);
                      items.push({ media_type: f.type, data_base64 });
                    } catch {
                      /* skip */
                    }
                    if (items.length >= 4) break;
                  }
                  if (items.length) onReceiptImages(items);
                  input.value = "";
                }}
              />
              <button
                type="button"
                disabled={disabled || !onReceiptImages}
                onClick={() => receiptFileRef.current?.click()}
                title={
                  onReceiptImages
                    ? "Attach receipt image (max 4, sent with next message)"
                    : "Receipt images unavailable"
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.657 18.217a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button
                type="button"
                disabled
                title="Voice (coming soon)"
                className="rounded-lg p-2 text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={disabled || !text.trim()}
                className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Send"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </form>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Ally may display inaccurate info. Double-check important actions (especially email).
        </p>
      </div>
    </div>
  );
}
