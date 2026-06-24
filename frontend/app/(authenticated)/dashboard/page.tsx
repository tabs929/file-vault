import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { FileManager } from "@/components/files/file-manager";
import { Header } from "@/components/layout/header";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth-server";
import type { FileListResponse } from "@/lib/files";
import { planDisplayName } from "@/lib/format";

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

  const emailPrefix = user.email.split("@")[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight text-foreground">
            Welcome, {emailPrefix}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {planDisplayName(user.plan_name)} plan
          </p>
        </div>

        <FileManager initialData={fileData} />
      </main>
    </div>
  );
}
