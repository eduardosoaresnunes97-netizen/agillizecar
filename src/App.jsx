import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { jsPDF } from "jspdf";

// ====== Configuração Firebase ======
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
  mut: "#9fb3ff", blue: "#164c89", ok: "#10b981", danger: "#ff4444"
};

export default function App() {
  const [view, setView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  
  // Estados de Cadastro e Listas
  const [chassi, setChassi] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("");
  
  // Estados de Usuários
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Scanner
  const [scanText, setScanText] = useState("");
  const [setorEscolhido, setSetorEscolhido] = useState(SETORES[0]);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  // Reset de scroll e limpeza de processos ao mudar de tela
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const irParaHome = () => {
    if (scannerRef.current) {
      scannerRef.current.reset();
      scannerRef.current = null;
    }
    setScanText("");
    setFiltro("");
    setView("home");
  };

  const gerarPDF = async (carro) => {
    const { default: QRCode } = await import("qrcode");
    const doc = new jsPDF({ unit: "mm", format: [80, 80] });
    const qrData = await QRCode.toDataURL(carro.chassi);
    doc.setFontSize(10);
    doc.text("AGILIZZECAR", 40, 10, { align: "center" });
    doc.addImage(qrData, "PNG", 15, 15, 50, 50);
    doc.text(`CHASSI: ${carro.chassi}`, 40, 70, { align: "center" });
    doc.save(`Etiqueta_${carro.chassi}.pdf`);
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    const snap = await getDoc(doc(db, "users", userInput.trim()));
    if (snap.exists() && snap.data().senha === password) {
      setCurrentUser({ nome: snap.data().nome, admin: !!snap.data().admin });
      setView("home");
    } else { alert("Login ou senha incorretos!"); }
  };

  const createUser = async () => {
    if (!newUser || !newPass) return alert("Preencha os campos!");
    await setDoc(doc(db, "users", newUser.trim()), {
      nome: newUser.trim(),
      senha: newPass,
      admin: newIsAdmin,
      createdAt: serverTimestamp()
    });
    alert("Usuário criado com sucesso!");
    setNewUser(""); setNewPass(""); setNewIsAdmin(false);
    // Atualiza a lista
    const s = await getDocs(collection(db, "users"));
    setLista(s.docs.map(d => d.data()));
  };

  // ====== ESTILOS OTIMIZADOS PARA APP (WEBVIEW) ======
  const containerStyle = {
    background: DARK.bg,
    color: DARK.text,
    minHeight: "100vh",
    width: "100%",
    // Suporte para entalhes de câmera (Notch) no celular
    padding: "calc(env(safe-area-inset-top) + 20px) 20px calc(env(safe-area-inset-bottom) + 20px) 20px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box"
  };

  const cardStyle = {
    background: DARK.card,
    border: `1px solid ${DARK.border}`,
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "15px",
    width: "100%",
    boxSizing: "border-box"
  };

  const inputStyle = {
    width: "100%",
    padding: "16px",
    marginBottom: "12px",
    borderRadius: "10px",
    border: `1px solid ${DARK.border}`,
    background: "#0b1730",
    color: "#fff",
    fontSize: "16px",
    boxSizing: "border-box"
  };

  const btnStyle = (color) => ({
    width: "100%",
    padding: "18px",
    background: color || DARK.blue,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontWeight: "bold",
    fontSize: "16px",
    marginBottom: "10px",
    cursor: "pointer",
    touchAction: "manipulation"
  });

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: "500px", width: "100%", margin: "0 auto" }}>
        
        {view === "login" && (
          <div style={{ paddingTop: "10vh" }}>
            <h1 style={{ textAlign: "center", marginBottom: "30px" }}>AgilizzeCar</h1>
            <div style={cardStyle}>
              <input placeholder="Usuário" style={inputStyle} onChange={e => setUserInput(e.target.value)} />
              <input type="password" placeholder="Senha" style={inputStyle} onChange={e => setPassword(e.target.value)} />
              <button style={btnStyle()} onClick={handleLogin}>ENTRAR</button>
            </div>
          </div>
        )}

        {view === "home" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2>Menu</h2>
              <span style={{ color: DARK.mut }}>{currentUser?.nome}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button style={btnStyle()} onClick={() => setView("scan")}>LER QR</button>
              <button style={btnStyle()} onClick={() => setView("cadastrar")}>CADASTRAR</button>
              <button style={btnStyle()} onClick={async () => {
                const s = await getDocs(query(collection(db, "vehicles"), orderBy("updatedAt", "desc")));
                setLista(s.docs.map(d => d.data()));
                setView("historico");
              }}>ESTOQUE</button>
              <button style={btnStyle()} onClick={async () => {
                const s = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc"), limit(20)));
                setLista(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setView("notificacoes");
              }}>AVISOS</button>
            </div>
            {currentUser?.admin && (
              <button style={btnStyle("#ff9800")} onClick={async () => {
                const s = await getDocs(collection(db, "users"));
                setLista(s.docs.map(d => d.data()));
                setView("usuarios");
              }}>GESTÃO DE USUÁRIOS</button>
            )}
            <button style={btnStyle("#444")} onClick={() => setView("login")} style={{marginTop: "20px"}}>SAIR</button>
          </>
        )}

        {view === "cadastrar" && (
          <>
            <h3>Novo Veículo</h3>
            <div style={cardStyle}>
              <input placeholder="Chassi" style={inputStyle} value={chassi} onChange={e => setChassi(e.target.value.toUpperCase())} />
              <input placeholder="Modelo" style={inputStyle} onChange={e => setModelo(e.target.value)} />
              <input placeholder="Ano" style={inputStyle} onChange={e => setAno(e.target.value)} />
              <input placeholder="Cor" style={inputStyle} onChange={e => setCor(e.target.value)} />
              <button style={btnStyle(DARK.ok)} onClick={async () => {
                const id = chassi.trim();
                const dPayload = { chassi: id, modelo, ano, cor, status: "Entrada", updatedAt: serverTimestamp() };
                await setDoc(doc(db, "vehicles", id), dPayload);
                await addDoc(collection(db, "movements"), { chassi: id, tipo: "Entrada", user: currentUser.nome, createdAt: serverTimestamp() });
                if (window.confirm("Cadastrado! Baixar etiqueta?")) gerarPDF(dPayload);
                irParaHome();
              }}>SALVAR</button>
              <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
            </div>
          </>
        )}

        {view === "usuarios" && (
          <>
            <h3>Gestão de Usuários</h3>
            <div style={cardStyle}>
              <input placeholder="Nome" style={inputStyle} value={newUser} onChange={e => setNewUser(e.target.value)} />
              <input placeholder="Senha" style={inputStyle} value={newPass} onChange={e => setNewPass(e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} /> É Administrador?
              </label>
              <button style={btnStyle(DARK.ok)} onClick={createUser}>CRIAR CONTA</button>
            </div>
            {lista.map((u, i) => (
              <div key={i} style={{ ...cardStyle, padding: "12px", display: "flex", justifyContent: "space-between" }}>
                <span>{u.nome}</span>
                <span style={{ fontSize: "12px", color: DARK.mut }}>{u.admin ? "👑 Admin" : "Operador"}</span>
              </div>
            ))}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </>
        )}

        {view === "historico" && (
          <>
            <h3>Estoque Atual</h3>
            <input placeholder="Filtrar Chassi..." style={inputStyle} onChange={e => setFiltro(e.target.value.toUpperCase())} />
            {lista.filter(v => v.chassi.includes(filtro)).map((v, i) => (
              <div key={i} style={cardStyle}>
                <b>{v.modelo}</b> <br/>
                <small style={{color: DARK.mut}}>{v.chassi}</small>
                <div style={{marginTop: "10px", color: DARK.ok}}>{v.status}</div>
                <button style={{...btnStyle(DARK.blue), padding: "8px", marginTop: "10px", fontSize: "12px"}} onClick={() => gerarPDF(v)}>REIMPRIMIR ETIQUETA</button>
              </div>
            ))}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </>
        )}

        {view === "scan" && (
          <div style={cardStyle}>
            <h3>Scanner</h3>
            <video ref={videoRef} style={{ width: "100%", borderRadius: "12px", marginBottom: "15px", background: "#000" }} />
            {!scanText && <button style={btnStyle()} onClick={async () => {
              const reader = new BrowserMultiFormatReader();
              scannerRef.current = reader;
              const devices = await BrowserMultiFormatReader.listVideoInputDevices();
              reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (res) => { if (res) setScanText(res.text); });
            }}>LIGAR CÂMERA</button>}
            
            {scanText && (
              <div>
                <p>Veículo: <b>{scanText}</b></p>
                <select style={inputStyle} value={setorEscolhido} onChange={e => setSetorEscolhido(e.target.value)}>
                   {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button style={btnStyle(DARK.ok)} onClick={async () => {
                   await updateDoc(doc(db, "vehicles", scanText), { status: setorEscolhido, updatedAt: serverTimestamp() });
                   await addDoc(collection(db, "movements"), { chassi: scanText, tipo: setorEscolhido, user: currentUser.nome, createdAt: serverTimestamp() });
                   alert("Movimentação registrada!");
                   irParaHome();
                }}>CONFIRMAR</button>
              </div>
            )}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </div>
        )}

      </div>
    </div>
  );
}

