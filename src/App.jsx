import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ====== 1. CONFIGURAÇÃO E CONSTANTES (FORA DO APP) ======
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
  mut: "#9fb3ff", blue: "#164c89", blueH: "#1d63b4", ok: "#10b981"
};

// ====== 2. COMPONENTES DE UI ESTÁTICOS (RESOLVE O PROBLEMA DO FOCO) ======
const Container = ({ children }) => (
  <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", width: "100%", padding: "20px", boxSizing: "border-box" }}>
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>{children}</div>
  </div>
);

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
      padding: "16px", fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: 10, ...style
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
      marginBottom: 12, fontSize: "16px", outline: "none", ...props.style
    }}
  />
);

// ====== 3. COMPONENTE PRINCIPAL ======
export default function App() {
  const [view, setView] = useState("login");
  
  // Estados de Dados
  const [loginForm, setLoginForm] = useState({ user: "", pass: "" });
  const [carForm, setCarForm] = useState({ chassi: "", modelo: "", ano: "", cor: "" });
  const [currentUser, setCurrentUser] = useState(null);
  
  // Estados de Listas e Scanner
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [novoSetor, setNovoSetor] = useState(SETORES[0]);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  // --- Handlers de Input (Estáveis) ---
  const onLoginChange = (e) => setLoginForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const onCarChange = (e) => setCarForm(prev => ({ ...prev, [e.target.name]: e.target.name === "chassi" ? e.target.value.toUpperCase() : e.target.value }));

  // --- Ações do Firebase ---
  const handleLogin = async (e) => {
    e?.preventDefault();
    const snap = await getDoc(doc(db, "users", loginForm.user.trim()));
    if (snap.exists() && snap.data().senha === loginForm.pass) {
      setCurrentUser({ nome: snap.data().nome, admin: snap.data().admin });
      setView("home");
    } else { alert("Usuário ou senha incorretos."); }
  };

  const salvarVeiculo = async () => {
    if (!carForm.chassi || !carForm.modelo) return alert("Preencha Chassi e Modelo");
    const id = carForm.chassi.trim().toUpperCase();
    await setDoc(doc(doc(db, "vehicles", id)), { ...carForm, status: "Entrada", updatedAt: serverTimestamp() });
    await addDoc(collection(db, "movements"), { chassi: id, tipo: "Entrada", user: currentUser.nome, createdAt: serverTimestamp() });
    alert("Veículo cadastrado!");
    setCarForm({ chassi: "", modelo: "", ano: "", cor: "" });
  };

  const carregarHistorico = async () => {
    const q = query(collection(db, "vehicles"), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    setLista(snap.docs.map(d => d.data()));
    setView("historico");
  };

  const carregarNotificacoes = async () => {
    const q = query(collection(db, "movements"), orderBy("createdAt", "desc"), limit(20));
    const snap = await getDocs(q);
    setLista(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setView("notificacoes");
  };

  // --- Lógica do Scanner ---
  const ligarCamera = async () => {
    const reader = new BrowserMultiFormatReader();
    scannerRef.current = reader;
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (res) => {
      if (res) setScanResult(res.text);
    });
  };

  const atualizarStatus = async () => {
    if (!scanResult) return alert("Leia um QR Code primeiro");
    await updateDoc(doc(db, "vehicles", scanResult), { status: novoSetor, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "movements"), { chassi: scanResult, tipo: novoSetor, user: currentUser.nome, createdAt: serverTimestamp() });
    alert("Status atualizado!");
    setView("home");
  };

  // ====== RENDERIZAÇÃO DAS TELAS ======

  return (
    <Container>
      {/* TELA DE LOGIN */}
      {view === "login" && (
        <div key="login-screen" style={{ marginTop: "50px" }}>
          <h1 style={{ textAlign: "center" }}>AgilizzeCar</h1>
          <Card title="Acesso">
            <StyledInput name="user" placeholder="Usuário" value={loginForm.user} onChange={onLoginChange} />
            <StyledInput name="pass" type="password" placeholder="Senha" value={loginForm.pass} onChange={onLoginChange} />
            <BigButton onClick={handleLogin}>ENTRAR</BigButton>
          </Card>
        </div>
      )}

      {/* TELA HOME */}
      {view === "home" && (
        <div key="home-screen">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <h2>Menu</h2>
            <span style={{ color: DARK.mut }}>{currentUser?.nome}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <BigButton onClick={() => setView("scan")}>LER QR</BigButton>
            <BigButton onClick={() => setView("cadastrar")}>CADASTRAR</BigButton>
            <BigButton onClick={carregarHistorico}>HISTÓRICO</BigButton>
            <BigButton onClick={carregarNotificacoes}>NOTIFICAÇÕES</BigButton>
          </div>
          <BigButton color="#444" onClick={() => setView("login")} style={{ marginTop: 20 }}>SAIR</BigButton>
        </div>
      )}

      {/* TELA CADASTRAR */}
      {view === "cadastrar" && (
        <div key="cad-screen">
          <h2>Novo Veículo</h2>
          <Card>
            <StyledInput name="chassi" placeholder="Chassi" value={carForm.chassi} onChange={onCarChange} />
            <StyledInput name="modelo" placeholder="Modelo" value={carForm.modelo} onChange={onCarChange} />
            <StyledInput name="ano" placeholder="Ano" value={carForm.ano} onChange={onCarChange} />
            <StyledInput name="cor" placeholder="Cor" value={carForm.cor} onChange={onCarChange} />
            <BigButton color={DARK.ok} onClick={salvarVeiculo}>SALVAR NO SISTEMA</BigButton>
            <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
          </Card>
        </div>
      )}

      {/* TELA SCANNER */}
      {view === "scan" && (
        <div key="scan-screen">
          <h2>Scanner QR</h2>
          <Card>
            <video ref={videoRef} style={{ width: "100%", borderRadius: 12, background: "#000", marginBottom: 15 }} />
            {!scanResult && <BigButton onClick={ligarCamera}>LIGAR CÂMERA</BigButton>}
            
            {scanResult && (
              <>
                <p>Veículo: <b>{scanResult}</b></p>
                <select 
                  value={novoSetor} 
                  onChange={(e) => setNovoSetor(e.target.value)}
                  style={{ width: "100%", padding: 14, borderRadius: 10, background: "#0b1730", color: "#fff", marginBottom: 15 }}
                >
                  {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <BigButton color={DARK.ok} onClick={atualizarStatus}>CONFIRMAR MUDANÇA</BigButton>
              </>
            )}
            <BigButton color="#555" onClick={() => { scannerRef.current?.reset(); setView("home"); }}>VOLTAR</BigButton>
          </Card>
        </div>
      )}

      {/* TELA HISTÓRICO */}
      {view === "historico" && (
        <div key="hist-screen">
          <h2>Estoque Atual</h2>
          <StyledInput placeholder="Filtrar chassi..." value={filtro} onChange={(e) => setFiltro(e.target.value.toUpperCase())} />
          {lista.filter(v => v.chassi.includes(filtro)).map((v, i) => (
            <Card key={i} style={{ borderLeft: `4px solid ${DARK.blue}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{v.modelo}</b>
                <span style={{ color: DARK.ok, fontSize: "14px" }}>{v.status}</span>
              </div>
              <div style={{ fontSize: "12px", color: DARK.mut }}>ID: {v.chassi}</div>
            </Card>
          ))}
          <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
        </div>
      )}

      {/* TELA NOTIFICAÇÕES */}
      {view === "notificacoes" && (
        <div key="notif-screen">
          <h2>Últimas Atividades</h2>
          {lista.map((m) => (
            <Card key={m.id}>
              <div style={{ fontSize: "14px" }}>🚗 <b>{m.chassi}</b> → <b style={{ color: DARK.mut }}>{m.tipo}</b></div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: 5 }}>
                Por: {m.user} | {m.createdAt?.toDate().toLocaleString()}
              </div>
            </Card>
          ))}
          <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
        </div>
      )}
    </Container>
  );
}
