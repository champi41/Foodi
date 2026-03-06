// PlatillosView.jsx — vista principal de gestión de platillos
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import { ProductModal, getCategoriasArray, getPrecioDesde } from "./Productmodal.admin";
import { CatModal } from "./CatModal";
import "./PlatillosView.css";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const PlatillosView = ({ businessId }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);

  const tenantId = businessId || auth.currentUser?.uid;

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cS, pS, iS] = await Promise.all([
        getDocs(
          query(
            collection(db, `negocios/${tenantId}/categorias`),
            orderBy("nombre"),
          ),
        ),
        getDocs(collection(db, `negocios/${tenantId}/productos`)),
        getDocs(collection(db, `negocios/${tenantId}/ingredientes`)),
      ]);
      setCategories(cS.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProducts(pS.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIngredientes(iS.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e, onSuccess) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    try {
      const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: data },
      );
      const res = await resp.json();
      onSuccess(res.secure_url);
    } catch (err) {
      console.error("Error Cloudinary:", err);
      alert("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProduct = async (data) => {
    try {
      if (editingProduct) {
        await updateDoc(
          doc(db, `negocios/${tenantId}/productos`, editingProduct.id),
          data,
        );
      } else {
        await addDoc(collection(db, `negocios/${tenantId}/productos`), data);
      }
      fetchData();
      setShowProductModal(false);
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCat = async (nombre) => {
    try {
      const dR = await addDoc(
        collection(db, `negocios/${tenantId}/categorias`),
        { nombre },
      );
      setCategories([...categories, { id: dR.id, nombre }]);
      setShowCatModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCat = async (cat) => {
    const usandola = products.filter((p) =>
      getCategoriasArray(p).includes(cat.id),
    ).length;
    const msg =
      usandola > 0
        ? `¿Eliminar la categoría "${cat.nombre}"? ${usandola} platillo${usandola > 1 ? "s usan" : " usa"} esta categoría y quedarán sin ella.`
        : `¿Eliminar la categoría "${cat.nombre}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteDoc(doc(db, `negocios/${tenantId}/categorias`, cat.id));
      setCategories(categories.filter((c) => c.id !== cat.id));
      if (filterCat === cat.id) setFilterCat("all");
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (product) => {
    const newStatus = !product.activo;
    await updateDoc(doc(db, `negocios/${tenantId}/productos`, product.id), {
      activo: newStatus,
    });
    setProducts(
      products.map((p) =>
        p.id === product.id ? { ...p, activo: newStatus } : p,
      ),
    );
  };

  const handleDelete = async (productId) => {
    if (
      !window.confirm(
        "¿Eliminar este platillo? Esta acción no se puede deshacer.",
      )
    )
      return;
    await deleteDoc(doc(db, `negocios/${tenantId}/productos`, productId));
    fetchData();
  };

  const openProductModal = (p = null) => {
    setEditingProduct(p);
    setShowProductModal(true);
  };

  const filteredProducts = products.filter(
    (p) => filterCat === "all" || getCategoriasArray(p).includes(filterCat),
  );

  const catNames = (p) => {
    const ids = getCategoriasArray(p);
    if (ids.length === 0) return "Sin categoría";
    return ids
      .map((id) => categories.find((c) => c.id === id)?.nombre)
      .filter(Boolean)
      .join(", ");
  };

  if (loading) return <div className="pv-loading">Cargando platillos...</div>;

  return (
    <div className="platillos-view">
      <div className="pv-header">
        <div>
          <h1 className="pv-title">Platillos</h1>
          <p className="pv-subtitle">
            {products.length} platillos · {categories.length} categorías
          </p>
        </div>
        <button className="btn-primary" onClick={() => openProductModal()}>
          + Nuevo Platillo
        </button>
      </div>

      {/* Barra de filtro por categoría */}
      <div className="pv-filter-bar">
        <button
          className="filter-btn filter-btn-cat"
          onClick={() => setShowCatModal(true)}
        >
          + Categoría
        </button>
        <button
          className={filterCat === "all" ? "filter-btn active" : "filter-btn"}
          onClick={() => setFilterCat("all")}
        >
          Todos ({products.length})
        </button>
        {categories.map((c) => {
          const count = products.filter((p) =>
            getCategoriasArray(p).includes(c.id),
          ).length;
          return (
            <div
              key={c.id}
              className={`filter-btn-wrap ${filterCat === c.id ? "active" : ""}`}
            >
              <button
                className={
                  filterCat === c.id ? "filter-btn active" : "filter-btn"
                }
                onClick={() => setFilterCat(c.id)}
              >
                {c.nombre} ({count})
              </button>
              <button
                className="filter-btn-delete"
                title={`Eliminar categoría "${c.nombre}"`}
                onClick={() => handleDeleteCat(c)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="pv-empty">
          <span>🍽️</span>
          <p>No hay platillos en esta categoría</p>
          <button className="btn-primary" onClick={() => openProductModal()}>
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="pv-grid">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className={`pv-card ${!p.activo ? "pv-card-inactive" : ""}`}
            >
              <div className="pv-card-img">
                {p.imagen ? (
                  <img src={p.imagen} alt={p.nombre} />
                ) : (
                  <div className="pv-no-img">📷</div>
                )}
                {!p.activo && <div className="pv-inactive-badge">Inactivo</div>}
                {p.es_promocion && (
                  <div className="pv-promo-badge">⭐ Promo</div>
                )}
              </div>
              <div className="pv-card-body">
                <div className="pv-card-top">
                  <h4 className="pv-card-nombre">{p.nombre}</h4>
                  <span className="pv-card-precio">
                    {p.grupos?.some((g) => g.grupo?.trim() && g.requerido)
                      ? `Desde $${getPrecioDesde(p.precio_base, p.grupos).toLocaleString("es-CL")}`
                      : `$${(p.precio_base ?? 0).toLocaleString("es-CL")}`}
                  </span>
                </div>
                <p className="pv-card-cat">{catNames(p)}</p>

                {p.grupos?.length > 0 && (
                  <div className="pv-card-tags">
                    {p.grupos.map((g, i) => (
                      <span key={i} className="pv-tag">
                        {g.grupo}
                        {g.tipo === "multiple"
                          ? g.limite != null
                            ? ` · máx. ${g.limite}`
                            : g.incluidasGratis != null
                              ? ` · ${g.incluidasGratis} incl.`
                              : " · varios"
                          : " · uno"}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pv-card-features">
                  {p.personalizable && (
                    <span className="pv-feature-badge">✂️ Personalizable</span>
                  )}
                  {p.permitirNota && (
                    <span className="pv-feature-badge">📝 Nota</span>
                  )}
                </div>

                <div className="pv-card-actions">
                  <button
                    className="btn-card-edit"
                    onClick={() => openProductModal(p)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className={`btn-card-toggle ${p.activo ? "btn-card-desactivar" : "btn-card-activar"}`}
                    onClick={() => toggleStatus(p)}
                  >
                    {p.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    className="btn-card-delete"
                    onClick={() => handleDelete(p.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCatModal && (
        <CatModal
          onSave={handleAddCat}
          onClose={() => setShowCatModal(false)}
        />
      )}

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          ingredientes={ingredientes}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          uploading={uploading}
          onImageUpload={handleImageUpload}
        />
      )}
    </div>
  );
};
