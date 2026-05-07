import React, { useState, useEffect, Component } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDoc,
  updateDoc, 
  setDoc
} from 'firebase/firestore';
import { 
  ArrowLeft, Plus, Trash2, ChevronRight, ChevronLeft,
  Sparkles, Clock, Palette, AlertTriangle, User,
  CheckCircle2, Calendar, Repeat, Download, X,
  Edit3, Loader2, Mail, Settings, RefreshCw, LogOut
} from 'lucide-react';

// --- Firebase 初始化 (標準化環境變數) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_CUSTOM_APP_ID || 'default-app-id';

// --- 自定義圖標 ---
const FishIcon = ({ size = 12, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M7 12 C 7 7.5 10.5 4 15 4 C 19.5 4 23 7.5 23 12 C 23 16.5 19.5 20 15 20 C 10.5 20 7 16.5 7 12 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M7 12 L 2 8 V 16 L 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="10" r="1.5" fill="currentColor" />
  </svg>
);

const ShellIcon = ({ size = 12, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21C14.5 21 17 20 18.5 18C20.5 15.5 20.5 12 18.5 9.5C16.5 7 13.5 6 11 6.5C9 7 7.5 8.5 7 10.5C6.5 12.5 7.5 14.5 9 15.5C10.5 16.5 12.5 16 13.5 14.5C14.2 13.5 14 12 13 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 21L11.5 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M15 20L14 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 20L9.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ==========================================
// ErrorBoundary 錯誤邊界
// ==========================================
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("System Crash Intercepted:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-[#0f0a20] flex flex-col items-center justify-center font-sans text-slate-200 p-6 text-center">
          <AlertTriangle size={64} className="text-pink-500 mb-6 animate-pulse" />
          <h1 className="text-2xl font-black text-white mb-2">Oops! 系統遇到亂流</h1>
          <p className="text-sm text-slate-400 mb-8 max-w-xs leading-relaxed">畫面繪製時遇到無效資料，已被系統安全阻擋，請重新載入。</p>
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-white font-bold shadow-lg hover:opacity-90 transition-opacity active:scale-95">
            <RefreshCw size={18} /> 重新載入系統
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainCourseApp() {
  // 狀態管理
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);       
  const [dbUser, setDbUser] = useState(null);   
  const [needsSetup, setNeedsSetup] = useState(true); 
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [view, setView] = useState('month'); 
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(null);
  const [courses, setCourses] = useState({});

  // 表單與彈跳視窗
  const [setupEmail, setSetupEmail] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupColor, setSetupColor] = useState("#ec4899"); 
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState("");

  const [editingCourse, setEditingCourse] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const [bookingSlot, setBookingSlot] = useState(null); 
  const [deletingCourse, setDeletingCourse] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const [newTitle, setNewTitle] = useState("");
  const [newStartTime, setNewStartTime] = useState("19:00");
  const [newEndTime, setNewEndTime] = useState("20:00");
  const [isRepeatMonthly, setIsRepeatMonthly] = useState(false);

  const role = dbUser?.role || 'student';

  // ==========================================
  // [重構] 單一真理來源的 Auth 與資料流
  // ==========================================
  useEffect(() => {
    let unsubProfile = null;
    let unsubCourses = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
        unsubProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            setDbUser(snap.data());
            setNeedsSetup(false);
          } else {
            setDbUser(null);
            setNeedsSetup(true); 
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile fetch error:", error);
          setNeedsSetup(true);
          setLoading(false);
        });

        const coursesQuery = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
        unsubCourses = onSnapshot(coursesQuery, (snapshot) => {
          try {
            const newCourses = {};
            snapshot.forEach(d => {
                const data = d.data();
                if(!data || !data.dateKey) return; 
                if(!newCourses[data.dateKey]) newCourses[data.dateKey] = [];
                newCourses[data.dateKey].push({ id: d.id, ...data });
            });
            setCourses(newCourses);
          } catch (e) { console.error("Parse courses error:", e); }
        });

      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auth init error:", error);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubCourses) unsubCourses();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSavingSetup(false);
      setIsEditingProfile(false);
      setSetupEmail("");
      setSetupName("");
      setSetupColor("#ec4899");
      setSetupError("");
      await signOut(auth);
    } catch (e) { console.error("Sign out error:", e); }
  };

  const handleOpenProfileEdit = () => {
    if (dbUser) {
      setSetupEmail(dbUser.email || "");
      setSetupName(dbUser.name || "");
      setSetupColor(dbUser.color || "#ec4899");
    }
    setIsEditingProfile(true);
  };

  const getDaysInMonth = (date) => {
    if (!date || isNaN(date.getTime())) return [];
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    const startPadding = firstDay.getDay(); 
    for (let i = 0; i < startPadding; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const formatDateKey = (date) => (date && !isNaN(date.getTime())) ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : "";
  const compareTime = (a, b) => (a?.startTime || "").localeCompare(b?.startTime || "");
  const goToDay = (date) => { setSelectedDate(date); setView('day'); };
  const handleBack = () => { setView('month'); };

  const handleConnect = async () => {
    if(!setupEmail.trim() || !setupName.trim() || !user) return;
    setIsSavingSetup(true);
    setSetupError("");
    try {
      const emailKey = setupEmail.trim().toLowerCase().replace(/[.@]/g, '_');
      const isAdmin = setupEmail.trim().toLowerCase() === 'yuuglish@gmail.com';

      // 先查 email 索引，找到已有的舊資料
      const emailRef = doc(db, 'artifacts', appId, 'usersByEmail', emailKey);
      const emailSnap = await getDoc(emailRef);

      let userData;
      if (emailSnap.exists() && !isAdmin) {
        // 沿用舊的名字與代表色，只更新 uid
        const existing = emailSnap.data();
        userData = {
          ...existing,
          uid: user.uid,
          email: setupEmail.trim(),
          name: setupName.trim(),
          color: setupColor,
        };
      } else {
        userData = {
          uid: user.uid,
          email: setupEmail.trim(),
          name: setupName.trim(),
          color: setupColor,
          role: isAdmin ? 'admin' : 'student'
        };
      }

      // 同時儲存到 UID 路徑 + email 索引路徑
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await Promise.all([
        setDoc(profileRef, userData),
        setDoc(emailRef, userData),
      ]);

      setDbUser(userData);
      setIsEditingProfile(false);
      setNeedsSetup(false);
    } catch (err) { 
      console.error("Error saving user data:", err); 
      setSetupError("連線寫入失敗，請確認網路狀態");
    }
    setIsSavingSetup(false);
  };

  const handleOpenEdit = (course) => {
    if (!course) return;
    setEditingCourse(course);
    setEditTitle(course.title || "");
  };

  const handleAddCourse = async (dateKey, title, startTime, endTime, repeatMonthly) => {
    if (role !== 'admin' || !user || !dateKey) return;
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      if (!y || !m || !d) return; 
      
      const targetDate = new Date(y, m - 1, d);
      const datesToAdd = [];

      if (repeatMonthly) {
        const daysInMonth = new Date(y, m, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const tempDate = new Date(y, m - 1, i);
          if (tempDate.getDay() === targetDate.getDay()) datesToAdd.push(formatDateKey(tempDate));
        }
      } else {
        datesToAdd.push(dateKey);
      }

      const batchAdd = datesToAdd.map(dk => {
         return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'courses'), {
            title: title || '未命名課程', 
            startTime: startTime || '00:00', 
            endTime: endTime || '00:00', 
            dateKey: dk,
            status: 'open', isBooked: false,
            bookedBy: null, studentUid: null, studentColor: null
         });
      });
      await Promise.all(batchAdd);
      setNewTitle(""); 
    } catch (e) { console.error("Error adding course:", e); }
  };

  const handleUpdateCourseStatus = async () => {
    if (role !== 'admin' || !user || !editingCourse?.id) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', editingCourse.id), {
         title: editTitle || '未命名課程'
      });
      setEditingCourse(null);
    } catch(e) { console.error("Error updating course:", e); }
  };

  const handleDeleteCourse = async () => {
    if (role !== 'admin' || !user || !deletingCourse?.courseId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', deletingCourse.courseId));
      setDeletingCourse(null);
    } catch(e) { console.error("Error deleting course:", e); }
  };

  const handleConfirmBooking = async () => {
    if (!bookingSlot?.course?.id || !dbUser || !user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', bookingSlot.course.id), {
        isBooked: true, status: 'booked',
        bookedBy: dbUser.name || 'Student', 
        studentUid: dbUser.email || user.uid, 
        studentColor: dbUser.color || '#ec4899'
      });
      setBookingSlot(null);
    } catch(e) { console.error("Error booking course:", e); }
  };

  const handleStartTimeChange = (val) => {
    setNewStartTime(val);
    if (!val || typeof val !== 'string') return; 
    try {
      const parts = val.split(':');
      if (parts.length !== 2) return;
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (isNaN(h) || isNaN(m)) return;
      let nextH = h + 1;
      if (nextH >= 24) nextH -= 24;
      setNewEndTime(`${nextH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    } catch(e) { console.error(e); }
  };

  const generateCalendarImage = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1080; canvas.height = 1600; 

      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#240078'); grad.addColorStop(1, '#C4529E');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      const monthName = currentDate.toLocaleString('en-US', { month: 'long' });
      ctx.font = 'bold 50px sans-serif'; ctx.fillText('Yuiland', canvas.width / 2, 120);
      ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = '#fbcfe8'; ctx.fillText(`My Schedule - ${monthName} ${currentDate.getFullYear()}`, canvas.width / 2, 180);
      ctx.font = '24px sans-serif'; ctx.fillStyle = '#cbd5e1'; ctx.fillText(`Student: ${dbUser?.name || 'Student'}`, canvas.width / 2, 220);

      const startX = 60; const startY = 300;
      const cellWidth = (canvas.width - 120) / 7; const cellHeight = 180;

      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#e9d5ff'; 
      for (let i = 0; i < 7; i++) ctx.fillText(days[i], startX + i * cellWidth + cellWidth / 2, startY - 20);

      const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
        let chars = (text || "").split(''), line = '';
        for(let n = 0; n < chars.length; n++) {
          let testLine = line + chars[n];
          if (context.measureText(testLine).width > maxWidth && n > 0) {
            context.fillText(line, x, y); line = chars[n]; y += lineHeight;
          } else { line = testLine; }
        }
        context.fillText(line, x, y);
      };

      let row = 0, col = 0;
      getDaysInMonth(currentDate).forEach((day) => {
        if (!day) {
           col++; if (col >= 7) { col = 0; row++; }
           return;
        }
        const x = startX + col * cellWidth, y = startY + row * cellHeight;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1; ctx.fillRect(x, y, cellWidth, cellHeight); ctx.strokeRect(x, y, cellWidth, cellHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(day.getDate(), x + 15, y + 35);

        const dayCourses = courses[formatDateKey(day)] || [];
        const studentCourses = dbUser ? dayCourses.filter(c => c && (c.status === 'booked' || c.status === 'confirmed' || c.isBooked) && (c.studentUid === dbUser.email || c.studentUid === dbUser.uid)) : [];

        if (studentCourses.length > 0) {
          ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = dbUser?.color || '#ec4899';
          ctx.fillRect(x, y, cellWidth, cellHeight); ctx.restore();

          studentCourses.forEach((c, idx) => {
            if (idx >= 2) return; 
            const textY = y + 70 + (idx * 50); 
            ctx.fillStyle = '#fbcfe8'; ctx.font = 'bold 16px monospace'; ctx.fillText(c.startTime || '', x + 15, textY);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif';
            wrapText(ctx, c.title || '', x + 15, textY + 22, cellWidth - 20, 20);
          });
        }
        col++; if (col >= 7) { col = 0; row++; }
      });
      setPreviewImage(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error("Canvas generation failed:", err);
    }
  };

  const renderSetupScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative animate-in fade-in zoom-in-95 duration-500 w-full h-full overflow-y-auto">
      <div className="w-full max-w-sm bg-[#1e1b4b]/80 border border-pink-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(236,72,153,0.15)] relative overflow-hidden backdrop-blur-xl shrink-0 my-auto">
        {isEditingProfile && (
           <button onClick={() => setIsEditingProfile(false)} className="absolute top-4 left-4 p-2 text-white/50 hover:text-white transition-colors bg-black/20 rounded-full z-20">
             <ArrowLeft size={16} />
           </button>
        )}
        <div className="absolute top-0 right-0 p-4 opacity-5 text-pink-400"><User size={120} /></div>
        <div className="flex justify-center mb-4 relative z-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors relative" style={{ backgroundColor: setupColor, boxShadow: `0 0 15px ${setupColor}` }}>
             <Sparkles size={28} className="text-white" />
          </div>
        </div>
        <h3 className="text-2xl font-black text-white mb-2 text-center relative z-10 tracking-widest">{isEditingProfile ? '編輯檔案' : 'Yuiland'}</h3>
        <p className="text-xs text-pink-200/70 mb-6 text-center relative z-10 leading-relaxed">
          {isEditingProfile ? '你可以隨時更新你的名字與代表色' : <>歡迎來到課程系統<br/>請輸入 Gmail、英文名並選擇代表色</>}
        </p>
        
        <div className="space-y-4 relative z-10 mb-6">
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-white/50" size={18} />
            <input type="email" placeholder="您的 Gmail" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} disabled={isEditingProfile && role === 'admin'} className="w-full bg-black/40 text-white border border-white/20 rounded-xl pl-10 pr-4 py-3 font-medium focus:outline-none focus:border-pink-500 transition-colors text-sm disabled:opacity-50"/>
          </div>
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-white/50" size={18} />
            <input type="text" placeholder="英文名字 (如: Emma)" value={setupName} onChange={(e) => setSetupName(e.target.value)} className="w-full bg-black/40 text-white border border-white/20 rounded-xl pl-10 pr-4 py-3 font-medium focus:outline-none focus:border-pink-500 transition-colors text-sm"/>
          </div>
          
          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 flex items-center justify-between gap-4">
            <div className="flex flex-col">
               <p className="text-xs text-white/90 font-bold">專屬代表色</p>
               <p className="text-[10px] text-white/40 mt-0.5">點擊右方色塊自訂</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="text-xs font-mono text-white/50 bg-black/60 px-2 py-1 rounded">{setupColor.toUpperCase()}</div>
               <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: setupColor }}>
                 <input type="color" value={setupColor} onChange={(e) => setSetupColor(e.target.value)} className="absolute inset-0 w-[200%] h-[200%] -top-2 -left-2 opacity-0 cursor-pointer" title="點擊開啟調色盤" />
               </div>
            </div>
          </div>
          {setupError && <p className="text-xs text-red-400 font-bold text-center mt-2">{setupError}</p>}
        </div>
        
        <button onClick={handleConnect} disabled={!setupEmail.trim() || !setupName.trim() || isSavingSetup || !user} className="w-full py-3.5 rounded-xl text-white font-black tracking-widest shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed relative z-10 flex items-center justify-center gap-2" style={{ backgroundColor: setupColor }}>
          {!user ? <><Loader2 size={18} className="animate-spin" /> 連線中...</> : (isSavingSetup ? <><Loader2 size={18} className="animate-spin" /> 處理中...</> : (isEditingProfile ? '儲存變更' : '登入並綁定'))}
        </button>

        {isEditingProfile && (
          <button onClick={handleSignOut} className="w-full mt-3 py-3 rounded-xl text-red-400 font-bold border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors relative z-10 flex items-center justify-center gap-2">
            <LogOut size={16} /> 登出帳號
          </button>
        )}
      </div>
    </div>
  );

  const renderEditCourseModal = () => {
    if (!editingCourse) return null;
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-[#1e1b4b] border border-purple-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-400"><Edit3 size={80} /></div>
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2 relative z-10"><Palette size={20} className="text-purple-400" /> 編輯課程名稱</h3>
          
          <div className="space-y-4 relative z-10">
            <div>
              <input type="text" placeholder="輸入課程名稱" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-black/40 text-white border border-purple-500/30 rounded-xl px-4 py-3 font-medium focus:outline-none focus:border-purple-500 transition-colors text-sm"/>
            </div>
          </div>
          <div className="flex gap-3 mt-8 relative z-10">
            <button onClick={() => setEditingCourse(null)} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-400 font-bold hover:bg-slate-700 transition-colors">取消</button>
            <button onClick={handleUpdateCourseStatus} className="flex-1 py-3 bg-purple-600 rounded-xl text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:bg-purple-500 transition-colors">儲存名稱</button>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weeks = [];
    let currentWeek = [];
    days.forEach((day, index) => {
      currentWeek.push(day);
      if ((index + 1) % 7 === 0 || index === days.length - 1) {
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    const monthName = currentDate.toLocaleString('en-US', { month: 'long' });

    return (
      <div className="animate-in fade-in zoom-in-95 duration-500 h-full flex flex-col w-full">
        <div className="flex justify-between items-center mb-6 px-2">
           <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white/10 rounded-full transition-colors text-purple-200"><ChevronLeft size={24}/></button>
           <div className="text-center">
              <h2 className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] tracking-tighter">{currentDate.getFullYear()}</h2>
              <div className="flex items-center justify-center gap-2 text-purple-300">
                <span className="h-[1px] w-4 bg-purple-500/50"></span>
                <span className="text-xs font-bold uppercase tracking-[0.3em]">{monthName}</span>
                <span className="h-[1px] w-4 bg-purple-500/50"></span>
              </div>
           </div>
           <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white/10 rounded-full transition-colors text-purple-200"><ChevronRight size={24}/></button>
        </div>

        <div className="grid grid-cols-7 mb-2 text-center">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="text-[10px] font-black text-purple-400/60 tracking-widest py-2">{d}</div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar px-1">
           {weeks.map((week, wIndex) => (
             <div key={wIndex} className="relative bg-gradient-to-r from-[#2e1065]/60 to-[#4c0519]/60 backdrop-blur-md rounded-2xl border border-purple-500/20 p-2 group hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all overflow-hidden">
                <div className="grid grid-cols-7 gap-1 relative z-10">
                   {week.map((day, dIndex) => {
                     const dateKey = formatDateKey(day);
                     const dayCourses = day ? (courses[dateKey] || []) : [];
                     const isToday = day && day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth();
                     
                     const hasAvailable = dayCourses.some(c => c && (c.status === 'open' || (!c.status && !c.isBooked)));
                     const bookedCourses = dayCourses.filter(c => c && (c.status === 'booked' || c.isBooked));
                     const bookedColors = [...new Set(bookedCourses.map(c => c?.studentColor || '#ec4899'))];
                     
                     return (
                       <div key={dIndex} onClick={(e) => { if (day) { e.stopPropagation(); goToDay(day); } }} className={`flex flex-col items-center justify-center h-12 rounded-lg transition-all ${day ? 'cursor-pointer hover:bg-white/10' : ''}`}>
                          <span className={`text-sm font-sans ${day ? 'text-slate-300' : ''} ${isToday ? 'font-black text-white scale-125 transition-transform' : ''}`}>{day ? day.getDate() : ''}</span>
                          <div className="flex gap-0.5 h-1 mt-1 justify-center flex-wrap max-w-[24px]">
                             {hasAvailable && <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]"></div>}
                             {role === 'student' ? (
                               bookedCourses.some(c => c?.studentUid === dbUser?.email || c?.studentUid === dbUser?.uid) && (
                                 <div className="w-1 h-1 rounded-full shadow-sm" style={{ backgroundColor: dbUser?.color || '#ec4899', boxShadow: `0 0 5px ${dbUser?.color || '#ec4899'}` }}></div>
                               )
                             ) : (
                               bookedColors.map((color, idx) => (
                                 <div key={idx} className="w-1 h-1 rounded-full shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}></div>
                               ))
                             )}
                          </div>
                       </div>
                     );
                   })}
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 text-purple-500 -rotate-12 group-hover:opacity-20 transition-opacity"><FishIcon size={40} /></div>
             </div>
           ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    if (!selectedDate) return null;
    const dateKey = formatDateKey(selectedDate);
    const dayCourses = [...(courses[dateKey] || [])].sort(compareTime);
    const monthName = selectedDate.toLocaleString('en-US', { month: 'long' });

    return (
      <div className="animate-in slide-in-from-bottom-10 fade-in duration-300 h-full overflow-y-auto custom-scrollbar pb-24 relative w-full">
         <div className="text-center mb-6 pt-2 pointer-events-none mix-blend-plus-lighter">
            <h2 className="text-2xl font-black text-white flex justify-center items-center gap-2 drop-shadow-md">
               <span className="text-purple-400"><Calendar size={18} /></span>
               {selectedDate.getDate()} <span className="text-lg text-white/50 font-light font-sans">Classes</span>
            </h2>
            <p className="text-purple-300/60 text-[10px] font-bold tracking-[0.3em] uppercase mt-1">{monthName} / {selectedDate.getFullYear()}</p>
         </div>

         {role === 'admin' && (
           <div className="bg-[#0f0a20]/60 border border-purple-500/30 rounded-2xl p-5 mb-6 backdrop-blur-xl shadow-lg relative overflow-hidden group mx-1">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity text-purple-500"><Palette size={40} /></div>
              <h3 className="text-sm font-black text-purple-200 mb-4 flex items-center gap-2 relative z-10"><Plus size={16}/> 開放時段</h3>
              <div className="space-y-3 relative z-10">
                 <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                    <Clock size={14} className="text-purple-400" />
                    <input type="time" value={newStartTime} onChange={(e) => handleStartTimeChange(e.target.value)} className="bg-transparent text-white text-sm font-bold focus:outline-none w-20 text-center font-mono [color-scheme:dark]"/>
                    <span className="text-white/20 text-xs">to</span>
                    <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="bg-transparent text-white text-sm font-bold focus:outline-none w-20 text-center font-mono [color-scheme:dark]"/>
                 </div>
                 <div className="flex gap-2">
                   <input type="text" placeholder="課程名稱 (如: 英文課)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="flex-1 bg-black/40 text-white border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-purple-500/50 placeholder:text-white/20 transition-colors" onKeyDown={(e) => { if(e.key === 'Enter' && newTitle) handleAddCourse(dateKey, newTitle, newStartTime, newEndTime, isRepeatMonthly); }}/>
                   <button onClick={() => { if(newTitle) handleAddCourse(dateKey, newTitle, newStartTime, newEndTime, isRepeatMonthly); }} className="bg-gradient-to-br from-purple-600 to-pink-600 w-12 rounded-xl text-white hover:opacity-90 transition-opacity flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50" disabled={!newTitle}><Plus size={20} /></button>
                 </div>
                 <div className="pt-2 flex justify-start">
                    <button onClick={() => setIsRepeatMonthly(!isRepeatMonthly)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${isRepeatMonthly ? 'bg-purple-900/40 border-purple-500/50 text-purple-300' : 'bg-transparent border-transparent text-slate-500 hover:bg-white/5'}`}>
                       <Repeat size={14} className={isRepeatMonthly ? "animate-spin-slow" : ""} /> 本月同星期皆開放此時段 {isRepeatMonthly && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_5px_#c084fc] animate-pulse ml-1"></div>}
                    </button>
                 </div>
              </div>
           </div>
         )}

         <div className="space-y-3 px-1">
            {dayCourses.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 opacity-30 text-purple-300">
                  <FishIcon size={48} />
                  <p className="text-xs font-black tracking-widest uppercase mt-4">{role === 'admin' ? '尚未開放任何時段' : '今日無可預約課程'}</p>
               </div>
            ) : (
               dayCourses.map(course => {
                 if (!course) return null; 
                 const isSlotOpen = course.status === 'open' || (!course.status && !course.isBooked);
                 const isBooked = !isSlotOpen;
                 
                 const sColor = course.studentColor || '#ec4899';
                 const cTitle = course.title || '未命名課程';
                 const cStart = course.startTime || '00:00';
                 const cEnd = course.endTime || '00:00';
                 
                 if (role === 'student') {
                   return (
                     <div key={course.id || Math.random()} className={`flex items-center gap-3 rounded-xl p-3 backdrop-blur-sm border transition-all ${isBooked ? 'bg-black/20 border-white/5 opacity-60 grayscale-[0.5]' : 'bg-[#1e1b4b]/40 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-[#2e1065]/60 hover:shadow-[0_0_15px_rgba(52,211,153,0.1)]'}`}>
                        <div className="flex flex-col items-center justify-center min-w-[4rem] border-r border-white/10 pr-3">
                           <span className="text-sm text-white font-mono tracking-tight font-bold">{cStart}</span>
                           <span className="text-[10px] text-white/50">{cEnd}</span>
                        </div>
                        <div className="flex-1">
                           <div className={`font-medium text-sm tracking-wide ${isBooked ? 'text-slate-400' : 'text-emerald-100'}`}>{cTitle}</div>
                           <div className="text-[10px] mt-1 flex items-center gap-1 text-white/40"><Clock size={10} /> 課程時段</div>
                        </div>
                        <button onClick={() => isSlotOpen && setBookingSlot({ dateKey, course })} disabled={isBooked} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${isBooked ? 'bg-slate-800/50 text-slate-500 border-transparent cursor-not-allowed' : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600 hover:text-white shadow-sm'}`}>
                           {isBooked ? '已預約' : '預約'}
                        </button>
                     </div>
                   )
                 }

                 return (
                   <div key={course.id || Math.random()} onClick={() => handleOpenEdit(course)} className={`group flex items-center gap-3 rounded-xl p-3 backdrop-blur-sm border cursor-pointer transition-all ${isBooked ? 'bg-pink-900/20 border-pink-500/40 hover:bg-pink-900/30' : 'bg-[#1e1b4b]/40 border-emerald-500/20 hover:bg-[#2e1065]/60 hover:border-emerald-500/40'}`}>
                      <div className="flex flex-col items-center justify-center min-w-[4rem] border-r border-white/5 pr-3">
                         <span className="text-sm text-white font-mono tracking-tight font-bold">{cStart}</span>
                         <span className="text-[10px] text-white/30">{cEnd}</span>
                      </div>
                      <div className="flex-1 text-slate-200">
                         <div className="font-medium text-sm tracking-wide flex items-center gap-2">{cTitle} <Edit3 size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" /></div>
                         <div className="mt-1 flex items-center gap-1.5">
                            {isBooked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border" style={{ backgroundColor: `${sColor}33`, borderColor: `${sColor}66`, color: sColor }}><CheckCircle2 size={10} /> 已預約: {course.bookedBy || 'Student'}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20"><Sparkles size={10} /> 開放中</span>
                            )}
                         </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); if (course.id) setDeletingCourse({ dateKey, courseId: course.id }); }} className="text-white/20 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10" title="刪除此時段"><Trash2 size={16} /></button>
                   </div>
                 );
               })
            )}
         </div>
      </div>
    );
  };

  const renderBookingConfirmModal = () => {
    if (!bookingSlot?.course) return null;
    const { course } = bookingSlot;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-[#1e1b4b] border border-pink-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-pink-400"><AlertTriangle size={80} /></div>
          <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2 relative z-10"><CheckCircle2 size={24} className="text-pink-400" /> 確認預約</h3>
          <div className="bg-black/30 p-4 rounded-xl mb-6 relative z-10 border border-white/5">
            <p className="text-white font-bold text-lg mb-1">{course.title || '未命名'}</p>
            <p className="text-pink-300 font-mono text-sm">{course.startTime || ''} - {course.endTime || ''}</p>
          </div>
          <div className="text-sm text-slate-300 space-y-2 mb-8 relative z-10 leading-relaxed font-medium bg-red-900/20 p-4 rounded-xl border border-red-500/20">
            <p>劃位後，系統將無法取消預約。</p><p>當天臨時請假，<span className="text-pink-400 font-bold">不補課不退費</span>。</p><p>如已劃位，欲調整上課時間，請聯繫老師。</p>
          </div>
          <div className="flex gap-3 relative z-10">
            <button onClick={() => setBookingSlot(null)} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-400 font-bold hover:bg-slate-700 transition-colors">再想想</button>
            <button onClick={handleConfirmBooking} className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-white font-bold shadow-[0_0_15px_rgba(219,39,119,0.5)] hover:opacity-90 transition-opacity">同意並預約</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteConfirmModal = () => {
    if (!deletingCourse) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200">
        <div className="w-full max-w-xs bg-[#0f0a20] border border-red-900/50 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(220,38,38,0.2)]">
          <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><Trash2 size={24} /></div>
          <h3 className="text-lg font-black text-white mb-2">確認刪除時段?</h3>
          <p className="text-xs text-slate-400 mb-6 font-bold tracking-wide">刪除後將無法恢復，確定嗎？</p>
          <div className="flex gap-3">
            <button onClick={() => setDeletingCourse(null)} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-400 font-bold text-xs hover:bg-slate-700 transition-colors">取消</button>
            <button onClick={handleDeleteCourse} className="flex-1 py-3 bg-red-900/40 text-red-400 border border-red-900/50 rounded-xl font-bold text-xs hover:bg-red-900/60 transition-colors">確認刪除</button>
          </div>
        </div>
      </div>
    );
  };

  const renderImagePreviewModal = () => {
    if (!previewImage) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-[#0f0a20] border border-pink-500/50 rounded-2xl p-4 flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(219,39,119,0.3)]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-white font-bold flex items-center gap-2"><Sparkles size={16} className="text-pink-400"/> 專屬課表已生成</h3>
            <button onClick={() => setPreviewImage(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-pink-600 transition-colors"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-auto rounded-xl border border-white/10 relative custom-scrollbar flex justify-center items-center bg-black/50 p-2">
             <img src={previewImage} alt="Schedule Preview" className="max-w-full h-auto object-contain rounded-lg shadow-lg" style={{ WebkitTouchCallout: 'default' }} />
          </div>
          <div className="mt-4 text-center bg-pink-900/20 p-3 rounded-xl border border-pink-500/20 shrink-0">
             <p className="text-sm text-pink-300 font-bold mb-1">💡 儲存方式</p>
             <p className="text-xs text-slate-300 font-medium">手機請<span className="text-pink-400 font-bold">「長按圖片」</span>儲存<br/>電腦請<span className="text-pink-400 font-bold">「點擊右鍵」</span>另存圖片</p>
          </div>
        </div>
      </div>
    );
  };

  const renderLoadingOverlay = () => (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0f0a20]/90 backdrop-blur-md">
       <div className="flex flex-col items-center">
          <ShellIcon size={50} className="text-pink-400 animate-spin-slow mb-4" />
          <span className="text-pink-300 font-bold tracking-widest animate-pulse">系統連線中...</span>
       </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-[#240078] to-[#C4529E]">
        {renderLoadingOverlay()}
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-[#240078] to-[#C4529E] flex justify-center items-center font-sans overflow-hidden text-slate-200 selection:bg-purple-500/30 relative">
      <style>{`
        @keyframes bubble-rise { 0% { transform: translateY(110vh) scale(0.5); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-10vh) scale(1.2); opacity: 0; } }
        @keyframes ember-float { 0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; filter: hue-rotate(0deg); } 100% { transform: translateY(-100px) translateX(20px) scale(0); opacity: 0; filter: hue-rotate(90deg); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .bubble-bg { position: absolute; bottom: -20px; color: #a78bfa; opacity: 0.3; pointer-events: none; z-index: 0; animation: bubble-rise linear infinite; }
        .ember-bg { position: absolute; color: #fb7185; pointer-events: none; z-index: 5; animation: ember-float linear infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.3); border-radius: 10px; }
        input, button, select { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif !important; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(15)].map((_, i) => (<div key={`b-${i}`} className="bubble-bg" style={{ left: `${Math.random()*100}%`, animationDuration: `${Math.random()*10+10}s`, animationDelay: `${Math.random()*5}s` }}><div className="rounded-full border border-purple-400/30 bg-purple-500/10" style={{width: Math.random()*20+10, height: Math.random()*20+10}}></div></div>))}
        {[...Array(25)].map((_, i) => (<div key={`e-${i}`} className="ember-bg" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100 + 20}%`, animationDuration: `${Math.random()*4+2}s`, animationDelay: `${Math.random()*2}s`, width: Math.random() * 4 + 2, height: Math.random() * 4 + 2, borderRadius: '50%', background: '#fb7185', boxShadow: '0 0 10px #f43f5e' }} />))}
      </div>

      {renderEditCourseModal()}
      {renderBookingConfirmModal()}
      {renderDeleteConfirmModal()}
      {renderImagePreviewModal()}

      <div className="relative z-10 w-full max-w-md h-full sm:h-[95vh] sm:rounded-[2.5rem] bg-[#0f172a]/40 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/5 font-sans">
        
        {(!user || needsSetup || isEditingProfile) ? (
            renderSetupScreen()
        ) : (
          <>
            <div className="h-20 flex items-center justify-between px-6 shrink-0 z-20 border-b border-white/5 bg-black/10"> 
              {view !== 'month' ? (
                 <button onClick={handleBack} className="flex items-center gap-1 text-purple-200 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-sm">
                   <ArrowLeft size={16} /> <span className="text-xs font-bold tracking-wider">BACK</span>
                 </button>
              ) : (
                 <div className="flex items-center gap-1.5 text-purple-200">
                    <ShellIcon size={20} className="drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    <span className="text-xs font-black tracking-[0.2em]">Yuiland</span>
                    {role === 'student' && (
                      <button onClick={generateCalendarImage} className="p-1.5 ml-1 text-pink-300 hover:text-white hover:bg-white/10 rounded-full transition-colors relative group" title="下載本月已預約課表">
                        <Download size={14} />
                      </button>
                    )}
                 </div>
              )}
              
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${role === 'admin' ? 'bg-purple-900/50 border-purple-500/50 text-purple-200' : 'bg-pink-900/30 border-pink-500/30 text-pink-200'}`}>
                  {role === 'admin' ? '老師 Admin' : '學生'}
                </span>
                <div className="text-right flex flex-col items-end">
                   <span className="text-xs font-black text-white flex items-center gap-1.5">
                     {dbUser?.name || 'Student'}
                     {role === 'student' && <div className="w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform" title="點擊修改個人設定" onClick={handleOpenProfileEdit} style={{ backgroundColor: dbUser?.color || '#ec4899', boxShadow: `0 0 5px ${dbUser?.color || '#ec4899'}` }}></div>}
                   </span>
                </div>
                <button onClick={handleOpenProfileEdit} className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-colors" title="設定個人檔案"><Settings size={16} /></button>
              </div>
            </div>

            <div className="flex-1 px-4 pb-4 pt-4 overflow-hidden relative z-10 flex flex-col">
               {view === 'month' ? renderMonthView() : renderDayView()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CourseBookingSystem() {
  return (
    <AppErrorBoundary>
      <MainCourseApp />
    </AppErrorBoundary>
  );
}
