import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { useHome } from '@sepetakhq/storefront-kit/hooks/queries';
import { qk } from '@sepetakhq/storefront-kit/api/queryKeys';
import { serverNow } from '@sepetakhq/storefront-kit/api/client';

import ProductCard from '../components/ProductCard.jsx';
import { Tile } from '../components/Tile.jsx';
import { Img, SIZES } from '../ui/Img.jsx';
import Icon from '../ui/Icon.jsx';
import { CountdownCells } from '../ui/Countdown.jsx';
import { EmptyState, ErrorState, ProductGridSkeleton, Skeleton } from '../ui/states.jsx';
import {
  HERO_INTERVAL_MS,
  bannerTheme,
  categorySpec,
  featureMark,
  headlineParts,
  heroChips,
  heroSlides,
  nextSlide,
  sectionText,
  showCountdown,
} from '../lib/copy.js';

/** Products beyond which the carousel earns its arrows. */
export const RAIL_ARROWS_AFTER = 4;
/** Products a campaign panel shows: one row of cards on a wide screen. */
export const CAMPAIGN_CARDS = 4;

/** The home page is the section list the merchant published, in order. */
export default function HomeRoute() {
  const { data, isPending, isError, error, refetch } = useHome();

  if (isPending) return <HomeSkeleton />;
  if (isError) {
    return (
      <main className="bl-wrap" style={{ paddingTop: 60 }}>
        <ErrorState error={error} onRetry={refetch} />
      </main>
    );
  }
  const sections = (data?.sections ?? []).filter(renders);
  if (sections.length === 0) return <EmptyHome />;
  return (
    <main>
      <Sections sections={sections} />
    </main>
  );
}

/**
 * A published section list, drawn in order. Shared with the About page, whose
 * sections the merchant edits on the same backoffice screen.
 */
export function Sections({ sections }) {
  return sections.filter(renders).map((sec, i) => <Section key={sec.id ?? i} sec={sec} />);
}

/** Whether a section has anything to draw; an empty one is skipped. */
export function renders(sec) {
  switch (sec?.type) {
    case 'hero':
      return Boolean(sec.hero?.title);
    case 'features':
      return Boolean(sec.features?.items?.length);
    case 'cats':
      return Boolean(sec.cats?.length);
    case 'campaign':
      return Boolean(sec.campaign);
    case 'grid':
    case 'carousel':
      return Boolean(sec.grid?.products?.length);
    case 'story':
      return Boolean(sec.story?.title);
    case 'banner':
      return Boolean(sec.banner?.text);
    default:
      // A type this bundle predates: skipped, the way the resolver skips one
      // it does not know.
      return false;
  }
}

function Section({ sec }) {
  switch (sec.type) {
    case 'hero':
      return <Hero hero={sec.hero} />;
    case 'features':
      return <Features features={sec.features} />;
    case 'cats':
      return <Categories cats={sec.cats} />;
    case 'campaign':
      return <Campaign campaign={sec.campaign} />;
    case 'grid':
      return <Grid grid={sec.grid} />;
    case 'carousel':
      return <Rail grid={sec.grid} />;
    case 'story':
      return <Story story={sec.story} />;
    case 'banner':
      return <Banner banner={sec.banner} />;
    default:
      return null;
  }
}

/** A section heading in the design's serif, with its "see all" link. */
function Head({ title, seeAll, to = '/katalog' }) {
  return (
    <div className="bl-head">
      <h2 className="bl-h2">{title}</h2>
      {seeAll && (
        <Link to={to} className="bl-link-arrow">
          {seeAll}
          <Icon name="arrow" size={15} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

/* --- hero ---------------------------------------------------------------- */

function Hero({ hero }) {
  const { brand, copy, freeShipping } = useConfig();
  const stats = (brand.heroStats ?? []).filter((s) => s?.value);
  const chips = heroChips(brand.sections, copy, freeShipping);
  const secondary = sectionText(brand.sections, 'hero_secondary_cta');

  return (
    <section className="bl-hero">
      <div className="bl-hero-row">
        <div className="bl-hero-copy">
          {brand.hero_eyebrow && <span className="bl-eyebrow">{brand.hero_eyebrow}</span>}
          {/* `em` is the backoffice's "Penekanan": words that follow the title,
              drawn on their own line in the rose italic. */}
          <h1>
            <span>{hero.title}</span>
            {hero.em && <em>{hero.em}</em>}
          </h1>
          {hero.sub && <p className="bl-hero-sub">{hero.sub}</p>}
          <div className="bl-hero-actions">
            <Link to="/katalog" className="bl-btn bl-btn-primary">
              {hero.cta || 'Belanja sekarang'}
              <Icon name="arrow" size={16} strokeWidth={2} />
            </Link>
            {secondary && (
              <Link to="/lacak" className="bl-btn bl-btn-glass">
                {secondary}
              </Link>
            )}
          </div>
          {chips.length > 0 && (
            <ul className="bl-hero-chips">
              {chips.map((c) => (
                <li key={c.key}>
                  <span className="bl-hero-chip-icon" aria-hidden="true">
                    <Icon name={c.icon} size={22} />
                  </span>
                  <span className="bl-hero-chip-text">
                    <b>{c.label}</b>
                    {c.note && <span>{c.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {stats.length > 0 && (
            <dl className="bl-hero-stats">
              {stats.map((s, i) => (
                <div key={i}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <HeroGallery images={brand.heroImages} />
      </div>
    </section>
  );
}

/**
 * The shop's hero pictures, one at a time. Rotates every few seconds when
 * there is more than one, unless the buyer asked for reduced motion or is
 * pointing at or focused inside it; the dots switch by hand either way.
 */
export function HeroGallery({ images }) {
  const slides = heroSlides(images);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (n < 2 || paused || still) return undefined;
    const id = setInterval(() => setIndex((i) => nextSlide(i, n)), HERO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [n, paused]);

  const at = n ? index % n : 0;
  const picture = slides[at];

  return (
    <div
      className="bl-hero-media"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Img
        key={picture?.url ?? 'none'}
        src={picture?.url}
        srcSet={picture?.srcset}
        sizes={SIZES.band}
        alt={picture?.alt ?? ''}
        ratio="auto"
        priority
        radius={0}
        style={{ position: 'absolute', inset: 0, background: 'transparent' }}
        fallback={<EmptyPicture />}
      />
      {n > 1 && (
        <div className="bl-hero-dots" role="group" aria-label="Foto">
          {slides.map((s, i) => (
            <button
              key={s.url}
              type="button"
              aria-label={s.alt || `Foto ${i + 1}`}
              aria-pressed={i === at}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** What an image slot shows before the merchant uploads one. */
function EmptyPicture({ size = 120 }) {
  return (
    <div aria-hidden="true" className="bl-empty-picture">
      <Icon name="flower" size={size} strokeWidth={0.8} />
    </div>
  );
}

/* --- features ----------------------------------------------------------- */

function Features({ features }) {
  const items = features.items.slice(0, 8);
  return (
    <section className="bl-band bl-band-features" aria-label={features.title || undefined}>
      <div className="bl-band-inner">
        {features.title && <h2 className="bl-h2 bl-center">{features.title}</h2>}
        {/* data-n lets the stylesheet lay out by count (1–8), so no count
            leaves a lone item on its own row. */}
        <ul className="bl-features" data-n={items.length}>
          {items.map((it, i) => {
            const mark = featureMark(it.mark);
            return (
              <li key={i} className="bl-feature">
                <span className="bl-feature-mark" aria-hidden="true">
                  {mark.icon ? <Icon name={mark.icon} size={22} /> : mark.text}
                </span>
                <span className="bl-feature-copy">
                  <b>{it.title}</b>
                  {it.body && <span>{it.body}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* --- categories --------------------------------------------------------- */

function Categories({ cats }) {
  const { brand } = useConfig();
  return (
    <section id="kategori" className="bl-band" style={{ scrollMarginTop: 90 }}>
      <div className="bl-band-inner">
        <div className="bl-title-center">
          <h2 className="bl-h2">{sectionText(brand.sections, 'cats_heading')}</h2>
          <span className="bl-divider" aria-hidden="true">
            <Icon name="heart" size={12} />
          </span>
        </div>
        <div className="bl-cats">
          {cats.map((c) => (
            <Link key={c.key} to={`/katalog?cat=${encodeURIComponent(c.key)}`} className="bl-cat">
              <span className="bl-cat-media">
                <Img
                  src={c.image}
                  srcSet={c.image_srcset}
                  sizes={SIZES.categoryTile}
                  alt=""
                  ratio="auto"
                  radius={0}
                  style={{ position: 'absolute', inset: 0, background: 'transparent' }}
                  fallback={<Tile label={c.label} tintKey={c.key} size={30} />}
                />
              </span>
              <span className="bl-cat-body">
                <span className="bl-cat-text">
                  <b>{c.label}</b>
                  {c.subtitle && <span>{c.subtitle}</span>}
                  {!c.subtitle && categorySpec(c) && <span>{categorySpec(c)}</span>}
                </span>
                <span className="bl-cat-go" aria-hidden="true">
                  <Icon name="arrow" size={15} strokeWidth={2} />
                </span>
              </span>
            </Link>
          ))}
        </div>
        <div className="bl-center">
          <Link to="/katalog" className="bl-link-arrow">
            {sectionText(brand.sections, 'grid_see_all')}
            <Icon name="arrow" size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --- product grid and carousel ------------------------------------------ */

/** The design's tinted band: the heading and its button beside the cards. */
function Grid({ grid }) {
  const { brand } = useConfig();
  return (
    <section className="bl-band bl-band-tint">
      <div className="bl-band-inner bl-grid-band">
        <div className="bl-grid-lead">
          <h2 className="bl-h2 bl-h2-lg">{grid.title || 'Produk pilihan'}</h2>
          <Link to="/katalog" className="bl-btn bl-btn-primary">
            {sectionText(brand.sections, 'grid_see_all')}
            <Icon name="arrow" size={15} strokeWidth={2} />
          </Link>
        </div>
        <div className="bl-grid-cards">
          {grid.products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Rail({ grid }) {
  const { brand } = useConfig();
  const track = useRef(null);
  const scroll = (dir) => {
    const el = track.current;
    if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: smooth ? 'smooth' : 'auto' });
  };
  const arrows = grid.products.length > RAIL_ARROWS_AFTER;

  return (
    <section className="bl-band">
      <div className="bl-band-inner">
        <Head title={grid.title || 'Produk pilihan'} seeAll={sectionText(brand.sections, 'grid_see_all')} />
        <div className="bl-rail">
          {arrows && (
            <>
              <button type="button" className="bl-rail-arrow prev" aria-label="Sebelumnya" onClick={() => scroll(-1)}>
                <Icon name="prev" size={18} strokeWidth={2} />
              </button>
              <button type="button" className="bl-rail-arrow next" aria-label="Berikutnya" onClick={() => scroll(1)}>
                <Icon name="next" size={18} strokeWidth={2} />
              </button>
            </>
          )}
          <ul ref={track} className="bl-rail-track">
            {grid.products.map((p) => (
              <li key={p.id} className="bl-rail-item">
                <ProductCard p={p} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --- story -------------------------------------------------------------- */

/**
 * The design's forest band: the shop's portrait beside the story. On the
 * About page itself the button would link to the page it sits on, so it goes.
 */
function Story({ story }) {
  const { brand } = useConfig();
  const { pathname } = useLocation();
  const portrait = brand.aboutImage;
  const eyebrow = sectionText(brand.sections, 'story_eyebrow');

  return (
    <section className="bl-story">
      {portrait?.url && (
        <div className="bl-story-media">
          <Img
            src={portrait.url}
            srcSet={portrait.srcset}
            sizes={SIZES.band}
            alt={portrait.alt ?? ''}
            ratio="auto"
            radius={0}
            style={{ position: 'absolute', inset: 0, background: 'transparent' }}
            fallback={<EmptyPicture />}
          />
        </div>
      )}
      <div className="bl-story-copy">
        {eyebrow && <span className="bl-eyebrow is-light">{eyebrow}</span>}
        <h2>{story.title}</h2>
        {story.text && <p>{story.text}</p>}
        {pathname !== '/tentang' && (
          <Link to="/tentang" className="bl-btn bl-btn-light">
            {sectionText(brand.sections, 'story_cta')}
            <Icon name="arrow" size={15} strokeWidth={2} />
          </Link>
        )}
      </div>
    </section>
  );
}

/* --- campaign ----------------------------------------------------------- */

/**
 * The design's forest sale card on a blush band: the promotion's badge and
 * name, the big line, the countdown and the button, beside a scrolling row of
 * its products. The ghost figure behind it is the percentage, when there is one.
 */
function Campaign({ campaign }) {
  const qc = useQueryClient();
  const { brand } = useConfig();
  const products = (campaign.products ?? []).slice(0, CAMPAIGN_CARDS);
  // A countdown only for a real, near deadline: none for a promotion with no
  // end date, one already past, or one weeks away.
  const ticking = showCountdown(campaign.ends_at, serverNow());
  const { pre, accent } = headlineParts(campaign);
  const title = String(campaign.title ?? '').trim();
  const pct = Number(campaign.discount_value ?? 0);
  const ghost = campaign.discount_type === 'percentage' && pct > 0 ? `${pct}%` : '';
  // The design's order: the promotion's name as the heading, the big line
  // under it. Without a name (or a name that is the line), the line heads it.
  const named = Boolean(title) && title !== pre + accent;
  const line = (
    <>
      {pre}
      {accent && <em>{accent}</em>}
    </>
  );

  return (
    <section className="bl-band bl-band-blush">
      <div className="bl-band-inner bl-campaign-band">
        <div className="bl-campaign">
          {ghost && (
            <span className="bl-campaign-ghost" aria-hidden="true">
              {ghost}
            </span>
          )}
          {campaign.badge && <span className="bl-badge">{campaign.badge}</span>}
          <h2>{named ? title : line}</h2>
          {named && pre + accent && <p className="bl-campaign-line">{line}</p>}
          {ticking && (
            <CountdownCells
              until={campaign.ends_at}
              label={sectionText(brand.sections, 'countdown_label')}
              onExpire={() => qc.invalidateQueries({ queryKey: qk.home })}
            />
          )}
          {products.length > 0 && (
            <Link to="/katalog?sale=1" className="bl-btn bl-btn-light">
              {sectionText(brand.sections, 'campaign_cta')}
              <Icon name="arrow" size={15} strokeWidth={2} />
            </Link>
          )}
        </div>
        {products.length > 0 && (
          <ul className="bl-campaign-track">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard p={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* --- banner ------------------------------------------------------------- */

function Banner({ banner }) {
  const theme = bannerTheme(banner.bg);
  return (
    <section className={theme.className}>
      <div className="bl-band-inner bl-banner-row">
        <p>{banner.text}</p>
        {banner.cta && (
          <Link to="/katalog" className={theme.button}>
            {banner.cta}
          </Link>
        )}
      </div>
    </section>
  );
}

/* --- states ------------------------------------------------------------- */

function EmptyHome() {
  return (
    <main className="bl-wrap" style={{ paddingTop: 60 }}>
      <EmptyState
        title="Toko sedang disiapkan"
        body="Halaman depan belum diisi. Katalognya sudah bisa dilihat."
        action={
          <Link to="/katalog" className="bl-btn bl-btn-primary">
            Lihat katalog
          </Link>
        }
      />
    </main>
  );
}

function HomeSkeleton() {
  return (
    <main aria-busy="true">
      <div className="bl-hero bl-shimmer" style={{ minHeight: 'clamp(380px, 46vw, 620px)' }} />
      <div className="bl-wrap" style={{ paddingTop: 40, display: 'grid', gap: 16 }}>
        <Skeleton height={34} width={240} />
        <ProductGridSkeleton count={4} />
      </div>
    </main>
  );
}
