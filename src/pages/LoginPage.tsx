import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const name = email.split("@")[0] || "Fraud Analyst";
    const initials = name.slice(0, 2).toUpperCase();
    setTimeout(() => {
      setUser({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: email || "analyst@coherenceiq.io",
        role: "Fraud Analyst",
        initials,
      });
      navigate("/dashboard");
    }, 450);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas-50">
      {/* Left: form */}
      <div className="flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-2.5 mb-10">
            <span className="grid place-items-center w-10 h-10 rounded-md bg-accent-500 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path
                  d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-semibold text-canvas-900 text-lg tracking-tight">
              Coherence<span className="text-accent-500">IQ</span>
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-canvas-900 tracking-tight">
            Sign in to your workspace
          </h1>
          <p className="text-sm text-canvas-500 mt-1.5 mb-8">
            Fraud Detection Pipeline Studio — secure access for analysts.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-canvas-600 mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@coherenceiq.io"
                className="input"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-canvas-600">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-accent-600 hover:text-accent-700 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="text-xs text-canvas-400 mt-6 text-center">
            Demo build — any credentials will sign you in.
          </p>
        </motion.div>
      </div>

      {/* Right: abstract fraud-themed illustration */}
      <div className="hidden lg:flex items-center justify-center bg-white border-l border-canvas-200 relative overflow-hidden">
        <FraudIllustration />
      </div>
    </div>
  );
}

function FraudIllustration() {
  const nodes = [
    { x: 80, y: 90, r: 14 },
    { x: 220, y: 60, r: 10 },
    { x: 360, y: 120, r: 18 },
    { x: 140, y: 220, r: 12 },
    { x: 300, y: 260, r: 16 },
    { x: 440, y: 200, r: 10 },
    { x: 200, y: 360, r: 14 },
    { x: 380, y: 340, r: 12 },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 4],
    [1, 4],
    [2, 5],
    [4, 5],
    [3, 6],
    [4, 6],
    [4, 7],
    [5, 7],
    [6, 7],
  ];
  const flagged = new Set([2, 4, 7]);

  return (
    <div className="relative w-full h-full grid place-items-center p-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        <svg viewBox="0 0 520 440" className="w-[480px] h-[400px]">
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M32 0H0V32"
                fill="none"
                stroke="#E5E8ED"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="520" height="440" fill="url(#grid)" rx="12" />

          {edges.map(([a, b], i) => (
            <motion.line
              key={i}
              x1={nodes[a].x}
              y1={nodes[a].y}
              x2={nodes[b].x}
              y2={nodes[b].y}
              stroke={flagged.has(a) || flagged.has(b) ? "#2E5AAC" : "#D3D8E0"}
              strokeWidth={flagged.has(a) || flagged.has(b) ? 2 : 1.2}
              strokeDasharray={flagged.has(a) || flagged.has(b) ? "4 4" : "0"}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1 * i }}
            />
          ))}

          {nodes.map((n, i) => {
            const isFlagged = flagged.has(i);
            return (
              <motion.g
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                  delay: 0.2 + i * 0.06,
                }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              >
                {isFlagged && (
                  <motion.circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r + 6}
                    fill="none"
                    stroke="#2E5AAC"
                    strokeWidth="1.5"
                    opacity="0.5"
                    animate={{ r: [n.r + 6, n.r + 12, n.r + 6] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.2,
                    }}
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={isFlagged ? "#2E5AAC" : "#F1F3F6"}
                  stroke={isFlagged ? "#2E5AAC" : "#A9B0BD"}
                  strokeWidth="1.5"
                />
                {isFlagged && (
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#fff"
                    fontWeight="700"
                  >
                    !
                  </text>
                )}
              </motion.g>
            );
          })}
        </svg>

        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-center w-full">
          <p className="text-xs font-medium text-canvas-500 tracking-wide uppercase">
            Entity Network Analysis
          </p>
          <p className="text-[11px] text-canvas-400 mt-1">
            Flagged nodes indicate detected anomaly clusters
          </p>
        </div>
      </motion.div>
    </div>
  );
}
