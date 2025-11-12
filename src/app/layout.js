// src/app/layout.js
import { Poppins, IBM_Plex_Sans } from 'next/font/google';
import '../styles/globals.css';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer'; // <-- A LINHA QUE FALTAVA

// Configuração das fontes
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-poppins',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-ibm-plex-sans',
});

export const metadata = {
  title: 'DIAVI - Site Oficial',
  description: 'Site Oficial da DIAVI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${ibmPlexSans.variable}`}>
        <div style={{ display: 'flex' }}>
          <Sidebar />
          {/* Este estilo garante que o footer fique no final da página */}
          <main style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              {/* children (o conteúdo da página) é renderizado aqui dentro */}
              {children}
            </div>
            <Footer /> {/* Você já tinha colocado esta linha corretamente */}
          </main>
        </div>
      </body>
    </html>
  );
}