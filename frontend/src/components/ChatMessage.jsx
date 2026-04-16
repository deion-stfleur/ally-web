export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,40rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
            : "border border-slate-200/90 bg-white text-slate-800 shadow-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
