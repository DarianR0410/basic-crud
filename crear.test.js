// Prueba unitaria UT-01 crear - Gestor de tareas (app.js)
// Rama sugerida: feature/crear-tarea
// Cada prueba carga app.js con las respuestas del usuario simuladas (sin teclado)
// y revisa el resultado de la funcion en tareas.json y en lo que imprime.
// Ejecutar con: npm test   (o: node --test)
const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP = process.env.APP_PATH || path.join(__dirname, "..", "app.js");

// Ejecuta app.js en una carpeta temporal con respuestas simuladas.
// Devuelve lo que imprimio y las tareas guardadas.
async function correrApp(respuestas, tareasIniciales) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unit-tareas-"));
  const archivo = path.join(dir, "tareas.json");
  if (tareasIniciales) fs.writeFileSync(archivo, JSON.stringify(tareasIniciales));

  const cwdOriginal = process.cwd();
  const logOriginal = console.log;
  const cargarOriginal = Module._load;
  const salida = [];
  let terminar;
  const terminado = new Promise((res) => (terminar = res));

  // readline simulado: devuelve las respuestas en orden
  const rlFalso = {
    question: async () => {
      if (!respuestas.length) throw new Error("La app pidio mas datos de los simulados");
      return respuestas.shift();
    },
    close: () => terminar(),
  };

  process.chdir(dir);
  console.log = (...args) => salida.push(args.join(" "));
  Module._load = function (request, ...resto) {
    if (request === "readline/promises") return { createInterface: () => rlFalso };
    return cargarOriginal.call(this, request, ...resto);
  };

  try {
    delete require.cache[require.resolve(APP)];
    require(APP);
    await Promise.race([
      terminado,
      new Promise((_, rej) => setTimeout(() => rej(new Error("Tiempo agotado")), 5000)),
    ]);
  } finally {
    Module._load = cargarOriginal;
    console.log = logOriginal;
    process.chdir(cwdOriginal);
  }
  const tareas = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, "utf8")) : [];
  return { salida: salida.join("\n"), tareas };
}

test("UT-01 crearTarea guarda una tarea con id 1 y estado pendiente", async () => {
  const r = await correrApp(["1", "Comprar pan", "0"]);
  assert.deepStrictEqual(r.tareas, [{ id: 1, titulo: "Comprar pan", estado: "pendiente" }]);
  assert.match(r.salida, /Tarea creada/);
});
