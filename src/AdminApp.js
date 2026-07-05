import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle,
  ClipboardList,
  XCircle,
  ExternalLink,
  FilePlus,
  GripVertical,
  Heading,
  HelpCircle,
  Image as ImageIcon,
  IndianRupee,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  PhoneCall,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Signal,
  Star,
  Sun,
  Trash2,
  UtensilsCrossed,
  Users,
  Zap,
} from 'lucide-react';
import './AdminApp.css';
import {
  createOrder,
  createOrderFromInquiry,
  deleteFaq,
  deleteGalleryImage,
  deleteMenu,
  deleteTestimonial,
  respondToInquiry,
  saveFaq,
  saveGalleryImage,
  saveMenu,
  saveSiteSettings,
  signInAdmin,
  signOutAdmin,
  subscribeToAuth,
  subscribeToFaqs,
  subscribeToGallery,
  subscribeToInquiries,
  subscribeToMenus,
  subscribeToOrders,
  subscribeToSiteSettings,
  subscribeToTestimonials,
  updateInquiry,
  updateOrder,
  updateTestimonial,
} from './firebase';

const inquiryStatuses = ['New', 'Meeting', 'Confirmed', 'Cancelled'];
const orderStatuses = ['Planning', 'Everything Planned', 'Working', 'Ready', 'Completed', 'Cancelled'];
const paymentStatuses = ['Pending', 'Advance Received', 'Part Paid', 'Paid', 'Refunded'];

const tabs = [
  { label: 'Overview', Icon: LayoutDashboard },
  { label: 'Inquiries', Icon: Inbox },
  { label: 'Orders', Icon: ClipboardList },
  { label: 'Menus', Icon: UtensilsCrossed },
  { label: 'Gallery', Icon: ImageIcon },
  { label: 'FAQs', Icon: HelpCircle },
  { label: 'Reviews', Icon: Star },
  { label: 'Main App', Icon: Settings },
];

const emptySettings = {
  businessPhone: '+91 99999 99999',
  businessEmail: 'info@aggarwalcaterers.com',
  serviceArea: 'Delhi NCR',
  bookingStatus: 'Open',
  responseWindow: '24 hours',
  announcement: '',
  googleRating: '',
  googleReviewCount: '',
};

const emptyMenuDraft = {
  name: '',
  tag: '',
  description: '',
  pricePerPlate: '',
  items: [],
};

const emptyNewOrderDraft = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  eventType: '',
  eventDate: '',
  eventEndDate: '',
  guests: '',
  location: '',
  quotedAmount: '',
  orderStatus: 'Planning',
  paymentStatus: 'Pending',
  selectedMenuName: '',
  requirements: '',
  menuNotes: '',
  operationsNotes: '',
};

const emptyGalleryDraft = {
  url: '',
  title: '',
  caption: '',
  order: 0,
};

const emptyFaqDraft = {
  question: '',
  answer: '',
  order: 0,
};

function statusBadgeClass(status) {
  if (!status) return 'badge-new';
  const s = status.toLowerCase().replace(/\s+/g, '-');
  return `badge-${s}`;
}

function formatDate(value) {
  if (!value) return 'Not set';
  if (typeof value === 'string') return value;
  if (value.toDate) return value.toDate().toLocaleString();
  return 'Not set';
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0));
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

// Auto-derive payment status from total vs received payment.
// Refunded is left untouched since it's a manual, exceptional status.
function derivePaymentStatus(totalPayment, receivedPayment, currentStatus) {
  if (currentStatus === 'Refunded') return currentStatus;
  const total = Number(totalPayment || 0);
  const received = Number(receivedPayment || 0);
  if (received <= 0) return 'Pending';
  if (received >= total && total > 0) return 'Paid';
  return 'Part Paid';
}

// Count only dish items (not section headings)
function countDishes(items) {
  return (items || []).filter((e) => e.type !== 'section').length;
}

// Build the pre-filled WhatsApp acceptance message URL for an inquiry
// (*bold* and _italic_ are WhatsApp's own text formatting syntax)
function buildAcceptanceWhatsAppUrl(inquiry) {
  const message =
`*AGGARWAL CATERERS, HANUMANGARH*

_Order Inquiry Status_

*Customer:* ${inquiry.name || ''}
*Event Date:* ${formatDate(inquiry.startDate)}
*Event Type:* ${inquiry.eventType || ''}
*Location:* ${inquiry.location || ''}

Thank you for your inquiry and for considering Aggarwal Caterers, Hanumangarh for your event.

We are pleased to inform you that we are available on your requested date and would be delighted to cater your event.

Our team will contact you shortly to discuss your requirements in detail, including the menu, arrangements, pricing, and to schedule a meeting at your convenience. We look forward to working with you and making your event a memorable success.

*Warm Regards,*
*Aggarwal Caterers, Hanumangarh*
_Quality Catering for Every Occasion_`;

  const phone = String(inquiry.phone || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// Build the pre-filled WhatsApp rejection/closure message URL for an inquiry
// (*bold* and _italic_ are WhatsApp's own text formatting syntax)
function buildRejectionWhatsAppUrl(inquiry) {
  const message =
`*AGGARWAL CATERERS, HANUMANGARH*

_Order Inquiry Status_

*Customer:* ${inquiry.name || ''}
*Event Date:* ${formatDate(inquiry.startDate)}
*Event Type:* ${inquiry.eventType || ''}
*Location:* ${inquiry.location || ''}

Thank you for your inquiry and for considering Aggarwal Caterers, Hanumangarh for your event.

We sincerely apologize, but we are already fully booked on your requested date and are unable to accept any additional orders.

If your event dates are flexible, we'd be happy to check our availability and will do our best to assist you.

We appreciate your understanding and wish you a wonderful and successful event.

*Warm Regards,*
*Aggarwal Caterers, Hanumangarh*
_Quality Catering for Every Occasion_`;

  const phone = String(inquiry.phone || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function LoginScreen({ onLogin, isLoading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(email, password);
  };

  return (
    <main className="admin-login">
      <section className="login-panel">
        <a className="login-home" href="/">← Back to website</a>
        <div>
          <span className="login-badge">
            <LockKeyhole size={22} aria-hidden="true" />
          </span>
          <p className="admin-kicker">Aggarwal Caterers</p>
          <h1>Admin Console</h1>
          <p style={{ marginTop: '8px' }}>
            Manage inquiries, replies, orders, menus, and live site settings from one secure workspace.
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Admin email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Firebase Auth password"
              required
            />
          </label>
          <button type="submit" disabled={isLoading}>
            <ShieldCheck size={16} aria-hidden="true" />
            {isLoading ? 'Signing in…' : 'Sign in securely'}
          </button>
          {error && <p className="admin-error">{error}</p>}
        </form>
        <div className="setup-note">
          <strong>First-time setup</strong>
          <span>
            Enable Firebase Email/Password Auth and create the admin user. Signed-in admins can
            receive inquiries, update orders, manage menus, and manage website settings.
          </span>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, detail, Icon, variant }) {
  return (
    <article className="stat-card">
      <div className={`stat-card-icon ${variant || 'emerald'}`}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-detail">{detail}</div>
    </article>
  );
}

/* ─── ORDER DETAIL OVERLAY (full-screen page) ─────────── */
function OrderDetailOverlay({ order, draft, setDraft, onSave, onClose, isSaving }) {
  // Prevent background scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!order || !draft) return null;

  const isCompleted = ['Completed', 'Cancelled'].includes(draft.orderStatus);

  // Total / Received / Left payment calculation
  // Left payment is always auto-derived from Total - Received, never edited directly.
  const totalPaymentValue = Number(draft.quotedAmount || 0);
  const receivedPaymentValue = Number(draft.receivedAmount || 0);
  const leftPaymentValue = totalPaymentValue - receivedPaymentValue;

  return (
    <div className="order-detail-overlay" role="dialog" aria-modal="true" aria-label={`Order for ${order.customerName}`}>
      {/* Sticky header */}
      <div className="order-detail-header">
        <button className="order-detail-back" type="button" onClick={onClose}>
          ← Back to orders
        </button>
        <div className="order-detail-title-wrap">
          <span className="order-detail-ref">{order.inquiryReferenceId}</span>
          <h2 className="order-detail-title">{order.customerName}</h2>
          <span className="order-detail-sub">
            {order.eventType} · {formatDate(draft.eventDate)} · {draft.guests || 0} guests
          </span>
        </div>
        <em className={`order-detail-status-badge ${statusBadgeClass(draft.orderStatus)}`}>
          {draft.orderStatus || 'Planning'}
        </em>
      </div>

      {/* Scrollable body */}
      <div className="order-detail-body">
        <form className="order-detail-form" id="order-detail-form" onSubmit={onSave}>

          {/* Customer info — read only */}
          <div className="order-detail-card">
            <h3>Customer</h3>
            <div className="order-detail-info-grid">
              <div>
                <span><Users size={13} aria-hidden="true" />Name</span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span><PhoneCall size={13} aria-hidden="true" />Phone</span>
                <strong>{order.customerPhone}</strong>
              </div>
              <div>
                <span><Mail size={13} aria-hidden="true" />Email</span>
                <strong>{order.customerEmail}</strong>
              </div>
              <div>
                <span><Calendar size={13} aria-hidden="true" />Order created</span>
                <strong>{formatDate(order.createdAt)}</strong>
              </div>
            </div>
          </div>

          {/* Status controls */}
          <div className="order-detail-card">
            <h3>Status &amp; payment</h3>
            <div className="form-columns">
              <label>
                Order status
                <select
                  value={draft.orderStatus || 'Planning'}
                  onChange={(event) => setDraft((current) => ({ ...current, orderStatus: event.target.value }))}
                >
                  {orderStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Payment status
                <select
                  value={draft.paymentStatus || 'Pending'}
                  onChange={(event) => setDraft((current) => ({ ...current, paymentStatus: event.target.value }))}
                >
                  {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Payment breakdown: Total / Received / Left (auto-calculated) */}
          <div className="order-detail-card">
            <h3>Payment breakdown</h3>
            <div className="form-columns">
              <label>
                Total payment (₹)
                <input
                  type="number"
                  value={draft.quotedAmount || ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      quotedAmount: event.target.value,
                      paymentStatus: derivePaymentStatus(
                        event.target.value,
                        current.receivedAmount,
                        current.paymentStatus
                      ),
                    }))
                  }
                />
              </label>
              <label>
                Received payment (₹)
                <input
                  type="number"
                  value={draft.receivedAmount || ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      receivedAmount: event.target.value,
                      paymentStatus: derivePaymentStatus(
                        current.quotedAmount,
                        event.target.value,
                        current.paymentStatus
                      ),
                    }))
                  }
                />
              </label>
              <label>
                Left payment (₹)
                <input
                  type="number"
                  value={Number.isFinite(leftPaymentValue) ? leftPaymentValue : 0}
                  readOnly
                  disabled
                />
              </label>
            </div>
          </div>

          {/* Event details */}
          <div className="order-detail-card">
            <h3>Event details</h3>
            <div className="form-columns">
              <label>
                Event date
                <input
                  type="date"
                  value={draft.eventDate || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value }))}
                />
              </label>
              <label>
                Event end date
                <input
                  type="date"
                  value={draft.eventEndDate || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, eventEndDate: event.target.value }))}
                />
              </label>
              <label>
                Guests
                <input
                  type="number"
                  value={draft.guests || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, guests: event.target.value }))}
                />
              </label>
              <label className="wide-field">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} aria-hidden="true" />Location
                </span>
                <input
                  value={draft.location || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                />
              </label>
            </div>
          </div>

          {/* Menu selection — read only summary */}
          <div className="order-detail-card">
            <h3>Menu selection</h3>
            <p className="order-detail-menu-name">{order.selectedMenuName || 'Not specified'}</p>
            {(order.selectedItems || []).length > 0 && (
              <div className="order-detail-item-chips">
                {order.selectedItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
            {order.requirements && (
              <p className="order-detail-requirements">
                <strong>Requirements:</strong> {order.requirements}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="order-detail-card">
            <h3>Internal notes</h3>
            <label>
              Menu notes
              <textarea
                value={draft.menuNotes || ''}
                onChange={(event) => setDraft((current) => ({ ...current, menuNotes: event.target.value }))}
                rows="3"
                placeholder="Kitchen-facing notes about the menu for this order."
              />
            </label>
            <label style={{ marginTop: '14px' }}>
              Operations notes
              <textarea
                value={draft.operationsNotes || ''}
                onChange={(event) => setDraft((current) => ({ ...current, operationsNotes: event.target.value }))}
                rows="3"
                placeholder="Staffing, logistics, or event-day coordination notes."
              />
            </label>
          </div>
        </form>
      </div>

      {/* Sticky footer */}
      <div className="order-detail-footer">
        <span className="order-detail-footer-note">
          {isCompleted ? 'This order is archived in completed orders.' : 'Changes save instantly to Firebase.'}
        </span>
        <button type="submit" form="order-detail-form" className="order-detail-save" disabled={isSaving}>
          <Save size={15} aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/* ─── NEW ORDER OVERLAY (manual order creation, full-screen page) ─────────── */
function NewOrderOverlay({ draft, setDraft, onSave, onClose, isSaving }) {
  // Prevent background scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!draft) return null;

  return (
    <div className="order-detail-overlay" role="dialog" aria-modal="true" aria-label="Add a new order manually">
      {/* Sticky header */}
      <div className="order-detail-header">
        <button className="order-detail-back" type="button" onClick={onClose}>
          ← Back to orders
        </button>
        <div className="order-detail-title-wrap">
          <span className="order-detail-ref">Manual entry</span>
          <h2 className="order-detail-title">{draft.customerName || 'New order'}</h2>
          <span className="order-detail-sub">
            {draft.eventType || 'Event type not set'} · {draft.eventDate ? formatDate(draft.eventDate) : 'Date not set'} · {draft.guests || 0} guests
          </span>
        </div>
        <em className={`order-detail-status-badge ${statusBadgeClass(draft.orderStatus)}`}>
          {draft.orderStatus || 'Planning'}
        </em>
      </div>

      {/* Scrollable body */}
      <div className="order-detail-body">
        <form className="order-detail-form" id="new-order-form" onSubmit={onSave}>

          {/* Customer info — editable, since this is manual entry */}
          <div className="order-detail-card">
            <h3>Customer</h3>
            <div className="form-columns">
              <label>
                Name
                <input
                  value={draft.customerName || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))}
                  placeholder="Customer full name"
                  required
                />
              </label>
              <label>
                Phone
                <input
                  value={draft.customerPhone || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, customerPhone: event.target.value }))}
                  placeholder="+91 99999 99999"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={draft.customerEmail || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, customerEmail: event.target.value }))}
                  placeholder="customer@example.com"
                />
              </label>
              <label>
                Event type
                <input
                  value={draft.eventType || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, eventType: event.target.value }))}
                  placeholder="e.g. Wedding, Birthday, Corporate"
                />
              </label>
            </div>
          </div>

          {/* Status controls */}
          <div className="order-detail-card">
            <h3>Status &amp; payment</h3>
            <div className="form-columns">
              <label>
                Order status
                <select
                  value={draft.orderStatus || 'Planning'}
                  onChange={(event) => setDraft((current) => ({ ...current, orderStatus: event.target.value }))}
                >
                  {orderStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Payment status
                <select
                  value={draft.paymentStatus || 'Pending'}
                  onChange={(event) => setDraft((current) => ({ ...current, paymentStatus: event.target.value }))}
                >
                  {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Event details */}
          <div className="order-detail-card">
            <h3>Event details</h3>
            <div className="form-columns">
              <label>
                Event date
                <input
                  type="date"
                  value={draft.eventDate || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value }))}
                />
              </label>
              <label>
                Event end date
                <input
                  type="date"
                  value={draft.eventEndDate || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, eventEndDate: event.target.value }))}
                />
              </label>
              <label>
                Guests
                <input
                  type="number"
                  value={draft.guests || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, guests: event.target.value }))}
                />
              </label>
              <label>
                Quoted amount (₹)
                <input
                  type="number"
                  value={draft.quotedAmount || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, quotedAmount: event.target.value }))}
                />
              </label>
              <label className="wide-field">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} aria-hidden="true" />Location
                </span>
                <input
                  value={draft.location || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                />
              </label>
            </div>
          </div>

          {/* Menu selection — editable, since this is manual entry */}
          <div className="order-detail-card">
            <h3>Menu selection</h3>
            <label>
              Menu / package name
              <input
                value={draft.selectedMenuName || ''}
                onChange={(event) => setDraft((current) => ({ ...current, selectedMenuName: event.target.value }))}
                placeholder="e.g. Silver Package"
              />
            </label>
            <label style={{ marginTop: '14px' }}>
              Requirements
              <textarea
                value={draft.requirements || ''}
                onChange={(event) => setDraft((current) => ({ ...current, requirements: event.target.value }))}
                rows="3"
                placeholder="Any specific customer requirements."
              />
            </label>
          </div>

          {/* Notes */}
          <div className="order-detail-card">
            <h3>Internal notes</h3>
            <label>
              Menu notes
              <textarea
                value={draft.menuNotes || ''}
                onChange={(event) => setDraft((current) => ({ ...current, menuNotes: event.target.value }))}
                rows="3"
                placeholder="Kitchen-facing notes about the menu for this order."
              />
            </label>
            <label style={{ marginTop: '14px' }}>
              Operations notes
              <textarea
                value={draft.operationsNotes || ''}
                onChange={(event) => setDraft((current) => ({ ...current, operationsNotes: event.target.value }))}
                rows="3"
                placeholder="Staffing, logistics, or event-day coordination notes."
              />
            </label>
          </div>
        </form>
      </div>

      {/* Sticky footer */}
      <div className="order-detail-footer">
        <span className="order-detail-footer-note">
          Fill in the customer and event details, then save to create the order in Firebase.
        </span>
        <button
          type="submit"
          form="new-order-form"
          className="order-detail-save"
          disabled={isSaving || !draft.customerName?.trim() || !draft.customerPhone?.trim()}
        >
          <Save size={15} aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Create order'}
        </button>
      </div>
    </div>
  );
}

function AdminApp() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [inquiries, setInquiries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [galleryItems, setGalleryItems] = useState([]);
  const [faqItems, setFaqItems] = useState([]);
  const [testimonialItems, setTestimonialItems] = useState([]);
  const [dataError, setDataError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderSubTab, setOrderSubTab] = useState('Upcoming');
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderDraft, setNewOrderDraft] = useState({ ...emptyNewOrderDraft });
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderSort, setOrderSort] = useState({ field: 'eventDate', direction: 'asc' });
  const [selectedMenuDocId, setSelectedMenuDocId] = useState('');
  const [menuDraft, setMenuDraft] = useState({ ...emptyMenuDraft, items: [] });
  const [newEntryName, setNewEntryName] = useState('');
  const [replyDraft, setReplyDraft] = useState({ channel: 'Phone', message: '' });
  const [settings, setSettings] = useState(emptySettings);
  const [settingsDraft, setSettingsDraft] = useState(emptySettings);
  const [orderDraft, setOrderDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('Connecting');
  const [theme, setTheme] = useState('dark');
  const [selectedGalleryDocId, setSelectedGalleryDocId] = useState('');
  const [galleryDraft, setGalleryDraft] = useState({ ...emptyGalleryDraft });
  const [selectedFaqDocId, setSelectedFaqDocId] = useState('');
  const [faqDraft, setFaqDraft] = useState({ ...emptyFaqDraft });
  const [reviewFilter, setReviewFilter] = useState('Pending');
  const previousInquiryIds = useRef(new Set());

  useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setInquiries([]);
      setOrders([]);
      setMenus([]);
      setGalleryItems([]);
      setFaqItems([]);
      setTestimonialItems([]);
      return undefined;
    }

    setDataError('');
    setRealtimeStatus('Connecting');

    const unsubscribeInquiries = subscribeToInquiries((nextInquiries) => {
      const previousIds = previousInquiryIds.current;
      const freshInquiry = nextInquiries.find((inquiry) => !previousIds.has(inquiry.docId));

      if (previousIds.size > 0 && freshInquiry) {
        setNotice(`New inquiry received from ${freshInquiry.name}.`);
        setSelectedInquiryId(freshInquiry.docId);
        setActiveTab('Inquiries');
      }

      previousInquiryIds.current = new Set(nextInquiries.map((inquiry) => inquiry.docId));
      setInquiries(nextInquiries);
      setLastSyncAt(new Date());
      setRealtimeStatus('Live');
    }, (error) => {
      setRealtimeStatus('Blocked');
      setDataError(`Realtime inquiry listener failed: ${error.message}`);
    });

    const unsubscribeOrders = subscribeToOrders(setOrders, (error) => {
      setDataError(error.message);
    });

    const unsubscribeMenus = subscribeToMenus(setMenus, (error) => {
      setDataError(error.message);
    });

    const unsubscribeSettings = subscribeToSiteSettings(
      (snapshot) => {
        const nextSettings = snapshot.exists()
          ? { ...emptySettings, ...snapshot.data() }
          : emptySettings;
        setSettings(nextSettings);
        setSettingsDraft(nextSettings);
      },
      (error) => {
        setDataError(error.message);
      }
    );

    const unsubscribeGallery = subscribeToGallery(setGalleryItems, (error) => {
      setDataError(error.message);
    });

    const unsubscribeFaqs = subscribeToFaqs(setFaqItems, (error) => {
      setDataError(error.message);
    });

    const unsubscribeTestimonials = subscribeToTestimonials(setTestimonialItems, (error) => {
      setDataError(error.message);
    });

    return () => {
      unsubscribeInquiries();
      unsubscribeOrders();
      unsubscribeMenus();
      unsubscribeSettings();
      unsubscribeGallery();
      unsubscribeFaqs();
      unsubscribeTestimonials();
      previousInquiryIds.current = new Set();
    };
  }, [user]);

  useEffect(() => {
    if (!selectedInquiryId && inquiries.length) {
      setSelectedInquiryId(inquiries[0].docId);
    }
  }, [inquiries, selectedInquiryId]);

  useEffect(() => {
    if (!selectedOrderId && orders.length) {
      setSelectedOrderId(orders[0].docId);
    }
  }, [orders, selectedOrderId]);

  // When selected menu changes, load it into the draft
  useEffect(() => {
    if (selectedMenuDocId) {
      const found = menus.find((m) => m.docId === selectedMenuDocId);
      if (found) {
        setMenuDraft({
          name: found.name || '',
          tag: found.tag || '',
          description: found.description || '',
          pricePerPlate: found.pricePerPlate || '',
          items: (found.items || []).map((item) => ({ ...item })),
        });
      }
    }
  }, [selectedMenuDocId, menus]);

  // When selected gallery image changes, load it into the draft
  useEffect(() => {
    if (selectedGalleryDocId) {
      const found = galleryItems.find((g) => g.docId === selectedGalleryDocId);
      if (found) {
        setGalleryDraft({
          url: found.url || '',
          title: found.title || '',
          caption: found.caption || '',
          order: found.order || 0,
        });
      }
    }
  }, [selectedGalleryDocId, galleryItems]);

  // When selected FAQ changes, load it into the draft
  useEffect(() => {
    if (selectedFaqDocId) {
      const found = faqItems.find((f) => f.docId === selectedFaqDocId);
      if (found) {
        setFaqDraft({
          question: found.question || '',
          answer: found.answer || '',
          order: found.order || 0,
        });
      }
    }
  }, [selectedFaqDocId, faqItems]);

  const filteredInquiries = useMemo(() => {
    const searchTerm = normalize(search);
    return inquiries.filter((inquiry) => {
      const matchesStatus = statusFilter === 'All' || inquiry.status === statusFilter;
      const matchesSearch = [inquiry.name, inquiry.phone, inquiry.email, inquiry.eventType, inquiry.id]
        .map(normalize)
        .some((value) => value.includes(searchTerm));
      return matchesStatus && matchesSearch;
    });
  }, [inquiries, search, statusFilter]);

  const selectedInquiry = useMemo(
    () => inquiries.find((inquiry) => inquiry.docId === selectedInquiryId) || filteredInquiries[0],
    [filteredInquiries, inquiries, selectedInquiryId]
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.docId === selectedOrderId) || orders[0],
    [orders, selectedOrderId]
  );

  const upcomingOrders = useMemo(
    () => orders.filter((order) => !['Completed', 'Cancelled'].includes(order.orderStatus)),
    [orders]
  );

  const completedOrders = useMemo(
    () => orders.filter((order) => order.orderStatus === 'Completed'),
    [orders]
  );

  const cancelledOrders = useMemo(
    () => orders.filter((order) => order.orderStatus === 'Cancelled'),
    [orders]
  );

  const visibleOrders = useMemo(() => {
    const base =
      orderSubTab === 'Upcoming'
        ? upcomingOrders
        : orderSubTab === 'Completed'
        ? completedOrders
        : cancelledOrders;
    const searchTerm = normalize(orderSearch);

    let result = base.filter((order) => {
      const matchesStatus = orderStatusFilter === 'All' || order.orderStatus === orderStatusFilter;
      const matchesSearch = [order.customerName, order.customerPhone, order.customerEmail, order.eventType, order.inquiryReferenceId, order.location]
        .map(normalize)
        .some((value) => value.includes(searchTerm));
      return matchesStatus && matchesSearch;
    });

    const { field, direction } = orderSort;
    const dir = direction === 'asc' ? 1 : -1;

    result = [...result].sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];

      if (field === 'quotedAmount' || field === 'guests') {
        valueA = Number(valueA || 0);
        valueB = Number(valueB || 0);
        return (valueA - valueB) * dir;
      }

      if (field === 'eventDate' || field === 'createdAt') {
        valueA = valueA ? new Date(typeof valueA === 'string' ? valueA : valueA.toDate?.() || 0).getTime() : 0;
        valueB = valueB ? new Date(typeof valueB === 'string' ? valueB : valueB.toDate?.() || 0).getTime() : 0;
        return (valueA - valueB) * dir;
      }

      valueA = normalize(valueA);
      valueB = normalize(valueB);
      if (valueA < valueB) return -1 * dir;
      if (valueA > valueB) return 1 * dir;
      return 0;
    });

    return result;
  }, [orderSubTab, upcomingOrders, completedOrders, cancelledOrders, orderSearch, orderStatusFilter, orderSort]);

  const toggleOrderSort = (field) => {
    setOrderSort((current) => {
      if (current.field === field) {
        return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  useEffect(() => {
    setOrderDraft(selectedOrder || null);
  }, [selectedOrder]);

  const metrics = useMemo(() => {
    const newInquiries = inquiries.filter((inquiry) => inquiry.status === 'New').length;
    const activeOrders = orders.filter(
      (order) => !['Completed', 'Cancelled'].includes(order.orderStatus)
    ).length;
    const quotedRevenue = orders
      .filter((order) => order.orderStatus === 'Completed')
      .reduce((total, order) => total + Number(order.quotedAmount || 0), 0);
    const todaysInquiries = inquiries.filter((inquiry) => {
      const today = new Date().toISOString().slice(0, 10);
      return String(inquiry.createdAt || '').startsWith(today);
    }).length;
    return { activeOrders, newInquiries, quotedRevenue, todaysInquiries };
  }, [inquiries, orders]);

  const lastSyncText = lastSyncAt
    ? lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'waiting';

  const handleLogin = async (email, password) => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await signInAdmin(email, password);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const runAction = async (action, successMessage) => {
    setIsSaving(true);
    setNotice('');
    setDataError('');
    try {
      await action();
      setNotice(successMessage);
    } catch (error) {
      setDataError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReply = (event) => {
    event.preventDefault();
    if (!selectedInquiry || !replyDraft.message.trim()) return;
    runAction(
      () => respondToInquiry(selectedInquiry.docId, replyDraft, user),
      'Response saved in real time.'
    ).then(() => setReplyDraft({ channel: 'Phone', message: '' }));
  };

  const handleConvertToOrder = () => {
    if (!selectedInquiry) return;
    runAction(
      () => createOrderFromInquiry(selectedInquiry, user),
      'Inquiry converted into an order.'
    );
  };

  // Explicit Accept button — updates status and opens WhatsApp with the acceptance template
  const handleAcceptInquiry = (inquiry) => {
    if (!inquiry) return;
    runAction(
      () => updateInquiry(inquiry.docId, { status: 'Qualified' }),
      'Inquiry accepted.'
    );
    window.open(buildAcceptanceWhatsAppUrl(inquiry), '_blank', 'noopener,noreferrer');
  };

  // Explicit Reject button — updates status and opens WhatsApp with the rejection template
  const handleRejectInquiry = (inquiry) => {
    if (!inquiry) return;
    runAction(
      () => updateInquiry(inquiry.docId, { status: 'Closed' }),
      'Inquiry rejected.'
    );
    window.open(buildRejectionWhatsAppUrl(inquiry), '_blank', 'noopener,noreferrer');
  };

  const openOrderDetail = (orderDocId) => {
    setSelectedOrderId(orderDocId);
    setOrderDetailOpen(true);
  };

  const closeOrderDetail = () => setOrderDetailOpen(false);

  const openNewOrder = () => {
    setNewOrderDraft({ ...emptyNewOrderDraft });
    setNewOrderOpen(true);
  };

  const closeNewOrder = () => setNewOrderOpen(false);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const handleCreateOrder = (event) => {
    event.preventDefault();
    if (!newOrderDraft.customerName?.trim() || !newOrderDraft.customerPhone?.trim()) return;
    runAction(
      () =>
        createOrder(
          {
            customerName: newOrderDraft.customerName || '',
            customerPhone: newOrderDraft.customerPhone || '',
            customerEmail: newOrderDraft.customerEmail || '',
            eventType: newOrderDraft.eventType || '',
            eventDate: newOrderDraft.eventDate || '',
            eventEndDate: newOrderDraft.eventEndDate || '',
            guests: Number(newOrderDraft.guests || 0),
            location: newOrderDraft.location || '',
            quotedAmount: Number(newOrderDraft.quotedAmount || 0),
            orderStatus: newOrderDraft.orderStatus || 'Planning',
            paymentStatus: newOrderDraft.paymentStatus || 'Pending',
            selectedMenuName: newOrderDraft.selectedMenuName || '',
            requirements: newOrderDraft.requirements || '',
            menuNotes: newOrderDraft.menuNotes || '',
            operationsNotes: newOrderDraft.operationsNotes || '',
          },
          user
        ),
      'Order created.'
    ).then(() => {
      setNewOrderDraft({ ...emptyNewOrderDraft });
      setNewOrderOpen(false);
    });
  };

  // Direct single-field update from a spreadsheet cell, no overlay needed
  const handleInlineCellEdit = (orderDocId, field, value) => {
    const payload = { [field]: field === 'quotedAmount' || field === 'guests' ? Number(value || 0) : value };
    updateOrder(orderDocId, payload).catch((error) => setDataError(error.message));
  };

  const handleOrderSave = (event) => {
    event.preventDefault();
    if (!selectedOrder || !orderDraft) return;
    const totalPayment = Number(orderDraft.quotedAmount || 0);
    const receivedPayment = Number(orderDraft.receivedAmount || 0);
    const leftPayment = totalPayment - receivedPayment;
    runAction(
      () =>
        updateOrder(selectedOrder.docId, {
          eventDate: orderDraft.eventDate || '',
          eventEndDate: orderDraft.eventEndDate || '',
          eventType: orderDraft.eventType || '',
          guests: Number(orderDraft.guests || 0),
          location: orderDraft.location || '',
          menuNotes: orderDraft.menuNotes || '',
          operationsNotes: orderDraft.operationsNotes || '',
          orderStatus: orderDraft.orderStatus || 'Planning',
          paymentStatus: orderDraft.paymentStatus || 'Pending',
          quotedAmount: totalPayment,
          receivedAmount: receivedPayment,
          leftAmount: leftPayment,
        }),
      'Order updated.'
    );
  };

  const handleSettingsSave = (event) => {
    event.preventDefault();
    runAction(() => saveSiteSettings(settingsDraft, user), 'Main app settings saved.');
  };

  // ── Menu CRUD ─────────────────────────────────────────────
  const startNewMenu = () => {
    setSelectedMenuDocId('');
    setMenuDraft({ ...emptyMenuDraft, items: [] });
    setNewEntryName('');
  };

  const handleMenuSave = (event) => {
    event.preventDefault();
    if (!menuDraft.name.trim()) return;
    runAction(
      () => saveMenu(selectedMenuDocId || null, menuDraft, user),
      selectedMenuDocId ? 'Menu updated.' : 'Menu created.'
    ).then(() => {
      if (!selectedMenuDocId) {
        setMenuDraft({ ...emptyMenuDraft, items: [] });
        setNewEntryName('');
      }
    });
  };

  const handleMenuDelete = () => {
    if (!selectedMenuDocId) return;
    if (!window.confirm('Delete this menu? This cannot be undone.')) return;
    runAction(() => deleteMenu(selectedMenuDocId), 'Menu deleted.').then(() => {
      setSelectedMenuDocId('');
      setMenuDraft({ ...emptyMenuDraft, items: [] });
    });
  };

  // Add a section heading
  const addSection = () => {
    const name = newEntryName.trim();
    if (!name) return;
    setMenuDraft((current) => ({
      ...current,
      items: [...current.items, { type: 'section', name }],
    }));
    setNewEntryName('');
  };

  // Add a dish item
  const addItem = () => {
    const name = newEntryName.trim();
    if (!name) return;
    setMenuDraft((current) => ({
      ...current,
      items: [...current.items, { type: 'item', name }],
    }));
    setNewEntryName('');
  };

  const removeEntry = (index) => {
    setMenuDraft((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const handleEntryKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItem();
    }
  };

  // ── Gallery CRUD ──────────────────────────────────────────
  const startNewGalleryImage = () => {
    setSelectedGalleryDocId('');
    setGalleryDraft({ ...emptyGalleryDraft });
  };

  const handleGallerySave = (event) => {
    event.preventDefault();
    if (!galleryDraft.url.trim()) return;
    runAction(
      () => saveGalleryImage(selectedGalleryDocId || null, galleryDraft, user),
      selectedGalleryDocId ? 'Gallery image updated.' : 'Gallery image added.'
    ).then(() => {
      if (!selectedGalleryDocId) {
        setGalleryDraft({ ...emptyGalleryDraft });
      }
    });
  };

  const handleGalleryDelete = (docId) => {
    if (!window.confirm('Delete this gallery image? This cannot be undone.')) return;
    runAction(() => deleteGalleryImage(docId), 'Gallery image deleted.').then(() => {
      if (selectedGalleryDocId === docId) {
        setSelectedGalleryDocId('');
        setGalleryDraft({ ...emptyGalleryDraft });
      }
    });
  };

  // ── FAQ CRUD ──────────────────────────────────────────────
  const startNewFaq = () => {
    setSelectedFaqDocId('');
    setFaqDraft({ ...emptyFaqDraft });
  };

  const handleFaqSave = (event) => {
    event.preventDefault();
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
    runAction(
      () => saveFaq(selectedFaqDocId || null, faqDraft, user),
      selectedFaqDocId ? 'FAQ updated.' : 'FAQ added.'
    ).then(() => {
      if (!selectedFaqDocId) {
        setFaqDraft({ ...emptyFaqDraft });
      }
    });
  };

  const handleFaqDelete = (docId) => {
    if (!window.confirm('Delete this FAQ? This cannot be undone.')) return;
    runAction(() => deleteFaq(docId), 'FAQ deleted.').then(() => {
      if (selectedFaqDocId === docId) {
        setSelectedFaqDocId('');
        setFaqDraft({ ...emptyFaqDraft });
      }
    });
  };

  // ── Review moderation ─────────────────────────────────────
  const handleApproveReview = (docId) => {
    runAction(
      () => updateTestimonial(docId, { status: 'Approved' }, user),
      'Review approved.'
    );
  };

  const handleRejectReview = (docId) => {
    runAction(
      () => updateTestimonial(docId, { status: 'Rejected' }, user),
      'Review rejected.'
    );
  };

  const handleDeleteReview = (docId) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;
    runAction(() => deleteTestimonial(docId), 'Review deleted.');
  };

  const visibleTestimonials = useMemo(() => {
    if (reviewFilter === 'All') return testimonialItems;
    return testimonialItems.filter((t) => (t.status || 'Pending') === reviewFilter);
  }, [testimonialItems, reviewFilter]);

  if (!authReady) {
    return <main className="admin-loading">Loading admin console…</main>;
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} isLoading={isLoggingIn} error={loginError} />;
  }

  return (
    <div className={`admin-shell${theme === 'light' ? ' theme-light' : ''}`}>
      {/* ── ORDER DETAIL OVERLAY ── */}
      {orderDetailOpen && selectedOrder && orderDraft && (
        <OrderDetailOverlay
          order={selectedOrder}
          draft={orderDraft}
          setDraft={setOrderDraft}
          onSave={handleOrderSave}
          onClose={closeOrderDetail}
          isSaving={isSaving}
        />
      )}

      {newOrderOpen && (
        <NewOrderOverlay
          draft={newOrderDraft}
          setDraft={setNewOrderDraft}
          onSave={handleCreateOrder}
          onClose={closeNewOrder}
          isSaving={isSaving}
        />
      )}

      {/* ─── SIDEBAR ──────────────────────────────────────── */}
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin">
          <span className="admin-brand-icon">AC</span>
          <span className="admin-brand-text">
            <strong>Aggarwal Ops</strong>
            <small>Admin Console</small>
          </span>
        </a>
        <nav aria-label="Admin navigation">
          {tabs.map(({ label, Icon }) => (
            <button
              key={label}
              className={activeTab === label ? 'active' : ''}
              type="button"
              onClick={() => setActiveTab(label)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="theme-switch">
          <button type="button" onClick={toggleTheme} title="Switch between dark and light theme">
            {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
        <div className="admin-account">
          <small>Signed in as</small>
          <strong>{user.email}</strong>
          <button type="button" onClick={signOutAdmin}>
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
          <a href="/">
            <ExternalLink size={13} aria-hidden="true" />
            Open website
          </a>
        </div>
      </aside>

      {/* ─── MAIN ─────────────────────────────────────────── */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-kicker">Realtime Operations</p>
            <h1>{activeTab}</h1>
            <span className="admin-subtitle">
              Inquiries, replies, orders, menus, and website controls — all in one Firebase workspace.
            </span>
          </div>
          <div className={`live-pill ${realtimeStatus.toLowerCase()}`}>
            <Signal size={14} aria-hidden="true" />
            {realtimeStatus} · {lastSyncText}
          </div>
        </header>

        {(notice || dataError) && (
          <div className={dataError ? 'admin-alert error' : 'admin-alert'} role="status">
            {dataError || notice}
          </div>
        )}

        {/* ─── OVERVIEW ─────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <section className="overview-grid">
            <StatCard label="New inquiries" value={metrics.newInquiries} detail="Waiting for first action" Icon={Inbox} variant="blue" />
            <StatCard label="Today's leads" value={metrics.todaysInquiries} detail="Fresh from the website" Icon={Zap} variant="amber" />
            <StatCard label="Active orders" value={metrics.activeOrders} detail="Not completed or cancelled" Icon={ClipboardList} variant="emerald" />
            <StatCard label="Quoted revenue" value={formatMoney(metrics.quotedRevenue)} detail="Across all orders" Icon={IndianRupee} variant="gold" />

            <section className="admin-panel admin-wide">
              <div className="panel-heading">
                <div>
                  <h2>Realtime inquiry desk</h2>
                  <p>New submissions appear here automatically, no refresh needed.</p>
                </div>
                <button type="button" onClick={() => setActiveTab('Inquiries')}>
                  View all
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="compact-list">
                {inquiries.slice(0, 5).map((inquiry) => (
                  <button
                    key={inquiry.docId}
                    type="button"
                    onClick={() => {
                      setSelectedInquiryId(inquiry.docId);
                      setActiveTab('Inquiries');
                    }}
                  >
                    <div>
                      <strong>{inquiry.name}</strong>
                      <span>{inquiry.eventType} · {formatDate(inquiry.startDate)}</span>
                    </div>
                    <em className={statusBadgeClass(inquiry.status)}>{inquiry.status}</em>
                  </button>
                ))}
                {!inquiries.length && (
                  <p className="empty-state">No inquiries yet. They'll appear here as they come in.</p>
                )}
              </div>
            </section>
          </section>
        )}

        {/* ─── INQUIRIES ────────────────────────────────── */}
        {activeTab === 'Inquiries' && (
          <section className="workspace-grid">
            <section className="admin-panel list-panel">
              <div className="inbox-head">
                <div>
                  <strong>{filteredInquiries.length}</strong>
                  <span>inquiries visible</span>
                </div>
                <em>{realtimeStatus}</em>
              </div>
              <div className="list-tools">
                <div className="search-field">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, phone, email, ref…"
                  />
                </div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option>All</option>
                  {inquiryStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="record-list">
                {filteredInquiries.map((inquiry) => (
                  <button
                    key={inquiry.docId}
                    className={selectedInquiry?.docId === inquiry.docId ? 'selected' : ''}
                    type="button"
                    onClick={() => setSelectedInquiryId(inquiry.docId)}
                  >
                    <span>
                      <strong>{inquiry.name}</strong>
                      <small>{inquiry.eventType} · {inquiry.id}</small>
                    </span>
                    <em className={statusBadgeClass(inquiry.status)}>{inquiry.status}</em>
                  </button>
                ))}
                {!filteredInquiries.length && (
                  <p className="empty-state">No matching inquiries.</p>
                )}
              </div>
            </section>

            <section className="detail-panel">
              {selectedInquiry ? (
                <div className="admin-panel">
                  <div className="detail-top">
                    <div>
                      <p className="admin-kicker">{selectedInquiry.id}</p>
                      <h2>{selectedInquiry.name}</h2>
                      <span>{selectedInquiry.eventType} · {formatDate(selectedInquiry.startDate)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          style={{ background: 'var(--a-emerald)' }}
                          disabled={isSaving}
                          onClick={() => handleAcceptInquiry(selectedInquiry)}
                          title="Accept inquiry and message customer on WhatsApp"
                        >
                          <CheckCircle size={14} aria-hidden="true" />
                          Accept
                        </button>
                        <button
                          type="button"
                          style={{ background: 'var(--a-rose)' }}
                          disabled={isSaving}
                          onClick={() => handleRejectInquiry(selectedInquiry)}
                          title="Reject inquiry and message customer on WhatsApp"
                        >
                          <XCircle size={14} aria-hidden="true" />
                          Reject
                        </button>
                      </div>
                      <select
                        value={selectedInquiry.status || 'New'}
                        onChange={(event) => {
                          const newStatus = event.target.value;
                          runAction(
                            () => updateInquiry(selectedInquiry.docId, { status: newStatus }),
                            'Status updated.'
                          );
                          if (newStatus === 'Closed') {
                            window.open(
                              buildRejectionWhatsAppUrl(selectedInquiry),
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }
                        }}
                      >
                        {inquiryStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <span>Phone</span>
                      <strong><PhoneCall size={13} aria-hidden="true" />{selectedInquiry.phone}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong><Mail size={13} aria-hidden="true" />{selectedInquiry.email}</strong>
                    </div>
                    <div>
                      <span>Guests</span>
                      <strong><Users size={13} aria-hidden="true" />{selectedInquiry.guests}</strong>
                    </div>
                    <div>
                      <span>Budget</span>
                      <strong>{formatMoney(selectedInquiry.budget)}</strong>
                    </div>
                    <div>
                      <span>Location</span>
                      <strong>{selectedInquiry.location}</strong>
                    </div>
                    <div>
                      <span>Submitted</span>
                      <strong>{formatDate(selectedInquiry.serverCreatedAt || selectedInquiry.createdAt)}</strong>
                    </div>
                  </div>

                  <div className="detail-copy">
                    <h3>Menu Selection</h3>
                    <p>
                      <strong style={{ color: 'var(--a-text)' }}>Package:</strong>{' '}
                      {selectedInquiry.selectedMenuName || 'Not specified'}
                    </p>
                    <p>
                      <strong style={{ color: 'var(--a-text)' }}>Items included:</strong>{' '}
                      {(selectedInquiry.selectedItems || []).join(', ') || 'Full menu / not specified'}
                    </p>
                    <p>
                      <strong style={{ color: 'var(--a-text)' }}>Requirements:</strong>{' '}
                      {selectedInquiry.requirements || 'None added.'}
                    </p>
                  </div>

                  {selectedInquiry.latestReply && (
                    <div className="latest-reply">
                      <span>Latest response via {selectedInquiry.latestReply.channel}</span>
                      <p>{selectedInquiry.latestReply.message}</p>
                    </div>
                  )}

                  <form className="reply-box" onSubmit={handleReply}>
                    <div className="reply-box-top">
                      <select
                        value={replyDraft.channel}
                        onChange={(event) =>
                          setReplyDraft((current) => ({ ...current, channel: event.target.value }))
                        }
                      >
                        <option>Phone</option>
                        <option>Email</option>
                        <option>WhatsApp</option>
                        <option>Meeting</option>
                      </select>
                      <a href={`mailto:${selectedInquiry.email}`}>
                        <Mail size={14} aria-hidden="true" />
                        Email
                      </a>
                      
                        href={`https://wa.me/${String(selectedInquiry.phone).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      <a>
                        <PhoneCall size={14} aria-hidden="true" />
                        WhatsApp
                      </a>
                    </div>
                    <textarea
                      value={replyDraft.message}
                      onChange={(event) =>
                        setReplyDraft((current) => ({ ...current, message: event.target.value }))
                      }
                      placeholder="Write the response or call summary. Saves to Firebase instantly for the team."
                      rows="4"
                    />
                    <div className="detail-actions">
                      <button type="submit" disabled={isSaving || !replyDraft.message.trim()}>
                        <MessageSquare size={14} aria-hidden="true" />
                        Save response
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || selectedInquiry.convertedToOrder}
                        onClick={handleConvertToOrder}
                      >
                        {selectedInquiry.convertedToOrder ? (
                          <><CheckCircle size={14} aria-hidden="true" />Order created</>
                        ) : (
                          <><FilePlus size={14} aria-hidden="true" />Convert to order</>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="admin-panel">
                  <p className="empty-state">Select an inquiry from the list to manage it.</p>
                </div>
              )}
            </section>
          </section>
        )}

        {/* ─── ORDERS ───────────────────────────────────── */}
        {activeTab === 'Orders' && (
          <section className="orders-page">
            <div className="admin-panel">
              <div className="order-subtabs">
                <button
                  type="button"
                  className={orderSubTab === 'Upcoming' ? 'active' : ''}
                  onClick={() => setOrderSubTab('Upcoming')}
                >
                  Upcoming orders
                  <span className="order-subtab-count">{upcomingOrders.length}</span>
                </button>
                <button
                  type="button"
                  className={orderSubTab === 'Completed' ? 'active' : ''}
                  onClick={() => setOrderSubTab('Completed')}
                >
                  Completed orders
                  <span className="order-subtab-count">{completedOrders.length}</span>
                </button>
                <button
                  type="button"
                  className={orderSubTab === 'Cancelled' ? 'active' : ''}
                  onClick={() => setOrderSubTab('Cancelled')}
                >
                  Cancelled orders
                  <span className="order-subtab-count">{cancelledOrders.length}</span>
                </button>
              </div>

              {/* Toolbar: search + status filter */}
              <div className="order-toolbar">
                <div className="search-field order-search-field">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Search customer, phone, email, location, ref…"
                  />
                </div>
                <select
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value)}
                  className="order-status-filter"
                >
                  <option>All</option>
                  {(orderSubTab === 'Upcoming'
                    ? orderStatuses.filter((s) => !['Completed', 'Cancelled'].includes(s))
                    : orderSubTab === 'Completed'
                    ? orderStatuses.filter((s) => s === 'Completed')
                    : orderStatuses.filter((s) => s === 'Cancelled')
                  ).map((status) => <option key={status}>{status}</option>)}
                </select>
                <span className="order-toolbar-count">
                  {visibleOrders.length} of{' '}
                  {orderSubTab === 'Upcoming'
                    ? upcomingOrders.length
                    : orderSubTab === 'Completed'
                    ? completedOrders.length
                    : cancelledOrders.length}
                </span>
                <span className="order-toolbar-hint">Click any cell to edit directly</span>
                <button type="button" onClick={openNewOrder} title="Add a new order manually">
                  <Plus size={14} aria-hidden="true" />
                  Add order
                </button>
              </div>

              {/* Real spreadsheet table */}
              <div className="sheet-scroll">
                <table className="orders-sheet">
                  <thead>
                    <tr>
                      <th className="sheet-th-sortable" onClick={() => toggleOrderSort('customerName')}>
                        <span>
                          Customer
                          {orderSort.field === 'customerName'
                            ? (orderSort.direction === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
                            : <ArrowUpDown size={11} className="sheet-th-icon-idle" aria-hidden="true" />}
                        </span>
                      </th>
                      <th className="sheet-th-sortable" onClick={() => toggleOrderSort('eventType')}>
                        <span>
                          Event
                          {orderSort.field === 'eventType'
                            ? (orderSort.direction === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
                            : <ArrowUpDown size={11} className="sheet-th-icon-idle" aria-hidden="true" />}
                        </span>
                      </th>
                      <th className="sheet-th-sortable" onClick={() => toggleOrderSort('eventDate')}>
                        <span>
                          Date
                          {orderSort.field === 'eventDate'
                            ? (orderSort.direction === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
                            : <ArrowUpDown size={11} className="sheet-th-icon-idle" aria-hidden="true" />}
                        </span>
                      </th>
                      <th className="sheet-th-sortable" onClick={() => toggleOrderSort('guests')}>
                        <span>
                          Guests
                          {orderSort.field === 'guests'
                            ? (orderSort.direction === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
                            : <ArrowUpDown size={11} className="sheet-th-icon-idle" aria-hidden="true" />}
                        </span>
                      </th>
                      <th className="sheet-th-sortable" onClick={() => toggleOrderSort('quotedAmount')}>
                        <span>
                          Amount (₹)
                          {orderSort.field === 'quotedAmount'
                            ? (orderSort.direction === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
                            : <ArrowUpDown size={11} className="sheet-th-icon-idle" aria-hidden="true" />}
                        </span>
                      </th>
                      <th>Payment</th>
                      <th className="sheet-th-sortable" onClick={() => toggleOrderSort('orderStatus')}>
                        <span>
                          Status
                          {orderSort.field === 'orderStatus'
                            ? (orderSort.direction === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
                            : <ArrowUpDown size={11} className="sheet-th-icon-idle" aria-hidden="true" />}
                        </span>
                      </th>
                      <th className="sheet-th-open"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order, idx) => (
                      <tr key={order.docId} className={idx % 2 === 1 ? 'sheet-row-alt' : ''}>
                        <td className="sheet-td-customer">
                          <strong>{order.customerName}</strong>
                          <small>{order.inquiryReferenceId}</small>
                        </td>
                        <td>{order.eventType}</td>
                        <td className="sheet-td-editable">
                          <input
                            type="date"
                            defaultValue={order.eventDate || ''}
                            onBlur={(event) => {
                              if (event.target.value !== (order.eventDate || '')) {
                                handleInlineCellEdit(order.docId, 'eventDate', event.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="sheet-td-editable sheet-td-narrow">
                          <input
                            type="number"
                            defaultValue={order.guests || 0}
                            onBlur={(event) => {
                              if (Number(event.target.value) !== Number(order.guests || 0)) {
                                handleInlineCellEdit(order.docId, 'guests', event.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="sheet-td-editable">
                          <input
                            type="number"
                            defaultValue={order.quotedAmount || 0}
                            onBlur={(event) => {
                              if (Number(event.target.value) !== Number(order.quotedAmount || 0)) {
                                handleInlineCellEdit(order.docId, 'quotedAmount', event.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="sheet-td-editable">
                          <select
                            value={order.paymentStatus || 'Pending'}
                            onChange={(event) => handleInlineCellEdit(order.docId, 'paymentStatus', event.target.value)}
                          >
                            {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </td>
                        <td className="sheet-td-editable">
                          <select
                            className={`sheet-status-select ${statusBadgeClass(order.orderStatus)}`}
                            value={order.orderStatus || 'Planning'}
                            onChange={(event) => handleInlineCellEdit(order.docId, 'orderStatus', event.target.value)}
                          >
                            {orderStatuses.map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </td>
                        <td className="sheet-td-open">
                          <button type="button" onClick={() => openOrderDetail(order.docId)} title="Open full order page">
                            <ExternalLink size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleOrders.length && orders.length > 0 && (
                  <p className="empty-state">No orders match your search or filter.</p>
                )}
                {!orders.length && (
                  <p className="empty-state">Convert an inquiry to create the first order.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── MENUS ────────────────────────────────────── */}
        {activeTab === 'Menus' && (
          <section className="workspace-grid">
            {/* Left: menu list */}
            <section className="admin-panel list-panel">
              <div className="panel-heading">
                <div>
                  <h2>Menu packages</h2>
                  <p>{menus.length} package{menus.length !== 1 ? 's' : ''} on the website</p>
                </div>
                <button type="button" onClick={startNewMenu}>
                  <Plus size={14} aria-hidden="true" />
                  New menu
                </button>
              </div>
              <div className="record-list">
                {menus.map((menu) => (
                  <button
                    key={menu.docId}
                    className={selectedMenuDocId === menu.docId ? 'selected' : ''}
                    type="button"
                    onClick={() => setSelectedMenuDocId(menu.docId)}
                  >
                    <span>
                      <strong>{menu.name}</strong>
                      <small>{countDishes(menu.items)} dishes · {menu.tag || 'Package'}</small>
                    </span>
                  </button>
                ))}
                {!menus.length && (
                  <p className="empty-state">No menus yet. Click "New menu" to create the first one.</p>
                )}
              </div>
            </section>

            {/* Right: menu editor */}
            <section className="detail-panel">
              <div className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{selectedMenuDocId ? 'Edit menu' : 'New menu'}</h2>
                    <p>Changes save to Firebase and update the website instantly.</p>
                  </div>
                  {selectedMenuDocId && (
                    <button
                      type="button"
                      onClick={handleMenuDelete}
                      disabled={isSaving}
                      style={{ background: 'var(--a-rose-pale)', color: 'var(--a-rose)', border: '1px solid rgba(248,81,73,0.2)' }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>

                <form className="menu-editor-form" onSubmit={handleMenuSave}>
                  <div className="menu-editor-body">
                    {/* Basic info */}
                    <div className="form-columns">
                      <label>
                        Menu name
                        <input
                          value={menuDraft.name}
                          onChange={(event) =>
                            setMenuDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="e.g. Silver Package"
                          required
                        />
                      </label>
                      <label>
                        Tag / label
                        <input
                          value={menuDraft.tag}
                          onChange={(event) =>
                            setMenuDraft((current) => ({ ...current, tag: event.target.value }))
                          }
                          placeholder="e.g. Popular, Premium, Budget"
                        />
                      </label>
                      <label>
                        Price per plate
                        <input
                          value={menuDraft.pricePerPlate}
                          onChange={(event) =>
                            setMenuDraft((current) => ({ ...current, pricePerPlate: event.target.value }))
                          }
                          placeholder="e.g. ₹800 – ₹1,200"
                        />
                      </label>
                    </div>
                    <label className="wide-field">
                      Description
                      <textarea
                        value={menuDraft.description}
                        onChange={(event) =>
                          setMenuDraft((current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder="Short description shown to customers on the website."
                        rows="2"
                      />
                    </label>

                    {/* Items + sections editor */}
                    <div className="menu-items-section">
                      <div className="menu-items-header">
                        <span className="menu-items-label">Menu contents</span>
                        <span className="menu-items-count">
                          {countDishes(menuDraft.items)} dish{countDishes(menuDraft.items) !== 1 ? 'es' : ''}
                          {menuDraft.items.filter(e => e.type === 'section').length > 0 &&
                            ` · ${menuDraft.items.filter(e => e.type === 'section').length} section${menuDraft.items.filter(e => e.type === 'section').length !== 1 ? 's' : ''}`
                          }
                        </span>
                      </div>
                      <p className="menu-items-hint">
                        Add section headings to group dishes (e.g. "Starters", "Main Course"). Customers can uncheck individual dishes.
                      </p>

                      {/* Add entry row */}
                      <div className="menu-entry-add-row">
                        <input
                          value={newEntryName}
                          onChange={(event) => setNewEntryName(event.target.value)}
                          onKeyDown={handleEntryKeyDown}
                          placeholder="Type a section name or dish name…"
                        />
                        <div className="menu-entry-add-buttons">
                          <button
                            type="button"
                            className="btn-add-section"
                            onClick={addSection}
                            disabled={!newEntryName.trim()}
                            title="Add as a section heading"
                          >
                            <Heading size={13} aria-hidden="true" />
                            Add Section
                          </button>
                          <button
                            type="button"
                            className="btn-add-item"
                            onClick={addItem}
                            disabled={!newEntryName.trim()}
                            title="Add as a dish item"
                          >
                            <Plus size={13} aria-hidden="true" />
                            Add Dish
                          </button>
                        </div>
                      </div>

                      {/* Contents list */}
                      {menuDraft.items.length > 0 && (
                        <div className="menu-items-list">
                          {menuDraft.items.map((entry, index) => (
                            entry.type === 'section' ? (
                              <div className="menu-entry-row menu-entry-section" key={index}>
                                <GripVertical size={13} className="menu-entry-grip" aria-hidden="true" />
                                <Heading size={13} className="menu-entry-type-icon" aria-hidden="true" />
                                <span className="menu-entry-name">{entry.name}</span>
                                <button
                                  type="button"
                                  className="menu-item-remove"
                                  onClick={() => removeEntry(index)}
                                  aria-label={`Remove section ${entry.name}`}
                                >
                                  <Trash2 size={12} aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <div className="menu-entry-row menu-entry-dish" key={index}>
                                <GripVertical size={13} className="menu-entry-grip" aria-hidden="true" />
                                <span className="menu-entry-dish-dot" aria-hidden="true" />
                                <span className="menu-entry-name">{entry.name}</span>
                                <button
                                  type="button"
                                  className="menu-item-remove"
                                  onClick={() => removeEntry(index)}
                                  aria-label={`Remove ${entry.name}`}
                                >
                                  <Trash2 size={12} aria-hidden="true" />
                                </button>
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      {menuDraft.items.length === 0 && (
                        <p className="empty-state" style={{ padding: '20px 0 4px' }}>
                          No contents yet. Add a section or a dish above.
                        </p>
                      )}
                    </div>

                    <div style={{ paddingTop: '4px' }}>
                      <button type="submit" disabled={isSaving || !menuDraft.name.trim()}>
                        <Save size={14} aria-hidden="true" />
                        {isSaving ? 'Saving…' : selectedMenuDocId ? 'Save changes' : 'Create menu'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </section>
        )}

        {/* ─── GALLERY ──────────────────────────────────── */}
        {activeTab === 'Gallery' && (
          <section className="workspace-grid">
            <section className="admin-panel list-panel">
              <div className="panel-heading">
                <div>
                  <h2>Gallery photos</h2>
                  <p>{galleryItems.length} photo{galleryItems.length !== 1 ? 's' : ''} on the website</p>
                </div>
                <button type="button" onClick={startNewGalleryImage}>
                  <Plus size={14} aria-hidden="true" />
                  New photo
                </button>
              </div>
              <div className="record-list">
                {galleryItems.map((img) => (
                  <button
                    key={img.docId}
                    className={selectedGalleryDocId === img.docId ? 'selected' : ''}
                    type="button"
                    onClick={() => setSelectedGalleryDocId(img.docId)}
                  >
                    <span>
                      <strong>{img.title || 'Untitled photo'}</strong>
                      <small>{img.caption || 'No caption'}</small>
                    </span>
                  </button>
                ))}
                {!galleryItems.length && (
                  <p className="empty-state">No gallery photos yet. Click "New photo" to add one.</p>
                )}
              </div>
            </section>

            <section className="detail-panel">
              <div className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{selectedGalleryDocId ? 'Edit photo' : 'New photo'}</h2>
                    <p>Paste an image URL (e.g. from Unsplash, your own hosting, or Firebase Storage).</p>
                  </div>
                  {selectedGalleryDocId && (
                    <button
                      type="button"
                      onClick={() => handleGalleryDelete(selectedGalleryDocId)}
                      disabled={isSaving}
                      style={{ background: 'var(--a-rose-pale)', color: 'var(--a-rose)', border: '1px solid rgba(248,81,73,0.2)' }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>

                <form className="menu-editor-form" onSubmit={handleGallerySave}>
                  <div className="menu-editor-body">
                    <label className="wide-field">
                      Image URL
                      <input
                        value={galleryDraft.url}
                        onChange={(event) => setGalleryDraft((current) => ({ ...current, url: event.target.value }))}
                        placeholder="https://..."
                        required
                      />
                    </label>
                    <div className="form-columns">
                      <label>
                        Title (optional)
                        <input
                          value={galleryDraft.title}
                          onChange={(event) => setGalleryDraft((current) => ({ ...current, title: event.target.value }))}
                          placeholder="e.g. Wedding Setup"
                        />
                      </label>
                      <label>
                        Display order
                        <input
                          type="number"
                          value={galleryDraft.order}
                          onChange={(event) => setGalleryDraft((current) => ({ ...current, order: event.target.value }))}
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <label className="wide-field">
                      Caption (optional)
                      <textarea
                        value={galleryDraft.caption}
                        onChange={(event) => setGalleryDraft((current) => ({ ...current, caption: event.target.value }))}
                        rows="2"
                        placeholder="Shown when the photo is opened in the lightbox."
                      />
                    </label>

                    {galleryDraft.url && (
                      <div style={{ marginTop: '4px' }}>
                        <img
                          src={galleryDraft.url}
                          alt="Preview"
                          style={{ maxWidth: '260px', borderRadius: '10px', display: 'block' }}
                        />
                      </div>
                    )}

                    <div style={{ paddingTop: '4px' }}>
                      <button type="submit" disabled={isSaving || !galleryDraft.url.trim()}>
                        <Save size={14} aria-hidden="true" />
                        {isSaving ? 'Saving…' : selectedGalleryDocId ? 'Save changes' : 'Add photo'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </section>
        )}

        {/* ─── FAQs ─────────────────────────────────────── */}
        {activeTab === 'FAQs' && (
          <section className="workspace-grid">
            <section className="admin-panel list-panel">
              <div className="panel-heading">
                <div>
                  <h2>FAQs</h2>
                  <p>{faqItems.length} question{faqItems.length !== 1 ? 's' : ''} on the website</p>
                </div>
                <button type="button" onClick={startNewFaq}>
                  <Plus size={14} aria-hidden="true" />
                  New FAQ
                </button>
              </div>
              <div className="record-list">
                {faqItems.map((faq) => (
                  <button
                    key={faq.docId}
                    className={selectedFaqDocId === faq.docId ? 'selected' : ''}
                    type="button"
                    onClick={() => setSelectedFaqDocId(faq.docId)}
                  >
                    <span>
                      <strong>{faq.question}</strong>
                    </span>
                  </button>
                ))}
                {!faqItems.length && (
                  <p className="empty-state">No FAQs yet. Click "New FAQ" to add one (defaults show on site until then).</p>
                )}
              </div>
            </section>

            <section className="detail-panel">
              <div className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{selectedFaqDocId ? 'Edit FAQ' : 'New FAQ'}</h2>
                    <p>Changes save to Firebase and update the website instantly.</p>
                  </div>
                  {selectedFaqDocId && (
                    <button
                      type="button"
                      onClick={() => handleFaqDelete(selectedFaqDocId)}
                      disabled={isSaving}
                      style={{ background: 'var(--a-rose-pale)', color: 'var(--a-rose)', border: '1px solid rgba(248,81,73,0.2)' }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>

                <form className="menu-editor-form" onSubmit={handleFaqSave}>
                  <div className="menu-editor-body">
                    <label className="wide-field">
                      Question
                      <input
                        value={faqDraft.question}
                        onChange={(event) => setFaqDraft((current) => ({ ...current, question: event.target.value }))}
                        placeholder="e.g. Do you cater outside Delhi NCR?"
                        required
                      />
                    </label>
                    <label className="wide-field">
                      Answer
                      <textarea
                        value={faqDraft.answer}
                        onChange={(event) => setFaqDraft((current) => ({ ...current, answer: event.target.value }))}
                        rows="4"
                        placeholder="Write the full answer shown to customers."
                        required
                      />
                    </label>
                    <label>
                      Display order
                      <input
                        type="number"
                        value={faqDraft.order}
                        onChange={(event) => setFaqDraft((current) => ({ ...current, order: event.target.value }))}
                        placeholder="0"
                      />
                    </label>

                    <div style={{ paddingTop: '4px' }}>
                      <button type="submit" disabled={isSaving || !faqDraft.question.trim() || !faqDraft.answer.trim()}>
                        <Save size={14} aria-hidden="true" />
                        {isSaving ? 'Saving…' : selectedFaqDocId ? 'Save changes' : 'Add FAQ'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </section>
        )}

        {/* ─── REVIEWS ──────────────────────────────────── */}
        {activeTab === 'Reviews' && (
          <section className="orders-page">
            <div className="admin-panel">
              <div className="panel-heading">
                <div>
                  <h2>Customer reviews</h2>
                  <p>4-5 star reviews go live instantly. 3 stars or below need your approval.</p>
                </div>
                <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                  <option>All</option>
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                </select>
              </div>

              <div className="record-list">
                {visibleTestimonials.map((t) => (
                  <div key={t.docId} className="admin-panel" style={{ marginBottom: '12px', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <strong>{t.name}</strong>
                          {t.eventType && <small style={{ color: 'var(--a-text-3)' }}>· {t.eventType}</small>}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              fill={s <= (t.rating || 0) ? 'currentColor' : 'none'}
                              style={{ color: s <= (t.rating || 0) ? 'var(--a-gold, #C8892A)' : 'var(--a-text-3)' }}
                            />
                          ))}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--a-text-2)', lineHeight: '1.6' }}>{t.text}</p>
                      </div>
                      <em className={statusBadgeClass(t.status || 'Pending')}>{t.status || 'Pending'}</em>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                      {t.status !== 'Approved' && (
                        <button
                          type="button"
                          style={{ background: 'var(--a-emerald)' }}
                          disabled={isSaving}
                          onClick={() => handleApproveReview(t.docId)}
                        >
                          <CheckCircle size={14} aria-hidden="true" />
                          Approve
                        </button>
                      )}
                      {t.status !== 'Rejected' && (
                        <button
                          type="button"
                          style={{ background: 'var(--a-rose)' }}
                          disabled={isSaving}
                          onClick={() => handleRejectReview(t.docId)}
                        >
                          <XCircle size={14} aria-hidden="true" />
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(t.docId)}
                        disabled={isSaving}
                        style={{ background: 'var(--a-rose-pale)', color: 'var(--a-rose)', border: '1px solid rgba(248,81,73,0.2)' }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!visibleTestimonials.length && (
                  <p className="empty-state">No reviews match this filter.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── SETTINGS ─────────────────────────────────── */}
        {activeTab === 'Main App' && (
          <section className="settings-panel">
            <div className="admin-panel">
              <div className="panel-heading">
                <div>
                  <h2>Main app controls</h2>
                  <p>These settings are stored in Firebase and update the public website instantly.</p>
                </div>
                <span style={{ fontSize: '0.76rem', color: 'var(--a-text-3)' }}>
                  Last saved: {formatDate(settings.updatedAt)}
                </span>
              </div>
              <form className="settings-form" onSubmit={handleSettingsSave}>
                <label>
                  Business phone
                  <input
                    value={settingsDraft.businessPhone || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, businessPhone: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Business email
                  <input
                    type="email"
                    value={settingsDraft.businessEmail || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, businessEmail: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Service area
                  <input
                    value={settingsDraft.serviceArea || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, serviceArea: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Booking status
                  <select
                    value={settingsDraft.bookingStatus || 'Open'}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, bookingStatus: event.target.value }))
                    }
                  >
                    <option>Open</option>
                    <option>Limited</option>
                    <option>Closed</option>
                  </select>
                </label>
                <label>
                  Response window
                  <input
                    value={settingsDraft.responseWindow || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, responseWindow: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Google rating (out of 5)
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={settingsDraft.googleRating || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, googleRating: event.target.value }))
                    }
                    placeholder="e.g. 4.8"
                  />
                </label>
                <label>
                  Google review count
                  <input
                    value={settingsDraft.googleReviewCount || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, googleReviewCount: event.target.value }))
                    }
                    placeholder="e.g. 200+"
                  />
                </label>
                <label className="wide-field">
                  Announcement banner
                  <textarea
                    value={settingsDraft.announcement || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, announcement: event.target.value }))
                    }
                    rows="3"
                    placeholder="Optional. Leave empty to hide the banner on the website."
                  />
                </label>
                <button type="submit" disabled={isSaving}>
                  <Save size={15} aria-hidden="true" />
                  {isSaving ? 'Saving…' : 'Save settings'}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default AdminApp;