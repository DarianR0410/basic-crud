// Pruebas de QA - Gestor de tareas (caja negra sobre app.js)
// Ejecutar con: npm test   (o: node --test)
const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP = process.env.APP_PATH || path.join(__dirname, "..", "app.js");

function nuevaCarpeta() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qa-tareas-"));
}

// Ejecuta la app enviando una entrada cada vez que aparece un prompt (texto que termina en ": ")
function ejecutar(entradas, dir = nuevaCarpeta()) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(process.execPath, [APP], { cwd: dir });
    let salida = "";
    let i = 0;
    let ultimoLargo = 0;
    const limite = setTimeout(() => {
      hijo.kill();
      reject(new Error("Tiempo agotado. Salida:\n" + salida));
    }, 8000);

    hijo.stdout.on("data", (d) => {
      salida += d.toString();
      if (salida.endsWith(": ") && salida.length > ultimoLargo) {
        ultimoLargo = salida.length;
        if (i < entradas.length) hijo.stdin.write(entradas[i++] + "\n");
        else hijo.stdin.end();
      }
    });
    hijo.on("close", () => {
      clearTimeout(limite);
      const archivo = path.join(dir, "tareas.json");
      const tareas = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, "utf8")) : null;
      resolve({ salida, tareas, dir });
    });
  });
}

test("QA-01 el menu se muestra y la app termina con la opcion 0", async () => {
  const r = await ejecutar(["0"]);
  assert.match(r.salida, /Gestor de tareas/);
  assert.match(r.salida, /1\. Crear\s+2\. Listar\s+3\. Actualizar\s+4\. Eliminar\s+0\. Salir/);
});

test("QA-02 una opcion invalida muestra un mensaje y la app sigue funcionando", async () => {
  const r = await ejecutar(["9", "0"]);
  assert.match(r.salida, /Opcion invalida/);
});

test("QA-03 CREATE: crea una tarea pendiente con id 1", async () => {
  const r = await ejecutar(["1", "Comprar pan", "0"]);
  assert.match(r.salida, /Tarea creada/);
  assert.deepStrictEqual(r.tareas, [{ id: 1, titulo: "Comprar pan", estado: "pendiente" }]);
});

test("QA-04 CREATE: los ids son incrementales", async () => {
  const r = await ejecutar(["1", "Uno", "1", "Dos", "1", "Tres", "0"]);
  assert.deepStrictEqual(r.tareas.map((t) => t.id), [1, 2, 3]);
});

test("QA-05 CREATE: rechaza un titulo vacio y vuelve a pedirlo", async () => {
  const r = await ejecutar(["1", "", "   ", "Tarea valida", "0"]);
  assert.match(r.salida, /no puede estar vacio/);
  assert.strictEqual(r.tareas.length, 1);
  assert.strictEqual(r.tareas[0].titulo, "Tarea valida");
});

test("QA-06 READ: sin tareas informa que no hay tareas", async () => {
  const r = await ejecutar(["2", "0"]);
  assert.match(r.salida, /No hay tareas/);
});

test("QA-07 READ: lista las tareas con id, titulo y estado", async () => {
  const r = await ejecutar(["1", "Estudiar", "1", "Leer", "2", "0"]);
  assert.match(r.salida, /\[1\] Estudiar - pendiente/);
  assert.match(r.salida, /\[2\] Leer - pendiente/);
});

test("QA-08 UPDATE: cambia titulo y estado", async () => {
  const r = await ejecutar(["1", "Viejo", "3", "1", "Nuevo", "hecha", "0"]);
  assert.match(r.salida, /Tarea actualizada/);
  assert.deepStrictEqual(r.tareas, [{ id: 1, titulo: "Nuevo", estado: "hecha" }]);
});

test("QA-09 UPDATE: si el estado queda vacio se asigna pendiente", async () => {
  const r = await ejecutar(["1", "Tarea", "3", "1", "Tarea editada", "", "0"]);
  assert.strictEqual(r.tareas[0].estado, "pendiente");
});

test("QA-10 UPDATE: un id inexistente muestra 'No existe esa tarea'", async () => {
  const r = await ejecutar(["1", "Tarea", "3", "99", "0"]);
  assert.match(r.salida, /No existe esa tarea/);
  assert.strictEqual(r.tareas[0].titulo, "Tarea");
});

test("QA-11 VALIDACION: un id no numerico se rechaza y se vuelve a pedir", async () => {
  const r = await ejecutar(["1", "Tarea", "3", "abc", "1", "Editada", "hecha", "0"]);
  assert.match(r.salida, /numero entero/);
  assert.strictEqual(r.tareas[0].titulo, "Editada");
});

test("QA-12 DELETE: elimina una tarea existente", async () => {
  const r = await ejecutar(["1", "A", "1", "B", "4", "1", "0"]);
  assert.match(r.salida, /Tarea eliminada/);
  assert.deepStrictEqual(r.tareas.map((t) => t.titulo), ["B"]);
});

test("QA-13 DELETE: un id inexistente no borra nada", async () => {
  const r = await ejecutar(["1", "A", "4", "50", "0"]);
  assert.match(r.salida, /No existe esa tarea/);
  assert.strictEqual(r.tareas.length, 1);
});

test("QA-14 DELETE: tras eliminar, un id nuevo no repite el de una tarea existente", async () => {
  const r = await ejecutar(["1", "A", "1", "B", "4", "1", "1", "C", "0"]);
  const ids = r.tareas.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test("QA-15 PERSISTENCIA: los datos se conservan entre ejecuciones", async () => {
  const dir = nuevaCarpeta();
  await ejecutar(["1", "Persistente", "0"], dir);
  const r = await ejecutar(["2", "0"], dir);
  assert.match(r.salida, /\[1\] Persistente - pendiente/);
});
