// src/app/layout.js
import { Poppins, IBM_Plex_Sans } from 'next/font/google';
import '../styles/globals.css';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

// 1. Importe o DataProvider que criamos
import { DataProvider } from '../context/DataContext'; 

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
    <html lang="pt-BR"> {/* Alterado para pt-BR */}
      <body className={`${poppins.variable} ${ibmPlexSans.variable}`}>
        {/* 2. Envolva toda a estrutura com o DataProvider */}
        <DataProvider>
          <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ 
              flex: 1, 
              padding: '40px', 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: '100vh' // Garante que ocupe a altura toda
            }}>
              <div style={{ flex: 1 }}>
                {children}
              </div>
              <Footer />
            </main>
          </div>
        </DataProvider>
      </body>
    </html>
  );
}