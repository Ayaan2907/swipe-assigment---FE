import Link from "next/link";

export default function NewSessionPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16 text-center">
        <div>
          <h1 className="text-3xl font-semibold">Start a new interview</h1>
          <p className="mt-3 text-slate-300">
            The interview builder will let you upload a resume, capture missing
            details, and launch the AI question flow. Implementation is coming
            next.
          </p>
        </div>
        <div className="flex justify-center gap-3 text-sm">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
