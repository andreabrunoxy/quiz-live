import Link from 'next/link';
export default function Home() {
  return (<main><h1>Quiz Live</h1>
    <p>Per partecipare, scansiona il QR code mostrato sullo schermo.</p>
    <div className="row"><Link href="/host"><button>Sono il presentatore</button></Link>
    <Link href="/editor"><button className="ghost">Modifica le domande</button></Link></div></main>);
}
