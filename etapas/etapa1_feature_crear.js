// Gestor de tareas - CRUD simple en Node.js (Tarea 3 - Git Flow)
const fs = require("fs");
const readline = require("readline/promises");

const ARCHIVO = "tareas.json";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function cargar() {
  if (!fs.existsSync(ARCHIVO)) return [];
  return JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
}

function guardar(tareas) {
  fs.writeFileSync(ARCHIVO, JSON.stringify(tareas, null, 2));
}

async function preguntar(mensaje) {
  return (await rl.question(mensaje)).trim();
}

async function crearTarea() {
  const titulo = await preguntar("Titulo: ");
  const tareas = cargar();
  const id = tareas.length ? Math.max(...tareas.map((t) => t.id)) + 1 : 1;
  tareas.push({ id, titulo, estado: "pendiente" });
  guardar(tareas);
  console.log("Tarea creada.");
}

async function listarTareas() {
  console.log("Funcion aun no implementada.");
}

async function actualizarTarea() {
  console.log("Funcion aun no implementada.");
}

async function eliminarTarea() {
  console.log("Funcion aun no implementada.");
}

async function menu() {
  const acciones = {
    "1": crearTarea,
    "2": listarTareas,
    "3": actualizarTarea,
    "4": eliminarTarea,
  };
  while (true) {
    console.log("\n--- Gestor de tareas ---");
    console.log("1. Crear  2. Listar  3. Actualizar  4. Eliminar  0. Salir");
    const op = await preguntar("Opcion: ");
    if (op === "0") break;
    if (acciones[op]) await acciones[op]();
    else console.log("Opcion invalida.");
  }
  rl.close();
}

menu();
