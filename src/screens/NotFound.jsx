import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main style={{ padding: '96px var(--bl-gutter) 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div aria-hidden="true" style={{ fontFamily: 'var(--bl-display)', fontSize: 72, fontWeight: 700, lineHeight: 1, color: 'var(--bl-primary)' }}>
          404
        </div>
        <h1 style={{ margin: 0, fontSize: 32 }}>Halaman tidak ditemukan</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--bl-body)' }}>Tautannya mungkin sudah berubah. Mulai lagi dari beranda.</p>
        <Link to="/" className="bl-btn bl-btn-primary" style={{ marginTop: 8 }}>
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
