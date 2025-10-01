import { SessionWorkspace } from "@/components/session/SessionWorkspace";

type SessionPageParams = Promise<{
  sessionId: string;
}>;

interface SessionPageProps {
  params: SessionPageParams;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  return <SessionWorkspace sessionId={decodeURIComponent(sessionId)} />;
}
