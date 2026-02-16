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
import "./PlatillosView.css";

export const PlatillosView = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio_base: 0,
    categoria_id: "",
    es_promocion: false,
    activo: true,
  });

  const [hasElectivos, setHasElectivos] = useState(false);
  const [electivos, setElectivos] = useState([{ nombre: "", extra: 0 }]);
  const [isPersonalizable, setIsPersonalizable] = useState(false);
  const [ingBase, setIngBase] = useState([""]);
  const [ingInter, setIngInter] = useState([{ nombre: "", precio: 0 }]);
  const tenantId = auth.currentUser?.uid;

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cS = await getDocs(
        query(
          collection(db, `negocios/${tenantId}/categorias`),
          orderBy("nombre"),
        ),
      );
      setCategories(cS.docs.map((d) => ({ id: d.id, ...d.data() })));
      const pS = await getDocs(
        collection(db, `negocios/${tenantId}/productos`),
      );
      setProducts(pS.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDynamic = (index, val, list, setList, isObj, field) => {
    let newList = [...list];
    if (isObj) newList[index][field] = val;
    else newList[index] = val;
    if (index === list.length - 1 && val !== "") {
      newList.push(
        isObj
          ? field === "precio"
            ? { nombre: "", precio: 0 }
            : { nombre: "", extra: 0 }
          : "",
      );
    }
    setList(newList);
  };

  const openProductModal = (p = null) => {
    if (p) {
      setEditingProduct(p);
      setFormData({ ...p });
      setHasElectivos(p.electivos?.length > 0);
      setElectivos(
        p.electivos?.length
          ? [...p.electivos, { nombre: "", extra: 0 }]
          : [{ nombre: "", extra: 0 }],
      );
      setIsPersonalizable(p.personalizable || false);
      setIngBase(p.ingBase?.length ? [...p.ingBase, ""] : [""]);
      setIngInter(
        p.ingInter?.length
          ? [...p.ingInter, { nombre: "", precio: 0 }]
          : [{ nombre: "", precio: 0 }],
      );
    } else {
      setEditingProduct(null);
      setFormData({
        nombre: "",
        descripcion: "",
        precio_base: 0,
        categoria_id: categories[0]?.id || "",
        es_promocion: false,
        activo: true,
      });
      setHasElectivos(false);
      setElectivos([{ nombre: "", extra: 0 }]);
      setIsPersonalizable(false);
      setIngBase([""]);
      setIngInter([{ nombre: "", precio: 0 }]);
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const cleanE = electivos.filter((x) => x.nombre.trim() !== "");
    const cleanB = ingBase.filter((x) => x.trim() !== "");
    const cleanI = ingInter.filter((x) => x.nombre.trim() !== "");
    const data = {
      ...formData,
      electivos: hasElectivos ? cleanE : [],
      personalizable: isPersonalizable,
      ingBase: isPersonalizable ? cleanB : [],
      ingInter: isPersonalizable ? cleanI : [],
    };
    try {
      if (editingProduct)
        await updateDoc(
          doc(db, `negocios/${tenantId}/productos`, editingProduct.id),
          data,
        );
      else await addDoc(collection(db, `negocios/${tenantId}/productos`), data);
      fetchData();
      setShowProductModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCat = async (e) => {
    e.preventDefault();
    try {
      const dR = await addDoc(
        collection(db, `negocios/${tenantId}/categorias`),
        { nombre: newCatName },
      );
      setCategories([...categories, { id: dR.id, nombre: newCatName }]);
      setNewCatName("");
      setShowCatModal(false);
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
  if (loading) return <div>Cargando...</div>;

  return (
    <div className="platillos-view">
      <div className="header-section">
        <h1>
          Platillos{" "}
          <button onClick={() => openProductModal()}>+ Agregar</button>
        </h1>
        <h3>
          Categorías{" "}
          <button onClick={() => setShowCatModal(true)}>+ Agregar</button>
        </h3>
        <div className="filter-bar">
          <button
            className={filterCat === "all" ? "active" : ""}
            onClick={() => setFilterCat("all")}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={filterCat === c.id ? "active" : ""}
              onClick={() => setFilterCat(c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="products-grid">
        {products
          .filter((p) => filterCat === "all" || p.categoria_id === filterCat)
          .map((p) => (
            <div
              key={p.id}
              className={`product-card ${!p.activo ? "inactive" : ""}`}
            >
              <h4>{p.nombre}</h4>
              <p>${p.precio_base}</p>
              <button
                onClick={async () => {
                  if (window.confirm("¿Eliminar?")) {
                    await deleteDoc(
                      doc(db, `negocios/${tenantId}/productos`, p.id),
                    );
                    fetchData();
                  }
                }}
              >
                Eliminar
              </button>
              <button onClick={() => openProductModal(p)}>Editar</button>
              <button onClick={() => toggleStatus(p)}>
                {p.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
      </div>

      {showCatModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handleAddCat}>
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nombre Categoría"
                required
              />
              <button type="submit">Guardar</button>
              <button type="button" onClick={() => setShowCatModal(false)}>
                Cerrar
              </button>
            </form>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content scrollable">
            <form onSubmit={handleSaveProduct}>
              <input
                placeholder="Nombre"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                required
              />
              <input
                type="number"
                placeholder="Precio"
                value={formData.precio_base}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    precio_base: Number(e.target.value),
                  })
                }
                required
              />
              <select
                value={formData.categoria_id}
                onChange={(e) =>
                  setFormData({ ...formData, categoria_id: e.target.value })
                }
                required
              >
                <option value="">Categoría...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={formData.es_promocion}
                  onChange={(e) =>
                    setFormData({ ...formData, es_promocion: e.target.checked })
                  }
                />{" "}
                ¿Es promoción?
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={hasElectivos}
                  onChange={(e) => setHasElectivos(e.target.checked)}
                />{" "}
                Electivos
              </label>
              {hasElectivos &&
                electivos.map((el, i) => (
                  <div key={i}>
                    <input
                      placeholder="Opción"
                      value={el.nombre}
                      onChange={(e) =>
                        handleDynamic(
                          i,
                          e.target.value,
                          electivos,
                          setElectivos,
                          true,
                          "nombre",
                        )
                      }
                    />
                    <input
                      type="number"
                      placeholder="$"
                      value={el.extra}
                      onChange={(e) =>
                        handleDynamic(
                          i,
                          Number(e.target.value),
                          electivos,
                          setElectivos,
                          true,
                          "extra",
                        )
                      }
                    />
                  </div>
                ))}

              <label>
                <input
                  type="checkbox"
                  checked={isPersonalizable}
                  onChange={(e) => setIsPersonalizable(e.target.checked)}
                />{" "}
                Personalizable
              </label>
              {isPersonalizable && (
                <div>
                  <h5>Base (Quitar)</h5>
                  {ingBase.map((b, i) => (
                    <input
                      key={i}
                      value={b}
                      onChange={(e) =>
                        handleDynamic(i, e.target.value, ingBase, setIngBase)
                      }
                      placeholder="Ingrediente"
                    />
                  ))}
                  <h5>Intercambio/Extra</h5>
                  {ingInter.map((n, i) => (
                    <div key={i}>
                      <input
                        placeholder="Nombre"
                        value={n.nombre}
                        onChange={(e) =>
                          handleDynamic(
                            i,
                            e.target.value,
                            ingInter,
                            setIngInter,
                            true,
                            "nombre",
                          )
                        }
                      />
                      <input
                        type="number"
                        placeholder="$"
                        value={n.precio}
                        onChange={(e) =>
                          handleDynamic(
                            i,
                            Number(e.target.value),
                            ingInter,
                            setIngInter,
                            true,
                            "precio",
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <button type="submit">Guardar</button>
              <button type="button" onClick={() => setShowProductModal(false)}>
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
