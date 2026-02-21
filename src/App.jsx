import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection,
  addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

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
  mut: "#9fb3ff", blue: "#164c89", ok: "#10b981", orange: "#ff9800", red: "#ff4444"
};

export default function App() {
  const [view, setView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  
  const [chassi, setChassi] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("");
  
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  const [scanText, setScanText] = useState("");
  const [setorEscolhido, setSetorEscolhido] = useState(SETORES[0]);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const irParaHome = () => {
    if (scannerRef.current) {
      scannerRef.current.reset();
      scannerRef.current = null;
    }
    setScanText("");
    setFiltro("");
    setView("home");
  };

  // ====== Funções de Usuário ======
  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!userInput) return alert("Digite o usuário");
    const idBusca = userInput.trim().toLowerCase();
    try {
      const snap = await getDoc(doc(db, "users", idBusca));
      if (snap.exists() && snap.data().senha === password) {
        setCurrentUser({ nome: snap.data().nome, admin: !!snap.data().admin });
        setView("home");
      } else { alert("Usuário ou senha incorretos!"); }
    } catch (err) { alert("Erro de conexão."); }
  };

  const carregarUsuarios = async () => {
    const s = await getDocs(collection(db, "users"));
    setLista(s.docs.map(d => ({ id: d.id, ...d.data() })));
    setView("usuarios");
  };

  const salvarNovoUsuario = async () => {
    if (!newUser || !newPass) return alert("Preencha nome e senha!");
    const idUsuario = newUser.trim().toLowerCase();
    try {
      await setDoc(doc(db, "users", idUsuario), {
        nome: newUser.trim(),
        senha: newPass,
        admin: newIsAdmin,
        createdAt: serverTimestamp()
      });
      alert("Usuário cadastrado!");
      setNewUser(""); setNewPass(""); setNewIsAdmin(false);
      carregarUsuarios();
    } catch (e) { alert("Erro ao criar usuário."); }
  };

  const excluirUsuario = async (id) => {
    if (window.confirm("Deseja realmente excluir este usuário?")) {
      await deleteDoc(doc(db, "users", id));
      carregarUsuarios();
    }
  };

  // ====== Funções de Veículo ======
  const gerarPDF = async (carro) => {
    try {
      const docPDF = new jsPDF({ unit: "mm", format: [80, 80] });
      const qrData = await QRCode.toDataURL(carro.chassi);
      docPDF.setFontSize(10);
      docPDF.text("AGILIZZECAR", 40, 10, { align: "center" });
      docPDF.addImage(qrData, "PNG", 15, 15, 50, 50);
      docPDF.text(`CHASSI: ${carro.chassi}`, 40, 70, { align: "center" });
      docPDF.save(`Etiqueta_${carro.chassi}.pdf`);
    } catch (err) { alert("Erro no QR Code."); }
  };

  const salvarVeiculo = async () => {
    const idChassi = chassi.trim().toUpperCase();
    if (!idChassi) return alert("Chassi obrigatório!");
    try {
      const dados = { chassi: idChassi, modelo, ano, cor, status: "Entrada", updatedAt: serverTimestamp() };
      await setDoc(doc(db, "vehicles", idChassi), dados);
      await addDoc(collection(db, "movements"), { chassi: idChassi, tipo: "Entrada", user: currentUser.nome, createdAt: serverTimestamp() });
      alert("Salvo!");
      if (window.confirm("Baixar Etiqueta?")) gerarPDF(dados);
      setChassi(""); setModelo(""); setAno(""); setCor("");
      irParaHome();
    } catch (e) { alert("Erro ao salvar."); }
  };

  // ====== Estilos ======
  const containerStyle = { background: DARK.bg, color: DARK.text, minHeight: "100vh", width: "100%", padding: "20px", display: "flex", flexDirection: "column", boxSizing: "border-box" };
  const cardStyle = { background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: "16px", padding: "20px", marginBottom: "15px", width: "100%", boxSizing: "border-box" };
  const inputStyle = { width: "100%", padding: "16px", marginBottom: "12px", borderRadius: "10px", border: `1px solid ${DARK.border}`, background: "#0b1730", color: "#fff", fontSize: "16px", boxSizing: "border-box" };
  const btnStyle = (color) => ({ width: "100%", padding: "18px", background: color || DARK.blue, color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "16px", marginBottom: "10px", cursor: "pointer" });

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: "500px", width: "100%", margin: "0 auto" }}>
        
        {view === "login" && (
          <div style={{ paddingTop: "5vh" }}>
            <h1 style={{ textAlign: "center" }}>AgilizzeCar</h1>
            <div style={cardStyle}>
              <input placeholder="Usuário" style={inputStyle} onChange={e => setUserInput(e.target.value)} />
              <input type="password" placeholder="Senha" style={inputStyle} onChange={e => setPassword(e.target.value)} />
              <button style={btnStyle()} onClick={handleLogin}>ENTRAR</button>
            </div>
          </div>
        )}

        {view === "home" && (
          <>
            <h2>Olá, {currentUser?.nome}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button style={btnStyle()} onClick={() => setView("scan")}>LER QR</button>
              <button style={btnStyle()} onClick={() => setView("cadastrar")}>CADASTRAR</button>
              <button style={btnStyle()} onClick={async () => {
                const s = await getDocs(query(collection(db, "vehicles"), orderBy("updatedAt", "desc")));
                setLista(s.docs.map(d => d.data()));
                setView("historico");
              }}>ESTOQUE</button>
              <button style={btnStyle(DARK.orange)} onClick={carregarUsuarios}>USUÁRIOS</button>
            </div>
            <button style={{ ...btnStyle("#444"), marginTop: "30px" }} onClick={() => setView("login")}>SAIR</button>
          </>
        )}

        {view === "usuarios" && (
          <>
            <h3>Gestão de Usuários</h3>
            <div style={cardStyle}>
              <input placeholder="Login" style={inputStyle} value={newUser} onChange={e => setNewUser(e.target.value)} />
              <input placeholder="Senha" style={inputStyle} value={newPass} onChange={e => setNewPass(e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} /> Admin?
              </label>
              <button style={btnStyle(DARK.ok)} onClick={salvarNovoUsuario}>CADASTRAR</button>
            </div>
            {lista.map((u, i) => (
              <div key={i} style={{ ...cardStyle, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><b>{u.nome}</b><br/><small>{u.admin ? "👑 Admin" : "Operador"}</small></div>
                <button onClick={() => excluirUsuario(u.id)} style={{ background: DARK.red, color: "#fff", border: "none", padding: "8px", borderRadius: "5px" }}>X</button>
              </div>
            ))}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </>
        )}

        {view === "cadastrar" && (
          <div style={cardStyle}>
            <h3>Novo Veículo</h3>
            <input placeholder="Chassi" style={inputStyle} value={chassi} onChange={e => setChassi(e.target.value.toUpperCase())} />
            <input placeholder="Modelo" style={inputStyle} value={modelo} onChange={e => setModelo(e.target.value)} />
            <input placeholder="Ano" style={inputStyle} value={ano} onChange={e => setAno(e.target.value)} />
            <input placeholder="Cor" style={inputStyle} value={cor} onChange={e => setCor(e.target.value)} />
            <button style={btnStyle(DARK.ok)} onClick={salvarVeiculo}>SALVAR</button>
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </div>
        )}

        {view === "historico" && (
          <>
            <h3>Estoque</h3>
            <input placeholder="Filtrar..." style={inputStyle} onChange={e => setFiltro(e.target.value.toUpperCase())} />
            {lista.filter(v => v.chassi.includes(filtro)).map((v, i) => (
              <div key={i} style={cardStyle}>
                <b>{v.modelo}</b> - {v.status}
                <div style={{ fontSize: "12px", color: DARK.mut }}>{v.chassi}</div>
                <button style={{ ...btnStyle(DARK.blue), padding: "8px", marginTop: "10px", fontSize: "12px" }} onClick={() => gerarPDF(v)}>REIMPRIMIR</button>
              </div>
            ))}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </>
        )}

        {view === "scan" && (
          <div style={cardStyle}>
            <h3>Scanner</h3>
            <video ref={videoRef} style={{ width: "100%", borderRadius: "12px", background: "#000" }} />
            {!scanText && <button style={btnStyle()} onClick={async () => {
              const reader = new BrowserMultiFormatReader();
              scannerRef.current = reader;
              const devices = await BrowserMultiFormatReader.listVideoInputDevices();
              reader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current, (res) => { if (res) setScanText(res.text); });
            }}>LIGAR CÂMERA</button>}
            {scanText && (
              <div style={{marginTop: "15px"}}>
                <p>Chassi: <b>{scanText}</b></p>
                <select style={inputStyle} value={setorEscolhido} onChange={e => setSetorEscolhido(e.target.value)}>
                   {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button style={btnStyle(DARK.ok)} onClick={async () => {
                   await updateDoc(doc(db, "vehicles", scanText), { status: setorEscolhido, updatedAt: serverTimestamp() });
                   alert("Atualizado!");
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
