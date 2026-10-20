import './globals.css';
export const metadata = { title: 'Quiz Live', description: 'Quiz dal vivo con classifica' };
export default function RootLayout({ children }) {
  return (<html lang="it"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>{children}</body></html>);
}
