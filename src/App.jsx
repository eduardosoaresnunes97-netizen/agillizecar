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

// ====== Helpers ======
const isHttps = () => (typeof window !== "undefined" && window.isSecureContext);
const upper = (s) => (s || "").toString().trim().toUpperCase();

// Lazy import do gerador de QR
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
  const [view, setView] = useState("login"); // login | home | cadastrar | scan | historico | notificacoes | usuarios
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null); // {nome, admin}

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

  // ====== Títulos da aba ======
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

  // ====== Bootstrap: garante admin/admin123 na coleção users ======
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
        console.log("Usuário admin criado automaticamente.");
      }
    })();
  }, []);

  // ====== Login (valida no Firestore) ======
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

  // ====== Cadastro de veículo ======
  const handleCadastrar = async () => {
    const id = upper(chassi);
    if (!id || !modelo.trim() || !ano.trim() || !cor.trim()) {
      alert("Preencha chassi, modelo, ano e cor.");
      return;
    }
    const payload = {
      chassi: id,
      modelo: modelo.trim(),
      ano: ano.trim(),
      cor: cor.trim(),
      status: "Entrada",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const qrJSON = JSON.stringify(payload);

    const vref = doc(db, "vehicles", id);
    const snap = await getDoc(vref);
    if (snap.exists()) {
      alert("Já existe um veículo com esse chassi.");
      return;
    }
    await setDoc(vref, { ...payload, qrPayload: qrJSON });

    const mref = collection(db, "movements");
    await addDoc(mref, {
      chassi: id,
      tipo: "Entrada",
      user: currentUser?.nome || "sistema",
      createdAt: serverTimestamp()
    });

    const dataURL = await makeQRCodeDataURL(qrJSON);
    setQrPreview(dataURL);

    setChassi(""); setModelo(""); setAno(""); setCor("");
    alert("Veículo cadastrado. QR gerado.");
  };

  // ====== Geração de QR manual ======
  const gerarQRPreview = async () => {
    const id = upper(chassi);
    if (!id || !modelo.trim() || !ano.trim() || !cor.trim()) {
      alert("Preencha chassi, modelo, ano e cor para gerar o QR.");
      return;
    }
    const payload = JSON.stringify({
      chassi: id, modelo: modelo.trim(), ano: ano.trim(), cor: cor.trim(), status: "Entrada"
    });
    const dataURL = await makeQRCodeDataURL(payload);
    setQrPreview(dataURL);
  };

  // ====== Scanner ======
  const startScanner = async () => {
    if (!isHttps()) {
      alert("Sem HTTPS. Use a barra de chassi abaixo para simular a leitura.");
      return;
    }
    if (scannerRef.current) return;

    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (!devices?.length) {
      alert("Nenhuma câmera encontrada.");
      return;
    }
    const reader = new BrowserMultiFormatReader();
    scannerRef.current = reader;

    await reader.decodeFromVideoDevice(
      devices[0].deviceId,
      videoRef.current,
      (result) => {
        if (result) {
          const text = (result?.getText?.() || result?.text || "").trim();
          setScanText(text);
          try { setScanParsed(JSON.parse(text)); } catch { setScanParsed(null); }
        }
      }
    );
  };

  const stopScanner = () => {
    try { scannerRef.current?.reset(); } catch {}
    scannerRef.current = null;
  };

  useEffect(() => {
    return () => stopScanner();
  }, []);

  // Registrar movimento
  const confirmarMovimentacao = async () => {
    const id = upper(scanParsed?.chassi || scanText);
    if (!id) { alert("Nenhum chassi lido."); return; }

    const vref = doc(db, "vehicles", id);
    const vsnap = await getDoc(vref);
    if (!vsnap.exists()) {
      alert(`Veículo ${id} não encontrado.`);
      return;
    }

    await updateDoc(vref, {
      status: setorEscolhido,
      updatedAt: serverTimestamp()
    });

    const mref = collection(db, "movements");
    await addDoc(mref, {
      chassi: id,
      tipo: setorEscolhido,
      user: currentUser?.nome || "sistema",
      createdAt: serverTimestamp()
    });

    alert(`Movimentação registrada: ${id} → ${setorEscolhido}`);
    setScanText(""); setScanParsed(null); setSetorEscolhido(SETORES[0]);
    stopScanner();
    setView("home");
  };

  // ====== Histórico ======
  const loadHistorico = async () => {
    const vcol = collection(db, "vehicles");
    const snap = await getDocs(query(vcol, orderBy("chassi")));
    const list = [];
    snap.forEach(d => list.push(d.data()));
    const filtered = (filtro.trim()
      ? list.filter(v => upper(v.chassi).includes(upper(filtro)))
      : list
    ).filter(v => v.status !== "Vendido");
    setHistoricoView(filtered);
  };

  // ====== Notificações ======
  const loadMovsRecentes = async () => {
    const mcol = collection(db, "movements");
    const qRef = query(mcol, orderBy("createdAt", "desc"), limit(30));
    const snap = await getDocs(qRef);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setMovsRecentes(list);
  };

  // ====== Gestão de Usuários (ADMIN) ======
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  const loadUsers = async () => {
    const col = collection(db, "users");
    // orderBy por nome (garante que salvamos nome)
    const snap = await getDocs(query(col, orderBy("nome")));
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    setUsersList(arr);
  };

  const createUser = async () => {
    if (!currentUser?.admin) {
      alert("Apenas administradores podem criar usuários.");
      return;
    }
    const nome = (newUser || "").trim();
    const senha = (newPass || "").trim();
    if (!nome || !senha) {
      alert("Informe nome e senha.");
      return;
    }
    const uref = doc(db, "users", nome);
    const s = await getDoc(uref);
    if (s.exists()) {
      alert("Já existe um usuário com esse nome.");
      return;
    }
    await setDoc(uref, {
      nome,
      senha,
      admin: !!newIsAdmin,
      createdAt: serverTimestamp()
    });
    setNewUser(""); setNewPass(""); setNewIsAdmin(false);
    await loadUsers();
    alert("Usuário criado.");
  };

  // ====== UI Helpers ======
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

  // ====== VIEWS ======

  if (view === "login") {
    return (
      <div style={{
        background: DARK.bg, color: DARK.text, minHeight: "100vh",
        display: "grid", placeItems: "center", padding: 16
      }}>
        <h1 style={{ marginBottom: 20 }}>AgilizzeCar</h1>
        <Card title="Acesso" style={{ width: 360 }}>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                placeholder="Usuário"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }}
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }}
              />
              <BigButton onClick={handleLogin}>Entrar</BigButton>
            </div>
          </form>
          <div style={{ fontSize: 12, color: DARK.mut, marginTop: 12 }}>
            Primeiro acesso: <b>admin</b> / <b>admin123</b>
          </div>
        </Card>
      </div>
    );
  }

  if (view === "home") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ marginTop: 8 }}>Painel de Controle do Menu</h2>
          {currentUser && (
            <div style={{ color: DARK.mut }}>
              Logado como: <b>{currentUser.nome}</b> {currentUser.admin ? "(admin)" : ""}
            </div>
          )}
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18, maxWidth: 600
        }}>
          <BigButton onClick={() => setView("scan")}>Ler QR</BigButton>
          <BigButton onClick={() => setView("cadastrar")}>Cadastrar</BigButton>
          <BigButton onClick={() => { setView("historico"); loadHistorico(); }}>Histórico</BigButton>
          <BigButton onClick={() => { setView("notificacoes"); loadMovsRecentes(); }}>Notificações</BigButton>

          {/* Visível só para admin */}
          {currentUser?.admin && (
            <BigButton onClick={() => { setView("usuarios"); loadUsers(); }}>
              Usuários
            </BigButton>
          )}
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <BigButton color="#555" onClick={doLogout} style={{ padding: 14 }}>Sair</BigButton>
        </div>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <BigButton onClick={handleCadastrar}>Salvar</BigButton>
                <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
              </div>

              <BigButton color={DARK.blue} onClick={gerarQRPreview} style={{ marginTop: 6 }}>
                Gerar Prévia do QR (sem salvar)
              </BigButton>
            </div>
          </Card>

          <Card title="QR do Veículo" style={{ display: "grid", placeItems: "center" }}>
            {qrPreview ? (
              <div style={{ textAlign: "center" }}>
                <img alt="QR do veículo" src={qrPreview} style={{ width: 260, height: 260, borderRadius: 8, border: `1px solid ${DARK.border}` }} />
                <a
                  href={qrPreview}
                  download={`qr_${new Date().getTime()}.png`}
                  style={{ display: "inline-block", marginTop: 12, color: DARK.text, textDecoration: "underline" }}
                >
                  Baixar QR
                </a>
              </div>
            ) : (
              <div style={{ color: DARK.mut, fontSize: 14 }}>Gere um QR após preencher os dados.</div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (view === "scan") {
    const https = isHttps();
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <h2>Leitura de QR</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 960 }}>
          <Card title={https ? "Câmera (HTTPS)" : "Simulação sem HTTPS"}>
            {https ? (
              <>
                <video ref={videoRef} style={{ width: "100%", borderRadius: 12, border: `1px solid ${DARK.border}` }} />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <BigButton onClick={startScanner}>Iniciar</BigButton>
                  <BigButton color="#555" onClick={stopScanner}>Parar</BigButton>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  placeholder="Cole aqui o JSON lido ou o CHASSI"
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }}
                />
                <BigButton onClick={() => {
                  try { setScanParsed(JSON.parse(scanText)); } catch { setScanParsed(null); }
                }}>
                  Ler Texto
                </BigButton>
              </div>
            )}
          </Card>

          <Card title="Dados lidos">
            <div style={{ fontSize: 13, color: DARK.mut, wordBreak: "break-word" }}>
              <div><b>Texto lido:</b> {scanText || "(vazio)"} </div>
              <div style={{ marginTop: 8 }}>
                <b>JSON:</b>{" "}
                {scanParsed ? (
                  <pre style={{
                    background: "#091126", padding: 10, borderRadius: 8,
                    border: `1px solid ${DARK.border}`, maxHeight: 220, overflow: "auto"
                  }}>{JSON.stringify(scanParsed, null, 2)}</pre>
                ) : "(não é JSON válido — usando CHASSI do texto)"}
              </div>
              <div style={{ marginTop: 8 }}>
                <label><b>Novo setor:</b></label>
                <select
                  value={setorEscolhido}
                  onChange={(e) => setSetorEscolhido(e.target.value)}
                  style={{ marginLeft: 8, padding: 8, borderRadius: 8, background: "#0b1730", color: DARK.text, border: `1px solid ${DARK.border}` }}
                >
                  {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <BigButton onClick={confirmarMovimentacao}>Confirmar</BigButton>
                <BigButton color="#555" onClick={() => { setScanText(""); setScanParsed(null); setView("home"); stopScanner(); }}>
                  Cancelar
                </BigButton>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (view === "historico") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <h2>Histórico / Resumo</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 960 }}>
          <Card title="Filtro por chassi">
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                placeholder="Digite parte do chassi"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }}
              />
              <BigButton onClick={loadHistorico}>Buscar</BigButton>
            </div>
          </Card>

          <Card title="Veículos (Vendido oculto)" style={{ maxHeight: 420, overflow: "auto" }}>
            {historicoView.length === 0 ? (
              <div style={{ color: DARK.mut }}>Nenhum veículo encontrado.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {historicoView.map(v => (
                  <div key={v.chassi} style={{
                    border: `1px solid ${DARK.border}`, borderRadius: 10, padding: 10,
                    background: "#0b1730"
                  }}>
                    <div><b>{v.modelo}</b> — {v.ano} — {v.cor}</div>
                    <div style={{ fontSize: 13, color: DARK.mut }}>Chassi: {v.chassi}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        background: v.status === "Vendido" ? DARK.danger : DARK.blue,
                        color: "white", borderRadius: 999, padding: "3px 10px", fontSize: 12
                      }}>
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ marginTop: 16 }}>
          <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
        </div>
      </div>
    );
  }

  if (view === "notificacoes") {
    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <h2>Notificações (Movimentações Recentes)</h2>

        <Card title="Últimas 30 movimentações" style={{ maxWidth: 820 }}>
          <div style={{ display: "grid", gap: 10, maxHeight: 480, overflow: "auto" }}>
            {movsRecentes.length === 0 ? (
              <div style={{ color: DARK.mut }}>Sem dados. Clique em atualizar.</div>
            ) : movsRecentes.map(m => (
              <div key={m.id} style={{
                border: `1px solid ${DARK.border}`, borderRadius: 10, padding: 10,
                background: "#0b1730", display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center"
              }}>
                <div>
                  <div><b>{m.chassi}</b> → {m.tipo}</div>
                  <div style={{ fontSize: 12, color: DARK.mut }}>por {m.user || "sistema"}</div>
                </div>
                <span style={{ fontSize: 12, color: DARK.mut }}>
                  {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ""}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <BigButton onClick={loadMovsRecentes}>Atualizar</BigButton>
            <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
          </div>
        </Card>
      </div>
    );
  }

  if (view === "usuarios") {
    if (!currentUser?.admin) {
      return (
        <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
          <h2>Usuários</h2>
          <Card>
            <div style={{ color: DARK.danger }}>Acesso negado. Somente administradores.</div>
          </Card>
          <div style={{ marginTop: 16 }}>
            <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
          </div>
        </div>
      );
    }

    return (
      <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
        <h2>Usuários (Admin)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 960 }}>
          <Card title="Criar novo usuário">
            <div style={{ display: "grid", gap: 10 }}>
              <input
                placeholder="Nome do usuário"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }}
              />
              <input
                type="password"
                placeholder="Senha"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${DARK.border}`, background: "#0b1730", color: DARK.text }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: DARK.mut }}>
                <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
                Tornar administrador
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <BigButton onClick={createUser}>Criar usuário</BigButton>
                <BigButton color="#555" onClick={() => setView("home")}>Voltar</BigButton>
              </div>
            </div>
          </Card>

          <Card title="Lista de usuários" style={{ maxHeight: 420, overflow: "auto" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <BigButton onClick={loadUsers} style={{ width: 140 }}>Atualizar</BigButton>
              {usersList.length === 0 ? (
                <div style={{ color: DARK.mut }}>Sem usuários carregados.</div>
              ) : usersList.map(u => (
                <div key={u.nome} style={{
                  border: `1px solid ${DARK.border}`, borderRadius: 10, padding: 10, background: "#0b1730",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div><b>{u.nome}</b> {u.admin ? "— admin" : ""}</div>
                    <div style={{ fontSize: 12, color: DARK.mut }}>Senha: {u.senha}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // fallback
  return (
    <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", padding: 16 }}>
      <h2>Tela desconhecida</h2>
      <BigButton color="#555" onClick={() => setView("home")}>Voltar ao início</BigButton>
    </div>
  );
}