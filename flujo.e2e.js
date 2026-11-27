 test:e2e   (HEADLESS=false para ver el navegador)
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const URL_APP = pathToFileURL(path.join(__dirname, "..", "index.html")).href;


async function crearDriver() {
  const opciones = new chrome.Options();
  if (process.env.HEADLESS !== "false") opciones.addArguments("--headless=new");
  opciones.addArguments("--window-size=1000,900");
  if (process.getuid && process.getuid() === 0) opciones.addArguments("--no-sandbox");
  return new Builder().forBrowser("chrome").setChromeOptions(opciones).build();
}

async function abrirLimpio(driver) {
  await driver.get(URL_APP);
  await driver.executeScript("localStorage.clear()");
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.id("lista")), 5000);
}

async function crear(driver, titulo) {
  const campo = await driver.findElement(By.id("titulo"));
  await campo.clear();
  await campo.sendKeys(titulo);
  await driver.findElement(By.id("guardar")).click();
}

const filas = (driver) => driver.findElements(By.css("#lista li:not(.vacio)"));
const texto = (driver, id) => driver.findElement(By.id(id)).getText();

async function botonDeFila(fila, etiqueta) {
  const botones = await fila.findElements(By.css("button"));
  for (const b of botones) if ((await b.getText()) === etiqueta) return b;
  throw new Error("No se encontro el boton: " + etiqueta);
}


let driver;
test.before(async () => { driver = await crearDriver(); });
test.after(async () => { if (driver) await driver.quit(); });
test.beforeEach(async () => { await abrirLimpio(driver); });

async function textos(driver) {
  const lista = await filas(driver);
  return Promise.all(lista.map((f) => f.getText()));
}

test("SEL-16 los ids visibles son incrementales (#1, #2, #3)", async () => {
  await crear(driver, "A");
  await crear(driver, "B");
  await crear(driver, "C");
  const t = await textos(driver);
  assert.match(t[0], /#1/);
  assert.match(t[1], /#2/);
  assert.match(t[2], /#3/);
});

test("SEL-17 las tareas se muestran en el orden en que se crearon", async () => {
  for (const n of ["Primera", "Segunda", "Tercera"]) await crear(driver, n);
  const t = await textos(driver);
  assert.match(t[0], /Primera/);
  assert.match(t[1], /Segunda/);
  assert.match(t[2], /Tercera/);
});

test("SEL-18 flujo completo: crear, marcar, editar y eliminar", async () => {
  await crear(driver, "Tarea A");
  await crear(driver, "Tarea B");
  await crear(driver, "Tarea C");

  // marcar B como hecha
  let lista = await filas(driver);
  await (await botonDeFila(lista[1], "Hecha")).click();

  // editar A
  lista = await filas(driver);
  await (await botonDeFila(lista[0], "Editar")).click();
  await crear(driver, "Tarea A editada");

  // eliminar C
  lista = await filas(driver);
  await (await botonDeFila(lista[2], "Eliminar")).click();
  await driver.switchTo().alert().accept();

  const t = await textos(driver);
  assert.strictEqual(t.length, 2);
  assert.match(t[0], /Tarea A editada/);
  assert.match(t[0], /pendiente/);
  assert.match(t[1], /Tarea B/);
  assert.match(t[1], /hecha/);
  assert.strictEqual(await texto(driver, "total"), "2");
  assert.strictEqual(await texto(driver, "pend"), "1");
  assert.strictEqual(await texto(driver, "hechas"), "1");
});

test("SEL-19 tras eliminar una tarea, el nuevo id no repite uno existente", async () => {
  await crear(driver, "Uno");
  await crear(driver, "Dos");
  let lista = await filas(driver);
  await (await botonDeFila(lista[0], "Eliminar")).click();
  await driver.switchTo().alert().accept();
  await crear(driver, "Tres");
  const t = await textos(driver);
  const ids = t.map((x) => x.match(/#(\d+)/)[1]);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test("SEL-20 el total siempre es igual a pendientes + hechas", async () => {
  for (const n of ["a", "b", "c", "d"]) await crear(driver, n);
  let lista = await filas(driver);
  await (await botonDeFila(lista[0], "Hecha")).click();
  lista = await filas(driver);
  await (await botonDeFila(lista[2], "Hecha")).click();
  lista = await filas(driver);
  await (await botonDeFila(lista[3], "Eliminar")).click();
  await driver.switchTo().alert().accept();
  const total = Number(await texto(driver, "total"));
  const pend = Number(await texto(driver, "pend"));
  const hechas = Number(await texto(driver, "hechas"));
  assert.strictEqual(total, pend + hechas);
  assert.strictEqual(total, 3);
});
