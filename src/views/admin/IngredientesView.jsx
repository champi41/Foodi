// IngredientesView.jsx — catálogo de ingredientes reutilizables del negocio
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import { CatIngredienteModal } from "./CatIngredienteModal";
import "./IngredientesView.css";

export const IngredientesView = ({ businessId }) => {
  const tenantId = businessId || auth.currentUser?.uid;
  const [ingredientes, setIngredientes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: "", categoriaId: "", extra: 0 });

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ingSnap, catSnap] = await Promise.all([
        getDocs(collection(db, `negocios/${tenantId}/ingredientes`)),
        getDocs(
          collection(db, `negocios/${tenantId}/categoriasIngredientes`),
        ),
      ]);
      setIngredientes(ingSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const catList = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      catList.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setCategorias(catList);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      nombre: "",
      categoriaId: categorias.length ? categorias[0].id : "",
      extra: 0,
    });
    setShowModal(true);
  };

  const openEdit = (ing) => {
    setEditing(ing);
    const catId =
      ing.categoriaId ||
      categorias.find((c) => c.nombre === ing.categoria)?.id ||
      categorias[0]?.id ||
      "";
    setForm({
      nombre: ing.nombre || "",
      categoriaId: catId,
      extra: ing.extra ?? 0,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return alert("Escribe el nombre del ingrediente");
    const cat = categorias.find((c) => c.id === form.categoriaId);
    const payload = {
      nombre: form.nombre.trim(),
      categoriaId: form.categoriaId || null,
      categoria: cat?.nombre ?? null,
      extra: Number(form.extra) || 0,
    };
    try {
      if (editing) {
        await updateDoc(
          doc(db, `negocios/${tenantId}/ingredientes`, editing.id),
          payload,
        );
      } else {
        await addDoc(collection(db, `negocios/${tenantId}/ingredientes`), payload);
      }
      fetchData();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar");
    }
  };

  const handleDelete = async (ing) => {
    if (!window.confirm(`¿Eliminar "${ing.nombre}"?`)) return;
    try {
      await deleteDoc(doc(db, `negocios/${tenantId}/ingredientes`, ing.id));
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar");
    }
  };

  const handleAddCategoria = async (nombre) => {
    try {
      const ref = await addDoc(
        collection(db, `negocios/${tenantId}/categoriasIngredientes`),
        { nombre },
      );
      setCategorias((prev) => [...prev, { id: ref.id, nombre }]);
      setShowCatModal(false);
    } catch (err) {
      console.error(err);
      alert("Error al crear categoría");
    }
  };

  const handleDeleteCategoria = async (cat) => {
    const enUso = ingredientes.filter((i) => i.categoriaId === cat.id).length;
    const msg =
      enUso > 0
        ? `¿Eliminar la categoría "${cat.nombre}"? ${enUso} ingrediente${enUso > 1 ? "s quedan" : " queda"} sin categoría.`
        : `¿Eliminar la categoría "${cat.nombre}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteDoc(
        doc(db, `negocios/${tenantId}/categoriasIngredientes`, cat.id),
      );
      setCategorias((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar");
    }
  };

  const byCategoria = categorias.map((cat) => ({
    id: cat.id,
    nombre: cat.nombre,
    items: ingredientes.filter((i) => i.categoriaId === cat.id),
  }));
  const sinCategoria = ingredientes.filter((i) => !i.categoriaId);
  if (sinCategoria.length > 0) {
    byCategoria.push({ id: "_sin", nombre: "Sin categoría", items: sinCategoria });
  }

  return (
    <div className="ingredientes-view">
      <div className="iv-header">
        <div>
          <h1 className="iv-title">Ingredientes</h1>
          <p className="iv-subtitle">
            Catálogo reutilizable para grupos de opciones en platillos
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + Nuevo ingrediente
        </button>
      </div>

      {/* Barra de categorías (crear / listar / borrar) */}
      <div className="iv-filter-bar">
        <button
          type="button"
          className="iv-btn-cat"
          onClick={() => setShowCatModal(true)}
        >
          + Categoría
        </button>
        {categorias.map((cat) => {
          const count = ingredientes.filter((i) => i.categoriaId === cat.id).length;
          return (
            <div key={cat.id} className="iv-filter-btn-wrap">
              <span className="iv-filter-cat">
                {cat.nombre} ({count})
              </span>
              <button
                type="button"
                className="iv-btn-delete-cat"
                onClick={() => handleDeleteCategoria(cat)}
                title={`Eliminar categoría "${cat.nombre}"`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="iv-loading">Cargando ingredientes...</div>
      ) : ingredientes.length === 0 ? (
        <div className="iv-empty">
          <span>🥗</span>
          <p>
            {categorias.length === 0
              ? "Crea una categoría y luego agrega ingredientes."
              : "No hay ingredientes. Crea el primero para usarlos en los grupos de tus platillos."}
          </p>
          {categorias.length === 0 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCatModal(true)}
            >
              Crear categoría
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Crear ingrediente
            </button>
          )}
        </div>
      ) : (
        <div className="iv-list">
          {byCategoria.map(
            (cat) =>
              cat.items.length > 0 && (
                <section key={cat.id} className="iv-section">
                  <h2 className="iv-section-title">{cat.nombre}</h2>
                  <ul className="iv-cards">
                    {cat.items.map((ing) => (
                      <li key={ing.id} className="iv-card">
                        <div className="iv-card-body">
                          <span className="iv-card-nombre">{ing.nombre}</span>
                          <span className="iv-card-extra">
                            +${(ing.extra ?? 0).toLocaleString("es-CL")}
                          </span>
                        </div>
                        <div className="iv-card-actions">
                          <button
                            type="button"
                            className="iv-btn-edit"
                            onClick={() => openEdit(ing)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="iv-btn-delete"
                            onClick={() => handleDelete(ing)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
      )}

      {showModal && (
        <div className="iv-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="iv-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="iv-modal-title">
              {editing ? "Editar ingrediente" : "Nuevo ingrediente"}
            </h3>
            <form onSubmit={handleSave}>
              <div className="iv-field">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Pollo, Palta, Mayonesa"
                  required
                />
              </div>
              <div className="iv-field">
                <label>Categoría</label>
                {categorias.length === 0 ? (
                  <p className="iv-hint">
                    Crea una categoría con el botón "+ Categoría"
                  </p>
                ) : (
                  <select
                    value={form.categoriaId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoriaId: e.target.value }))
                    }
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="iv-field">
                <label>Precio extra por defecto (CLP)</label>
                <div className="iv-precio-wrap">
                  <span className="iv-precio-prefix">$</span>
                  <input
                    type="number"
                    min="0"
                    value={form.extra}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, extra: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="iv-modal-btns">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editing ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatModal && (
        <CatIngredienteModal
          onSave={handleAddCategoria}
          onClose={() => setShowCatModal(false)}
        />
      )}
    </div>
  );
};
