import { Link } from 'react-router-dom';

import { useCart } from '@sepetakhq/storefront-kit/cart/CartProvider';
import { isPriceRange, lineKey } from '@sepetakhq/storefront-kit/lib/variants';
import { useToast } from '@sepetakhq/storefront-kit/ui/ToastProvider';
import { fmt, formatQty } from '@sepetakhq/storefront-kit/shared/format';
import { qtyLimits, stepQty } from '@sepetakhq/storefront-kit/shared/qty';

import { Img, SIZES } from '../ui/Img.jsx';
import { Tile } from './Tile.jsx';
import { cardNote, cardVeil, discountPct, quickAddState } from '../lib/copy.js';

/**
 * The design's card: a square picture (or initials) with the merchant's badge
 * in one corner and the discount in the other, then the category in small
 * caps, the name, the price and the note, and the full-width action at the
 * foot. The picture and the name are links; the action sits outside them so a
 * tap on it never navigates.
 */
export default function ProductCard({ p }) {
  const off = discountPct(p);
  const note = cardNote(p);
  const veil = cardVeil(p);
  const href = `/produk/${p.slug}`;

  return (
    <article className="bl-card" data-testid="product-card">
      <Link to={href} className="bl-card-media" tabIndex={-1} aria-hidden="true">
        <Img
          src={p.image}
          srcSet={p.image_srcset}
          sizes={SIZES.card}
          alt=""
          ratio="1/1"
          radius={0}
          fallback={<Tile label={p.name} tintKey={p.category_key} size={26} />}
        />
        {p.badge && <span className="bl-tag bl-tag-badge">{p.badge}</span>}
        {off > 0 && <span className="bl-tag bl-tag-sale">−{off}%</span>}
        {veil && (
          <span className="bl-card-veil">
            <span>{veil}</span>
          </span>
        )}
      </Link>
      <div className="bl-card-body">
        <div className="bl-card-info">
          {p.category_label && <span className="bl-card-cat">{p.category_label}</span>}
          <Link to={href} className="bl-card-name">
            {p.name}
          </Link>
          <Price p={p} off={off} />
          {note && <span className="bl-card-note">{note}</span>}
        </div>
        <div className="bl-card-foot">
          <QuickAdd p={p} />
        </div>
      </div>
    </article>
  );
}

function Price({ p, off }) {
  return (
    <div className="bl-card-price">
      <span className="bl-price">
        {isPriceRange(p) && <span className="bl-price-from">mulai </span>}
        {fmt(p.price)}
      </span>
      {off > 0 && <s className="bl-compare">{fmt(p.compare_at_price)}</s>}
    </div>
  );
}

/**
 * The action, by quickAddState:
 *   add      → the button adds one and confirms with a toast
 *   stepper  → −/+ around the qty already in the cart, + capped at `max`
 *   variants → the button opens the page; a card cannot pick a variant
 *   disabled → nothing; the picture's veil already says why
 */
export function QuickAdd({ p }) {
  const cart = useCart();
  // The kit's context value is the function itself, not an object holding it.
  const showToast = useToast();
  const key = lineKey({ productId: p.id, variantId: null });
  const line = cart.items.find((it) => lineKey(it) === key);
  const qty = line?.qty ?? 0;
  const state = quickAddState(p, qty);

  if (state.kind === 'variants') {
    return (
      <Link to={`/produk/${p.slug}`} className="bl-card-act is-outline" aria-label={`Pilih varian ${p.name}`}>
        Pilih varian
      </Link>
    );
  }
  if (state.kind === 'disabled') return null;
  if (state.kind === 'add') {
    const label = p.preorder ? 'Pre-order' : 'Tambah';
    return (
      <button
        type="button"
        className="bl-card-act"
        aria-label={`${label} ${p.name} ke keranjang`}
        onClick={() => {
          cart.add(p, 1, null);
          showToast(`${p.name} masuk keranjang`);
        }}
      >
        {p.preorder ? 'Pre-order' : 'Tambah ke keranjang'}
      </button>
    );
  }
  return (
    <div className="bl-stepper" role="group" aria-label={`Jumlah ${p.name}`}>
      <button type="button" aria-label="Kurangi" onClick={() => { const n = stepQty(qty, -1, qtyLimits(p)); return n === 0 ? cart.remove(key) : cart.setQty(key, n); }}>
        −
      </button>
      <output aria-live="polite">{formatQty(qty, qtyLimits(p).unit)}</output>
      <button type="button" aria-label="Tambah" disabled={stepQty(qty, 1, qtyLimits(p)) > state.max} onClick={() => cart.setQty(key, stepQty(qty, 1, qtyLimits(p)))}>
        +
      </button>
    </div>
  );
}
