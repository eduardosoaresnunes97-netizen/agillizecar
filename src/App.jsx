import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ====== 1. CONFIGURAÇÃO (FORA DO COMPONENTE) ======
const firebaseConfig = {
  apiKey: "AIzaSyCWGF6yl-zNZquFQBb4Ax0i4PB8j0bCBRE",
  authDomain: "supervisao-carros.firebaseapp.com",
  projectId: "supervisao-carros",
  storageBucket: "supervisao-carros.firebasestorage.app",
  messagingSenderId: "1047325925193",
  appId: "1:1047325925193:web:48e1bb7d04c9303f410498"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SETORES = ["Entrada", "Pátio", "Oficina", "Funilaria", "Acessórios", "Lavagem", "Showroom", "Vendido"];
const DARK = {
  bg: "#0b1220", card: "#0f1a33", border: "#1b2a4d", text: "#eef3ff",
  mut: "#9fb3ff", blue: "#164c89", blueH: "#1d63b4", danger: "#d33", ok: "#10b981"
};

// ====== 2. COMPONENTES DE UI ESTÁTICOS (NUNCA MUDAM DE REFERÊNCIA) ======
// Isso impede que o foco seja perdido ao digitar
const Card = ({ title, children, style }) => (
  <div style={{
    background: DARK.card, border: `1px solid ${DARK.border}`,
    borderRadius: 16, padding: 16, width: "100%", boxSizing: "border-box", marginBottom: 15, ...style
  }}>
    {title && <h3 style={{ margin: "0 0 12px 0", color: DARK.mut }}>{title}</h3>}
    {children}
  </div>
);

const BigButton = ({ children, onClick, color = DARK.blue, style }) => (
  <button
    onClick={onClick}
    style={{
      background: color, color: "white", border: 0, borderRadius: 12,
      padding: "16px", fontWeight: 600, cursor: "pointer", width: "100%", ...style
    }}
  >
    {children}
  </button>
);

const StyledInput = (props) => (
  <input
    {...props}
    style={{
      padding: 14, borderRadius: 10, border: `1px solid ${DARK.border}`,
      background: "#0b1730", color: DARK.text, width: "100%", boxSizing: "border-box",
      marginBottom: 12, fontSize: "16px", ...props.style
    }}
  />
);

const Container = ({ children }) => (
  <div style={{ 
    background: DARK.bg, color: DARK.text, minHeight: "100vh", 
    width: "100%", padding: "20px", boxSizing: "border-box", overflowX: "hidden" 
  }}>
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {children}
    </div>
  </div>
);

// ====== 3. COMPONENTE PRINCIPAL ======
export default function App() {
  const [view, setView] = useState("login");
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Estados de Cadastro
  const [chassi, setChassi] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [qrPreview, setQrPreview] = useState(null);

  // Estados Scanner
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [scanText, setScanText] = useState("");
  const [scanParsed, setScanParsed] = useState(null);
  const [setorEscolhido, setSetorEscolhido] = useState(SETORES[0]);

  // Estados Histórico / Notificações / Usuários
  const [filtro, setFiltro] = useState("");
  const [historicoView, setHistoricoView] = useState([]);
  const [movsRecentes, setMovsRecentes] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");

  // Limpeza de scanner ao trocar de tela
  useEffect(() => {
    return () => { if (scannerRef.current) scannerRef.current.reset(); };
  }, [view]);

  // Funções de Ação
  const handleLogin = async (e) => {
    if(e) e.preventDefault();
    const snap = await getDoc(doc(db, "users", userInput.trim()));
    if (snap.exists() && snap.data().senha === password) {
      setCurrentUser({ nome: snap.data().nome, admin: !!snap.data().admin });
      setView("home");
    } else { alert("Usuário ou senha incorretos."); }
  };

  const handleCadastrar = async () => {
    const id = (chassi || "").toString().trim().toUpperCase();
    if (!id || !modelo) return alert("Chassi e Modelo são obrigatórios");
    try {
      const payload = { chassi: id, modelo, ano, cor, status: "Entrada", updatedAt: serverTimestamp() };
      await setDoc(doc(db, "vehicles", id), payload);
      await addDoc(collection(db, "movements"), { chassi: id, tipo: "Entrada", user: currentUser.nome, createdAt: serverTimestamp() });
      alert("Veículo cadastrado!");
      setChassi(""); setModelo(""); setAno(""); setCor("");
    } catch (err) { alert("Erro ao salvar."); }
  };

  const loadHistorico = async () => {
    const snap = await getDocs(query(collection(db, "vehicles"), orderBy("chassi")));
    const list = snap.docs.map(d => d.data());
    setHistoricoView(list.filter(v => v.status !== "Vendido"));
  };

  const loadMovsRecentes = async () => {
    const snap = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc"), limit(30)));
    setMovsRecentes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // ====== RENDERIZAÇÃO DE TELAS ======

  if (view === "login") return (
    <Container>
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>AgilizzeCar</h1>
        <Card title="Acesso ao Sistema">
          <form onSubmit={handleLogin}>
            <StyledInput placeholder="Usuário" value={userInput} onChange={e => setUserInput(e.target.value)} />
            <StyledInput type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
            <BigButton onClick={handleLogin}>ENTRAR</BigButton>
          </form>
        </Card>
      </div>
    </Container>
  );

  if (view === "home") return (
    <Container>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2>Painel</h2>
        <span style={{ color: DARK.mut }}>Admin: <b>{currentUser?.nome}</b></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <BigButton onClick={() => setView("scan")}>LER QR</BigButton>
        <BigButton onClick={() => setView("cadastrar")}>CADASTRAR</BigButton>
        <BigButton onClick={() => { setView("historico"); loadHistorico(); }}>HISTÓRICO</BigButton>
        <BigButton onClick={() => { setView("notificacoes"); loadMovsRecentes(); }}>AVISOS</BigButton>
      </div>
      <BigButton color="#444" onClick={() => setView("login")} style={{ marginTop: 30 }}>SAIR</BigButton>
    </Container
