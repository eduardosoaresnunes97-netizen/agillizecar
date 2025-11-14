export default function QRScan({ onResult, onBack }) {
  return (
    <div style={{
      background: "#0b1220",
      color: "white",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column"
    }}>
      
      <h2 style={{ marginBottom: "15px", fontSize: "22px", fontWeight: "bold" }}>Leitor de QR (Simulado)</h2>

      <input
        placeholder="Digite o código do chassi manual"
        onChange={(e) => onResult(e.target.value.toUpperCase())}
        style={{
          padding: "12px",
          borderRadius: "6px",
          border: "1px solid #334155",
          width: "290px",
          background: "#1e293b",
          color: "white"
        }}
      />

      <button
        onClick={onBack}
        style={{
          marginTop: "25px",
          padding: "12px",
          borderRadius: "6px",
          background: "#dc2626",
          color: "white",
          fontWeight: "bold"
        }}
      >
        Voltar
      </button>

    </div>
  );
}
