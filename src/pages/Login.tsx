import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login({ phone, password });
      navigate("/shop");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h2>Login</h2>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <div style={{ marginBottom: 12 }}>
          <label>Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        <button type="submit" style={{ width: "100%" }}>
          Login
        </button>

        <p style={{ marginTop: 12 }}>
          No account? <Link to="/signup">Sign up</Link>
        </p>

        <p>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </form>
    </div>
  );
}
