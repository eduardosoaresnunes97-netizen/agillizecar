import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/App";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection,
  addDoc, serverTimestamp, query, orderBy, getDocs
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
const db = getFirestore(App);

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
    setView("home");
  };

  // ====== LÓGICA DE LOGIN ======
  const handleLogin = async (e) => {
    e?.preventDefault();
    const idLogin = userInput.trim().toLowerCase();
    if (!idLogin) return alert("Digite o usuário");
    
    try {
      const snap = await getDoc(doc(db, "users", idLogin));
      if (snap.exists() && snap.data().senha === password) {
        setCurrentUser({ nome: snap.data().nome, admin: true }); // Forçado admin true para teste
        setView("home");
      } else {
        alert("Usuário ou senha incorretos!");
      }
    } catch (err) {
      alert("Erro ao conectar. Verifique sua internet.");
    }
  };

  // ====== GESTÃO DE USUÁRIOS ======
  const carregarUsuarios = async () => {
    const s = await getDocs(collection(db, "users"));
    setLista(s.docs.map(d => ({ id: d.id, ...d.data() })));
    setView("usuarios");
  };

  const salvarNovoUsuario = async () => {
    if (!newUser || !newPass) return alert("Preencha nome e senha!");
    const idUser = newUser.trim().toLowerCase();
    try {
      await setDoc(doc(db, "users", idUser), {
        nome: newUser.trim(),
        senha: newPass,
        admin: newIsAdmin,
        createdAt: serverTimestamp()
      });
      alert("Usuário Criado!");
      setNewUser(""); setNewPass("");
      carregarUsuarios();
    } catch (e) { alert("Erro ao criar usuário."); }
  };

  // ====== GESTÃO DE VEÍCULOS ======
  const salvarVeiculo = async () => {
    const idLimpo = chassi.trim().toUpperCase();
    if (!idLimpo || !modelo) return alert("Chassi e Modelo são obrigatórios!");

    try {
      const dados = {
        chassi: idLimpo,
        modelo: modelo,
        ano: ano,
        cor: cor,
        status: "Entrada",
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "vehicles", idLimpo), dados);
      
      await addDoc(collection(db, "movements"), {
        chassi: idLimpo,
        tipo: "Entrada",
        user: currentUser?.nome || "Sistema",
        createdAt: serverTimestamp()
      });

      alert("Veículo Salvo!");
      setChassi(""); setModelo(""); setAno(""); setCor("");
      irParaHome();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar veículo. Verifique as regras do Firebase.");
    }
  };

  // ====== ESTILOS ======
  const containerStyle = { background: DARK.bg, color: DARK.text, minHeight: "100vh", width: "100%", padding: "20px", boxSizing: "border-box" };
  const cardStyle = { background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: "16px", padding: "20px", marginBottom: "15px" };
  const inputStyle = { width: "100%", padding: "15px", marginBottom: "10px", borderRadius: "10px", border: "none", background: "#1b2a4d", color: "#fff" };
  const btnStyle = (col) => ({ width: "100%", padding: "15px", background: col || DARK.blue, color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", marginBottom: "10px" });

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        
        {view === "login" && (
          <div style={{textAlign: "center", paddingTop: "50px"}}>
            <h1>AgilizzeCar</h1>
            <div style={cardStyle}>
              <input placeholder="Usuário" style={inputStyle} onChange={e => setUserInput(e.target.value)} />
              <input type="password" placeholder="Senha" style={inputStyle} onChange={e => setPassword(e.target.value)} />
              <button style={btnStyle()} onClick={handleLogin}>ENTRAR</button>
            </div>
          </div>
        )}

        {view === "home" && (
          <>
            <h2>Painel Principal</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button style={btnStyle()} onClick={() => setView("scan")}>LER QR</button>
              <button style={btnStyle()} onClick={() => setView("cadastrar")}>NOVO CARRO</button>
              <button style={btnStyle(DARK.orange)} onClick={carregarUsuarios}>USUÁRIOS</button>
              <button style={btnStyle()} onClick={async () => {
                 const s = await getDocs(query(collection(db, "vehicles"), orderBy("updatedAt", "desc")));
                 setLista(s.docs.map(d => d.data()));
                 setView("estoque");
              }}>ESTOQUE</button>
            </div>
            <button style={{...btnStyle("#444"), marginTop: "20px"}} onClick={() => setView("login")}>SAIR</button>
          </>
        )}

        {view === "usuarios" && (
          <>
            <h3>Criar Usuário</h3>
            <div style={cardStyle}>
              <input placeholder="Login" style={inputStyle} value={newUser} onChange={e => setNewUser(e.target.value)} />
              <input placeholder="Senha" style={inputStyle} value={newPass} onChange={e => setNewPass(e.target.value)} />
              <label><input type="checkbox" onChange={e => setNewIsAdmin(e.target.checked)} /> Admin?</label>
              <button style={btnStyle(DARK.ok)} onClick={salvarNovoUsuario}>CADASTRAR</button>
            </div>
            {lista.map((u, i) => (
              <div key={i} style={{...cardStyle, padding: "10px", display: "flex", justifyContent: "space-between"}}>
                <span>{u.nome}</span>
                <button onClick={async () => { if(confirm("Excluir?")) { await deleteDoc(doc(db, "users", u.id)); carregarUsuarios(); } }} style={{background: "none", color: DARK.red, border: "none"}}>Remover</button>
              </div>
            ))}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </>
        )}

        {view === "cadastrar" && (
          <div style={cardStyle}>
            <h3>Cadastrar Veículo</h3>
            <input placeholder="Chassi" style={inputStyle} value={chassi} onChange={e => setChassi(e.target.value)} />
            <input placeholder="Modelo" style={inputStyle} value={modelo} onChange={e => setModelo(e.target.value)} />
            <input placeholder="Ano" style={inputStyle} value={ano} onChange={e => setAno(e.target.value)} />
            <input placeholder="Cor" style={inputStyle} value={cor} onChange={e => setCor(e.target.value)} />
            <button style={btnStyle(DARK.ok)} onClick={salvarVeiculo}>SALVAR NO BANCO</button>
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </div>
        )}

        {view === "estoque" && (
          <>
            <h3>Estoque Atual</h3>
            {lista.map((v, i) => (
              <div key={i} style={cardStyle}>
                <b>{v.modelo}</b> - {v.status} <br/>
                <small>{v.chassi}</small>
              </div>
            ))}
            <button style={btnStyle("#555")} onClick={irParaHome}>VOLTAR</button>
          </>
        )}

      </div>
    </div>
  );
}
