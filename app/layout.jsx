import Providers from './providers';
import '../styles/globals.css';

export const metadata = {
  title: 'Portal Comprobantes Recibidos (SRI)',
  description: 'Sistema de gestión de facturas del Grupo Torres',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
