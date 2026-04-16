export default function FileChip({ id, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
      <span className="max-w-[12rem] truncate" title={id}>
        {id}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
        aria-label="Remove attachment"
      >
        ×
      </button>
    </span>
  );
}
