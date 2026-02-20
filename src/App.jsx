import React, { useEffect, useRef, useState, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "firebase/firestore";

// 1. Config fora do App (Imutável)
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

const DARK = {
  bg: "#0b1220", card: "#0f1a33", border: "#1b2a4d", text: "#eef3ff",
  blue: "#164c89", ok: "#10b981"
};

// 2. COMPONENTES ESTÁTICOS (Essencial estar fora para não perder o foco)
const StyledInput = ({ label, ...props }) => (
  <div style={{ marginBottom: 15 }}>
    {label && <label style={{ display: "block", marginBottom: 5, fontSize: 14, color: "#9fb3ff" }}>{label}</label>}
    <input
      {...props}
      style={{
        padding: 14, borderRadius: 10, border: `1px solid ${DARK.border}`,
        background: "#0b1730", color: DARK.text, width: "100%", boxSizing: "border-box",
        fontSize: "16px", outline: "none"
      }}
    />
  </div>
);

const BigButton = ({ children, onClick, color = DARK.blue, style }) => (
  <button
    onClick={onClick}
    style={{
      background: color, color: "white", border: 0, borderRadius: 12,
      padding: "16px", fontWeight: 600, cursor: "pointer", width: "100%",
      marginBottom: 10, ...style
    }}
  >
    {children}
  </button>
);

// 3. COMPONENTE PRINCIPAL
export default function App() {
  const [view, setView] = useState("login");
  
  // Agrupando estados para reduzir re-renders
  const [loginData, setLoginData] = useState({ user: "", pass: "" });
  const [carData, setCarData] = useState({ chassi: "", modelo: "", ano: "", cor: "" });
  const [currentUser, setCurrentUser] = useState(null);
  const [lista, setLista] = useState([]);

  // Handler de Input Genérico que mantém o foco
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleCarChange = (e) => {
    const { name, value } = e.target;
    setCarData(prev => ({ ...prev, [name]: name === "chassi" ? value.toUpperCase() : value }));
  };

  const realizarLogin = async (e) => {
    e?.preventDefault();
    const snap = await getDoc(doc(db, "users", loginData.user.trim()));
    if (snap.exists() && snap.data().senha === loginData.pass) {
      setCurrentUser({ nome: snap.data().nome, admin: snap.data().admin });
      setView("home");
    } else {
      alert("Erro de login");
    }
  };

  // Renderização Condicional Limpa
  return (
    <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 20, boxSizing: "border-box", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        
        {view === "login" && (
          <div key="view-login">
            <h1 style={{ textAlign: "center" }}>AgilizzeCar</h1>
            <div style={{ background: DARK.card, padding: 20, borderRadius: 15, border: `1px solid ${DARK.border}` }}>
              <StyledInput 
                name="user"
                placeholder="Usuário" 
                value={loginData.user} 
                onChange={handleLoginChange} 
              />
              <StyledInput 
                name="pass"
                type="password" 
                placeholder="Senha" 
                value={loginData.pass} 
                onChange={handleLoginChange} 
              />
              <BigButton onClick={realizarLogin}>ENTRAR</BigButton>
            </div>
          </div>
        )}

        {view === "home" && (
          <div key="view-home">
            <h2>Bem-vindo, {currentUser?.nome}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <BigButton onClick={() => setView("cadastrar")}>CADASTRAR</BigButton>
              <BigButton onClick={() => setView("historico")}>HISTÓRICO</BigButton>
              <BigButton onClick={() => setView("notificacoes")}>AVISOS</BigButton>
              <BigButton color="#444" onClick={() => setView("login")}>SAIR</BigButton>
            </div>
          </div>
        )}

        {view === "cadastrar" && (
          <div key="view-cad">
            <h2>Novo Cadastro</h2>
            <StyledInput name="chassi" label="Chassi" value={carData.chassi} onChange={handleCarChange} />
            <StyledInput name="modelo" label="Modelo" value={carData.modelo} onChange={handleCarChange} />
            <StyledInput name="ano" label="Ano" value={carData.ano} onChange={handleCarChange} />
            <StyledInput name="cor" label="Cor" value={carData.cor} onChange={handleCarChange} />
            <BigButton color={DARK.ok} onClick={() => alert("Salvando...")}>SALVAR</BigButton>
            <BigButton color="#555" onClick={() => setView("home")}>VOLTAR</BigButton>
          </div>
        )}

      </div>
    </div>
  );
}
