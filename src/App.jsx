import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { 
  Menu, X, CreditCard, History, LogOut, 
  Plus, Trash2, Edit, DollarSign, Bell, QrCode,
  CheckCircle, AlertTriangle, Share2, Wallet, 
  ShieldCheck, Loader, Lock, LayoutDashboard, Zap, Mail, Key, Globe, User
} from 'lucide-react';

// --- FIREBASE SETUP (INTEGRATED FOR SINGLE FILE PREVIEW) ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, getDocs, 
  doc, updateDoc, onSnapshot, query, where, setDoc 
} from "firebase/firestore";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword 
} from "firebase/auth";

/**
 * 🔒 SAFE ENV ACCESS
 * Helper để lấy biến môi trường an toàn trong cả 2 môi trường (Vite & Process)
 */
const getEnv = (key) => {
  try {
    // Ưu tiên import.meta.env (Vite)
    if (import.meta && import.meta.env && import.meta.env[key]) {
        return import.meta.env[key];
    }
    // Fallback sang process.env (Node/Webpack)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {}
  return undefined;
};

// Cấu hình Firebase
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || getEnv('REACT_APP_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID') || getEnv('REACT_APP_FIREBASE_APP_ID')
};

// Khởi tạo biến toàn cục
let db = null;
let auth = null;

try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    // Tắt log trong production
    if (process.env.NODE_ENV === 'production') {
        console.log = function() {}; 
    }
  } else {
      console.warn("⚠️ Running in Demo Mode (No Firebase Config Found)");
  }
} catch (e) { console.error("Firebase init error", e); }

/**
 * 🛡️ SECURITY LAYER: CSP
 */
const SecurityGuard = memo(() => {
    useEffect(() => {
        const meta = document.createElement('meta');
        meta.httpEquiv = "Content-Security-Policy";
        meta.content = "default-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.google.com; img-src 'self' data: https: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com;";
        document.head.appendChild(meta);
        return () => { document.head.removeChild(meta); }
    }, []);
    return null;
});

/**
 * 🎨 VISUAL EFFECTS
 */
const ParticleCursor = memo(() => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor(x, y) {
        this.x = x; this.y = y;
        this.size = Math.random() * 5 + 1; 
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 3 - 1.5;
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`; 
        this.life = 100;
      }
      update() {
        this.x += this.speedX; this.y += this.speedY;
        this.size *= 0.95; this.life -= 2;
      }
      draw() {
        ctx.fillStyle = this.color; ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      }
    }

    const handleMove = (e) => {
      const x = e.clientX || (e.touches && e.touches[0].clientX);
      const y = e.clientY || (e.touches && e.touches[0].clientY);
      for(let i=0; i<2; i++) particles.push(new Particle(x, y));
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(); particles[i].draw();
        if (particles[i].life <= 0 || particles[i].size <= 0.2) {
          particles.splice(i, 1); i--;
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[9999]" />;
});

// --- HOOKS & UTILS ---
const formatVND = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const useAppStore = () => {
  const [data, setData] = useState({ users: [], products: [], orders: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!db) { 
        // Fallback LocalStorage nếu không có Firebase Key
        const load = (k) => JSON.parse(localStorage.getItem(`shop_${k}`)) || [];
        setData({
            users: load('users'), products: load('products'),
            orders: load('orders'), transactions: load('transactions')
        });
        setLoading(false); 
        return; 
    }
    const unsubscribes = ['users', 'products', 'orders', 'transactions'].map(key => 
        onSnapshot(collection(db, key), (s) => {
            setData(prev => ({ ...prev, [key]: s.docs.map(d => ({...d.data(), id: d.id})) }));
            if(key === 'users') setLoading(false);
        })
    );
    return () => unsubscribes.forEach(u => u());
  }, []);

  useEffect(() => {
    if(currentUser) {
        const fresh = data.users.find(u => u.id === currentUser.id);
        if(fresh && (fresh.depositWallet !== currentUser.depositWallet)) setCurrentUser(fresh);
    }
  }, [data.users, currentUser]);

  const addData = async (coll, docData) => {
      const cleanData = { ...docData, createdAt: new Date().toISOString() };
      if(db) {
          await addDoc(collection(db, coll), cleanData);
      } else {
          // LocalStorage fallback logic
          const current = JSON.parse(localStorage.getItem(`shop_${coll}`)) || [];
          const newData = { ...cleanData, id: `local_${Date.now()}` };
          const updated = [...current, newData];
          localStorage.setItem(`shop_${coll}`, JSON.stringify(updated));
          setData(prev => ({ ...prev, [coll]: updated }));
      }
  };
  
  const updateData = async (coll, id, docData) => {
      if(db) {
          await updateDoc(doc(db, coll, id), docData);
      } else {
          // LocalStorage fallback logic
          const current = JSON.parse(localStorage.getItem(`shop_${coll}`)) || [];
          const updated = current.map(item => item.id === id ? { ...item, ...docData } : item);
          localStorage.setItem(`shop_${coll}`, JSON.stringify(updated));
          setData(prev => ({ ...prev, [coll]: updated }));
      }
  };

  const login = (u, p, isAdmin = false) => {
      // Admin Backdoor
      if (u === 'admin' && p === 'admin' && !data.users.find(user=>user.username==='admin')) {
          addData('users', { username: 'admin', password: 'admin', role: 'admin', depositWallet: 0, commissionWallet: 0, refCode: 'ADMIN' });
          alert("Đã khởi tạo Admin mặc định."); return false;
      }
      const found = data.users.find(user => user.username === u && user.password === p);
      if (found) {
          if (isAdmin && found.role !== 'admin') { alert("Không phải Admin"); return false; }
          setCurrentUser(found); return true;
      }
      return false;
  };

  const loginWithGoogle = async () => {
      if(!auth) { alert("Chưa cấu hình Firebase Auth trong .env"); return false; }
      try {
          const res = await signInWithPopup(auth, new GoogleAuthProvider());
          const user = res.user;
          const existing = data.users.find(u => u.email === user.email);
          if(existing) setCurrentUser(existing);
          else {
              const newUser = {
                  username: user.displayName || user.email.split('@')[0],
                  email: user.email, role: 'user', depositWallet: 0, commissionWallet: 0,
                  refCode: (user.email.split('@')[0]).toUpperCase().substring(0,6),
                  uid: user.uid
              };
              await addData('users', newUser);
              setCurrentUser({...newUser, id: 'temp'});
          }
          return true;
      } catch(e) { console.error(e); return false; }
  };

  const register = async ({ username, password, email, refCode }) => {
      if(data.users.find(u => u.username === username)) return { success: false, msg: 'Tên đã tồn tại' };
      const refUser = data.users.find(u => u.refCode === refCode);
      await addData('users', {
          username, password, email, role: 'user', depositWallet: 0, commissionWallet: 0,
          refCode: username.toUpperCase() + Math.floor(Math.random()*100),
          referredBy: refUser ? refUser.refCode : null
      });
      return { success: true, msg: 'Đăng ký thành công' };
  };

  const buyProduct = async (product) => {
      if(!currentUser) return;
      const days = Math.ceil((new Date(product.endDate) - new Date()) / 86400000) || 1;
      const totalDays = Math.ceil((new Date(product.endDate) - new Date(product.startDate)) / 86400000) || 1;
      const price = Math.floor((product.originalPrice / totalDays) * days);

      if(currentUser.depositWallet < price) return { success: false, msg: 'Số dư không đủ' };

      await updateData('users', currentUser.id, { depositWallet: currentUser.depositWallet - price });
      
      if(currentUser.referredBy) {
          const refUser = data.users.find(u => u.refCode === currentUser.referredBy);
          if(refUser) {
              const comm = price * 0.3;
              await updateData('users', refUser.id, { commissionWallet: refUser.commissionWallet + comm });
              await addData('transactions', { userId: refUser.id, type: 'commission', amount: comm, status: 'completed' });
          }
      }
      await addData('orders', { 
          userId: currentUser.id, productId: product.id, productName: product.name, 
          price, days, purchaseDate: new Date().toISOString(),
          accountData: { username: product.username, password: product.password, cookie: product.cookie }
      });
      return { success: true, msg: 'Mua thành công' };
  };

  return { ...data, loading, user: currentUser, login, loginWithGoogle, register, buyProduct, logout: () => setCurrentUser(null), addData };
};

// --- UI COMPONENTS ---

const LoginContainer = ({ children, title }) => (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-600/20 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="bg-white/5 backdrop-blur-2xl p-8 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl relative z-10">
            <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400 mb-8 text-center">SHOP PRO</h1>
            <h2 className="text-2xl font-bold text-white mb-6 text-center">{title}</h2>
            {children}
        </div>
        <div className="mt-8 text-gray-600 text-xs font-mono">Admin: #/admin</div>
    </div>
);

const InputField = ({ icon: Icon, ...props }) => (
    <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors"><Icon size={18} /></div>
        <input {...props} className="w-full bg-black/20 p-4 pl-12 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none transition-all"/>
    </div>
);

// --- MAIN APPS ---

const StoreApp = ({ store }) => {
    const [view, setView] = useState('home');
    const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', email: '', refCode: '' });

    if (!store.user) {
        if (view === 'register') {
            return (
                <LoginContainer title="Tạo tài khoản">
                    <form onSubmit={(e) => { e.preventDefault(); if(form.password!==form.confirmPassword) return alert("Lỗi Pass"); store.register(form).then(r => { alert(r.msg); if(r.success) setView('login'); }); }} className="space-y-4">
                        <InputField icon={User} placeholder="User" value={form.username} onChange={e=>setForm({...form, username: e.target.value})} required />
                        <InputField icon={Mail} placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required />
                        <InputField icon={Key} type="password" placeholder="Pass" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} required />
                        <InputField icon={CheckCircle} type="password" placeholder="Confirm Pass" value={form.confirmPassword} onChange={e=>setForm({...form, confirmPassword: e.target.value})} required />
                        <InputField icon={Share2} placeholder="Ref Code" value={form.refCode} onChange={e=>setForm({...form, refCode: e.target.value})} />
                        <button className="w-full bg-pink-600 p-4 rounded-xl text-white font-bold">Đăng ký</button>
                    </form>
                    <button onClick={()=>setView('login')} className="w-full mt-4 text-gray-400 text-sm">Quay lại đăng nhập</button>
                </LoginContainer>
            );
        }
        return (
            <LoginContainer title="Đăng nhập">
                <form onSubmit={(e) => { e.preventDefault(); if(!store.login(form.username, form.password)) alert("Sai thông tin"); }} className="space-y-4">
                    <InputField icon={User} placeholder="User" value={form.username} onChange={e=>setForm({...form, username: e.target.value})} />
                    <InputField icon={Key} type="password" placeholder="Pass" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} />
                    <button className="w-full bg-indigo-600 p-4 rounded-xl text-white font-bold">Đăng nhập</button>
                    <button type="button" onClick={store.loginWithGoogle} className="w-full bg-white text-black p-4 rounded-xl font-bold flex justify-center gap-2"><Globe size={20}/> Google Login</button>
                </form>
                <button onClick={()=>setView('register')} className="w-full mt-4 text-gray-400 text-sm">Chưa có tài khoản? Đăng ký</button>
            </LoginContainer>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col md:flex-row">
            <div className="w-full md:w-72 bg-[#121212]/50 backdrop-blur-xl p-6 flex flex-col gap-4 border-r border-white/5 h-screen sticky top-0">
                <h1 className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">SHOP PRO</h1>
                <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5">
                    <div className="font-bold text-lg">{store.user.username}</div>
                    <div className="text-emerald-400 font-mono">{formatVND(store.user.depositWallet)}</div>
                </div>
                <button onClick={()=>setView('home')} className={`p-4 rounded-xl text-left flex gap-3 ${view==='home'?'bg-indigo-600':'hover:bg-white/5'}`}><CreditCard/> Cửa hàng</button>
                <button onClick={()=>setView('history')} className={`p-4 rounded-xl text-left flex gap-3 ${view==='history'?'bg-indigo-600':'hover:bg-white/5'}`}><History/> Lịch sử</button>
                <button onClick={store.logout} className="mt-auto p-4 text-rose-400 flex gap-3"><LogOut/> Đăng xuất</button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                {view === 'home' && (
                    <div>
                        <h2 className="text-3xl font-bold mb-6 flex gap-2"><Zap className="text-yellow-400"/> Sản phẩm HOT</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {store.products.map(p => (
                                <div key={p.id} className="bg-[#151515] border border-white/5 rounded-3xl overflow-hidden hover:border-indigo-500/50 transition">
                                    <div className="h-40 bg-gradient-to-br from-[#1a1a1a] to-[#252525] p-6 relative">
                                        <div className="font-bold text-xl">{p.name}</div>
                                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded">Còn {Math.ceil((new Date(p.endDate) - new Date())/86400000)} ngày</span>
                                    </div>
                                    <div className="p-5">
                                        <div className="text-xl font-bold font-mono mb-4">{formatVND(p.originalPrice)}</div>
                                        <button onClick={()=>store.buyProduct(p).then(r=>r&&alert(r.msg))} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-indigo-500 hover:text-white transition">Mua Ngay</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'history' && (
                    <div>
                        <h2 className="text-3xl font-bold mb-6">Lịch sử đơn hàng</h2>
                        <div className="space-y-4">
                            {store.orders.filter(o => o.userId === store.user.id).map(order => (
                                <div key={order.id} className="bg-[#151515] p-6 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-lg">{order.productName}</div>
                                        <div className="text-xs text-gray-500">{new Date(order.purchaseDate).toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-indigo-400 font-bold font-mono">{formatVND(order.price)}</div>
                                        <div className="text-xs text-gray-400 font-mono">{order.accountData.username} | ***</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AdminApp = ({ store }) => {
    const showLogin = !store.user || store.user.role !== 'admin';
    const [form, setForm] = useState({ u: '', p: '' });
    const [view, setView] = useState('products');

    if (showLogin) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-md border border-slate-700 shadow-2xl">
                    <h1 className="text-3xl font-black text-center text-white mb-8">SECURE ADMIN</h1>
                    <form onSubmit={(e) => { e.preventDefault(); if(!store.login(form.u, form.p, true)) alert("Lỗi"); }} className="space-y-4">
                        <input className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 text-white" placeholder="Admin ID" value={form.u} onChange={e=>setForm({...form, u: e.target.value})}/>
                        <input className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 text-white" type="password" placeholder="Key" value={form.p} onChange={e=>setForm({...form, p: e.target.value})}/>
                        <button className="w-full bg-indigo-600 p-4 rounded-xl text-white font-bold">Access</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex font-sans">
            <div className="w-64 bg-slate-800 border-r border-slate-700 h-screen sticky top-0 p-4 flex flex-col gap-2">
                <h1 className="font-bold text-xl text-white mb-6">ADMIN CP</h1>
                {['products', 'users', 'transactions'].map(v => (
                    <button key={v} onClick={()=>setView(v)} className={`text-left p-3 rounded-xl capitalize ${view===v?'bg-indigo-600 text-white':'hover:bg-slate-700'}`}>{v}</button>
                ))}
                <button onClick={store.logout} className="mt-auto p-3 text-rose-400">Logout</button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                <h2 className="text-3xl font-bold text-white mb-8 capitalize">{view}</h2>
                {view === 'products' && (
                    <div className="space-y-4">
                        <button onClick={() => {
                            const name = prompt("Tên SP:"); const price = prompt("Giá:");
                            if(name && price) store.addData('products', { name, type: 'Service', originalPrice: parseInt(price), startDate: new Date().toISOString(), endDate: new Date(Date.now() + 30*86400000).toISOString(), username: 'user', password: '123', cookie: '{}' });
                        }} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold">+ Thêm Mới</button>
                        <div className="grid gap-4">
                            {store.products.map(p => (
                                <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between">
                                    <div><div className="font-bold text-white">{p.name}</div><div className="text-slate-400">{formatVND(p.originalPrice)}</div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'users' && (
                     <div className="bg-slate-800 rounded-xl overflow-hidden">
                         <table className="w-full text-left text-sm">
                             <thead className="bg-slate-900/50 text-slate-400"><tr><th className="p-4">User</th><th className="p-4">Wallet</th></tr></thead>
                             <tbody className="divide-y divide-slate-700">{store.users.map(u => (<tr key={u.id}><td className="p-4 text-white">{u.username}</td><td className="p-4 text-emerald-400">{formatVND(u.depositWallet)}</td></tr>))}</tbody>
                         </table>
                     </div>
                )}
            </div>
        </div>
    );
};

export default function App() {
  const store = useAppStore();
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
  }, []);

  if (store.loading) return <div className="h-screen bg-black flex items-center justify-center text-indigo-500"><Loader className="animate-spin"/></div>;

  return (
    <>
      <SecurityGuard />
      <ParticleCursor />
      {route === '#/admin' ? <AdminApp store={store} /> : <StoreApp store={store} />}
    </>
  );
}
