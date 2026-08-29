import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import GlobalProcessingIndicator from "@/app/components/GlobalProcessingIndicator";
import "./globals.css";
import DemoBanner from "@/app/components/DemoBanner";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "POS System",
  description:
    "Point of sale and back-office management for retail — sales terminal, inventory, purchasing, and reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <DemoBanner />
        {children}
        <GlobalProcessingIndicator />
      </body>
    </html>
  );
}
