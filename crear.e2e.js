// Selenium - Pruebas E2E de CREAR tareas (index.html)
// Ejecutar con: npm run test:e2e   (HEADLESS=false para ver el navegador)
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const URL_APP = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

// HEADLESS=false npm run test:e2e  -> abre el navegador para verlo en pantalla
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

test("SEL-01 la pagina carga con el titulo y sin tareas", async () => {
  assert.strictEqual(await driver.getTitle(), "Gestor de Tareas");
  assert.match(await driver.findElement(By.id("lista")).getText(), /No hay tareas todavia/);
  assert.strictEqual(await texto(driver, "total"), "0");
});

test("SEL-02 crear una tarea la muestra como pendiente y actualiza los contadores", async () => {
  await crear(driver, "Estudiar Selenium");
  const lista = await filas(driver);
  assert.strictEqual(lista.length, 1);
  const textoFila = await lista[0].getText();
  assert.match(textoFila, /Estudiar Selenium/);
  assert.match(textoFila, /pendiente/);
  assert.strictEqual(await texto(driver, "total"), "1");
  assert.strictEqual(await texto(driver, "pend"), "1");
});

test("SEL-03 un titulo vacio muestra un error y no crea la tarea", async () => {
  await crear(driver, "   ");
  assert.match(await texto(driver, "error"), /no puede estar vacio/);
  assert.strictEqual((await filas(driver)).length, 0);
});

test("SEL-04 crear una tarea con la tecla Enter", async () => {
  const campo = await driver.findElement(By.id("titulo"));
  await campo.sendKeys("Con Enter", Key.ENTER);
  const lista = await filas(driver);
  assert.strictEqual(lista.length, 1);
  assert.match(await lista[0].getText(), /Con Enter/);
});

test("SEL-05 el texto con HTML se muestra como texto y no se interpreta", async () => {
  await crear(driver, "<b>hola</b>");
  const lista = await filas(driver);
  assert.match(await lista[0].getText(), /<b>hola<\/b>/);
  assert.strictEqual((await lista[0].findElements(By.css("b"))).length, 0);
});
