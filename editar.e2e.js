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
test.beforeEach(async () => {
  await abrirLimpio(driver);
  await crear(driver, "Tarea original");
});

test("SEL-06 editar carga el titulo en el formulario y cambia el boton", async () => {
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Editar")).click();
  assert.strictEqual(await driver.findElement(By.id("titulo")).getAttribute("value"), "Tarea original");
  assert.strictEqual(await driver.findElement(By.id("guardar")).getText(), "Guardar cambios");
  assert.strictEqual(await driver.findElement(By.id("cancelar")).isDisplayed(), true);
});

test("SEL-07 guardar la edicion actualiza el titulo sin crear otra tarea", async () => {
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Editar")).click();
  await crear(driver, "Tarea editada");
  const lista = await filas(driver);
  assert.strictEqual(lista.length, 1);
  assert.match(await lista[0].getText(), /Tarea editada/);
  assert.strictEqual(await driver.findElement(By.id("guardar")).getText(), "Agregar");
});

test("SEL-08 cancelar la edicion no cambia la tarea y limpia el formulario", async () => {
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Editar")).click();
  await driver.findElement(By.id("titulo")).sendKeys(" extra");
  await driver.findElement(By.id("cancelar")).click();
  assert.strictEqual(await driver.findElement(By.id("titulo")).getAttribute("value"), "");
  const lista = await filas(driver);
  assert.match(await lista[0].getText(), /Tarea original/);
});

test("SEL-09 marcar como hecha cambia el estado y los contadores", async () => {
  const [fila] = await filas(driver);
  await (await botonDeFila(fila, "Hecha")).click();
  const [actualizada] = await filas(driver);
  assert.match(await actualizada.getAttribute("class"), /hecha/);
  assert.match(await actualizada.getText(), /hecha/);
  assert.strictEqual(await texto(driver, "hechas"), "1");
  assert.strictEqual(await texto(driver, "pend"), "0");
});

test("SEL-10 reabrir una tarea hecha la devuelve a pendiente", async () => {
  let [fila] = await filas(driver);
  await (await botonDeFila(fila, "Hecha")).click();
  [fila] = await filas(driver);
  await (await botonDeFila(fila, "Reabrir")).click();
  [fila] = await filas(driver);
  assert.match(await fila.getText(), /pendiente/);
  assert.strictEqual(await texto(driver, "pend"), "1");
});
