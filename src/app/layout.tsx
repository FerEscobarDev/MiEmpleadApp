import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/Toaster";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";

// Inter como familia de UI del Design System (design_system.md §2.4), expuesta
// como variable CSS --font-sans para que el tema de Tailwind la consuma.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MiEmpleadApp",
  description:
    "Control de salario, días trabajados, pagos adicionales, menús y tareas de una empleada doméstica en Colombia.",
  applicationName: "MiEmpleadApp",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MiEmpleadApp",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D9488",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
