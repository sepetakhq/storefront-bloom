import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { qtyLimits } from '@sepetakhq/storefront-kit/shared/qty';

// An empty cart is enough for the notice: it sits above whatever the cart
// holds. The stepper tests fill it.
const cart = { isEmpty: true, setQty: vi.fn(), remove: vi.fn() };
let lines = [];
vi.mock('@sepetakhq/storefront-kit/cart/CartProvider', () => ({ useCart: () => cart }));
vi.mock('@sepetakhq/storefront-kit/cart/useCartLines', () => ({
  useCartLines: () => ({ lines, statuses: [], subtotal: 0, isLoading: false, hasBlockers: false, preorderLeadDays: 0 }),
}));
vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({ useConfig: () => ({ freeShipping: false }) }));

const { default: CartRoute } = await import('./CartRoute.jsx');
const { stockNotice } = await import('../lib/copy.js');

afterEach(cleanup);

function visit(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/keranjang', state }]}>
      <CartRoute />
    </MemoryRouter>,
  );
}

describe('CartRoute', () => {
  it('says why checkout sent the buyer back when stock changed', () => {
    visit({ stockChanged: true });
    expect(screen.getByRole('status').textContent).toBe(stockNotice({ stockChanged: true }));
  });

  it('words it differently when the code was already verified', () => {
    visit({ stockChanged: true, afterVerify: true });
    expect(screen.getByRole('status').textContent).toBe(stockNotice({ stockChanged: true, afterVerify: true }));
  });

  it('says nothing on an ordinary visit', () => {
    visit(undefined);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Keranjangmu masih kosong')).toBeTruthy();
  });
});

function line(qty, over = {}) {
  const product = { id: 'p1', slug: 'mawar', name: 'Mawar', price: 12000, stock: 5000, availability: 'available', ...over };
  return { key: 'p1:', item: { qty }, product, label: '', status: 'ok', available: 5000, preorder: false, lineTotal: 0, limits: qtyLimits(product) };
}

describe('CartRoute line stepper', () => {
  beforeEach(() => {
    cart.isEmpty = false;
    cart.setQty.mockClear();
    cart.remove.mockClear();
  });
  afterEach(() => {
    cart.isEmpty = true;
    lines = [];
  });

  it('prints a kg line in kg and steps it by its step', () => {
    lines = [line(1250, { unit: 'kg', qty_step: 250, qty_min: 500 })];
    visit(undefined);
    expect(screen.getByText('1,25 kg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah' }));
    expect(cart.setQty).toHaveBeenCalledWith('p1:', 1500);
    fireEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah' }));
    expect(cart.setQty).toHaveBeenCalledWith('p1:', 1000);
  });

  it('removes a kg line stepped below its minimum', () => {
    lines = [line(500, { unit: 'kg', qty_step: 250, qty_min: 500 })];
    visit(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Kurangi jumlah' }));
    expect(cart.remove).toHaveBeenCalledWith('p1:');
    expect(cart.setQty).not.toHaveBeenCalled();
  });

  it('keeps a piece line a bare number', () => {
    lines = [line(2)];
    visit(undefined);
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah jumlah' }));
    expect(cart.setQty).toHaveBeenCalledWith('p1:', 3);
  });
});
