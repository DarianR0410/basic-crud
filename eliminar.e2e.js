
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

test("SEL-11 eliminar aceptando la confirmacion borra solo esa tarea", async () => {
  await crear(driver, "Primera");
  await crear(driver, "Segunda");
  const lista = await filas(driver);
  await (await botonDeFila(lista[0], "Eliminar")).click();
  await driver.switchTo().alert().accept();
  const restantes = await filas(driver);
  assert.strictEqual(restantes.length, 1);
  assert.match(await restantes[0].getText(), /Segunda/);
  assert.strictEqual(await texto(driver, "total"), "1");
});

test("SEL-12 eliminar cancelando la confirmacion conserva la tarea", async () => {
  await crear(driver, "Se queda");
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Eliminar")).click();
  await driver.switchTo().alert().dismiss();
  assert.strictEqual((await filas(driver)).length, 1);
});

test("SEL-13 al eliminar la ultima tarea vuelve el mensaje de lista vacia", async () => {
  await crear(driver, "Unica");
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Eliminar")).click();
  await driver.switchTo().alert().accept();
  assert.match(await driver.findElement(By.id("lista")).getText(), /No hay tareas todavia/);
  assert.strictEqual(await texto(driver, "total"), "0");
});

test("SEL-14 las tareas persisten al recargar la pagina", async () => {
  await crear(driver, "Persistente");
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.css("#lista li")), 5000);
  const lista = await filas(driver);
  assert.strictEqual(lista.length, 1);
  assert.match(await lista[0].getText(), /Persistente/);
});

test("SEL-15 el estado hecha tambien persiste al recargar", async () => {
  await crear(driver, "Terminada");
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Hecha")).click();
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.css("#lista li")), 5000);
  const [recargada] = await filas(driver);
  assert.match(await recargada.getText(), /hecha/);
  assert.strictEqual(await texto(driver, "hechas"), "1");
});
