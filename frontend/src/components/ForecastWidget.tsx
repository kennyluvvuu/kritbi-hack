import { useState, useRef, useEffect } from "react";
import { TrendingUp, RefreshCw, Send, Bot, User } from "lucide-react";
import type { Forecast, ForecastPoint } from "../types";
import { formatDateTime } from "../utils/format";

export function ForecastWidget({
  forecast,
  onRequest,
  loading,
}: {
  forecast: Forecast | null;
  onRequest: () => void;
  loading: boolean;
}) {
  const [messages, setMessages] = useState<{role: "user"|"assistant", content: string}[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const points = (forecast?.forecastData as ForecastPoint[]) || [];
  
  const pt6 = points.find((p) => p.horizon === 6);
  const pt24 = points.find((p) => p.horizon === 24);
  const pt72 = points.find((p) => p.horizon === 72);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInputValue("");
    setIsTyping(true);

    try {
      let context = "Пока нет прогноза.";
      if (forecast) {
        context = `Прогноз 6ч: ${pt6?.yhat.toFixed(1)}см, 24ч: ${pt24?.yhat.toFixed(1)}см, 72ч: ${pt72?.yhat.toFixed(1)}см.`;
      }

      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, forecastContext: context }),
      });

      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.reply || data.error || "Качинатор ушел в астрал." 
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Ошибка связи с космосом." }]);
    } finally {
      setIsTyping(false);
    }
  };
  
  return (
    <div className="card card-forecast" style={{ gridColumn: "span 2", minHeight: "550px", display: "flex", flexDirection: "column" }}>
      <div className="card-header" style={{ borderBottom: "1px solid var(--glass-border)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="card-title" style={{ fontSize: "1.2rem", color: "#fff", fontWeight: "800", textTransform: "none", letterSpacing: "normal" }}>
           🔮 ПРОГНОЗ ОТ КАЧИНАТОРА <span style={{ fontSize: "0.8rem", fontWeight: "400", opacity: 0.7, marginLeft: "8px" }}>(никогда не ошибается)</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={onRequest}
          disabled={loading}
          style={{ background: "var(--gradient-blue)", border: "none", borderRadius: "8px" }}
        >
          {loading ? (
            <RefreshCw size={14} className="spin" />
          ) : (
            <TrendingUp size={14} />
          )}
          {loading ? "Думает..." : "Спросить Качинатора"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "32px", flex: 1, minHeight: "440px", flexWrap: "nowrap" }}>
        {/* Акинатор */}
        <div style={{ flex: "0 0 350px", display: "flex", justifyContent: "center", alignItems: "flex-end", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "16px" }}>
          <img 
            src="/kacinator.png" 
            alt="Качинатор" 
            style={{ width: "100%", height: "auto", maxHeight: "440px", objectFit: "contain", filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.5))" }} 
          />
        </div>

        {/* Прогноз контент */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {!forecast ? (
            <div className="empty-state" style={{ padding: "0" }}>
              <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: "16px" }} />
              <div style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>
                Качинатор еще не предсказал будущее. 
              </div>
              <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "8px" }}>
                Нажмите «Спросить Качинатора», чтобы он заглянул в завтрашний день.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", width: "100%" }}>
                <div className="forecast-card" style={{ flex: 1, minWidth: "140px", background: "var(--bg-secondary, #111827)", padding: "20px", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Через 6 ч</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--teal-400)" }}>
                    {pt6 ? pt6.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1rem", opacity: 0.5 }}>см</span>
                  </div>
                  {pt6 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: pt6.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                      {pt6.yhat >= 200 ? "⚠️ Опасно" : "✅ Норма"}
                    </div>
                  )}
                </div>

                <div className="forecast-card" style={{ flex: 1, minWidth: "140px", background: "var(--bg-secondary, #111827)", padding: "20px", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Завтра (24 ч)</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--cyan-400)" }}>
                    {pt24 ? pt24.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1rem", opacity: 0.5 }}>см</span>
                  </div>
                  {pt24 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: pt24.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                      {pt24.yhat >= 200 ? "⚠️ Риск" : "✅ Норма"}
                    </div>
                  )}
                </div>

                <div className="forecast-card" style={{ flex: 1, minWidth: "140px", background: "var(--bg-secondary, #111827)", padding: "20px", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>3 дня (72 ч)</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--blue-400)" }}>
                    {pt72 ? pt72.yhat.toFixed(1) : "—"} <span style={{ fontSize: "1rem", opacity: 0.5 }}>см</span>
                  </div>
                  {pt72 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: pt72.yhat >= 200 ? "var(--red-400)" : "var(--green-400)" }}>
                      {pt72.yhat >= 200 ? "⚠️ Паводок" : "✅ Ок"}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: "24px", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", fontStyle: "italic" }}>
                Последний сеанс связи с космосом: {formatDateTime(forecast.createdAt)}
              </div>
            </>
          )}

          {/* Chat Interface */}
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)", borderRadius: "12px", border: "1px solid var(--glass-border)", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", fontSize: "0.9rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Bot size={16} color="var(--blue-400)" />
              Чат с Качинатором
            </div>
            
            <div style={{ height: "180px", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", margin: "auto" }}>
                  Напиши что-нибудь, братишка...
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                  {msg.role === "assistant" && <div style={{ marginTop: "2px", flexShrink: 0 }}><Bot size={14} color="var(--blue-400)" /></div>}
                  <div style={{ 
                    background: msg.role === "user" ? "var(--gradient-blue)" : "rgba(255,255,255,0.05)", 
                    padding: "8px 12px", 
                    borderRadius: "12px", 
                    borderBottomRightRadius: msg.role === "user" ? "4px" : "12px",
                    borderBottomLeftRadius: msg.role === "assistant" ? "4px" : "12px",
                    fontSize: "0.85rem",
                    color: "#fff",
                    lineHeight: 1.4,
                    wordBreak: "break-word"
                  }}>
                    {msg.content}
                  </div>
                  {msg.role === "user" && <div style={{ marginTop: "2px", flexShrink: 0 }}><User size={14} color="rgba(255,255,255,0.5)" /></div>}
                </div>
              ))}
              {isTyping && (
                <div style={{ display: "flex", gap: "8px", alignSelf: "flex-start" }}>
                  <div style={{ marginTop: "2px" }}><Bot size={14} color="var(--blue-400)" /></div>
                  <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "12px", borderBottomLeftRadius: "4px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Печатает...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: "flex", padding: "12px", borderTop: "1px solid var(--glass-border)", gap: "8px", background: "rgba(0,0,0,0.1)", alignItems: "center" }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Спроси че-нить..."
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", borderRadius: "8px", padding: "8px 12px", color: "#fff", fontSize: "0.85rem", outline: "none" }}
              />
              <button 
                onClick={handleSendMessage}
                disabled={isTyping || !inputValue.trim()}
                style={{ background: inputValue.trim() && !isTyping ? "var(--gradient-blue)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: inputValue.trim() && !isTyping ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}
              >
                <Send size={16} color={inputValue.trim() && !isTyping ? "#fff" : "rgba(255,255,255,0.3)"} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
