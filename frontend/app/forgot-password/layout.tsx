import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password — Vault",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
