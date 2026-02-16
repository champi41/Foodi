import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../api/firebase";
import "./Login.css"; // Ahora creamos este CSS

export const Login = ({ slug }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Al loguearse, el useEffect de App.jsx detectará al usuario
      // y te redirigirá automáticamente a /admin
    } catch (err) {
      setError("Credenciales incorrectas o usuario no autorizado.");
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Aquí usamos el slug para dar contexto */}
        <h1>Panel de {slug.toUpperCase()}</h1>
        <p>Introduce tus credenciales para administrar tu local</p>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@local.com"
              required
            />
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-login">
            Entrar al Panel
          </button>
        </form>
      </div>
    </div>
  );
};
