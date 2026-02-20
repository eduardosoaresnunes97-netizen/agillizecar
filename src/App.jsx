import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  addDoc, serverTimestamp, query, orderBy, limit, getDocs, deleteDoc
} from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// ====== 1. CONFIGURAÇÃO FIREBASE ======
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
const DARK = { bg: "#0b1220", card: "#0f1a33", border: "#1b2a4d", text: "#eef3ff", blue: "#164c89", ok: "#10b981", danger: "#e53935" };

// ====== 2. COMPONENTES ESTÁTICOS (RESOLVE O FOCO) ======
const Container = ({ children }) => (
  <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", width: "100%", padding: "20px", boxSizing: "border-box" }}>
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>{children}</div>
  </div>
);

const Card = ({ title, children }) => (
  <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 16, padding: 16, width: "100%", boxSizing: "border-box", marginBottom: 15 }}>
    {title && <h3 style={{ margin: "0 0 12px 0", color: "#9fb3ff" }}>{title}</h3>}
    {children}
  </div>
);

const BigButton = ({ children, onClick, color = DARK.blue, style }) => (
  <button onClick={onClick} style={{ background: color, color: "white", border: 0, borderRadius: 12, padding: "16px", fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: 10, ...style }}>
    {children}
  </button>
);

const StyledInput = (props) => (
  <input {...props} style={{ padding: 14, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text, width: "100%", boxSizing: "border-box", marginBottom: 12, fontSize: "16px", outline: "none", ...props.style }} />
);

// ====== 3. COMPONENTE PRINCIPAL ======
export default function App() {
  const [view, setView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  
  // Estados de Formulários
  const [loginForm, setLoginForm] = useState({ user: "", pass: "" });
  const [carForm, setCarForm] = useState({ chassi: "", modelo: "", ano: "", cor: "" });
  const [userForm, setUserForm] = useState({ nome: "", login: "", senha: "", admin: false });
  
  // Estados de Listas
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [novoSetor, setNovoSetor] = useState(SETORES[0]);
  
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  // --- Funções de PDF ---
  const gerarPDF = async (veiculo) => {
    const doc = new jsPDF({ unit: "mm", format: [80, 80] });
    const qrData = await QRCode.toDataURL(veiculo.chassi);
    doc.setFontSize(10);
    doc.text("AGILLIZECAR", 40, 10, { align: "center" });
    doc.addImage(qrData, "PNG", 15, 15, 50, 50);
    doc.text(`CHASSI: ${veiculo.chassi}`, 40, 70, { align: "center" });
    doc.save(`Etiqueta_${veiculo.chassi}.pdf`);
  };

  // --- Handlers Firebase ---
  const handleLogin = async (e) => {
    e?.preventDefault();
    const snap = await getDoc(doc(db, "users", loginForm.user.trim()));
    if (snap.exists() && snap.data().senha === loginForm.pass) {
      setCurrentUser({ nome: snap.data().nome, admin: snap.data().admin, login: loginForm.user });
      setView("home");
    } else { alert("Login inválido"); }
  };

  const salvarVeiculo = async () => {
    const id = carForm.chassi.trim().toUpperCase();
    if (!id || !carForm.modelo) return alert("Preencha os campos!");
    const dados = { ...carForm, chassi: id, status: "Entrada", updatedAt: serverTimestamp() };
    await setDoc(doc(db, "vehicles", id), dados);
    await addDoc(collection(db, "movements"), { chassi: id, tipo: "Entrada", user: currentUser.nome, createdAt: serverTimestamp() });
    if(window.confirm("Salvo! Baixar QR Code?")) gerarPDF(dados);
    setCarForm({ chassi: "", modelo: "", ano: "", cor: "" });
  };

  const salvarNovoUsuario = async () => {
    if (!userForm.login || !userForm.senha) return alert("Preencha tudo");
    await setDoc(doc(db, "users", userForm.login), { nome: userForm.nome, senha: userForm.senha, admin: userForm.admin });
    alert("Usuário criado!");
    setUserForm({ nome: "", login: "", senha: "", admin: false });
    carregarUsuarios();
  };

  const carregarUsuarios = async () => {
    const snap = await getDocs(collection(db, "users"));
    setLista(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setView("usuarios");
  };

  return (
    <Container>
      {view === "login" && (
        <div key="login" style={{ marginTop: "50px" }}>
          <h1 style={{ textAlign: "center" }}>AgilizzeCar</h1>
          <Card title="Login">
            <StyledInput placeholder="Usuário" value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
            <StyledInput type="password" placeholder="Senha" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
            <BigButton onClick={handleLogin}>ENTRAR</BigButton>
          </Card>
        </div>
      )}

      {view === "home" && (
        <div key="home">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <h2>Menu</h2>
            <span style={{ color: "#9fb3ff" }}>{currentUser?.admin ? "Adm: " : "Op: "}{currentUser?.nome}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <BigButton onClick={() => setView("scan")}>LER QR</BigButton>
            <BigButton onClick={() => setView("cadastrar")}>CADASTRAR</BigButton>
            <BigButton onClick={async () => {
              const snap = await getDocs(query(collection(db, "vehicles"), orderBy("updatedAt", "desc")));
              setLista(snap.docs.map(d => d.data()));
              setView("historico");
            }}>HISTÓRICO</BigButton>
            <BigButton onClick={async () => {
              const snap = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc"), limit(20)));
              setLista(snap.docs.map(d => ({ id: d.id, ...d.data() })));
              setView("notificacoes");
            }}>AVISOS</BigButton>
            {currentUser?.admin && <BigButton color="#ff9800" onClick={carregarUsuarios}>USUÁRIOS</BigButton>}
          </div>
          <BigButton color="#444" onClick={() => setView("login")} style={{ marginTop: 20 }}>SAIR</BigButton>
        </div>
      )}

      {view === "cadastrar" && (
        <div key="cad">
          <h2>Novo Veículo</h2>
          <Card>
            <StyledInput placeholder="Chassi" value={carForm.chassi} onChange={e => setCarForm({...carForm, chassi: e.target.value})} />
            <StyledInput placeholder="Modelo" value={carForm.modelo} onChange={e => setCarForm({...carForm, modelo: e.target.value})} />
            <StyledInput placeholder="Ano" value={carForm.ano} onChange={e => setCarForm({...carForm, ano: e.target.value})} />
            <StyledInput placeholder="Cor" value={carForm.cor} onChange={e => setCarForm({...carForm, cor: e.target.value})} />
            <BigButton color={DARK.ok} onClick={salvarVeiculo}>SALVAR E GERAR QR</BigButton>
            <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
          </Card>
        </div>
      )}

      {view === "usuarios" && (
        <div key="users">
          <h2>Gestão de Usuários</h2>
          <Card title="Novo Funcionário">
            <StyledInput placeholder="Nome Completo" value={userForm.nome} onChange={e => setUserForm({...userForm, nome: e.target.value})} />
            <StyledInput placeholder="Login (ID)" value={userForm.login} onChange={e => setUserForm({...userForm, login: e.target.value})} />
            <StyledInput placeholder="Senha" value={userForm.senha} onChange={e => setUserForm({...userForm, senha: e.target.value})} />
            <label style={{ display: "block", marginBottom: 10 }}>
              <input type="checkbox" checked={userForm.admin} onChange={e => setUserForm({...userForm, admin: e.target.checked})} /> É Administrador?
            </label>
            <BigButton color={DARK.ok} onClick={salvarNovoUsuario}>CRIAR CONTA</BigButton>
          </Card>
          {lista.map(u => (
            <Card key={u.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{u.nome} ({u.id})</b>
                <span>{u.admin ? "👑" : "👤"}</span>
              </div>
            </Card>
          ))}
          <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
        </div>
      )}

      {/* REPETIR ESTRUTURA PARA SCAN, HISTORICO E NOTIFICACOES COM O BOTAO VOLTAR SETANDO HOME */}
      {view === "historico" && (
        <div key="hist">
          <h2>Estoque</h2>
          <StyledInput placeholder="Filtrar..." onChange={e => setFiltro(e.target.value.toUpperCase())} />
          {lista.filter(v => v.chassi.includes(filtro)).map((v, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{v.modelo}</b>
                <span style={{ color: DARK.ok }}>{v.status}</span>
              </div>
              <p style={{ fontSize: 12 }}>ID: {v.chassi}</p>
              <button onClick={() => gerarPDF(v)} style={{ background: "none", border: `1px solid ${DARK.blue}`, color: DARK.blue, padding: 5, borderRadius: 5 }}>Reimprimir QR</button>
            </Card>
          ))}
          <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
        </div>
      )}

      {view === "notificacoes" && (
        <div key="notif">
          <h2>Avisos</h2>
          {lista.map(m => (
            <Card key={m.id}>
              <div>🚗 <b>{m.chassi}</b> → {m.tipo}</div>
              <div style={{ fontSize: 11, color: "#777" }}>Por: {m.user} em {m.createdAt?.toDate().toLocaleString()}</div>
            </Card>
          ))}
          <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
        </div>
      )}
      
      {view === "scan" && (
        <div key="scan">
          <h2>Scanner</h2>
          <Card>
            <video ref={videoRef} style={{ width: "100%", borderRadius: 10, background: "#000" }} />
            <BigButton onClick={async () => {
               const reader = new BrowserMultiFormatReader();
               scannerRef.current = reader;
               const devices = await BrowserMultiFormatReader.listVideoInputDevices();
               reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (res) => { if(res) setScanResult(res.text); });
            }}>LIGAR CÂMERA</BigButton>
            {scanResult && <p>Detectado: {scanResult}</p>}
            <BigButton color="#555" onClick={() => { scannerRef.current?.reset(); setView("home"); }}>VOLTAR</BigButton>
          </Card>
        </div>
      )}
    </Container>
  );
}
