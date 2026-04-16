import { useEffect, useState } from "react";

export default function EmailDraftCard({
  draft,
  onSend,
  onCancel,
  sending,
  error,
}) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);

  useEffect(() => {
    setTo(draft.to);
    setSubject(draft.subject);
    setBody(draft.body);
  }, [draft]);

  return (
    <div className="mx-6 mb-3 rounded-xl border border-ally-accent/40 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ally-navy">Ready to send email</h3>
      <p className="mt-1 text-xs text-slate-500">
        Review and edit below, then send from your Gmail account.
      </p>
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-slate-600">
          To
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Subject
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Body
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="mt-0.5 w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sending || !to.trim()}
          onClick={() => onSend({ to: to.trim(), subject, body })}
          className="rounded-lg bg-ally-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send email"}
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
