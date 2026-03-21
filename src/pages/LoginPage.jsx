import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Eye, EyeOff } from "lucide-react"
import "./LoginPage.css"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setIsLoading(true)

    try {
      const result = await login(email, password)

      if (result.success) {
        if (rememberMe) {
          localStorage.setItem("rememberMe", "true")
        }
        navigate("/")
      } else {
        setErrorMsg(result.error || "Error al iniciar sesión")
      }
    } catch (err) {
      setErrorMsg("Error inesperado al iniciar sesión")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">

        <h1 className="login-title">GestionPRO</h1>
        <p className="login-subtitle">Accede a tu cuenta</p>

        <form className="login-form" onSubmit={handleSubmit}>

          {errorMsg && (
            <div className="error-box">{errorMsg}</div>
          )}

          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>

            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Mantener sesión iniciada
            </label>

          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? "Iniciando..." : "Iniciar sesión"}
          </button>

          <p className="signup">
            ¿No tienes cuenta? <span>Solicita acceso</span>
          </p>

        </form>
      </div>
    </div>
  )
}

/*Usuario prueba: usuario.prueba@gmail.com pass: root*/