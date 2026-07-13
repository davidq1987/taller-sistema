// ------------------------------------------------------------------
// Sistema de Taller - lógica de frontend (vanilla JS, sin frameworks)
// ------------------------------------------------------------------

const API = {
  machines: "/api/machines",
  orders: "/api/orders",
  quotes: "/api/quotes",
  settings: "/api/settings",
};

let state = {
  machines: [],
  orders: [],
  quotes: [],
  settings: null,
};

// ---------- utilidades ----------

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  // a, b: "YYYY-MM-DD" -> diferencia en días (b - a)
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function money(n) {
  const num = Number(n) || 0;
  return "$" + num.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function slug(str) {
  return (str || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : str;
  return d.innerHTML;
}

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al leer datos");
  return res.json();
}

async function apiSend(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error al guardar");
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Error al borrar");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- navegación lateral ----------

const VIEW_META = {
  inicio: { title: "Inicio", sub: "Panorama general del taller" },
  mantenimiento: { title: "Mantenimiento", sub: "Mantenimiento preventivo de máquinas y equipos" },
  produccion: { title: "Órdenes de trabajo", sub: "Gestión operativa del taller, seguimiento por estado" },
  presupuestos: { title: "Presupuestos", sub: "Cotización de trabajos para clientes" },
  config: { title: "Configuración", sub: "Datos de la empresa y tarifas" },
};

$all(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    $all(".nav-item").forEach((b) => b.classList.remove("active"));
    $all(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    $("#view-" + view).classList.add("active");
    const meta = VIEW_META[view] || { title: "", sub: "" };
    $("#viewTitle").textContent = meta.title;
    $("#viewSubtitle").textContent = meta.sub;
  });
});

// ---------- modales ----------

function openModal(id) { $("#" + id).classList.add("open"); }
function closeModal(id) { $("#" + id).classList.remove("open"); }

$all("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});

$all(".modal").forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// ------------------------------------------------------------------
// INICIO (dashboard)
// ------------------------------------------------------------------

function renderInicio() {
  const mant = state.machines.map(computeMantEstado);
  const atrasadosMant = mant.filter((m) => m.estado === "ATRASADO").length;
  const proximosMant = mant.filter((m) => m.estado === "PRÓXIMO").length;

  const activas = state.orders.filter((o) => o.estado !== "Entregado").length;
  const atrasadasOt = state.orders.filter((o) => computeOtAtraso(o) && o.estado !== "Entregado").length;

  $("#homeStatMantAtrasados").textContent = atrasadosMant;
  $("#homeStatMantProximos").textContent = proximosMant;
  $("#homeStatOtActivas").textContent = activas;
  $("#homeStatOtAtrasadas").textContent = atrasadasOt;
}

// ------------------------------------------------------------------
// MANTENIMIENTO
// ------------------------------------------------------------------

function computeMantEstado(item) {
  if (!item.ultimaRealizacion || !item.frecuenciaDias) {
    return { estado: "-", proxima: null, dias: null };
  }
  const proxima = addDays(item.ultimaRealizacion, item.frecuenciaDias);
  const dias = daysBetween(todayStr(), proxima);
  let estado = "AL DÍA";
  if (dias < 0) estado = "ATRASADO";
  else if (dias <= 7) estado = "PRÓXIMO";
  return { estado, proxima, dias };
}

function renderMantenimiento() {
  const body = $("#tablaMantBody");
  body.innerHTML = "";
  $("#mantEmptyMsg").style.display = state.machines.length ? "none" : "block";

  const sorted = [...state.machines].sort((a, b) => {
    const ea = computeMantEstado(a).dias ?? 9999;
    const eb = computeMantEstado(b).dias ?? 9999;
    return ea - eb;
  });

  sorted.forEach((item) => {
    const { estado, proxima } = computeMantEstado(item);

    const badgeClass =
      estado === "ATRASADO" ? "badge-atrasado" :
      estado === "PRÓXIMO" ? "badge-proximo" :
      estado === "AL DÍA" ? "badge-aldia" : "badge-neutral";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.maquina || "")}</td>
      <td>${escapeHtml(item.tipo || "")}</td>
      <td>${escapeHtml(item.tarea || "")}</td>
      <td>${item.frecuenciaDias ?? "-"}</td>
      <td>${formatDate(item.ultimaRealizacion)}</td>
      <td>${proxima ? formatDate(proxima) : "-"}</td>
      <td><span class="badge ${badgeClass}">${estado}</span></td>
      <td>${escapeHtml(item.responsable || "")}</td>
      <td>${escapeHtml(item.observaciones || "")}</td>
      <td>
        <button class="btn-icon" title="Editar" data-edit-mant="${item.id}">✏️</button>
        <button class="btn-icon" title="Eliminar" data-del-mant="${item.id}">🗑️</button>
      </td>
    `;
    body.appendChild(tr);
  });

  $all("[data-edit-mant]").forEach((b) => b.addEventListener("click", () => editMant(b.dataset.editMant)));
  $all("[data-del-mant]").forEach((b) => b.addEventListener("click", () => deleteMant(b.dataset.delMant)));

  renderInicio();
}

$("#btnNuevoMant").addEventListener("click", () => {
  $("#formMant").reset();
  $("#formMant [name=id]").value = "";
  $("#modalMantTitle").textContent = "Nueva tarea de mantenimiento";
  openModal("modalMant");
});

function editMant(id) {
  const item = state.machines.find((m) => m.id === id);
  if (!item) return;
  const f = $("#formMant");
  f.reset();
  f.id.value = item.id;
  f.maquina.value = item.maquina || "";
  f.tipo.value = item.tipo || "Torno CNC";
  f.tarea.value = item.tarea || "";
  f.frecuenciaDias.value = item.frecuenciaDias || "";
  f.ultimaRealizacion.value = item.ultimaRealizacion || "";
  f.responsable.value = item.responsable || "";
  f.observaciones.value = item.observaciones || "";
  $("#modalMantTitle").textContent = "Editar tarea de mantenimiento";
  openModal("modalMant");
}

async function deleteMant(id) {
  if (!confirm("¿Eliminar esta tarea de mantenimiento?")) return;
  await apiDelete(`${API.machines}?id=${id}`);
  state.machines = state.machines.filter((m) => m.id !== id);
  renderMantenimiento();
  populateActivoAsociado();
}

$("#formMant").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    maquina: f.maquina.value,
    tipo: f.tipo.value,
    tarea: f.tarea.value,
    frecuenciaDias: Number(f.frecuenciaDias.value),
    ultimaRealizacion: f.ultimaRealizacion.value,
    responsable: f.responsable.value,
    observaciones: f.observaciones.value,
  };
  if (f.id.value) {
    const updated = await apiSend(API.machines, "PUT", { ...data, id: f.id.value });
    const idx = state.machines.findIndex((m) => m.id === updated.id);
    state.machines[idx] = updated;
  } else {
    const created = await apiSend(API.machines, "POST", data);
    state.machines.push(created);
  }
  closeModal("modalMant");
  renderMantenimiento();
  populateActivoAsociado();
});

// ------------------------------------------------------------------
// PRODUCCION / ÓRDENES DE TRABAJO
// ------------------------------------------------------------------

function computeOtAtraso(item) {
  if (!item.fechaCompromiso || item.estado === "Entregado") return false;
  return daysBetween(item.fechaCompromiso, todayStr()) > 0;
}

function nextOrderNumber() {
  const nums = state.orders
    .map((o) => parseInt((o.numeroOrden || "").replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return "OT-" + String(next).padStart(4, "0");
}

function populateActivoAsociado() {
  const options = ['<option value="">Sin asignar</option>']
    .concat(state.machines.map((m) => `<option value="${escapeHtml(m.maquina)}">${escapeHtml(m.maquina)}</option>`))
    .join("");
  ["selActivoAsociadoNueva", "selActivoAsociadoEditar"].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = options;
    sel.value = current;
  });
}

function renderStatsOT() {
  const activas = state.orders.filter((o) => o.estado !== "Entregado").length;
  const enProceso = state.orders.filter((o) => o.estado === "En proceso").length;
  const atrasadas = state.orders.filter((o) => computeOtAtraso(o)).length;
  const finalizadas = state.orders.filter((o) => o.estado === "Entregado").length;

  $("#statOtActivas").textContent = activas;
  $("#statOtEnProceso").textContent = enProceso;
  $("#statOtAtrasadas").textContent = atrasadas;
  $("#statOtFinalizadas").textContent = finalizadas;
}

function estadoBadgeClass(estado) {
  return "badge-estado-" + slug(estado || "pendiente");
}

function prioridadBadgeClass(prioridad) {
  return "badge-prioridad-" + slug(prioridad || "media");
}

function renderOrdenes() {
  renderStatsOT();

  const search = ($("#otSearch").value || "").toLowerCase().trim();
  const filtroEstado = $("#otFilterEstado").value;
  const filtroPrioridad = $("#otFilterPrioridad").value;

  let list = [...state.orders];

  if (search) {
    list = list.filter((o) =>
      [o.numeroOrden, o.cliente, o.activoAsociado, o.operario, o.titulo]
        .some((v) => (v || "").toLowerCase().includes(search))
    );
  }
  if (filtroEstado) list = list.filter((o) => o.estado === filtroEstado);
  if (filtroPrioridad) list = list.filter((o) => o.prioridad === filtroPrioridad);

  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const container = $("#otCardsList");
  container.innerHTML = "";
  $("#ordenesEmptyMsg").style.display = state.orders.length ? "none" : "block";

  list.forEach((item) => {
    const atrasada = computeOtAtraso(item);
    const estadoLabel = atrasada ? "Atrasada" : (item.estado || "Pendiente");
    const estadoClass = atrasada ? "badge-atrasado" : estadoBadgeClass(item.estado);
    const planos = item.planoData ? 1 : 0;
    const remitos = [item.remitoCliente, item.remitoSalida].filter(Boolean).length;

    const card = document.createElement("div");
    card.className = "ot-card";
    card.innerHTML = `
      <div class="ot-card-top">
        <span class="ot-card-id">${escapeHtml(item.numeroOrden || "")}</span>
        <span class="badge ${prioridadBadgeClass(item.prioridad)}">${escapeHtml(item.prioridad || "Media")}</span>
        <span class="badge ${estadoClass}">${escapeHtml(estadoLabel)}</span>
      </div>
      <div class="ot-card-title">${escapeHtml(item.titulo || "")}</div>
      <div class="ot-card-meta">
        <div><b>Cliente:</b> ${escapeHtml(item.cliente || "-")}</div>
        <div><b>Operario:</b> ${escapeHtml(item.operario || "Sin asignar")}</div>
        <div><b>Activo:</b> ${escapeHtml(item.activoAsociado || "Sin asignar")}</div>
        <div><b>Entrega:</b> ${formatDate(item.fechaCompromiso)}</div>
      </div>
      <div class="ot-card-footer">
        <span>Planos: ${planos} · Remitos: ${remitos} · Cant.: ${item.cantidad ?? 1}</span>
        <button class="btn btn-outline" data-ver-ot="${item.id}">Ver detalles</button>
      </div>
    `;
    container.appendChild(card);
  });

  $all("[data-ver-ot]").forEach((b) => b.addEventListener("click", () => verDetalleOt(b.dataset.verOt)));

  renderInicio();
}

["input", "change"].forEach((evt) => {
  $("#otSearch").addEventListener(evt, renderOrdenes);
  $("#otFilterEstado").addEventListener("change", renderOrdenes);
  $("#otFilterPrioridad").addEventListener("change", renderOrdenes);
});

// ---- Nueva OT (formulario inline) ----

function readOrdenForm(f) {
  return {
    cliente: f.cliente.value,
    titulo: f.titulo.value,
    cantidad: Number(f.cantidad.value) || 1,
    fechaCompromiso: f.fechaCompromiso.value,
    ordenCompra: f.ordenCompra.value,
    remitoCliente: f.remitoCliente.value,
    remitoSalida: f.remitoSalida.value,
    operario: f.operario.value,
    requiereValidacion: !!f.requiereValidacion.checked,
    requiereTTA: !!f.requiereTTA.checked,
    requierePlano: !!f.requierePlano.checked,
    activoAsociado: f.activoAsociado.value,
    tipo: f.tipo.value,
    prioridad: f.prioridad.value,
    ubicacion: f.ubicacion.value,
    horasEstimadas: f.horasEstimadas.value ? Number(f.horasEstimadas.value) : null,
  };
}

$("#formOrdenNueva").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = readOrdenForm(f);
  data.numeroOrden = nextOrderNumber();
  data.estado = "Pendiente";
  data.fechaInicio = todayStr();
  data.entregaReal = "";
  data.observaciones = "";

  const file = f.planoAdjunto.files[0];
  if (file) {
    data.planoData = await fileToDataUrl(file);
    data.planoNombre = file.name;
  }

  const created = await apiSend(API.orders, "POST", data);
  state.orders.push(created);
  f.reset();
  $("#selActivoAsociadoNueva").value = "";
  renderOrdenes();
});

// ---- Ver detalle / QR / plano ----

let otDetalleActualId = null;

function verDetalleOt(id) {
  const item = state.orders.find((o) => o.id === id);
  if (!item) return;
  otDetalleActualId = id;

  $("#otDetalleTitulo").textContent = `${item.numeroOrden} · ${item.titulo || ""}`;

  const atrasada = computeOtAtraso(item);
  const estadoLabel = atrasada ? "Atrasada" : (item.estado || "Pendiente");
  const estadoClass = atrasada ? "badge-atrasado" : estadoBadgeClass(item.estado);

  const tags = [`<span class="badge ${prioridadBadgeClass(item.prioridad)}">${escapeHtml(item.prioridad || "Media")}</span>`,
    `<span class="badge ${estadoClass}">${escapeHtml(estadoLabel)}</span>`];
  if (item.requiereValidacion) tags.push('<span class="badge badge-neutral">Requiere validación</span>');
  if (item.requiereTTA) tags.push('<span class="badge badge-neutral">Requiere TTA</span>');
  if (item.requierePlano) tags.push('<span class="badge badge-neutral">Requiere plano</span>');
  $("#otDetalleTags").innerHTML = tags.join(" ");

  const rows = [
    ["Cliente", item.cliente], ["Operario / responsable", item.operario || "Sin asignar"],
    ["Activo asociado", item.activoAsociado || "Sin asignar"], ["Tipo", item.tipo],
    ["Cantidad", item.cantidad ?? 1], ["Ubicación / sector", item.ubicacion || "-"],
    ["Fecha inicio", formatDate(item.fechaInicio)], ["Fecha compromiso", formatDate(item.fechaCompromiso)],
    ["Entrega real", item.entregaReal ? formatDate(item.entregaReal) : "-"], ["Horas estimadas", item.horasEstimadas ?? "-"],
    ["Orden de compra", item.ordenCompra || "-"], ["Remito cliente", item.remitoCliente || "-"],
    ["Remito salida", item.remitoSalida || "-"], ["", ""],
  ];

  let gridHtml = rows.map(([label, val]) => label ? `
    <div><div class="label">${escapeHtml(label)}</div><div>${escapeHtml(val)}</div></div>
  ` : "").join("");

  if (item.observaciones) {
    gridHtml += `<div class="full"><div class="label">Observaciones</div><div>${escapeHtml(item.observaciones)}</div></div>`;
  }
  $("#otDetalleGrid").innerHTML = gridHtml;

  if (item.planoData) {
    $("#otDetallePlano").innerHTML = `<a class="plano-link" href="${item.planoData}" download="${escapeHtml(item.planoNombre || "plano")}">📎 Descargar plano adjunto (${escapeHtml(item.planoNombre || "archivo")})</a>`;
  } else {
    $("#otDetallePlano").innerHTML = `<p class="muted">Sin plano adjunto.</p>`;
  }

  const qrBox = $("#otQrCode");
  qrBox.innerHTML = "";
  const qrText = `OT ${item.numeroOrden}\nCliente: ${item.cliente}\nTrabajo: ${item.titulo}\nEntrega: ${formatDate(item.fechaCompromiso)}`;
  if (window.QRCode) {
    new QRCode(qrBox, { text: qrText, width: 96, height: 96 });
  }

  openModal("modalOtDetalle");
}

$("#btnEliminarOt").addEventListener("click", async () => {
  if (!otDetalleActualId) return;
  if (!confirm("¿Eliminar esta orden de trabajo?")) return;
  await apiDelete(`${API.orders}?id=${otDetalleActualId}`);
  state.orders = state.orders.filter((o) => o.id !== otDetalleActualId);
  closeModal("modalOtDetalle");
  renderOrdenes();
});

$("#btnEditarOt").addEventListener("click", () => {
  const item = state.orders.find((o) => o.id === otDetalleActualId);
  if (!item) return;
  const f = $("#formOtEditar");
  f.reset();
  f.id.value = item.id;
  f.cliente.value = item.cliente || "";
  f.titulo.value = item.titulo || "";
  f.cantidad.value = item.cantidad ?? 1;
  f.fechaCompromiso.value = item.fechaCompromiso || "";
  f.ordenCompra.value = item.ordenCompra || "";
  f.remitoCliente.value = item.remitoCliente || "";
  f.remitoSalida.value = item.remitoSalida || "";
  f.operario.value = item.operario || "";
  f.requiereValidacion.checked = !!item.requiereValidacion;
  f.requiereTTA.checked = !!item.requiereTTA;
  f.requierePlano.checked = !!item.requierePlano;
  f.activoAsociado.value = item.activoAsociado || "";
  f.tipo.value = item.tipo || "Correctivo";
  f.prioridad.value = item.prioridad || "Media";
  f.ubicacion.value = item.ubicacion || "";
  f.horasEstimadas.value = item.horasEstimadas ?? "";
  f.estado.value = item.estado || "Pendiente";
  f.entregaReal.value = item.entregaReal || "";
  f.observaciones.value = item.observaciones || "";
  closeModal("modalOtDetalle");
  openModal("modalOtEditar");
});

$("#formOtEditar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = readOrdenForm(f);
  data.id = f.id.value;
  data.estado = f.estado.value;
  data.entregaReal = f.entregaReal.value;
  data.observaciones = f.observaciones.value;

  const file = f.planoAdjunto.files[0];
  if (file) {
    data.planoData = await fileToDataUrl(file);
    data.planoNombre = file.name;
  }

  const updated = await apiSend(API.orders, "PUT", data);
  const idx = state.orders.findIndex((o) => o.id === updated.id);
  state.orders[idx] = updated;
  closeModal("modalOtEditar");
  renderOrdenes();
});

// ------------------------------------------------------------------
// PRESUPUESTOS
// ------------------------------------------------------------------

function calcQuote(f) {
  const material = Number(f.costoMaterial.value) || 0;
  const hConv = Number(f.horasConvencional.value) || 0;
  const hCNC = Number(f.horasCNC.value) || 0;
  const hSold = Number(f.horasSoldadura.value) || 0;
  const margen = Number(f.margen.value) || 0;

  const rates = state.settings || {};
  const subtotal =
    material +
    hConv * (rates.rateConvencional || 0) +
    hCNC * (rates.rateCNC || 0) +
    hSold * (rates.rateSoldadura || 0);
  const total = subtotal * (1 + margen / 100);
  return { subtotal, total };
}

function updateQuotePreview() {
  const f = $("#formPresupuesto");
  const { subtotal, total } = calcQuote(f);
  $("#quotePreview").innerHTML = `Subtotal: ${money(subtotal)} &nbsp;|&nbsp; Total con margen: <strong>${money(total)}</strong>`;
}

["costoMaterial", "horasConvencional", "horasCNC", "horasSoldadura", "margen"].forEach((name) => {
  document.addEventListener("input", (e) => {
    if (e.target && e.target.name === name && e.target.closest("#formPresupuesto")) {
      updateQuotePreview();
    }
  });
});

function renderPresupuestos() {
  const body = $("#tablaPresupuestosBody");
  body.innerHTML = "";
  $("#presEmptyMsg").style.display = state.quotes.length ? "none" : "block";

  const sorted = [...state.quotes].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  sorted.forEach((item) => {
    const { total } = calcQuote({
      costoMaterial: { value: item.costoMaterial },
      horasConvencional: { value: item.horasConvencional },
      horasCNC: { value: item.horasCNC },
      horasSoldadura: { value: item.horasSoldadura },
      margen: { value: item.margen },
    });

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.numero || "")}</td>
      <td>${escapeHtml(item.cliente || "")}</td>
      <td>${escapeHtml(item.descripcion || "")}</td>
      <td>${money(item.costoMaterial)}</td>
      <td>${item.horasConvencional || 0}</td>
      <td>${item.horasCNC || 0}</td>
      <td>${item.horasSoldadura || 0}</td>
      <td>${item.margen || 0}%</td>
      <td><strong>${money(total)}</strong></td>
      <td>${item.createdAt ? formatDate(item.createdAt.slice(0, 10)) : "-"}</td>
      <td><button class="btn-icon" title="Eliminar" data-del-pres="${item.id}">🗑️</button></td>
    `;
    body.appendChild(tr);
  });

  $all("[data-del-pres]").forEach((b) => b.addEventListener("click", () => deletePresupuesto(b.dataset.delPres)));
}

async function deletePresupuesto(id) {
  if (!confirm("¿Eliminar este presupuesto?")) return;
  await apiDelete(`${API.quotes}?id=${id}`);
  state.quotes = state.quotes.filter((q) => q.id !== id);
  renderPresupuestos();
}

$("#btnNuevoPresupuesto").addEventListener("click", () => {
  $("#formPresupuesto").reset();
  $("#presMargenInput").value = state.settings ? state.settings.defaultMargin : 30;
  updateQuotePreview();
  openModal("modalPresupuesto");
});

$("#formPresupuesto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    numero: f.numero.value,
    cliente: f.cliente.value,
    descripcion: f.descripcion.value,
    costoMaterial: Number(f.costoMaterial.value) || 0,
    horasConvencional: Number(f.horasConvencional.value) || 0,
    horasCNC: Number(f.horasCNC.value) || 0,
    horasSoldadura: Number(f.horasSoldadura.value) || 0,
    margen: Number(f.margen.value) || 0,
  };
  const created = await apiSend(API.quotes, "POST", data);
  state.quotes.push(created);
  closeModal("modalPresupuesto");
  renderPresupuestos();
});

// ------------------------------------------------------------------
// CONFIGURACION
// ------------------------------------------------------------------

function fillConfigForm() {
  const s = state.settings || {};
  $("#cfgEmpresa").value = s.empresa || "";
  $("#cfgRateConv").value = s.rateConvencional ?? 0;
  $("#cfgRateCNC").value = s.rateCNC ?? 0;
  $("#cfgRateSold").value = s.rateSoldadura ?? 0;
  $("#cfgMargin").value = s.defaultMargin ?? 0;
  const nombre = s.empresa || "Sistema de Taller";
  $("#empresaNombreSidebar").textContent = nombre;
  $("#empresaNombreTop").textContent = nombre;
}

$("#formConfig").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    empresa: $("#cfgEmpresa").value,
    rateConvencional: Number($("#cfgRateConv").value) || 0,
    rateCNC: Number($("#cfgRateCNC").value) || 0,
    rateSoldadura: Number($("#cfgRateSold").value) || 0,
    defaultMargin: Number($("#cfgMargin").value) || 0,
  };
  state.settings = await apiSend(API.settings, "PUT", data);
  fillConfigForm();
  const msg = $("#cfgSavedMsg");
  msg.textContent = "Guardado ✓";
  setTimeout(() => (msg.textContent = ""), 2500);
});

// ------------------------------------------------------------------
// CARGA INICIAL
// ------------------------------------------------------------------

async function loadAll() {
  try {
    const [machines, orders, quotes, settings] = await Promise.all([
      apiGet(API.machines),
      apiGet(API.orders),
      apiGet(API.quotes),
      apiGet(API.settings),
    ]);
    state.machines = machines;
    state.orders = orders;
    state.quotes = quotes;
    state.settings = settings;

    fillConfigForm();
    populateActivoAsociado();
    renderMantenimiento();
    renderOrdenes();
    renderPresupuestos();
    renderInicio();
  } catch (err) {
    console.error(err);
    alert("No se pudieron cargar los datos. Revisá la conexión y recargá la página.");
  }
}

loadAll();
