"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import { Upload, Loader2, FileText } from "lucide-react";

import { useAppDispatch } from "@/hooks/useRedux";
import { upsertCandidate } from "@/features/candidates/candidatesSlice";
import { createSession } from "@/features/sessions/sessionsSlice";
import { appendMessage } from "@/features/chat/chatSlice";
import type { CandidateRecord } from "@/types/interview";
import { parseResumeFile, extractContactDetails } from "@/utils/resumeParser";

interface FormState {
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  resume?: string;
}

const DEFAULT_ROLE = "Full Stack Engineer";

const FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function NewSessionPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    role: DEFAULT_ROLE,
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsedText, setParsedText] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors: ValidationErrors = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email";
    }
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required";
    if (!resumeFile) nextErrors.resume = "Resume upload is required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form.email, form.name, form.phone, resumeFile]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!FILE_TYPES.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx") && !file.name.endsWith(".doc")) {
        setErrors((prev) => ({ ...prev, resume: "Unsupported file type. Upload PDF or DOCX." }));
        return;
      }

      setErrors((prev) => ({ ...prev, resume: undefined }));
      setResumeFile(file);
      setParsing(true);

      try {
        const text = await parseResumeFile(file);
        setParsedText(text);
        const contact = extractContactDetails(text);
        setForm((prev) => ({
          ...prev,
          name: contact.name ?? prev.name,
          email: contact.email ?? prev.email,
          phone: contact.phone ?? prev.phone,
        }));
      } catch (error) {
        console.error("Failed to parse resume", error);
        setParsedText("");
        setErrors((prev) => ({
          ...prev,
          resume: "Could not read the resume. You can still fill details manually.",
        }));
      } finally {
        setParsing(false);
      }
    },
    [],
  );

  const canSubmit = useMemo(() => {
    return form.name.trim() && form.email.trim() && form.phone.trim() && resumeFile && !isSubmitting;
  }, [form.email, form.name, form.phone, isSubmitting, resumeFile]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitError(null);
      if (!validateForm()) return;

      const now = new Date().toISOString();
      const candidateId = uuid();
      const sessionId = uuid();

      const baseCandidate: CandidateRecord = {
        id: candidateId,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role.trim() || DEFAULT_ROLE,
        createdAt: now,
        updatedAt: now,
        status: "collecting_info",
      };

      if (resumeFile) {
        baseCandidate.resume = {
          fileName: resumeFile.name,
          fileType: resumeFile.type || resumeFile.name.split(".").pop() || "unknown",
          size: resumeFile.size,
          uploadedAt: now,
          parsedText: parsedText.slice(0, 50000),
        };
      }

      try {
        setIsSubmitting(true);

        dispatch(upsertCandidate(baseCandidate));
        dispatch(
          createSession({
            session: {
              id: sessionId,
              candidateId,
              status: "not_started",
              questionIds: [],
              startedAt: undefined,
              updatedAt: now,
            },
          }),
        );

        dispatch(
          appendMessage({
            sessionId,
            message: {
              role: "system",
              content: `Welcome ${baseCandidate.name}! When you're ready, click Start Interview to begin your session with Crisp.`,
              meta: {
                type: "greeting",
              },
            },
          }),
        );

        router.push(`/session/${sessionId}`);
      } catch (error) {
        console.error("Failed to create interview session", error);
        setSubmitError("Something went wrong while creating the interview. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [dispatch, form.email, form.name, form.phone, form.role, parsedText, resumeFile, router, validateForm],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
          >
            ← Back to dashboard
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Start a new interview</h1>
            <p className="text-slate-300">
              Upload the candidate&apos;s resume, verify contact details, and launch the interview. Crisp will handle
              question generation and scoring automatically.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-white">Resume upload</label>
              <p className="text-xs text-slate-400">PDF or DOCX only. We&apos;ll extract contact details automatically.</p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/70 px-6 py-10 text-center transition hover:border-slate-500">
                <Upload className="h-8 w-8 text-indigo-300" />
                <div className="text-sm text-slate-300">
                  {resumeFile ? (
                    <>
                      <p className="font-medium text-white">{resumeFile.name}</p>
                      <p className="text-xs text-slate-400">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-white">Drop resume here or click to browse</p>
                      <p className="text-xs text-slate-500">PDF, DOCX • up to 5MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {parsing && (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Parsing resume...
                </p>
              )}
              {errors.resume && <p className="text-xs text-red-400">{errors.resume}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Candidate name</span>
                <input
                  value={form.name}
                  onChange={(event) => handleFieldChange("name", event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="e.g. Priya Sharma"
                />
                {errors.name && <span className="text-xs text-red-400">{errors.name}</span>}
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Email</span>
                <input
                  value={form.email}
                  onChange={(event) => handleFieldChange("email", event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="candidate@example.com"
                />
                {errors.email && <span className="text-xs text-red-400">{errors.email}</span>}
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => handleFieldChange("phone", event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="+1 555 123 4567"
                />
                {errors.phone && <span className="text-xs text-red-400">{errors.phone}</span>}
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Role</span>
                <input
                  value={form.role}
                  onChange={(event) => handleFieldChange("role", event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Full Stack Engineer"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Launch interview
            </button>
            {submitError && <p className="text-xs text-red-400">{submitError}</p>}
          </section>

          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-medium text-white">Resume preview</h2>
            {parsedText ? (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
                {parsedText.slice(0, 4000) || "No extractable text found."}
                {parsedText.length > 4000 && <span className="block text-slate-500">…truncated…</span>}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Upload a resume to preview the extracted text and confirm contact information before starting the session.
              </p>
            )}
          </aside>
        </form>
      </div>
    </main>
  );
}
