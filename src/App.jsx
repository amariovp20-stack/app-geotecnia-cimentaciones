import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import "./App.css";

function App() {
  const [tipoCimentacion, setTipoCimentacion] = useState("zapata");

  const [B, setB] = useState(2.5);
  const [L, setL] = useState(2.0);
  const [Df, setDf] = useState(1.5);
  const [q, setQ] = useState(180);
  const [limite, setLimite] = useState(25);
  const [tiempo, setTiempo] = useState(10);

  const [nx, setNx] = useState(2);
  const [ny, setNy] = useState(2);
  const [sx, setSx] = useState(0.8);
  const [sy, setSy] = useState(0.8);

  const [metodoCapacidad, setMetodoCapacidad] = useState("terzaghi");
  const [modoTension, setModoTension] = useState("calculada");
  const [qManual, setQManual] = useState(180);

  const [phi, setPhi] = useState(30);
  const [cohesion, setCohesion] = useState(0);
  const [gamma, setGamma] = useState(18);
  const [fs, setFs] = useState(3);
  const [cargaDiseno, setCargaDiseno] = useState(900);

  const [estratos, setEstratos] = useState([
    {
      nombre: "Estrato 1",
      espesor: 2,
      Es: 10000,
      nu: 0.3,
      Cc: 0.25,
      e0: 0.8,
      sigma0: 40,
      Cv: 0.001,
      modelo: "ambos",
    },
    {
      nombre: "Estrato 2",
      espesor: 3,
      Es: 15000,
      nu: 0.3,
      Cc: 0.2,
      e0: 0.7,
      sigma0: 70,
      Cv: 0.0012,
      modelo: "ambos",
    },
    {
      nombre: "Estrato 3",
      espesor: 4,
      Es: 25000,
      nu: 0.28,
      Cc: 0.1,
      e0: 0.55,
      sigma0: 110,
      Cv: 0.002,
      modelo: "inmediato",
    },
  ]);

  const actualizar = (i, campo, valor) => {
    const copia = [...estratos];
    copia[i][campo] =
      campo === "nombre" || campo === "modelo" ? valor : Number(valor);
    setEstratos(copia);
  };

  const dimensionesEquivalentes = useMemo(() => {
    const b = Number(B);
    const l = Number(L);

    if (tipoCimentacion !== "grupo") {
      return {
        Beq: b,
        Leq: l,
        area: b * l,
        descripcion: "Cimentación individual",
      };
    }

    const nX = Math.max(Number(nx), 1);
    const nY = Math.max(Number(ny), 1);
    const sX = Number(sx);
    const sY = Number(sy);

    const Beq = nX * b + (nX - 1) * sX;
    const Leq = nY * l + (nY - 1) * sY;

    return {
      Beq,
      Leq,
      area: Beq * Leq,
      descripcion: `Grupo ${nX} x ${nY}`,
    };
  }, [tipoCimentacion, B, L, nx, ny, sx, sy]);

  const factoresCapacidad = useMemo(() => {
    const phirad = (Number(phi) * Math.PI) / 180;

    const Nq =
      Math.exp(Math.PI * Math.tan(phirad)) *
      Math.pow(Math.tan(Math.PI / 4 + phirad / 2), 2);

    const Nc =
      Math.abs(Math.tan(phirad)) < 1e-6 ? 5.7 : (Nq - 1) / Math.tan(phirad);

    const Ngamma = 2 * (Nq + 1) * Math.tan(phirad);

    return { Nq, Nc, Ngamma };
  }, [phi]);

  const capacidadPortante = useMemo(() => {
    const b = dimensionesEquivalentes.Beq;
    const l = dimensionesEquivalentes.Leq;
    const df = Number(Df);
    const c = Number(cohesion);
    const g = Number(gamma);
    const { Nq, Nc, Ngamma } = factoresCapacidad;

    const relacionBL = b / Math.max(l, 0.001);

    const scTerzaghi = 1;
    const sqTerzaghi = 1;
    const sgTerzaghi = 1;

    const scMeyerhof = 1 + 0.2 * relacionBL;
    const sqMeyerhof = 1 + 0.1 * relacionBL;
    const sgMeyerhof = Math.max(0.6, 1 - 0.4 * relacionBL);

    const scHansen = 1 + (Nq / Math.max(Nc, 0.001)) * relacionBL;
    const sqHansen = 1 + relacionBL * Math.tan((Number(phi) * Math.PI) / 180);
    const sgHansen = Math.max(0.6, 1 - 0.4 * relacionBL);

    const qultTerzaghi =
      c * Nc * scTerzaghi +
      g * df * Nq * sqTerzaghi +
      0.5 * g * b * Ngamma * sgTerzaghi;

    const qultMeyerhof =
      c * Nc * scMeyerhof +
      g * df * Nq * sqMeyerhof +
      0.5 * g * b * Ngamma * sgMeyerhof;

    const qultHansen =
      c * Nc * scHansen +
      g * df * Nq * sqHansen +
      0.5 * g * b * Ngamma * sgHansen;

    const qultSeleccionada =
      metodoCapacidad === "meyerhof"
        ? qultMeyerhof
        : metodoCapacidad === "hansen"
        ? qultHansen
        : qultTerzaghi;

    const qadmisible = qultSeleccionada / Math.max(Number(fs), 1);
    const qUsada = modoTension === "manual" ? Number(qManual) : Number(q);
    const relacion = qUsada / Math.max(qadmisible, 0.0001);
    const areaReq = Number(cargaDiseno) / Math.max(qadmisible, 0.0001);
    const ladoEq = Math.sqrt(Math.max(areaReq, 0));

    let estado = "ACEPTABLE";
    if (relacion > 1 && relacion <= 1.2) estado = "ADVERTENCIA";
    if (relacion > 1.2) estado = "CRÍTICO";

    return {
      Nq,
      Nc,
      Ngamma,
      qultTerzaghi,
      qultMeyerhof,
      qultHansen,
      qultSeleccionada,
      qadmisible,
      qUsada,
      relacion,
      areaReq,
      ladoEq,
      estado,
    };
  }, [
    dimensionesEquivalentes,
    Df,
    phi,
    cohesion,
    gamma,
    fs,
    q,
    qManual,
    modoTension,
    cargaDiseno,
    factoresCapacidad,
    metodoCapacidad,
  ]);

  const sigma21 = (qv, bv, lv, z) => {
    return qv * (bv * lv) / ((bv + z) * (lv + z));
  };

  const sigmaB = (qv, bv, lv, z) => {
    return qv / Math.pow(1 + z / Math.max(bv, 0.001), 2);
  };

  const calcularResultados = (metodo) => {
    const b = dimensionesEquivalentes.Beq;
    const l = dimensionesEquivalentes.Leq;
    const qn = capacidadPortante.qUsada;
    const df = Number(Df);

    let Si = 0;
    let Sc = 0;
    let z = 0;
    const detalle = [];

    estratos.forEach((e) => {
      const h = Number(e.espesor);
      const zm = z + h / 2;
      const dz = Math.max(zm - df, 0.001);

      const delta =
        metodo === "2:1"
          ? sigma21(qn, b, l, dz)
          : sigmaB(qn, b, l, dz);

      const SiEstrato =
        e.modelo === "consolidacion"
          ? 0
          : (delta * b * (1 - Math.pow(Number(e.nu), 2)) / Number(e.Es)) *
            (h / Math.max(b, 0.5));

      const ScEstrato =
        e.modelo === "inmediato"
          ? 0
          : (Number(e.Cc) / (1 + Number(e.e0))) *
            h *
            Math.log10(
              (Number(e.sigma0) + delta) / Math.max(Number(e.sigma0), 1)
            );

      Si += Math.max(SiEstrato, 0);
      Sc += Math.max(ScEstrato, 0);

      detalle.push({
        nombre: e.nombre,
        z: Number(zm.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        Si: Number(SiEstrato.toFixed(5)),
        Sc: Number(ScEstrato.toFixed(5)),
      });

      z += h;
    });

    return {
      Si,
      Sc,
      STotal: Si + Sc,
      detalle,
    };
  };

  const resultados21 = useMemo(() => {
    return calcularResultados("2:1");
  }, [dimensionesEquivalentes, Df, capacidadPortante.qUsada, estratos]);

  const resultadosB = useMemo(() => {
    return calcularResultados("Boussinesq");
  }, [dimensionesEquivalentes, Df, capacidadPortante.qUsada, estratos]);

  const estado21 = useMemo(() => {
    const s = resultados21.STotal * 1000;
    if (s <= Number(limite)) return "ACEPTABLE";
    if (s <= Number(limite) * 1.5) return "ADVERTENCIA";
    return "CRÍTICO";
  }, [resultados21, limite]);

  const estadoB = useMemo(() => {
    const s = resultadosB.STotal * 1000;
    if (s <= Number(limite)) return "ACEPTABLE";
    if (s <= Number(limite) * 1.5) return "ADVERTENCIA";
    return "CRÍTICO";
  }, [resultadosB, limite]);

  const bulbo = useMemo(() => {
    const arr = [];
    for (let z = 0; z <= 10; z += 0.5) {
      arr.push({
        z: Number(z.toFixed(2)),
        m21: Number(
          sigma21(
            capacidadPortante.qUsada,
            dimensionesEquivalentes.Beq,
            dimensionesEquivalentes.Leq,
            Math.max(z, 0.001)
          ).toFixed(2)
        ),
        mb: Number(
          sigmaB(
            capacidadPortante.qUsada,
            dimensionesEquivalentes.Beq,
            dimensionesEquivalentes.Leq,
            Math.max(z, 0.001)
          ).toFixed(2)
        ),
      });
    }
    return arr;
  }, [capacidadPortante.qUsada, dimensionesEquivalentes]);

  const tiempoData = useMemo(() => {
    const arr = [];
    const tiempoMax = Math.max(Number(tiempo), 0.5);

    for (let t = 0; t <= tiempoMax; t += tiempoMax / 20) {
      arr.push({
        t: Number(t.toFixed(2)),
        s21: Number(
          (
            resultados21.Si * 1000 +
            resultados21.Sc * 1000 * (t / tiempoMax)
          ).toFixed(2)
        ),
        sB: Number(
          (
            resultadosB.Si * 1000 +
            resultadosB.Sc * 1000 * (t / tiempoMax)
          ).toFixed(2)
        ),
      });
    }

    return arr;
  }, [resultados21, resultadosB, tiempo]);

  const recomendaciones = useMemo(() => {
    const lista = [];

    if (capacidadPortante.relacion <= 1) {
      lista.push(
        "La tensión aplicada se encuentra dentro de la tensión admisible del suelo."
      );
    } else {
      lista.push(
        "La tensión aplicada supera la tensión admisible. Se recomienda aumentar el área de cimentación o cambiar la solución."
      );
    }

    if (
      resultados21.STotal * 1000 > Number(limite) ||
      resultadosB.STotal * 1000 > Number(limite)
    ) {
      lista.push(
        "El asentamiento supera el límite admisible en al menos uno de los métodos. Se recomienda revisar dimensiones, presión aplicada o mejora del terreno."
      );
    } else {
      lista.push("El asentamiento calculado está dentro del rango admisible.");
    }

    if (tipoCimentacion === "grupo") {
      lista.push(
        "Para grupos de zapatas, conviene revisar la interacción entre elementos y el espaciamiento adoptado."
      );
    }

    lista.push(
      "Se recomienda contrastar estos resultados con parámetros geotécnicos obtenidos en laboratorio y normativa aplicable."
    );

    return lista;
  }, [capacidadPortante, resultados21, resultadosB, limite, tipoCimentacion]);

  const obtenerClaseEstado = (estado) => {
    if (estado === "ACEPTABLE") return "result-ok";
    if (estado === "ADVERTENCIA") return "result-warn";
    return "result-bad";
  };

  const exportarPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Reporte de Asentamientos y Capacidad Portante", 14, 16);

    autoTable(doc, {
      startY: 24,
      head: [["Parámetro", "Valor"]],
      body: [
        ["Tipo de cimentación", tipoCimentacion],
        ["Método capacidad", metodoCapacidad],
        ["Modo tensión", modoTension],
        ["q usada", `${capacidadPortante.qUsada.toFixed(2)} kPa`],
        ["B equivalente", `${dimensionesEquivalentes.Beq.toFixed(2)} m`],
        ["L equivalente", `${dimensionesEquivalentes.Leq.toFixed(2)} m`],
        ["Área equivalente", `${dimensionesEquivalentes.area.toFixed(2)} m²`],
        ["q_ult Terzaghi", `${capacidadPortante.qultTerzaghi.toFixed(2)} kPa`],
        ["q_ult Meyerhof", `${capacidadPortante.qultMeyerhof.toFixed(2)} kPa`],
        ["q_ult Hansen", `${capacidadPortante.qultHansen.toFixed(2)} kPa`],
        ["q admisible", `${capacidadPortante.qadmisible.toFixed(2)} kPa`],
        ["q/qadm", `${capacidadPortante.relacion.toFixed(3)}`],
      ],
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [
        ["Método", "S inmediato (mm)", "S consolidación (mm)", "S total (mm)", "Estado"],
      ],
      body: [
        [
          "2:1",
          (resultados21.Si * 1000).toFixed(2),
          (resultados21.Sc * 1000).toFixed(2),
          (resultados21.STotal * 1000).toFixed(2),
          estado21,
        ],
        [
          "Boussinesq",
          (resultadosB.Si * 1000).toFixed(2),
          (resultadosB.Sc * 1000).toFixed(2),
          (resultadosB.STotal * 1000).toFixed(2),
          estadoB,
        ],
      ],
    });

    doc.save("reporte_capacidad_portante.pdf");
  };

  return (
    <div className="app-container">
      <h1 className="main-title">Calculadora de Asentamientos</h1>
      <p className="subtitle">
        Cimentaciones superficiales con comparación de métodos, tensión manual o
        calculada y capacidad portante.
      </p>

      <div className="card section">
        <h2>Datos generales</h2>
        <div className="grid-3">
          <div>
            <label>Tipo de cimentación</label>
            <select
              value={tipoCimentacion}
              onChange={(e) => setTipoCimentacion(e.target.value)}
            >
              <option value="zapata">Zapata aislada</option>
              <option value="grupo">Grupo de zapatas</option>
              <option value="losa">Losa</option>
            </select>
          </div>

          <div>
            <label>B (m)</label>
            <input type="number" value={B} onChange={(e) => setB(e.target.value)} />
          </div>

          <div>
            <label>L (m)</label>
            <input type="number" value={L} onChange={(e) => setL(e.target.value)} />
          </div>

          <div>
            <label>Df (m)</label>
            <input type="number" value={Df} onChange={(e) => setDf(e.target.value)} />
          </div>

          <div>
            <label>q calculada (kPa)</label>
            <input type="number" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div>
            <label>Límite de asentamiento (mm)</label>
            <input
              type="number"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </div>

          <div>
            <label>Tiempo (años)</label>
            <input
              type="number"
              value={tiempo}
              onChange={(e) => setTiempo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {tipoCimentacion === "grupo" && (
        <div className="card section">
          <h2>Configuración del grupo de zapatas</h2>
          <div className="grid-4">
            <div>
              <label>Número de zapatas en X</label>
              <input type="number" value={nx} onChange={(e) => setNx(e.target.value)} />
            </div>

            <div>
              <label>Número de zapatas en Y</label>
              <input type="number" value={ny} onChange={(e) => setNy(e.target.value)} />
            </div>

            <div>
              <label>Separación Sx (m)</label>
              <input type="number" value={sx} onChange={(e) => setSx(e.target.value)} />
            </div>

            <div>
              <label>Separación Sy (m)</label>
              <input type="number" value={sy} onChange={(e) => setSy(e.target.value)} />
            </div>
          </div>

          <div className="mini-cards" style={{ marginTop: 20 }}>
            <div className="mini-card">
              <h4>B equivalente</h4>
              <p>{dimensionesEquivalentes.Beq.toFixed(2)} m</p>
            </div>
            <div className="mini-card">
              <h4>L equivalente</h4>
              <p>{dimensionesEquivalentes.Leq.toFixed(2)} m</p>
            </div>
            <div className="mini-card">
              <h4>Área equivalente</h4>
              <p>{dimensionesEquivalentes.area.toFixed(2)} m²</p>
            </div>
            <div className="mini-card">
              <h4>Descripción</h4>
              <p style={{ fontSize: 18 }}>{dimensionesEquivalentes.descripcion}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card section">
        <h2>Capacidad portante y tensión usada</h2>
        <div className="grid-4">
          <div>
            <label>Método de capacidad portante</label>
            <select
              value={metodoCapacidad}
              onChange={(e) => setMetodoCapacidad(e.target.value)}
            >
              <option value="terzaghi">Terzaghi</option>
              <option value="meyerhof">Meyerhof</option>
              <option value="hansen">Hansen</option>
            </select>
          </div>

          <div>
            <label>Modo de tensión</label>
            <select value={modoTension} onChange={(e) => setModoTension(e.target.value)}>
              <option value="calculada">Usar q calculada</option>
              <option value="manual">Ingresar q manual</option>
            </select>
          </div>

          <div>
            <label>φ (grados)</label>
            <input type="number" value={phi} onChange={(e) => setPhi(e.target.value)} />
          </div>

          <div>
            <label>c (kPa)</label>
            <input
              type="number"
              value={cohesion}
              onChange={(e) => setCohesion(e.target.value)}
            />
          </div>

          <div>
            <label>γ (kN/m³)</label>
            <input type="number" value={gamma} onChange={(e) => setGamma(e.target.value)} />
          </div>

          <div>
            <label>FS</label>
            <input type="number" value={fs} onChange={(e) => setFs(e.target.value)} />
          </div>

          <div>
            <label>Carga de diseño (kN)</label>
            <input
              type="number"
              value={cargaDiseno}
              onChange={(e) => setCargaDiseno(e.target.value)}
            />
          </div>

          {modoTension === "manual" && (
            <div>
              <label>Tensión manual q (kPa)</label>
              <input
                type="number"
                value={qManual}
                onChange={(e) => setQManual(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mini-cards" style={{ marginTop: 20 }}>
          <div className="mini-card">
            <h4>q admisible</h4>
            <p>{capacidadPortante.qadmisible.toFixed(2)}</p>
          </div>
          <div className="mini-card">
            <h4>q / qadm</h4>
            <p>{capacidadPortante.relacion.toFixed(3)}</p>
          </div>
          <div className="mini-card">
            <h4>Área requerida</h4>
            <p>{capacidadPortante.areaReq.toFixed(2)}</p>
          </div>
          <div className="mini-card">
            <h4>Lado equivalente</h4>
            <p>{capacidadPortante.ladoEq.toFixed(2)}</p>
          </div>
        </div>

        <div className={obtenerClaseEstado(capacidadPortante.estado)} style={{ marginTop: 20 }}>
          <strong>Estado de capacidad portante:</strong> {capacidadPortante.estado}
        </div>

        <div style={{ marginTop: 20 }}>
          <p><b>Nq:</b> {capacidadPortante.Nq.toFixed(3)}</p>
          <p><b>Nc:</b> {capacidadPortante.Nc.toFixed(3)}</p>
          <p><b>Nγ:</b> {capacidadPortante.Ngamma.toFixed(3)}</p>
          <p><b>q_ult Terzaghi:</b> {capacidadPortante.qultTerzaghi.toFixed(2)} kPa</p>
          <p><b>q_ult Meyerhof:</b> {capacidadPortante.qultMeyerhof.toFixed(2)} kPa</p>
          <p><b>q_ult Hansen:</b> {capacidadPortante.qultHansen.toFixed(2)} kPa</p>
          <p><b>q usada en cálculos:</b> {capacidadPortante.qUsada.toFixed(2)} kPa</p>
        </div>
      </div>

      <div className="card section">
        <h2>Estratos</h2>

        {estratos.map((e, i) => (
          <div key={i} className="card section" style={{ marginBottom: 16 }}>
            <h3>{e.nombre}</h3>

            <div className="grid-4">
              <div>
                <label>Nombre</label>
                <input
                  type="text"
                  value={e.nombre}
                  onChange={(ev) => actualizar(i, "nombre", ev.target.value)}
                />
              </div>

              <div>
                <label>Espesor (m)</label>
                <input
                  type="number"
                  value={e.espesor}
                  onChange={(ev) => actualizar(i, "espesor", ev.target.value)}
                />
              </div>

              <div>
                <label>Es (kPa)</label>
                <input
                  type="number"
                  value={e.Es}
                  onChange={(ev) => actualizar(i, "Es", ev.target.value)}
                />
              </div>

              <div>
                <label>ν</label>
                <input
                  type="number"
                  value={e.nu}
                  onChange={(ev) => actualizar(i, "nu", ev.target.value)}
                />
              </div>

              <div>
                <label>Cc</label>
                <input
                  type="number"
                  value={e.Cc}
                  onChange={(ev) => actualizar(i, "Cc", ev.target.value)}
                />
              </div>

              <div>
                <label>e0</label>
                <input
                  type="number"
                  value={e.e0}
                  onChange={(ev) => actualizar(i, "e0", ev.target.value)}
                />
              </div>

              <div>
                <label>σ'0</label>
                <input
                  type="number"
                  value={e.sigma0}
                  onChange={(ev) => actualizar(i, "sigma0", ev.target.value)}
                />
              </div>

              <div>
                <label>Cv</label>
                <input
                  type="number"
                  value={e.Cv}
                  onChange={(ev) => actualizar(i, "Cv", ev.target.value)}
                />
              </div>

              <div>
                <label>Modelo</label>
                <select
                  value={e.modelo}
                  onChange={(ev) => actualizar(i, "modelo", ev.target.value)}
                >
                  <option value="inmediato">Solo inmediato</option>
                  <option value="consolidacion">Solo consolidación</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mini-cards section">
        <div className="mini-card">
          <h4>S total 2:1</h4>
          <p>{(resultados21.STotal * 1000).toFixed(2)} mm</p>
        </div>
        <div className="mini-card">
          <h4>S total Boussinesq</h4>
          <p>{(resultadosB.STotal * 1000).toFixed(2)} mm</p>
        </div>
        <div className="mini-card">
          <h4>Estado 2:1</h4>
          <p style={{ fontSize: 18 }}>{estado21}</p>
        </div>
        <div className="mini-card">
          <h4>Estado Boussinesq</h4>
          <p style={{ fontSize: 18 }}>{estadoB}</p>
        </div>
      </div>

      <div className={obtenerClaseEstado(estado21)} style={{ marginBottom: 12 }}>
        <strong>Control de asentamiento 2:1:</strong> {estado21}
      </div>

      <div className={obtenerClaseEstado(estadoB)} style={{ marginBottom: 24 }}>
        <strong>Control de asentamiento Boussinesq:</strong> {estadoB}
      </div>

      <div className="card section">
        <h2>Recomendaciones automáticas</h2>
        {recomendaciones.map((r, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            {i + 1}. {r}
          </div>
        ))}
      </div>

      <div className="section">
        <button onClick={exportarPDF}>Exportar PDF</button>
      </div>

      <div className="section">
        <h2>Bulbo de presiones</h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bulbo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="z" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area dataKey="m21" name="2:1" />
              <Area dataKey="mb" name="Boussinesq" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section">
        <h2>Asentamiento vs tiempo</h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tiempoData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="s21" name="2:1" />
              <Line dataKey="sB" name="Boussinesq" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;