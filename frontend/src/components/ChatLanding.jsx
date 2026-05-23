import TextAllyHandoff from "./TextAllyHandoff";

export default function ChatLanding({ user, allySmsE164 = null }) {
  const first = user?.name?.split(/\s+/)[0] || "there";

  return (
    <div className="chat-landing-root mx-auto flex max-w-4xl flex-col items-start px-4 pb-8 pt-6">
      <h1 className="text-left text-3xl font-semibold tracking-tight text-slate-900">
        Hi, {first}
      </h1>
      <p className="mt-2 max-w-lg text-left text-sm text-slate-500">
        Tell us what you need — email, Drive, Calendar, and more. We&apos;ll handle the rest.
      </p>

      {user?.sms_plan_active && user?.phone_e164 && allySmsE164 ? (
        <div className="chat-landing-handoff mt-8 w-full max-w-3xl">
          <TextAllyHandoff
            allySmsE164={allySmsE164}
            userPhoneE164={user.phone_e164}
          />
        </div>
      ) : user?.sms_plan_active && !user?.phone_e164 ? (
        <p className="mt-6 max-w-md text-center text-sm text-sky-800">
          Link your phone in the popup to text Ally from Messages — save your number, then send &quot;Hi
          Ally&quot; to get off the web app.
        </p>
      ) : null}
    </div>
  );
}
