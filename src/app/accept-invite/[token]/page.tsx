import { Suspense } from "react";
import { AcceptInviteScreen } from "@/components/auth/AcceptInviteScreen";

export const metadata = { title: "Accept invitation — AmoorGo Ops" };

function Loading() {
  return <div role="status" aria-label="Loading" className="min-h-dvh bg-[#FDFBFC] dark:bg-[#0F0811]" />;
}

async function InviteToken({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInviteScreen token={token} />;
}

// With Cache Components, route params are runtime data, so reading them is wrapped in Suspense.
export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <InviteToken params={params} />
    </Suspense>
  );
}
