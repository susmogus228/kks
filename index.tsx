import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

type Role = "USER" | "ADMIN";
type Lang = "RU" | "KZ";
type TicketSource = "Portal" | "Email" | "Chat" | "Phone";

interface FileAttachment {
    name: string;
    type: string;
    url: string;
}

interface Message {
  id: string;
  sender: "user" | "bot" | "agent";
  text: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

interface Ticket {
  id: string;
  userId: string;
  description: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  priority: "High" | "Medium" | "Low";
  category: "Network" | "Hardware" | "Software" | "Access" | "Other";
  department: string;
  source: TicketSource;
  summary: {
      RU: string;
      KZ: string;
  };
  sentiment: string;     // e.g., "Negative", "Neutral", "Positive"
  sentimentScore: number; // 0-100
  messages: Message[];
  attachments: FileAttachment[];
  createdAt: Date;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "warning" | "success" | "error";
    timestamp: Date;
    read: boolean;
}

// --- Localization ---

const TEXT = {
  RU: {
    appTitle: "QOLDA.AI",
    appSubtitle: "Служба поддержки",
    employeeView: "Режим Сотрудника",
    adminView: "Режим Администратора",
    welcomeUser: "Центр поддержки",
    welcomeSub: "Задайте вопрос или опишите проблему.",
    yourTickets: "Ваши заявки",
    noTickets: "Нет активных заявок.",
    faqTitle: "Частые вопросы",
    chatPlaceholder: "Опишите проблему...",
    chatOnline: "Онлайн | AI Ассистент",
    faqs: [
        { q: "Как сбросить пароль?", a: "Перейдите на https://idm.telecom.kz и нажмите 'Забыли пароль'. Потребуется SMS подтверждение." },
        { q: "Как настроить VPN?", a: "Скачайте Cisco AnyConnect с портала. Адрес сервера: vpn.telecom.kz." },
        { q: "Где найти принтер?", a: "Карта принтеров доступна на интранет-портале в разделе 'Офис'." },
        { q: "Как заказать пропуск?", a: "Оформите заявку в системе e-Pass или напишите боту 'Заказать пропуск'." },
        { q: "Не работает почта", a: "Перезагрузите Outlook. Если не помогло, проверьте веб-версию mail.telecom.kz." }
    ],
    admin: {
      automation: "Автоматизация",
      avgResponse: "Ср. время ответа",
      activeTickets: "Активные заявки",
      csat: "Оценка CSAT",
      inbound: "Очередь обращений",
      total: "всего",
      manualResolve: "Закрыть вручную",
      originalReq: "История переписки",
      attachments: "Вложения",
      aiAnalysis: "Анализ ИИ",
      sentiment: "Настроение",
      route: "Отдел",
      agentResp: "Ответ оператора",
      aiAssist: "AI Помощник",
      sendResolve: "Отправить и Закрыть",
      sendMessage: "Отправить сообщение",
      selectTicket: "Выберите заявку для работы",
      generating: "Генерация...",
      draftPlaceholder: "Напишите ответ пользователю...",
      statSub1: "+12% за неделю",
      statSub2: "-30сек",
      createTicket: "Новая заявка",
      createModalTitle: "Создание заявки",
      userIdLabel: "ID Пользователя",
      descLabel: "Описание проблемы",
      analyzeBtn: "Авто-заполнение (AI)",
      saveBtn: "Создать заявку",
      cancelBtn: "Отмена",
      analyzing: "Анализ...",
      fillSuccess: "Данные заполнены ИИ",
      categoryLabel: "Категория",
      priorityLabel: "Приоритет",
      deptLabel: "Департамент",
      sourceLabel: "Источник",
      simulateTitle: "Симуляция входящих",
      notifications: "Уведомления",
      noNotifications: "Нет новых уведомлений",
      markRead: "Отметить прочитанным",
      filter: {
          all: "Все",
          active: "Активные",
          resolved: "Закрытые"
      },
      sort: {
          date: "По дате",
          priority: "По важности",
          category: "По категории"
      },
      sources: {
          Portal: "Портал",
          Email: "Почта",
          Chat: "Чат",
          Phone: "Телефон"
      }
    },
    status: {
      Open: "Открыто",
      "In Progress": "В работе",
      Resolved: "Решено",
      Closed: "Closed"
    },
    priority: {
      High: "Высокий",
      Medium: "Средний",
      Low: "Низкий"
    },
    sentiments: {
      Positive: "Позитивное",
      Neutral: "Нейтральное",
      Negative: "Негативное",
      Frustrated: "Критическое/Злость"
    },
    categories: {
        Network: "Сеть/Интернет",
        Hardware: "Оборудование",
        Software: "ПО/Софт",
        Access: "Доступы",
        Other: "Другое"
    },
    systemMessages: {
        timeout: "Сессия закрыта из-за отсутствия активности (15 мин).",
        closedByAdmin: "Спасибо что воспользовались услугами QOLDA.AI, чтобы воспользоваться нашими услугами вновь перезагрузите страницу.",
        closedByAI: "Рад был помочь! Сессия завершена. Перезагрузите страницу для нового обращения."
    }
  },
  KZ: {
    appTitle: "QOLDA.AI",
    appSubtitle: "Қолдау қызметі",
    employeeView: "Қызметкер режимі",
    adminView: "Әкімші режимі",
    welcomeUser: "Қолдау орталығы",
    welcomeSub: "Сұрақ қойыңыз немесе мәселені сипаттаңыз.",
    yourTickets: "Сіздің өтінімдеріңіз",
    noTickets: "Белсенді өтінімдер жоқ.",
    faqTitle: "Жиі қойылатын сұрақтар",
    chatPlaceholder: "Мәселені сипаттаңыз...",
    chatOnline: "Онлайн | AI Көмекші",
    faqs: [
        { q: "Құпия сөзді қалай өзгертуге болады?", a: "https://idm.telecom.kz сайтына өтіп, 'Құпия сөзді ұмыттым' түймесін басыңыз. SMS растау қажет." },
        { q: "VPN қалай баптауға болады?", a: "Порталдан Cisco AnyConnect жүктеп алыңыз. Сервер мекенжайы: vpn.telecom.kz." },
        { q: "Принтерді қайдан табуға болады?", a: "Принтерлер картасы интранет-порталдағы 'Кеңсе' бөлімінде қолжетімді." },
        { q: "Рұқсаттамаға қалай тапсырыс беруге болады?", a: "e-Pass жүйесінде өтінім жасаңыз немесе ботқа 'Рұқсаттамаға тапсырыс беру' деп жазыңыз." },
        { q: "Пошта жұмыс істемейді", a: "Outlook-ты қайта іске қосыңыз. Егер көмектеспесе, mail.telecom.kz веб-нұсқасын тексеріңіз." }
    ],
    admin: {
      automation: "Автоматтандыру",
      avgResponse: "Орт. жауап уақыты",
      activeTickets: "Белсенді өтінімдер",
      csat: "CSAT бағасы",
      inbound: "Өтінімдер кезегі",
      total: "барлығы",
      manualResolve: "Қолмен жабу",
      originalReq: "Хат алмасу тарихы",
      attachments: "Тіркемелер",
      aiAnalysis: "ИИ Талдау",
      sentiment: "Көңіл-күй",
      route: "Бөлім",
      agentResp: "Оператор жауабы",
      aiAssist: "AI Көмекші",
      sendResolve: "Жіберу және Жабу",
      sendMessage: "Хабарлама жіберу",
      selectTicket: "Жұмыс істеу үшін өтінімді таңдаңыз",
      generating: "Жасалуда...",
      draftPlaceholder: "Пайдаланушыға жауап жазыңыз...",
      statSub1: "+12% аптасына",
      statSub2: "-30сек",
      createTicket: "Жаңа өтінім",
      createModalTitle: "Өтінім құру",
      userIdLabel: "Пайдаланушы ID",
      descLabel: "Мәселе сипаттамасы",
      analyzeBtn: "Авто-толтыру (AI)",
      saveBtn: "Өтінім құру",
      cancelBtn: "Болдырмау",
      analyzing: "Талдау...",
      fillSuccess: "Деректер ИИ арқылы толтырылды",
      categoryLabel: "Санат",
      priorityLabel: "Басымдық",
      deptLabel: "Департамент",
      sourceLabel: "Дереккөз",
      simulateTitle: "Кіріс симуляциясы",
      notifications: "Хабарламалар",
      noNotifications: "Жаңа хабарламалар жоқ",
      markRead: "Оқылды деп белгілеу",
      filter: {
          all: "Барлығы",
          active: "Белсенді",
          resolved: "Жабылған"
      },
      sort: {
          date: "Күні бойынша",
          priority: "Маңыздылығы",
          category: "Санаты"
      },
      sources: {
          Portal: "Портал",
          Email: "Пошта",
          Chat: "Чат",
          Phone: "Телефон"
      }
    },
    status: {
      Open: "Ашық",
      "In Progress": "Орындалуда",
      Resolved: "Шешілді",
      Closed: "Closed"
    },
    priority: {
      High: "Жоғары",
      Medium: "Орташа",
      Low: "Төмен"
    },
    sentiments: {
      Positive: "Жағымды",
      Neutral: "Бейтарап",
      Negative: "Жағымсыз",
      Frustrated: "Ашулы/Сыни"
    },
    categories: {
        Network: "Желі/Интернет",
        Hardware: "Жабдық",
        Software: "Бағдарламалық қамтамасыз ету",
        Access: "Қол жеткізу",
        Other: "Басқа"
    },
    systemMessages: {
        timeout: "Белсенділік жоқ болғандықтан сессия жабылды (15 мин).",
        closedByAdmin: "QOLDA.AI қызметтерін пайдаланғаныңызға рахмет. Қызметті қайта пайдалану үшін бетті жаңартыңыз.",
        closedByAI: "Көмектескеніме қуаныштымын! Сессия аяқталды. Жаңа өтінім үшін бетті жаңартыңыз."
    }
  }
};

// --- Gemini Configuration ---
// Safe check for process.env to avoid ReferenceError in browser, plus fallback key.
const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) 
    ? process.env.API_KEY 
    : "AIzaSyCoDVBNeAO33Temt_6smMNhgyRTJHHtxiY";

// --- Mock Data ---

const LIVE_TICKET_ID = "LIVE-CHAT-001";

const MOCK_TICKETS: Ticket[] = [
  {
    id: LIVE_TICKET_ID,
    userId: "Current User (You)",
    description: "Live Chat Session",
    status: "Open",
    priority: "Medium",
    category: "Other",
    department: "Support",
    source: "Chat",
    summary: {
        RU: "Новый чат",
        KZ: "Жаңа чат"
    },
    sentiment: "Neutral",
    sentimentScore: 50,
    createdAt: new Date(),
    messages: [],
    attachments: []
  },
  {
    id: "TICK-1024",
    userId: "Emp-402",
    description: "VPN постоянно отключается каждые 5 минут, невозможно работать! Сделайте уже что-нибудь, у меня горят сроки.",
    status: "Open",
    priority: "High",
    category: "Network",
    department: "Network Security",
    source: "Chat",
    summary: {
        RU: "Сбои VPN соединения",
        KZ: "VPN қосылымының ақаулары"
    },
    sentiment: "Frustrated",
    sentimentScore: 15,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    messages: [
      { id: "m1", sender: "user", text: "VPN постоянно отключается каждые 5 минут, невозможно работать! Сделайте уже что-нибудь, у меня горят сроки.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
      { id: "m2", sender: "bot", text: "Я зарегистрировал это как проблему с сетью высокого приоритета. Специалисты уже уведомлены.", timestamp: new Date(Date.now() - 1000 * 60 * 59 * 2) }
    ],
    attachments: [
        {
            name: "vpn_error_log.png",
            type: "image/png",
            url: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=150&q=80"
        }
    ]
  },
  {
    id: "TICK-1023",
    userId: "Emp-115",
    description: "Добрый день. Мне нужна лицензия на Adobe Photoshop для нового маркетингового проекта.",
    status: "In Progress",
    priority: "Low",
    category: "Software",
    department: "IT Procurement",
    source: "Email",
    summary: {
        RU: "Запрос лицензии Photoshop",
        KZ: "Photoshop лицензиясына сұраныс"
    },
    sentiment: "Positive",
    sentimentScore: 90,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    messages: [
        { id: "m3", sender: "user", text: "Добрый день. Мне нужна лицензия на Adobe Photoshop для нового маркетингового проекта.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) }
    ],
    attachments: []
  },
  {
    id: "TICK-1021",
    userId: "Emp-332",
    description: "Принтер на 3 этаже снова жует бумагу. Уже второй раз за неделю.",
    status: "Open",
    priority: "Medium",
    category: "Hardware",
    department: "Desktop Support",
    source: "Portal",
    summary: {
        RU: "Неисправность принтера 3эт",
        KZ: "3-қабаттағы принтер ақауы"
    },
    sentiment: "Negative",
    sentimentScore: 40,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    messages: [
        { id: "m4", sender: "user", text: "Принтер на 3 этаже снова жует бумагу. Уже второй раз за неделю.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48) },
        { id: "m5", sender: "bot", text: "Принято. Инженер подойдет в течение часа.", timestamp: new Date(Date.now() - 1000 * 60 * 59 * 48) }
    ],
    attachments: []
  },
  {
      id: "TICK-1010",
      userId: "Emp-888",
      description: "Не могу зайти в учетную запись.",
      status: "Resolved",
      priority: "Medium",
      category: "Access",
      department: "Identity Management",
      source: "Phone",
      summary: {
          RU: "Проблема входа в УЗ",
          KZ: "Есептік жазбаға кіру"
      },
      sentiment: "Neutral",
      sentimentScore: 50,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
      messages: [
          { id: "m6", sender: "user", text: "Не могу зайти в учетную запись.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120) },
          { id: "m7", sender: "agent", text: "Пароль был сброшен. Проверьте SMS.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 118) }
      ],
      attachments: []
  }
];

// --- Components ---

const Header = ({ 
  role, 
  setRole, 
  lang, 
  setLang,
  notifications,
  onClearNotifications
}: { 
  role: Role; 
  setRole: (r: Role) => void; 
  lang: Lang; 
  setLang: (l: Lang) => void;
  notifications: Notification[];
  onClearNotifications: () => void;
}) => {
  const t = TEXT[lang];
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[5rem] h-auto py-3 sm:py-0 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-primary to-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20 font-bold text-2xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                    Q
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-none">{t.appTitle}</h1>
                    <p className="text-xs text-gray-500 font-medium tracking-wide uppercase mt-1">{t.appSubtitle}</p>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-6">
          {/* Notifications (Admin Only) */}
          {role === 'ADMIN' && (
              <div className="relative">
                  <button 
                    onClick={() => setShowNotifs(!showNotifs)}
                    className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors relative"
                  >
                      <i className="fas fa-bell"></i>
                      {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                              {unreadCount}
                          </span>
                      )}
                  </button>
                  {showNotifs && (
                      <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in z-50">
                          <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                              <h4 className="text-sm font-bold text-gray-700">{t.admin.notifications}</h4>
                              <button onClick={onClearNotifications} className="text-[10px] text-blue-500 hover:underline">{t.admin.markRead}</button>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                              {notifications.length === 0 ? (
                                  <div className="p-4 text-center text-gray-400 text-xs">{t.admin.noNotifications}</div>
                              ) : (
                                  notifications.map(n => (
                                      <div key={n.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 flex gap-3 ${n.read ? 'opacity-60' : 'bg-blue-50/30'}`}>
                                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                              n.type === 'error' ? 'bg-red-500' : 
                                              n.type === 'success' ? 'bg-green-500' : 
                                              n.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                                          }`}></div>
                                          <div>
                                              <p className="text-xs font-bold text-gray-800">{n.title}</p>
                                              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                                              <span className="text-[10px] text-gray-300 block mt-1">{n.timestamp.toLocaleTimeString()}</span>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* Language Toggle */}
          <div className="flex bg-gray-100/80 p-1.5 rounded-xl border border-gray-200">
            <button 
                onClick={() => setLang("KZ")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${lang === 'KZ' ? 'bg-white shadow-sm text-primary scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
                KZ
            </button>
            <button 
                onClick={() => setLang("RU")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${lang === 'RU' ? 'bg-white shadow-sm text-primary scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
                RU
            </button>
          </div>

          {/* Role Toggle */}
          <button
            onClick={() => setRole(role === "USER" ? "ADMIN" : "USER")}
            className="group flex items-center gap-3 px-5 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all duration-300 shadow-lg shadow-slate-800/20 hover:shadow-slate-800/30 active:scale-95 whitespace-nowrap"
          >
            <i className={`fas ${role === "USER" ? "fa-user-tie" : "fa-headset"} text-slate-300 group-hover:text-white transition-colors`}></i>
            <span className="text-sm font-medium hidden sm:inline">{role === "USER" ? t.employeeView : t.adminView}</span>
            <span className="text-sm font-medium sm:hidden">{role === "USER" ? "Сотрудник" : "Админ"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

// --- User View Components ---

const FAQSection = ({ lang }: { lang: Lang }) => {
    const t = TEXT[lang];
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggle = (idx: number) => {
        setOpenIndex(openIndex === idx ? null : idx);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-lg shadow-gray-200/50">
            <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                <i className="fas fa-question-circle text-primary/80"></i>
                {t.faqTitle}
            </h3>
            <div className="space-y-3">
                {t.faqs.map((faq, idx) => (
                    <div key={idx} className="group border border-gray-50 rounded-xl bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-100 transition-colors duration-200">
                        <button 
                            onClick={() => toggle(idx)} 
                            className="flex w-full items-center gap-3 text-left p-3 focus:outline-none"
                        >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${openIndex === idx ? 'bg-primary/10 text-primary' : 'bg-gray-200/50 text-gray-400'}`}>
                                <i className={`fas fa-chevron-right text-[10px] transition-transform duration-300 ${openIndex === idx ? 'rotate-90' : ''}`}></i>
                            </div>
                            <span className={`text-sm font-medium transition-colors ${openIndex === idx ? 'text-primary' : 'text-gray-700'}`}>{faq.q}</span>
                        </button>
                        <div 
                            className={`px-3 overflow-hidden transition-all duration-300 ease-in-out ${openIndex === idx ? 'max-h-32 opacity-100 pb-3' : 'max-h-0 opacity-0'}`}
                        >
                            <p className="text-sm text-gray-500 leading-relaxed pl-9">
                                {faq.a}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const UserChat = ({ 
    lang, 
    onCloseSession,
    onUpdateTicketDetails,
    onNewMessage,
    onUpdateSummary,
    liveTicket
}: { 
    lang: Lang; 
    onCloseSession: () => void;
    onUpdateTicketDetails: (data: any) => void;
    onNewMessage: (msg: Message) => void;
    onUpdateSummary: (ru: string, kz: string) => void;
    liveTicket?: Ticket;
}) => {
  const t = TEXT[lang];
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { 
        id: "welcome", 
        sender: "bot", 
        text: lang === "RU" 
            ? "Привет! Я QOLDA.AI, ваш виртуальный помощник. Я могу ответить на вопросы или зарегистрировать заявку автоматически." 
            : "Сәлем! Мен QOLDA.AI, сіздің виртуалды көмекшіңізбін. Сұрақтарға жауап бере аламын немесе өтінімді автоматты түрде тіркеймін.", 
        timestamp: new Date() 
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([]);
  const [sessionClosed, setSessionClosed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // 15 Minute Timeout Logic
  useEffect(() => {
    if (sessionClosed) return;

    const timeoutTimer = setTimeout(() => {
        const timeoutMsg: Message = {
            id: Date.now().toString(),
            sender: "bot",
            text: t.systemMessages.timeout,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, timeoutMsg]);
        onNewMessage(timeoutMsg);
        setSessionClosed(true);
        onCloseSession();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearTimeout(timeoutTimer);
  }, [messages, sessionClosed, lang]);

  // Check if ticket is closed/resolved in LiveTicket updates
  useEffect(() => {
      if (liveTicket && (liveTicket.status === 'Resolved' || liveTicket.status === 'Closed') && !sessionClosed) {
          setSessionClosed(true);
      }
  }, [liveTicket]);

  // Sync All messages from Live Ticket (History + New)
  useEffect(() => {
    if (liveTicket) {
        setMessages(prev => {
            // Force welcome message to stay at top if it exists locally
            const welcomeMsg = prev.find(m => m.id === 'welcome');
            const otherLocalMsgs = prev.filter(m => m.id !== 'welcome');
            
            // Get new messages from server that are not in local (excluding welcome)
            const newServerMsgs = liveTicket.messages.filter(
                serverMsg => !otherLocalMsgs.some(localMsg => localMsg.id === serverMsg.id)
            );

            if (newServerMsgs.length === 0) return prev;

            // Combine local (non-welcome) and new server messages
            const combinedHistory = [...otherLocalMsgs, ...newServerMsgs].sort((a,b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            
            // Always put welcome message first, regardless of timestamp sorting
            return welcomeMsg ? [welcomeMsg, ...combinedHistory] : combinedHistory;
        });
    }
  }, [liveTicket]);

  // Update Welcome message text on lang change without resetting history
  useEffect(() => {
    setMessages(prev => prev.map(msg => {
        if (msg.id === 'welcome') {
             return { 
                ...msg,
                text: lang === "RU" 
                    ? "Привет! Я QOLDA.AI, ваш виртуальный помощник. Я могу ответить на вопросы или зарегистрировать заявку автоматически." 
                    : "Сәлем! Мен QOLDA.AI, сіздің виртуалды көмекшіңізбін. Сұрақтарға жауап бере аламын немесе өтінімді автоматты түрде тіркеймін."
            };
        }
        return msg;
    }));
  }, [lang]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles: FileAttachment[] = Array.from(e.target.files).map(file => ({
              name: file.name,
              type: file.type,
              url: URL.createObjectURL(file)
          }));
          setSelectedFiles(prev => [...prev, ...newFiles]);
      }
  };

  const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || sessionClosed) return;
    
    const userMsg: Message = { 
        id: Date.now().toString(), 
        sender: "user", 
        text: input, 
        timestamp: new Date(),
        attachments: [...selectedFiles]
    };

    setMessages(prev => [...prev, userMsg]);
    onNewMessage(userMsg); // Notify parent for Admin sync
    
    // Check if it's the first real user message
    const isFirstMessage = messages.length === 1 && messages[0].id === 'welcome';
    
    setInput("");
    setSelectedFiles([]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const classificationSchema = {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, enum: ["SOLVE", "TICKET"], description: "SOLVE if general question. TICKET if breakage/request." },
          reply: { type: Type.STRING, description: "Detailed, step-by-step response in user language." },
          closeSession: { type: Type.BOOLEAN, description: "Set to TRUE ONLY if user explicitly confirms the issue is resolved." },
          generatedSummaryRU: { type: Type.STRING, description: "If this is the FIRST message, generate 3-5 word summary in Russian. Else null." },
          generatedSummaryKZ: { type: Type.STRING, description: "If this is the FIRST message, generate 3-5 word summary in Kazakh. Else null." },
          ticketData: {
             type: Type.OBJECT,
             properties: {
                 category: { type: Type.STRING, enum: ["Network", "Hardware", "Software", "Access", "Other"] },
                 priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                 department: { type: Type.STRING },
                 summaryRU: { type: Type.STRING },
                 summaryKZ: { type: Type.STRING },
                 sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative", "Frustrated"] },
                 sentimentScore: { type: Type.INTEGER }
             },
             description: "Identify ticket attributes from the conversation."
          }
        },
        required: ["intent", "reply"]
      };

      const context = messages.slice(-5).map(m => `${m.sender}: ${m.text}`).join('\n');
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Context:\n${context}\nUser: ${userMsg.text}`,
          config: {
              responseMimeType: "application/json",
              responseSchema: classificationSchema,
              systemInstruction: `You are QOLDA.AI. Language: ${lang === 'RU' ? 'Russian' : 'Kazakh'}.
              1. ACT as an expert IT support agent. Try to SOLVE the user's issue directly.
              2. Do NOT say "I will pass this to a specialist" or "I have registered a ticket" unless the user specifically asks for a human or if the issue is physically impossible to solve via chat (e.g. broken hardware). Even then, try troubleshooting steps first.
              3. Provide a CLEAR, CONCISE, and INFORMATIVE answer. Use bullet points.
              4. Do NOT start with greetings.
              5. After providing a solution, ASK the user: "${lang === 'RU' ? 'Помогло ли это решение? Могу ли я закрыть заявку?' : 'Бұл шешім көмектесті ме? Өтінімді жаба аламын ба?'}"
              6. ONLY set closeSession = true if the user EXPLICITLY confirms.
              7. If this is the FIRST message from user, generate a short summary for 'generatedSummaryRU' and 'generatedSummaryKZ'.
              8. Always analyze the conversation to populate 'ticketData'.
              `
          }
      });

      const result = JSON.parse(response.text);

      // Update Session Name if it's the first message
      if (isFirstMessage && result.generatedSummaryRU && result.generatedSummaryKZ) {
          onUpdateSummary(result.generatedSummaryRU, result.generatedSummaryKZ);
      }
      
      // Always update ticket details (Single Ticket Model)
      if (result.ticketData) {
          onUpdateTicketDetails(result.ticketData);
      }

      const botMsg: Message = {
          id: Date.now().toString(),
          sender: "bot",
          text: result.reply,
          timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
      onNewMessage(botMsg);
      
      if (result.closeSession) {
           setTimeout(() => {
                const closeMsg: Message = {
                    id: Date.now().toString(),
                    sender: "bot",
                    text: t.systemMessages.closedByAI,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, closeMsg]);
                onNewMessage(closeMsg);
                setSessionClosed(true);
                onCloseSession();
           }, 500);
      }

    } catch (e) {
      console.error(e);
      const errorMsg: Message = {
          id: Date.now().toString(),
          sender: "bot",
          text: lang === "RU" ? "Ошибка системы." : "Жүйе қатесі.",
          timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      onNewMessage(errorMsg);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] sm:h-[650px] bg-white rounded-3xl shadow-2xl shadow-blue-900/10 overflow-hidden border border-gray-100 transition-all duration-300">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-[#00A0E3] to-[#0077B6] p-5 flex items-center gap-4 relative overflow-hidden flex-shrink-0">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>
        
        <div className="relative w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md shadow-inner border border-white/20 z-10">
            <i className="fas fa-robot text-lg"></i>
            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-[3px] border-[#0077B6] rounded-full ${sessionClosed ? 'bg-gray-400' : 'bg-green-400'}`}></div>
        </div>
        <div className="z-10">
            <h3 className="text-white font-bold text-lg tracking-wide drop-shadow-sm">QOLDA.AI</h3>
            <p className="text-blue-50 text-xs flex items-center gap-1.5 opacity-90 font-medium">
                <span className={`w-1.5 h-1.5 bg-white rounded-full ${!sessionClosed && 'animate-pulse'}`}></span>
                {sessionClosed ? (lang === 'RU' ? 'Сессия завершена' : 'Сессия аяқталды') : t.chatOnline}
            </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F8FAFC] scrollbar-hide">
        {messages.map((m) => (
            <div key={m.id} className={`flex items-end gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.sender !== 'user' && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white to-gray-50 border border-gray-100 flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                        <i className={`fas ${m.sender === 'bot' ? 'fa-robot' : 'fa-headset'} text-sm`}></i>
                    </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col gap-2 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-5 py-3.5 shadow-sm relative group transition-all duration-200 ${
                        m.sender === 'user' 
                        ? 'bg-gradient-to-br from-primary to-blue-600 text-white rounded-br-sm shadow-blue-500/20' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-gray-200/50'
                    }`}>
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        {m.attachments && m.attachments.length > 0 && (
                            <div className={`mt-3 space-y-2 ${m.sender === 'user' ? 'bg-white/10' : 'bg-gray-50'} p-2 rounded-lg`}>
                                {m.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 rounded-md bg-black/5 hover:bg-black/10 transition-colors cursor-pointer">
                                        {file.type.startsWith('image/') ? (
                                             <img src={file.url} alt={file.name} className="w-10 h-10 object-cover rounded-md bg-white" />
                                        ) : (
                                            <div className="w-10 h-10 flex items-center justify-center bg-white rounded-md text-gray-500">
                                                <i className="fas fa-file"></i>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate opacity-90">{file.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className={`flex items-center gap-1 mt-1.5 opacity-80 ${m.sender === 'user' ? 'justify-end text-blue-100' : 'justify-start text-gray-400'}`}>
                            <span className="text-[10px] font-medium">
                                {m.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            {m.sender === 'user' && <i className="fas fa-check-double text-[10px]"></i>}
                        </div>
                    </div>
                </div>
                 {m.sender === 'user' && (
                    <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 shadow-sm flex-shrink-0">
                        <i className="fas fa-user text-sm"></i>
                    </div>
                )}
            </div>
        ))}
        {isTyping && (
            <div className="flex items-end gap-3 justify-start animate-fade-in">
                 <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                     <i className="fas fa-robot text-sm"></i>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-4 shadow-sm">
                    <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`p-3 sm:p-5 bg-white border-t border-gray-50 flex-shrink-0 ${sessionClosed ? 'opacity-60 pointer-events-none grayscale' : ''}`}>
        
        {/* File Preview */}
        {selectedFiles.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                {selectedFiles.map((file, idx) => (
                    <div key={idx} className="relative group flex-shrink-0">
                        <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                             {file.type.startsWith('image/') ? (
                                <img src={file.url} alt="preview" className="w-full h-full object-cover" />
                             ) : (
                                <i className="fas fa-file text-gray-400 text-xl"></i>
                             )}
                        </div>
                        <button 
                            onClick={() => removeFile(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className="relative flex items-center group gap-2">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sessionClosed}
                className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 hover:text-gray-700 transition-all flex-shrink-0"
            >
                <i className="fas fa-paperclip"></i>
            </button>
            <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
            />
            
            <div className="relative flex-1">
                <input 
                    type="text"
                    value={input}
                    maxLength={500}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={sessionClosed}
                    placeholder={sessionClosed ? (lang === 'RU' ? "Чат закрыт" : "Чат жабық") : t.chatPlaceholder}
                    className="w-full pl-5 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/50 focus:bg-white transition-all text-sm outline-none shadow-inner"
                />
                <button 
                    onClick={handleSend}
                    disabled={(!input.trim() && selectedFiles.length === 0) || isTyping || sessionClosed}
                    className="absolute right-2.5 top-2.5 p-2 bg-primary text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-primary transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                    <i className="fas fa-paper-plane text-sm"></i>
                </button>
            </div>
        </div>
        <div className="flex justify-between items-center mt-2 px-2">
            <span className="text-[10px] text-gray-300 font-medium">QOLDA.AI v1.3</span>
            <span className={`text-[10px] font-medium transition-colors ${input.length > 450 ? 'text-red-400' : 'text-gray-300'}`}>
                 {input.length}/500
            </span>
        </div>
      </div>
    </div>
  );
};

// --- Admin Components ---

const StatCard = ({ label, value, icon, color, subtext }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
        <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${color} bg-opacity-90 group-hover:bg-opacity-100 transition-all`}>
                <i className={`fas ${icon} text-xl`}></i>
            </div>
            {subtext && <span className="text-[11px] font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">{subtext}</span>}
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
        <p className="text-gray-500 text-sm mt-1 font-medium">{label}</p>
    </div>
);

const CreateTicketModal = ({ isOpen, onClose, onCreate, initialData, lang }: { isOpen: boolean, onClose: () => void, onCreate: (t: any) => void, initialData?: any, lang: Lang }) => {
    const t = TEXT[lang];
    const [desc, setDesc] = useState("");
    const [userId, setUserId] = useState("Emp-Manual");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Manual overrides
    const [priority, setPriority] = useState<string>("Medium");
    const [category, setCategory] = useState<string>("Other");
    const [department, setDepartment] = useState<string>("General Support");
    const [source, setSource] = useState<TicketSource>("Phone");
    const [summaryRU, setSummaryRU] = useState("");
    const [summaryKZ, setSummaryKZ] = useState("");
    const [sentiment, setSentiment] = useState("Neutral");
    const [sentimentScore, setSentimentScore] = useState(50);
    const [analysisDone, setAnalysisDone] = useState(false);

    const DEPARTMENTS = [
        "General Support",
        "Network Security",
        "IT Procurement",
        "Desktop Support",
        "Identity Management",
        "Software Support",
        "Hardware Maintenance",
        "Access Control"
    ];
    
    // Init from simulation data if provided
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDesc(initialData.desc || "");
                setSource(initialData.source || "Phone");
                setPriority(initialData.priority || "Medium");
                setCategory(initialData.category || "Other");
                setDepartment(initialData.department || "General Support");
                setUserId(initialData.userId || "Emp-Auto");
                setAnalysisDone(false); // Reset analysis state on new open
            } else {
                // Reset for fresh manual entry
                setDesc("");
                setUserId("Emp-Manual");
                setPriority("Medium");
                setCategory("Other");
                setDepartment("General Support");
                setSource("Phone");
                setSummaryRU("");
                setSummaryKZ("");
                setSentiment("Neutral");
                setSentimentScore(50);
                setAnalysisDone(false);
            }
        }
    }, [isOpen, initialData]);

    // Clear analysis done if user edits description manually
    useEffect(() => {
        if (!desc) {
            setAnalysisDone(false);
        }
    }, [desc]);

    const handleAnalyze = async () => {
        if (!desc) return;
        setIsAnalyzing(true);
        setAnalysisDone(false); // Reset before new analysis
        try {
            const ai = new GoogleGenAI({ apiKey });
            const schema = {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ["Network", "Hardware", "Software", "Access", "Other"] },
                    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                    department: { type: Type.STRING },
                    summaryRU: { type: Type.STRING },
                    summaryKZ: { type: Type.STRING },
                    sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative", "Frustrated"] },
                    sentimentScore: { type: Type.INTEGER }
                }
            };
            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: desc,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "You are an expert IT Ticket Analyzer. Analyze the description and extract structured data."
                }
            });
            const data = JSON.parse(res.text);
            
            if (data && (data.category || data.priority)) {
                setPriority(data.priority || "Medium");
                setCategory(data.category || "Other");
                // Attempt to match analyzed department to known list, else default
                setDepartment(data.department || "General Support");
                setSummaryRU(data.summaryRU || "");
                setSummaryKZ(data.summaryKZ || "");
                setSentiment(data.sentiment || "Neutral");
                setSentimentScore(data.sentimentScore || 50);
                setAnalysisDone(true);
            }

        } catch (e) {
            console.error("Analysis failed", e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = () => {
        const ticketData = {
            userId,
            description: desc,
            priority,
            category,
            department,
            source,
            summaryRU,
            summaryKZ,
            sentiment,
            sentimentScore
        };
        onCreate(ticketData);
        onClose();
    };

    const handleFieldChange = (setter: any, value: any) => {
        setter(value);
        setAnalysisDone(false); // Reset "AI Filled" badge if user manually changes a field
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">{t.admin.createModalTitle}</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.admin.userIdLabel}</label>
                        <input 
                            type="text" 
                            value={userId}
                            onChange={e => setUserId(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.admin.descLabel}</label>
                        <textarea 
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-sm h-32 resize-none"
                            placeholder="..."
                        />
                    </div>

                    <button 
                        onClick={handleAnalyze}
                        disabled={!desc || isAnalyzing}
                        className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium text-sm transition-colors flex items-center justify-center gap-2 mb-4"
                    >
                        {isAnalyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                        {isAnalyzing ? t.admin.analyzing : t.admin.analyzeBtn}
                    </button>
                    
                    {/* Manual Fields Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.admin.categoryLabel}</label>
                             <select 
                                value={category}
                                onChange={(e) => handleFieldChange(setCategory, e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                             >
                                <option value="Network">Network</option>
                                <option value="Hardware">Hardware</option>
                                <option value="Software">Software</option>
                                <option value="Access">Access</option>
                                <option value="Other">Other</option>
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.admin.priorityLabel}</label>
                             <select 
                                value={priority}
                                onChange={(e) => handleFieldChange(setPriority, e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                             >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                             </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.admin.deptLabel}</label>
                            <select 
                                value={department}
                                onChange={(e) => handleFieldChange(setDepartment, e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                {DEPARTMENTS.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.admin.sourceLabel}</label>
                            <select 
                                value={source}
                                onChange={(e) => handleFieldChange(setSource, e.target.value as TicketSource)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                <option value="Phone">{t.admin.sources.Phone}</option>
                                <option value="Email">{t.admin.sources.Email}</option>
                                <option value="Portal">{t.admin.sources.Portal}</option>
                                <option value="Chat">{t.admin.sources.Chat}</option>
                            </select>
                        </div>
                    </div>

                    {analysisDone && (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-xs space-y-1 animate-fade-in">
                            <p className="font-bold text-green-700 flex items-center gap-2"><i className="fas fa-check-circle"></i> {t.admin.fillSuccess}</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-200 rounded-lg transition-colors">{t.admin.cancelBtn}</button>
                    <button 
                        onClick={handleSubmit}
                        disabled={!desc}
                        className="px-6 py-2 bg-primary text-white font-bold text-sm rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {t.admin.saveBtn}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = ({ tickets, setTickets, lang }: { tickets: Ticket[], setTickets: any, lang: Lang }) => {
    const t = TEXT[lang];
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [replyDraft, setReplyDraft] = useState("");
    const [generating, setGenerating] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [simulationData, setSimulationData] = useState<any>(null);

    // Filter & Sort State
    const [filterStatus, setFilterStatus] = useState<"Active" | "Resolved" | "All">("Active");
    const [sortBy, setSortBy] = useState<"Date" | "Priority" | "Category">("Date");

    // Queue Logic
    const filteredQueue = tickets
        .filter(t => {
            if (filterStatus === "Active") return t.status !== "Resolved" && t.status !== "Closed";
            if (filterStatus === "Resolved") return t.status === "Resolved" || t.status === "Closed";
            return true;
        })
        .sort((a, b) => {
            // Keep LIVE ticket at top
            if (a.id === LIVE_TICKET_ID) return -1;
            if (b.id === LIVE_TICKET_ID) return 1;

            if (sortBy === "Date") return b.createdAt.getTime() - a.createdAt.getTime();
            if (sortBy === "Priority") {
                const pMap: any = { High: 3, Medium: 2, Low: 1 };
                return pMap[b.priority] - pMap[a.priority];
            }
            if (sortBy === "Category") return a.category.localeCompare(b.category);
            return 0;
        });

    const generateReply = async () => {
        if (!selectedTicket) return;
        setGenerating(true);
        setReplyDraft(""); // Clear previous
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `
                Language: ${lang === 'RU' ? 'Russian' : 'Kazakh'}
                Ticket Summary: ${selectedTicket.summary[lang]}
                Description: ${selectedTicket.description}
                Draft a response to the user telling them we are working on it or offering a solution.
                IMPORTANT: Output only the response text in ${lang === 'RU' ? 'Russian' : 'Kazakh'}.
            `;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ text: prompt }],
                config: {
                    systemInstruction: "You are a senior IT support agent. Draft a polite, professional, concise response."
                }
            });
            if (response.text) {
                setReplyDraft(response.text);
            } else {
                throw new Error("No text in response");
            }
        } catch (e) {
            console.error("Generate Reply Error:", e);
            setReplyDraft(lang === "RU" ? "Не удалось сгенерировать ответ. Попробуйте еще раз." : "Жауапты құрастыру сәтсіз аяқталды. Қайталап көріңіз.");
        } finally {
            setGenerating(false);
        }
    };

    const sendMessage = (shouldResolve: boolean) => {
        if (!selectedTicket || !replyDraft.trim()) return;

        let finalMessageText = replyDraft;
        
        // Append specific closing message if resolving
        if (shouldResolve) {
            finalMessageText += `\n\n${t.systemMessages.closedByAdmin}`;
        }

        const newMessage: Message = {
            id: Date.now().toString(),
            sender: "agent",
            text: finalMessageText,
            timestamp: new Date()
        };

        const updated = tickets.map(t => {
            if (t.id === selectedTicket.id) {
                return {
                    ...t,
                    status: shouldResolve ? (t.id === LIVE_TICKET_ID ? "Closed" : "Resolved") as any : t.status,
                    messages: [...t.messages, newMessage]
                };
            }
            return t;
        });

        setTickets(updated);
        
        if (shouldResolve) {
             setSelectedTicket(null); // Clear selection if resolved
        } else {
             // Keep selected but update the object to show new message
             const updatedTicket = updated.find(t => t.id === selectedTicket.id);
             if (updatedTicket) setSelectedTicket(updatedTicket);
        }
        setReplyDraft("");
    };

    const handleManualCreate = (data: any) => {
        const newTicket: Ticket = {
            id: `TICK-M${Math.floor(Math.random()*1000)}`,
            userId: data.userId,
            description: data.description,
            status: "Open",
            priority: data.priority || "Medium",
            category: data.category || "Other",
            department: data.department || "General",
            source: data.source || "Phone",
            summary: {
                RU: data.summaryRU || data.description.slice(0, 20),
                KZ: data.summaryKZ || data.description.slice(0, 20)
            },
            sentiment: data.sentiment || "Neutral",
            sentimentScore: data.sentimentScore || 50,
            messages: [],
            attachments: [],
            createdAt: new Date()
        };
        setTickets((prev: Ticket[]) => [newTicket, ...prev]);
    };

    const simulateIncoming = (source: TicketSource) => {
        const templates = [
            { desc: "Не работает интернет в офисе 205", cat: "Network", dept: "Network Security", prio: "High", summary: "Нет интернета оф.205" },
            { desc: "Прошу выдать доступ к Jira", cat: "Access", dept: "Identity Management", prio: "Low", summary: "Доступ к Jira" },
            { desc: "Сломался стул", cat: "Other", dept: "General Support", prio: "Low", summary: "Сломался стул" },
            { desc: "Ошибка 404 на внутреннем портале", cat: "Software", dept: "Software Support", prio: "Medium", summary: "Ошибка портала 404" },
            { desc: "Принтер не печатает, мигает красным", cat: "Hardware", dept: "Hardware Maintenance", prio: "Medium", summary: "Сбой принтера" }
        ];
        const tpl = templates[Math.floor(Math.random() * templates.length)];
        
        let userId = "";
        if (source === "Email") userId = `user${Math.floor(Math.random()*100)}@telecom.kz`;
        if (source === "Phone") userId = `+7 701 ${Math.floor(Math.random()*1000)} ${Math.floor(Math.random()*1000)}`;
        if (source === "Portal") userId = `EMP-${Math.floor(Math.random()*1000)}`;

        const data = {
            userId: userId,
            desc: tpl.desc,
            source: source,
            priority: tpl.prio,
            category: tpl.cat,
            department: tpl.dept
        };

        setSimulationData(data);
        setIsCreateOpen(true);
    };

    // Helper for sentiment visualization
    const getSentimentColor = (score: number) => {
        if (score <= 30) return "bg-red-500";
        if (score <= 60) return "bg-orange-400";
        return "bg-green-500";
    };

    const getSentimentLabel = (key: string) => {
        return (t.sentiments as any)[key] || key;
    };

    const getSourceIcon = (source: TicketSource) => {
        switch(source) {
            case "Email": return "fa-envelope";
            case "Phone": return "fa-phone";
            case "Chat": return "fa-comments";
            case "Portal": return "fa-globe";
            default: return "fa-circle";
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8">
            <CreateTicketModal 
                isOpen={isCreateOpen} 
                onClose={() => { setIsCreateOpen(false); setSimulationData(null); }}
                onCreate={handleManualCreate}
                initialData={simulationData}
                lang={lang}
            />

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard label={t.admin.automation} value="68%" icon="fa-robot" color="bg-primary" subtext={t.admin.statSub1} />
                <StatCard label={t.admin.avgResponse} value="1.2m" icon="fa-bolt" color="bg-indigo-500" subtext={t.admin.statSub2} />
                <StatCard label={t.admin.activeTickets} value={tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length} icon="fa-ticket-alt" color="bg-orange-500" />
                <StatCard label={t.admin.csat} value="4.8/5" icon="fa-smile" color="bg-green-500" />
            </div>

            {/* Simulation Row (Demo Only) */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                    <i className="fas fa-satellite-dish text-primary"></i> {t.admin.simulateTitle}
                </span>
                <div className="flex gap-2">
                     <button onClick={() => simulateIncoming("Email")} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors font-semibold flex items-center gap-2">
                        <i className="fas fa-envelope"></i> {t.admin.sources.Email}
                     </button>
                     <button onClick={() => simulateIncoming("Phone")} className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 border border-green-200 transition-colors font-semibold flex items-center gap-2">
                        <i className="fas fa-phone"></i> {t.admin.sources.Phone}
                     </button>
                     <button onClick={() => simulateIncoming("Portal")} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors font-semibold flex items-center gap-2">
                        <i className="fas fa-globe"></i> {t.admin.sources.Portal}
                     </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:h-[650px] h-[calc(100vh-250px)] min-h-[500px]">
                {/* Ticket Queue - Hidden on mobile if ticket selected */}
                <div className={`${selectedTicket ? 'hidden lg:flex' : 'flex'} lg:col-span-1 bg-white rounded-2xl border border-gray-200 overflow-hidden flex-col shadow-lg shadow-gray-200/40`}>
                    <div className="p-4 border-b border-gray-100 bg-gray-50/80 backdrop-blur space-y-3 flex-shrink-0">
                        <div className="flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                <h3 className="font-bold text-gray-800">{t.admin.inbound}</h3>
                                <span className="text-xs bg-white border border-blue-100 text-blue-600 px-2.5 py-1 rounded-full font-bold shadow-sm">{filteredQueue.length}</span>
                            </div>
                            <button 
                                onClick={() => setIsCreateOpen(true)}
                                className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:shadow-lg transition-all hover:scale-105"
                                title={t.admin.createTicket}
                            >
                                <i className="fas fa-plus"></i>
                            </button>
                        </div>
                        
                        {/* Filters & Sorting */}
                        <div className="flex gap-2">
                             <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-300 font-medium text-gray-600"
                             >
                                 <option value="Active">{t.admin.filter.active}</option>
                                 <option value="Resolved">{t.admin.filter.resolved}</option>
                                 <option value="All">{t.admin.filter.all}</option>
                             </select>
                             <select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-300 font-medium text-gray-600"
                             >
                                 <option value="Date">{t.admin.sort.date}</option>
                                 <option value="Priority">{t.admin.sort.priority}</option>
                                 <option value="Category">{t.admin.sort.category}</option>
                             </select>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-3 space-y-3 bg-gray-50/30">
                        {filteredQueue.length === 0 ? (
                             <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-3">
                                    <i className="fas fa-check text-2xl text-green-400"></i>
                                </div>
                                <p className="font-medium">Список пуст</p>
                             </div>
                        ) : (
                            filteredQueue.map(ticket => (
                                <div 
                                    key={ticket.id}
                                    onClick={() => { setSelectedTicket(ticket); setReplyDraft(""); }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                                        selectedTicket?.id === ticket.id 
                                        ? 'bg-white border-primary shadow-md shadow-blue-500/10 ring-1 ring-primary/20 scale-[1.02]' 
                                        : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-sm'
                                    } ${ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'opacity-70 grayscale-[0.5]' : ''} ${ticket.id === LIVE_TICKET_ID ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{ticket.id}</span>
                                            {/* Source Icon */}
                                            <span className="text-gray-400 text-xs" title={ticket.source}><i className={`fas ${getSourceIcon(ticket.source)}`}></i></span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {ticket.id === LIVE_TICKET_ID && ticket.status !== 'Closed' && <span className="animate-pulse w-2 h-2 rounded-full bg-green-500"></span>}
                                            {ticket.attachments && ticket.attachments.length > 0 && (
                                                <i className="fas fa-paperclip text-gray-400 text-xs"></i>
                                            )}
                                             {ticket.priority === 'High' && ticket.status !== 'Closed' && <i className="fas fa-exclamation-circle text-red-500 text-[10px]"></i>}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                ticket.status === 'Closed' || ticket.status === 'Resolved' ? 'bg-gray-100 text-gray-500' :
                                                ticket.priority === 'High' ? 'bg-red-50 text-red-600' :
                                                ticket.priority === 'Medium' ? 'bg-yellow-50 text-yellow-600' :
                                                'bg-green-50 text-green-600'
                                            }`}>
                                                {ticket.status === 'Closed' ? t.status.Closed : (t.priority[ticket.priority] || ticket.priority)}
                                            </span>
                                        </div>
                                    </div>
                                    <h4 className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug mb-3">{ticket.summary[lang]}</h4>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium border border-blue-100">{ticket.category}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400">{ticket.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Workspace - Hidden on mobile if no ticket selected */}
                <div className={`${!selectedTicket ? 'hidden lg:flex' : 'flex'} lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden flex-col relative shadow-xl shadow-gray-200/40`}>
                    {selectedTicket ? (
                        <>
                            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 flex-shrink-0">
                                <div className="flex items-start gap-3">
                                    <button 
                                        onClick={() => setSelectedTicket(null)}
                                        className="lg:hidden mt-1 p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                                    >
                                        <i className="fas fa-chevron-left"></i>
                                    </button>
                                    <div>
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{selectedTicket.summary[lang]}</h2>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                {selectedTicket.status === 'Resolved' ? t.status.Resolved : selectedTicket.status === 'Closed' ? t.status.Closed : selectedTicket.id}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 flex items-center gap-2">
                                            <i className={`fas ${getSourceIcon(selectedTicket.source)} text-gray-400`}></i>
                                            {selectedTicket.userId} 
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            {selectedTicket.createdAt.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
                                <div className="mb-8">
                                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <i className="fas fa-align-left"></i> {t.admin.originalReq}
                                    </h5>
                                    
                                    {/* Chat History View for Admin */}
                                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50 space-y-4 max-h-[400px] overflow-y-auto">
                                        {/* If no messages (manual ticket), show description as a bubble */}
                                        {selectedTicket.messages.length === 0 ? (
                                             <div className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs"><i className="fas fa-user"></i></div>
                                                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-gray-800 text-sm">
                                                    {selectedTicket.description}
                                                </div>
                                             </div>
                                        ) : (
                                            selectedTicket.messages.map((m, idx) => (
                                                <div key={idx} className={`flex gap-3 ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                                                    {m.sender === 'user' && (
                                                         <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs flex-shrink-0"><i className="fas fa-user"></i></div>
                                                    )}
                                                    <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm text-sm ${
                                                        m.sender === 'user' 
                                                        ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-none' 
                                                        : (m.sender === 'bot' ? 'bg-blue-50 border border-blue-100 text-blue-900 rounded-tr-none' : 'bg-primary text-white rounded-tr-none')
                                                    }`}>
                                                        <p className="whitespace-pre-wrap">{m.text}</p>
                                                        {m.attachments && m.attachments.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {m.attachments.map((f, i) => (
                                                                     <div key={i} className="flex items-center gap-2 text-xs opacity-90 bg-black/10 p-1.5 rounded">
                                                                        <i className="fas fa-paperclip"></i> {f.name}
                                                                     </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <span className="text-[10px] opacity-60 block mt-1 text-right">{m.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                    {m.sender !== 'user' && (
                                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 ${m.sender === 'bot' ? 'bg-blue-400' : 'bg-primary'}`}>
                                                             <i className={`fas ${m.sender === 'bot' ? 'fa-robot' : 'fa-headset'}`}></i>
                                                         </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    
                                    {/* Attachments Section */}
                                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                        <div className="mt-4">
                                             <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <i className="fas fa-paperclip"></i> {t.admin.attachments}
                                            </h5>
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                                {selectedTicket.attachments.map((file, idx) => (
                                                    <div key={idx} className="group relative w-24 h-24 rounded-lg bg-gray-100 border border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:shadow-md transition-all cursor-pointer">
                                                         {file.type.startsWith('image/') ? (
                                                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                         ) : (
                                                            <div className="flex flex-col items-center text-gray-500">
                                                                <i className="fas fa-file text-2xl mb-1"></i>
                                                                <span className="text-[10px] px-2 truncate w-full text-center">{file.name}</span>
                                                            </div>
                                                         )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t.admin.aiAnalysis}</h5>
                                        {/* Dynamic Sentiment Card */}
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-xs text-gray-500 font-semibold uppercase">{t.admin.sentiment}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${getSentimentColor(selectedTicket.sentimentScore)}`}>
                                                    {selectedTicket.sentimentScore}%
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                                                <div 
                                                    className={`h-full ${getSentimentColor(selectedTicket.sentimentScore)} transition-all duration-1000 ease-out`} 
                                                    style={{ width: `${selectedTicket.sentimentScore}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-sm font-medium text-gray-700 text-right">
                                                {getSentimentLabel(selectedTicket.sentiment)}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t.admin.route}</h5>
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-full flex flex-col justify-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <i className="fas fa-building"></i>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-gray-500">Департамент</span>
                                                    <span className="text-sm font-bold text-gray-900">{selectedTicket.department}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Closed' && (
                                <div>
                                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t.admin.agentResp}</h5>
                                    <div className="relative group">
                                        <textarea
                                            value={replyDraft}
                                            onChange={(e) => setReplyDraft(e.target.value)}
                                            placeholder={t.admin.draftPlaceholder}
                                            className="w-full h-40 p-5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm resize-none shadow-sm leading-relaxed"
                                        />
                                        {!replyDraft && !generating && (
                                            <div className="absolute top-4 right-4">
                                                 <button 
                                                    onClick={generateReply}
                                                    className="flex items-center gap-2 text-xs bg-gradient-to-r from-primary to-blue-500 text-white px-3 py-1.5 rounded-lg hover:shadow-lg transition-all font-medium hover:-translate-y-0.5"
                                                >
                                                    <i className="fas fa-wand-magic-sparkles"></i> {t.admin.aiAssist}
                                                </button>
                                            </div>
                                        )}
                                        {replyDraft && !generating && (
                                            <div className="absolute top-4 right-4">
                                                 <button 
                                                    onClick={generateReply}
                                                    title="Regenerate"
                                                    className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-primary transition-all shadow-sm"
                                                >
                                                    <i className="fas fa-redo"></i>
                                                </button>
                                            </div>
                                        )}
                                        {generating && (
                                            <div className="absolute top-4 right-4">
                                                 <span className="text-xs text-primary font-bold flex items-center gap-2 bg-blue-50 px-2 py-1 rounded">
                                                    <i className="fas fa-spinner fa-spin"></i> {t.admin.generating}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                                        <button 
                                            onClick={() => sendMessage(false)}
                                            disabled={!replyDraft}
                                            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <i className="fas fa-comment-alt"></i> {t.admin.sendMessage}
                                        </button>
                                        <button 
                                            onClick={() => sendMessage(true)}
                                            disabled={!replyDraft}
                                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-500/30 font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <i className="fas fa-check"></i> {t.admin.sendResolve}
                                        </button>
                                    </div>
                                </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/30">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                                <i className="fas fa-inbox text-4xl text-gray-200"></i>
                            </div>
                            <p className="font-medium text-gray-500">{t.admin.selectTicket}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main App ---

const App = () => {
    const [role, setRole] = useState<Role>("USER");
    const [lang, setLang] = useState<Lang>("RU");
    const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const t = TEXT[lang];

    const addNotification = (title: string, message: string, type: "info" | "warning" | "success" | "error") => {
        const notif: Notification = {
            id: Date.now().toString(),
            title,
            message,
            type,
            timestamp: new Date(),
            read: false
        };
        setNotifications(prev => [notif, ...prev]);
    };

    const handleCreateTicket = (text: string, analysis: any, attachments: FileAttachment[]) => {
        const newTicket: Ticket = {
            id: analysis.id || `TICK-${Date.now().toString().slice(-4)}`,
            userId: lang === 'RU' ? "Текущий пользователь" : "Ағымдағы пайдаланушы",
            description: text,
            status: "Open",
            priority: analysis.priority || "Medium",
            category: analysis.category || "Other",
            department: analysis.department || "General Support",
            source: "Chat",
            summary: {
                RU: analysis.summaryRU || text.slice(0, 30) + "...",
                KZ: analysis.summaryKZ || text.slice(0, 30) + "..."
            },
            sentiment: analysis.sentiment || "Neutral",
            sentimentScore: analysis.sentimentScore || 50,
            createdAt: new Date(),
            messages: [],
            attachments: attachments
        };
        setTickets(prev => [newTicket, ...prev]);

        // Trigger Notification
        addNotification(
            lang === 'RU' ? 'Новая автоматическая заявка' : 'Жаңа автоматты өтінім',
            `${lang === 'RU' ? 'ID заявки' : 'Өтінім ID'}: ${newTicket.id} (${newTicket.category})`,
            "success"
        );
    };

    const handleUserMessage = (msg: Message) => {
        // Sync User messages to the LIVE Ticket so Admin can see them real-time
        setTickets(prev => prev.map(t => {
            if (t.id === LIVE_TICKET_ID) {
                return {
                    ...t,
                    messages: [...t.messages, msg],
                    // Update summary to show last message text
                    description: msg.text
                }
            }
            return t;
        }));
    };

    const handleUpdateSummary = (ru: string, kz: string) => {
        setTickets(prev => prev.map(t => {
            if (t.id === LIVE_TICKET_ID) {
                return {
                    ...t,
                    summary: { RU: ru, KZ: kz }
                }
            }
            return t;
        }));
    };

    const handleCloseSession = () => {
        setTickets(prev => prev.map(t => {
            if (t.id === LIVE_TICKET_ID) {
                return { ...t, status: "Closed" };
            }
            return t;
        }));
    };

    const handleUpdateTicketDetails = (data: any) => {
        setTickets(prev => prev.map(t => {
            if (t.id === LIVE_TICKET_ID) {
                const updated = {
                     ...t,
                     priority: data.priority || t.priority,
                     category: data.category || t.category,
                     department: data.department || t.department,
                     sentiment: data.sentiment || t.sentiment,
                     sentimentScore: data.sentimentScore || t.sentimentScore
                };
                
                 // Notify if sentiment is bad
                if (data.sentiment === 'Frustrated' || data.sentiment === 'Negative') {
                     addNotification(
                        lang === 'RU' ? 'Внимание: Негативный настрой' : 'Назар аударыңыз: Жағымсыз көңіл-күй',
                        `${lang === 'RU' ? 'Пользователь расстроен в заявке' : 'Пайдаланушы өтінімде көңілсіз'}: ${t.id}`,
                        "warning"
                    );
                }
                return updated;
            }
            return t;
        }));
    };

    // Find the live ticket to pass down for reverse sync
    const liveTicket = tickets.find(t => t.id === LIVE_TICKET_ID);

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Header 
                role={role} 
                setRole={setRole} 
                lang={lang} 
                setLang={setLang} 
                notifications={notifications}
                onClearNotifications={() => setNotifications(prev => prev.map(n => ({...n, read: true})))}
            />
            
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
                {role === "USER" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                             <div className="mb-2">
                                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                                    {t.welcomeUser}
                                </h2>
                                <p className="text-gray-500 text-sm sm:text-lg mt-1 font-light">
                                    {t.welcomeSub}
                                </p>
                             </div>
                             <UserChat 
                                lang={lang} 
                                onCloseSession={handleCloseSession}
                                onUpdateTicketDetails={handleUpdateTicketDetails}
                                onNewMessage={handleUserMessage}
                                onUpdateSummary={handleUpdateSummary}
                                liveTicket={liveTicket}
                             />
                        </div>
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6">
                                <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                                    <i className="fas fa-history text-primary/80"></i>
                                    {t.yourTickets}
                                </h3>
                                <div className="space-y-3">
                                    {tickets.filter(ticket => (ticket.userId === "Текущий пользователь" || ticket.userId === "Ағымдағы пайдаланушы") || ticket.id === LIVE_TICKET_ID).map(ticket => (
                                        <div key={ticket.id} className={`p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors group ${ticket.id === LIVE_TICKET_ID ? 'ring-1 ring-blue-100' : ''}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-mono text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                                                    {ticket.id === LIVE_TICKET_ID && ticket.status !== 'Closed' && <i className="fas fa-circle text-[6px] text-green-500 mr-1 animate-pulse"></i>}
                                                    {ticket.id}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                    ticket.status === 'Resolved' ? 'bg-green-100 text-green-700' : 
                                                    ticket.status === 'Closed' ? 'bg-gray-200 text-gray-600' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {t.status[ticket.status]}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-primary transition-colors">{ticket.summary[lang]}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <FAQSection lang={lang} />
                        </div>
                    </div>
                ) : (
                    <AdminDashboard tickets={tickets} setTickets={setTickets} lang={lang} />
                )}
            </main>
        </div>
    );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);