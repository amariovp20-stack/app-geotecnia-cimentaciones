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
import Plot from "react-plotly.js";
import "./App.css";

function App() {
  const [tabActiva, setTabActiva] = useState("general");

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

  const [factorForma, setFactorForma] = useState(1);
  const [factorProfundidad, setFactorProfundidad] = useState(1);

  const [t1Sec, setT1Sec] = useState(1);
  const [t2Sec, setT2Sec] = useState(10);

  const [metodo3D, setMetodo3D] = useState("2:1");

  const [estratos, setEstratos] = useState([
    {
      nombre: "Estrato 1",
      espesor: 2,
      Es: 10000,
      nu: 0.3,
      Cc: 0.25,
      Cr: 0.05,
      e0: 0.8,
      sigma0: 40,
      sigmaP: 80,
      Calpha: 0.01,
      modelo: "ambos",
    },
    {
      nombre: "Estrato 2",
      espesor: 3,
      Es: 15000,
      nu: 0.3,
      Cc: 0.2,
      Cr: 0.04,
      e0: 0.7,
      sigma0: 70,
      sigmaP: 120,
      Calpha: 0.008,
      modelo: "ambos",
    },
    {
      nombre: "Estrato 3",
      espesor: 4,
      Es: 25000,
      nu: 0.28,
      Cc: 0.1,
      Cr: 0.03,
      e0: 0.55,
      sigma0: 110,
      sigmaP: 160,
      Calpha: 0.005,
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

  const sigma21 = (qv, bv, lv, z) => qv * (bv * lv) / ((bv + z) * (lv + z));

  const sigmaB = (qv, bv, lv, z) =>
    qv / Math.pow(1 + z / Math.max(bv, 0.001), 2);

  const calcularAsentamientoInmediato = (delta, b, h, nu, Es) => {
    return (
      (delta * b * (1 - Math.pow(nu, 2)) / Math.max(Es, 0.0001)) *
      (h / Math.max(b, 0.5)) *
      Number(factorForma) *
      Number(factorProfundidad)
    );
  };

  const calcularConsolidacionPrimaria = (
    sigma0,
    sigmaP,
    delta,
    H,
    Cc,
    Cr,
    e0
  ) => {
    const sigmaFinal = sigma0 + delta;

    if (sigma0 >= sigmaP) {
      return (Cc / (1 + e0)) * H * Math.log10(sigmaFinal / Math.max(sigma0, 1));
    }

    if (sigmaFinal <= sigmaP) {
      return (Cr / (1 + e0)) * H * Math.log10(sigmaFinal / Math.max(sigma0, 1));
    }

    const parte1 =
      (Cr / (1 + e0)) * H * Math.log10(sigmaP / Math.max(sigma0, 1));
    const parte2 =
      (Cc / (1 + e0)) * H * Math.log10(sigmaFinal / Math.max(sigmaP, 1));

    return parte1 + parte2;
  };

  const calcularConsolidacionSecundaria = (H, Calpha, e0, t1, t2) => {
    if (t2 <= t1 || t1 <= 0) return 0;
    return (Calpha / (1 + e0)) * H * Math.log10(t2 / t1);
  };

  const calcularResultados = (metodo) => {
    const b = dimensionesEquivalentes.Beq;
    const l = dimensionesEquivalentes.Leq;
    const qn = capacidadPortante.qUsada;
    const df = Number(Df);

    let Si = 0;
    let ScPrim = 0;
    let ScSec = 0;
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
          : calcularAsentamientoInmediato(
              delta,
              b,
              h,
              Number(e.nu),
              Number(e.Es)
            );

      const ScPrimEstrato =
        e.modelo === "inmediato"
          ? 0
          : calcularConsolidacionPrimaria(
              Number(e.sigma0),
              Number(e.sigmaP),
              delta,
              h,
              Number(e.Cc),
              Number(e.Cr),
              Number(e.e0)
            );

      const ScSecEstrato =
        e.modelo === "inmediato"
          ? 0
          : calcularConsolidacionSecundaria(
              h,
              Number(e.Calpha),
              Number(e.e0),
              Number(t1Sec),
              Number(t2Sec)
            );

      Si += Math.max(SiEstrato, 0);
      ScPrim += Math.max(ScPrimEstrato, 0);
      ScSec += Math.max(ScSecEstrato, 0);

      detalle.push({
        nombre: e.nombre,
        z: Number(zm.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        Si: Number(SiEstrato.toFixed(5)),
        ScPrim: Number(ScPrimEstrato.toFixed(5)),
        ScSec: Number(ScSecEstrato.toFixed(5)),
      });

      z += h;
    });

    return {
      Si,
      ScPrim,
      ScSec,
      STotal: Si + ScPrim + ScSec,
      detalle,
    };
  };

  const resultados21 = useMemo(
    () => calcularResultados("2:1"),
    [
      dimensionesEquivalentes,
      Df,
      capacidadPortante.qUsada,
      estratos,
      factorForma,
      factorProfundidad,
      t1Sec,
      t2Sec,
    ]
  );

  const resultadosB = useMemo(
    () => calcularResultados("Boussinesq"),
    [
      dimensionesEquivalentes,
      Df,
      capacidadPortante.qUsada,
      estratos,
      factorForma,
      factorProfundidad,
      t1Sec,
      t2Sec,
    ]
  );

  const resultadosMetodo3D = metodo3D === "2:1" ? resultados21 : resultadosB;

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
            resultados21.ScPrim * 1000 * (t / tiempoMax) +
            resultados21.ScSec * 1000
          ).toFixed(2)
        ),
        sB: Number(
          (
            resultadosB.Si * 1000 +
            resultadosB.ScPrim * 1000 * (t / tiempoMax) +
            resultadosB.ScSec * 1000
          ).toFixed(2)
        ),
      });
    }

    return arr;
  }, [resultados21, resultadosB, tiempo]);

  const bulbo3D = useMemo(() => {
    const b = dimensionesEquivalentes.Beq;
    const l = dimensionesEquivalentes.Leq;
    const qn = capacidadPortante.qUsada;

    const nivelesProfundidad = 18;
    const puntosAngulo = 48;

    const x = [];
    const y = [];
    const z = [];
    const color = [];
    const texto = [];

    const zMax = Math.max(2.5 * Math.max(b, l), 6);

    for (let i = 0; i < nivelesProfundidad; i++) {
      const profundidad = (zMax * i) / (nivelesProfundidad - 1);

      const filaX = [];
      const filaY = [];
      const filaZ = [];
      const filaColor = [];
      const filaTexto = [];

      const sigmaCentro =
        metodo3D === "2:1"
          ? sigma21(qn, b, l, Math.max(profundidad, 0.001))
          : sigmaB(qn, b, l, Math.max(profundidad, 0.001));

      const factorProf = Math.exp(-1.15 * profundidad / Math.max(b, 0.001));
      const radioX = (b * 0.55) * factorProf + 0.12 * b;
      const radioY = (l * 0.55) * factorProf + 0.12 * l;

      for (let j = 0; j < puntosAngulo; j++) {
        const theta = (2 * Math.PI * j) / (puntosAngulo - 1);

        const xi = radioX * Math.cos(theta);
        const yi = radioY * Math.sin(theta);

        filaX.push(Number(xi.toFixed(3)));
        filaY.push(Number(yi.toFixed(3)));
        filaZ.push(Number(profundidad.toFixed(3)));
        filaColor.push(Number(sigmaCentro.toFixed(2)));
        filaTexto.push(
          `X: ${xi.toFixed(2)} m<br>` +
            `Y: ${yi.toFixed(2)} m<br>` +
            `Profundidad: ${profundidad.toFixed(2)} m<br>` +
            `Δσ: ${sigmaCentro.toFixed(2)} kPa<br>` +
            `Método: ${metodo3D}`
        );
      }

      x.push(filaX);
      y.push(filaY);
      z.push(filaZ);
      color.push(filaColor);
      texto.push(filaTexto);
    }

    return { x, y, z, color, texto };
  }, [dimensionesEquivalentes, capacidadPortante.qUsada, metodo3D]);

  const asentamiento3D = useMemo(() => {
    const b = dimensionesEquivalentes.Beq;
    const l = dimensionesEquivalentes.Leq;
    const sMax = Math.max(resultadosMetodo3D.STotal * 1000, 0.001);

    const nivelesProfundidad = 18;
    const puntosAngulo = 48;

    const x = [];
    const y = [];
    const z = [];
    const color = [];
    const texto = [];

    const zMax = Math.max(2.5 * Math.max(b, l), 6);

    for (let i = 0; i < nivelesProfundidad; i++) {
      const profundidad = (zMax * i) / (nivelesProfundidad - 1);

      const filaX = [];
      const filaY = [];
      const filaZ = [];
      const filaColor = [];
      const filaTexto = [];

      const factorProf = Math.exp(-1.1 * profundidad / Math.max(b, 0.001));
      const radioX = (b * 0.5) * factorProf + 0.1 * b;
      const radioY = (l * 0.5) * factorProf + 0.1 * l;

      const deformacionCentro =
        sMax * Math.exp(-1.25 * profundidad / Math.max(b, 0.001));

      for (let j = 0; j < puntosAngulo; j++) {
        const theta = (2 * Math.PI * j) / (puntosAngulo - 1);

        const xi = radioX * Math.cos(theta);
        const yi = radioY * Math.sin(theta);

        filaX.push(Number(xi.toFixed(3)));
        filaY.push(Number(yi.toFixed(3)));
        filaZ.push(Number(profundidad.toFixed(3)));
        filaColor.push(Number(deformacionCentro.toFixed(3)));
        filaTexto.push(
          `X: ${xi.toFixed(2)} m<br>` +
            `Y: ${yi.toFixed(2)} m<br>` +
            `Profundidad: ${profundidad.toFixed(2)} m<br>` +
            `Deformación: ${deformacionCentro.toFixed(3)} mm<br>` +
            `Método: ${metodo3D}`
        );
      }

      x.push(filaX);
      y.push(filaY);
      z.push(filaZ);
      color.push(filaColor);
      texto.push(filaTexto);
    }

    return { x, y, z, color, texto };
  }, [dimensionesEquivalentes, resultadosMetodo3D, metodo3D]);

  const trazasCimentacion3D = useMemo(() => {
    const trazas = [];
    const b = Number(B);
    const l = Number(L);

    const crearRectanguloRelleno = (
      cx,
      cy,
      ancho,
      largo,
      nombre,
      colorLinea = "#111827",
      colorRelleno = "rgba(37,99,235,0.35)"
    ) => {
      const x1 = cx - ancho / 2;
      const x2 = cx + ancho / 2;
      const y1 = cy - largo / 2;
      const y2 = cy + largo / 2;

      const placa = {
        type: "mesh3d",
        x: [x1, x2, x2, x1],
        y: [y1, y1, y2, y2],
        z: [0, 0, 0, 0],
        i: [0, 0],
        j: [1, 2],
        k: [2, 3],
        opacity: 0.45,
        color: colorRelleno,
        flatshading: true,
        hovertemplate:
          `${nombre}<br>` +
          `Centro X: ${cx.toFixed(2)} m<br>` +
          `Centro Y: ${cy.toFixed(2)} m<br>` +
          `Ancho: ${ancho.toFixed(2)} m<br>` +
          `Largo: ${largo.toFixed(2)} m<br>` +
          `Profundidad: 0.00 m<extra></extra>`,
        name: nombre,
        showlegend: false,
      };

      const borde = {
        type: "scatter3d",
        mode: "lines",
        x: [x1, x2, x2, x1, x1],
        y: [y1, y1, y2, y2, y1],
        z: [0, 0, 0, 0, 0],
        line: {
          color: colorLinea,
          width: 6,
        },
        hovertemplate:
          `${nombre}<br>` +
          `X: %{x:.2f} m<br>` +
          `Y: %{y:.2f} m<br>` +
          `Profundidad: 0.00 m<extra></extra>`,
        name: `${nombre} borde`,
        showlegend: false,
      };

      return [placa, borde];
    };

    if (tipoCimentacion === "grupo") {
      const nX = Math.max(Number(nx), 1);
      const nY = Math.max(Number(ny), 1);
      const sepX = Number(sx);
      const sepY = Number(sy);

      const anchoTotal = nX * b + (nX - 1) * sepX;
      const largoTotal = nY * l + (nY - 1) * sepY;

      const x0 = -anchoTotal / 2 + b / 2;
      const y0 = -largoTotal / 2 + l / 2;

      for (let ix = 0; ix < nX; ix++) {
        for (let iy = 0; iy < nY; iy++) {
          const cx = x0 + ix * (b + sepX);
          const cy = y0 + iy * (l + sepY);

          trazas.push(
            ...crearRectanguloRelleno(
              cx,
              cy,
              b,
              l,
              `Zapata ${ix + 1}-${iy + 1}`,
              "#111827",
              "rgba(37,99,235,0.35)"
            )
          );
        }
      }

      trazas.push({
        type: "scatter3d",
        mode: "lines",
        x: [
          -anchoTotal / 2,
          anchoTotal / 2,
          anchoTotal / 2,
          -anchoTotal / 2,
          -anchoTotal / 2,
        ],
        y: [
          -largoTotal / 2,
          -largoTotal / 2,
          largoTotal / 2,
          largoTotal / 2,
          -largoTotal / 2,
        ],
        z: [0, 0, 0, 0, 0],
        line: {
          color: "#dc2626",
          width: 4,
          dash: "dash",
        },
        hovertemplate:
          `Área equivalente del grupo<br>` +
          `X: %{x:.2f} m<br>` +
          `Y: %{y:.2f} m<br>` +
          `Profundidad: 0.00 m<extra></extra>`,
        name: "Área equivalente",
        showlegend: false,
      });
    } else {
      const nombre = tipoCimentacion === "losa" ? "Losa" : "Zapata";
      const colorRelleno =
        tipoCimentacion === "losa"
          ? "rgba(16,185,129,0.35)"
          : "rgba(37,99,235,0.35)";

      trazas.push(
        ...crearRectanguloRelleno(0, 0, b, l, nombre, "#111827", colorRelleno)
      );
    }

    return trazas;
  }, [tipoCimentacion, B, L, nx, ny, sx, sy]);

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
        "El asentamiento supera el límite admisible en al menos uno de los métodos."
      );
    } else {
      lista.push("El asentamiento calculado está dentro del rango admisible.");
    }

    if (resultados21.ScSec > 0 || resultadosB.ScSec > 0) {
      lista.push(
        "Existe componente de consolidación secundaria; conviene revisar el comportamiento a largo plazo."
      );
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
    doc.text("Reporte de Asentamientos Profesional", 14, 16);

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
        ["q admisible", `${capacidadPortante.qadmisible.toFixed(2)} kPa`],
        ["q/qadm", `${capacidadPortante.relacion.toFixed(3)}`],
      ],
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [
        [
          "Método",
          "S inmediato (mm)",
          "S primario (mm)",
          "S secundario (mm)",
          "S total (mm)",
          "Estado",
        ],
      ],
      body: [
        [
          "2:1",
          (resultados21.Si * 1000).toFixed(2),
          (resultados21.ScPrim * 1000).toFixed(2),
          (resultados21.ScSec * 1000).toFixed(2),
          (resultados21.STotal * 1000).toFixed(2),
          estado21,
        ],
        [
          "Boussinesq",
          (resultadosB.Si * 1000).toFixed(2),
          (resultadosB.ScPrim * 1000).toFixed(2),
          (resultadosB.ScSec * 1000).toFixed(2),
          (resultadosB.STotal * 1000).toFixed(2),
          estadoB,
        ],
      ],
    });

    doc.save("reporte_asentamientos_profesional.pdf");
  };

  return (
    <div className="app-pro">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-dot"></div>
          <div>
            <h2>GeoSoft</h2>
            <span>Cimentaciones superficiales</span>
          </div>
        </div>

        <button className={`tab-btn ${tabActiva === "general" ? "active" : ""}`} onClick={() => setTabActiva("general")}>
          Datos generales
        </button>
        <button className={`tab-btn ${tabActiva === "capacidad" ? "active" : ""}`} onClick={() => setTabActiva("capacidad")}>
          Capacidad portante
        </button>
        <button className={`tab-btn ${tabActiva === "estratos" ? "active" : ""}`} onClick={() => setTabActiva("estratos")}>
          Estratos
        </button>
        <button className={`tab-btn ${tabActiva === "asentamiento" ? "active" : ""}`} onClick={() => setTabActiva("asentamiento")}>
          Asentamientos
        </button>
        <button className={`tab-btn ${tabActiva === "resultados" ? "active" : ""}`} onClick={() => setTabActiva("resultados")}>
          Resultados
        </button>
        <button className={`tab-btn ${tabActiva === "graficos" ? "active" : ""}`} onClick={() => setTabActiva("graficos")}>
          Gráficos 2D
        </button>
        <button className={`tab-btn ${tabActiva === "graficos3d" ? "active" : ""}`} onClick={() => setTabActiva("graficos3d")}>
          Gráficos 3D
        </button>

        <div className="sidebar-footer">
          <button onClick={exportarPDF} className="primary-full">
            Exportar PDF
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="hero-panel">
          <div>
            <h1>Calculadora de Asentamientos</h1>
            <p>
              Módulo profesional con capacidad portante, asentamiento inmediato refinado,
              consolidación primaria, secundaria y visualización 3D.
            </p>
          </div>

          <div className="hero-badges">
            <span>2:1</span>
            <span>Boussinesq</span>
            <span>Terzaghi</span>
            <span>Meyerhof</span>
            <span>Hansen</span>
            <span>3D</span>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <small>q admisible</small>
            <strong>{capacidadPortante.qadmisible.toFixed(2)} kPa</strong>
          </div>
          <div className="stat-card">
            <small>q / qadm</small>
            <strong>{capacidadPortante.relacion.toFixed(3)}</strong>
          </div>
          <div className="stat-card">
            <small>S total 2:1</small>
            <strong>{(resultados21.STotal * 1000).toFixed(2)} mm</strong>
          </div>
          <div className="stat-card">
            <small>S total Boussinesq</small>
            <strong>{(resultadosB.STotal * 1000).toFixed(2)} mm</strong>
          </div>
        </div>

        {tabActiva === "general" && (
          <>
            <section className="panel">
              <h3>Datos generales</h3>
              <div className="grid3">
                <div>
                  <label>Tipo de cimentación</label>
                  <select value={tipoCimentacion} onChange={(e) => setTipoCimentacion(e.target.value)}>
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
                  <input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} />
                </div>
                <div>
                  <label>Tiempo (años)</label>
                  <input type="number" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
                </div>
              </div>
            </section>

            {tipoCimentacion === "grupo" && (
              <section className="panel">
                <h3>Configuración del grupo de zapatas</h3>
                <div className="grid4">
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

                <div className="chips-row">
                  <span className="chip">B eq: {dimensionesEquivalentes.Beq.toFixed(2)} m</span>
                  <span className="chip">L eq: {dimensionesEquivalentes.Leq.toFixed(2)} m</span>
                  <span className="chip">Área: {dimensionesEquivalentes.area.toFixed(2)} m²</span>
                  <span className="chip">{dimensionesEquivalentes.descripcion}</span>
                </div>
              </section>
            )}
          </>
        )}

        {tabActiva === "capacidad" && (
          <section className="panel">
            <h3>Capacidad portante</h3>
            <div className="grid4">
              <div>
                <label>Método de capacidad portante</label>
                <select value={metodoCapacidad} onChange={(e) => setMetodoCapacidad(e.target.value)}>
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
                <input type="number" value={cohesion} onChange={(e) => setCohesion(e.target.value)} />
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
                <input type="number" value={cargaDiseno} onChange={(e) => setCargaDiseno(e.target.value)} />
              </div>
              {modoTension === "manual" && (
                <div>
                  <label>Tensión manual q (kPa)</label>
                  <input type="number" value={qManual} onChange={(e) => setQManual(e.target.value)} />
                </div>
              )}
            </div>

            <div className="info-grid">
              <div className="info-card"><span>Nq</span><strong>{capacidadPortante.Nq.toFixed(3)}</strong></div>
              <div className="info-card"><span>Nc</span><strong>{capacidadPortante.Nc.toFixed(3)}</strong></div>
              <div className="info-card"><span>Nγ</span><strong>{capacidadPortante.Ngamma.toFixed(3)}</strong></div>
              <div className="info-card"><span>q usada</span><strong>{capacidadPortante.qUsada.toFixed(2)}</strong></div>
              <div className="info-card"><span>q ult Terzaghi</span><strong>{capacidadPortante.qultTerzaghi.toFixed(2)}</strong></div>
              <div className="info-card"><span>q ult Meyerhof</span><strong>{capacidadPortante.qultMeyerhof.toFixed(2)}</strong></div>
              <div className="info-card"><span>q ult Hansen</span><strong>{capacidadPortante.qultHansen.toFixed(2)}</strong></div>
              <div className="info-card"><span>Área requerida</span><strong>{capacidadPortante.areaReq.toFixed(2)}</strong></div>
            </div>

            <div className={obtenerClaseEstado(capacidadPortante.estado)}>
              <strong>Estado de capacidad portante:</strong> {capacidadPortante.estado}
            </div>
          </section>
        )}

        {tabActiva === "estratos" && (
          <section className="panel">
            <h3>Estratos</h3>
            {estratos.map((e, i) => (
              <div key={i} className="soil-card">
                <div className="soil-header">
                  <h4>{e.nombre}</h4>
                  <span>Estrato {i + 1}</span>
                </div>

                <div className="grid4">
                  <div>
                    <label>Nombre</label>
                    <input type="text" value={e.nombre} onChange={(ev) => actualizar(i, "nombre", ev.target.value)} />
                  </div>
                  <div>
                    <label>Espesor (m)</label>
                    <input type="number" value={e.espesor} onChange={(ev) => actualizar(i, "espesor", ev.target.value)} />
                  </div>
                  <div>
                    <label>Es (kPa)</label>
                    <input type="number" value={e.Es} onChange={(ev) => actualizar(i, "Es", ev.target.value)} />
                  </div>
                  <div>
                    <label>ν</label>
                    <input type="number" value={e.nu} onChange={(ev) => actualizar(i, "nu", ev.target.value)} />
                  </div>
                  <div>
                    <label>Cc</label>
                    <input type="number" value={e.Cc} onChange={(ev) => actualizar(i, "Cc", ev.target.value)} />
                  </div>
                  <div>
                    <label>Cr</label>
                    <input type="number" value={e.Cr} onChange={(ev) => actualizar(i, "Cr", ev.target.value)} />
                  </div>
                  <div>
                    <label>e0</label>
                    <input type="number" value={e.e0} onChange={(ev) => actualizar(i, "e0", ev.target.value)} />
                  </div>
                  <div>
                    <label>σ'0</label>
                    <input type="number" value={e.sigma0} onChange={(ev) => actualizar(i, "sigma0", ev.target.value)} />
                  </div>
                  <div>
                    <label>σ'p</label>
                    <input type="number" value={e.sigmaP} onChange={(ev) => actualizar(i, "sigmaP", ev.target.value)} />
                  </div>
                  <div>
                    <label>Cα</label>
                    <input type="number" value={e.Calpha} onChange={(ev) => actualizar(i, "Calpha", ev.target.value)} />
                  </div>
                  <div>
                    <label>Modelo</label>
                    <select value={e.modelo} onChange={(ev) => actualizar(i, "modelo", ev.target.value)}>
                      <option value="inmediato">Solo inmediato</option>
                      <option value="consolidacion">Solo consolidación</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {tabActiva === "asentamiento" && (
          <section className="panel">
            <h3>Parámetros de asentamiento</h3>
            <div className="grid4">
              <div>
                <label>Factor de forma</label>
                <input type="number" value={factorForma} onChange={(e) => setFactorForma(e.target.value)} />
              </div>
              <div>
                <label>Factor de profundidad</label>
                <input type="number" value={factorProfundidad} onChange={(e) => setFactorProfundidad(e.target.value)} />
              </div>
              <div>
                <label>t1 secundaria</label>
                <input type="number" value={t1Sec} onChange={(e) => setT1Sec(e.target.value)} />
              </div>
              <div>
                <label>t2 secundaria</label>
                <input type="number" value={t2Sec} onChange={(e) => setT2Sec(e.target.value)} />
              </div>
            </div>

            <div className="info-grid">
              <div className="info-card"><span>S inmediata 2:1</span><strong>{(resultados21.Si * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S primaria 2:1</span><strong>{(resultados21.ScPrim * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S secundaria 2:1</span><strong>{(resultados21.ScSec * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S total 2:1</span><strong>{(resultados21.STotal * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S inmediata Bouss.</span><strong>{(resultadosB.Si * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S primaria Bouss.</span><strong>{(resultadosB.ScPrim * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S secundaria Bouss.</span><strong>{(resultadosB.ScSec * 1000).toFixed(2)} mm</strong></div>
              <div className="info-card"><span>S total Bouss.</span><strong>{(resultadosB.STotal * 1000).toFixed(2)} mm</strong></div>
            </div>

            <div className={obtenerClaseEstado(estado21)}>
              <strong>Control 2:1:</strong> {estado21}
            </div>

            <div className={obtenerClaseEstado(estadoB)}>
              <strong>Control Boussinesq:</strong> {estadoB}
            </div>
          </section>
        )}

        {tabActiva === "resultados" && (
          <>
            <section className="panel">
              <h3>Resumen de resultados</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <small>S total 2:1</small>
                  <strong>{(resultados21.STotal * 1000).toFixed(2)} mm</strong>
                </div>
                <div className="stat-card">
                  <small>S total Boussinesq</small>
                  <strong>{(resultadosB.STotal * 1000).toFixed(2)} mm</strong>
                </div>
                <div className="stat-card">
                  <small>S secundaria 2:1</small>
                  <strong>{(resultados21.ScSec * 1000).toFixed(2)} mm</strong>
                </div>
                <div className="stat-card">
                  <small>S secundaria Bouss.</small>
                  <strong>{(resultadosB.ScSec * 1000).toFixed(2)} mm</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Recomendaciones automáticas</h3>
              <div className="recommendation-list">
                {recomendaciones.map((r, i) => (
                  <div key={i} className="recommendation-item">
                    <span>{i + 1}</span>
                    <p>{r}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tabActiva === "graficos" && (
          <>
            <section className="panel">
              <h3>Bulbo de presiones</h3>
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
            </section>

            <section className="panel">
              <h3>Asentamiento vs tiempo</h3>
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
            </section>
          </>
        )}

        {tabActiva === "graficos3d" && (
          <>
            <section className="panel">
              <h3>Configuración 3D</h3>
              <div className="grid3">
                <div>
                  <label>Método para visualización 3D</label>
                  <select value={metodo3D} onChange={(e) => setMetodo3D(e.target.value)}>
                    <option value="2:1">2:1</option>
                    <option value="boussinesq">Boussinesq</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>Bulbo de presiones 3D</h3>
              <div className="chart-box chart-box-3d">
                <Plot
                  data={[
                    {
                      type: "surface",
                      x: bulbo3D.x,
                      y: bulbo3D.y,
                      z: bulbo3D.z,
                      surfacecolor: bulbo3D.color,
                      text: bulbo3D.texto,
                      hovertemplate: "%{text}<extra></extra>",
                      colorscale: "Jet",
                      showscale: true,
                      contours: {
                        z: {
                          show: true,
                          usecolormap: true,
                          highlightcolor: "#111827",
                          project: { z: true },
                        },
                      },
                    },
                    ...trazasCimentacion3D,
                  ]}
                  layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, b: 0, t: 35 },
                    title: "Bulbo de presiones 3D",
                    scene: {
                      xaxis: { title: "X (m)" },
                      yaxis: { title: "Y (m)" },
                      zaxis: {
                        title: "Profundidad (m)",
                        autorange: "reversed",
                      },
                      camera: {
                        eye: { x: 1.6, y: 1.5, z: 1.1 },
                      },
                    },
                  }}
                  style={{ width: "100%", height: "100%" }}
                  config={{ responsive: true }}
                />
              </div>
            </section>

            <section className="panel">
              <h3>Asentamiento 3D en profundidad</h3>
              <div className="chart-box chart-box-3d">
                <Plot
                  data={[
                    {
                      type: "surface",
                      x: asentamiento3D.x,
                      y: asentamiento3D.y,
                      z: asentamiento3D.z,
                      surfacecolor: asentamiento3D.color,
                      text: asentamiento3D.texto,
                      hovertemplate: "%{text}<extra></extra>",
                      colorscale: "Viridis",
                      showscale: true,
                      contours: {
                        z: {
                          show: true,
                          usecolormap: true,
                          highlightcolor: "#111827",
                          project: { z: true },
                        },
                      },
                    },
                    ...trazasCimentacion3D,
                  ]}
                  layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, b: 0, t: 35 },
                    title: "Asentamiento 3D en profundidad",
                    scene: {
                      xaxis: { title: "X (m)" },
                      yaxis: { title: "Y (m)" },
                      zaxis: {
                        title: "Profundidad (m)",
                        autorange: "reversed",
                      },
                      camera: {
                        eye: { x: 1.7, y: 1.4, z: 1.15 },
                      },
                    },
                  }}
                  style={{ width: "100%", height: "100%" }}
                  config={{ responsive: true }}
                />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;