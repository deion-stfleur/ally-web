const MOCK_FILES = [
  { id: "sample-doc-1", name: "Q3 Budget (sample)", mime: "doc" },
  { id: "sample-deck-1", name: "Pitch deck (sample)", mime: "slides" },
];

export default function ContextFilesPanel({
  open,
  onClose,
  attachIds,
  onAttachChange,
}) {
  function toggle(id) {
    onAttachChange((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close context panel"
        className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-[72px] top-0 z-40 flex w-[min(100vw-72px,300px)] flex-col border-r border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Context</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Recent files
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Toggle files to include as context for your next message.
          </p>
          <ul className="space-y-1">
            {MOCK_FILES.map((f) => {
              const attached = attachIds?.includes(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      attached
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{f.name}</span>
                    {attached && <span className="text-xs opacity-90">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
