import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard — Vault",
};

import { VerificationBanner } from "@/components/dashboard/verification-banner";
import { FileManager } from "@/components/files/file-manager";
import { Header } from "@/components/layout/header";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth-server";
import type { FileListResponse } from "@/lib/files";

async function getFileList(sessionCookie: string): Promise<FileListResponse> {
  return apiFetch<FileListResponse>("/files/", {
    serverCookies: `session=${sessionCookie}`,
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/clear");
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value ?? "";
  const fileData = await getFileList(session);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {!user.email_verified && (
          <div className="mb-6">
            <VerificationBanner />
          </div>
        )}
        <FileManager
          initialData={fileData}
          userEmail={user.email}
          fullName={user.full_name}
          planName={user.plan_name}
          emailVerified={user.email_verified}
        />
      </main>
    </div>
  );
}
