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

// ---------- tabs ----------

$all(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $all(".tab-btn").forEach((b) => b.classList.remove("active"));
    $all(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab-" + btn.dataset.tab).classList.add("active");
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

  let atrasados = 0, proximos = 0;

  const sorted = [...state.machines].sort((a, b) => {
    const ea = computeMantEstado(a).dias ?? 9999;
    const eb = computeMantEstado(b).dias ?? 9999;
    return ea - eb;
  });

  sorted.forEach((item) => {
    const { estado, proxima } = computeMantEstado(item);
    if (estado === "ATRASADO") atrasados++;
    if (estado === "PRÓXIMO") proximos++;

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

  $("#statAtrasadosMant").textContent = atrasados;
  $("#statProximosMant").textContent = proximos;

  $all("[data-edit-mant]").forEach((b) => b.addEventListener("click", () => editMant(b.dataset.editMant)));
  $all("[data-del-mant]").forEach((b) => b.addEventListener("click", () => deleteMant(b.dataset.delMant)));
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
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
});

// ------------------------------------------------------------------
// PRODUCCION
// ------------------------------------------------------------------

function computeOrdenAtraso(item) {
  if (!item.entregaEstimada) return 0;
  const ref = item.entregaReal || todayStr();
  const dias = daysBetween(item.entregaEstimada, ref);
  return dias > 0 ? dias : 0;
}

function renderOrdenes() {
  const body = $("#tablaOrdenesBody");
  body.innerHTML = "";
  $("#ordenesEmptyMsg").style.display = state.orders.length ? "none" : "block";

  let atrasados = 0, enProceso = 0;

  const sorted = [...state.orders].sort((a, b) => computeOrdenAtraso(b) - computeOrdenAtraso(a));

  sorted.forEach((item) => {
    const atraso = computeOrdenAtraso(item);
    if (atraso > 0 && item.estado !== "Entregado") atrasados++;
    if (item.estado === "En proceso") enProceso++;

    const badgeClass = atraso > 0 ? "badge-atrasado" : "badge-aldia";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.numeroOrden || "")}</td>
      <td>${escapeHtml(item.cliente || "")}</td>
      <td>${escapeHtml(item.descripcion || "")}</td>
      <td>${escapeHtml(item.maquina || "")}</td>
      <td><span class="badge badge-neutral">${escapeHtml(item.estado || "")}</span></td>
      <td>${formatDate(item.fechaInicio)}</td>
      <td>${formatDate(item.entregaEstimada)}</td>
      <td>${formatDate(item.entregaReal)}</td>
      <td><span class="badge ${badgeClass}">${atraso}</span></td>
      <td>${escapeHtml(item.responsable || "")}</td>
      <td>
        <button class="btn-icon" title="Editar" data-edit-orden="${item.id}">✏️</button>
        <button class="btn-icon" title="Eliminar" data-del-orden="${item.id}">🗑️</button>
      </td>
    `;
    body.appendChild(tr);
  });

  $("#statAtrasadosProd").textContent = atrasados;
  $("#statEnProceso").textContent = enProceso;

  $all("[data-edit-orden]").forEach((b) => b.addEventListener("click", () => editOrden(b.dataset.editOrden)));
  $all("[data-del-orden]").forEach((b) => b.addEventListener("click", () => deleteOrden(b.dataset.delOrden)));
}

$("#btnNuevaOrden").addEventListener("click", () => {
  $("#formOrden").reset();
  $("#formOrden [name=id]").value = "";
  $("#formOrden [name=fechaInicio]").value = todayStr();
  $("#modalOrdenTitle").textContent = "Nueva orden de trabajo";
  openModal("modalOrden");
});

function editOrden(id) {
  const item = state.orders.find((o) => o.id === id);
  if (!item) return;
  const f = $("#formOrden");
  f.reset();
  f.id.value = item.id;
  f.numeroOrden.value = item.numeroOrden || "";
  f.cliente.value = item.cliente || "";
  f.descripcion.value = item.descripcion || "";
  f.maquina.value = item.maquina || "";
  f.estado.value = item.estado || "Pendiente";
  f.fechaInicio.value = item.fechaInicio || "";
  f.entregaEstimada.value = item.entregaEstimada || "";
  f.entregaReal.value = item.entregaReal || "";
  f.responsable.value = item.responsable || "";
  f.observaciones.value = item.observaciones || "";
  $("#modalOrdenTitle").textContent = "Editar orden de trabajo";
  openModal("modalOrden");
}

async function deleteOrden(id) {
  if (!confirm("¿Eliminar esta orden de trabajo?")) return;
  await apiDelete(`${API.orders}?id=${id}`);
  state.orders = state.orders.filter((o) => o.id !== id);
  renderOrdenes();
}

$("#formOrden").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    numeroOrden: f.numeroOrden.value,
    cliente: f.cliente.value,
    descripcion: f.descripcion.value,
    maquina: f.maquina.value,
    estado: f.estado.value,
    fechaInicio: f.fechaInicio.value,
    entregaEstimada: f.entregaEstimada.value,
    entregaReal: f.entregaReal.value,
    responsable: f.responsable.value,
    observaciones: f.observaciones.value,
  };
  if (f.id.value) {
    const updated = await apiSend(API.orders, "PUT", { ...data, id: f.id.value });
    const idx = state.orders.findIndex((o) => o.id === updated.id);
    state.orders[idx] = updated;
  } else {
    const created = await apiSend(API.orders, "POST", data);
    state.orders.push(created);
  }
  closeModal("modalOrden");
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
  $("#empresaNombre").textContent = s.empresa || "Sistema de Taller";
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
    renderMantenimiento();
    renderOrdenes();
    renderPresupuestos();
  } catch (err) {
    console.error(err);
    alert("No se pudieron cargar los datos. Revisá la conexión y recargá la página.");
  }
}

loadAll();
