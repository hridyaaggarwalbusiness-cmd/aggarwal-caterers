import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import './App.css';
import AdminApp from './AdminApp';
import {
  createCateringInquiry,
  subscribeToPublicSiteSettings,
  subscribeToMenus,
  subscribeToTestimonials,
  subscribeToGallery,
  subscribeToFaqs,
  submitPublicReview,
} from './firebase';

const STORAGE_KEY = 'aggarwal_caterers_inquiries';
const DRAFT_KEY = 'aggarwal_caterers_draft';

const eventTypes = [
  'Wedding',
  'Engagement',
  'Birthday',
  'Corporate event',
  'House party',
  'Religious function',
  'Other',
];

const showcaseEvents = [
  {
    title: 'Weddings',
    tag: 'Celebration',
    text: 'Elegant multi-course menus, live stations, and calm floor management for big family celebrations.',
    image:
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Corporate Dining',
    tag: 'Corporate',
    text: 'Sharp, punctual service for office lunches, conferences, launches, and leadership gatherings.',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Private Celebrations',
    tag: 'Private',
    text: 'Premium home events with thoughtful portions, refined presentation, and guest-first hospitality.',
    image:
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80',
  },
];

const defaultFaqs = [
  {
    question: 'Do you cater outside Delhi NCR?',
    answer: 'Yes, for larger events we travel beyond our core service area — share your location in the inquiry form and we will confirm feasibility and logistics.',
  },
  {
    question: 'Is there a minimum guest count?',
    answer: 'Most packages work best from 50 guests upward, but we also plan smaller private gatherings — send your guest count and we will advise the right format.',
  },
  {
    question: 'Can I customize a menu package?',
    answer: 'Absolutely. Every package can be adjusted — add or remove dishes, include live counters, or blend two packages together based on your preference.',
  },
  {
    question: 'How far in advance should I book?',
    answer: 'We recommend booking at least 3-4 weeks ahead for weddings and large events, though we do accommodate shorter timelines when our calendar allows.',
  },
  {
    question: 'Do you accommodate Jain food or other dietary needs?',
    answer: 'Yes, Jain food, no-onion-no-garlic, and other dietary preferences can be noted in the additional requirements field of your inquiry.',
  },
];

const NONE_MENU_ID = '__none__';

const initialForm = {
  name: '',
  phone: '',
  email: '',
  eventType: 'Wedding',
  startDate: '',
  endDate: '',
  preferredTime: '',
  location: '',
  guests: '',
  budget: '',
  selectedMenuId: '',
  selectedItems: [],
  requirements: '',
};

const initialReviewForm = {
  name: '',
  eventType: '',
  rating: 5,
  text: '',
};

const defaultSiteSettings = {
  businessPhone: '+91 99999 99999',
  businessEmail: 'info@aggarwalcaterers.com',
  serviceArea: 'Delhi NCR',
  bookingStatus: 'Open',
  responseWindow: '24 hours',
  announcement: '',
  googleRating: '',
  googleReviewCount: '',
};

function saveInquiry(inquiry) {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const next = [inquiry, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('aggarwal:inquiry-created', { detail: inquiry }));
}

function createReferenceId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AC-${stamp}-${suffix}`;
}

function getDishItems(menuItems) {
  return (menuItems || []).filter((e) => e.type !== 'section');
}

function countDishes(menu) {
  return getDishItems(menu.items).length;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(form) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    /* ignore quota errors */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* ─── SCROLL PROGRESS BAR ─────────────────────────────── */
function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="scroll-progress-track" aria-hidden="true">
      <div className="scroll-progress-fill" style={{ width: `${progress}%` }} />
    </div>
  );
}

/* ─── ANIMATED COUNTER ────────────────────────────────── */
function AnimatedCounter({ value, suffix = '', duration = 1400 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const numeric = parseFloat(String(value).replace(/[^\d.]/g, '')) || 0;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplay(Math.round(numeric * eased));
              if (progress < 1) requestAnimationFrame(tick);
              else setDisplay(numeric);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <strong ref={ref}>
      {display}
      {suffix}
    </strong>
  );
}

/* ─── SCROLL REVEAL WRAPPER ───────────────────────────── */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── LIGHTBOX (used for showcase events + gallery) ──── */
function Lightbox({ image, title, caption, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!image) return null;

  return (
    <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lightbox-close" type="button" onClick={onClose} aria-label="Close">✕</button>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={image} alt={title || 'Event photo'} />
        {(title || caption) && (
          <div className="lightbox-caption">
            {title && <h3>{title}</h3>}
            {caption && <p>{caption}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── STAR RATING (read-only display) ─────────────────── */
function StarRating({ rating = 5 }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="star-rating" aria-label={`${rating} out of 5 stars`}>
      {stars.map((s) => (
        <span key={s} className={s <= Math.round(rating) ? 'star filled' : 'star'}>★</span>
      ))}
    </div>
  );
}

/* ─── STAR RATING INPUT (interactive, for the review form) ── */
function StarRatingInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="star-rating-input" role="radiogroup" aria-label="Rating">
      {stars.map((s) => {
        const filled = hovered ? s <= hovered : s <= value;
        return (
          <button
            type="button"
            key={s}
            className={`star-input-btn ${filled ? 'filled' : ''}`}
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
            aria-checked={value === s}
            role="radio"
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

/* ─── GALLERY SECTION ─────────────────────────────────── */
function GallerySection({ images, onOpen }) {
  if (!images || images.length === 0) return null;

  return (
    <section className="section gallery-section" id="gallery">
      <Reveal>
        <div className="section-label"><span>Our Work</span></div>
        <h2 className="section-title">A glimpse into<br /><em>past celebrations.</em></h2>
        <p className="section-body" style={{ marginBottom: '40px' }}>
          Real events, real setups. Tap any photo to view it larger.
        </p>
      </Reveal>
      <div className="gallery-grid">
        {images.map((img, i) => (
          <Reveal key={img.docId || i} delay={(i % 8) * 60} className="gallery-tile-wrap">
            <button
              type="button"
              className="gallery-tile"
              onClick={() => onOpen(img)}
              aria-label={img.caption || 'View event photo'}
            >
              <img src={img.url} alt={img.caption || 'Aggarwal Caterers event'} loading="lazy" />
              <span className="gallery-tile-overlay">
                <span>🔍 View</span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── FAQ ACCORDION ───────────────────────────────────── */
function FaqAccordion({ faqs }) {
  const [openIndex, setOpenIndex] = useState(0);
  const list = faqs && faqs.length ? faqs : defaultFaqs;

  return (
    <section className="section faq-section" id="faq">
      <Reveal>
        <div className="faq-header">
          <div className="section-label"><span>Common Questions</span></div>
          <h2 className="section-title">Everything you're<br />wondering, <em>answered.</em></h2>
        </div>
      </Reveal>
      <Reveal delay={100} className="faq-list-wrap">
        <div className="faq-list">
          {list.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div className={`faq-item ${isOpen ? 'open' : ''}`} key={i}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenIndex(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  <span className="faq-icon">{isOpen ? '−' : '+'}</span>
                </button>
                <div className="faq-answer" style={{ maxHeight: isOpen ? '400px' : '0px' }}>
                  <p>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── REVIEW SYSTEM (public — view + submit) — sits at the very
     end of the site, just before the footer ───────────────── */
function ReviewSystem({ reviews, googleRating, googleReviewCount }) {
  const [form, setForm] = useState(initialReviewForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSubmitError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Please enter your name.';
    if (!form.text.trim() || form.text.trim().length < 10) {
      nextErrors.text = 'Please share a few words about your experience (min. 10 characters).';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await submitPublicReview(form);
      setSubmitted(true);
      setForm(initialReviewForm);
      setErrors({});
    } catch (error) {
      console.error('Review submission failed:', error);
      setSubmitError('We could not submit your review right now. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approvedReviews = (reviews || []).filter((r) => r.status !== 'Pending');

  return (
    <section className="section reviews-section" id="reviews">
      <Reveal>
        <div className="reviews-header">
          <div>
            <div className="section-label"><span>Client Reviews</span></div>
            <h2 className="section-title">Families and teams<br /><em>who trusted us.</em></h2>
            <p className="section-body">
              Real feedback from real events. Had a good experience with us? We'd love to hear about it.
            </p>
          </div>
          {googleRating && (
            <div className="google-rating-badge">
              <StarRating rating={Number(googleRating)} />
              <strong>{googleRating} / 5</strong>
              {googleReviewCount && <span>{googleReviewCount} Google reviews</span>}
            </div>
          )}
        </div>
      </Reveal>

      {/* Existing approved reviews */}
      {approvedReviews.length > 0 && (
        <div className="testimonials-grid">
          {approvedReviews.map((t, i) => (
            <Reveal key={t.docId || i} delay={i * 90}>
              <article className="testimonial-card">
                <StarRating rating={t.rating || 5} />
                <p className="testimonial-text">“{t.text}”</p>
                <div className="testimonial-footer">
                  <div className="testimonial-avatar" aria-hidden="true">
                    {(t.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong>{t.name}</strong>
                    {t.eventType && <span>{t.eventType}</span>}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}

      {approvedReviews.length === 0 && (
        <Reveal>
          <p className="reviews-empty">
            Be the first to share your experience with Aggarwal Caterers.
          </p>
        </Reveal>
      )}

      {/* Submit a review form */}
      <Reveal delay={120}>
        <div className="review-form-card">
          <h3>Share your experience</h3>
          <p className="review-form-subtitle">
            Your review will appear here once our team reviews it.
          </p>

          {submitted ? (
            <div className="review-thanks" role="status">
              <strong>✓ Thank you for your feedback!</strong>
              <span>Your review has been submitted and will appear here once approved.</span>
            </div>
          ) : (
            <form className="review-form" onSubmit={handleSubmit} noValidate>
              <div className="review-form-grid">
                <label>
                  Your name
                  <input
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Your name"
                  />
                  {errors.name && <span className="error">{errors.name}</span>}
                </label>

                <label>
                  Event type (optional)
                  <select
                    value={form.eventType}
                    onChange={(e) => updateField('eventType', e.target.value)}
                  >
                    <option value="">Select event type</option>
                    {eventTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="review-rating-label">
                Your rating
                <StarRatingInput value={form.rating} onChange={(v) => updateField('rating', v)} />
              </label>

              <label>
                Your review
                <textarea
                  value={form.text}
                  onChange={(e) => updateField('text', e.target.value)}
                  placeholder="Tell us about your event, the food, and the service..."
                  rows="4"
                />
                {errors.text && <span className="error">{errors.text}</span>}
              </label>

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit Review →'}
              </button>
              {submitError && <p className="submit-error" role="alert">{submitError}</p>}
            </form>
          )}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── FLOATING ACTIONS: WHATSAPP / CALL / BACK-TO-TOP ─── */
function FloatingActions({ phone, whatsappHref }) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="floating-actions">
      {showTop && (
        <button className="fab fab-top" onClick={scrollTop} aria-label="Back to top" type="button">
          ↑
        </button>
      )}
      <a className="fab fab-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.44 1.32 4.94L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.13c-.24.68-1.4 1.32-1.93 1.36-.5.05-1.02.24-3.43-.72-2.9-1.16-4.76-4.13-4.9-4.33-.14-.19-1.16-1.55-1.16-2.96 0-1.4.73-2.09 1-2.38.24-.27.53-.34.71-.34h.5c.16 0 .38-.06.59.45.24.57.79 1.98.86 2.13.07.14.11.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.53.72 1.79.85.27.14.44.2.51.31.07.11.07.63-.17 1.31z" />
        </svg>
      </a>
      <a className="fab fab-call" href={`tel:${phone}`} aria-label="Call now">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02l-2.2 2.2z" />
        </svg>
      </a>
    </div>
  );
}

/* ─── STICKY MOBILE CTA BAR ───────────────────────────── */
function StickyMobileCta({ phoneHref }) {
  return (
    <div className="mobile-cta-bar">
      <a className="mobile-cta-btn mobile-cta-call" href={phoneHref}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02l-2.2 2.2z" />
        </svg>
        Call
      </a>
      <a className="mobile-cta-btn mobile-cta-inquiry" href="#inquiry">
        Send Inquiry →
      </a>
    </div>
  );
}

/* ─── MENU DETAIL PAGE (full-screen overlay) ─────────── */
function MenuDetailPage({ menu, selectedItems, onToggleItem, onSelectAll, onClose }) {
  const dishes = getDishItems(menu.items);
  const allSelected = dishes.length > 0 && dishes.every((d) => selectedItems.includes(d.name));

  // Prevent background scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="menu-detail-overlay" role="dialog" aria-modal="true" aria-label={`${menu.name} items`}>
      {/* Header */}
      <div className="menu-detail-header">
        <button className="menu-detail-back" type="button" onClick={onClose}>
          ← Back
        </button>
        <div className="menu-detail-title-wrap">
          <span className="menu-detail-tag">{menu.tag || 'Package'}</span>
          <h2 className="menu-detail-title">{menu.name}</h2>
          {menu.description && <p className="menu-detail-desc">{menu.description}</p>}
        </div>
        <div className="menu-detail-meta">
          <span>{dishes.length} dishes</span>
          <span>{selectedItems.length} selected</span>
        </div>
      </div>

      {/* Select all / none */}
      <div className="menu-detail-toolbar">
        <p className="menu-detail-hint">
          All dishes are included by default. Uncheck anything you'd like to remove.
        </p>
        <button
          type="button"
          className="menu-detail-selectall"
          onClick={onSelectAll}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {/* Items grouped by sections */}
      <div className="menu-detail-body">
        {(menu.items || []).map((entry, idx) => {
          if (entry.type === 'section') {
            return (
              <div className="menu-detail-section-heading" key={`s-${idx}`}>
                {entry.name}
              </div>
            );
          }
          const checked = selectedItems.includes(entry.name);
          return (
            <label className={`menu-detail-item ${checked ? 'checked' : ''}`} key={`i-${idx}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleItem(entry.name)}
              />
              <span className="menu-detail-item-name">{entry.name}</span>
              {checked && <span className="menu-detail-item-tick">✓</span>}
            </label>
          );
        })}

        {dishes.length === 0 && (
          <p className="menu-detail-empty">No dishes have been added to this menu yet.</p>
        )}
      </div>

      {/* Done button */}
      <div className="menu-detail-footer">
        <span className="menu-detail-footer-count">
          {selectedItems.length} of {dishes.length} dishes selected
        </span>
        <button type="button" className="menu-detail-done btn btn-gold" onClick={onClose}>
          Done — use this selection
        </button>
      </div>
    </div>
  );
}

/* ─── MENU SKELETON (loading state) ───────────────────── */
function MenuSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div className="menu-item menu-item-skeleton" key={i} aria-hidden="true">
          <div className="skeleton-line skeleton-line-tag" />
          <div className="skeleton-line skeleton-line-title" />
          <div className="skeleton-line skeleton-line-desc" />
          <div className="skeleton-line skeleton-line-count" />
        </div>
      ))}
    </>
  );
}

function PublicSite() {
  const [form, setForm] = useState(() => {
    const draft = loadDraft();
    return draft ? { ...initialForm, ...draft, selectedItems: draft.selectedItems || [] } : initialForm;
  });
  const [errors, setErrors] = useState({});
  const [submittedInquiry, setSubmittedInquiry] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [menus, setMenus] = useState([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const [testimonials, setTestimonials] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [faqs, setFaqs] = useState([]);
  // The menu whose detail page is currently open (null = none open)
  const [detailMenuId, setDetailMenuId] = useState(null);
  // The showcase/gallery image currently open in the lightbox (null = none open)
  const [lightboxImage, setLightboxImage] = useState(null);
  // Whether the page has scrolled past the top (for navbar shrink)
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return subscribeToPublicSiteSettings(
      (snapshot) => {
        if (snapshot.exists()) {
          setSiteSettings({ ...defaultSiteSettings, ...snapshot.data() });
        }
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    return subscribeToMenus(
      (data) => {
        setMenus(data);
        setMenusLoading(false);
      },
      () => setMenusLoading(false)
    );
  }, []);

  useEffect(() => {
    return subscribeToTestimonials(setTestimonials, () => {});
  }, []);

  useEffect(() => {
    return subscribeToGallery(setGalleryImages, () => {});
  }, []);

  useEffect(() => {
    return subscribeToFaqs(setFaqs, () => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // When menus first load, pre-select the first real menu (unless a draft already set one)
  useEffect(() => {
    if (menus.length && !form.selectedMenuId) {
      const first = menus[0];
      setForm((current) => ({
        ...current,
        selectedMenuId: first.docId,
        selectedItems: getDishItems(first.items).map((item) => item.name),
      }));
    }
  }, [menus, form.selectedMenuId]);

  // Auto-save form draft to localStorage so a refresh doesn't lose progress
  useEffect(() => {
    if (submittedInquiry) return;
    const timeout = setTimeout(() => saveDraft(form), 400);
    return () => clearTimeout(timeout);
  }, [form, submittedInquiry]);

  const activeMenu = useMemo(
    () =>
      form.selectedMenuId === NONE_MENU_ID
        ? null
        : menus.find((m) => m.docId === form.selectedMenuId) || null,
    [menus, form.selectedMenuId]
  );

  const detailMenu = useMemo(
    () => menus.find((m) => m.docId === detailMenuId) || null,
    [menus, detailMenuId]
  );

  const selectedMenuName =
    form.selectedMenuId === NONE_MENU_ID
      ? 'To be decided'
      : activeMenu
      ? activeMenu.name
      : 'Not selected';

  const selectedItemsText = useMemo(() => {
    if (form.selectedMenuId === NONE_MENU_ID) return '—';
    if (!form.selectedItems.length) return 'None selected';
    const totalDishes = activeMenu ? getDishItems(activeMenu.items).length : 0;
    if (form.selectedItems.length === totalDishes) return 'Full menu';
    return `${form.selectedItems.length} of ${totalDishes} items`;
  }, [form.selectedItems, form.selectedMenuId, activeMenu]);

  const phoneHref = `tel:${siteSettings.businessPhone.replace(/[^\d+]/g, '')}`;
  const emailHref = `mailto:${siteSettings.businessEmail}`;
  const whatsappHref = `https://wa.me/${siteSettings.businessPhone.replace(/[^\d]/g, '')}`;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSubmitError('');
  };

  const selectMenu = (menuDocId) => {
    if (menuDocId === NONE_MENU_ID) {
      setForm((current) => ({
        ...current,
        selectedMenuId: NONE_MENU_ID,
        selectedItems: [],
      }));
      return;
    }
    const menu = menus.find((m) => m.docId === menuDocId);
    setForm((current) => ({
      ...current,
      selectedMenuId: menuDocId,
      selectedItems: getDishItems(menu?.items).map((item) => item.name),
    }));
    setSubmitError('');
  };

  const openDetail = (menuDocId) => {
    // If opening a different menu than currently selected, switch selection first
    if (menuDocId !== form.selectedMenuId && menuDocId !== NONE_MENU_ID) {
      selectMenu(menuDocId);
    }
    setDetailMenuId(menuDocId);
  };

  const closeDetail = () => setDetailMenuId(null);

  const toggleItem = (itemName) => {
    setForm((current) => {
      const has = current.selectedItems.includes(itemName);
      return {
        ...current,
        selectedItems: has
          ? current.selectedItems.filter((n) => n !== itemName)
          : [...current.selectedItems, itemName],
      };
    });
  };

  const handleSelectAll = () => {
    if (!detailMenu) return;
    const dishes = getDishItems(detailMenu.items);
    const allSelected = dishes.every((d) => form.selectedItems.includes(d.name));
    setForm((current) => ({
      ...current,
      selectedItems: allSelected ? [] : dishes.map((d) => d.name),
    }));
  };

  const validateForm = () => {
    const nextErrors = {};
    const phoneDigits = form.phone.replace(/\D/g, '');

    if (!form.name.trim()) nextErrors.name = 'Please enter your name.';
    if (phoneDigits.length < 10) nextErrors.phone = 'Enter a valid phone number.';
    if (!form.email.includes('@') || !form.email.includes('.')) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.startDate) nextErrors.startDate = 'Select the service start date.';
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      nextErrors.endDate = 'End date cannot be before the start date.';
    }
    if (!form.location.trim()) nextErrors.location = 'Add the event location.';
    if (!form.guests || Number(form.guests) < 10) {
      nextErrors.guests = 'Guest count should be at least 10.';
    }
    if (!form.budget || Number(form.budget) < 1000) {
      nextErrors.budget = 'Add an estimated budget.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    const inquiry = {
      id: createReferenceId(),
      status: 'New',
      createdAt: new Date().toISOString(),
      ...form,
      guests: Number(form.guests),
      budget: Number(form.budget),
      selectedMenuName:
        form.selectedMenuId === NONE_MENU_ID ? 'To be decided' : activeMenu?.name || '',
    };

    try {
      const savedInquiry = await createCateringInquiry(inquiry);
      saveInquiry(savedInquiry);
      setSubmittedInquiry(savedInquiry);
      setForm(initialForm);
      setErrors({});
      clearDraft();
    } catch (error) {
      console.error('Firebase inquiry submission failed:', error);
      saveInquiry({ ...inquiry, firebaseError: error.message });
      setSubmitError(
        'We could not send this inquiry to Firebase right now. A local backup was saved, so please try again shortly.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="site-shell">

      {/* ── SCROLL PROGRESS BAR ── */}
      <ScrollProgressBar />

      {/* ── MENU DETAIL OVERLAY ── rendered outside the main scroll */}
      {detailMenu && (
        <MenuDetailPage
          menu={detailMenu}
          selectedItems={form.selectedMenuId === detailMenu.docId ? form.selectedItems : []}
          onToggleItem={toggleItem}
          onSelectAll={handleSelectAll}
          onClose={closeDetail}
        />
      )}

      {/* ── LIGHTBOX OVERLAY ── */}
      {lightboxImage && (
        <Lightbox
          image={lightboxImage.image}
          title={lightboxImage.title}
          caption={lightboxImage.caption}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* ─── TOPBAR ─────────────────────────────────────── */}
      <header className={`topbar ${isScrolled ? 'topbar-scrolled' : ''}`}>
        <a className="brand" href="#home" aria-label="Aggarwal Caterers home">
          <span className="brand-mark">AC</span>
          <span>
            <strong>Aggarwal Caterers</strong>
            <small>Premium events &amp; hospitality</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#menus">Menus</a>
          <a href="#gallery">Gallery</a>
          <a href="#faq">FAQ</a>
          <a href="#reviews">Reviews</a>
          <a href="#inquiry">Book an Event</a>
        </nav>
        <a className="nav-cta" href="#inquiry">Send Inquiry</a>
      </header>

      {siteSettings.announcement && (
        <div className={`announcement-bar ${isScrolled ? 'announcement-bar-scrolled' : ''}`} role="status">
          <span>{siteSettings.bookingStatus}</span>
          <p>{siteSettings.announcement}</p>
        </div>
      )}

      <main>
        {/* ─── HERO ────────────────────────────────────── */}
        <section className="hero" id="home">
          <div className="hero-bg-img" aria-hidden="true" />
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero-orb hero-orb-1" aria-hidden="true" />
          <div className="hero-orb hero-orb-2" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-content">
              <div className="hero-eyebrow">
                <span>{siteSettings.serviceArea} · Premium Vegetarian Catering</span>
              </div>
              <h1>
                Where every<br />
                meal becomes<br />
                <em>a memory.</em>
              </h1>
              <p className="hero-copy">
                Premium vegetarian catering, polished service teams, and custom event menus for
                weddings, corporate dining, and private celebrations.
              </p>
              {siteSettings.googleRating && (
                <div className="hero-rating">
                  <StarRating rating={Number(siteSettings.googleRating)} />
                  <span>
                    {siteSettings.googleRating} / 5
                    {siteSettings.googleReviewCount ? ` · ${siteSettings.googleReviewCount} reviews` : ''}
                  </span>
                </div>
              )}
              <div className="hero-actions">
                <a className="btn btn-gold btn-shine" href="#inquiry">Plan Your Event</a>
                <a className="btn btn-outline" href={phoneHref}>Call Now</a>
              </div>
            </div>

            <aside className="hero-proof" aria-label="Event planning highlights">
              <span className="live-dot">Inquiry desk is live</span>
              <h2>From your first message to a confirmed kitchen plan.</h2>
              <div className="proof-list">
                <div>
                  <AnimatedCounter value="15" suffix="m" />
                  <span>Admin alert</span>
                </div>
                <div>
                  <strong>{siteSettings.responseWindow}</strong>
                  <span>Response</span>
                </div>
                <div>
                  <AnimatedCounter value="100" suffix="%" />
                  <span>Custom menu</span>
                </div>
              </div>
              <a href="#inquiry">Start your event request →</a>
            </aside>
          </div>
        </section>

        {/* ─── QUICK CONTACT ───────────────────────────── */}
        <div className="quick-contact">
          <div>
            <span>Booking Status</span>
            <strong>{siteSettings.bookingStatus}</strong>
          </div>
          <div>
            <span>Service Area</span>
            <strong>{siteSettings.serviceArea}</strong>
          </div>
          <div>
            <span>Call Us</span>
            <a href={phoneHref}>{siteSettings.businessPhone}</a>
          </div>
          <div>
            <span>Email</span>
            <a href={emailHref}>{siteSettings.businessEmail}</a>
          </div>
        </div>

        {/* ─── SIGNATURE ───────────────────────────────── */}
        <section className="section signature-section">
          <Reveal>
            <div className="signature-inner">
              <div className="signature-header">
                <div>
                  <div className="section-label"><span>Our Standard</span></div>
                  <h2 className="section-title">Hospitality that feels<br /><em>managed, measured,</em><br />and ready.</h2>
                </div>
                <p className="section-body">
                  Every event is shaped around your guest profile — course flow, dietary preferences,
                  counter timing, and service rhythm are all planned before the day arrives.
                </p>
              </div>
              <div className="signature-grid">
                <div className="signature-card">
                  <div className="signature-card-num">01</div>
                  <h3>Menu Architecture</h3>
                  <p>Course flow, live counters, dietary preferences, and portions designed around your guest profile.</p>
                </div>
                <div className="signature-card">
                  <div className="signature-card-num">02</div>
                  <h3>Service Control</h3>
                  <p>Staffing, counter timing, replenishment cycles, and serving rhythm tracked before event day.</p>
                </div>
                <div className="signature-card">
                  <div className="signature-card-num">03</div>
                  <h3>Clean Communication</h3>
                  <p>Every inquiry reaches our console in real time, so follow-up and quotes stay organized.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ─── TRUST ───────────────────────────────────── */}
        <Reveal>
          <div className="trust-band" aria-label="Service highlights">
            <div><AnimatedCounter value="15" suffix="+" /><span>Years of hospitality</span></div>
            <div><AnimatedCounter value="1200" suffix="+" /><span>Events served</span></div>
            <div><AnimatedCounter value="100" suffix="%" /><span>Custom menu planning</span></div>
            <div><strong>24 hr</strong><span>Response window</span></div>
          </div>
        </Reveal>

        {/* ─── SERVICES ────────────────────────────────── */}
        <section className="section services-section" id="services">
          <Reveal>
            <div className="services-header">
              <div>
                <div className="section-label"><span>What We Handle</span></div>
                <h2 className="section-title">Food, service, timing,<br />and <em>guest experience.</em></h2>
              </div>
              <p className="section-body">
                From first tasting to final service, every plan is shaped around your venue, guest
                count, budget, and family preferences.
              </p>
            </div>
          </Reveal>
          <div className="event-grid">
            {showcaseEvents.map((event, i) => (
              <Reveal key={event.title} delay={i * 100}>
                <article
                  className="event-card"
                  onClick={() => setLightboxImage({ image: event.image, title: event.title, caption: event.text })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setLightboxImage({ image: event.image, title: event.title, caption: event.text })}
                >
                  <div className="event-card-img-wrap">
                    <img src={event.image} alt={`${event.title} catering setup`} />
                    <span className="event-card-expand">View gallery ↗</span>
                  </div>
                  <div className="event-card-body">
                    <span className="event-card-tag">{event.tag}</span>
                    <h3>{event.title}</h3>
                    <p>{event.text}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── MENUS (live from Firebase) ──────────────── */}
        <section className="split-section" id="menus">
          <Reveal className="menu-panel">
            <div className="section-label"><span>Our Menus</span></div>
            <h2 className="section-title">Ready-made packages,<br /><em>built for your taste.</em></h2>
            <p>
              Each package is a complete, curated spread. Pick the one that suits your occasion,
              then choose exactly which dishes to include — our team will confirm and personalise the rest.
            </p>
          </Reveal>
          <div className="menu-list">
            {menusLoading && <MenuSkeleton />}

            {!menusLoading && menus.length === 0 && (
              <div className="menu-item">
                <span className="menu-item-tag">✦ Coming soon</span>
                <h3>Menus being updated</h3>
                <p>Our team is finalising the menu packages. Send an inquiry and we will share the full list directly.</p>
              </div>
            )}

            {!menusLoading && menus.map((menu, i) => (
              <Reveal key={menu.docId} delay={i * 80}>
                <div className="menu-item">
                  <div className="menu-item-top">
                    <span className="menu-item-tag">✦ {menu.tag || 'Package'}</span>
                    {menu.pricePerPlate && (
                      <span className="menu-item-price">{menu.pricePerPlate} / plate</span>
                    )}
                  </div>
                  <h3>{menu.name}</h3>
                  {menu.description && <p style={{ marginBottom: '14px' }}>{menu.description}</p>}
                  <span className="menu-item-dish-count">{countDishes(menu)} dishes</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── GALLERY (live from Firebase, admin-managed) ── */}
        <GallerySection
          images={galleryImages}
          onOpen={(img) => setLightboxImage({ image: img.url, title: img.title, caption: img.caption })}
        />

        {/* ─── PROCESS ─────────────────────────────────── */}
        <section className="section process-section">
          <div className="process-inner">
            <Reveal>
              <div className="process-header">
                <div className="section-label"><span>How It Works</span></div>
                <h2 className="section-title">A clear path from first<br />request to <em>confirmed menu.</em></h2>
                <p className="section-body" style={{ marginTop: '16px' }}>
                  Three steps, no friction. Your event request moves from form to kitchen plan without losing a single detail.
                </p>
              </div>
            </Reveal>
            <div className="process-grid">
              <Reveal delay={0}>
                <div className="process-step">
                  <div className="process-step-num">I</div>
                  <h3>Choose a Package</h3>
                  <p>Pick a menu package from our curated list and select which items you'd like included.</p>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="process-step">
                  <div className="process-step-num">II</div>
                  <h3>Send Your Details</h3>
                  <p>Tell us your dates, location, guest count, and budget through our inquiry form.</p>
                </div>
              </Reveal>
              <Reveal delay={240}>
                <div className="process-step">
                  <div className="process-step-num">III</div>
                  <h3>Finalize with Confidence</h3>
                  <p>We confirm scope, staff, counters, timings, and event-day coordination personally with you.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────── */}
        <FaqAccordion faqs={faqs} />

        {/* ─── INQUIRY ─────────────────────────────────── */}
        <section className="inquiry-section" id="inquiry">
          <div className="inquiry-intro">
            <div className="section-label"><span>Send an Inquiry</span></div>
            <h2 className="section-title">Plan your catering request.</h2>
            <p className="section-body">
              Choose a menu package, customise which dishes to include, fill in your event details,
              and we will take it from there.
            </p>
            {submittedInquiry && (
              <div className="success-box success-box-animated" role="status">
                <strong>✓ Inquiry received</strong>
                <span>Reference: {submittedInquiry.id}</span>
                <span>Delivered to the admin console in real time.</span>
                {submittedInquiry.firebaseDocId && (
                  <span style={{ opacity: 0.6, fontSize: '0.74rem' }}>
                    Firebase: {submittedInquiry.firebaseDocId}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="inquiry-form-wrap">
            <form className="inquiry-form" onSubmit={handleSubmit} noValidate>

              {/* ── STEP 1: Menu selection ── */}
              {menus.length > 0 && (
                <fieldset>
                  <legend>Step 1 — Choose a menu package</legend>
                  <div className="menu-select-grid">

                    {/* Real menus */}
                    {menus.map((menu) => {
                      const isSelected = form.selectedMenuId === menu.docId;
                      const dishCount = countDishes(menu);

                      return (
                        <div
                          className={`menu-select-card ${isSelected ? 'selected' : ''}`}
                          key={menu.docId}
                        >
                          {/* Radio-style header — selects this menu */}
                          <button
                            type="button"
                            className="menu-select-card-header"
                            onClick={() => selectMenu(menu.docId)}
                          >
                            <span className="menu-select-radio">
                              <span className={`menu-radio-dot ${isSelected ? 'checked' : ''}`} />
                            </span>
                            <span className="menu-select-info">
                              <span className="menu-select-tag-row">
                                <span className="menu-select-tag">{menu.tag || 'Package'}</span>
                                {menu.pricePerPlate && (
                                  <span className="menu-select-price">{menu.pricePerPlate} / plate</span>
                                )}
                              </span>
                              <strong className="menu-select-name">{menu.name}</strong>
                              {menu.description && (
                                <span className="menu-select-desc">{menu.description}</span>
                              )}
                              <span className="menu-select-count">{dishCount} dishes included</span>
                            </span>
                          </button>

                          {/* View items — opens full-screen detail page */}
                          {dishCount > 0 && (
                            <button
                              type="button"
                              className="menu-view-toggle"
                              onClick={() => openDetail(menu.docId)}
                            >
                              {isSelected
                                ? `View & customise items (${form.selectedItems.length} of ${dishCount} selected) →`
                                : `View items →`}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* None / decide later */}
                    <div
                      className={`menu-select-card menu-select-card-none ${form.selectedMenuId === NONE_MENU_ID ? 'selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="menu-select-card-header"
                        onClick={() => selectMenu(NONE_MENU_ID)}
                      >
                        <span className="menu-select-radio">
                          <span className={`menu-radio-dot ${form.selectedMenuId === NONE_MENU_ID ? 'checked' : ''}`} />
                        </span>
                        <span className="menu-select-info">
                          <span className="menu-select-tag">Flexible</span>
                          <strong className="menu-select-name">None — decide later</strong>
                          <span className="menu-select-desc">
                            Not sure yet? Send your inquiry and our team will discuss menu options with you directly.
                          </span>
                        </span>
                      </button>
                    </div>

                  </div>
                </fieldset>
              )}

              {/* ── STEP 2: Event details ── */}
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Your name"
                  />
                  {errors.name && <span className="error">{errors.name}</span>}
                </label>

                <label>
                  Phone number
                  <input
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                  />
                  {errors.phone && <span className="error">{errors.phone}</span>}
                </label>

                <label>
                  Email address
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="you@example.com"
                  />
                  {errors.email && <span className="error">{errors.email}</span>}
                </label>

                <label>
                  Event type
                  <select
                    value={form.eventType}
                    onChange={(event) => updateField('eventType', event.target.value)}
                  >
                    {eventTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Service start date
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => updateField('startDate', event.target.value)}
                  />
                  {errors.startDate && <span className="error">{errors.startDate}</span>}
                </label>

                <label>
                  Service end date
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) => updateField('endDate', event.target.value)}
                  />
                  {errors.endDate && <span className="error">{errors.endDate}</span>}
                </label>

                <label>
                  Preferred service time
                  <input
                    type="time"
                    value={form.preferredTime}
                    onChange={(event) => updateField('preferredTime', event.target.value)}
                  />
                </label>

                <label>
                  Guests attending
                  <input
                    type="number"
                    min="10"
                    value={form.guests}
                    onChange={(event) => updateField('guests', event.target.value)}
                    placeholder="250"
                  />
                  {errors.guests && <span className="error">{errors.guests}</span>}
                </label>

                <label className="wide">
                  Event location
                  <input
                    value={form.location}
                    onChange={(event) => updateField('location', event.target.value)}
                    placeholder="Venue, area, city"
                  />
                  {errors.location && <span className="error">{errors.location}</span>}
                </label>

                <label>
                  Estimated budget (₹)
                  <input
                    type="number"
                    min="1000"
                    value={form.budget}
                    onChange={(event) => updateField('budget', event.target.value)}
                    placeholder="150000"
                  />
                  {errors.budget && <span className="error">{errors.budget}</span>}
                </label>
              </div>

              <label>
                Additional requirements
                <textarea
                  value={form.requirements}
                  onChange={(event) => updateField('requirements', event.target.value)}
                  placeholder="Jain food, live counters, serving style, special guests, decoration coordination, or anything else."
                  rows="4"
                />
              </label>

              <aside className="summary-panel" aria-label="Inquiry summary">
                <h3>Inquiry Preview</h3>
                <dl>
                  <div>
                    <dt>Event</dt>
                    <dd>{form.eventType}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{form.startDate || 'Select a date'}</dd>
                  </div>
                  <div>
                    <dt>Guests</dt>
                    <dd>{form.guests || '—'}</dd>
                  </div>
                  <div>
                    <dt>Menu</dt>
                    <dd>{selectedMenuName}</dd>
                  </div>
                  <div>
                    <dt>Items</dt>
                    <dd>{selectedItemsText}</dd>
                  </div>
                </dl>
              </aside>

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending Inquiry…' : 'Submit Catering Inquiry →'}
              </button>
              {submitError && <p className="submit-error" role="alert">{submitError}</p>}
            </form>
          </div>
        </section>

        {/* ─── REVIEW SYSTEM — very last section of the site ── */}
        <ReviewSystem
          reviews={testimonials}
          googleRating={siteSettings.googleRating}
          googleReviewCount={siteSettings.googleReviewCount}
        />
      </main>

      <footer className="footer">
        <div>
          <strong>Aggarwal Caterers</strong>
          <p>Premium vegetarian catering for weddings, corporate events, and private occasions.</p>
        </div>
        <div className="footer-links">
          <a href={emailHref}>{siteSettings.businessEmail}</a>
          <a href={phoneHref}>{siteSettings.businessPhone}</a>
        </div>
      </footer>

      {/* ── FLOATING WHATSAPP / CALL / BACK-TO-TOP ── */}
      <FloatingActions
        phone={siteSettings.businessPhone.replace(/[^\d+]/g, '')}
        whatsappHref={whatsappHref}
      />

      {/* ── STICKY MOBILE CTA BAR ── */}
      <StickyMobileCta phoneHref={phoneHref} />
    </div>
  );
}

function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminApp />;
  }
  return <PublicSite />;
}

export default App;