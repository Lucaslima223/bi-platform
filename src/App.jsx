import { useState, useEffect, useContext, createContext, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  ClipboardList, Warehouse, BarChart2, ShoppingBag,
  LogOut, Bell, ChevronRight,
  Award, RefreshCw, AlertCircle, CheckCircle, Clock,
  Menu, Home, Loader, Users, Box, Search, User
} from "lucide-react";
import logo from "./assets/Omnia_Analytics.png";
import favicon from "./assets/faviconbi.png"

/* ═══════════════════════════════════════════════
   CONFIGURAÇÃO DE API
═══════════════════════════════════════════════ */
const CONFIG = {
  API_BASE: "http://localhost:3001/api",
};

/* ═══════════════════════════════════════════════
   AUTH CONTEXT  —  disponibiliza token para todos os filhos
═══════════════════════════════════════════════ */
const AuthCtx = createContext(null);

/* ═══════════════════════════════════════════════
   DATE RANGE CONTEXT  —  filtro global de período
═══════════════════════════════════════════════ */
const DateRangeCtx = createContext(null);

function useDateRange() {
  return useContext(DateRangeCtx);
}

/* ═══════════════════════════════════════════════
   FILTERS CONTEXT  —  filtro global de filial e vendedor
═══════════════════════════════════════════════ */
const FiltersCtx = createContext(null);

function useFilters() {
  return useContext(FiltersCtx);
}

/* ═══════════════════════════════════════════════
   PALETA DE CORES
═══════════════════════════════════════════════ */
const C = {
  bg0:    "#060912",
  bg1:    "#0d1321",
  bg2:    "#111827",
  bg3:    "#1c2535",
  border: "#1e2d4a",
  border2:"#2d3f5c",
  amber:  "#f09b1c",
  amberL: "#f3ad2b",
  blue:   "#3b82f6",
  green:  "#10b981",
  red:    "#ef4444",
  purple: "#8b5cf6",
  text1:  "#f1f5f9",
  text2:  "#94a3b8",
  text3:  "#64748b",
};



/* ═══════════════════════════════════════════════
   FORMATADORES
═══════════════════════════════════════════════ */
const fmt = {
  brl:  (v) => "R$ " + (v||0).toLocaleString("pt-BR", { minimumFractionDigits:0, maximumFractionDigits:0 }),
  brlK: (v) => v >= 1e6 ? `R$ ${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(0)}K` : fmt.brl(v),
  pct:  (v) => `${(v||0).toFixed(1)}%`,
  num:  (v) => (v||0).toLocaleString("pt-BR"),
};

/* ═══════════════════════════════════════════════
   HOOK useApiData
   Busca dados do backend.
   Retorna { data, loading, reload }
═══════════════════════════════════════════════ */
function useApiData(endpoint) {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const dateRange             = useDateRange();
  const filters               = useFilters();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (dateRange) {
      params.append("datai", dateRange.datai);
      params.append("dataf", dateRange.dataf);
    }
    if (filters) {
      if (filters.filial && filters.filial !== "todas") params.append("filial", filters.filial);
      if (filters.vendedor && filters.vendedor !== "todos") params.append("vendedor", filters.vendedor);
    }
    const queryStr = params.toString();
    const url = `${CONFIG.API_BASE}${endpoint}${queryStr ? "?" + queryStr : ""}`;
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => setData(json))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint, dateRange, filters]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

/* ═══════════════════════════════════════════════
   COMPONENTES BASE
═══════════════════════════════════════════════ */
function KPICard({ label, value, sub, trend, icon: Icon, color = C.blue, loading = false }) {
  const up = trend > 0;
  return (
    <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 24px", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ color:C.text2, fontSize:13, fontWeight:500, letterSpacing:"0.03em", textTransform:"uppercase" }}>{label}</span>
        {Icon && <div style={{ width:36, height:36, borderRadius:8, background:`${color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {loading ? <Loader size={16} color={color} style={{animation:"spin 1s linear infinite"}}/> : <Icon size={18} color={color}/>}
        </div>}
      </div>
      <div>
        <div style={{ color:C.text1, fontSize:26, fontWeight:700, fontFamily:"monospace", letterSpacing:"-0.02em", lineHeight:1 }}>{value}</div>
        {(sub || trend !== undefined) && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
            {trend !== undefined && (
              <span style={{ color: up ? C.green : C.red, fontSize:12, display:"flex", alignItems:"center", gap:3 }}>
                {up ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {sub && <span style={{ color:C.text3, fontSize:12 }}>{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <h2 style={{ color:C.text1, fontSize:16, fontWeight:600, margin:0 }}>{children}</h2>
      {action && (
        <button onClick={action.fn} style={{ color:C.blue, fontSize:13, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          {action.label} <ChevronRight size={14}/>
        </button>
      )}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:12, padding:20, ...style }}>
      {children}
    </div>
  );
}

function Badge({ children, type = "neutral" }) {
  const map = {
    success: { bg:"#10b98120", color:C.green  },
    warning: { bg:"#f59e0b20", color:C.amber  },
    danger:  { bg:"#ef444420", color:C.red    },
    neutral: { bg:C.border,    color:C.text2  },
  };
  const s = map[type] || map.neutral;
  return (
    <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:20, letterSpacing:"0.04em" }}>
      {children}
    </span>
  );
}

const CHART_TOOLTIP = {
  contentStyle: { background:C.bg3, border:`1px solid ${C.border2}`, borderRadius:8, color:C.text1, fontSize:13 },
  labelStyle:   { color:C.text2, marginBottom:4 },
};

function RankingBar({ label, value, max, rank, color = C.blue }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ color:C.text3, fontSize:12, fontFamily:"monospace", width:20, textAlign:"right" }}>{rank}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ color:C.text1, fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>
          <span style={{ color:C.text1, fontSize:13, fontFamily:"monospace", fontWeight:600, marginLeft:12 }}>{typeof value === "number" && value > 1000 ? fmt.brlK(value) : value}</span>
        </div>
        <div style={{ height:4, background:C.bg3, borderRadius:4 }}>
          <div style={{ height:4, width:`${pct}%`, background:color, borderRadius:4, transition:"width 0.6s ease" }}/>
        </div>
      </div>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div style={{ position:"absolute", inset:0, background:`${C.bg2}80`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", zIndex:5 }}>
      <Loader size={22} color={C.blue} style={{animation:"spin 1s linear infinite"}}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */
const NAV = [
  { id:"home",           label:"Visão Geral",      icon:Home          },
  { id:"vendas",         label:"Vendas",            icon:TrendingUp    },
  { id:"compras",        label:"Compras",           icon:ShoppingCart  },
  { id:"producao",       label:"Produção",          icon:Package       },
  { id:"estoque",        label:"Estoque",           icon:Warehouse     },
  { id:"cliente",        label:"Cliente",           icon:Users         },
  { id:"produto",        label:"Produto",           icon:Box           },
  { id:"pedido_venda",   label:"Pedidos de Venda",  icon:ClipboardList },
  { id:"pedido_compra",  label:"Pedidos de Compra", icon:ShoppingBag   },
];

function Sidebar({ active, onNav, collapsed, user }) {
  return (
    <div style={{ width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240, background:C.bg1, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", height:"100vh", transition:"width 0.2s, min-width 0.2s", overflow:"hidden", position:"sticky", top:0 }}>
      <div
  style={{
    padding: "20px 16px 16px",
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: 12
  }}
>
  <img
    src={collapsed ? favicon : logo}
    alt="BI Corporativo"
    style={{
      height: collapsed ? 32 : 26,
      width: "auto",
      objectFit: "contain"
    }}
  />
</div>

      <nav style={{ flex:1, padding:"12px 8px", overflowY:"auto" }}>
        {NAV.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={()=>onNav(item.id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:10,
              padding: collapsed ? "11px 15px" : "10px 12px",
              background: isActive ? `${C.blue}18` : "none",
              border: isActive ? `1px solid ${C.blue}30` : "1px solid transparent",
              borderRadius:8, cursor:"pointer", marginBottom:2, textAlign:"left", transition:"all 0.15s",
            }}>
              <Icon size={18} color={isActive ? C.blue : C.text3} style={{flexShrink:0}}/>
              {!collapsed && <span style={{ color: isActive ? C.blue : C.text2, fontSize:13, fontWeight: isActive ? 600 : 400, whiteSpace:"nowrap" }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`${C.blue}20`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ color:C.blue, fontSize:12, fontWeight:700 }}>{user?.nome?.[0]?.toUpperCase() || "U"}</span>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ color:C.text1, fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.nome}</div>
              <div style={{ color:C.text3, fontSize:11 }}>{user?.filial}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════ */
function Header({ title, onToggleSidebar, onLogout }) {
  const { datai, dataf, setDateRange } = useDateRange();
  const { filial, setFilial, vendedor, setVendedor } = useFilters();
  const [openDate, setOpenDate] = useState(false);
  const [openFilial, setOpenFilial] = useState(false);
  const [openVendedor, setOpenVendedor] = useState(false);
  const [localDatai, setLocalDatai] = useState(datai);
  const [localDataf, setLocalDataf] = useState(dataf);

  // Filiais e vendedores reais, carregados do backend (/api/filtros)
  const [filiais, setFiliais]       = useState(["Todas"]);
  const [vendedores, setVendedores] = useState(["Todos"]);

  useEffect(() => {
    fetch(`${CONFIG.API_BASE}/filtros`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => {
        setFiliais(["Todas", ...(j.filiais || [])]);
        setVendedores(["Todos", ...(j.vendedores || [])]);
      })
      .catch(() => {/* mantém só "Todas"/"Todos" se a API estiver indisponível */});
  }, []);

  const handleApply = () => {
    if (localDatai && localDataf && localDatai <= localDataf) {
      setDateRange({ datai: localDatai, dataf: localDataf });
      setOpenDate(false);
    }
  };

  const handlePreset = (months) => {
    const end   = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const di = start.toISOString().split("T")[0];
    const df = end.toISOString().split("T")[0];
    setLocalDatai(di);
    setLocalDataf(df);
    setDateRange({ datai: di, dataf: df });
    setOpenDate(false);
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y,m,d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const displayFilial = filial === "todas" ? "Todas" : filial;
  const displayVendedor = vendedor === "todos" ? "Todos" : vendedor;

  const inp = {
    background: C.bg3, border: `1px solid ${C.border2}`,
    borderRadius: 6, color: C.text1, padding: "7px 10px",
    fontSize: 13, outline: "none", colorScheme: "dark",
  };

  return (
    <div style={{ height:56, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", background:C.bg1, position:"sticky", top:0, zIndex:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onToggleSidebar} style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, display:"flex", alignItems:"center" }}>
          <Menu size={18}/>
        </button>
        <h1 style={{ color:C.text1, fontSize:15, fontWeight:600, margin:0 }}>{title}</h1>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {/* Filtro de Data */}
        <div style={{ position:"relative" }}>
          <button
            onClick={() => { setLocalDatai(datai); setLocalDataf(dataf); setOpenDate(o=>!o); }}
            style={{
              display:"flex", alignItems:"center", gap:8,
              background: C.bg3, border:`1px solid ${openDate ? C.amber : C.border2}`,
              borderRadius:8, padding:"6px 12px", cursor:"pointer",
              color: C.text1, fontSize:13, transition:"border-color 0.15s",
            }}
          >
            <Clock size={14} color={C.amber}/>
            <span style={{ color: C.text2, fontSize:12 }}>
              {fmtDate(datai)} — {fmtDate(dataf)}
            </span>
            <ChevronRight size={13} color={C.text3} style={{ transform: openDate ? "rotate(90deg)" : "rotate(0)", transition:"transform 0.2s" }}/>
          </button>

          {openDate && (
            <div style={{
              position:"absolute", right:0, top:"calc(100% + 8px)",
              background:C.bg2, border:`1px solid ${C.border2}`,
              borderRadius:12, padding:20, width:300, zIndex:100,
              boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
            }}>
              <p style={{ color:C.text2, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 12px" }}>Período</p>

              {/* Presets */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
                {[
                  { label:"30 dias",  months:1  },
                  { label:"3 meses",  months:3  },
                  { label:"6 meses",  months:6  },
                  { label:"12 meses", months:12 },
                  { label:"2 anos",   months:24 },
                  { label:"5 anos",   months:60 },
                ].map(p => (
                  <button key={p.label} onClick={() => handlePreset(p.months)} style={{
                    background: C.bg3, border:`1px solid ${C.border2}`,
                    borderRadius:6, padding:"5px 10px", cursor:"pointer",
                    color:C.text2, fontSize:12, transition:"all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.color = C.amber; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
                  >{p.label}</button>
                ))}
              </div>

              {/* Inputs manuais */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <label style={{ color:C.text3, fontSize:11, fontWeight:600, letterSpacing:"0.04em", display:"block", marginBottom:5 }}>DE</label>
                  <input type="date" value={localDatai} onChange={e => setLocalDatai(e.target.value)} style={{...inp, width:"100%", boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{ color:C.text3, fontSize:11, fontWeight:600, letterSpacing:"0.04em", display:"block", marginBottom:5 }}>ATÉ</label>
                  <input type="date" value={localDataf} onChange={e => setLocalDataf(e.target.value)} style={{...inp, width:"100%", boxSizing:"border-box"}}/>
                </div>
                <button onClick={handleApply} style={{
                  background: C.amber, color:"#000", fontWeight:700, fontSize:13,
                  border:"none", borderRadius:8, padding:"10px", cursor:"pointer",
                  marginTop:4, transition:"opacity 0.15s",
                }}>Aplicar Filtro</button>
              </div>
            </div>
          )}
        </div>

        {/* Filtro de Filial */}
        <div style={{ position:"relative" }}>
          <button
            onClick={() => setOpenFilial(o=>!o)}
            style={{
              display:"flex", alignItems:"center", gap:8,
              background: C.bg3, border:`1px solid ${openFilial ? C.amber : C.border2}`,
              borderRadius:8, padding:"6px 12px", cursor:"pointer",
              color: C.text1, fontSize:13, transition:"border-color 0.15s",
            }}
          >
            <Warehouse size={14} color={C.blue}/>
            <span style={{ color: C.text2, fontSize:12 }}>
              {displayFilial}
            </span>
            <ChevronRight size={13} color={C.text3} style={{ transform: openFilial ? "rotate(90deg)" : "rotate(0)", transition:"transform 0.2s" }}/>
          </button>

          {openFilial && (
            <div style={{
              position:"absolute", right:0, top:"calc(100% + 8px)",
              background:C.bg2, border:`1px solid ${C.border2}`,
              borderRadius:12, padding:12, width:180, zIndex:100,
              boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {filiais.map(f => (
                <button key={f} onClick={() => { setFilial(f === "Todas" ? "todas" : f); setOpenFilial(false); }} style={{
                  width:"100%", display:"block", textAlign:"left",
                  background:"none", border:"none", padding:"10px 12px", cursor:"pointer",
                  color: displayFilial === f ? C.amber : C.text2,
                  fontSize:13, transition:"all 0.15s", borderRadius:6,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bg3; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* Filtro de Vendedor */}
        <div style={{ position:"relative" }}>
          <button
            onClick={() => setOpenVendedor(o=>!o)}
            style={{
              display:"flex", alignItems:"center", gap:8,
              background: C.bg3, border:`1px solid ${openVendedor ? C.amber : C.border2}`,
              borderRadius:8, padding:"6px 12px", cursor:"pointer",
              color: C.text1, fontSize:13, transition:"border-color 0.15s",
            }}
          >
            <ShoppingCart size={14} color={C.green}/>
            <span style={{ color: C.text2, fontSize:12 }}>
              {displayVendedor}
            </span>
            <ChevronRight size={13} color={C.text3} style={{ transform: openVendedor ? "rotate(90deg)" : "rotate(0)", transition:"transform 0.2s" }}/>
          </button>

          {openVendedor && (
            <div style={{
              position:"absolute", right:0, top:"calc(100% + 8px)",
              background:C.bg2, border:`1px solid ${C.border2}`,
              borderRadius:12, padding:12, width:180, zIndex:100,
              boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {vendedores.map(v => (
                <button key={v} onClick={() => { setVendedor(v === "Todos" ? "todos" : v); setOpenVendedor(false); }} style={{
                  width:"100%", display:"block", textAlign:"left",
                  background:"none", border:"none", padding:"10px 12px", cursor:"pointer",
                  color: displayVendedor === v ? C.amber : C.text2,
                  fontSize:13, transition:"all 0.15s", borderRadius:6,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bg3; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >{v}</button>
              ))}
            </div>
          )}
        </div>

        <button style={{ background:"none", border:"none", cursor:"pointer", color:C.text3 }}><Bell size={17}/></button>
        <button onClick={onLogout} style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
          <LogOut size={15}/> Sair
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: HOME — /api/home
═══════════════════════════════════════════════ */
function DashHome({ onNav }) {
  const { data, loading } = useApiData("/home");

  const kpis  = data.kpis                || {};
  const vend  = data.vendas_periodo      || [];
  const topV  = data.top_vendedores      || [];
  const estF  = data.estoque_filial      || [];
  const prodS = data.producao_status     || [];
  const pvS   = data.pedido_venda_status || [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, position:"relative" }}>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
        <KPICard label="Faturamento Mês"    value={fmt.brlK(kpis.faturamento)}    trend={8.3}  sub="vs mês anterior" icon={TrendingUp}    color={C.green}  loading={loading}/>
        <KPICard label="Compras Mês"        value={fmt.brlK(kpis.compras)}        trend={-2.1} sub="vs mês anterior" icon={ShoppingCart}  color={C.blue}   loading={loading}/>
        <KPICard label="Pedidos em Aberto"  value={fmt.num(kpis.pedidos_aberto)}  trend={4.7}  sub="pedidos de venda" icon={ClipboardList} color={C.amber}  loading={loading}/>
        <KPICard label="Ordens em Produção" value={fmt.num(kpis.em_producao)}     trend={12.4} sub="ordens abertas"  icon={Package}       color={C.purple} loading={loading}/>
      </div>

      {/* Faturamento + Top Vendedores */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle action={{ label:"Ver detalhes", fn:()=>onNav("vendas") }}>Faturamento (12 meses)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={vend}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.green} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.brl(v),"Faturamento"]}/>
              <Area type="monotone" dataKey="valor" stroke={C.green} fill="url(#gv)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle action={{ label:"Ver detalhes", fn:()=>onNav("vendas") }}>Top Vendedores</SectionTitle>
          {topV.slice(0,5).map((v,i)=>(
            <RankingBar key={i} rank={i+1} label={v.nome_vendedor} value={v.valor_liquido} max={topV[0]?.valor_liquido||1} color={i===0?C.purple:C.green}/>
          ))}
        </Card>
      </div>

      {/* Estoque + Produção + Pedidos de Venda */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle action={{ label:"Ver detalhes", fn:()=>onNav("estoque") }}>Estoque por Filial</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={estF} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:C.text3,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <YAxis type="category" dataKey="nome_filial" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} width={60}/>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.num(v),"Qtd SKUs"]}/>
              <Bar dataKey="qtde" fill={C.blue} radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle action={{ label:"Ver detalhes", fn:()=>onNav("producao") }}>Produção por Status</SectionTitle>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={prodS} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {prodS.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
            {prodS.map((s,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
                <span style={{ color:C.text2, fontSize:12, flex:1 }}>{s.name}</span>
                <span style={{ color:C.text1, fontSize:12, fontFamily:"monospace", fontWeight:600 }}>{fmt.num(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle action={{ label:"Ver detalhes", fn:()=>onNav("pedido_venda") }}>Pedidos de Venda</SectionTitle>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pvS} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {pvS.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
            {pvS.map((s,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
                <span style={{ color:C.text2, fontSize:12, flex:1 }}>{s.name}</span>
                <span style={{ color:C.text1, fontSize:12, fontFamily:"monospace", fontWeight:600 }}>{fmt.num(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: VENDAS — /api/vendas
   Campos: MOVIMENTO + METAF/METAV
═══════════════════════════════════════════════ */
function DashVendas() {
  const { data, loading } = useApiData("/vendas");
  const d = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs: faturamento, ticket_medio, operacoes, meta_pct */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPICard label="Faturamento Total" value={fmt.brlK(d.kpis?.faturamento)}  trend={8.3} sub="vs mês anterior" icon={TrendingUp}  color={C.green}  loading={loading}/>
        <KPICard label="Ticket Médio"      value={fmt.brl(d.kpis?.ticket_medio)}  trend={3.1} sub="por operação"   icon={Award}       color={C.amber}  loading={loading}/>
        <KPICard label="Operações"         value={fmt.num(d.kpis?.operacoes)}     trend={5.4} sub="no período"     icon={BarChart2}   color={C.blue}   loading={loading}/>
        <KPICard label="Meta Atingida"     value={d.kpis?.meta_pct != null ? fmt.pct(d.kpis.meta_pct) : "—"} trend={1.4} sub="meta mensal" icon={CheckCircle} color={C.purple} loading={loading}/>
      </div>

      {/* Faturamento vs Meta + Mix por Grupo */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Faturamento vs Meta (12 meses)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.periodo}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.brl(v)]}/>
              <Legend wrapperStyle={{paddingTop:8,fontSize:12,color:C.text2}}/>
              <Bar dataKey="valor" name="Faturamento" fill={C.green}   radius={[4,4,0,0]}/>
              <Bar dataKey="meta"  name="Meta"        fill={C.border2} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Mix por Grupo</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={d.grupos} cx="50%" cy="50%" outerRadius={80} dataKey="pct" nameKey="descricao_grupo">
                {(d.grupos||[]).map((_,i)=><Cell key={i} fill={[C.amber,C.blue,C.green,C.purple,C.text3][i]}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[`${v}%`]}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:8 }}>
            {(d.grupos||[]).map((g,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:[C.amber,C.blue,C.green,C.purple,C.text3][i], flexShrink:0 }}/>
                <span style={{ color:C.text2, fontSize:12, flex:1 }}>{g.descricao_grupo}</span>
                <span style={{ color:C.text1, fontSize:12, fontWeight:600 }}>{g.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ranking de Vendedores + Faturamento por Filial */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Ranking de Vendedores</SectionTitle>
          {(d.vendedores||[]).map((v,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.text3, fontSize:12, fontFamily:"monospace", width:20, textAlign:"right" }}>{i+1}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:C.text1, fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.nome_vendedor}</div>
                <div style={{ color:C.text3, fontSize:11 }}>{v.operacoes} operações</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:C.text1, fontSize:13, fontFamily:"monospace", fontWeight:600 }}>{fmt.brlK(v.valor_liquido)}</div>
                {v.meta_pct != null
                  ? <Badge type={v.meta_pct>=100?"success":v.meta_pct>=85?"warning":"danger"}>{fmt.pct(v.meta_pct)} meta</Badge>
                  : <Badge type="neutral">sem meta</Badge>
                }
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Faturamento por Filial</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.filiais} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:C.text3,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <YAxis type="category" dataKey="nome_filial" tick={{fill:C.text2,fontSize:12}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.brl(v),"Faturamento"]}/>
              <Bar dataKey="valor_liquido" fill={C.blue} radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: COMPRAS — /api/compras
   Campos: MOVIMENTO_COMPRA + nome_fornecedor, descricao_categoria
═══════════════════════════════════════════════ */
function DashCompras() {
  const { data, loading } = useApiData("/compras");
  const d = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs: total, operacoes, ticket_medio, fornecedores_ativos */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPICard label="Total Compras"       value={fmt.brlK(d.kpis?.total)}               trend={-2.1} sub="vs mês anterior"   icon={ShoppingCart} color={C.blue}   loading={loading}/>
        <KPICard label="Operações"           value={fmt.num(d.kpis?.operacoes)}             trend={1.8}  sub="no período"        icon={BarChart2}    color={C.amber}  loading={loading}/>
        <KPICard label="Ticket Médio"        value={fmt.brl(d.kpis?.ticket_medio)}         trend={-0.9} sub="por operação"      icon={Award}        color={C.green}  loading={loading}/>
        <KPICard label="Fornecedores Ativos" value={fmt.num(d.kpis?.fornecedores_ativos)}  trend={3.2}  sub="ativos no período"  icon={Package}      color={C.purple} loading={loading}/>
      </div>

      {/* Compras por Período + por Categoria */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Compras por Período</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={d.periodo}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.brl(v),"Total"]}/>
              <Area type="monotone" dataKey="valor" stroke={C.blue} fill="url(#gc)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Compras por Categoria</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={d.por_categoria} cx="50%" cy="50%" outerRadius={80} dataKey="valor" nameKey="desc">
                {(d.por_categoria||[]).map((_,i)=><Cell key={i} fill={[C.blue,C.amber,C.green,C.purple][i%4]}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.brl(v)]}/>
            </PieChart>
          </ResponsiveContainer>
          {(d.por_categoria||[]).map((c,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:[C.blue,C.amber,C.green,C.purple][i%4], flexShrink:0 }}/>
              <span style={{ color:C.text2, fontSize:12, flex:1 }}>{c.desc}</span>
              <span style={{ color:C.text1, fontSize:12, fontWeight:600 }}>{fmt.brlK(c.valor)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Top Fornecedores */}
      <Card style={{ position:"relative" }}>
        {loading && <LoadingOverlay/>}
        <SectionTitle>Top Fornecedores</SectionTitle>
        {(d.fornecedores||[]).map((f,i)=>(
          <RankingBar key={i} rank={i+1} label={f.nome_fornecedor} value={f.valor_liquido} max={d.fornecedores?.[0]?.valor_liquido||1} color={C.blue}/>
        ))}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: PRODUÇÃO — /api/producao
   Campos: PRODUCAO.n_ordem, tipo_producao, data_inicio,
           data_previsto, PRODUCAO_ITENS.qtde_*,
           descricao_grupo
═══════════════════════════════════════════════ */
function DashProducao() {
  const { data, loading } = useApiData("/producao");
  const d = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs: ordens_total, em_producao, finalizadas, canceladas */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPICard label="Total de Ordens" value={fmt.num(d.kpis?.ordens_total)} icon={Package}     color={C.blue}   loading={loading}/>
        <KPICard label="Em Produção"     value={fmt.num(d.kpis?.em_producao)}  icon={RefreshCw}   color={C.amber}  trend={12.4} sub="ordens ativas" loading={loading}/>
        <KPICard label="Finalizadas"     value={fmt.num(d.kpis?.finalizadas)}  icon={CheckCircle} color={C.green}  trend={8.1}  sub="no período"   loading={loading}/>
        <KPICard label="Canceladas"      value={fmt.num(d.kpis?.canceladas)}   icon={AlertCircle} color={C.red}    trend={-3.2} sub="vs anterior"  loading={loading}/>
      </div>

      {/* Produção por Período + Status das Ordens */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Produção por Período (qtde)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.periodo}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip {...CHART_TOOLTIP}/>
              <Legend wrapperStyle={{paddingTop:8,fontSize:12,color:C.text2}}/>
              <Bar dataKey="qtde_inicial"    name="Iniciado"   fill={C.blue}  radius={[4,4,0,0]}/>
              <Bar dataKey="qtde_finalizada" name="Finalizado" fill={C.green} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Status das Ordens</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={d.status} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {(d.status||[]).map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
            {(d.status||[]).map((s,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
                <span style={{ color:C.text2, fontSize:13, flex:1 }}>{s.name}</span>
                <span style={{ color:C.text1, fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{fmt.num(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ordens de Produção Recentes */}
      <Card style={{ position:"relative" }}>
        {loading && <LoadingOverlay/>}
        <SectionTitle>Ordens de Produção Recentes</SectionTitle>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                {["Ordem","Grupo","Tipo","Previsto","Iniciado","Em Prod.","Finalizado","Status"].map(h=>(
                  <th key={h} style={{ color:C.text3, fontWeight:600, padding:"8px 12px", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.ordens||[]).map((o,i)=>{
                const s = o.qtde_finalizada===o.qtde_inicial ? "Finalizada" : o.qtde_em_producao>0 ? "Em Produção" : "Pendente";
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ color:C.blue,  padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{o.n_ordem}</td>
                    <td style={{ color:C.text1, padding:"10px 12px" }}>{o.grupo_ordem}</td>
                    <td style={{ color:C.text2, padding:"10px 12px" }}>{o.tipo_producao}</td>
                    <td style={{ color:C.text2, padding:"10px 12px" }}>{o.data_previsto}</td>
                    <td style={{ color:C.text1, padding:"10px 12px", fontFamily:"monospace" }}>{o.qtde_inicial}</td>
                    <td style={{ color:C.amber, padding:"10px 12px", fontFamily:"monospace" }}>{o.qtde_em_producao}</td>
                    <td style={{ color:C.green, padding:"10px 12px", fontFamily:"monospace" }}>{o.qtde_finalizada}</td>
                    <td style={{ padding:"10px 12px" }}><Badge type={s==="Finalizada"?"success":s==="Em Produção"?"warning":"neutral"}>{s}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: ESTOQUE — /api/estoque
   Campos: ESTOQUE.saldo, cod_filial, descricao_grupo,
           descricao1, cod_produto, empenho, fisico
═══════════════════════════════════════════════ */
function DashEstoque() {
  const { data, loading } = useApiData("/estoque");
  const d = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs: skus_total, valor_total, filiais, giro_medio */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPICard label="SKUs Cadastrados" value={fmt.num(d.kpis?.skus_total)}                                      icon={Package}   color={C.blue}   loading={loading}/>
        <KPICard label="Valor Total"      value={d.kpis?.valor_total != null ? fmt.brlK(d.kpis.valor_total) : "—"} icon={TrendingUp} color={C.green}  trend={4.2} sub="em estoque" loading={loading}/>
        <KPICard label="Filiais"          value={d.kpis?.filiais ?? "—"}                                           icon={Warehouse} color={C.amber}  loading={loading}/>
        <KPICard label="Giro Médio"       value={d.kpis?.giro_medio != null ? `${d.kpis.giro_medio}x` : "—"}       icon={RefreshCw} color={C.purple} trend={0.3} sub="ao mês" loading={loading}/>
      </div>

      {/* Estoque por Filial + Distribuição por Grupo */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Estoque por Filial (qtd)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.por_filial}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="nome_filial" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.num(v),"SKUs"]}/>
              <Bar dataKey="qtde" fill={C.blue} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Distribuição por Grupo</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={d.por_grupo} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                {(d.por_grupo||[]).map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.num(v),"SKUs"]}/>
            </PieChart>
          </ResponsiveContainer>
          {(d.por_grupo||[]).map((g,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:g.color, flexShrink:0 }}/>
              <span style={{ color:C.text2, fontSize:12, flex:1 }}>{g.name}</span>
              <span style={{ color:C.text1, fontSize:12, fontFamily:"monospace", fontWeight:600 }}>{fmt.num(g.value)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Produtos com Maior Estoque */}
      <Card style={{ position:"relative" }}>
        {loading && <LoadingOverlay/>}
        <SectionTitle>Produtos com Maior Estoque</SectionTitle>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                {["#","Código","Descrição","Filial","Saldo","Empenho","Físico"].map(h=>(
                  <th key={h} style={{ color:C.text3, fontWeight:600, padding:"8px 12px", textAlign:"left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.top_produtos||[]).map((p,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ color:C.text3, padding:"10px 12px", fontFamily:"monospace" }}>{i+1}</td>
                  <td style={{ color:C.amber, padding:"10px 12px", fontFamily:"monospace" }}>{p.cod_produto}</td>
                  <td style={{ color:C.text1, padding:"10px 12px" }}>{p.descricao1}</td>
                  <td style={{ color:C.text2, padding:"10px 12px" }}>{p.filial || p.nome_filial}</td>
                  <td style={{ color:C.green, padding:"10px 12px", fontFamily:"monospace", fontWeight:700 }}>{fmt.num(p.saldo ?? p.quantidade)}</td>
                  <td style={{ color:C.text2, padding:"10px 12px", fontFamily:"monospace" }}>{p.empenho != null ? fmt.num(p.empenho) : "—"}</td>
                  <td style={{ color:C.text1, padding:"10px 12px", fontFamily:"monospace" }}>{p.fisico != null ? fmt.num(p.fisico) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: PEDIDO VENDA — /api/pedido_venda
   Campos: PEDIDO_VENDA.pedidov, cod_pedidov, cliente,
           nome_vendedor, data_emissao, valor_liquido_pedido,
           aprovado, efetuado, status_workflow_pedido,
           qtde_item_afaturar (via itens)
═══════════════════════════════════════════════ */
function DashPedidoVenda() {
  const { data, loading } = useApiData("/pedido_venda");
  const d = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs: total, aprovados, a_faturar, valor_total */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPICard label="Total de Pedidos" value={fmt.num(d.kpis?.total)}       icon={ClipboardList} color={C.blue}   loading={loading}/>
        <KPICard label="Aprovados"        value={fmt.num(d.kpis?.aprovados)}   icon={CheckCircle}   color={C.green}  trend={4.2} sub="pedidos"    loading={loading}/>
        <KPICard label="A Faturar"        value={fmt.num(d.kpis?.a_faturar)}   icon={Clock}         color={C.amber}                               loading={loading}/>
        <KPICard label="Valor Total"      value={fmt.brlK(d.kpis?.valor_total)} icon={TrendingUp}   color={C.purple} trend={6.8} sub="em carteira" loading={loading}/>
      </div>

      {/* Pedidos e Valor por Mês + Status dos Pedidos */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Pedidos e Valor por Mês</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.periodo}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="left"  tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="right" orientation="right" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <Tooltip {...CHART_TOOLTIP}/>
              <Legend wrapperStyle={{paddingTop:8,fontSize:12,color:C.text2}}/>
              <Line yAxisId="left"  type="monotone" dataKey="total" name="Pedidos" stroke={C.blue}  strokeWidth={2} dot={false}/>
              <Line yAxisId="right" type="monotone" dataKey="valor" name="Valor"   stroke={C.amber} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ position:"relative" }}>
          {loading && <LoadingOverlay/>}
          <SectionTitle>Status dos Pedidos</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={d.por_status} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {(d.por_status||[]).map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP}/>
            </PieChart>
          </ResponsiveContainer>
          {(d.por_status||[]).map((s,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
              <span style={{ color:C.text2, fontSize:13, flex:1 }}>{s.name}</span>
              <span style={{ color:C.text1, fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{fmt.num(s.value)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Pedidos Recentes */}
      <Card style={{ position:"relative" }}>
        {loading && <LoadingOverlay/>}
        <SectionTitle>Pedidos Recentes</SectionTitle>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                {["Pedido","Cliente","Vendedor","Filial","Data","Valor","Status","Efetuado"].map(h=>(
                  <th key={h} style={{ color:C.text3, fontWeight:600, padding:"8px 12px", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.pedidos||[]).map((p,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ color:C.amber, padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{p.cod_pedidov}</td>
                  <td style={{ color:C.text1, padding:"10px 12px", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.cliente}</td>
                  <td style={{ color:C.text2, padding:"10px 12px", whiteSpace:"nowrap" }}>{p.nome_vendedor}</td>
                  <td style={{ color:C.text2, padding:"10px 12px", whiteSpace:"nowrap" }}>{p.fantasia_filial || p.cod_filial || "—"}</td>
                  <td style={{ color:C.text2, padding:"10px 12px" }}>{p.data_emissao}</td>
                  <td style={{ color:C.text1, padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{fmt.brl(p.valor_liquido_pedido)}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <Badge type={p.aprovado?"success":"danger"}>{p.status_workflow_pedido || (p.aprovado?"Aprovado":"Pendente")}</Badge>
                  </td>
                  <td style={{ padding:"10px 12px" }}><Badge type={p.efetuado?"success":"neutral"}>{p.efetuado?"Sim":"Não"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: PEDIDO COMPRA — /api/pedido_compra
   Campos: PEDIDO_COMPRA.pedidoc, cod_pedidoc,
           nome_fornecedor, nome_comprador, data_emissao,
           valor_liquido_pedido, aprovado, efetuado,
           status_workflow_pedido
═══════════════════════════════════════════════ */
function DashPedidoCompra() {
  const { data, loading } = useApiData("/pedido_compra");
  const d = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs: total, aprovados, valor_total, ticket_medio */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KPICard label="Total de Pedidos" value={fmt.num(d.kpis?.total)}        icon={ShoppingBag} color={C.blue}   loading={loading}/>
        <KPICard label="Aprovados"        value={fmt.num(d.kpis?.aprovados)}    icon={CheckCircle} color={C.green}  trend={3.1} sub="pedidos"    loading={loading}/>
        <KPICard label="Valor Total"      value={fmt.brlK(d.kpis?.valor_total)} icon={TrendingUp}  color={C.amber}  trend={5.4} sub="em carteira" loading={loading}/>
        <KPICard label="Ticket Médio"     value={fmt.brl(d.kpis?.ticket_medio)} icon={Award}       color={C.purple}                               loading={loading}/>
      </div>

      {/* Pedidos de Compra por Mês */}
      <Card style={{ position:"relative" }}>
        {loading && <LoadingOverlay/>}
        <SectionTitle>Pedidos de Compra por Mês</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={d.periodo}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="left"  tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="right" orientation="right" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
            <Tooltip {...CHART_TOOLTIP}/>
            <Legend wrapperStyle={{paddingTop:8,fontSize:12,color:C.text2}}/>
            <Bar yAxisId="left"  dataKey="total" name="Pedidos" fill={C.blue}  radius={[4,4,0,0]}/>
            <Bar yAxisId="right" dataKey="valor" name="Valor"   fill={C.amber} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Pedidos de Compra Recentes */}
      <Card style={{ position:"relative" }}>
        {loading && <LoadingOverlay/>}
        <SectionTitle>Pedidos de Compra Recentes</SectionTitle>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                {["Pedido","Fornecedor","Comprador","Filial","Data","Valor","Status","Efetuado"].map(h=>(
                  <th key={h} style={{ color:C.text3, fontWeight:600, padding:"8px 12px", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.pedidos||[]).map((p,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ color:C.amber, padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{p.cod_pedidoc}</td>
                  <td style={{ color:C.text1, padding:"10px 12px", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nome_fornecedor}</td>
                  <td style={{ color:C.text2, padding:"10px 12px", whiteSpace:"nowrap" }}>{p.nome_comprador}</td>
                  <td style={{ color:C.text2, padding:"10px 12px", whiteSpace:"nowrap" }}>{p.fantasia_filial || p.cod_filial || "—"}</td>
                  <td style={{ color:C.text2, padding:"10px 12px" }}>{p.data_emissao}</td>
                  <td style={{ color:C.text1, padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{fmt.brl(p.valor_liquido_pedido)}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <Badge type={p.aprovado?"success":"danger"}>{p.status_workflow_pedido || (p.aprovado?"Aprovado":"Pendente")}</Badge>
                  </td>
                  <td style={{ padding:"10px 12px" }}><Badge type={p.efetuado?"success":"neutral"}>{p.efetuado?"Sim":"Não"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SEARCHABLE SELECT — seletor com busca (cliente / produto)
═══════════════════════════════════════════════ */
function SearchableSelect({ items, value, onChange, getKey, getLabel, getSub, placeholder = "Selecione…", icon: Icon = Search, loading = false }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const selected = items.find(it => getKey(it) === value);
  const filtered = (term.trim()
    ? items.filter(it => `${getLabel(it)} ${getSub ? getSub(it) : ""}`.toLowerCase().includes(term.toLowerCase()))
    : items
  ).slice(0, 100);

  return (
    <div style={{ position:"relative", maxWidth:440 }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:10,
        background:C.bg3, border:`1px solid ${open ? C.amber : C.border2}`,
        borderRadius:10, padding:"12px 14px", cursor:"pointer",
        color:C.text1, fontSize:14, transition:"border-color 0.15s",
      }}>
        <Icon size={16} color={C.amber} style={{flexShrink:0}}/>
        <span style={{ flex:1, textAlign:"left", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: selected ? C.text1 : C.text3 }}>
          {loading ? "Carregando…" : selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronRight size={15} color={C.text3} style={{ transform: open ? "rotate(90deg)" : "rotate(0)", transition:"transform 0.2s" }}/>
      </button>

      {open && (
        <div style={{
          position:"absolute", left:0, right:0, top:"calc(100% + 8px)",
          background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:12,
          padding:10, zIndex:100, boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ position:"relative", marginBottom:8 }}>
            <Search size={14} color={C.text3} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}/>
            <input
              autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="Buscar…"
              style={{ width:"100%", boxSizing:"border-box", background:C.bg3, border:`1px solid ${C.border2}`,
                       borderRadius:8, color:C.text1, padding:"9px 10px 9px 32px", fontSize:13, outline:"none" }}
            />
          </div>
          <div style={{ maxHeight:300, overflowY:"auto" }}>
            {filtered.length === 0 && (
              <div style={{ color:C.text3, fontSize:13, padding:"12px", textAlign:"center" }}>Nenhum resultado</div>
            )}
            {filtered.map(it => {
              const k = getKey(it);
              const isSel = k === value;
              return (
                <button key={k} onClick={() => { onChange(k); setOpen(false); setTerm(""); }} style={{
                  width:"100%", display:"flex", flexDirection:"column", gap:2, textAlign:"left",
                  background: isSel ? `${C.amber}14` : "none", border:"none", borderRadius:8,
                  padding:"9px 12px", cursor:"pointer", marginBottom:2,
                }}
                onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background = C.bg3; }}
                onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background = "none"; }}
                >
                  <span style={{ color: isSel ? C.amber : C.text1, fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getLabel(it)}</span>
                  {getSub && <span style={{ color:C.text3, fontSize:11 }}>{getSub(it)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* Hooks de apoio aos dashboards de Cliente / Produto */
function useEntityList(endpoint) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${CONFIG.API_BASE}${endpoint}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { if (alive) setItems(j.items || []); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [endpoint]);
  return { items, loading };
}

function useEntityAnalysis(endpoint, paramKey, paramValue) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const dateRange             = useDateRange();
  useEffect(() => {
    if (!paramValue) { setData(null); return; }
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams();
    params.append(paramKey, paramValue);
    if (dateRange) { params.append("datai", dateRange.datai); params.append("dataf", dateRange.dataf); }
    fetch(`${CONFIG.API_BASE}${endpoint}?${params.toString()}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { if (alive) setData(j); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [endpoint, paramKey, paramValue, dateRange]);
  return { data, loading };
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  gap:12, padding:"64px 24px", color:C.text3, textAlign:"center" }}>
      <div style={{ width:56, height:56, borderRadius:14, background:C.bg3, border:`1px solid ${C.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon size={26} color={C.text3}/>
      </div>
      <div style={{ color:C.text1, fontSize:15, fontWeight:600 }}>{title}</div>
      {subtitle && <div style={{ fontSize:13, maxWidth:340 }}>{subtitle}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: CLIENTE — /api/clientes + /api/cliente
═══════════════════════════════════════════════ */
function DashCliente() {
  const { items, loading: loadingList } = useEntityList("/clientes");
  const [cliente, setCliente] = useState(null);
  const { data, loading } = useEntityAnalysis("/cliente", "cliente", cliente);
  const d = data || {};

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <Card>
        <SectionTitle>Selecionar Cliente</SectionTitle>
        <SearchableSelect
          items={items} value={cliente} onChange={setCliente} loading={loadingList}
          icon={User} placeholder="Busque e selecione um cliente…"
          getKey={it => it.nome}
          getLabel={it => it.nome}
          getSub={it => `${fmt.num(it.pedidos)} pedidos · ${fmt.brlK(it.valor)}`}
        />
      </Card>

      {!cliente ? (
        <Card><EmptyState icon={Users} title="Nenhum cliente selecionado"
          subtitle="Escolha um cliente acima para ver o histórico de pedidos, faturamento e status."/></Card>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
            <KPICard label="Total de Pedidos" value={fmt.num(d.kpis?.total)}        icon={ClipboardList} color={C.blue}   loading={loading}/>
            <KPICard label="Valor Total"      value={fmt.brlK(d.kpis?.valor_total)} icon={TrendingUp}    color={C.green}  loading={loading}/>
            <KPICard label="Ticket Médio"     value={fmt.brl(d.kpis?.ticket_medio)} icon={Award}         color={C.amber}  loading={loading}/>
            <KPICard label="Último Pedido"    value={d.kpis?.ultimo_pedido || "—"}  icon={Clock}         color={C.purple} loading={loading}/>
          </div>

          {/* Pedidos por mês + status */}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
            <Card style={{ position:"relative" }}>
              {loading && <LoadingOverlay/>}
              <SectionTitle>Pedidos e Valor por Mês</SectionTitle>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={d.periodo}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="left"  tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
                  <Tooltip {...CHART_TOOLTIP}/>
                  <Legend wrapperStyle={{paddingTop:8,fontSize:12,color:C.text2}}/>
                  <Line yAxisId="left"  type="monotone" dataKey="total" name="Pedidos" stroke={C.blue}  strokeWidth={2} dot={false}/>
                  <Line yAxisId="right" type="monotone" dataKey="valor" name="Valor"   stroke={C.amber} strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card style={{ position:"relative" }}>
              {loading && <LoadingOverlay/>}
              <SectionTitle>Status dos Pedidos</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={d.por_status} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {(d.por_status||[]).map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP}/>
                </PieChart>
              </ResponsiveContainer>
              {(d.por_status||[]).map((s,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
                  <span style={{ color:C.text2, fontSize:13, flex:1 }}>{s.name}</span>
                  <span style={{ color:C.text1, fontSize:13, fontFamily:"monospace", fontWeight:700 }}>{fmt.num(s.value)}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Vendedores do cliente */}
          <Card style={{ position:"relative" }}>
            {loading && <LoadingOverlay/>}
            <SectionTitle>Vendedores que Atenderam</SectionTitle>
            {(d.vendedores||[]).length === 0
              ? <div style={{ color:C.text3, fontSize:13, padding:"8px 0" }}>Sem dados no período.</div>
              : (d.vendedores||[]).map((v,i)=>(
                  <RankingBar key={i} rank={i+1} label={v.nome_vendedor} value={v.valor} max={d.vendedores?.[0]?.valor||1} color={i===0?C.purple:C.green}/>
                ))}
          </Card>

          {/* Pedidos recentes */}
          <Card style={{ position:"relative" }}>
            {loading && <LoadingOverlay/>}
            <SectionTitle>Pedidos Recentes</SectionTitle>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                    {["Pedido","Vendedor","Filial","Data","Valor","Status","Efetuado"].map(h=>(
                      <th key={h} style={{ color:C.text3, fontWeight:600, padding:"8px 12px", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(d.pedidos||[]).map((p,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ color:C.amber, padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{p.cod_pedidov}</td>
                      <td style={{ color:C.text2, padding:"10px 12px", whiteSpace:"nowrap" }}>{p.nome_vendedor}</td>
                      <td style={{ color:C.text2, padding:"10px 12px", whiteSpace:"nowrap" }}>{p.nome_filial || "—"}</td>
                      <td style={{ color:C.text2, padding:"10px 12px" }}>{p.data_emissao}</td>
                      <td style={{ color:C.text1, padding:"10px 12px", fontFamily:"monospace", fontWeight:600 }}>{fmt.brl(p.valor_liquido_pedido)}</td>
                      <td style={{ padding:"10px 12px" }}>
                        <Badge type={p.aprovado?"success":"danger"}>{p.status_workflow_pedido || (p.aprovado?"Aprovado":"Pendente")}</Badge>
                      </td>
                      <td style={{ padding:"10px 12px" }}><Badge type={p.efetuado?"success":"neutral"}>{p.efetuado?"Sim":"Não"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD: PRODUTO — /api/produtos + /api/produto
═══════════════════════════════════════════════ */
function DashProduto() {
  const { items, loading: loadingList } = useEntityList("/produtos");
  const [cod, setCod] = useState(null);
  const { data, loading } = useEntityAnalysis("/produto", "cod_produto", cod);
  const d = data || {};
  const temVenda = (d.kpis?.qtde_vendida || 0) > 0 || (d.venda_periodo||[]).length > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <Card>
        <SectionTitle>Selecionar Produto</SectionTitle>
        <SearchableSelect
          items={items} value={cod} onChange={setCod} loading={loadingList}
          icon={Box} placeholder="Busque por código ou descrição…"
          getKey={it => it.cod_produto}
          getLabel={it => it.descricao || it.cod_produto}
          getSub={it => `Cód. ${it.cod_produto}${it.grupo ? " · " + it.grupo : ""}`}
        />
      </Card>

      {!cod ? (
        <Card><EmptyState icon={Package} title="Nenhum produto selecionado"
          subtitle="Escolha um produto acima para ver estoque por filial, distribuição e vendas."/></Card>
      ) : (
        <>
          {/* Cabeçalho do produto */}
          <Card style={{ position:"relative" }}>
            {loading && <LoadingOverlay/>}
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <span style={{ color:C.text1, fontSize:18, fontWeight:700 }}>{d.info?.descricao || cod}</span>
              <span style={{ color:C.text3, fontSize:13 }}>
                Cód. <span style={{ fontFamily:"monospace", color:C.amber }}>{d.cod_produto || cod}</span>
                {d.info?.grupo && d.info.grupo !== "—" ? ` · Grupo: ${d.info.grupo}` : ""}
                {d.info?.categoria && d.info.categoria !== "—" ? ` · Categoria: ${d.info.categoria}` : ""}
              </span>
            </div>
          </Card>

          {/* KPIs de estoque */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
            <KPICard label="Saldo em Estoque"   value={fmt.num(d.kpis?.saldo)}   icon={Warehouse}     color={C.blue}   loading={loading}/>
            <KPICard label="Empenhado"          value={fmt.num(d.kpis?.empenho)} icon={ClipboardList} color={C.amber}  loading={loading}/>
            <KPICard label="Físico"             value={fmt.num(d.kpis?.fisico)}  icon={Box}           color={C.green}  loading={loading}/>
            <KPICard label="Filiais c/ Estoque" value={fmt.num(d.kpis?.filiais)} icon={Home}          color={C.purple} loading={loading}/>
          </div>

          {/* KPIs de venda (se houver dados de venda do produto) */}
          {temVenda && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
              <KPICard label="Qtd. Vendida"  value={fmt.num(d.kpis?.qtde_vendida)}   icon={ShoppingCart} color={C.green} loading={loading}/>
              <KPICard label="Valor Vendido" value={fmt.brlK(d.kpis?.valor_vendido)} icon={TrendingUp}   color={C.amber} loading={loading}/>
              <KPICard label="Operações"     value={fmt.num(d.kpis?.operacoes)}      icon={BarChart2}    color={C.blue}  loading={loading}/>
            </div>
          )}

          {/* Estoque por filial + vendas por mês */}
          <div style={{ display:"grid", gridTemplateColumns: temVenda ? "1fr 1fr" : "1fr", gap:16 }}>
            <Card style={{ position:"relative" }}>
              {loading && <LoadingOverlay/>}
              <SectionTitle>Estoque por Filial</SectionTitle>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={d.por_filial} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                  <XAxis type="number" tick={{fill:C.text3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="nome_filial" tick={{fill:C.text2,fontSize:12}} axisLine={false} tickLine={false} width={80}/>
                  <Tooltip {...CHART_TOOLTIP} formatter={v=>[fmt.num(v),"Saldo"]}/>
                  <Bar dataKey="saldo" fill={C.blue} radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {temVenda && (
              <Card style={{ position:"relative" }}>
                {loading && <LoadingOverlay/>}
                <SectionTitle>Vendas por Mês</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={d.venda_periodo}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="mes" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="left"  tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="right" orientation="right" tick={{fill:C.text3,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
                    <Tooltip {...CHART_TOOLTIP}/>
                    <Legend wrapperStyle={{paddingTop:8,fontSize:12,color:C.text2}}/>
                    <Bar yAxisId="left"  dataKey="qtde"  name="Qtd"   fill={C.green} radius={[4,4,0,0]}/>
                    <Bar yAxisId="right" dataKey="valor" name="Valor" fill={C.amber} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          {/* Detalhe de estoque por filial */}
          <Card style={{ position:"relative" }}>
            {loading && <LoadingOverlay/>}
            <SectionTitle>Detalhe de Estoque por Filial</SectionTitle>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                    {["Filial","Saldo","Empenho","Físico"].map(h=>(
                      <th key={h} style={{ color:C.text3, fontWeight:600, padding:"8px 12px", textAlign:"left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(d.por_filial||[]).map((r,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ color:C.text1, padding:"10px 12px" }}>{r.nome_filial}</td>
                      <td style={{ color:C.green, padding:"10px 12px", fontFamily:"monospace", fontWeight:700 }}>{fmt.num(r.saldo)}</td>
                      <td style={{ color:C.text2, padding:"10px 12px", fontFamily:"monospace" }}>{fmt.num(r.empenho)}</td>
                      <td style={{ color:C.text1, padding:"10px 12px", fontFamily:"monospace" }}>{fmt.num(r.fisico)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   APP PRINCIPAL
═══════════════════════════════════════════════ */
const SCREEN_TITLES = {
  home:          "Visão Geral",
  vendas:        "Dashboard de Vendas",
  compras:       "Dashboard de Compras",
  producao:      "Dashboard de Produção",
  estoque:       "Dashboard de Estoque",
  cliente:       "Análise por Cliente",
  produto:       "Análise por Produto",
  pedido_venda:  "Pedidos de Venda",
  pedido_compra: "Pedidos de Compra",
};

export default function App() {
  const [session,   setSession]   = useState({ nome: "", filial: "", perfil: "", token: null });
  const [screen,    setScreen]    = useState("home");
  const [collapsed, setCollapsed] = useState(false);

  // Lê usuário gravado pelo index.html ao abrir o BI
  useEffect(() => {
    const raw = sessionStorage.getItem("omnia_bi_user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setSession({ nome: u.nome || "", filial: u.filial || "", perfil: u.perfil || "", token: u.token || "ok" });
      } catch (_) {}
    }
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const [dateRange, setDateRange] = useState({ datai: "2020-01-01", dataf: today });
  const [filial, setFilial] = useState("todas");
  const [vendedor, setVendedor] = useState("todos");

  const handleLogout = () => {
    sessionStorage.removeItem("omnia_bi_user");
    sessionStorage.removeItem("nornes_session");
    // Volta para a tela de módulos do index.html
    window.location.href = "/";
  };

  const Content = {
    home:          DashHome,
    vendas:        DashVendas,
    compras:       DashCompras,
    producao:      DashProducao,
    estoque:       DashEstoque,
    cliente:       DashCliente,
    produto:       DashProduto,
    pedido_venda:  DashPedidoVenda,
    pedido_compra: DashPedidoCompra,
  }[screen];

  return (
    <>
    <DateRangeCtx.Provider value={{ ...dateRange, setDateRange }}>
    <FiltersCtx.Provider value={{ filial, setFilial, vendedor, setVendedor }}>
    <div style={{ display:"flex", minHeight:"100vh", background:C.bg0, fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <Sidebar active={screen} onNav={setScreen} collapsed={collapsed} user={session}/>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>
        <Header title={SCREEN_TITLES[screen]} onToggleSidebar={()=>setCollapsed(c=>!c)} onLogout={handleLogout}/>
        <main style={{ flex:1, overflowY:"auto", padding:24 }}>
          {screen === "home"
            ? <DashHome onNav={setScreen}/>
            : <Content/>
          }
        </main>
      </div>
    </div>
    </FiltersCtx.Provider>
    </DateRangeCtx.Provider>
    <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}