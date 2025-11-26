import type { Metadata } from "next";
import { Lato, Chelsea_Market } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

const chelseaMarket = Chelsea_Market({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-chelsea",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Image Converter - Fast, Free Online Image Conversion",
  description:
    "Convert images to WebP, AVIF, JPEG, PNG and more. Bulk image conversion with advanced compression settings. Free, fast, and secure.",
  keywords: [
    "image converter",
    "webp converter",
    "avif converter",
    "image compression",
    "bulk image converter",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${lato.variable} ${chelseaMarket.variable} antialiased min-h-screen bg-background font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-14 items-center justify-between mx-auto px-4 md:px-6">
                <div className="flex items-center">
                  <a className="mr-6 flex items-center space-x-2" href="/">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    <span className="font-bold font-heading text-lg">Image Converter</span>
                  </a>
                </div>
                <div className="flex items-center space-x-4">
                  <nav className="flex items-center space-x-6 text-sm font-medium hidden md:flex">
                    <a
                      className="transition-colors hover:text-foreground/80 text-foreground/60"
                      href="/api/convert"
                      target="_blank"
                      rel="noopener"
                    >
                      API
                    </a>
                    <a
                      className="transition-colors hover:text-foreground/80 text-foreground/60"
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub
                    </a>
                  </nav>
                  <ModeToggle />
                </div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t py-6 md:py-0">
              <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row mx-auto px-4 md:px-6">
                <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                  Built with{" "}
                  <a
                    href="https://nextjs.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4"
                  >
                    Next.js
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://bun.sh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4"
                  >
                    Bun
                  </a>
                  . All conversions are done locally. Files are automatically deleted after 15
                  minutes.
                </p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
