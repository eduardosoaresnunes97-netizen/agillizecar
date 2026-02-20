import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ====== Constantes do App ======
const SETORES = [
  "Entrada", "Pátio", "Oficina", "Funilaria", "Acessórios", "Lavagem", "Showroom", "Vendido"
];
const DARK = {
  bg: "#0b1220", card: "#0f1a33", border: "#1b2a4d", text: "#eef3ff",
  mut: "#9fb3ff", blue: "#164c89", blueH: "#1d63b4", danger: "#d33", ok: "#10b981"
};

// ====== COMPONENTES DE UI (MOVIDOS PARA FORA PARA EVITAR PERDA DE FOCO) ======
const Card = ({ title, children, style }) => (
  <div style={{
    background: DARK.card, border: `1px solid ${DARK.border}`,
    borderRadius: 16, padding: 16, ...style
  }}>
    {title && <h3 style={{ margin: 0, marginBottom: 12, color: DARK.mut }}>{title}</h3>}
    {children}
  </div>
);

const BigButton = ({ children, onClick, color = DARK.blue, style }) => (
  <button
    onClick={onClick}
    style={{
      background: color, color: "white", border: 0, borderRadius: 14,
      padding: "18px 14px", fontWeight: 600, cursor: "pointer",
      transition: "all .2s", ...style
    }}
    onMouseOver={(e) => (e.currentTarget.style.background = DARK.blueH)}
    onMouseOut={(e) => (e.currentTarget.style.background = color)}
  >
    {children}
  </button>
);

// ====== Helpers ======
const isHttps = () => (typeof window !== "undefined" && window.isSecureContext);
const upper = (s) => (s || "").toString().trim().toUpperCase();

async function makeQRCodeDataURL(text, opts = { width: 320, margin: 2 }) {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(text, opts);
  } catch (e) {
    console.error("Falha ao importar/gerar QR:", e);
    return null;
  }
}

// ====== App ======
export default function App() {
  const [view, setView] = useState("login"); 
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null); 

  // Cadastro
  const [chassi, setChassi] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [qrPreview, setQrPreview] = useState(null);

  // Scanner
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [scanText, setScanText] = useState("");
  const [scanParsed, setScanParsed] = useState(null);
  const [setorEscolhido, setSetorEscolhido] = useState(SETORES[0]);

  // Histórico / Pesquisa
  const [filtro, setFiltro] = useState("");
  const [historicoView, setHistoricoView] = useState([]);
  const [movsRecentes, setMovsRecentes] = useState([]);

  // Usuários
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  useEffect(() => {
    const titles = {
      login: "AgilizzeCar — Login",
      home: "AgilizzeCar — Painel de Controle do Menu",
      cadastrar: "AgilizzeCar — Cadastrar",
      scan: "AgilizzeCar — Leitura de QR",
      historico: "AgilizzeCar — Histórico",
      notificacoes: "AgilizzeCar — Notificações",
      usuarios: "AgilizzeCar — Usuários (Admin)"
    };
    document.title = titles[view] || "AgilizzeCar";
  }, [view]);

  useEffect(() => {
    (async () => {
      const aref = doc(db, "users", "admin");
      const s = await getDoc(aref);
      if (!s.exists()) {
        await setDoc(aref, {
          nome: "admin",
          senha: "admin123",
          admin: true,
          createdAt: serverTimestamp()
        });
      }
    })();
  }, []);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    const uname = (userInput || "").trim();
    const pref = doc(db, "users", uname);
    const snap = await getDoc(pref);
    if (!snap.exists()) {
      alert("Usuário não encontrado.");
      return;
    }
    const data = snap.data();
    if (data.senha !== password) {
      alert("Senha incorreta.");
      return;
    }
    setCurrentUser({ nome: data.nome, admin: !!data.admin });
    setPassword("");
    setView("home");
  };

  const doLogout = () => {
    setCurrentUser(null);
    setUserInput("");
    setPassword("");
    setView("login");
  };

  const handleCadastrar = async () => {
    const id = upper(chassi);
    if (!id || !modelo.trim() || !ano.trim() || !cor.trim()) {
      alert("Preencha chassi, modelo, ano e cor.");
      return;
    }
    const payload = {
      chassi: id, modelo: modelo.trim(), ano: ano.trim(), cor: cor.trim(),
      status: "Entrada", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    const qrJSON = JSON.stringify(payload);
    const vref = doc(db, "vehicles", id);
    const snap = await getDoc(vref);
    if (snap.exists()) {
      alert("Já existe um veículo com esse chassi.");
      return;
    }
    await setDoc(vref, { ...payload, qrPayload: qrJSON });
    await addDoc(collection(db, "movements"), {
      chassi: id, tipo: "Entrada", user: currentUser?.nome || "sistema", createdAt: serverTimestamp()
    });
    const dataURL = await makeQRCodeDataURL(qrJSON);
    setQrPreview(dataURL);
    setChassi(""); setModelo(""); setAno(""); setCor("");
    alert("Veículo cadastrado.");
  };

  const gerarQRPreview = async () => {
    const id = upper(chassi);
    if (!id || !modelo.trim() || !ano.trim() || !cor.trim()) {
      alert("Preencha os dados primeiro.");
      return;
    }
    const payload = JSON.stringify({ chassi: id, modelo: modelo.trim(), ano: ano.trim(), cor: cor.trim(), status: "Entrada" });
    const dataURL = await makeQRCodeDataURL(payload);
    setQrPreview(dataURL);
  };

  const startScanner = async () => {
    if (!isHttps()) { alert("HTTPS necessário para câmera."); return; }
    if (scannerRef.current) return;
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (!devices?.length) return;
    const reader = new BrowserMultiFormatReader();
    scannerRef.current = reader;
    await reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (result) => {
      if (result) {
        const text = (result?.getText?.() || result?.text || "").trim();
        setScanText(text);
        try { setScanParsed(JSON.parse(text)); } catch { setScanParsed(null); }
      }
    });
  };

  const stopScanner = () => {
    try { scannerRef.current?.reset(); } catch {}
    scannerRef.current = null;
  };

  const confirmarMovimentacao = async () => {
    const id = upper(scanParsed?.chassi || scanText);
    if (!id) return;
    const vref = doc(db, "vehicles", id);
    const vsnap = await getDoc(vref);
    if (!vsnap.exists()) { alert("Veículo não encontrado."); return; }
    await updateDoc(vref, { status: setorEscolhido, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "movements"), {
      chassi: id, tipo: setorEscolhido, user: currentUser?.nome || "sistema", createdAt: serverTimestamp()
    });
    alert("Sucesso!");
    setScanText(""); setView("home"); stopScanner();
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

  const loadUsers = async () => {
    const snap = await getDocs(query(collection(db, "users"), orderBy("nome")));
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    setUsersList(arr);
  };

  const createUser = async () => {
    const nome = (newUser || "").trim();
    const senha = (newPass || "").trim();
    if (!nome || !senha) return;
    await setDoc(doc(db, "users", nome), { nome, senha, admin: !!newIsAdmin, createdAt: serverTimestamp() });
    setNewUser(""); setNewPass(""); await loadUsers();
    alert("Usuário criado.");
  };

  // ====== RENDERIZAÇÃO DAS TELAS ======
  if (view === "login") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
        <h1>AgilizzeCar</h1>
        <Card title="Acesso" style={{ width: 360 }}>
          <form onSubmit={handleLogin}>
            <div style={{ display: "grid", gap: 10 }}>
              <input placeholder="Usuário" value={userInput} onChange={(e) => setUserInput(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <BigButton onClick={handleLogin}>Entrar</BigButton>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  if (view === "home") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Menu</h2>
          <span>{currentUser?.nome}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18, maxWidth: 600 }}>
          <BigButton onClick={() => setView("scan")}>Ler QR</BigButton>
          <BigButton onClick={() => setView("cadastrar")}>Cadastrar</BigButton>
          <BigButton onClick={() => { setView("historico"); loadHistorico(); }}>Histórico</BigButton>
          <BigButton onClick={() => { setView("notificacoes"); loadMovsRecentes(); }}>Notificações</BigButton>
          {currentUser?.admin && <BigButton onClick={() => { setView("usuarios"); loadUsers(); }}>Usuários</BigButton>}
        </div>
        <BigButton color="#555" onClick={doLogout} style={{ marginTop: 24 }}>Sair</BigButton>
      </div>
    );
  }

  if (view === "cadastrar") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <h2>Cadastrar Veículo</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 820 }}>
          <Card title="Dados">
            <div style={{ display: "grid", gap: 10 }}>
              <input placeholder="Chassi" value={chassi} onChange={(e) => setChassi(upper(e.target.value))}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <input placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <input placeholder="Ano" value={ano} onChange={(e) => setAno(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <input placeholder="Cor" value={cor} onChange={(e) => setCor(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <BigButton onClick={handleCadastrar}>Salvar</BigButton>
              <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
            </div>
          </Card>
          <Card title="QR Code">
             {qrPreview && <img src={qrPreview} style={{ width: 200 }} alt="QR" />}
          </Card>
        </div>
      </div>
    );
  }

  if (view === "usuarios") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <h2>Usuários (Admin)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 960 }}>
          <Card title="Novo Usuário">
            <div style={{ display: "grid", gap: 10 }}>
              <input placeholder="Nome" value={newUser} onChange={(e) => setNewUser(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <input type="password" placeholder="Senha" value={newPass} onChange={(e) => setNewPass(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }} />
              <BigButton onClick={createUser}>Criar</BigButton>
              <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
            </div>
          </Card>
          <Card title="Lista">
            {usersList.map(u => <div key={u.nome} style={{ marginBottom: 8 }}>{u.nome}</div>)}
          </Card>
        </div>
      </div>
    );
  }

  // Fallback simplificado para outras telas
  return (
    <div style={{ padding: 20, background: DARK.bg, color: DARK.text, minHeight: "100vh" }}>
      <h2>Tela: {view}</h2>
      <BigButton onClick={() => setView("home")}>Voltar</BigButton>
    </div>
  );
}
