import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ====== Firebase ======
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

// ====== Constantes ======
const SETORES = ["Entrada", "Pátio", "Oficina", "Funilaria", "Acessórios", "Lavagem", "Showroom", "Vendido"];
const DARK = {
  bg: "#0b1220", card: "#0f1a33", border: "#1b2a4d", text: "#eef3ff",
  mut: "#9fb3ff", blue: "#164c89", blueH: "#1d63b4", danger: "#d33", ok: "#10b981"
};

// ====== COMPONENTES DE UI (FORA DO APP PARA EVITAR ERRO DE FOCO) ======
const Card = ({ title, children, style }) => (
  <div style={{
    background: DARK.card, border: `1px solid ${DARK.border}`,
    borderRadius: 16, padding: 16, width: "100%", boxSizing: "border-box", ...style
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
      padding: "14px", fontWeight: 600, cursor: "pointer", width: "100%", ...style
    }}
  >
    {children}
  </button>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`,
      background: "#0b1730", color: DARK.text, width: "100%", boxSizing: "border-box",
      marginBottom: 10, ...props.style
    }}
  />
);

// ====== Helpers ======
const isHttps = () => (typeof window !== "undefined" && window.isSecureContext);
const upper = (s) => (s || "").toString().trim().toUpperCase();

async function makeQRCodeDataURL(text) {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(text, { width: 320, margin: 2 });
  } catch (e) { return null; }
}

// ====== App Principal ======
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

  // Estados Histórico / Notificações
  const [filtro, setFiltro] = useState("");
  const [historicoView, setHistoricoView] = useState([]);
  const [movsRecentes, setMovsRecentes] = useState([]);

  // Estados Usuários
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Handlers
  const handleLogin = async (e) => {
    e?.preventDefault();
    const snap = await getDoc(doc(db, "users", userInput.trim()));
    if (snap.exists() && snap.data().senha === password) {
      setCurrentUser({ nome: snap.data().nome, admin: !!snap.data().admin });
      setView("home");
    } else { alert("Dados inválidos"); }
  };

  const handleCadastrar = async () => {
    const id = upper(chassi);
    if (!id || !modelo) return alert("Preencha os campos");
    const payload = { chassi: id, modelo, ano, cor, status: "Entrada", updatedAt: serverTimestamp() };
    await setDoc(doc(db, "vehicles", id), payload);
    await addDoc(collection(db, "movements"), { chassi: id, tipo: "Entrada", user: currentUser.nome, createdAt: serverTimestamp() });
    const url = await makeQRCodeDataURL(JSON.stringify(payload));
    setQrPreview(url);
    alert("Cadastrado com sucesso!");
  };

  const startScanner = async () => {
    const reader = new BrowserMultiFormatReader();
    scannerRef.current = reader;
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    await reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (result) => {
      if (result) {
        const text = result.text;
        setScanText(text);
        try { setScanParsed(JSON.parse(text)); } catch { setScanParsed(null); }
      }
    });
  };

  const confirmarMovimentacao = async () => {
    const id = upper(scanParsed?.chassi || scanText);
    if (!id) return alert("Nenhum chassi");
    await updateDoc(doc(db, "vehicles", id), { status: setorEscolhido, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "movements"), { chassi: id, tipo: setorEscolhido, user: currentUser.nome, createdAt: serverTimestamp() });
    alert("Movimentação registrada!");
    setView("home");
  };

  const loadHistorico = async () => {
    const snap = await getDocs(query(collection(db, "vehicles"), orderBy("chassi")));
    const list = [];
    snap.forEach(d => list.push(d.data()));
    setHistoricoView(list.filter(v => v.status !== "Vendido" && (filtro ? upper(v.chassi).includes(upper(filtro)) : true)));
  };

  const loadMovsRecentes = async () => {
    const snap = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc"), limit(30)));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setMovsRecentes(list);
  };

  // ====== TELAS ======
  const Container = ({ children }) => (
    <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", width: "100%", padding: 20, boxSizing: "border-box" }}>
      {children}
    </div>
  );

  if (view === "login") return (
    <Container>
      <div style={{ maxWidth: 400, margin: "100px auto" }}>
        <h1 style={{ textAlign: "center" }}>AgilizzeCar</h1>
        <Card title="Login">
          <Input placeholder="Usuário" value={userInput} onChange={e => setUserInput(e.target.value)} />
          <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
          <BigButton onClick={handleLogin}>Entrar</BigButton>
        </Card>
      </div>
    </Container>
  );

  if (view === "home") return (
    <Container>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2>Menu Principal</h2>
        <span style={{ color: DARK.mut }}>Olá, {currentUser?.nome}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
        <BigButton onClick={() => setView("scan")}>Ler QR</BigButton>
        <BigButton onClick={() => setView("cadastrar")}>Cadastrar</BigButton>
        <BigButton onClick={() => { setView("historico"); loadHistorico(); }}>Histórico</BigButton>
        <BigButton onClick={() => { setView("notificacoes"); loadMovsRecentes(); }}>Notificações</BigButton>
        {currentUser?.admin && <BigButton onClick={() => setView("usuarios")}>Usuários</BigButton>}
      </div>
      <BigButton color="#444" onClick={() => setView("login")} style={{ marginTop: 20 }}>Sair</BigButton>
    </Container>
  );

  if (view === "scan") return (
    <Container>
      <h2>Leitura de QR Code</h2>
      <Card title="Câmera">
        <video ref={videoRef} style={{ width: "100%", borderRadius: 10, background: "#000", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <BigButton onClick={startScanner}>Ligar Câmera</BigButton>
          <BigButton color="#555" onClick={() => { scannerRef.current?.reset(); setView("home"); }}>Voltar</BigButton>
        </div>
      </Card>
      <Card title="Dados da Leitura" style={{ marginTop: 20 }}>
        <p><b>Chassi:</b> {scanParsed?.chassi || scanText || "Aguardando..."}</p>
        <select value={setorEscolhido} onChange={e => setSetorEscolhido(e.target.value)} 
                style={{ width: "100%", padding: 12, borderRadius: 10, background: "#0b1730", color: "#fff", marginBottom: 10 }}>
          {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <BigButton onClick={confirmarMovimentacao} color={DARK.ok}>Confirmar Movimentação</BigButton>
      </Card>
    </Container>
  );

  if (view === "historico") return (
    <Container>
      <h2>Histórico de Veículos</h2>
      <Input placeholder="Filtrar por chassi..." value={filtro} onChange={e => setFiltro(e.target.value)} />
      <BigButton onClick={loadHistorico} style={{ marginBottom: 20 }}>Buscar</BigButton>
      <div style={{ display: "grid", gap: 10 }}>
        {historicoView.map(v => (
          <Card key={v.chassi}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{v.modelo} ({v.cor})</b>
              <span style={{ background: DARK.blue, padding: "2px 8px", borderRadius: 5, fontSize: 12 }}>{v.status}</span>
            </div>
            <div style={{ fontSize: 13, color: DARK.mut }}>Chassi: {v.chassi}</div>
          </Card>
        ))}
      </div>
      <BigButton color="#555" onClick={() => setView("home")} style={{ marginTop: 20 }}>Voltar</BigButton>
    </Container>
  );

  if (view === "notificacoes") return (
    <Container>
      <h2>Notificações</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {movsRecentes.map(m => (
          <Card key={m.id}>
            <div><b>{m.chassi}</b> movido para <b>{m.tipo}</b></div>
            <div style={{ fontSize: 12, color: DARK.mut }}>Por: {m.user} em {m.createdAt?.toDate().toLocaleString()}</div>
          </Card>
        ))}
      </div>
      <BigButton color="#555" onClick={() => setView("home")} style={{ marginTop: 20 }}>Voltar</BigButton>
    </Container>
  );

  return <Container><h2>Tela em construção</h2><BigButton onClick={() => setView("home")}>Voltar</BigButton></Container>;
}
