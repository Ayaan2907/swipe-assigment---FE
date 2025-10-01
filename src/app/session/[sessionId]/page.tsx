import { SessionWorkspace } from "@/components/session/SessionWorkspace";

type SessionPageProps = {
  params: {
    sessionId: string;
  };
};

export default function SessionPage({ params }: SessionPageProps) {
  const sessionId = decodeURIComponent(params.sessionId);
  return <SessionWorkspace sessionId={sessionId} />;
}
