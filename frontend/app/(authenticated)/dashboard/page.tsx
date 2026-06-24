import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentUser } from "@/lib/auth-server";
import { formatBytes, planDisplayName } from "@/lib/format";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/clear");
  }

  const emailPrefix = user.email.split("@")[0];
  const usedPercent =
    user.quota_bytes > 0
      ? Math.min(100, (user.used_bytes / user.quota_bytes) * 100)
      : 0;

  const stats = [
    { label: "Plan", value: planDisplayName(user.plan_name) },
    { label: "Used", value: formatBytes(user.used_bytes) },
    { label: "Quota", value: formatBytes(user.quota_bytes) },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight text-foreground">
            Welcome, {emailPrefix}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your storage at a glance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-medium">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6 border-border">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Storage used</span>
              <span className="text-muted-foreground">
                {formatBytes(user.used_bytes)} of {formatBytes(user.quota_bytes)}
              </span>
            </div>
            <Progress value={usedPercent} />
            <p className="text-sm text-muted-foreground">
              File upload coming in the next build.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
