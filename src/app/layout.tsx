import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JobFinder — Jobs at America's Top Companies",
  description:
    "Browse real job listings from 150+ leading US companies. Upload your resume to find the best-matching roles.",
};

import { ProfileProvider } from "@/context/ProfileContext";
import QuickApplyProfile from "@/components/QuickApplyProfile";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ProfileProvider>
          <Header />
          <QuickApplyProfile />
          <main>{children}</main>
        </ProfileProvider>
      </body>
    </html>
  );
}
