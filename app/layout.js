import "./globals.css";

export const metadata = {
  title: "Random Meeting — Where Belonging Happens",
  description: "A structured human interaction platform. Join time-bound rooms for genuine conversations, group prompts, and meaningful connections. No feeds, no followers — just real people.",
  keywords: "human connection, meaningful conversations, anonymous chat, group discussions, belonging",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
