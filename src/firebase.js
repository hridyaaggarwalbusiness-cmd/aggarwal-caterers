import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBT7PUBNDq20TPkOXwkUcEG_4o-wMksr60',
  authDomain: 'aggarwal-caterers.firebaseapp.com',
  projectId: 'aggarwal-caterers',
  storageBucket: 'aggarwal-caterers.firebasestorage.app',
  messagingSenderId: '24443576408',
  appId: '1:24443576408:web:a5da96202933d4b547ea2d',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export async function createCateringInquiry(inquiry) {
  const docRef = await addDoc(collection(db, 'inquiries'), {
    ...inquiry,
    source: 'customer-web',
    status: inquiry.status || 'New',
    serverCreatedAt: serverTimestamp(),
  });

  return {
    ...inquiry,
    firebaseDocId: docRef.id,
  };
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function signInAdmin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutAdmin() {
  return signOut(auth);
}

export function subscribeToInquiries(callback, onError) {
  const inquiriesQuery = query(collection(db, 'inquiries'), orderBy('serverCreatedAt', 'desc'));

  return onSnapshot(
    inquiriesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((document) => ({ docId: document.id, ...document.data() })));
    },
    onError
  );
}

export function subscribeToOrders(callback, onError) {
  const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      callback(snapshot.docs.map((document) => ({ docId: document.id, ...document.data() })));
    },
    onError
  );
}

export function subscribeToMenus(callback, onError) {
  const menusQuery = query(collection(db, 'menus'), orderBy('createdAt', 'asc'));

  return onSnapshot(
    menusQuery,
    (snapshot) => {
      callback(snapshot.docs.map((document) => ({ docId: document.id, ...document.data() })));
    },
    onError
  );
}

function sortPublicContent(items) {
  return [...items].sort((a, b) => {
    const aOrder = Number(a.order ?? a.sortOrder ?? a.position ?? 0);
    const bOrder = Number(b.order ?? b.sortOrder ?? b.position ?? 0);

    if (aOrder !== bOrder) return aOrder - bOrder;

    const aCreatedAt = a.createdAt?.seconds ?? 0;
    const bCreatedAt = b.createdAt?.seconds ?? 0;

    return aCreatedAt - bCreatedAt;
  });
}

export function subscribeToTestimonials(callback, onError) {
  return onSnapshot(
    collection(db, 'testimonials'),
    (snapshot) => {
      callback(sortPublicContent(snapshot.docs.map((document) => ({ docId: document.id, ...document.data() }))));
    },
    onError
  );
}

// Public visitors call this to submit a new review.
// 4 or 5 star reviews are auto-approved and go live instantly.
// Reviews with 3 stars or fewer, or with no rating provided, are saved as
// "Pending" and require admin approval before they appear publicly.
export async function submitPublicReview(review) {
  const rating = Number(review.rating) || 0;
  const status = rating >= 4 ? 'Approved' : 'Pending';

  const docRef = await addDoc(collection(db, 'testimonials'), {
    name: review.name.trim(),
    eventType: review.eventType || '',
    rating: rating || 0,
    text: review.text.trim(),
    status,
    source: 'customer-web',
    createdAt: serverTimestamp(),
  });

  return { docId: docRef.id };
}

export function subscribeToGallery(callback, onError) {
  return onSnapshot(
    collection(db, 'gallery'),
    (snapshot) => {
      callback(sortPublicContent(snapshot.docs.map((document) => ({ docId: document.id, ...document.data() }))));
    },
    onError
  );
}

export function subscribeToFaqs(callback, onError) {
  return onSnapshot(
    collection(db, 'faqs'),
    (snapshot) => {
      callback(sortPublicContent(snapshot.docs.map((document) => ({ docId: document.id, ...document.data() }))));
    },
    onError
  );
}

export function updateInquiry(inquiryDocId, updates) {
  return updateDoc(doc(db, 'inquiries', inquiryDocId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function respondToInquiry(inquiryDocId, response, user) {
  const reply = {
    message: response.message.trim(),
    channel: response.channel,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByEmail: user.email,
  };

  await addDoc(collection(db, 'inquiries', inquiryDocId, 'responses'), reply);
  return updateDoc(doc(db, 'inquiries', inquiryDocId), {
    latestReply: reply,
    status: 'Responded',
    updatedAt: serverTimestamp(),
  });
}

export async function createOrderFromInquiry(inquiry, user) {
  const orderDoc = await addDoc(collection(db, 'orders'), {
    inquiryDocId: inquiry.docId,
    inquiryReferenceId: inquiry.id,
    customerName: inquiry.name,
    customerPhone: inquiry.phone,
    customerEmail: inquiry.email,
    eventType: inquiry.eventType,
    eventDate: inquiry.startDate,
    eventEndDate: inquiry.endDate || '',
    preferredTime: inquiry.preferredTime || '',
    location: inquiry.location,
    guests: inquiry.guests,
    estimatedBudget: inquiry.budget,
    selectedMenuId: inquiry.selectedMenuId || '',
    selectedMenuName: inquiry.selectedMenuName || '',
    selectedItems: inquiry.selectedItems || [],
    requirements: inquiry.requirements || '',
    orderStatus: 'Planning',
    paymentStatus: 'Pending',
    quotedAmount: inquiry.budget || 0,
    menuNotes: '',
    operationsNotes: '',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByEmail: user.email,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'inquiries', inquiry.docId), {
    status: 'Converted',
    convertedToOrder: true,
    orderDocId: orderDoc.id,
    updatedAt: serverTimestamp(),
  });

  return orderDoc;
}

// Manually create an order from the admin console, with no source inquiry.
// Generates its own reference ID (prefixed MANUAL-) since there is no inquiry.id to reuse.
export async function createOrder(orderData, user) {
  const inquiryReferenceId = `MANUAL-${Date.now().toString().slice(-6)}`;

  const orderDoc = await addDoc(collection(db, 'orders'), {
    inquiryDocId: '',
    inquiryReferenceId,
    customerName: orderData.customerName || '',
    customerPhone: orderData.customerPhone || '',
    customerEmail: orderData.customerEmail || '',
    eventType: orderData.eventType || '',
    eventDate: orderData.eventDate || '',
    eventEndDate: orderData.eventEndDate || '',
    preferredTime: orderData.preferredTime || '',
    location: orderData.location || '',
    guests: Number(orderData.guests || 0),
    estimatedBudget: Number(orderData.quotedAmount || 0),
    selectedMenuId: orderData.selectedMenuId || '',
    selectedMenuName: orderData.selectedMenuName || '',
    selectedItems: orderData.selectedItems || [],
    requirements: orderData.requirements || '',
    orderStatus: orderData.orderStatus || 'Planning',
    paymentStatus: orderData.paymentStatus || 'Pending',
    quotedAmount: Number(orderData.quotedAmount || 0),
    menuNotes: orderData.menuNotes || '',
    operationsNotes: orderData.operationsNotes || '',
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByEmail: user.email,
    updatedAt: serverTimestamp(),
  });

  return orderDoc;
}

export function updateOrder(orderDocId, updates) {
  return updateDoc(doc(db, 'orders', orderDocId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function saveMenu(docId, menuData, user) {
  const payload = {
    name: menuData.name.trim(),
    tag: menuData.tag.trim(),
    description: menuData.description.trim(),
    pricePerPlate: (menuData.pricePerPlate || '').toString().trim(),
    items: menuData.items.map((item) => ({ type: item.type || 'item', name: item.name })),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByEmail: user.email,
  };

  if (docId) {
    return updateDoc(doc(db, 'menus', docId), payload);
  }

  return addDoc(collection(db, 'menus'), {
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByEmail: user.email,
  });
}

export function deleteMenu(docId) {
  return deleteDoc(doc(db, 'menus', docId));
}

export function subscribeToSiteSettings(callback, onError) {
  return onSnapshot(doc(db, 'siteSettings', 'main'), callback, onError);
}

export function subscribeToPublicSiteSettings(callback, onError) {
  return onSnapshot(doc(db, 'siteSettings', 'main'), callback, onError);
}

export function saveSiteSettings(settings, user) {
  return setDoc(
    doc(db, 'siteSettings', 'main'),
    {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      updatedByEmail: user.email,
    },
    { merge: true }
  );
}

// ── Gallery management (admin) ──────────────────────────────
export async function saveGalleryImage(docId, data, user) {
  const payload = {
    url: (data.url || '').trim(),
    caption: (data.caption || '').trim(),
    title: (data.title || '').trim(),
    order: Number(data.order || 0),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByEmail: user.email,
  };

  if (docId) {
    return updateDoc(doc(db, 'gallery', docId), payload);
  }

  return addDoc(collection(db, 'gallery'), {
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByEmail: user.email,
  });
}

export function deleteGalleryImage(docId) {
  return deleteDoc(doc(db, 'gallery', docId));
}

// ── FAQ management (admin) ───────────────────────────────────
export async function saveFaq(docId, data, user) {
  const payload = {
    question: (data.question || '').trim(),
    answer: (data.answer || '').trim(),
    order: Number(data.order || 0),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByEmail: user.email,
  };

  if (docId) {
    return updateDoc(doc(db, 'faqs', docId), payload);
  }

  return addDoc(collection(db, 'faqs'), {
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByEmail: user.email,
  });
}

export function deleteFaq(docId) {
  return deleteDoc(doc(db, 'faqs', docId));
}

// ── Review / testimonial moderation (admin) ──────────────────
export function updateTestimonial(docId, updates, user) {
  return updateDoc(doc(db, 'testimonials', docId), {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByEmail: user.email,
  });
}

export function deleteTestimonial(docId) {
  return deleteDoc(doc(db, 'testimonials', docId));
}

export { app, auth, db };